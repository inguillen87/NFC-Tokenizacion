import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sql } from "./db";
import { buildChipUidHash } from "./tokenization-hash";
import { ensureTokenizationCommercialScopeSchema } from "./tokenization-schema";
import { recordTokenizationCanonicalEvent } from "./tokenization-event-service";
import {
  createTokenizationExecutionLeaseId,
  prepareTokenizationExecution,
} from "./tokenization-execution-lease";
import {
  tokenizationExecutionGovernanceError,
  tokenizationFailurePolicy,
} from "./tokenization-execution-policy";
import { buildPolygonMintIntentDigest, POLYGON_MINT_INTENT_VERSION } from "./polygon-mint-intent";
import { readCurrentTapCommercialRights } from "./tap-commercial-rights";

type AnchorInput = {
  requestId: string;
  tenantId: string;
  network?: string;
  issuerWallet?: string | null;
  processor?: string;
};

type ExecutorClientOptions = {
  source?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const EXECUTOR_DEFAULT_TIMEOUT_MS = 60_000;
const EXECUTOR_MIN_TIMEOUT_MS = 100;
const EXECUTOR_MAX_TIMEOUT_MS = 120_000;
const EXECUTOR_MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_UINT256 = (1n << 256n) - 1n;

class ExecutorClientError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "ExecutorClientError";
  }
}

const POLYGON_MINT_ABI = [
  "function mintWithChipHash(address to, string chipUidHash, string tokenUri, string assetRef) external returns (uint256)",
  "function tokenByChipHash(string chipUidHash) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function chipUidHashByTokenId(uint256 tokenId) external view returns (string)",
  "function assetRefByTokenId(uint256 tokenId) external view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event DigitalTwinMinted(uint256 indexed tokenId, address indexed to, string chipUidHash, string assetRef, string tokenUri)",
] as const;

export type TokenizationRuntimeMode = "disabled" | "simulated" | "polygon";

export function resolveTokenizationRuntimeMode(value = process.env.TOKENIZATION_MODE): TokenizationRuntimeMode {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "polygon") return "polygon";
  if (normalized === "simulated") return "simulated";
  return "disabled";
}

function isProductionRuntime(source: NodeJS.ProcessEnv = process.env) {
  return [source.VERCEL_ENV, source.NODE_ENV]
    .some((value) => String(value || "").trim().toLowerCase() === "production");
}

function assertExportablePolygonSignerAllowed() {
  if (isProductionRuntime()) {
    throw new Error("polygon_exportable_signer_forbidden_in_production_use_executor");
  }
}

function buildSimulationRef(requestId: string, uid: string) {
  return `simulation:${createHash("sha256").update(`${requestId}:${uid}`).digest("hex").slice(0, 32)}`;
}

function buildPublicAssetId(chipUidHash: string) {
  const digest = String(chipUidHash || "").split(":").pop() || chipUidHash;
  return `nx-${digest.slice(0, 24)}`;
}

function buildTokenMetadataUrl(publicAssetId: string) {
  const configuredBase = String(process.env.TOKENIZATION_METADATA_BASE_URL || "https://api.nexid.lat/public/polygon/assets").trim().replace(/\/$/, "");
  return `${configuredBase}/${encodeURIComponent(publicAssetId)}`;
}

function boundedExecutorTimeout(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return EXECUTOR_DEFAULT_TIMEOUT_MS;
  return Math.min(EXECUTOR_MAX_TIMEOUT_MS, Math.max(EXECUTOR_MIN_TIMEOUT_MS, Math.trunc(parsed)));
}

function resolveExecutorUrl(raw: string, production: boolean) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ExecutorClientError("executor_url_invalid");
  }
  if (url.username || url.password || url.hash) throw new ExecutorClientError("executor_url_invalid");
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new ExecutorClientError("executor_url_invalid");
  if (production && url.protocol !== "https:") {
    throw new ExecutorClientError("executor_https_required_in_production");
  }
  return url;
}

async function readBoundedExecutorJson(response: Response) {
  const contentType = String(response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType.endsWith("+json")) {
    throw new ExecutorClientError("executor_content_type_invalid");
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > EXECUTOR_MAX_RESPONSE_BYTES) {
    throw new ExecutorClientError("executor_response_too_large");
  }
  if (!response.body) throw new ExecutorClientError("executor_response_empty");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > EXECUTOR_MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ExecutorClientError("executor_response_too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ExecutorClientError) throw error;
    throw new ExecutorClientError("executor_response_read_failed");
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(text);
  } catch {
    throw new ExecutorClientError("executor_json_invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ExecutorClientError("executor_response_invalid");
  }
  return parsed as Record<string, unknown>;
}

function validateExecutorResponse(result: Record<string, unknown>): Record<string, unknown> {
  if (result.ok !== true) throw new ExecutorClientError("executor_response_unsuccessful");

  const txHash = result.tx_hash == null ? null : result.tx_hash;
  if (txHash !== null && (typeof txHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(txHash))) {
    throw new ExecutorClientError("executor_tx_hash_invalid");
  }

  const tokenId = result.token_id == null ? null : result.token_id;
  if (tokenId !== null) {
    if (typeof tokenId !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(tokenId)) {
      throw new ExecutorClientError("executor_token_id_invalid");
    }
    const numericTokenId = BigInt(tokenId);
    if (numericTokenId <= 0n || numericTokenId > MAX_UINT256) {
      throw new ExecutorClientError("executor_token_id_invalid");
    }
  }

  if (txHash === null && tokenId === null) throw new ExecutorClientError("executor_evidence_missing");
  return { ...result, tx_hash: txHash, token_id: tokenId };
}

function canonicalEvidenceAddress(value: unknown) {
  const address = String(value || "").trim();
  return /^0x[0-9a-f]{40}$/i.test(address) ? address.toLowerCase() : null;
}

export function assertPolygonMintStateMatches(input: {
  expectedRecipient: string;
  expectedChipUidHash: string;
  expectedTokenUri: string;
  expectedAssetRef: string;
  actualOwner: unknown;
  actualChipUidHash: unknown;
  actualTokenUri: unknown;
  actualAssetRef: unknown;
}) {
  const expectedRecipient = canonicalEvidenceAddress(input.expectedRecipient);
  if (!expectedRecipient) throw new Error("polygon_anchor_expected_recipient_invalid");
  const actualOwner = canonicalEvidenceAddress(input.actualOwner);
  if (!actualOwner) throw new Error("polygon_anchor_owner_invalid");
  if (actualOwner !== expectedRecipient) throw new Error("polygon_anchor_owner_mismatch");
  if (String(input.actualChipUidHash) !== input.expectedChipUidHash) {
    throw new Error("polygon_anchor_chip_hash_mismatch");
  }
  if (String(input.actualTokenUri) !== input.expectedTokenUri) {
    throw new Error("polygon_anchor_token_uri_mismatch");
  }
  if (String(input.actualAssetRef) !== input.expectedAssetRef) {
    throw new Error("polygon_anchor_asset_ref_mismatch");
  }
}

function safePolygonAnchorVerificationError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return /^polygon_anchor_[a-z0-9_]{3,100}$/.test(code)
    ? new Error(code)
    : new Error("polygon_anchor_verification_failed");
}

