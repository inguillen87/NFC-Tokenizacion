#!/usr/bin/env node
import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Contract, JsonRpcProvider, Transaction, Wallet, formatEther, getAddress, isAddress } from "ethers";
import {
  markIotaBroadcast,
  markIotaConfirmed,
  markIotaFailed,
  markIotaSigned,
  markIotaSubmitted,
  reserveIotaPublish,
} from "./iota-idempotency.mjs";
import { runDurableIotaBroadcast } from "./iota-durable-broadcast.mjs";
import { kmsConfigured, signWithKms, validateSignedTransaction } from "./kms-signer.mjs";
import {
  createPolygonMintQueue,
  reconcileExistingPolygonMint,
  runPolygonMintIdempotently,
} from "./polygon-idempotency.mjs";
import { signWithWrappedKms, wrappedKmsConfigured } from "./wrapped-kms-signer.mjs";

const polygonAbi = [
  "function mintWithChipHash(address to, string chipUidHash, string tokenUri, string assetRef) external returns (uint256)",
  "function tokenByChipHash(string chipUidHash) external view returns (uint256)",
  "function chipUidHashByTokenId(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function assetRefByTokenId(uint256 tokenId) external view returns (string)",
];

const iotaEvidenceAbi = [
  "function SCHEMA_VERSION() view returns (uint16)",
  "function authorizedPublishers(address publisher) view returns (bool)",
  "function computeProofId(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) view returns (bytes32)",
  "function anchorEvidence(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) returns (bytes32 proofId)",
  "function isAnchored(bytes32 proofId) view returns (bool)",
  "function evidenceRecord(bytes32 proofId) view returns (bytes32 merkleRoot, bytes32 tenantIdHash, bytes32 memoHash, address publisher, uint64 eventCount, uint64 anchoredAt)",
];

const SUPPORTED_CAPABILITIES = new Set(["polygon", "iota"]);
let iotaPublishQueue = Promise.resolve();
const enqueuePolygonMint = createPolygonMintQueue();

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function executorCapabilities() {
  const configured = env("EXECUTOR_CAPABILITIES");
  if (!configured) return new Set(SUPPORTED_CAPABILITIES);
  const capabilities = configured.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!capabilities.length || capabilities.some((value) => !SUPPORTED_CAPABILITIES.has(value))) {
    throw new Error("executor_capabilities_invalid");
  }
  return new Set(capabilities);
}

