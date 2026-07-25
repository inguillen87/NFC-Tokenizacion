import { createHash } from "node:crypto";
import {
  AbiCoder,
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  getAddress,
  isAddress,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import { buildMerkleRoot, stableJson } from "./proof-layer";

export const IOTA_EVIDENCE_CONTRACT_VERSION = "evidence_anchor_v2";
export const IOTA_EVIDENCE_MEMO_SCHEMA = "nexid.evidence.memo.v1";
export const IOTA_EVIDENCE_MERKLE_ALGORITHM = "nexid-sha256-pair-v1";
export const IOTA_EVIDENCE_MAX_RESOURCE_TYPE_BYTES = 64;
export const IOTA_EVIDENCE_MAX_RESOURCE_ID_BYTES = 128;
export const IOTA_EVIDENCE_MAX_EVENTS = 5_000;

export const IOTA_EVIDENCE_ABI = [
  "function SCHEMA_VERSION() view returns (uint16)",
  "function authorizedPublishers(address publisher) view returns (bool)",
  "function computeProofId(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) view returns (bytes32)",
  "function anchorEvidence(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) returns (bytes32 proofId)",
  "function isAnchored(bytes32 proofId) view returns (bool)",
  "function evidenceRecord(bytes32 proofId) view returns (bytes32 merkleRoot, bytes32 tenantIdHash, bytes32 memoHash, address publisher, uint64 eventCount, uint64 anchoredAt)",
  "event EvidenceAnchored(bytes32 indexed proofId, bytes32 indexed merkleRoot, bytes32 indexed tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash, address publisher, uint64 anchoredAt, uint16 schemaVersion)",
] as const;

const IOTA_EVIDENCE_INTERFACE = new Interface(IOTA_EVIDENCE_ABI);
const IOTA_EVIDENCE_PROOF_DOMAIN = keccak256(toUtf8Bytes("nexid.evidence.anchor.v2"));
const SHA256_PATTERN = /^(?:sha256:|0x)?([0-9a-f]{64})$/i;
const IOTA_EXECUTOR_DEFAULT_TIMEOUT_MS = 60_000;
const IOTA_EXECUTOR_MIN_TIMEOUT_MS = 100;
const IOTA_EXECUTOR_MAX_TIMEOUT_MS = 120_000;
const IOTA_EXECUTOR_MAX_RESPONSE_BYTES = 64 * 1024;

class IotaExecutorClientError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "IotaExecutorClientError";
  }
}

export type IotaEvidenceRuntimeMode = "disabled" | "mock" | "iota_evm_contract_v2";

export type IotaEvidenceRuntimeConfig = {
  mode: IotaEvidenceRuntimeMode;
  configuredMode: string;
  rpcUrl: string;
  contractAddress: string;
  expectedChainId: number;
  minConfirmations: number;
  production: boolean;
  executorUrl: string;
  executorSecret: string;
  executorTimeoutMs: number;
  localPrivateKey: string;
  allowLocalSigner: boolean;
  explorerBaseUrl: string;
};

export type PreparedIotaEvidence = {
  tenantIdHash: string;
  resourceType: string;
  publicResourceId: string;
  eventHashes: string[];
  eventCount: number;
  merkleRoot: string;
  canonicalizationVersion: string;
  memo: Record<string, unknown>;
  memoHash: string;
};

export type IotaEvidenceTarget = {
  chainId: number;
  contractAddress: string;
  contractVersion: typeof IOTA_EVIDENCE_CONTRACT_VERSION;
  proofId: string;
  alreadyAnchored: boolean;
  publisherAddress: string | null;
  anchoredAt: number | null;
};

export type IotaEvidenceSubmission = {
  proofId: string;
  txHash: string | null;
  publisherAddress: string;
  nonce: number | null;
  blockNumber: number | null;
  blockHash: string | null;
  confirmations: number;
  anchoredAt: number | null;
  alreadyAnchored: boolean;
};

export type IotaEvidenceTransactionCheck = {
  state: "pending" | "submitted" | "confirmed" | "failed";
  errorCode: string | null;
  publisherAddress: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  confirmations: number;
  anchoredAt: number | null;
};