export async function runExternalExecutor(
  payload: Record<string, unknown>,
  options: ExecutorClientOptions = {},
): Promise<Record<string, unknown> | null> {
  const source = options.source || process.env;
  const production = isProductionRuntime(source);
  const rawUrl = String(source.TOKENIZATION_EXECUTOR_URL || "").trim();
  if (!rawUrl) {
    if (production) throw new ExecutorClientError("executor_required_in_production");
    return null;
  }

  const url = resolveExecutorUrl(rawUrl, production);
  const secret = String(source.TOKENIZATION_EXECUTOR_SECRET || "").trim();
  if (production && !secret) throw new ExecutorClientError("executor_secret_required_in_production");
  if (production && Buffer.byteLength(secret, "utf8") < 32) {
    throw new ExecutorClientError("executor_secret_too_short_in_production");
  }
  const idempotencyKey = String(payload.request_id || "").trim();
  if (idempotencyKey && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(idempotencyKey)) {
    throw new ExecutorClientError("executor_idempotency_key_invalid");
  }

  const controller = new AbortController();
  const timeoutMs = boundedExecutorTimeout(options.timeoutMs ?? source.TOKENIZATION_EXECUTOR_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetchImpl || fetch)(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-tokenization-secret": secret } : {}),
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new ExecutorClientError(`executor_http_${response.status}`);
    return validateExecutorResponse(await readBoundedExecutorJson(response));
  } catch (error) {
    if (controller.signal.aborted) throw new ExecutorClientError("executor_request_timeout");
    if (error instanceof ExecutorClientError) throw error;
    throw new ExecutorClientError("executor_request_failed");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePrivateKey(raw: string) {
  const value = raw.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return `0x${value}`;
  return value;
}

function assertPolygonExecutionConfiguration(network: string) {
  if (network !== "polygon-amoy" && network !== "polygon") {
    throw new Error("polygon_anchor_network_mismatch");
  }
  const rpcUrl = String(process.env.POLYGON_RPC_URL || "").trim();
  const contractAddress = String(process.env.POLYGON_CONTRACT_ADDRESS || "").trim();
  if (!rpcUrl || !contractAddress) throw new Error("polygon_anchor_verification_unavailable");
  if (!canonicalEvidenceAddress(contractAddress)) throw new Error("invalid_POLYGON_CONTRACT_ADDRESS");
  if (Buffer.byteLength(String(process.env.TOKENIZATION_UID_SALT || "").trim(), "utf8") < 32) {
    throw new Error("tokenization_uid_salt_too_short");
  }
  const configuredMinter = canonicalEvidenceAddress(
    process.env.POLYGON_KMS_PUBLISHER_ADDRESS || process.env.POLYGON_MINTER_ADDRESS,
  );
  if (!configuredMinter) throw new Error("polygon_minter_address_required");

  const production = isProductionRuntime();
  const executorUrl = String(process.env.TOKENIZATION_EXECUTOR_URL || "").trim();
  if (executorUrl) {
    resolveExecutorUrl(executorUrl, production || network === "polygon");
    const executorSecret = String(process.env.TOKENIZATION_EXECUTOR_SECRET || "").trim();
    if (!executorSecret) {
      if (network === "polygon") throw new Error("executor_secret_required_for_live_chain");
      if (production) throw new Error("executor_secret_required_in_production");
    }
    if ((production || network === "polygon") && Buffer.byteLength(executorSecret, "utf8") < 32) {
      throw new Error(network === "polygon" ? "executor_secret_too_short_for_live_chain" : "executor_secret_too_short_in_production");
    }
    return;
  }
  if (network === "polygon") throw new Error("executor_required_for_live_chain");
  if (production) throw new Error("executor_required_in_production");

  const wantsLocalMinter = String(process.env.TOKENIZATION_USE_LOCAL_MINTER || "false").toLowerCase() === "true";
  if (!wantsLocalMinter) {
    throw new Error("polygon_anchor_unavailable_configure_local_minter_or_executor");
  }
  if (!/^0x[0-9a-f]{64}$/i.test(normalizePrivateKey(String(process.env.POLYGON_MINTER_PRIVATE_KEY || "")))) {
    throw new Error("missing_POLYGON_MINTER_PRIVATE_KEY_for_direct_minter");
  }
}

async function runDirectPolygonMint(payload: Record<string, unknown>) {
  const enabled = String(process.env.TOKENIZATION_USE_LOCAL_MINTER || "false").toLowerCase() === "true";
  if (!enabled) return null;
  assertExportablePolygonSignerAllowed();

  const rpcUrl = String(process.env.POLYGON_RPC_URL || "").trim();
  const privateKey = normalizePrivateKey(String(process.env.POLYGON_MINTER_PRIVATE_KEY || ""));
  const contractAddress = String(process.env.POLYGON_CONTRACT_ADDRESS || "").trim();
  const chipUidHash = String(payload.chip_uid_hash || "").trim();
  const recipient = String(payload.issuer_wallet || "").trim();
  const tokenUri = String(payload.token_uri || "").trim();
  const assetRef = String(payload.asset_ref || "").trim();

  if (!rpcUrl) throw new Error("missing_POLYGON_RPC_URL_for_direct_minter");
  if (!privateKey) throw new Error("missing_POLYGON_MINTER_PRIVATE_KEY_for_direct_minter");
  if (!contractAddress) throw new Error("missing_POLYGON_CONTRACT_ADDRESS_for_direct_minter");
  if (!chipUidHash) throw new Error("missing_chip_uid_hash_for_direct_minter");
  if (!recipient) throw new Error("missing_recipient_for_direct_minter");
  if (!tokenUri) throw new Error("missing_token_uri_for_direct_minter");
  if (!assetRef) throw new Error("missing_asset_ref_for_direct_minter");

  const { ethers } = await import("ethers");
  if (!ethers.isAddress(contractAddress)) throw new Error("polygon_anchor_contract_address_invalid");
  if (!ethers.isAddress(recipient)) throw new Error("invalid_polygon_recipient");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, POLYGON_MINT_ABI, wallet);

  const existingTokenId = await contract.tokenByChipHash(chipUidHash);
  const existingTokenIdText = String(existingTokenId || "0");
  if (BigInt(existingTokenIdText) > 0n) {
    return {
      ok: true,
      network: "polygon",
      tx_hash: null,
      token_id: existingTokenIdText,
      chip_uid_hash: chipUidHash,
      anchor_hash: `polygon-token:${contractAddress}:${existingTokenIdText}`,
      external_ref: `polygon-amoy:${contractAddress}:${existingTokenIdText}`,
      already_minted: true,
    };
  }

  const tx = await contract.mintWithChipHash(recipient, chipUidHash, tokenUri, assetRef);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("polygon_receipt_failed");

  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const transferLog = receipt.logs.find((log: { address?: string; topics?: string[] }) => (
    String(log.address || "").toLowerCase() === contractAddress.toLowerCase()
    && log.topics?.[0] === transferTopic
    && log.topics?.[3]
  ));
  const tokenId = transferLog?.topics?.[3] ? String(BigInt(transferLog.topics[3])) : null;
  if (!tokenId) throw new Error("polygon_mint_transfer_event_missing");

  const confirmedTokenId = String(await contract.tokenByChipHash(chipUidHash));
  if (confirmedTokenId !== tokenId) throw new Error("polygon_mint_token_lookup_mismatch");

  return {
    ok: true,
    network: "polygon",
    tx_hash: tx.hash,
    token_id: tokenId,
    chip_uid_hash: chipUidHash,
    block_number: receipt.blockNumber,
    anchor_hash: tx.hash,
    external_ref: `polygon-amoy:${contractAddress}:${tokenId || tx.hash}`,
  };
}

async function runLocalPolygonScript(payload: Record<string, unknown>) {
  const enabled = String(process.env.TOKENIZATION_USE_LOCAL_MINTER || "false").toLowerCase() === "true";
  if (!enabled) return null;
  assertExportablePolygonSignerAllowed();
  const chipUidHash = String(payload.chip_uid_hash || "").trim();
  const uid = String(payload.uid_hex || "").trim();
  if (!chipUidHash && !uid) return null;

  const recipient = String(payload.issuer_wallet || "").trim();
  const tokenUri = String(payload.token_uri || "").trim();
  if (!recipient || !tokenUri) return null;

  const scriptPath = fileURLToPath(new URL("../../scripts/mint-on-valid-tap.mjs", import.meta.url));
  const args = [
    scriptPath,
    `--to=${recipient}`,
    `--token_uri=${tokenUri}`,
    `--asset_ref=${String(payload.asset_ref || "")}`,
    ...(chipUidHash ? [`--chip_uid_hash=${chipUidHash}`] : [`--uid=${uid}`]),
  ];

  return await new Promise<Record<string, unknown> | null>((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (buf) => { stdout += String(buf); });
    child.stderr.on("data", (buf) => { stderr += String(buf); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `local_minter_exit_${code}`));
      const line = stdout.trim().split("\n").filter(Boolean).at(-1);
      if (!line) return resolve(null);
      try {
        resolve(JSON.parse(line) as Record<string, unknown>);
      } catch {
        reject(new Error("local_minter_invalid_json"));
      }
    });
  });
}

