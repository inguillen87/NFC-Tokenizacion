import { createHash } from "node:crypto";
import { AbiCoder, Interface, getAddress, keccak256, toUtf8Bytes, toUtf8String } from "ethers";
import {
  publicProofIotaContractAddress,
  publicProofIotaPublisherAddress,
  publicProofIotaRpcUrl,
} from "./public-proof-runtime";

const IOTA_EVM_TESTNET_CHAIN_ID = 1076;
const IOTA_LEGACY_ANCHOR_INTERFACE = new Interface([
  "function anchorRoot(bytes32 merkleRoot, string tenantIdHash, string resourceType, string resourceId, uint256 eventCount)",
]);
const IOTA_EVIDENCE_ANCHOR_INTERFACE = new Interface([
  "function anchorEvidence(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) returns (bytes32 proofId)",
]);
const IOTA_EVIDENCE_PROOF_DOMAIN = keccak256(toUtf8Bytes("nexid.evidence.anchor.v2"));
const CACHE_KEY = "__nexid_iota_evm_tx_cache_v1__";

type RpcTransaction = {
  hash?: string;
  from?: string;
  to?: string | null;
  input?: string;
  blockNumber?: string | null;
};

type RpcReceipt = {
  transactionHash?: string;
  from?: string;
  to?: string | null;
  status?: string | null;
  blockNumber?: string | null;
};

type RpcEnvelope<T> = { id?: number; result?: T; error?: { code?: number; message?: string } };

export type IotaEvmTransactionProof = {
  checked: boolean;
  verified: boolean;
  reason: string | null;
  chain_id: number | null;
  chain_match: boolean;
  transaction_found: boolean;
  transaction_hash_matches: boolean;
  receipt_found: boolean;
  receipt_hash_matches: boolean;
  receipt_status: "success" | "reverted" | "pending" | "unknown";
  block_number: number | null;
  confirmations: number | null;
  from: string | null;
  to: string | null;
  input_hex: string | null;
};

export type IotaAnchorCall = {
  contract_version: "legacy_v1" | "evidence_anchor_v2";
  merkle_root: string;
  tenant_id_hash: string;
  resource_type: string;
  resource_id: string;
  event_count: number;
  memo_hash: string | null;
};

type CachedTransaction = { expiresAt: number; value: Promise<IotaEvmTransactionProof> };

function txCache() {
  const scope = globalThis as typeof globalThis & { [CACHE_KEY]?: Map<string, CachedTransaction> };
  scope[CACHE_KEY] ||= new Map<string, CachedTransaction>();
  return scope[CACHE_KEY];
}