type PublishHooks = {
  onSubmitted?: (submission: {
    txHash: string;
    publisherAddress: string;
    nonce: number | null;
  }) => Promise<void> | void;
  fetchImpl?: typeof fetch;
};

function text(value: unknown) {
  return String(value || "").trim();
}

function enabled(value: unknown) {
  return ["1", "true", "yes", "on"].includes(text(value).toLowerCase());
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function normalizeIotaSha256(value: unknown) {
  const match = text(value).match(SHA256_PATTERN);
  return match ? `sha256:${match[1].toLowerCase()}` : null;
}

function digestBytes32(value: unknown, field: string) {
  const normalized = normalizeIotaSha256(value);
  if (!normalized) throw new Error(`${field}_invalid`);
  return `0x${normalized.slice("sha256:".length)}`;
}

function normalizePrivateKey(value: unknown) {
  const normalized = text(value);
  if (!normalized) return "";
  if (/^0x[0-9a-f]{64}$/i.test(normalized)) return normalized;
  if (/^[0-9a-f]{64}$/i.test(normalized)) return `0x${normalized}`;
  throw new Error("iota_private_key_invalid");
}

function normalizeRpcUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const url = new URL(raw);
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new Error("iota_rpc_url_invalid");
  return url.toString();
}

function normalizeExecutorUrl(value: unknown, production: boolean) {
  const raw = text(value);
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new IotaExecutorClientError("iota_executor_url_invalid");
  }
  if (url.username || url.password || url.hash) {
    throw new IotaExecutorClientError("iota_executor_url_invalid");
  }
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (production && url.protocol !== "https:") {
    throw new IotaExecutorClientError("iota_executor_https_required_in_production");
  }
  if (url.protocol !== "https:" && !localHttp) {
    throw new IotaExecutorClientError("iota_executor_url_invalid");
  }
  return url.toString();
}

function canonicalContractAddress(value: unknown) {
  const raw = text(value);
  if (!raw || !isAddress(raw)) return "";
  return getAddress(raw);
}

export function resolveIotaEvidenceRuntimeConfig(
  source: NodeJS.ProcessEnv = process.env,
): IotaEvidenceRuntimeConfig {
  const configuredMode = text(source.IOTA_PROVIDER_MODE || source.IOTA_PROOF_MODE || "disabled").toLowerCase();
  const mode: IotaEvidenceRuntimeMode = configuredMode === "mock"
    ? "mock"
    : configuredMode === "iota_evm_contract_v2" || configuredMode === "iota_evm_contract"
      ? "iota_evm_contract_v2"
      : "disabled";
  const nodeEnvironment = text(source.NODE_ENV).toLowerCase();
  const production = nodeEnvironment === "production";
  const allowLocalSigner = enabled(source.IOTA_ALLOW_LOCAL_SIGNER)
    && !production;

  return {
    mode,
    configuredMode,
    rpcUrl: normalizeRpcUrl(source.IOTA_EVM_RPC_URL),
    contractAddress: canonicalContractAddress(source.IOTA_EVM_ANCHOR_CONTRACT_V2),
    expectedChainId: boundedInteger(source.IOTA_EVM_EXPECTED_CHAIN_ID, 1076, 1, Number.MAX_SAFE_INTEGER),
    minConfirmations: boundedInteger(source.IOTA_EVM_MIN_CONFIRMATIONS, 1, 1, 100),
    production,
    executorUrl: normalizeExecutorUrl(source.IOTA_PROOF_EXECUTOR_URL, production),
    executorSecret: text(source.IOTA_PROOF_EXECUTOR_SECRET),
    executorTimeoutMs: boundedInteger(
      source.IOTA_PROOF_EXECUTOR_TIMEOUT_MS,
      IOTA_EXECUTOR_DEFAULT_TIMEOUT_MS,
      IOTA_EXECUTOR_MIN_TIMEOUT_MS,
      IOTA_EXECUTOR_MAX_TIMEOUT_MS,
    ),
    localPrivateKey: normalizePrivateKey(source.IOTA_EVM_PRIVATE_KEY),
    allowLocalSigner,
    explorerBaseUrl: text(source.IOTA_EXPLORER_BASE_URL).replace(/\/$/, ""),
  };
}