async function verifyPolygonMintEvidence(input: {
  network: string;
  chipUidHash: string;
  expectedRecipient: string;
  expectedTokenUri: string;
  expectedAssetRef: string;
  txHash?: string | null;
  tokenId?: string | null;
}) {
  const rpcUrl = String(process.env.POLYGON_RPC_URL || "").trim();
  const contractAddress = String(process.env.POLYGON_CONTRACT_ADDRESS || "").trim();
  if (!rpcUrl || !contractAddress) throw new Error("polygon_anchor_verification_unavailable");

  const { ethers } = await import("ethers");
  if (!ethers.isAddress(contractAddress)) throw new Error("invalid_POLYGON_CONTRACT_ADDRESS");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const expectedChainId = input.network === "polygon-amoy"
    ? 80002n
    : input.network === "polygon"
      ? 137n
      : 0n;
  if (expectedChainId === 0n) throw new Error("polygon_anchor_network_mismatch");
  const providerNetwork = await provider.getNetwork();
  if (providerNetwork.chainId !== expectedChainId) throw new Error("polygon_anchor_wrong_chain");
  const bytecode = await provider.getCode(contractAddress);
  if (!bytecode || bytecode === "0x") throw new Error("polygon_anchor_contract_missing");

  const contract = new ethers.Contract(contractAddress, POLYGON_MINT_ABI, provider);
  const chainTokenId = String(await contract.tokenByChipHash(input.chipUidHash));
  let numericChainTokenId: bigint;
  try {
    numericChainTokenId = BigInt(chainTokenId);
  } catch {
    throw new Error("polygon_anchor_token_id_invalid");
  }
  if (numericChainTokenId <= 0n) throw new Error("polygon_anchor_token_not_found");
  if (input.tokenId && String(input.tokenId) !== chainTokenId) throw new Error("polygon_anchor_token_mismatch");

  const [actualOwner, actualChipUidHash, actualTokenUri, actualAssetRef] = await Promise.all([
    contract.ownerOf(chainTokenId),
    contract.chipUidHashByTokenId(chainTokenId),
    contract.tokenURI(chainTokenId),
    contract.assetRefByTokenId(chainTokenId),
  ]);
  assertPolygonMintStateMatches({
    expectedRecipient: input.expectedRecipient,
    expectedChipUidHash: input.chipUidHash,
    expectedTokenUri: input.expectedTokenUri,
    expectedAssetRef: input.expectedAssetRef,
    actualOwner,
    actualChipUidHash,
    actualTokenUri,
    actualAssetRef,
  });

  let verificationKind = "on_chain_state_only" as "on_chain_state_only" | "mint_receipt_and_state";
  if (input.txHash) {
    const receipt = await provider.getTransactionReceipt(input.txHash);
    if (!receipt || receipt.status !== 1) throw new Error("polygon_anchor_receipt_not_confirmed");
    if (String(receipt.to || "").toLowerCase() !== contractAddress.toLowerCase()) {
      throw new Error("polygon_anchor_contract_mismatch");
    }
    const expectedMinter = canonicalEvidenceAddress(
      process.env.POLYGON_KMS_PUBLISHER_ADDRESS || process.env.POLYGON_MINTER_ADDRESS,
    );
    if (!expectedMinter || String(receipt.from || "").toLowerCase() !== expectedMinter) {
      throw new Error("polygon_anchor_minter_mismatch");
    }

    const parsedLogs = receipt.logs.flatMap((log) => {
      if (String(log.address || "").toLowerCase() !== contractAddress.toLowerCase()) return [];
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        return parsed ? [parsed] : [];
      } catch {
        return [];
      }
    });
    const transfers = parsedLogs.filter((event) =>
      event.name === "Transfer" && String(event.args.tokenId) === chainTokenId
    );
    const minted = parsedLogs.filter((event) =>
      event.name === "DigitalTwinMinted" && String(event.args.tokenId) === chainTokenId
    );
    if (transfers.length !== 1 || minted.length !== 1) {
      throw new Error("polygon_anchor_mint_events_missing");
    }
    const transfer = transfers[0];
    const mint = minted[0];
    if (
      String(transfer.args.from).toLowerCase() !== ethers.ZeroAddress.toLowerCase()
      || String(transfer.args.to).toLowerCase() !== input.expectedRecipient.toLowerCase()
      || String(mint.args.to).toLowerCase() !== input.expectedRecipient.toLowerCase()
      || String(mint.args.chipUidHash) !== input.chipUidHash
      || String(mint.args.assetRef) !== input.expectedAssetRef
      || String(mint.args.tokenUri) !== input.expectedTokenUri
    ) {
      throw new Error("polygon_anchor_mint_events_mismatch");
    }
    verificationKind = "mint_receipt_and_state";
  }

  return {
    tokenId: chainTokenId,
    chainId: String(providerNetwork.chainId),
    verificationKind,
  };
}