function expectedChainId(name, fallback, errorCode) {
  const value = Number(env(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(errorCode);
  return value;
}

function privateKeyAddress(value) {
  try {
    return value ? new Wallet(value).address : null;
  } catch {
    return null;
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += String(chunk);
      if (raw.length > 128 * 1024) {
        reject(new Error("payload_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function secretMatches(provided, expected) {
  const left = Buffer.from(String(provided || ""), "utf8");
  const right = Buffer.from(String(expected || ""), "utf8");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function authOk(req, secretName, headerName) {
  const expected = env(secretName);
  if (!expected) return false;
  const headerSecret = String(req.headers[headerName] || "");
  const auth = String(req.headers.authorization || "");
  return secretMatches(headerSecret, expected)
    || (auth.startsWith("Bearer ") && secretMatches(auth.slice(7), expected));
}

function required(name, value) {
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function hashUid(uidHex, salt = "") {
  const normalizedUid = String(uidHex || "").trim().toUpperCase();
  const normalizedSalt = String(salt || env("TOKENIZATION_UID_SALT")).trim();
  return `sha256:${createHash("sha256").update(`${normalizedUid}:${normalizedSalt}`).digest("hex")}`;
}

function deriveTokenId(receipt) {
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const transferLog = receipt.logs.find((log) => log.topics?.[0] === transferTopic && log.topics?.[3]);
  return transferLog ? String(BigInt(transferLog.topics[3])) : null;
}

async function health() {
  const signerMode = env("EXECUTOR_SIGNER_MODE", "private_key").toLowerCase();
  const rpcUrl = env("POLYGON_RPC_URL");
  const contractAddress = env("POLYGON_CONTRACT_ADDRESS");
  const defaultRecipient = env("POLYGON_DEFAULT_RECIPIENT");
  const privateKey = signerMode === "private_key" ? env("POLYGON_MINTER_PRIVATE_KEY") : "";
  const polygonKms = signerMode === "kms" && kmsConfigured({ url: env("POLYGON_KMS_SIGNER_URL") || env("KMS_SIGNER_URL"), keyId: env("POLYGON_KMS_KEY_ID") || env("KMS_KEY_ID") }) && isAddress(env("POLYGON_KMS_PUBLISHER_ADDRESS"));
  const polygonWrappedKms = signerMode === "kms_wrapped" && wrappedKmsConfigured({ domain: "polygon" }) && isAddress(env("POLYGON_KMS_PUBLISHER_ADDRESS"));
  const configuredMinterAddress = env("POLYGON_MINTER_ADDRESS");
  const live = env("EXECUTOR_HEALTH_LIVE", "false").toLowerCase() === "true";
  const iotaRpcUrl = env("IOTA_EVM_RPC_URL");
  const iotaContractAddress = env("IOTA_EVM_ANCHOR_CONTRACT_V2");
  const iotaSignerMode = env("IOTA_EXECUTOR_SIGNER_MODE", env("EXECUTOR_SIGNER_MODE", "private_key")).toLowerCase();
  const iotaPrivateKey = iotaSignerMode === "private_key" ? env("IOTA_EVM_PRIVATE_KEY") : "";
  let iotaPublisherAddress = null;
  try {
    if (iotaSignerMode === "kms" || iotaSignerMode === "kms_wrapped") iotaPublisherAddress = env("IOTA_KMS_PUBLISHER_ADDRESS") || null;
    else if (iotaPrivateKey) iotaPublisherAddress = new Wallet(iotaPrivateKey).address;
  } catch {
    iotaPublisherAddress = null;
  }
  const iotaKmsReady = iotaSignerMode === "kms" && kmsConfigured() && isAddress(iotaPublisherAddress);
  const iotaWrappedKmsReady = iotaSignerMode === "kms_wrapped" && wrappedKmsConfigured({ domain: "iota" }) && isAddress(iotaPublisherAddress);

  let minterAddress = null;
  let minterBalancePol = null;
  let chainId = null;
  let contractDeployed = null;

  try {
  if (privateKey && signerMode === "private_key") minterAddress = new Wallet(privateKey).address;
  if ((signerMode === "kms" || signerMode === "kms_wrapped") && isAddress(env("POLYGON_KMS_PUBLISHER_ADDRESS"))) minterAddress = getAddress(env("POLYGON_KMS_PUBLISHER_ADDRESS"));
  } catch {
    minterAddress = null;
  }

  if (live && rpcUrl) {
    const provider = new JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    chainId = String(network.chainId);
    if (minterAddress) {
      minterBalancePol = Number(formatEther(await provider.getBalance(minterAddress)));
    }
    if (isAddress(contractAddress)) {
      const code = await provider.getCode(contractAddress);
      contractDeployed = Boolean(code && code !== "0x");
    }
  }

  return {
    ok: true,
    service: "nexid-tokenization-executor",
    signerMode,
    network: "polygon-amoy",
    rpcConfigured: Boolean(rpcUrl),
    contract: { address: contractAddress || null, deployed: contractDeployed },
    minter: {
      address: minterAddress,
      configuredAddress: configuredMinterAddress || null,
      matchesConfigured: configuredMinterAddress && minterAddress
        ? configuredMinterAddress.toLowerCase() === minterAddress.toLowerCase()
        : null,
      configured: signerMode === "kms" ? polygonKms : signerMode === "kms_wrapped" ? polygonWrappedKms : Boolean(privateKey),
      balancePol: minterBalancePol,
    },
    defaultRecipient: defaultRecipient || null,
    iotaEvidenceV2: {
      signerMode: iotaSignerMode,
      rpcConfigured: Boolean(iotaRpcUrl),
      contractAddress: isAddress(iotaContractAddress) ? getAddress(iotaContractAddress) : null,
      publisherAddress: iotaPublisherAddress,
      signerConfigured: iotaSignerMode === "kms" ? iotaKmsReady : iotaSignerMode === "kms_wrapped" ? iotaWrappedKmsReady : Boolean(iotaPrivateKey && iotaPublisherAddress),
      executorSecretConfigured: Boolean(env("IOTA_PROOF_EXECUTOR_SECRET")),
    },
    kmsReady: iotaKmsReady || iotaWrappedKmsReady || polygonKms || polygonWrappedKms,
    note: signerMode === "kms_wrapped" || iotaSignerMode === "kms_wrapped"
      ? "Google KMS-wrapped pilot signer configured; plaintext exists only ephemerally in executor memory."
      : signerMode === "kms" || iotaSignerMode === "kms"
        ? "Remote non-exportable KMS/HSM signer configured."
        : "Private-key executor is for isolated testnet development only.",
  };
}

function polygonReadiness() {
  const signerMode = env("EXECUTOR_SIGNER_MODE", "private_key").toLowerCase();
  let expectedChainIdValid = true;
  try {
    expectedChainId("POLYGON_EXPECTED_CHAIN_ID", 80002, "polygon_expected_chain_id_invalid");
  } catch {
    expectedChainIdValid = false;
  }
  const publisherAddress = env("POLYGON_KMS_PUBLISHER_ADDRESS");
  const signer = signerMode === "kms"
    ? kmsConfigured({
      url: env("POLYGON_KMS_SIGNER_URL") || env("KMS_SIGNER_URL"),
      keyId: env("POLYGON_KMS_KEY_ID") || env("KMS_KEY_ID"),
    }) && isAddress(publisherAddress)
    : signerMode === "kms_wrapped"
      ? wrappedKmsConfigured({ domain: "polygon" }) && isAddress(publisherAddress)
      : signerMode === "private_key" && Boolean(privateKeyAddress(env("POLYGON_MINTER_PRIVATE_KEY")));
  const checks = {
    rpc: Boolean(env("POLYGON_RPC_URL")),
    contract: isAddress(env("POLYGON_CONTRACT_ADDRESS")),
    executor_secret: Boolean(env("TOKENIZATION_EXECUTOR_SECRET")),
    expected_chain_id: expectedChainIdValid,
    signer,
  };
  return { ok: Object.values(checks).every(Boolean), signer_mode: signerMode, checks };
}

function iotaReadiness() {
  const signerMode = env("IOTA_EXECUTOR_SIGNER_MODE", env("EXECUTOR_SIGNER_MODE", "private_key")).toLowerCase();
  let expectedChainIdValid = true;
  try {
    expectedChainId("IOTA_EVM_EXPECTED_CHAIN_ID", 1076, "iota_expected_chain_id_invalid");
  } catch {
    expectedChainIdValid = false;
  }
  const publisherAddress = env("IOTA_KMS_PUBLISHER_ADDRESS");
  const signer = signerMode === "kms"
    ? kmsConfigured() && isAddress(publisherAddress)
    : signerMode === "kms_wrapped"
      ? wrappedKmsConfigured({ domain: "iota" }) && isAddress(publisherAddress)
      : signerMode === "private_key" && Boolean(privateKeyAddress(env("IOTA_EVM_PRIVATE_KEY")));
  const checks = {
    rpc: Boolean(env("IOTA_EVM_RPC_URL")),
    contract: isAddress(env("IOTA_EVM_ANCHOR_CONTRACT_V2")),
    durable_store: Boolean(env("DATABASE_URL") || env("POSTGRES_URL")),
    executor_secret: Boolean(env("IOTA_PROOF_EXECUTOR_SECRET")),
    expected_chain_id: expectedChainIdValid,
    signer,
  };
  return { ok: Object.values(checks).every(Boolean), signer_mode: signerMode, checks };
}

function readiness() {
  let capabilities;
  try {
    capabilities = [...executorCapabilities()];
  } catch {
    return {
      ok: false,
      service: "nexid-tokenization-executor",
      capabilities: [],
      chains: {},
      signer_mode: null,
      checks: { capabilities: false },
      reason: "executor_capabilities_invalid",
    };
  }
  const chains = {};
  if (capabilities.includes("polygon")) chains.polygon = polygonReadiness();
  if (capabilities.includes("iota")) chains.iota = iotaReadiness();
  const ok = capabilities.length > 0 && capabilities.every((capability) => chains[capability]?.ok === true);
  const legacy = chains.iota || chains.polygon;
  return {
    ok,
    service: "nexid-tokenization-executor",
    capabilities,
    chains,
    signer_mode: legacy?.signer_mode || null,
    checks: legacy?.checks || { capabilities: false },
  };
}

async function mintUnlocked(body, dependencies = {}) {
  const signerMode = env("EXECUTOR_SIGNER_MODE", "private_key").toLowerCase();
  if (!new Set(["private_key", "kms", "kms_wrapped"]).has(signerMode)) {
    throw new Error("executor_signer_mode_not_available_for_mint");
  }

  const expectedPolygonChainId = expectedChainId("POLYGON_EXPECTED_CHAIN_ID", 80002, "polygon_expected_chain_id_invalid");
  const rpcUrl = required("POLYGON_RPC_URL", env("POLYGON_RPC_URL"));
  const privateKey = signerMode === "private_key" ? required("POLYGON_MINTER_PRIVATE_KEY", env("POLYGON_MINTER_PRIVATE_KEY")) : null;
  const contractAddress = required("POLYGON_CONTRACT_ADDRESS", env("POLYGON_CONTRACT_ADDRESS"));
  const uidHex = String(body.uid_hex || "").trim();
  const chipUidHash = String(body.chip_uid_hash || (uidHex ? hashUid(uidHex) : ""));
  const tokenUri = String(required("token_uri", body.token_uri)).trim();
  const recipient = String(required("recipient", body.issuer_wallet || env("POLYGON_DEFAULT_RECIPIENT"))).trim();
  const publicAssetId = String(body.public_asset_id || `nx-${chipUidHash.split(":").pop()?.slice(0, 24) || "asset"}`);
  const assetRef = String(body.asset_ref || `${body.bid || "nexid"}:${publicAssetId}`);
  required("chip_uid_hash", chipUidHash);

  if (!isAddress(contractAddress)) throw new Error("invalid_POLYGON_CONTRACT_ADDRESS");
  if (!isAddress(recipient)) throw new Error("invalid_recipient");

  const provider = dependencies.provider || new JsonRpcProvider(rpcUrl, expectedPolygonChainId, { batchMaxCount: 1 });
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== expectedPolygonChainId) throw new Error("polygon_chain_id_mismatch");
  const readContract = dependencies.readContract || new Contract(contractAddress, polygonAbi, provider);
  const inspect = () => reconcileExistingPolygonMint({
    contract: readContract,
    contractAddress,
    recipient,
    chipUidHash,
    tokenUri,
    assetRef,
    requestId: body.request_id || null,
  });

  return runPolygonMintIdempotently({
    inspect,
    submit: async () => {
      const publisherAddress = signerMode === "private_key"
        ? new Wallet(privateKey).address
        : required("POLYGON_KMS_PUBLISHER_ADDRESS", env("POLYGON_KMS_PUBLISHER_ADDRESS"));
      if (!isAddress(publisherAddress)) throw new Error("invalid_POLYGON_KMS_PUBLISHER_ADDRESS");

      let tx;
      if (signerMode === "private_key") {
        const signingContract = dependencies.signingContract
          || new Contract(contractAddress, polygonAbi, new Wallet(privateKey, provider));
        tx = await signingContract.mintWithChipHash(recipient, chipUidHash, tokenUri, assetRef);
      } else {
        if (signerMode === "kms" && !kmsConfigured({ url: env("POLYGON_KMS_SIGNER_URL") || env("KMS_SIGNER_URL"), keyId: env("POLYGON_KMS_KEY_ID") || env("KMS_KEY_ID") })) {
          throw new Error("polygon_kms_not_configured");
        }
        if (signerMode === "kms_wrapped" && !wrappedKmsConfigured({ domain: "polygon" })) throw new Error("polygon_kms_wrap_not_configured");
        const unsigned = await readContract.mintWithChipHash.populateTransaction(recipient, chipUidHash, tokenUri, assetRef);
        const nonce = await provider.getTransactionCount(publisherAddress, "pending");
        const feeData = await provider.getFeeData();
        const gasLimit = await readContract.mintWithChipHash.estimateGas(recipient, chipUidHash, tokenUri, assetRef, { from: publisherAddress });
        const dynamic = feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null;
        if (!dynamic && feeData.gasPrice === null) throw new Error("polygon_fee_data_unavailable");
        const transaction = dynamic ? { type: 2, to: contractAddress, data: unsigned.data, nonce, value: "0", gas_limit: gasLimit.toString(), chain_id: String(expectedPolygonChainId), max_fee_per_gas: feeData.maxFeePerGas.toString(), max_priority_fee_per_gas: feeData.maxPriorityFeePerGas.toString() } : { type: 0, to: contractAddress, data: unsigned.data, nonce, value: "0", gas_limit: gasLimit.toString(), chain_id: String(expectedPolygonChainId), gas_price: feeData.gasPrice.toString() };
        const intent = { chainId: transaction.chain_id, expectedSignerAddress: publisherAddress, transaction };
        const signed = signerMode === "kms_wrapped"
          ? await (dependencies.signWithWrappedKms || signWithWrappedKms)(intent, { domain: "polygon", expectedChainId: expectedPolygonChainId })
          : await (dependencies.signWithKms || signWithKms)(intent, { url: env("POLYGON_KMS_SIGNER_URL") || env("KMS_SIGNER_URL"), keyId: env("POLYGON_KMS_KEY_ID") || env("KMS_KEY_ID"), bearer: env("POLYGON_KMS_SIGNER_TOKEN") || env("KMS_SIGNER_TOKEN"), allowedHosts: env("POLYGON_KMS_SIGNER_ALLOWED_HOSTS") || env("KMS_SIGNER_ALLOWED_HOSTS") });
        tx = await provider.broadcastTransaction(signed.signedTransaction);
      }
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error("polygon_receipt_failed");
      const transferTokenId = deriveTokenId(receipt);
      if (!transferTokenId) throw new Error("polygon_mint_transfer_event_missing");
      const canonical = await inspect();
      if (!canonical || canonical.token_id !== transferTokenId) throw new Error("polygon_mint_binding_not_confirmed");

      return {
        ...canonical,
        tx_hash: tx.hash,
        block_number: receipt.blockNumber,
        external_ref: `amoy:${contractAddress}:${tx.hash}`,
        already_minted: false,
        reconciled: false,
        evidence_source: "confirmed_transaction_and_on_chain_state",
      };
    },
  });
}

function mint(body) {
  return enqueuePolygonMint(() => mintUnlocked(body));
}

function sha256Bytes32(value, field) {
  const normalized = String(value || "").trim().replace(/^(?:sha256:|0x)/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error(`${field}_invalid`);
  return `0x${normalized}`;
}

function sameAddress(left, right) {
  try {
    return getAddress(String(left || "")) === getAddress(String(right || ""));
  } catch {
    return false;
  }
}

function evidenceRecordMatches(record, input) {
  return sha256Bytes32(record.merkleRoot ?? record[0], "record_merkle_root") === input.merkleRoot
    && sha256Bytes32(record.tenantIdHash ?? record[1], "record_tenant_id_hash") === input.tenantIdHash
    && sha256Bytes32(record.memoHash ?? record[2], "record_memo_hash") === input.memoHash
    && Number(record.eventCount ?? record[4]) === input.eventCount;
}

function normalizeIotaEvidenceRequest(body = {}) {
  const contractAddress = required("IOTA_EVM_ANCHOR_CONTRACT_V2", env("IOTA_EVM_ANCHOR_CONTRACT_V2"));
  const chainId = expectedChainId("IOTA_EVM_EXPECTED_CHAIN_ID", 1076, "iota_expected_chain_id_invalid");
  if (!isAddress(contractAddress)) throw new Error("invalid_IOTA_EVM_ANCHOR_CONTRACT_V2");
  if (body.contract_address && !sameAddress(body.contract_address, contractAddress)) {
    throw new Error("iota_executor_contract_mismatch");
  }
  if (body.chain_id !== undefined && body.chain_id !== null && Number(body.chain_id) !== chainId) {
    throw new Error("iota_executor_chain_mismatch");
  }

  const requestId = String(required("request_id", body.request_id)).trim();
  if (requestId.length > 200 || /[\u0000-\u001f\u007f]/.test(requestId)) throw new Error("iota_request_id_invalid");
  const resourceType = String(required("resource_type", body.resource_type)).trim();
  const publicResourceId = String(required("public_resource_id", body.public_resource_id)).trim();
  const eventCount = Number(body.event_count);
  if (!Number.isSafeInteger(eventCount) || eventCount <= 0) throw new Error("event_count_invalid");
  if (Buffer.byteLength(resourceType, "utf8") > 64) throw new Error("resource_type_too_long");
  if (Buffer.byteLength(publicResourceId, "utf8") > 128) throw new Error("public_resource_id_too_long");
  if (/\p{C}/u.test(resourceType) || /\p{C}/u.test(publicResourceId)) {
    throw new Error("public_resource_control_character_forbidden");
  }

  const proofId = String(required("proof_id", body.proof_id)).trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(proofId)) throw new Error("proof_id_invalid");
  return {
    requestId,
    proofId,
    chainId,
    contractAddress: getAddress(contractAddress),
    merkleRoot: sha256Bytes32(body.merkle_root, "merkle_root"),
    tenantIdHash: sha256Bytes32(body.tenant_id_hash, "tenant_id_hash"),
    resourceType,
    publicResourceId,
    eventCount,
    memoHash: sha256Bytes32(body.memo_hash, "memo_hash"),
  };
}

function iotaReservationPayload(input) {
  return {
    protocol_version: 2,
    proof_id: input.proofId,
    chain_id: input.chainId,
    contract_address: input.contractAddress,
    merkle_root: input.merkleRoot,
    tenant_id_hash: input.tenantIdHash,
    resource_type: input.resourceType,
    public_resource_id: input.publicResourceId,
    event_count: input.eventCount,
    memo_hash: input.memoHash,
  };
}

function ethersTransactionRequest(intent) {
  const transaction = intent.transaction;
  const request = {
    type: Number(transaction.type),
    chainId: BigInt(intent.chainId),
    to: transaction.to,
    data: transaction.data,
    nonce: Number(transaction.nonce),
    value: BigInt(transaction.value),
    gasLimit: BigInt(transaction.gas_limit),
  };
  if (request.type === 2) {
    return {
      ...request,
      maxFeePerGas: BigInt(transaction.max_fee_per_gas),
      maxPriorityFeePerGas: BigInt(transaction.max_priority_fee_per_gas),
    };
  }
  return { ...request, gasPrice: BigInt(transaction.gas_price) };
}

function recoveredIotaSigned(reservation, input, publisherAddress, unsignedData) {
  let parsed;
  try {
    parsed = Transaction.from(reservation.rawTransaction);
  } catch {
    throw new Error("iota_recovered_transaction_invalid");
  }
  if (!parsed.isSigned() || (parsed.type !== 0 && parsed.type !== 2)) {
    throw new Error("iota_recovered_transaction_invalid");
  }
  const transaction = {
    type: parsed.type,
    to: input.contractAddress,
    data: unsignedData,
    nonce: parsed.nonce,
    value: "0",
    gas_limit: parsed.gasLimit.toString(),
    chain_id: input.chainId,
    ...(parsed.type === 2 ? {
      max_fee_per_gas: parsed.maxFeePerGas?.toString(),
      max_priority_fee_per_gas: parsed.maxPriorityFeePerGas?.toString(),
    } : { gas_price: parsed.gasPrice?.toString() }),
  };
  const validated = validateSignedTransaction(reservation.rawTransaction, {
    chainId: input.chainId,
    expectedSignerAddress: publisherAddress,
    transaction,
  });
  if (validated.transactionHash.toLowerCase() !== String(reservation.txHash).toLowerCase()) {
    throw new Error("iota_recovered_transaction_hash_mismatch");
  }
  if (!sameAddress(validated.signerAddress, reservation.signerAddress)
      || Number(reservation.chainId) !== input.chainId
      || Number(reservation.nonce) !== parsed.nonce) {
    throw new Error("iota_recovered_transaction_metadata_mismatch");
  }
  return {
    rawTransaction: validated.signedTransaction,
    txHash: validated.transactionHash.toLowerCase(),
    signerAddress: validated.signerAddress,
    chainId: input.chainId,
    nonce: parsed.nonce,
  };
}

function terminalIotaReservationFailure(error) {
  return error?.message === "iota_executor_proof_id_mismatch"
    || error?.message === "iota_anchor_storage_mismatch";
}

async function anchorIotaEvidenceUnlocked(input, reservation, dependencies = {}) {
  const signerMode = env("IOTA_EXECUTOR_SIGNER_MODE", env("EXECUTOR_SIGNER_MODE", "private_key")).toLowerCase();
  if (!reservation.recover && !new Set(["private_key", "kms", "kms_wrapped"]).has(signerMode)) {
    throw new Error("executor_signer_mode_not_available_for_iota");
  }

  const ownsProvider = !dependencies.provider;
  const provider = dependencies.provider || new JsonRpcProvider(
    required("IOTA_EVM_RPC_URL", env("IOTA_EVM_RPC_URL")),
    input.chainId,
    { batchMaxCount: 1 },
  );
  try {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== input.chainId) throw new Error("iota_chain_id_mismatch");
    const bytecode = await provider.getCode(input.contractAddress);
    if (!bytecode || bytecode === "0x") throw new Error("iota_v2_contract_not_deployed");

    const wallet = !reservation.recover && signerMode === "private_key"
      ? new Wallet(required("IOTA_EVM_PRIVATE_KEY", env("IOTA_EVM_PRIVATE_KEY")))
      : null;
    const publisherAddress = reservation.recover
      ? getAddress(reservation.signerAddress)
      : wallet
        ? wallet.address
        : getAddress(required("IOTA_KMS_PUBLISHER_ADDRESS", env("IOTA_KMS_PUBLISHER_ADDRESS")));
    const readContract = dependencies.readContract || new Contract(input.contractAddress, iotaEvidenceAbi, provider);
    if (Number(await readContract.SCHEMA_VERSION()) !== 2) throw new Error("iota_contract_schema_version_mismatch");
    if (!await readContract.authorizedPublishers(publisherAddress)) throw new Error("iota_publisher_not_authorized");

    const argumentsV2 = [
      input.merkleRoot,
      input.tenantIdHash,
      input.resourceType,
      input.publicResourceId,
      input.eventCount,
      input.memoHash,
    ];
    const contractProofId = String(await readContract.computeProofId(...argumentsV2)).toLowerCase();
    if (contractProofId !== input.proofId) throw new Error("iota_executor_proof_id_mismatch");

    if (await readContract.isAnchored(input.proofId)) {
      const record = await readContract.evidenceRecord(input.proofId);
      if (!evidenceRecordMatches(record, input)) throw new Error("iota_anchor_storage_mismatch");
      const response = {
        ok: true,
        state: "confirmed",
        already_anchored: true,
        proof_id: input.proofId,
        chain_id: input.chainId,
        contract_address: input.contractAddress,
        publisher_address: getAddress(String(record.publisher ?? record[3])),
        tx_hash: null,
        nonce: null,
        block_number: null,
        block_hash: null,
        confirmations: 0,
        anchored_at: Number(record.anchoredAt ?? record[5]),
        request_id: input.requestId,
      };
      if (reservation.durable) await markIotaConfirmed(input.proofId, reservation.leaseToken, response);
      return response;
    }

    const unsigned = await readContract.anchorEvidence.populateTransaction(...argumentsV2);
    const createSigned = async () => {
      const nonce = await provider.getTransactionCount(publisherAddress, "pending");
      const feeData = await provider.getFeeData();
      const gasLimit = await readContract.anchorEvidence.estimateGas(...argumentsV2, { from: publisherAddress });
      const dynamicFeesAvailable = feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null;
      if (!dynamicFeesAvailable && feeData.gasPrice === null) throw new Error("iota_fee_data_unavailable");
      const transaction = dynamicFeesAvailable ? {
        type: 2,
        to: input.contractAddress,
        data: unsigned.data,
        nonce,
        value: "0",
        gas_limit: gasLimit.toString(),
        chain_id: input.chainId,
        max_fee_per_gas: feeData.maxFeePerGas.toString(),
        max_priority_fee_per_gas: feeData.maxPriorityFeePerGas.toString(),
      } : {
        type: 0,
        to: input.contractAddress,
        data: unsigned.data,
        nonce,
        value: "0",
        gas_limit: gasLimit.toString(),
        chain_id: input.chainId,
        gas_price: feeData.gasPrice.toString(),
      };
      const intent = { chainId: input.chainId, expectedSignerAddress: publisherAddress, transaction };
      let signed;
      if (wallet) {
        signed = validateSignedTransaction(await wallet.signTransaction(ethersTransactionRequest(intent)), intent);
      } else if (signerMode === "kms_wrapped") {
        if (!wrappedKmsConfigured({ domain: "iota" })) throw new Error("iota_kms_wrap_not_configured");
        signed = await (dependencies.signWithWrappedKms || signWithWrappedKms)(intent, {
          domain: "iota",
          expectedChainId: input.chainId,
        });
      } else {
        if (!kmsConfigured()) throw new Error("iota_kms_not_configured");
        signed = await (dependencies.signWithKms || signWithKms)(intent);
      }
      return {
        rawTransaction: signed.signedTransaction,
        txHash: signed.transactionHash.toLowerCase(),
        signerAddress: signed.signerAddress,
        chainId: input.chainId,
        nonce,
      };
    };

    const persistedSigned = reservation.recover
      ? recoveredIotaSigned(reservation, input, publisherAddress, unsigned.data)
      : null;
    const durableReservation = persistedSigned ? { ...reservation, ...persistedSigned } : reservation;
    return await runDurableIotaBroadcast({
      reservation: durableReservation,
      proofId: input.proofId,
      leaseToken: reservation.leaseToken,
      createSigned,
      buildResponse: ({ transaction, recoveredAfterBroadcastError }) => ({
        ok: true,
        state: "submitted",
        already_anchored: false,
        proof_id: input.proofId,
        chain_id: input.chainId,
        contract_address: input.contractAddress,
        publisher_address: publisherAddress,
        tx_hash: String(transaction.hash).toLowerCase(),
        nonce: Number(transaction.nonce),
        block_number: null,
        block_hash: null,
        confirmations: 0,
        anchored_at: null,
        request_id: input.requestId,
        recovered_after_broadcast_error: recoveredAfterBroadcastError,
      }),
    }, {
      persistSigned: markIotaSigned,
      persistBroadcast: markIotaBroadcast,
      persistSubmitted: markIotaSubmitted,
      broadcast: (rawTransaction) => provider.broadcastTransaction(rawTransaction),
      lookup: async (txHash) => {
        try {
          const transaction = await provider.getTransaction(txHash);
          if (transaction && String(transaction.hash).toLowerCase() === txHash) return transaction;
        } catch {}
        try {
          const receipt = await provider.getTransactionReceipt(txHash);
          if (receipt && String(receipt.hash).toLowerCase() === txHash) return receipt;
        } catch {}
        return null;
      },
    });
  } catch (error) {
    if (reservation.durable && terminalIotaReservationFailure(error)) {
      await markIotaFailed(input.proofId, reservation.leaseToken, error.message).catch(() => {});
    }
    throw error;
  } finally {
    if (ownsProvider) provider.destroy();
  }
}

async function anchorIotaEvidence(body) {
  const input = normalizeIotaEvidenceRequest(body);
  const reservation = await reserveIotaPublish({
    proofId: input.proofId,
    requestId: input.requestId,
    payload: iotaReservationPayload(input),
  });
  if (reservation.replay) return reservation.response;
  if (reservation.failed) throw new Error(reservation.errorCode);
  if (reservation.busy) throw new Error("iota_publish_in_progress");
  const operation = () => anchorIotaEvidenceUnlocked(input, reservation);
  const pending = iotaPublishQueue.then(operation, operation);
  iotaPublishQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

function safeErrorReason(error) {
  const reason = error instanceof Error ? error.message : "executor_failed";
  return /^[a-zA-Z0-9_]{3,120}$/.test(reason) ? reason : "executor_failed";
}

async function handler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/ready") {
      const result = readiness();
      return json(res, result.ok ? 200 : 503, result);
    }
    if (req.method === "GET" && ["/", "/health"].includes(url.pathname)) {
      return json(res, 200, await health());
    }
    if (req.method === "POST" && ["/", "/mint", "/tokenize"].includes(url.pathname)) {
      if (!executorCapabilities().has("polygon")) return json(res, 404, { ok: false, reason: "not_found" });
      if (!authOk(req, "TOKENIZATION_EXECUTOR_SECRET", "x-tokenization-secret")) {
        return json(res, 401, { ok: false, reason: "unauthorized_executor" });
      }
      const body = await readJson(req);
      return json(res, 200, await mint(body));
    }
    if (req.method === "POST" && ["/anchor-evidence", "/iota/evidence-v2"].includes(url.pathname)) {
      if (!executorCapabilities().has("iota")) return json(res, 404, { ok: false, reason: "not_found" });
      if (!authOk(req, "IOTA_PROOF_EXECUTOR_SECRET", "x-iota-proof-secret")) {
        return json(res, 401, { ok: false, reason: "unauthorized_executor" });
      }
      const body = await readJson(req);
      const result = await anchorIotaEvidence(body);
      return json(res, result.state === "submitted" ? 202 : 200, result);
    }
    return json(res, 404, { ok: false, reason: "not_found" });
  } catch (error) {
    return json(res, 400, { ok: false, reason: safeErrorReason(error) });
  }
}

function createExecutorServer() {
  let draining = false;
  let drainPromise = null;
  const server = http.createServer((req, res) => {
    if (draining) return json(res, 503, { ok: false, reason: "executor_draining" });
    void handler(req, res);
  });
  return {
    server,
    get draining() { return draining; },
    beginDrain() {
      if (drainPromise) return drainPromise;
      draining = true;
      drainPromise = new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error); else resolve();
        });
      });
      return drainPromise;
    },
  };
}

const port = Number(env("PORT", "3010"));
export { anchorIotaEvidence, createExecutorServer, handler, mintUnlocked, secretMatches, sha256Bytes32 };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runtime = createExecutorServer();
  const beginShutdown = (signal) => {
    console.log(JSON.stringify({ ok: true, service: "nexid-tokenization-executor", state: "draining", signal }));
    void runtime.beginDrain().then(() => {
      console.log(JSON.stringify({ ok: true, service: "nexid-tokenization-executor", state: "stopped" }));
    }).catch((error) => {
      process.exitCode = 1;
      console.error(JSON.stringify({ ok: false, service: "nexid-tokenization-executor", state: "drain_failed", reason: safeErrorReason(error) }));
    });
  };
  process.once("SIGTERM", () => beginShutdown("SIGTERM"));
  process.once("SIGINT", () => beginShutdown("SIGINT"));
  runtime.server.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({ ok: true, service: "nexid-tokenization-executor", port }));
  });
}