function parseHexNumber(value: unknown) {
  const text = String(value || "").trim();
  if (!/^0x[0-9a-f]+$/i.test(text)) return null;
  const parsed = Number.parseInt(text.slice(2), 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeAddress(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    return getAddress(text);
  } catch {
    return null;
  }
}

async function readIotaEvmTransactionUncached(txHash: string): Promise<IotaEvmTransactionProof> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(publicProofIotaRpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
        { jsonrpc: "2.0", id: 2, method: "eth_getTransactionByHash", params: [txHash] },
        { jsonrpc: "2.0", id: 3, method: "eth_getTransactionReceipt", params: [txHash] },
        { jsonrpc: "2.0", id: 4, method: "eth_blockNumber", params: [] },
      ]),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`iota_rpc_http_${response.status}`);
    const payload = await response.json() as Array<RpcEnvelope<unknown>>;
    if (!Array.isArray(payload)) throw new Error("iota_rpc_batch_invalid");
    const byId = new Map(payload.map((item) => [Number(item.id), item]));
    if (payload.some((item) => item.error)) throw new Error("iota_rpc_error");

    const chainId = parseHexNumber(byId.get(1)?.result);
    const transaction = (byId.get(2)?.result || null) as RpcTransaction | null;
    const receipt = (byId.get(3)?.result || null) as RpcReceipt | null;
    const latestBlock = parseHexNumber(byId.get(4)?.result);
    const blockNumber = parseHexNumber(receipt?.blockNumber || transaction?.blockNumber);
    const statusHex = String(receipt?.status || "").toLowerCase();
    const receiptStatus = !receipt
      ? "pending"
      : statusHex === "0x1"
        ? "success"
        : statusHex === "0x0"
          ? "reverted"
          : "unknown";
    const chainMatch = chainId === IOTA_EVM_TESTNET_CHAIN_ID;
    const transactionHashMatches = String(transaction?.hash || "").toLowerCase() === txHash;
    const receiptHashMatches = String(receipt?.transactionHash || "").toLowerCase() === txHash;
    const verified = Boolean(
      transaction
      && receipt
      && transactionHashMatches
      && receiptHashMatches
      && receiptStatus === "success"
      && blockNumber !== null
      && chainMatch,
    );

    return {
      checked: true,
      verified,
      reason: verified
        ? null
        : !chainMatch
          ? "iota_chain_id_mismatch"
          : !transaction
            ? "iota_transaction_not_found"
            : !transactionHashMatches
              ? "iota_transaction_hash_mismatch"
              : !receipt
                ? "iota_receipt_pending"
                : !receiptHashMatches
                  ? "iota_receipt_hash_mismatch"
                  : receiptStatus === "reverted"
                    ? "iota_transaction_reverted"
                    : "iota_receipt_unconfirmed",
      chain_id: chainId,
      chain_match: chainMatch,
      transaction_found: Boolean(transaction),
      transaction_hash_matches: transactionHashMatches,
      receipt_found: Boolean(receipt),
      receipt_hash_matches: receiptHashMatches,
      receipt_status: receiptStatus,
      block_number: blockNumber,
      confirmations: blockNumber !== null && latestBlock !== null ? Math.max(0, latestBlock - blockNumber + 1) : null,
      from: normalizeAddress(receipt?.from || transaction?.from),
      to: normalizeAddress(receipt?.to || transaction?.to),
      input_hex: typeof transaction?.input === "string" ? transaction.input : null,
    };
  } catch (error) {
    return {
      checked: false,
      verified: false,
      reason: error instanceof Error && error.name === "AbortError" ? "iota_rpc_timeout" : "iota_rpc_unavailable",
      chain_id: null,
      chain_match: false,
      transaction_found: false,
      transaction_hash_matches: false,
      receipt_found: false,
      receipt_hash_matches: false,
      receipt_status: "unknown",
      block_number: null,
      confirmations: null,
      from: null,
      to: null,
      input_hex: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function readIotaEvmTransaction(txHash: string) {
  const normalized = String(txHash || "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(normalized)) {
    return {
      checked: false,
      verified: false,
      reason: "iota_tx_hash_invalid",
      chain_id: null,
      chain_match: false,
      transaction_found: false,
      transaction_hash_matches: false,
      receipt_found: false,
      receipt_hash_matches: false,
      receipt_status: "unknown",
      block_number: null,
      confirmations: null,
      from: null,
      to: null,
      input_hex: null,
    } satisfies IotaEvmTransactionProof;
  }

  const cache = txCache();
  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = readIotaEvmTransactionUncached(normalized);
  const entry = { expiresAt: Date.now() + 10_000, value };
  cache.set(normalized, entry);
  void value.then((proof) => {
    entry.expiresAt = Date.now() + (proof.checked ? 5 * 60_000 : 10_000);
  });
  return value;
}

export function decodeIotaAnchorInput(input: unknown): IotaAnchorCall | null {
  const value = String(input || "").trim();
  if (!/^0x[0-9a-f]+$/i.test(value)) return null;
  try {
    const decoded = IOTA_EVIDENCE_ANCHOR_INTERFACE.decodeFunctionData("anchorEvidence", value);
    return {
      contract_version: "evidence_anchor_v2",
      merkle_root: `sha256:${String(decoded[0]).replace(/^0x/, "").toLowerCase()}`,
      tenant_id_hash: String(decoded[1]).replace(/^0x/, "").toLowerCase(),
      resource_type: String(decoded[2]),
      resource_id: String(decoded[3]),
      event_count: Number(decoded[4]),
      memo_hash: `sha256:${String(decoded[5]).replace(/^0x/, "").toLowerCase()}`,
    };
  } catch {
    try {
      const decoded = IOTA_LEGACY_ANCHOR_INTERFACE.decodeFunctionData("anchorRoot", value);
      return {
        contract_version: "legacy_v1",
        merkle_root: `sha256:${String(decoded[0]).replace(/^0x/, "").toLowerCase()}`,
        tenant_id_hash: String(decoded[1]).replace(/^(?:sha256:|0x)/i, "").toLowerCase(),
        resource_type: String(decoded[2]),
        resource_id: String(decoded[3]),
        event_count: Number(decoded[4]),
        memo_hash: null,
      };
    } catch {
      return null;
    }
  }
}

function normalizeSha256Digest(value: unknown) {
  const normalized = String(value || "").trim().replace(/^(?:sha256:|0x)/i, "").toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function computeIotaEvidenceProofId(input: {
  chainId: number | null;
  contractAddress: string | null;
  decoded: IotaAnchorCall | null;
}) {
  if (
    input.decoded?.contract_version !== "evidence_anchor_v2"
    || input.chainId === null
    || !input.contractAddress
  ) return null;
  const merkleRoot = normalizeSha256Digest(input.decoded.merkle_root);
  const tenantIdHash = normalizeSha256Digest(input.decoded.tenant_id_hash);
  const memoHash = normalizeSha256Digest(input.decoded.memo_hash);
  if (!merkleRoot || !tenantIdHash || !memoHash) return null;
  return keccak256(AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "address", "bytes32", "bytes32", "bytes32", "bytes32", "uint64", "bytes32"],
    [
      IOTA_EVIDENCE_PROOF_DOMAIN,
      input.chainId,
      input.contractAddress,
      `0x${merkleRoot}`,
      `0x${tenantIdHash}`,
      keccak256(toUtf8Bytes(input.decoded.resource_type)),
      keccak256(toUtf8Bytes(input.decoded.resource_id)),
      input.decoded.event_count,
      `0x${memoHash}`,
    ],
  ));
}

export function iotaAnchorTenantHash(tenantId: string) {
  return createHash("sha256").update(String(tenantId || ""), "utf8").digest("hex");
}

export function decodeIotaMemoInput(input: unknown) {
  const value = String(input || "").trim();
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(value)) return null;
  try {
    return toUtf8String(value).replace(/\0/g, "").trim();
  } catch {
    return null;
  }
}