export async function anchorTokenizationRequest(input: AnchorInput) {
  await ensureTokenizationCommercialScopeSchema();

  const tokenizationMode = resolveTokenizationRuntimeMode();
  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) return { ok: false, reason: "tenant_id_required", status: "blocked" } as const;

  const rows = await sql/*sql*/`
    SELECT id, tenant_id, batch_id, tag_id, source_event_id, source_event_created_at,
           bid, uid_hex, execution_class, status, network, issuer_wallet,
           attempt_count, tx_hash, token_id, anchor_hash, external_ref, meta
    FROM tokenization_requests
    WHERE id = ${input.requestId}::uuid
      AND tenant_id = ${tenantId}::uuid
    LIMIT 1
  `;
  const existing = rows[0];
  if (!existing) return { ok: false, reason: "request_not_found" } as const;
  const processor = input.processor || "tokenization_engine";
  const sourceRights = existing.source_event_id
    ? await readCurrentTapCommercialRights(String(existing.source_event_id))
    : { allowed: false as const, reason: "event_not_found" as const, manualOpeningDeclared: false };
  if (!sourceRights.allowed) {
    const currentStatus = String(existing.status || "pending").toLowerCase();
    if (["pending", "failed"].includes(currentStatus)) {
      await sql/*sql*/`
        UPDATE tokenization_requests
        SET status = 'blocked',
            last_error = ${sourceRights.reason},
            next_attempt_at = NULL,
            meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, blocked_by: "source_event_commercial_rights" })}::jsonb
        WHERE id = ${existing.id}::uuid
          AND tenant_id = ${tenantId}::uuid
          AND status IN ('pending', 'failed')
      `;
    }
    return {
      ok: false,
      reason: sourceRights.reason,
      request_id: existing.id,
      status: currentStatus === "anchored" ? "anchored" : "blocked",
      historical_execution: currentStatus === "anchored",
      retryable: false,
    } as const;
  }
  const requestedCanonicalEvent = await recordTokenizationCanonicalEvent({
    request: existing,
    state: "requested",
    runtimeMode: tokenizationMode,
    processor,
  });
  if (!requestedCanonicalEvent.ok) {
    return {
      ok: false,
      reason: requestedCanonicalEvent.reason,
      status: existing.status || "pending",
      request_id: existing.id,
      operation_committed: true,
      canonical_event_confirmed: false,
    } as const;
  }
  const network = String(existing.network || "polygon-amoy").trim().toLowerCase();
  const issuerWallet = existing.issuer_wallet ? String(existing.issuer_wallet).trim() : null;
  const requestedNetworkHint = String(input.network || "").trim().toLowerCase();
  if (requestedNetworkHint && requestedNetworkHint !== network) {
    return {
      ok: false,
      reason: "tokenization_request_network_class_mismatch",
      request_id: existing.id,
      status: "blocked",
    } as const;
  }
  const requestedIssuerHint = String(input.issuerWallet || "").trim().toLowerCase();
  if (requestedIssuerHint && requestedIssuerHint !== String(issuerWallet || "").toLowerCase()) {
    return {
      ok: false,
      reason: "tokenization_request_recipient_mismatch",
      request_id: existing.id,
      status: "blocked",
    } as const;
  }

  // Resolve every non-pending row through the database state machine before
  // looking at the current process mode. A config change to disabled/simulated
  // must never erase an in-flight or uncertain Polygon execution.
  if (String(existing.status || "").toLowerCase() !== "pending") {
    let prepared;
    try {
      prepared = await prepareTokenizationExecution({
        tenantId,
        requestId: String(existing.id),
        leaseId: createTokenizationExecutionLeaseId(),
        processor,
        leaseSeconds: 300,
      });
    } catch (error) {
      const mapped = tokenizationExecutionGovernanceError(error);
      return {
        ok: false,
        reason: mapped.reason,
        request_id: existing.id,
        status: mapped.status === 409 ? "blocked" : "unavailable",
        ...(mapped.requiredMigration ? { required_migration: mapped.requiredMigration } : {}),
      } as const;
    }

    if (prepared.disposition === "already_final") {
      const finalRows = await sql/*sql*/`
        SELECT id, batch_id, bid, execution_class, status, network, tx_hash,
               token_id, anchor_hash, external_ref, meta
        FROM tokenization_requests
        WHERE id = ${existing.id}::uuid
          AND tenant_id = ${tenantId}::uuid
        LIMIT 1
      `;
      const final = finalRows[0];
      if (final?.status !== "anchored") {
        return {
          ok: false,
          reason: "tokenization_execution_already_final",
          request_id: existing.id,
          status: String(final?.status || prepared.status || "blocked"),
          retryable: false,
        } as const;
      }
      const anchoredCanonicalEvent = await recordTokenizationCanonicalEvent({
        request: final,
        state: "anchored",
        runtimeMode: tokenizationMode,
        processor,
      });
      if (!anchoredCanonicalEvent.ok) {
        return {
          ok: false,
          reason: anchoredCanonicalEvent.reason,
          status: "reconciling",
          request_id: existing.id,
          operation_committed: true,
          canonical_event_confirmed: false,
          tx_hash: final.tx_hash || null,
          token_id: final.token_id || null,
          retryable: false,
        } as const;
      }
      return {
        ok: true,
        status: "anchored",
        already_processed: true,
        request_id: existing.id,
        tx_hash: final.tx_hash || null,
        token_id: final.token_id || null,
        network: final.network || network,
        anchor_hash: final.anchor_hash || null,
        external_ref: final.external_ref || null,
        commercial_disposition: prepared.commercialDisposition,
        commercially_eligible: String(prepared.commercialDisposition || "").toUpperCase() === "COMMERCIAL_RELEASE",
        canonical_event_confirmed: true,
        canonical_events: [requestedCanonicalEvent.receipt, anchoredCanonicalEvent.receipt],
      } as const;
    }
    if (prepared.disposition === "simulation_only") {
      if (
        String(existing.status || "").toLowerCase() !== "simulated"
        || prepared.executionClass !== "simulation"
        || prepared.network !== "simulation"
        || existing.tx_hash || existing.token_id || existing.anchor_hash
      ) {
        return {
          ok: false,
          reason: "tokenization_simulation_truth_invalid",
          request_id: existing.id,
          status: "blocked",
          retryable: false,
        } as const;
      }
      const simulatedCanonicalEvent = await recordTokenizationCanonicalEvent({
        request: existing,
        state: "simulated",
        runtimeMode: tokenizationMode,
        processor,
      });
      if (!simulatedCanonicalEvent.ok) {
        return {
          ok: false,
          reason: simulatedCanonicalEvent.reason,
          status: "simulated",
          request_id: existing.id,
          operation_committed: true,
          canonical_event_confirmed: false,
        } as const;
      }
      return {
        ok: true,
        status: "simulated",
        simulated: true,
        already_processed: true,
        request_id: existing.id,
        simulation_ref: existing.external_ref || buildSimulationRef(existing.id, existing.uid_hex),
        tx_hash: null,
        token_id: null,
        network: "simulation",
        canonical_event_confirmed: true,
        canonical_events: [requestedCanonicalEvent.receipt, simulatedCanonicalEvent.receipt],
      } as const;
    }
    if (prepared.disposition === "reconcile_required") {
      return {
        ok: false,
        reason: "tokenization_execution_reconciliation_required",
        request_id: existing.id,
        status: "reconciling",
        retryable: false,
      } as const;
    }
    if (prepared.disposition === "busy" || prepared.disposition === "lease_replay") {
      return {
        ok: false,
        reason: prepared.disposition === "busy"
          ? "tokenization_execution_busy"
          : "tokenization_execution_lease_replay",
        request_id: existing.id,
        status: "processing",
        retryable: false,
      } as const;
    }
    return {
      ok: false,
      reason: "tokenization_execution_state_invalid",
      request_id: existing.id,
      status: "blocked",
      retryable: false,
    } as const;
  }

  if (tokenizationMode === "disabled") {
    const blockedRows = await sql/*sql*/`
      UPDATE tokenization_requests
      SET status = 'blocked',
          last_error = 'tokenization_disabled',
          next_attempt_at = NULL,
          meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, blocked_at: new Date().toISOString(), tokenization_mode: tokenizationMode })}::jsonb
      WHERE id = ${existing.id}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND status = 'pending'
      RETURNING id
    `;
    if (!blockedRows[0]?.id) {
      return { ok: false, reason: "tokenization_execution_state_changed", request_id: existing.id, status: "blocked" } as const;
    }
    return { ok: false, reason: "tokenization_disabled", request_id: existing.id, status: "blocked" } as const;
  }

  let acquiredLeaseId: string | null = null;
  let externalExecutionStarted = false;
  try {
    const chipUidHash = buildChipUidHash(existing.uid_hex);
    const publicAssetId = buildPublicAssetId(chipUidHash);
    const tokenUri = buildTokenMetadataUrl(publicAssetId);
    const assetRef = `${existing.bid}:${publicAssetId}`;
    const externalInput = {
      request_id: existing.id,
      tenant_id: tenantId,
      bid: existing.bid,
      network,
      issuer_wallet: issuerWallet,
      token_uri: tokenUri,
      asset_ref: assetRef,
      chip_uid_hash: chipUidHash,
      public_asset_id: publicAssetId,
      execution_class: "",
      commercial_disposition: "",
      lease_id: "",
      intent_digest: "",
    };

    if (tokenizationMode === "simulated") {
      if (String(existing.execution_class || "").toLowerCase() !== "simulation" || network !== "simulation") {
        return {
          ok: false,
          reason: "tokenization_runtime_execution_class_mismatch",
          request_id: existing.id,
          status: "blocked",
          retryable: false,
        } as const;
      }
      const simulationRef = buildSimulationRef(existing.id, existing.uid_hex);
      const simulatedRows = await sql/*sql*/`
        UPDATE tokenization_requests
        SET status = 'simulated',
            network = 'simulation',
            issuer_wallet = COALESCE(${issuerWallet}, issuer_wallet),
            tx_hash = NULL,
            token_id = NULL,
            anchor_hash = NULL,
            external_ref = ${simulationRef},
            processed_at = now(),
            next_attempt_at = NULL,
            last_error = NULL,
            attempt_count = attempt_count + 1,
            meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, simulated_at: new Date().toISOString(), tokenization_mode: tokenizationMode, simulated: true, target_network: network })}::jsonb
        WHERE id = ${existing.id}::uuid
          AND tenant_id = ${tenantId}::uuid
          AND status = 'pending'
          AND execution_class = 'simulation'
          AND network = 'simulation'
        RETURNING id
      `;
      if (!simulatedRows[0]?.id) {
        return {
          ok: false,
          reason: "tokenization_execution_state_changed",
          request_id: existing.id,
          status: "blocked",
          retryable: false,
        } as const;
      }

      const simulatedRequest = {
        ...existing,
        network: "simulation",
        tx_hash: null,
        token_id: null,
        anchor_hash: null,
      };
      const simulatedCanonicalEvent = await recordTokenizationCanonicalEvent({
        request: simulatedRequest,
        state: "simulated",
        runtimeMode: tokenizationMode,
        processor,
      });
      if (!simulatedCanonicalEvent.ok) {
        return {
          ok: false,
          status: "simulated",
          simulated: true,
          request_id: existing.id,
          simulation_ref: simulationRef,
          tx_hash: null,
          token_id: null,
          network: "simulation",
          operation_committed: true,
          canonical_event_confirmed: false,
          reason: simulatedCanonicalEvent.reason,
        } as const;
      }

      return {
        ok: true,
        status: "simulated",
        simulated: true,
        request_id: existing.id,
        simulation_ref: simulationRef,
        tx_hash: null,
        token_id: null,
        network: "simulation",
        anchor_hash: null,
        canonical_event_confirmed: true,
        canonical_events: [requestedCanonicalEvent.receipt, simulatedCanonicalEvent.receipt],
      } as const;
    }

    if (network !== "polygon-amoy" && network !== "polygon") {
      throw new Error("polygon_anchor_network_mismatch");
    }

    const expectedRecipient = String(issuerWallet || "").trim();
    if (!canonicalEvidenceAddress(expectedRecipient)) {
      throw new Error("polygon_anchor_expected_recipient_invalid");
    }
    externalInput.issuer_wallet = expectedRecipient;

    let parsedTokenUri: URL;
    try {
      parsedTokenUri = new URL(tokenUri);
    } catch {
      throw new Error("polygon_anchor_token_uri_invalid");
    }
    if (
      parsedTokenUri.protocol !== "https:"
      || parsedTokenUri.username
      || parsedTokenUri.password
      || parsedTokenUri.hash
      || !/^sha256:[0-9a-f]{64}$/.test(chipUidHash)
      || !assetRef
    ) {
      throw new Error("polygon_anchor_metadata_binding_invalid");
    }

    const wantsLocalMinter = String(process.env.TOKENIZATION_USE_LOCAL_MINTER || "false").toLowerCase() === "true";
    if (wantsLocalMinter && isProductionRuntime()) {
      throw new Error("polygon_exportable_signer_forbidden_in_production_use_executor");
    }
    if (wantsLocalMinter && !process.env.POLYGON_RPC_URL) {
      throw new Error("missing_POLYGON_RPC_URL_for_local_minter");
    }
    assertPolygonExecutionConfiguration(network);

    const leaseId = createTokenizationExecutionLeaseId();
    let prepared;
    try {
      prepared = await prepareTokenizationExecution({
        tenantId,
        requestId: String(existing.id),
        leaseId,
        processor,
        leaseSeconds: 300,
      });
    } catch (error) {
      const mapped = tokenizationExecutionGovernanceError(error);
      return {
        ok: false,
        reason: mapped.reason,
        request_id: existing.id,
        status: mapped.status === 409 ? "blocked" : "unavailable",
        ...(mapped.requiredMigration ? { required_migration: mapped.requiredMigration } : {}),
      } as const;
    }

    if (
      prepared.network !== network
      || prepared.bid !== String(existing.bid || "")
      || prepared.uidHex.toUpperCase() !== String(existing.uid_hex || "").toUpperCase()
    ) {
      return {
        ok: false,
        reason: "tokenization_execution_governance_unavailable",
        request_id: existing.id,
        status: "unavailable",
      } as const;
    }

    if (prepared.disposition === "already_final") {
      const finalRows = await sql/*sql*/`
        SELECT status, network, tx_hash, token_id, anchor_hash, external_ref
        FROM tokenization_requests
        WHERE id = ${existing.id}::uuid
          AND tenant_id = ${tenantId}::uuid
        LIMIT 1
      `;
      const final = finalRows[0];
      if (final?.status === "anchored") {
        return {
          ok: true,
          status: "anchored",
          already_processed: true,
          request_id: existing.id,
          tx_hash: final.tx_hash || null,
          token_id: final.token_id || null,
          network: final.network || network,
          anchor_hash: final.anchor_hash || null,
          external_ref: final.external_ref || null,
          commercial_disposition: prepared.commercialDisposition,
          commercially_eligible: String(prepared.commercialDisposition || "").toUpperCase() === "COMMERCIAL_RELEASE",
        } as const;
      }
      return {
        ok: false,
        reason: "tokenization_execution_already_final",
        request_id: existing.id,
        status: String(final?.status || prepared.status || "blocked"),
      } as const;
    }
    if (prepared.disposition === "reconcile_required") {
      return {
        ok: false,
        reason: "tokenization_execution_reconciliation_required",
        request_id: existing.id,
        status: "reconciling",
        retryable: false,
      } as const;
    }
    if (prepared.disposition === "busy" || prepared.disposition === "lease_replay") {
      return {
        ok: false,
        reason: prepared.disposition === "busy"
          ? "tokenization_execution_busy"
          : "tokenization_execution_lease_replay",
        request_id: existing.id,
        status: "processing",
        retryable: false,
      } as const;
    }
    if (prepared.disposition === "simulation_only") {
      return {
        ok: false,
        reason: "tokenization_execution_simulation_only",
        request_id: existing.id,
        status: "blocked",
        retryable: false,
      } as const;
    }
    if (prepared.disposition !== "acquired" || !prepared.externalCallAllowed || prepared.leaseId !== leaseId) {
      return {
        ok: false,
        reason: "tokenization_execution_governance_unavailable",
        request_id: existing.id,
        status: "unavailable",
      } as const;
    }

    acquiredLeaseId = leaseId;
    externalInput.execution_class = prepared.executionClass;
    externalInput.commercial_disposition = prepared.commercialDisposition;
    externalInput.lease_id = leaseId;
    const intentDigest = buildPolygonMintIntentDigest({
      requestId: String(existing.id),
      tenantId,
      leaseId,
      network,
      executionClass: prepared.executionClass,
      commercialDisposition: prepared.commercialDisposition,
      issuerWallet: expectedRecipient,
      chipUidHash,
      tokenUri,
      assetRef,
    });
    externalInput.intent_digest = intentDigest;
    const intentRows = await sql/*sql*/`
      UPDATE tokenization_requests
      SET asset_ref = ${assetRef},
          issuer_wallet = ${expectedRecipient},
          meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({
            dispatch_intent_version: POLYGON_MINT_INTENT_VERSION,
            dispatch_intent_digest: intentDigest,
            dispatch_intent_lease_id: leaseId,
            dispatch_intent_bound_at: new Date().toISOString(),
          })}::jsonb
      WHERE id = ${existing.id}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND status = 'processing'
        AND lease_id = ${leaseId}::uuid
        AND lease_expires_at > now()
        AND execution_class = ${prepared.executionClass}
        AND network = ${network}
      RETURNING id
    `;
    if (!intentRows[0]?.id) {
      return {
        ok: false,
        reason: "tokenization_execution_intent_binding_failed",
        request_id: existing.id,
        status: "reconciling",
        retryable: false,
      } as const;
    }
    const productionRuntime = isProductionRuntime();
    externalExecutionStarted = true;
    let external = await runExternalExecutor(externalInput);
    if (productionRuntime && !external) throw new Error("executor_required_in_production");
    const directPolygonMint = !productionRuntime && !external ? await runDirectPolygonMint(externalInput) : null;
    const localPolygonMint = !productionRuntime && !external && !directPolygonMint ? await runLocalPolygonScript(externalInput) : null;
    external = external || directPolygonMint || localPolygonMint;
    if (!external?.tx_hash && !external?.token_id) {
      throw new Error("polygon_anchor_unavailable_configure_local_minter_or_executor");
    }

    const txHash = external?.tx_hash ? String(external.tx_hash) : null;
    const externalTokenId = external?.token_id ? String(external.token_id) : null;
    const broadcastRows = await sql/*sql*/`
      UPDATE tokenization_requests
      SET asset_ref = ${assetRef},
          issuer_wallet = ${expectedRecipient},
          tx_hash = ${txHash},
          token_id = ${externalTokenId},
          next_attempt_at = NULL,
          meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, external_result_received_at: new Date().toISOString(), evidence_verified: false, automatic_resend_forbidden: true, execution_class: prepared.executionClass, commercial_disposition: prepared.commercialDisposition })}::jsonb
      WHERE id = ${existing.id}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND status IN ('processing', 'reconciling')
        AND lease_id = ${acquiredLeaseId}::uuid
      RETURNING id
    `;
    if (!broadcastRows[0]?.id) {
      return {
        ok: false,
        reason: "tokenization_execution_stale_lease",
        request_id: existing.id,
        status: "reconciling",
        retryable: false,
      } as const;
    }
    const verified = await verifyPolygonMintEvidence({
      network,
      chipUidHash,
      expectedRecipient,
      expectedTokenUri: tokenUri,
      expectedAssetRef: assetRef,
      txHash,
      tokenId: externalTokenId,
    }).catch((error) => {
      throw safePolygonAnchorVerificationError(error);
    });
    const tokenId = verified.tokenId;
    const canonicalContract = String(process.env.POLYGON_CONTRACT_ADDRESS || "").trim().toLowerCase();
    const externalRef = `${network}:${verified.chainId}:${canonicalContract}:${tokenId}`;
    const anchorHash = txHash || `sha256:${createHash("sha256")
      .update(`${network}:${verified.chainId}:${canonicalContract}:${tokenId}:${chipUidHash}:${assetRef}`)
      .digest("hex")}`;

    const settledRows = await sql/*sql*/`
      UPDATE tokenization_requests
      SET status = 'anchored',
          network = ${network},
          asset_ref = ${assetRef},
          issuer_wallet = ${expectedRecipient},
          tx_hash = ${txHash},
          token_id = ${tokenId},
          anchor_hash = ${anchorHash},
          external_ref = ${externalRef},
          processed_at = now(),
          last_error = NULL,
          next_attempt_at = NULL,
          attempt_count = attempt_count + 1,
          meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, anchored_at: new Date().toISOString(), tokenization_mode: tokenizationMode, simulated: false, chain_id: verified.chainId, evidence_verified: true, evidence_verification: verified.verificationKind, execution_class: prepared.executionClass, commercial_disposition: prepared.commercialDisposition })}::jsonb
      WHERE id = ${existing.id}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND status IN ('processing', 'reconciling')
        AND lease_id = ${acquiredLeaseId}::uuid
      RETURNING id
    `;
    if (!settledRows[0]?.id) {
      return {
        ok: false,
        reason: "tokenization_execution_stale_lease",
        request_id: existing.id,
        status: "reconciling",
        retryable: false,
      } as const;
    }

    const anchoredRequest = {
      ...existing,
      network,
      execution_class: prepared.executionClass,
      tx_hash: txHash,
      token_id: tokenId,
      anchor_hash: anchorHash,
      meta: { evidence_verified: true, evidence_verification: verified.verificationKind },
    };
    const anchoredCanonicalEvent = await recordTokenizationCanonicalEvent({
      request: anchoredRequest,
      state: "anchored",
      runtimeMode: tokenizationMode,
      processor,
    });
    if (!anchoredCanonicalEvent.ok) {
      return {
        ok: false,
        status: "anchored",
        simulated: false,
        request_id: existing.id,
        tx_hash: txHash,
        token_id: tokenId,
        network,
        anchor_hash: anchorHash,
        commercial_disposition: prepared.commercialDisposition,
        commercially_eligible: String(prepared.commercialDisposition || "").toUpperCase() === "COMMERCIAL_RELEASE",
        operation_committed: true,
        canonical_event_confirmed: false,
        reason: anchoredCanonicalEvent.reason,
      } as const;
    }

    return {
      ok: true,
      status: "anchored",
      simulated: false,
      request_id: existing.id,
      tx_hash: txHash,
      token_id: tokenId,
      network,
      anchor_hash: anchorHash,
      commercial_disposition: prepared.commercialDisposition,
      commercially_eligible: String(prepared.commercialDisposition || "").toUpperCase() === "COMMERCIAL_RELEASE",
      canonical_event_confirmed: true,
      canonical_events: [requestedCanonicalEvent.receipt, anchoredCanonicalEvent.receipt],
    } as const;
  } catch (error) {
    const policy = tokenizationFailurePolicy(
      error,
      externalExecutionStarted ? "external_started" : "pre_external",
    );
    console.error("[tokenization_execution]", policy.reason);

    if (externalExecutionStarted && acquiredLeaseId) {
      try {
        const reconciliationRows = await sql/*sql*/`
          UPDATE tokenization_requests
          SET status = 'reconciling',
              attempt_count = attempt_count + 1,
              last_error = ${policy.reason},
              next_attempt_at = NULL,
              meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, reconciling_at: new Date().toISOString(), automatic_resend_forbidden: true })}::jsonb
          WHERE id = ${existing.id}::uuid
            AND tenant_id = ${tenantId}::uuid
            AND status IN ('processing', 'reconciling')
            AND lease_id = ${acquiredLeaseId}::uuid
          RETURNING id
        `;
        if (!reconciliationRows[0]?.id) {
          console.error("[tokenization_execution_reconciliation]", "lease_cas_lost");
        }
      } catch {
        // The worker selects only expired processing rows so 0072 can move
        // them to reconciliation; it never compensates with a resend.
        console.error("[tokenization_execution_reconciliation]", "persistence_failed");
      }
      return {
        ok: false,
        reason: policy.reason,
        request_id: existing.id,
        status: "reconciling",
        retryable: false,
      } as const;
    }

    try {
      await sql/*sql*/`
        UPDATE tokenization_requests
        SET status = 'blocked',
            last_error = ${policy.reason},
            next_attempt_at = NULL,
            meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, blocked_at: new Date().toISOString(), automatic_resend_forbidden: true })}::jsonb
        WHERE id = ${existing.id}::uuid
          AND tenant_id = ${tenantId}::uuid
          AND status NOT IN ('anchored', 'processing', 'reconciling')
      `;
    } catch {
      console.error("[tokenization_execution_blocked]", "persistence_failed");
    }
    return {
      ok: false,
      reason: policy.reason,
      request_id: existing.id,
      status: "blocked",
      retryable: false,
    } as const;
  }
}

