import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Contract,
  Interface,
  JsonRpcProvider,
  Transaction,
  Wallet,
  getAddress,
  isAddress,
  parseEther,
} from "ethers";
import {
  CUSTODY_APPLY_CONFIRMATION,
  runCustodyMigration,
  TESTNET_CHAIN_IDS,
  validateCustodyMigrationConfig,
} from "../src/custody-migration-plan.mjs";
import { validateSignedTransaction } from "../src/kms-signer.mjs";
import {
  GOOGLE_KMS_ACCESS_TOKEN_ENV,
  GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV,
  GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV,
  signWithWrappedKms,
} from "../src/wrapped-kms-signer.mjs";

const IOTA_ABI = [
  "function SCHEMA_VERSION() view returns (uint16)",
  "function owner() view returns (address)",
  "function authorizedPublishers(address) view returns (bool)",
  "function setPublisher(address publisher, bool enabled)",
  "function transferOwnership(address newOwner)",
];
const POLYGON_ABI = [
  "function owner() view returns (address)",
  "function authorizedMinters(address) view returns (bool)",
  "function setMinter(address minter, bool enabled)",
  "function transferOwnership(address newOwner)",
  "function mintWithChipHash(address to, string chipUidHash, string tokenUri, string assetRef) returns (uint256)",
  "function tokenByChipHash(string chipUidHash) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function chipUidHashByTokenId(uint256 tokenId) view returns (string)",
  "function assetRefByTokenId(uint256 tokenId) view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
];
const KMS_RESOURCE = /^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/locations\/[a-z0-9-]+\/keyRings\/[A-Za-z0-9_-]{1,63}\/cryptoKeys\/[A-Za-z0-9_-]{1,63}$/;
const TOKEN = /^[A-Za-z0-9._~+/-]+=*$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const HASH = /^0x[0-9a-f]{64}$/i;
const DEFAULT_TIMEOUT_MS = 120_000;

function fail(code) {
  throw new Error(code);
}

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function required(name) {
  const value = env(name);
  if (!value) fail(`missing_${name.toLowerCase()}`);
  return value;
}

async function inspectStep(code, operation) {
  try {
    return await operation();
  } catch (error) {
    if (/^[a-z0-9_]{3,100}$/.test(String(error?.message || ""))) throw error;
    fail(code);
  }
}

function strictAddress(value, code) {
  if (!isAddress(value)) fail(code);
  return getAddress(value);
}

function strictPositiveBigInt(value, code) {
  try {
    const parsed = BigInt(value);
    if (parsed <= 0n) fail(code);
    return parsed;
  } catch (error) {
    if (error?.message === code) throw error;
    fail(code);
  }
}

export function parseCustodyMigrationCli(argv) {
  const result = { mode: "plan" };
  const seen = new Set();
  const allowed = new Map([["--domain", "domain"], ["--mode", "mode"]]);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const key = allowed.get(name);
    const value = argv[index + 1];
    if (!key || !value || String(value).startsWith("--") || seen.has(key)) fail("custody_cli_arguments_invalid");
    seen.add(key);
    result[key] = value;
  }
  if (!result.domain) fail("custody_cli_domain_required");
  return result;
}

function prefixFor(domain) {
  return domain === "iota" ? "IOTA" : "POLYGON";
}

function migrationId(config) {
  return createHash("sha256").update([
    "nexid.testnet.custody.rotation.v1",
    config.domain,
    config.expectedChainId,
    config.contractAddress.toLowerCase(),
    config.legacyOwnerAddress.toLowerCase(),
    config.legacyPublisherAddress.toLowerCase(),
    config.targetGovernanceAddress.toLowerCase(),
    config.targetPublisherAddress.toLowerCase(),
  ].join("|")).digest("hex");
}

function canaryFor(config) {
  const material = [
    "nexid.testnet.custody.publisher.canary.v1",
    config.expectedChainId,
    config.contractAddress.toLowerCase(),
    config.targetPublisherAddress.toLowerCase(),
    config.targetGovernanceAddress.toLowerCase(),
  ].join("|");
  return Object.freeze({
    chipUidHash: `sha256:${createHash("sha256").update(material).digest("hex")}`,
    recipient: config.targetGovernanceAddress,
    tokenUri: "https://api.nexid.lat/public/polygon/metadata/custody-rotation-testnet-v1",
    assetRef: `nexid:testnet-custody-rotation:v1:${config.targetPublisherAddress.toLowerCase()}`,
  });
}