export function iotaAnchorTenantHash(tenantId: string) {
  return createHash("sha256").update(String(tenantId || ""), "utf8").digest("hex");
}

export function canonicalizeIotaEventHashes(values: unknown[], ordering: "preserve" | "lexicographic" = "preserve") {
  if (values.length > IOTA_EVIDENCE_MAX_EVENTS) throw new Error("event_hashes_limit_exceeded");
  const normalized = values.map((value) => normalizeIotaSha256(value));
  if (normalized.some((value) => !value)) throw new Error("event_hash_invalid");
  const unique = Array.from(new Set(normalized as string[]));
  if (!unique.length) throw new Error("event_hashes_required");
  return ordering === "lexicographic" ? unique.sort() : unique;
}

export function prepareIotaEvidence(input: {
  tenantId: string;
  resourceType: string;
  publicResourceId: string;
  eventHashes: unknown[];
  canonicalizationVersion: string;
  preserveEventOrder?: boolean;
}) {
  const tenantId = text(input.tenantId);
  const resourceType = text(input.resourceType);
  const publicResourceId = text(input.publicResourceId);
  const canonicalizationVersion = text(input.canonicalizationVersion);
  if (!tenantId) throw new Error("tenant_required");
  if (!resourceType) throw new Error("resource_type_required");
  if (!publicResourceId) throw new Error("public_resource_id_required");
  if (!canonicalizationVersion) throw new Error("canonicalization_version_required");
  if (Buffer.byteLength(resourceType, "utf8") > IOTA_EVIDENCE_MAX_RESOURCE_TYPE_BYTES) {
    throw new Error("resource_type_too_long");
  }
  if (Buffer.byteLength(publicResourceId, "utf8") > IOTA_EVIDENCE_MAX_RESOURCE_ID_BYTES) {
    throw new Error("public_resource_id_too_long");
  }
  if (/\p{C}/u.test(resourceType) || /\p{C}/u.test(publicResourceId)) {
    throw new Error("public_resource_control_character_forbidden");
  }

  const eventHashes = canonicalizeIotaEventHashes(
    input.eventHashes,
    input.preserveEventOrder === false ? "lexicographic" : "preserve",
  );
  const merkleRoot = buildMerkleRoot(eventHashes);
  const tenantIdHash = iotaAnchorTenantHash(tenantId);
  const memo = {
    schema: IOTA_EVIDENCE_MEMO_SCHEMA,
    canonicalization: canonicalizationVersion,
    merkle_algorithm: IOTA_EVIDENCE_MERKLE_ALGORITHM,
    tenant_id_hash: `sha256:${tenantIdHash}`,
    resource_type: resourceType,
    public_resource_id: publicResourceId,
    merkle_root: merkleRoot,
    event_count: eventHashes.length,
    event_set_hash: sha256(stableJson(eventHashes)),
  };

  return {
    tenantIdHash,
    resourceType,
    publicResourceId,
    eventHashes,
    eventCount: eventHashes.length,
    merkleRoot,
    canonicalizationVersion,
    memo,
    memoHash: sha256(stableJson(memo)),
  } satisfies PreparedIotaEvidence;
}

export function computeIotaEvidenceProofId(input: {
  chainId: number | bigint;
  contractAddress: string;
  merkleRoot: string;
  tenantIdHash: string;
  resourceType: string;
  resourceId: string;
  eventCount: number;
  memoHash: string;
}) {
  if (!Number.isSafeInteger(input.eventCount) || input.eventCount <= 0) throw new Error("event_count_invalid");
  const contractAddress = canonicalContractAddress(input.contractAddress);
  if (!contractAddress) throw new Error("iota_contract_address_invalid");
  return keccak256(AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "address", "bytes32", "bytes32", "bytes32", "bytes32", "uint64", "bytes32"],
    [
      IOTA_EVIDENCE_PROOF_DOMAIN,
      input.chainId,
      contractAddress,
      digestBytes32(input.merkleRoot, "merkle_root"),
      digestBytes32(input.tenantIdHash, "tenant_id_hash"),
      keccak256(toUtf8Bytes(input.resourceType)),
      keccak256(toUtf8Bytes(input.resourceId)),
      input.eventCount,
      digestBytes32(input.memoHash, "memo_hash"),
    ],
  ));
}

