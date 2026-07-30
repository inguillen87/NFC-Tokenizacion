import { randomUUID } from "node:crypto";
import { sql, type SqlExecutor } from "./db";
import type {
  TokenizationExecutionClass,
  TokenizationExecutionDisposition,
} from "./tokenization-execution-policy";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TESTNET_NETWORKS = new Set(["polygon-amoy", "ethereum-sepolia", "base-sepolia"]);
const MAINNET_NETWORKS = new Set(["polygon", "ethereum-mainnet", "base-mainnet"]);
const HISTORICAL_PROOF_DISPOSITIONS = new Set([
  "REVOKED_HISTORICAL_PROOF",
  "HISTORICAL_PROOF_NOT_CURRENTLY_SELLABLE",
]);
const EXECUTION_CLASSES = new Set<TokenizationExecutionClass>([
  "legacy_unclassified",
  "simulation",
  "testnet_trial",
  "live_chain",
]);
const DISPOSITIONS = new Set<TokenizationExecutionDisposition>([
  "acquired",
  "lease_replay",
  "busy",
  "reconcile_required",
  "already_final",
  "simulation_only",
]);

export type PrepareTokenizationExecutionInput = {
  tenantId: string;
  requestId: string;
  leaseId: string;
  processor: string;
  leaseSeconds?: number;
};

export type PreparedTokenizationExecution = {
  requestId: string;
  tenantId: string;
  disposition: TokenizationExecutionDisposition;
  executionClass: TokenizationExecutionClass;
  network: string;
  status: string;
  leaseId: string | null;
  leaseExpiresAt: string | null;
  batchId: string | null;
  tagId: string | null;
  bid: string;
  uidHex: string;
  sourceEventId: string | null;
  sourceEventCreatedAt: string | null;
  commercialDisposition: string;
  externalCallAllowed: boolean;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function nullableClean(value: unknown) {
  const result = clean(value);
  return result || null;
}

function validLeaseSeconds(value: unknown) {
  const parsed = Number(value ?? 120);
  // Keep this contract identical to the database function. A value accepted by
  // the application must never be rejected only after the atomic prepare call.
  return Number.isSafeInteger(parsed) && parsed >= 30 && parsed <= 300 ? parsed : 120;
}

function assertAuthoritativeNetworkClass(
  executionClass: TokenizationExecutionClass,
  network: string,
  commercialDisposition: string,
  disposition: TokenizationExecutionDisposition,
  status: string,
) {
  const historicalProofOnly = disposition === "already_final"
    && status === "anchored"
    && HISTORICAL_PROOF_DISPOSITIONS.has(commercialDisposition);
  if (HISTORICAL_PROOF_DISPOSITIONS.has(commercialDisposition) && !historicalProofOnly) {
    throw new Error("tokenization_execution_prepare_readback_invalid");
  }
  if (executionClass === "testnet_trial") {
    if (
      !TESTNET_NETWORKS.has(network)
      || (commercialDisposition !== "NON_SELLABLE" && !historicalProofOnly)
    ) {
      throw new Error("tokenization_execution_prepare_readback_invalid");
    }
    return;
  }
  if (executionClass === "live_chain") {
    if (
      !MAINNET_NETWORKS.has(network)
      || (commercialDisposition !== "COMMERCIAL_RELEASE" && !historicalProofOnly)
    ) {
      throw new Error("tokenization_execution_prepare_readback_invalid");
    }
    return;
  }
  if (executionClass === "simulation") {
    if (network !== "simulation" || commercialDisposition !== "NON_SELLABLE") {
      throw new Error("tokenization_execution_prepare_readback_invalid");
    }
  }
}

export function createTokenizationExecutionLeaseId() {
  return randomUUID();
}

export async function prepareTokenizationExecution(
  input: PrepareTokenizationExecutionInput,
  query: SqlExecutor = sql,
): Promise<PreparedTokenizationExecution> {
  const processor = clean(input.processor);
  if (
    !UUID_PATTERN.test(input.tenantId)
    || !UUID_PATTERN.test(input.requestId)
    || !UUID_PATTERN.test(input.leaseId)
    || processor.length < 3
    || processor.length > 100
  ) {
    throw new Error("tokenization_execution_prepare_input_invalid");
  }

  const rows = await query/*sql*/`
    SELECT *
    FROM public.nexid_prepare_tokenization_execution_v1(
      ${input.tenantId}::uuid,
      ${input.requestId}::uuid,
      ${input.leaseId}::uuid,
      ${processor}::text,
      ${validLeaseSeconds(input.leaseSeconds)}::integer
    )
  `;
  const row = rows[0];
  const requestId = clean(row?.request_id).toLowerCase();
  const tenantId = clean(row?.tenant_id).toLowerCase();
  const disposition = clean(row?.disposition).toLowerCase() as TokenizationExecutionDisposition;
  const executionClass = clean(row?.execution_class).toLowerCase() as TokenizationExecutionClass;
  const network = clean(row?.network).toLowerCase();
  const status = clean(row?.status).toLowerCase();
  const leaseId = nullableClean(row?.lease_id)?.toLowerCase() || null;
  const leaseExpiresAt = nullableClean(row?.lease_expires_at);
  const commercialDisposition = clean(row?.commercial_disposition).toUpperCase();
  const externalCallAllowed = row?.external_call_allowed;

  if (
    !row
    || requestId !== input.requestId.toLowerCase()
    || tenantId !== input.tenantId.toLowerCase()
    || !DISPOSITIONS.has(disposition)
    || !EXECUTION_CLASSES.has(executionClass)
    || !network
    || !status
    || typeof externalCallAllowed !== "boolean"
    || (leaseId !== null && !UUID_PATTERN.test(leaseId))
  ) {
    throw new Error("tokenization_execution_prepare_readback_invalid");
  }

  assertAuthoritativeNetworkClass(
    executionClass,
    network,
    commercialDisposition,
    disposition,
    status,
  );
  if (disposition === "acquired") {
    if (
      externalCallAllowed !== true
      || leaseId !== input.leaseId.toLowerCase()
      || !leaseExpiresAt
      || !Number.isFinite(Date.parse(leaseExpiresAt))
      || Date.parse(leaseExpiresAt) <= Date.now()
      || !commercialDisposition
      || !new Set<TokenizationExecutionClass>(["testnet_trial", "live_chain"]).has(executionClass)
    ) {
      throw new Error("tokenization_execution_prepare_readback_invalid");
    }
  } else if (externalCallAllowed !== false) {
    throw new Error("tokenization_execution_prepare_readback_invalid");
  }

  return {
    requestId,
    tenantId,
    disposition,
    executionClass,
    network,
    status,
    leaseId,
    leaseExpiresAt,
    batchId: nullableClean(row.batch_id)?.toLowerCase() || null,
    tagId: nullableClean(row.tag_id)?.toLowerCase() || null,
    bid: clean(row.bid),
    uidHex: clean(row.uid_hex),
    sourceEventId: nullableClean(row.source_event_id),
    sourceEventCreatedAt: nullableClean(row.source_event_created_at),
    commercialDisposition,
    externalCallAllowed,
  };
}