async function readCiphertext(ciphertextPath) {
  const resolved = path.resolve(String(ciphertextPath || ""));
  const metadata = await lstat(resolved).catch(() => null);
  if (!metadata?.isFile() || metadata.isSymbolicLink() || metadata.size < 32 || metadata.size > 32 * 1024) {
    fail("custody_ciphertext_file_invalid");
  }
  const encoded = (await readFile(resolved, "ascii")).trim();
  if (!BASE64.test(encoded)) fail("custody_ciphertext_invalid");
  const ciphertext = Buffer.from(encoded, "base64");
  if (ciphertext.length < 32 || ciphertext.length > 16 * 1024) fail("custody_ciphertext_invalid");
  ciphertext.fill(0);
  return encoded;
}

function takeLegacyOwner(config) {
  const prefix = prefixFor(config.domain);
  const name = `${prefix}_CUSTODY_LEGACY_OWNER_PRIVATE_KEY`;
  const raw = process.env[name];
  delete process.env[name];
  const normalized = String(raw || "").trim();
  if (!/^(?:0x)?[0-9a-f]{64}$/i.test(normalized)) fail("custody_legacy_owner_private_key_missing");
  const wallet = new Wallet(normalized.startsWith("0x") ? normalized : `0x${normalized}`);
  if (getAddress(wallet.address) !== config.legacyOwnerAddress) fail("custody_legacy_owner_key_mismatch");
  return wallet;
}

function createEphemeralTokenProvider(role) {
  let cached;
  return {
    getAccessToken() {
      if (cached) return cached;
      const roleEnvName = role === "governance"
        ? GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV
        : GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV;
      const roleValue = process.env[roleEnvName];
      delete process.env[roleEnvName];
      const raw = roleValue || process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV];
      if (!roleValue) delete process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV];
      const value = String(raw || "");
      if (value.length < 20 || value.length > 4096 || !TOKEN.test(value)) fail("kms_access_token_invalid");
      cached = value;
      return cached;
    },
    clear() { cached = ""; },
  };
}

function loadConfig(cli) {
  const domain = String(cli.domain).trim().toLowerCase();
  if (!Object.hasOwn(TESTNET_CHAIN_IDS, domain)) fail("custody_domain_invalid");
  const prefix = prefixFor(domain);
  const defaultContractEnv = domain === "iota" ? "IOTA_EVM_ANCHOR_CONTRACT_V2" : "POLYGON_CONTRACT_ADDRESS";
  const defaultRpcEnv = domain === "iota" ? "IOTA_EVM_RPC_URL" : "POLYGON_RPC_URL";
  return {
    domain,
    mode: String(cli.mode).trim().toLowerCase(),
    expectedChainId: TESTNET_CHAIN_IDS[domain],
    rpcUrl: env(`${prefix}_CUSTODY_RPC_URL`) || required(defaultRpcEnv),
    contractAddress: env(`${prefix}_CUSTODY_CONTRACT_ADDRESS`) || required(defaultContractEnv),
    legacyOwnerAddress: required(`${prefix}_CUSTODY_LEGACY_OWNER_ADDRESS`),
    legacyPublisherAddress: required(`${prefix}_CUSTODY_LEGACY_PUBLISHER_ADDRESS`),
    targetGovernanceAddress: required(`${prefix}_CUSTODY_TARGET_GOVERNANCE_ADDRESS`),
    targetPublisherAddress: required(`${prefix}_CUSTODY_TARGET_PUBLISHER_ADDRESS`),
    governanceTargetBalanceWei: env(`${prefix}_CUSTODY_GOVERNANCE_TARGET_BALANCE_WEI`, parseEther("0.05").toString()),
    publisherTargetBalanceWei: env(`${prefix}_CUSTODY_PUBLISHER_TARGET_BALANCE_WEI`, parseEther("0.05").toString()),
    maxFundingTotalWei: env(`${prefix}_CUSTODY_MAX_FUNDING_TOTAL_WEI`, parseEther("0.25").toString()),
    maxGasLimit: strictPositiveBigInt(env(`${prefix}_CUSTODY_MAX_GAS_LIMIT`, "2000000"), "custody_max_gas_limit_invalid"),
    maxGasCostWei: strictPositiveBigInt(env(`${prefix}_CUSTODY_MAX_GAS_COST_WEI`, parseEther("0.05").toString()), "custody_max_gas_cost_invalid"),
    confirmation: env("NEXID_CUSTODY_MIGRATION_APPROVED"),
    environment: env("NEXID_KMS_ENVIRONMENT", "staging"),
    kmsTransport: env(`${prefix}_CUSTODY_KMS_TRANSPORT`, "rest").toLowerCase(),
    governanceKmsKeyResource: required(`${prefix}_CUSTODY_GOVERNANCE_KMS_KEY_RESOURCE`),
    governanceCiphertextPath: required(`${prefix}_CUSTODY_GOVERNANCE_CIPHERTEXT_PATH`),
    governanceWrapRole: required(`${prefix}_CUSTODY_GOVERNANCE_WRAP_ROLE`).toLowerCase(),
    publisherKmsKeyResource: required(`${prefix}_CUSTODY_PUBLISHER_KMS_KEY_RESOURCE`),
    publisherCiphertextPath: required(`${prefix}_CUSTODY_PUBLISHER_CIPHERTEXT_PATH`),
    publisherWrapRole: required(`${prefix}_CUSTODY_PUBLISHER_WRAP_ROLE`).toLowerCase(),
    journalPath: path.resolve(env(`${prefix}_CUSTODY_JOURNAL_PATH`, path.join(".nexid-custody", `${domain}-testnet-rotation.json`))),
  };
}