function contractArguments(prepared: PreparedIotaEvidence) {
  return [
    digestBytes32(prepared.merkleRoot, "merkle_root"),
    digestBytes32(prepared.tenantIdHash, "tenant_id_hash"),
    prepared.resourceType,
    prepared.publicResourceId,
    prepared.eventCount,
    digestBytes32(prepared.memoHash, "memo_hash"),
  ] as const;
}

function sameAddress(left: unknown, right: unknown) {
  try {
    return getAddress(text(left)) === getAddress(text(right));
  } catch {
    return false;
  }
}

function asSafeNumber(value: unknown) {
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isSafeInteger(numeric) ? numeric : null;
}

function recordMatchesPrepared(record: any, prepared: PreparedIotaEvidence) {
  return normalizeIotaSha256(record?.merkleRoot ?? record?.[0]) === prepared.merkleRoot
    && normalizeIotaSha256(record?.tenantIdHash ?? record?.[1]) === `sha256:${prepared.tenantIdHash}`
    && normalizeIotaSha256(record?.memoHash ?? record?.[2]) === prepared.memoHash
    && asSafeNumber(record?.eventCount ?? record?.[4]) === prepared.eventCount;
}

export async function inspectIotaEvidenceTarget(
  prepared: PreparedIotaEvidence,
  config: IotaEvidenceRuntimeConfig,
): Promise<IotaEvidenceTarget> {
  if (!config.rpcUrl) throw new Error("iota_rpc_url_missing");
  if (!config.contractAddress) throw new Error("iota_v2_contract_missing");
  const provider = new JsonRpcProvider(config.rpcUrl, config.expectedChainId, { batchMaxCount: 1 });
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    if (chainId !== config.expectedChainId) throw new Error("iota_chain_id_mismatch");
    const bytecode = await provider.getCode(config.contractAddress);
    if (!bytecode || bytecode === "0x") throw new Error("iota_v2_contract_not_deployed");
    const contract = new Contract(config.contractAddress, IOTA_EVIDENCE_ABI, provider);
    const schemaVersion = Number(await contract.SCHEMA_VERSION());
    if (schemaVersion !== 2) throw new Error("iota_contract_schema_version_mismatch");
    const args = contractArguments(prepared);
    const localProofId = computeIotaEvidenceProofId({
      chainId,
      contractAddress: config.contractAddress,
      merkleRoot: prepared.merkleRoot,
      tenantIdHash: prepared.tenantIdHash,
      resourceType: prepared.resourceType,
      resourceId: prepared.publicResourceId,
      eventCount: prepared.eventCount,
      memoHash: prepared.memoHash,
    });
    const contractProofId = String(await contract.computeProofId(...args)).toLowerCase();
    if (contractProofId !== localProofId.toLowerCase()) throw new Error("iota_proof_id_mismatch");
    const alreadyAnchored = Boolean(await contract.isAnchored(localProofId));
    let publisherAddress: string | null = null;
    let anchoredAt: number | null = null;
    if (alreadyAnchored) {
      const record = await contract.evidenceRecord(localProofId);
      if (!recordMatchesPrepared(record, prepared)) throw new Error("iota_anchor_storage_mismatch");
      publisherAddress = getAddress(String(record.publisher ?? record[3]));
      anchoredAt = asSafeNumber(record.anchoredAt ?? record[5]);
    }
    return {
      chainId,
      contractAddress: config.contractAddress,
      contractVersion: IOTA_EVIDENCE_CONTRACT_VERSION,
      proofId: localProofId,
      alreadyAnchored,
      publisherAddress,
      anchoredAt,
    };
  } finally {
    provider.destroy();
  }
}

