#!/usr/bin/env node
import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Contract, JsonRpcProvider, Wallet, formatEther, getAddress, isAddress } from "ethers";
import { markIotaSubmitted, reserveIotaPublish } from "./iota-idempotency.mjs";
import { kmsConfigured, signWithKms } from "./kms-signer.mjs";

const polygonAbi = [
  "function mintWithChipHash(address to, string chipUidHash, string tokenUri, string assetRef) external returns (uint256)",
];

const iotaEvidenceAbi = [
  "function SCHEMA_VERSION() view returns (uint16)",
  "function authorizedPublishers(address publisher) view returns (bool)",
  "function computeProofId(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) view returns (bytes32)",
  "function anchorEvidence(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) returns (bytes32 proofId)",
  "function isAnchored(bytes32 proofId) view returns (bool)",
  "function evidenceRecord(bytes32 proofId) view returns (bytes32 merkleRoot, bytes32 tenantIdHash, bytes32 memoHash, address publisher, uint64 eventCount, uint64 anchoredAt)",
];

let iotaPublishQueue = Promise.resolve();

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
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
  const privateKey = env("POLYGON_MINTER_PRIVATE_KEY");
  const polygonKms = signerMode === "kms" && kmsConfigured({ url: env("POLYGON_KMS_SIGNER_URL") || env("KMS_SIGNER_URL"), keyId: env("POLYGON_KMS_KEY_ID") || env("KMS_KEY_ID") }) && isAddress(env("POLYGON_KMS_PUBLISHER_ADDRESS"));
  const configuredMinterAddress = env("POLYGON_MINTER_ADDRESS");
  const live = env("EXECUTOR_HEALTH_LIVE", "false").toLowerCase() === "true";
  const iotaRpcUrl = env("IOTA_EVM_RPC_URL");
  const iotaContractAddress = env("IOTA_EVM_ANCHOR_CONTRACT_V2");
  const iotaPrivateKey = env("IOTA_EVM_PRIVATE_KEY");
  const iotaSignerMode = env("IOTA_EXECUTOR_SIGNER_MODE", env("EXECUTOR_SIGNER_MODE", "private_key")).toLowerCase();
  let iotaPublisherAddress = null;
  try {
    if (iotaSignerMode === "kms") iotaPublisherAddress = env("IOTA_KMS_PUBLISHER_ADDRESS") || null;
    else if (iotaPrivateKey) iotaPublisherAddress = new Wallet(iotaPrivateKey).address;
  } catch {
    iotaPublisherAddress = null;
  }
  const iotaKmsReady = iotaSignerMode === "kms" && kmsConfigured() && isAddress(iotaPublisherAddress);

  let minterAddress = null;
  let minterBalancePol = null;
  let chainId = null;
  let contractDeployed = null;

  try {
  if (privateKey && signerMode !== "kms") minterAddress = new Wallet(privateKey).address;
  if (signerMode === "kms" && isAddress(env("POLYGON_KMS_PUBLISHER_ADDRESS"))) minterAddress = getAddress(env("POLYGON_KMS_PUBLISHER_ADDRESS"));
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
      configured: signerMode === "kms" ? polygonKms : Boolean(privateKey),
      balancePol: minterBalancePol,
    },
    defaultRecipient: defaultRecipient || null,
    iotaEvidenceV2: {
      signerMode: iotaSignerMode,
      rpcConfigured: Boolean(iotaRpcUrl),
      contractAddress: isAddress(iotaContractAddress) ? getAddress(iotaContractAddress) : null,
      publisherAddress: iotaPublisherAddress,
      signerConfigured: iotaSignerMode === "kms" ? iotaKmsReady : Boolean(iotaPrivateKey && iotaPublisherAddress),
      executorSecretConfigured: Boolean(env("IOTA_PROOF_EXECUTOR_SECRET")),
    },
    kmsReady: iotaKmsReady || polygonKms,
    note: iotaSignerMode === "kms" ? "Remote KMS/HSM signer configured; private key is not loaded by executor." : "Private-key executor is for Amoy pilot only.",
  };
}

function readiness() {
  const signerMode = env("IOTA_EXECUTOR_SIGNER_MODE", env("EXECUTOR_SIGNER_MODE", "private_key")).toLowerCase();
  const checks = {
    rpc: Boolean(env("IOTA_EVM_RPC_URL")),
    contract: isAddress(env("IOTA_EVM_ANCHOR_CONTRACT_V2")),
    durable_store: Boolean(env("DATABASE_URL") || env("POSTGRES_URL")),
    signer: signerMode === "kms"
      ? kmsConfigured() && Boolean(env("IOTA_KMS_PUBLISHER_ADDRESS"))
      : Boolean(env("IOTA_EVM_PRIVATE_KEY")),
  };
  const ok = Object.values(checks).every(Boolean);
  return { ok, service: "nexid-tokenization-executor", signer_mode: signerMode, checks };
}