function validateLocalConfig(config) {
  for (const resource of [config.governanceKmsKeyResource, config.publisherKmsKeyResource]) {
    if (!KMS_RESOURCE.test(resource)) fail("custody_kms_key_resource_invalid");
  }
  if (config.governanceWrapRole !== "governance" && config.governanceWrapRole !== "publisher") {
    fail("custody_governance_wrap_role_invalid");
  }
  if (config.publisherWrapRole !== "publisher") fail("custody_publisher_wrap_role_invalid");
  if (config.kmsTransport !== "client" && config.kmsTransport !== "rest") fail("custody_kms_transport_invalid");
  let parsed;
  try { parsed = new URL(config.rpcUrl); } catch { fail("custody_rpc_url_invalid"); }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) {
    fail("custody_rpc_tls_required");
  }
  if (parsed.username || parsed.password) fail("custody_rpc_userinfo_forbidden");
  return config;
}

async function loadJournal(config) {
  const id = migrationId(config);
  const metadata = await lstat(config.journalPath).catch(() => null);
  if (!metadata) return { schema: "nexid-testnet-custody-migration-v1", migrationId: id, actions: {} };
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 512 * 1024) fail("custody_journal_invalid");
  let journal;
  try { journal = JSON.parse(await readFile(config.journalPath, "utf8")); } catch { fail("custody_journal_invalid"); }
  if (journal?.schema !== "nexid-testnet-custody-migration-v1" || journal?.migrationId !== id
    || !journal.actions || typeof journal.actions !== "object" || Array.isArray(journal.actions)) {
    fail("custody_journal_mismatch");
  }
  return journal;
}