export async function inspectIotaEvidenceTransaction(
  prepared: PreparedIotaEvidence,
  target: IotaEvidenceTarget,
  config: IotaEvidenceRuntimeConfig,
  input: { txHash: string; expectedPublisher?: string | null },
): Promise<IotaEvidenceTransactionCheck> {
  if (!/^0x[0-9a-f]{64}$/i.test(text(input.txHash))) throw new Error("iota_tx_hash_invalid");
  const provider = new JsonRpcProvider(config.rpcUrl, config.expectedChainId, { batchMaxCount: 1 });
  try {
    const [transaction, receipt] = await Promise.all([
      provider.getTransaction(input.txHash),
      provider.getTransactionReceipt(input.txHash),
    ]);
    if (!transaction || !receipt) {
      return {
        state: "pending",
        errorCode: null,
        publisherAddress: transaction?.from ? getAddress(transaction.from) : null,
        blockNumber: null,
        blockHash: null,
        confirmations: 0,
        anchoredAt: null,
      };
    }
    if (receipt.status !== 1) {
      return {
        state: "failed",
        errorCode: "iota_receipt_reverted",
        publisherAddress: getAddress(transaction.from),
        blockNumber: asSafeNumber(receipt.blockNumber),
        blockHash: text(receipt.blockHash).toLowerCase() || null,
        confirmations: 0,
        anchoredAt: null,
      };
    }
    if (!sameAddress(transaction.to, target.contractAddress) || !sameAddress(receipt.to, target.contractAddress)) {
      throw new Error("iota_receipt_contract_mismatch");
    }
    const publisherAddress = getAddress(transaction.from);
    if (input.expectedPublisher && !sameAddress(publisherAddress, input.expectedPublisher)) {
      throw new Error("iota_receipt_publisher_mismatch");
    }
    let decoded: any;
    try {
      decoded = IOTA_EVIDENCE_INTERFACE.decodeFunctionData("anchorEvidence", transaction.data);
    } catch {
      throw new Error("iota_anchor_calldata_invalid");
    }
    const expectedArguments = contractArguments(prepared);
    const callMatches = normalizeIotaSha256(decoded[0]) === normalizeIotaSha256(expectedArguments[0])
      && normalizeIotaSha256(decoded[1]) === normalizeIotaSha256(expectedArguments[1])
      && String(decoded[2]) === prepared.resourceType
      && String(decoded[3]) === prepared.publicResourceId
      && asSafeNumber(decoded[4]) === prepared.eventCount
      && normalizeIotaSha256(decoded[5]) === prepared.memoHash;
    if (!callMatches) throw new Error("iota_anchor_calldata_mismatch");

    const anchoredEvent = receipt.logs.find((log: { address?: string; topics?: readonly string[]; data?: string }) => {
      if (!sameAddress(log.address, target.contractAddress)) return false;
      try {
        const parsed = IOTA_EVIDENCE_INTERFACE.parseLog({ topics: [...(log.topics || [])], data: String(log.data || "0x") });
        return parsed?.name === "EvidenceAnchored"
          && String(parsed.args.proofId).toLowerCase() === target.proofId.toLowerCase()
          && normalizeIotaSha256(parsed.args.merkleRoot) === prepared.merkleRoot
          && normalizeIotaSha256(parsed.args.memoHash) === prepared.memoHash
          && sameAddress(parsed.args.publisher, publisherAddress)
          && Number(parsed.args.schemaVersion) === 2;
      } catch {
        return false;
      }
    });
    if (!anchoredEvent) throw new Error("iota_evidence_event_missing");

    const contract = new Contract(target.contractAddress, IOTA_EVIDENCE_ABI, provider);
    const record = await contract.evidenceRecord(target.proofId);
    if (!recordMatchesPrepared(record, prepared)) throw new Error("iota_anchor_storage_mismatch");
    if (!sameAddress(record.publisher ?? record[3], publisherAddress)) throw new Error("iota_anchor_publisher_mismatch");
    const currentBlock = await provider.getBlockNumber();
    const blockNumber = asSafeNumber(receipt.blockNumber);
    const confirmations = blockNumber === null ? 0 : Math.max(0, currentBlock - blockNumber + 1);
    return {
      state: confirmations >= config.minConfirmations ? "confirmed" : "submitted",
      errorCode: null,
      publisherAddress,
      blockNumber,
      blockHash: /^0x[0-9a-f]{64}$/i.test(text(receipt.blockHash)) ? text(receipt.blockHash).toLowerCase() : null,
      confirmations,
      anchoredAt: asSafeNumber(record.anchoredAt ?? record[5]),
    };
  } finally {
    provider.destroy();
  }
}