async function mint(body) {
  const signerMode = env("EXECUTOR_SIGNER_MODE", "private_key").toLowerCase();
  if (signerMode !== "private_key" && signerMode !== "kms") {
    throw new Error("executor_signer_mode_not_available_for_mint");
  }

  const rpcUrl = required("POLYGON_RPC_URL", env("POLYGON_RPC_URL"));
  const privateKey = signerMode === "private_key" ? required("POLYGON_MINTER_PRIVATE_KEY", env("POLYGON_MINTER_PRIVATE_KEY")) : null;
  const contractAddress = required("POLYGON_CONTRACT_ADDRESS", env("POLYGON_CONTRACT_ADDRESS"));
  const uidHex = String(body.uid_hex || "").trim();
  const chipUidHash = String(body.chip_uid_hash || (uidHex ? hashUid(uidHex) : ""));
  const tokenUri = required("token_uri", body.token_uri);
  const recipient = required("recipient", body.issuer_wallet || env("POLYGON_DEFAULT_RECIPIENT"));
  const publicAssetId = String(body.public_asset_id || `nx-${chipUidHash.split(":").pop()?.slice(0, 24) || "asset"}`);
  const assetRef = String(body.asset_ref || `${body.bid || "nexid"}:${publicAssetId}`);
  required("chip_uid_hash", chipUidHash);

  if (!isAddress(contractAddress)) throw new Error("invalid_POLYGON_CONTRACT_ADDRESS");
  if (!isAddress(recipient)) throw new Error("invalid_recipient");

  const provider = new JsonRpcProvider(rpcUrl);
  const publisherAddress = signerMode === "kms"
    ? required("POLYGON_KMS_PUBLISHER_ADDRESS", env("POLYGON_KMS_PUBLISHER_ADDRESS"))
    : new Wallet(privateKey).address;
  if (!isAddress(publisherAddress)) throw new Error("invalid_POLYGON_KMS_PUBLISHER_ADDRESS");
  let tx;
  if (signerMode === "private_key") {
    tx = await new Contract(contractAddress, polygonAbi, new Wallet(privateKey, provider))
      .mintWithChipHash(recipient, chipUidHash, tokenUri, assetRef);
  } else {
    const readContract = new Contract(contractAddress, polygonAbi, provider);
    if (!kmsConfigured({ url: env("POLYGON_KMS_SIGNER_URL") || env("KMS_SIGNER_URL"), keyId: env("POLYGON_KMS_KEY_ID") || env("KMS_KEY_ID") })) {
      throw new Error("polygon_kms_not_configured");
    }
    const unsigned = await readContract.mintWithChipHash.populateTransaction(recipient, chipUidHash, tokenUri, assetRef);
    const nonce = await provider.getTransactionCount(publisherAddress, "pending");
    const feeData = await provider.getFeeData();
    const gasLimit = await readContract.mintWithChipHash.estimateGas(recipient, chipUidHash, tokenUri, assetRef, { from: publisherAddress });
    const dynamic = feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null;
    if (!dynamic && feeData.gasPrice === null) throw new Error("polygon_fee_data_unavailable");
    const transaction = dynamic ? { type: 2, to: contractAddress, data: unsigned.data, nonce, value: "0", gas_limit: gasLimit.toString(), chain_id: (await provider.getNetwork()).chainId.toString(), max_fee_per_gas: feeData.maxFeePerGas.toString(), max_priority_fee_per_gas: feeData.maxPriorityFeePerGas.toString() } : { type: 0, to: contractAddress, data: unsigned.data, nonce, value: "0", gas_limit: gasLimit.toString(), chain_id: (await provider.getNetwork()).chainId.toString(), gas_price: feeData.gasPrice.toString() };
    const signed = await signWithKms({ chainId: transaction.chain_id, expectedSignerAddress: publisherAddress, transaction }, { url: env("POLYGON_KMS_SIGNER_URL") || env("KMS_SIGNER_URL"), keyId: env("POLYGON_KMS_KEY_ID") || env("KMS_KEY_ID"), bearer: env("POLYGON_KMS_SIGNER_TOKEN") || env("KMS_SIGNER_TOKEN"), allowedHosts: env("POLYGON_KMS_SIGNER_ALLOWED_HOSTS") || env("KMS_SIGNER_ALLOWED_HOSTS") });
    tx = await provider.broadcastTransaction(signed.signedTransaction);
  }
  const receipt = await tx.wait();

  return {
    ok: true,
    network: "polygon-amoy",
    tx_hash: tx.hash,
    token_id: deriveTokenId(receipt),
    chip_uid_hash: chipUidHash,
    block_number: receipt.blockNumber,
    external_ref: `amoy:${contractAddress}:${tx.hash}`,
    request_id: body.request_id || null,
  };
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

async function anchorIotaEvidenceUnlocked(body) {
  const signerMode = env("IOTA_EXECUTOR_SIGNER_MODE", env("EXECUTOR_SIGNER_MODE", "private_key")).toLowerCase();
  if (signerMode !== "private_key" && signerMode !== "kms") throw new Error("executor_signer_mode_not_available_for_iota");

  const rpcUrl = required("IOTA_EVM_RPC_URL", env("IOTA_EVM_RPC_URL"));
  const privateKey = signerMode === "private_key" ? required("IOTA_EVM_PRIVATE_KEY", env("IOTA_EVM_PRIVATE_KEY")) : null;
  const contractAddress = required("IOTA_EVM_ANCHOR_CONTRACT_V2", env("IOTA_EVM_ANCHOR_CONTRACT_V2"));
  const expectedChainId = Number(env("IOTA_EVM_EXPECTED_CHAIN_ID", "1076"));
  if (!Number.isSafeInteger(expectedChainId) || expectedChainId <= 0) throw new Error("iota_expected_chain_id_invalid");
  if (!isAddress(contractAddress)) throw new Error("invalid_IOTA_EVM_ANCHOR_CONTRACT_V2");
  if (body.contract_address && !sameAddress(body.contract_address, contractAddress)) {
    throw new Error("iota_executor_contract_mismatch");
  }

  const resourceType = String(required("resource_type", body.resource_type)).trim();
  const publicResourceId = String(required("public_resource_id", body.public_resource_id)).trim();
  const eventCount = Number(body.event_count);
  if (!Number.isSafeInteger(eventCount) || eventCount <= 0) throw new Error("event_count_invalid");
  if (Buffer.byteLength(resourceType, "utf8") > 64) throw new Error("resource_type_too_long");
  if (Buffer.byteLength(publicResourceId, "utf8") > 128) throw new Error("public_resource_id_too_long");
  if (/\p{C}/u.test(resourceType) || /\p{C}/u.test(publicResourceId)) {
    throw new Error("public_resource_control_character_forbidden");
  }
  const merkleRoot = sha256Bytes32(body.merkle_root, "merkle_root");
  const tenantIdHash = sha256Bytes32(body.tenant_id_hash, "tenant_id_hash");
  const memoHash = sha256Bytes32(body.memo_hash, "memo_hash");
  const expectedProofId = String(required("proof_id", body.proof_id)).trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(expectedProofId)) throw new Error("proof_id_invalid");
  if (body.chain_id && Number(body.chain_id) !== expectedChainId) throw new Error("iota_executor_chain_mismatch");

  const provider = new JsonRpcProvider(rpcUrl, expectedChainId, { batchMaxCount: 1 });
  try {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== expectedChainId) throw new Error("iota_chain_id_mismatch");
    const bytecode = await provider.getCode(contractAddress);
    if (!bytecode || bytecode === "0x") throw new Error("iota_v2_contract_not_deployed");
    const wallet = privateKey ? new Wallet(privateKey, provider) : null;
    const readContract = new Contract(contractAddress, iotaEvidenceAbi, provider);
    const publisherAddress = wallet ? wallet.address : required("IOTA_KMS_PUBLISHER_ADDRESS", env("IOTA_KMS_PUBLISHER_ADDRESS"));
    if (Number(await readContract.SCHEMA_VERSION()) !== 2) throw new Error("iota_contract_schema_version_mismatch");
    if (!await readContract.authorizedPublishers(publisherAddress)) throw new Error("iota_publisher_not_authorized");

    const argumentsV2 = [merkleRoot, tenantIdHash, resourceType, publicResourceId, eventCount, memoHash];
    const contractProofId = String(await readContract.computeProofId(...argumentsV2)).toLowerCase();
    if (contractProofId !== expectedProofId) throw new Error("iota_executor_proof_id_mismatch");
    const prepared = { merkleRoot, tenantIdHash, memoHash, eventCount };
    if (await readContract.isAnchored(expectedProofId)) {
      const record = await readContract.evidenceRecord(expectedProofId);
      if (!evidenceRecordMatches(record, prepared)) throw new Error("iota_anchor_storage_mismatch");
      return {
        ok: true,
        state: "confirmed",
        already_anchored: true,
        proof_id: expectedProofId,
        chain_id: expectedChainId,
        contract_address: getAddress(contractAddress),
        publisher_address: getAddress(String(record.publisher ?? record[3])),
        tx_hash: null,
        nonce: null,
        block_number: null,
        block_hash: null,
        confirmations: 0,
        anchored_at: Number(record.anchoredAt ?? record[5]),
        request_id: body.request_id || null,
      };
    }

    let tx;
    if (wallet) {
      tx = await new Contract(contractAddress, iotaEvidenceAbi, wallet).anchorEvidence(...argumentsV2);
    } else {
      const unsigned = await readContract.anchorEvidence.populateTransaction(...argumentsV2);
      const nonce = await provider.getTransactionCount(publisherAddress, "pending");
      const feeData = await provider.getFeeData();
      const gasLimit = await readContract.anchorEvidence.estimateGas(...argumentsV2, { from: publisherAddress });
      const dynamicFeesAvailable = feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null;
      if (!dynamicFeesAvailable && feeData.gasPrice === null) throw new Error("iota_fee_data_unavailable");
      const transaction = dynamicFeesAvailable ? {
        type: 2,
        to: contractAddress,
        data: unsigned.data,
        nonce,
        value: "0",
        gas_limit: gasLimit.toString(),
        chain_id: expectedChainId,
        max_fee_per_gas: feeData.maxFeePerGas.toString(),
        max_priority_fee_per_gas: feeData.maxPriorityFeePerGas.toString(),
      } : {
        type: 0,
        to: contractAddress,
        data: unsigned.data,
        nonce,
        value: "0",
        gas_limit: gasLimit.toString(),
        chain_id: expectedChainId,
        gas_price: feeData.gasPrice.toString(),
      };
      const signed = await signWithKms({
        chainId: expectedChainId,
        expectedSignerAddress: publisherAddress,
        transaction,
      });
      if (!sameAddress(signed.signerAddress, publisherAddress)) throw new Error("kms_signer_address_mismatch");
      tx = await provider.broadcastTransaction(signed.signedTransaction);
    }
    return {
      ok: true,
      state: "submitted",
      already_anchored: false,
      proof_id: expectedProofId,
      chain_id: expectedChainId,
      contract_address: getAddress(contractAddress),
      publisher_address: getAddress(publisherAddress),
      tx_hash: tx.hash,
      nonce: Number(tx.nonce),
      block_number: null,
      block_hash: null,
      confirmations: 0,
      anchored_at: null,
      request_id: body.request_id || null,
    };
  } finally {
    provider.destroy();
  }
}