export async function verifyIotaAnchorPublication(input: {
  txHash: string;
  merkleRoot: string;
  tenantIdHash: string;
  resourceType: string;
  resourceId: string;
  eventCount: number;
  memoHash?: string;
}) {
  const transaction = await readIotaEvmTransaction(input.txHash);
  const decoded = decodeIotaAnchorInput(transaction.input_hex);
  const configuredContract = normalizeAddress(publicProofIotaContractAddress());
  const configuredPublisher = normalizeAddress(publicProofIotaPublisherAddress());
  const expected = {
    merkle_root: String(input.merkleRoot || "").toLowerCase(),
    tenant_id_hash: String(input.tenantIdHash || "").replace(/^(?:sha256:|0x)/i, "").toLowerCase(),
    resource_type: String(input.resourceType || ""),
    resource_id: String(input.resourceId || ""),
    event_count: Number(input.eventCount || 0),
    memo_hash: normalizeSha256Digest(input.memoHash),
  };
  const memoHashMatches = Boolean(
    decoded
    && (decoded.contract_version === "legacy_v1"
      || (expected.memo_hash && normalizeSha256Digest(decoded.memo_hash) === expected.memo_hash)),
  );
  const callMatches = Boolean(
    decoded
    && decoded.merkle_root === expected.merkle_root
    && decoded.tenant_id_hash === expected.tenant_id_hash
    && decoded.resource_type === expected.resource_type
    && decoded.resource_id === expected.resource_id
    && decoded.event_count === expected.event_count
    && memoHashMatches
  );
  const contractMatches = Boolean(configuredContract && transaction.to === configuredContract);
  const publisherMatches = Boolean(configuredPublisher && transaction.from === configuredPublisher);
  const verified = transaction.verified && callMatches && contractMatches && publisherMatches;
  const proofId = computeIotaEvidenceProofId({
    chainId: transaction.chain_id,
    contractAddress: transaction.to,
    decoded,
  });

  return {
    ...transaction,
    verified,
    reason: verified
      ? null
      : transaction.reason
        || (!configuredPublisher
          ? "iota_publisher_not_configured"
          : !publisherMatches
            ? "iota_anchor_publisher_mismatch"
            : !contractMatches
              ? "iota_anchor_contract_mismatch"
              : "iota_anchor_call_mismatch"),
    expected_call_matches: callMatches,
    memo_hash_matches: memoHashMatches,
    contract_matches: contractMatches,
    publisher_matches: publisherMatches,
    contract_version: decoded?.contract_version || null,
    proof_id: proofId,
    decoded_call: decoded,
  };
}

export async function verifyIotaMemoPublication(txHash: string, expectedMemo: string) {
  const transaction = await readIotaEvmTransaction(txHash);
  const decodedMemo = decodeIotaMemoInput(transaction.input_hex);
  const memoMatches = Boolean(decodedMemo && decodedMemo === expectedMemo);
  const selfTransfer = Boolean(transaction.from && transaction.to && transaction.from === transaction.to);
  const configuredPublisher = normalizeAddress(publicProofIotaPublisherAddress());
  const publisherMatches = Boolean(
    configuredPublisher
    && transaction.from === configuredPublisher
    && transaction.to === configuredPublisher,
  );
  const verified = transaction.verified && memoMatches && publisherMatches;

  return {
    ...transaction,
    verified,
    reason: verified
      ? null
      : transaction.reason
        || (!configuredPublisher
          ? "iota_publisher_not_configured"
          : !publisherMatches
            ? "iota_memo_publisher_mismatch"
            : "iota_memo_mismatch"),
    memo_matches: memoMatches,
    self_transfer: selfTransfer,
    publisher_matches: publisherMatches,
    decoded_memo: decodedMemo,
  };
}