function executorPayload(prepared: PreparedIotaEvidence, target: IotaEvidenceTarget, requestId: string) {
  return {
    request_id: requestId,
    proof_id: target.proofId,
    chain_id: target.chainId,
    contract_address: target.contractAddress,
    merkle_root: prepared.merkleRoot,
    tenant_id_hash: `sha256:${prepared.tenantIdHash}`,
    resource_type: prepared.resourceType,
    public_resource_id: prepared.publicResourceId,
    event_count: prepared.eventCount,
    memo_hash: prepared.memoHash,
  };
}

async function waitForExecutorStep<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new IotaExecutorClientError("iota_executor_request_timeout");
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new IotaExecutorClientError("iota_executor_request_timeout"));
    };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

async function readBoundedExecutorJson(response: Response, signal: AbortSignal) {
  const contentType = text(response.headers.get("content-type")).split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType.endsWith("+json")) {
    throw new IotaExecutorClientError("iota_executor_content_type_invalid");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength.trim())
    && Number(contentLength) > IOTA_EXECUTOR_MAX_RESPONSE_BYTES) {
    throw new IotaExecutorClientError("iota_executor_response_too_large");
  }
  if (!response.body) throw new IotaExecutorClientError("iota_executor_response_empty");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await waitForExecutorStep(reader.read(), signal);
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > IOTA_EXECUTOR_MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new IotaExecutorClientError("iota_executor_response_too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof IotaExecutorClientError) throw error;
    throw new IotaExecutorClientError("iota_executor_response_read_failed");
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A synthetic or non-compliant stream may keep a read pending after abort.
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new IotaExecutorClientError("iota_executor_json_invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new IotaExecutorClientError("iota_executor_response_invalid");
  }
  return parsed as Record<string, unknown>;
}

function strictOptionalSafeInteger(
  value: unknown,
  field: string,
  options: { required?: boolean; min?: number } = {},
) {
  if (value === null || value === undefined) {
    if (options.required) throw new IotaExecutorClientError(`iota_executor_${field}_invalid`);
    return null;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (options.min ?? 0)) {
    throw new IotaExecutorClientError(`iota_executor_${field}_invalid`);
  }
  return value;
}