async function saveJournal(config, journal) {
  const parent = path.dirname(config.journalPath);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const temporary = `${config.journalPath}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.chmod(0o600);
    await handle.writeFile(`${JSON.stringify(journal, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, config.journalPath);
  } finally {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

function intentFromRequest(config, signerAddress, request) {
  const dynamic = request.maxFeePerGas !== null && request.maxPriorityFeePerGas !== null;
  return {
    chainId: config.expectedChainId,
    expectedSignerAddress: signerAddress,
    transaction: dynamic ? {
      type: 2,
      to: request.to,
      data: request.data,
      nonce: request.nonce,
      value: request.value.toString(),
      gas_limit: request.gasLimit.toString(),
      chain_id: config.expectedChainId,
      max_fee_per_gas: request.maxFeePerGas.toString(),
      max_priority_fee_per_gas: request.maxPriorityFeePerGas.toString(),
    } : {
      type: 0,
      to: request.to,
      data: request.data,
      nonce: request.nonce,
      value: request.value.toString(),
      gas_limit: request.gasLimit.toString(),
      chain_id: config.expectedChainId,
      gas_price: request.gasPrice.toString(),
    },
  };
}

function assertStoredIntent(record, expected) {
  const parsed = Transaction.from(record?.signedTransaction || "");
  if (!parsed.isSigned() || Number(parsed.chainId) !== expected.chainId
    || getAddress(parsed.from) !== expected.from || getAddress(parsed.to) !== expected.to
    || String(parsed.data || "0x").toLowerCase() !== expected.data.toLowerCase()
    || parsed.value !== expected.value || parsed.hash?.toLowerCase() !== String(record.txHash).toLowerCase()) {
    fail("custody_journal_transaction_mismatch");
  }
  return parsed;
}

export async function createEthersCustodyAdapter(configInput, dependencies = {}) {
  const config = validateCustodyMigrationConfig(validateLocalConfig(configInput));
  const provider = dependencies.provider || new JsonRpcProvider(config.rpcUrl, config.expectedChainId, { batchMaxCount: 1 });
  const ownsProvider = !dependencies.provider;
  const abi = config.domain === "iota" ? IOTA_ABI : POLYGON_ABI;
  const contract = dependencies.contract || new Contract(config.contractAddress, abi, provider);
  const iface = new Interface(abi);
  const journal = await loadJournal(config);
  const ciphertext = {};
  const accessTokens = {
    governance: createEphemeralTokenProvider("governance"),
    publisher: createEphemeralTokenProvider("publisher"),
  };
  let legacyOwner;

  async function wrappedSpec(role) {
    if (!ciphertext[role]) {
      ciphertext[role] = await readCiphertext(role === "governance"
        ? config.governanceCiphertextPath
        : config.publisherCiphertextPath);
    }
    return role === "governance" ? {
      domain: config.domain,
      environment: config.environment,
      role: config.governanceWrapRole,
      keyResource: config.governanceKmsKeyResource,
      wrappedPrivateKey: ciphertext.governance,
      expectedChainId: config.expectedChainId,
      transport: config.kmsTransport,
    } : {
      domain: config.domain,
      environment: config.environment,
      role: config.publisherWrapRole,
      keyResource: config.publisherKmsKeyResource,
      wrappedPrivateKey: ciphertext.publisher,
      expectedChainId: config.expectedChainId,
      transport: config.kmsTransport,
    };
  }

  async function buildRequest(from, to, data, value) {
    const [nonce, feeData, estimated] = await Promise.all([
      provider.getTransactionCount(from, "pending"),
      provider.getFeeData(),
      provider.estimateGas({ from, to, data, value }),
    ]);
    const gasLimit = (estimated * 120n + 99n) / 100n;
    if (gasLimit <= 0n || gasLimit > config.maxGasLimit) fail("custody_gas_limit_exceeded");
    const dynamic = feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null;
    if (!dynamic && feeData.gasPrice === null) fail("custody_fee_data_unavailable");
    const feeCeiling = gasLimit * (dynamic ? feeData.maxFeePerGas : feeData.gasPrice);
    if (feeCeiling > config.maxGasCostWei) fail("custody_gas_cost_exceeded");
    return {
      to,
      data,
      value,
      nonce,
      gasLimit,
      maxFeePerGas: dynamic ? feeData.maxFeePerGas : null,
      maxPriorityFeePerGas: dynamic ? feeData.maxPriorityFeePerGas : null,
      gasPrice: dynamic ? null : feeData.gasPrice,
    };
  }

  async function send(actionId, signerRole, to, data = "0x", value = 0n) {
    const signerAddress = signerRole === "legacy"
      ? config.legacyOwnerAddress
      : signerRole === "governance"
        ? config.targetGovernanceAddress
        : config.targetPublisherAddress;
    const expected = { chainId: config.expectedChainId, from: signerAddress, to: getAddress(to), data, value };
    let record = journal.actions[actionId];
    let signed;
    if (record?.signedTransaction) {
      assertStoredIntent(record, expected);
      signed = validateSignedTransaction(record.signedTransaction, record.intent);
    } else {
      const request = await buildRequest(signerAddress, expected.to, data, value);
      const intent = intentFromRequest(config, signerAddress, request);
      if (signerRole === "legacy") {
        legacyOwner ||= takeLegacyOwner(config);
        signed = validateSignedTransaction(await legacyOwner.signTransaction({
          type: request.maxFeePerGas !== null ? 2 : 0,
          chainId: config.expectedChainId,
          to: request.to,
          data: request.data,
          nonce: request.nonce,
          value: request.value,
          gasLimit: request.gasLimit,
          ...(request.maxFeePerGas !== null ? {
            maxFeePerGas: request.maxFeePerGas,
            maxPriorityFeePerGas: request.maxPriorityFeePerGas,
          } : { gasPrice: request.gasPrice }),
        }), intent);
      } else {
        signed = await (dependencies.signWithWrappedKms || signWithWrappedKms)(intent, await wrappedSpec(signerRole), {
          ...(dependencies.kms || {}),
          getAccessToken: accessTokens[signerRole].getAccessToken,
        });
      }
      record = {
        signerRole,
        intent,
        signedTransaction: signed.signedTransaction,
        txHash: signed.transactionHash.toLowerCase(),
        state: "signed",
      };
      journal.actions[actionId] = record;
      await saveJournal(config, journal);
    }

    let receipt = await provider.getTransactionReceipt(record.txHash);
    if (!receipt) {
      try {
        const response = await provider.broadcastTransaction(record.signedTransaction);
        if (String(response.hash).toLowerCase() !== record.txHash) fail("custody_broadcast_hash_mismatch");
      } catch (error) {
        receipt = await provider.getTransactionReceipt(record.txHash);
        const pending = receipt ? null : await provider.getTransaction(record.txHash);
        if (!receipt && !pending) throw error;
      }
      receipt ||= await provider.waitForTransaction(record.txHash, 1, DEFAULT_TIMEOUT_MS);
    }
    if (!receipt || Number(receipt.status) !== 1) fail("custody_transaction_not_confirmed");
    record.state = "confirmed";
    record.blockNumber = Number(receipt.blockNumber);
    delete record.signedTransaction;
    await saveJournal(config, journal);
    return record.txHash;
  }

  async function journalSelfTestConfirmed() {
    const record = journal.actions.prove_governance_signer;
    if (!record?.txHash || !HASH.test(record.txHash)) return false;
    const [receipt, transaction] = await inspectStep("custody_inspect_governance_proof_failed", () => Promise.all([
      provider.getTransactionReceipt(record.txHash),
      provider.getTransaction(record.txHash),
    ]));
    return Boolean(receipt && Number(receipt.status) === 1 && transaction
      && Number(transaction.chainId) === config.expectedChainId
      && getAddress(transaction.from) === config.targetGovernanceAddress
      && getAddress(transaction.to) === config.targetGovernanceAddress
      && BigInt(transaction.value) === 0n
      && String(transaction.data || "0x").toLowerCase() === "0x");
  }

  async function inspect() {
    const network = await inspectStep("custody_inspect_network_failed", () => provider.getNetwork());
    if (Number(network.chainId) !== config.expectedChainId) fail("custody_rpc_chain_id_mismatch");
    const code = await inspectStep("custody_inspect_contract_code_failed", () => provider.getCode(config.contractAddress));
    if (!code || code === "0x") fail("custody_contract_not_deployed");
    const owner = await inspectStep("custody_inspect_owner_failed", () => contract.owner());
    const targetPublisherAuthorized = await inspectStep("custody_inspect_target_publisher_failed", () => (
      config.domain === "iota"
        ? contract.authorizedPublishers(config.targetPublisherAddress)
        : contract.authorizedMinters(config.targetPublisherAddress)
    ));
    const legacyPublisherAuthorized = await inspectStep("custody_inspect_legacy_publisher_failed", () => (
      config.domain === "iota"
        ? contract.authorizedPublishers(config.legacyPublisherAddress)
        : contract.authorizedMinters(config.legacyPublisherAddress)
    ));
    const governanceBalanceWei = await inspectStep(
      "custody_inspect_governance_balance_failed",
      () => provider.getBalance(config.targetGovernanceAddress),
    );
    const publisherBalanceWei = await inspectStep(
      "custody_inspect_publisher_balance_failed",
      () => provider.getBalance(config.targetPublisherAddress),
    );
    let schemaVersion = null;
    let polygonCanaryVerified = null;
    if (config.domain === "iota") {
      schemaVersion = Number(await inspectStep("custody_inspect_iota_schema_failed", () => contract.SCHEMA_VERSION()));
    } else {
      const canary = canaryFor(config);
      const tokenId = BigInt(String(await inspectStep(
        "custody_inspect_polygon_canary_lookup_failed",
        () => contract.tokenByChipHash(canary.chipUidHash),
      )));
      polygonCanaryVerified = false;
      if (tokenId > 0n) {
        const [tokenOwner, chipUidHash, tokenUri, assetRef] = await inspectStep(
          "custody_inspect_polygon_canary_metadata_failed",
          () => Promise.all([
          contract.ownerOf(tokenId),
          contract.chipUidHashByTokenId(tokenId),
          contract.tokenURI(tokenId),
          contract.assetRefByTokenId(tokenId),
          ]),
        );
        if (getAddress(tokenOwner) !== canary.recipient || chipUidHash !== canary.chipUidHash
          || tokenUri !== canary.tokenUri || assetRef !== canary.assetRef) {
          fail("custody_polygon_canary_collision");
        }
        polygonCanaryVerified = true;
      }
    }
    return {
      chainId: Number(network.chainId),
      contractCodePresent: Boolean(code && code !== "0x"),
      owner: getAddress(owner),
      schemaVersion,
      targetPublisherAuthorized: Boolean(targetPublisherAuthorized),
      legacyPublisherAuthorized: Boolean(legacyPublisherAuthorized),
      governanceBalanceWei,
      publisherBalanceWei,
      governanceSignerProven: await journalSelfTestConfirmed(),
      polygonCanaryVerified,
    };
  }

  async function execute(action) {
    const nextFundingActionId = (kind) => {
      const pending = Object.entries(journal.actions).find(([key, record]) => (
        key.startsWith(`${kind}_`) && record?.state !== "confirmed" && record?.signedTransaction
      ));
      if (pending) return pending[0];
      const sequence = Object.keys(journal.actions).filter((key) => key.startsWith(`${kind}_`)).length + 1;
      return `${kind}_${sequence}`;
    };
    if (action.kind === "fund_governance") {
      return send(nextFundingActionId("fund_governance"), "legacy", config.targetGovernanceAddress, "0x", BigInt(action.amountWei));
    }
    if (action.kind === "fund_publisher") {
      return send(nextFundingActionId("fund_publisher"), "legacy", config.targetPublisherAddress, "0x", BigInt(action.amountWei));
    }
    if (action.kind === "prove_governance_signer") {
      return send("prove_governance_signer", "governance", config.targetGovernanceAddress);
    }
    if (action.kind === "authorize_target_publisher") {
      const data = iface.encodeFunctionData(config.domain === "iota" ? "setPublisher" : "setMinter", [config.targetPublisherAddress, true]);
      return send("authorize_target_publisher", "legacy", config.contractAddress, data);
    }
    if (action.kind === "verify_polygon_publisher_canary") {
      if (config.domain !== "polygon") fail("custody_canary_domain_invalid");
      const canary = canaryFor(config);
      const data = iface.encodeFunctionData("mintWithChipHash", [canary.recipient, canary.chipUidHash, canary.tokenUri, canary.assetRef]);
      return send("verify_polygon_publisher_canary", "publisher", config.contractAddress, data);
    }
    if (action.kind === "transfer_ownership") {
      const data = iface.encodeFunctionData("transferOwnership", [config.targetGovernanceAddress]);
      return send("transfer_ownership", "legacy", config.contractAddress, data);
    }
    if (action.kind === "revoke_legacy_publisher") {
      const data = iface.encodeFunctionData(config.domain === "iota" ? "setPublisher" : "setMinter", [config.legacyPublisherAddress, false]);
      return send("revoke_legacy_publisher", "governance", config.contractAddress, data);
    }
    fail("custody_action_invalid");
  }

  return {
    inspect,
    execute,
    close() {
      accessTokens.governance.clear();
      accessTokens.publisher.clear();
      legacyOwner = null;
      for (const key of Object.keys(ciphertext)) ciphertext[key] = "";
      if (ownsProvider) provider.destroy();
    },
  };
}

function publicResult(result) {
  if (!result.applied) {
    return {
      ok: true,
      applied: false,
      domain: result.config.domain,
      chain_id: result.config.expectedChainId,
      contract_address: result.config.contractAddress,
      current_owner: result.state.owner,
      target_governance: result.config.targetGovernanceAddress,
      target_publisher: result.config.targetPublisherAddress,
      planned_actions: result.actions.map((action) => ({
        action: action.kind,
        ...(action.amountWei ? { amount_wei: action.amountWei.toString() } : {}),
      })),
    };
  }
  return {
    ok: true,
    applied: true,
    domain: result.domain,
    chain_id: result.chainId,
    contract_address: result.contractAddress,
    executed_actions: result.executed,
    invariants: result.invariants,
  };
}

function safeError(error) {
  const message = error instanceof Error ? error.message : "custody_migration_failed";
  return /^[a-z0-9_]{3,100}$/.test(message) ? message : "custody_migration_failed";
}

export async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const cli = parseCustodyMigrationCli(argv);
  const config = validateLocalConfig(loadConfig(cli));
  let adapter;
  try {
    adapter = await createEthersCustodyAdapter(config, dependencies);
    const result = await runCustodyMigration(config, adapter);
    process.stdout.write(`${JSON.stringify(publicResult(result), null, 2)}\n`);
    return result;
  } finally {
    adapter?.close();
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  runCli().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: safeError(error) })}\n`);
    process.exitCode = 1;
  });
}

export { CUSTODY_APPLY_CONFIRMATION };