export async function transferBlockchainToken(input: {
  tenantId: string;
  uidHex: string;
  fromWallet?: string | null;
  toWallet: string;
}) {
  const tokenizationMode = resolveTokenizationRuntimeMode();
  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) {
    return {
      ok: false,
      simulated: false,
      state: "failed" as const,
      tx_hash: null,
      token_id: null,
      reason: "tenant_id_required",
    };
  }
  if (tokenizationMode === "disabled") {
    return {
      ok: false,
      simulated: false,
      state: "failed" as const,
      tx_hash: null,
      token_id: null,
      reason: "tokenization_disabled",
    };
  }
  if (tokenizationMode === "simulated") {
    return {
      ok: false,
      simulated: true,
      state: "simulated" as const,
      tx_hash: null,
      token_id: null,
      reason: "polygon_transfer_requires_live_mode",
    };
  }

  // Ownership records are tenant scoped even when the same physical UID was
  // reused by a different sandbox or issuer.
  const rows = await sql/*sql*/`
    SELECT id, bid, uid_hex, status, network, token_id, tx_hash, anchor_hash
    FROM tokenization_requests
    WHERE tenant_id = ${tenantId}::uuid
      AND UPPER(uid_hex) = UPPER(${input.uidHex})
      AND status = 'anchored'
    ORDER BY requested_at DESC
    LIMIT 1
  `;
  const request = rows[0];
  if (!request) {
    return {
      ok: false,
      simulated: false,
      state: "failed" as const,
      tx_hash: null,
      token_id: null,
      reason: "polygon_tokenization_record_not_found",
    };
  }

  const network = request.network || "polygon-amoy";
  const tokenId = request.token_id;
  if (!tokenId) {
    return {
      ok: false,
      simulated: false,
      state: "failed" as const,
      tx_hash: null,
      token_id: null,
      reason: "polygon_token_id_missing",
    };
  }

  if (!String(network).toLowerCase().startsWith("polygon")) {
    return {
      ok: false,
      simulated: false,
      state: "failed" as const,
      tx_hash: null,
      token_id: String(tokenId),
      reason: "polygon_network_mismatch",
    };
  }

  // Polygon mode is fail-closed: a missing signer or failed receipt is never
  // converted into a demo success.
  const rpcUrl = String(process.env.POLYGON_RPC_URL || "").trim();
  const privateKey = normalizePrivateKey(String(process.env.POLYGON_MINTER_PRIVATE_KEY || ""));
  const contractAddress = String(process.env.POLYGON_CONTRACT_ADDRESS || "").trim();
  const managedRecipient = String(process.env.POLYGON_DEFAULT_RECIPIENT || "").trim();

  if (isProductionRuntime()) {
    return {
      ok: false,
      simulated: false,
      state: "failed" as const,
      tx_hash: null,
      token_id: String(tokenId),
      reason: "polygon_exportable_signer_forbidden_in_production_use_executor",
    };
  }

  if (!rpcUrl || !privateKey || !contractAddress) {
    return {
      ok: false,
      simulated: false,
      state: "failed" as const,
      tx_hash: null,
      token_id: String(tokenId),
      reason: "polygon_transfer_signer_unavailable",
    };
  }

  try {
    const { ethers } = await import("ethers");
    if (!ethers.isAddress(contractAddress)) throw new Error("invalid_polygon_contract");
    if (!ethers.isAddress(input.toWallet)) throw new Error("invalid_polygon_recipient");
    if (input.fromWallet && !ethers.isAddress(input.fromWallet)) throw new Error("invalid_polygon_sender");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const TRANSFER_ABI = [
      "function safeTransferFrom(address from, address to, uint256 tokenId) external",
      "function ownerOf(uint256 tokenId) external view returns (address)",
      "function getApproved(uint256 tokenId) external view returns (address)",
      "function isApprovedForAll(address owner, address operator) external view returns (bool)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    ];
    const contract = new ethers.Contract(contractAddress, TRANSFER_ABI, wallet);

    const ownerBefore = String(await contract.ownerOf(tokenId));
    const destination = ethers.getAddress(input.toWallet);
    const normalizedOwner = ethers.getAddress(ownerBefore);
    const custody = managedRecipient && ethers.isAddress(managedRecipient) && destination === ethers.getAddress(managedRecipient)
      ? "platform_managed" as const
      : "buyer_wallet" as const;

    if (input.fromWallet && normalizedOwner !== ethers.getAddress(input.fromWallet)) {
      return {
        ok: false,
        simulated: false,
        state: "failed" as const,
        tx_hash: null,
        token_id: String(tokenId),
        owner_before: normalizedOwner,
        reason: "polygon_owner_mismatch",
      };
    }

    if (normalizedOwner === destination) {
      return {
        ok: true,
        simulated: false,
        state: custody === "platform_managed" ? "custody_unchanged" as const : "already_transferred" as const,
        tx_hash: null,
        token_id: String(tokenId),
        owner_before: normalizedOwner,
        owner_after: normalizedOwner,
        custody,
      };
    }

    const signer = ethers.getAddress(wallet.address);
    const [approved, approvedForAll] = await Promise.all([
      contract.getApproved(tokenId),
      contract.isApprovedForAll(normalizedOwner, signer),
    ]);
    const signerAuthorized = normalizedOwner === signer
      || ethers.getAddress(String(approved)) === signer
      || Boolean(approvedForAll);
    if (!signerAuthorized) {
      return {
        ok: false,
        simulated: false,
        state: "failed" as const,
        tx_hash: null,
        token_id: String(tokenId),
        owner_before: normalizedOwner,
        reason: "polygon_signer_not_authorized",
      };
    }

    const tx = await contract.safeTransferFrom(normalizedOwner, destination, tokenId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("polygon_transfer_receipt_failed");

    const transferEventMatches = receipt.logs.some((log: { topics: readonly string[]; data: string }) => {
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        return Boolean(
          parsed
          && parsed.name === "Transfer"
          && ethers.getAddress(String(parsed.args.from)) === normalizedOwner
          && ethers.getAddress(String(parsed.args.to)) === destination
          && String(parsed.args.tokenId) === String(tokenId)
        );
      } catch {
        return false;
      }
    });
    if (!transferEventMatches) throw new Error("polygon_transfer_event_mismatch");

    const ownerAfter = ethers.getAddress(String(await contract.ownerOf(tokenId)));
    if (ownerAfter !== destination) throw new Error("polygon_transfer_owner_not_updated");

    return {
      ok: true,
      simulated: false,
      state: "confirmed" as const,
      tx_hash: tx.hash,
      token_id: String(tokenId),
      block_number: receipt.blockNumber,
      owner_before: normalizedOwner,
      owner_after: ownerAfter,
      custody,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "polygon_transfer_failed";
    console.error("[polygon_transfer_error]", msg);
    return {
      ok: false,
      simulated: false,
      state: "failed" as const,
      tx_hash: null,
      token_id: String(tokenId),
      reason: "polygon_transfer_not_confirmed",
    };
  }
}