function validateExecutorSubmission(
  result: Record<string, unknown>,
  target: IotaEvidenceTarget,
): IotaEvidenceSubmission {
  if (result.ok !== true) throw new IotaExecutorClientError("iota_executor_response_unsuccessful");
  if (result.state !== "submitted" && result.state !== "confirmed") {
    throw new IotaExecutorClientError("iota_executor_state_invalid");
  }

  const proofId = typeof result.proof_id === "string" ? result.proof_id.trim().toLowerCase() : "";
  if (!/^0x[0-9a-f]{64}$/.test(proofId)) {
    throw new IotaExecutorClientError("iota_executor_proof_id_invalid");
  }
  if (proofId !== target.proofId.toLowerCase()) {
    throw new IotaExecutorClientError("iota_executor_proof_id_mismatch");
  }
  if (typeof result.chain_id !== "number" || !Number.isSafeInteger(result.chain_id) || result.chain_id <= 0) {
    throw new IotaExecutorClientError("iota_executor_chain_id_invalid");
  }
  if (result.chain_id !== target.chainId) throw new IotaExecutorClientError("iota_executor_chain_mismatch");

  const contractAddress = canonicalContractAddress(result.contract_address);
  if (!contractAddress) throw new IotaExecutorClientError("iota_executor_contract_invalid");
  if (!sameAddress(contractAddress, target.contractAddress)) {
    throw new IotaExecutorClientError("iota_executor_contract_mismatch");
  }
  const publisherAddress = canonicalContractAddress(result.publisher_address);
  if (!publisherAddress) throw new IotaExecutorClientError("iota_executor_publisher_invalid");
  if (typeof result.already_anchored !== "boolean") {
    throw new IotaExecutorClientError("iota_executor_already_anchored_invalid");
  }

  const confirmations = strictOptionalSafeInteger(result.confirmations, "confirmations", { required: true });
  const blockNumber = strictOptionalSafeInteger(result.block_number, "block_number");
  const anchoredAt = strictOptionalSafeInteger(result.anchored_at, "anchored_at", { min: 1 });
  const blockHashValue = result.block_hash;
  const blockHash = blockHashValue === null || blockHashValue === undefined
    ? null
    : typeof blockHashValue === "string" && /^0x[0-9a-f]{64}$/i.test(blockHashValue)
      ? blockHashValue.toLowerCase()
      : null;
  if (blockHashValue !== null && blockHashValue !== undefined && blockHash === null) {
    throw new IotaExecutorClientError("iota_executor_block_hash_invalid");
  }

  if (result.state === "submitted") {
    if (result.already_anchored || anchoredAt !== null) {
      throw new IotaExecutorClientError("iota_executor_state_inconsistent");
    }
    if (typeof result.tx_hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(result.tx_hash)) {
      throw new IotaExecutorClientError("iota_executor_tx_hash_invalid");
    }
    const nonce = strictOptionalSafeInteger(result.nonce, "nonce", { required: true });
    return {
      proofId: target.proofId,
      txHash: result.tx_hash.toLowerCase(),
      publisherAddress,
      nonce,
      blockNumber,
      blockHash,
      confirmations: confirmations!,
      anchoredAt: null,
      alreadyAnchored: false,
    };
  }

  if (!result.already_anchored || anchoredAt === null) {
    throw new IotaExecutorClientError("iota_executor_state_inconsistent");
  }
  if (result.tx_hash !== null && result.tx_hash !== undefined) {
    throw new IotaExecutorClientError("iota_executor_tx_hash_invalid");
  }
  if (result.nonce !== null && result.nonce !== undefined) {
    throw new IotaExecutorClientError("iota_executor_nonce_invalid");
  }
  return {
    proofId: target.proofId,
    txHash: null,
    publisherAddress,
    nonce: null,
    blockNumber,
    blockHash,
    confirmations: confirmations!,
    anchoredAt,
    alreadyAnchored: true,
  };
}

async function publishWithExecutor(
  prepared: PreparedIotaEvidence,
  target: IotaEvidenceTarget,
  config: IotaEvidenceRuntimeConfig,
  requestId: string,
  hooks: PublishHooks,
): Promise<IotaEvidenceSubmission> {
  if (!config.executorSecret) throw new IotaExecutorClientError("iota_executor_secret_missing");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.executorTimeoutMs);
  let submission: IotaEvidenceSubmission;
  try {
    const response = await waitForExecutorStep((hooks.fetchImpl || fetch)(config.executorUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-iota-proof-secret": config.executorSecret,
        "idempotency-key": target.proofId,
      },
      body: JSON.stringify(executorPayload(prepared, target, requestId)),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    }), controller.signal);
    if (!response.ok) {
      throw new IotaExecutorClientError(
        response.status === 409 ? "iota_executor_conflict" : `iota_executor_http_${response.status}`,
      );
    }
    submission = validateExecutorSubmission(await readBoundedExecutorJson(response, controller.signal), target);
  } catch (error) {
    if (controller.signal.aborted) throw new IotaExecutorClientError("iota_executor_request_timeout");
    if (error instanceof IotaExecutorClientError) throw error;
    throw new IotaExecutorClientError("iota_executor_request_failed");
  } finally {
    clearTimeout(timeout);
  }
  if (submission.txHash) {
    await hooks.onSubmitted?.({
      txHash: submission.txHash,
      publisherAddress: submission.publisherAddress,
      nonce: submission.nonce,
    });
  }
  return submission;
}