async function anchorIotaEvidence(body) {
  const proofId = String(body.proof_id || "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(proofId)) throw new Error("proof_id_invalid");
  const reservation = await reserveIotaPublish({
    proofId,
    requestId: body.request_id || null,
    payload: { ...body, request_id: undefined },
  });
  if (reservation.replay) return reservation.response;
  if (reservation.busy) throw new Error("iota_publish_in_progress");
  const operation = () => anchorIotaEvidenceUnlocked(body);
  const pending = iotaPublishQueue.then(operation, operation);
  iotaPublishQueue = pending.then(() => undefined, () => undefined);
  const result = await pending;
  if (reservation.durable && result.state === "submitted") await markIotaSubmitted(proofId, result);
  return result;
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
      if (!authOk(req, "TOKENIZATION_EXECUTOR_SECRET", "x-tokenization-secret")) {
        return json(res, 401, { ok: false, reason: "unauthorized_executor" });
      }
      const body = await readJson(req);
      return json(res, 200, await mint(body));
    }
    if (req.method === "POST" && ["/anchor-evidence", "/iota/evidence-v2"].includes(url.pathname)) {
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

const port = Number(env("PORT", "3010"));
export { anchorIotaEvidence, handler, secretMatches, sha256Bytes32 };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = http.createServer((req, res) => {
    void handler(req, res);
  });
  server.listen(port, () => {
    console.log(JSON.stringify({ ok: true, service: "nexid-tokenization-executor", port }));
  });
}