async function publishWithLocalSigner(
  prepared: PreparedIotaEvidence,
  target: IotaEvidenceTarget,
  config: IotaEvidenceRuntimeConfig,
  hooks: PublishHooks,
): Promise<IotaEvidenceSubmission> {
  if (!config.allowLocalSigner) throw new Error("iota_local_signer_forbidden");
  if (!config.localPrivateKey) throw new Error("iota_local_signer_missing");
  const provider = new JsonRpcProvider(config.rpcUrl, config.expectedChainId, { batchMaxCount: 1 });
  try {
    const wallet = new Wallet(config.localPrivateKey, provider);
    const contract = new Contract(config.contractAddress, IOTA_EVIDENCE_ABI, wallet);
    if (!await contract.authorizedPublishers(wallet.address)) throw new Error("iota_publisher_not_authorized");
    if (await contract.isAnchored(target.proofId)) {
      const record = await contract.evidenceRecord(target.proofId);
      if (!recordMatchesPrepared(record, prepared)) throw new Error("iota_anchor_storage_mismatch");
      return {
        proofId: target.proofId,
        txHash: null,
        publisherAddress: getAddress(String(record.publisher ?? record[3])),
        nonce: null,
        blockNumber: null,
        blockHash: null,
        confirmations: config.minConfirmations,
        anchoredAt: asSafeNumber(record.anchoredAt ?? record[5]),
        alreadyAnchored: true,
      };
    }

    const tx = await contract.anchorEvidence(...contractArguments(prepared));
    await hooks.onSubmitted?.({
      txHash: tx.hash,
      publisherAddress: wallet.address,
      nonce: asSafeNumber(tx.nonce),
    });
    const receipt = await tx.wait(config.minConfirmations);
    if (!receipt || receipt.status !== 1) throw new Error("iota_receipt_failed");
    if (!sameAddress(receipt.to, config.contractAddress)) throw new Error("iota_receipt_contract_mismatch");

    const anchoredLog = receipt.logs.find((log: { topics?: readonly string[]; data?: string }) => {
      try {
        const decoded = IOTA_EVIDENCE_INTERFACE.parseLog({ topics: [...(log.topics || [])], data: String(log.data || "0x") });
        return decoded?.name === "EvidenceAnchored"
          && String(decoded.args.proofId).toLowerCase() === target.proofId.toLowerCase()
          && normalizeIotaSha256(decoded.args.memoHash) === prepared.memoHash;
      } catch {
        return false;
      }
    });
    if (!anchoredLog) throw new Error("iota_evidence_event_missing");
    const record = await contract.evidenceRecord(target.proofId);
    if (!recordMatchesPrepared(record, prepared)) throw new Error("iota_anchor_storage_mismatch");
    return {
      proofId: target.proofId,
      txHash: tx.hash,
      publisherAddress: wallet.address,
      nonce: asSafeNumber(tx.nonce),
      blockNumber: asSafeNumber(receipt.blockNumber),
      blockHash: /^0x[0-9a-f]{64}$/i.test(text(receipt.blockHash)) ? text(receipt.blockHash).toLowerCase() : null,
      confirmations: config.minConfirmations,
      anchoredAt: asSafeNumber(record.anchoredAt ?? record[5]),
      alreadyAnchored: false,
    };
  } finally {
    provider.destroy();
  }
}

export async function publishIotaEvidence(
  prepared: PreparedIotaEvidence,
  target: IotaEvidenceTarget,
  config: IotaEvidenceRuntimeConfig,
  requestId: string,
  hooks: PublishHooks = {},
) {
  if (target.alreadyAnchored) {
    if (!target.publisherAddress) throw new Error("iota_anchor_publisher_missing");
    return {
      proofId: target.proofId,
      txHash: null,
      publisherAddress: target.publisherAddress,
      nonce: null,
      blockNumber: null,
      blockHash: null,
      confirmations: config.minConfirmations,
      anchoredAt: target.anchoredAt,
      alreadyAnchored: true,
    } satisfies IotaEvidenceSubmission;
  }
  if (config.production && !config.executorUrl) {
    throw new IotaExecutorClientError("iota_executor_required_in_production");
  }
  if (config.production && !config.executorSecret) {
    throw new IotaExecutorClientError("iota_executor_secret_required_in_production");
  }
  if (config.executorUrl) return publishWithExecutor(prepared, target, config, requestId, hooks);
  return publishWithLocalSigner(prepared, target, config, hooks);
}

export function iotaEvidenceExplorerUrl(config: IotaEvidenceRuntimeConfig, txHash: string | null) {
  return config.explorerBaseUrl && txHash ? `${config.explorerBaseUrl}/tx/${txHash}` : null;
}
