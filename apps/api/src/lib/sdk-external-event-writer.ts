import { sql, type SqlExecutor } from "./db";
import type { EnterpriseOutboundFields } from "./enterprise-outbound-event";
import type { SdkWebhookOutboxReceipt } from "./sdk-webhook-outbox-guarantee";

export const SDK_EVENT_ATOMIC_OUTBOX_MIGRATION =
  "20260802230000_0088_enterprise_event_profile.sql";

export type AtomicSdkExternalEventInput = {
  tenantId: string;
  apiKeyId: string;
  idempotencyOperationId: string | null;
  bid: string | null;
  uidHex: string | null;
  eventType: string;
  source: string;
  occurredAt: string | null;
  data: Record<string, unknown>;
  traceId: string;
  outbound: EnterpriseOutboundFields;
};

export type AtomicSdkExternalEventResult = {
  eventId: string;
  createdAt: string;
  batchId: string | null;
  tagId: string | null;
  bid: string | null;
  uidHex: string | null;
  eventType: string;
  source: string;
  replayed: boolean;
  webhookOutbox: SdkWebhookOutboxReceipt;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTBOX_EVENT_ID_PATTERN = /^evt_[0-9a-f]{64}$/;

function nullableString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Persists the SDK business event and its tenant webhook outbox in one
 * PostgreSQL function invocation. A rejected statement rolls both writes back;
 * a transport failure is deliberately left unclassified for the outer SDK
 * idempotency state machine to reconcile as an uncertain outcome.
 */
export async function writeSdkExternalEventAtomic(
  input: AtomicSdkExternalEventInput,
  query: SqlExecutor = sql,
): Promise<AtomicSdkExternalEventResult> {
  const payload = {
    tenant_id: input.tenantId,
    api_key_id: input.apiKeyId,
    idempotency_operation_id: input.idempotencyOperationId,
    bid: input.bid,
    uid_hex: input.uidHex,
    event_type: input.eventType,
    source: input.source,
    occurred_at: input.occurredAt,
    data: input.data,
    trace_id: input.traceId,
    outbound: {
      product_id: input.outbound.productId,
      sku: input.outbound.sku,
      lot_number: input.outbound.lotNumber,
      auth_status: input.outbound.authStatus,
      tamper_status: input.outbound.tamperStatus,
      replay_status: input.outbound.replayStatus,
      distributor_id: input.outbound.distributorId,
      campaign_id: input.outbound.campaignId,
      approximate_location: input.outbound.approximateLocation,
      consent_flags: input.outbound.consentFlags,
      connector_profile_code: input.outbound.connectorProfileCode,
      risk_score: input.outbound.risk.riskScore,
      risk_level: input.outbound.risk.riskLevel,
      triggered_rules: input.outbound.risk.triggeredRules,
      recommended_action: input.outbound.risk.recommendedAction,
    },
  };
  const rows = await query/*sql*/`
    SELECT *
    FROM public.nexid_write_sdk_external_event_v1(${JSON.stringify(payload)}::jsonb)
  `;
  if (rows.length !== 1) throw new Error("sdk_external_event_atomic_readback_missing");

  const row = rows[0];
  const eventId = nullableString(row.external_event_id);
  const createdAt = nullableString(row.event_created_at);
  const tenantId = nullableString(row.tenant_id);
  const batchId = nullableString(row.batch_id);
  const tagId = nullableString(row.tag_id);
  const bid = nullableString(row.bid);
  const uidHex = nullableString(row.uid_hex);
  const eventType = nullableString(row.event_type);
  const source = nullableString(row.event_source);
  const outboxEventId = nullableString(row.outbox_event_id);
  const attempted = integer(row.webhook_attempted);
  const queued = integer(row.webhook_queued);
  const deduplicated = integer(row.webhook_deduplicated);

  if (
    !eventId || !UUID_PATTERN.test(eventId)
    || !createdAt || !Number.isFinite(Date.parse(createdAt))
    || tenantId?.toLowerCase() !== input.tenantId.toLowerCase()
    || (batchId !== null && !UUID_PATTERN.test(batchId))
    || (tagId !== null && !UUID_PATTERN.test(tagId))
    || !eventType || eventType !== input.eventType
    || !source || source !== input.source
    || !outboxEventId || !OUTBOX_EVENT_ID_PATTERN.test(outboxEventId)
    || attempted === null || queued === null || deduplicated === null
    || attempted !== queued + deduplicated
  ) {
    throw new Error("sdk_external_event_atomic_readback_invalid");
  }

  return {
    eventId,
    createdAt,
    batchId,
    tagId,
    bid,
    uidHex,
    eventType,
    source,
    replayed: row.replayed === true,
    webhookOutbox: {
      status: attempted > 0 ? "confirmed" : "not_configured",
      eventId: outboxEventId,
      attempted,
      confirmed: attempted,
      queued,
      deduplicated,
    },
  };
}

const BAD_INPUT_REASONS = [
  "sdk_external_event_identity_invalid",
  "sdk_external_event_input_invalid",
  "sdk_external_event_occurred_at_invalid",
  "sdk_external_event_payload_invalid",
  "sdk_external_event_risk_invalid",
  "sdk_external_event_connector_profile_invalid",
  "webhook_outbox_created_at_required",
  "webhook_outbox_data_invalid",
  "webhook_outbox_event_name_invalid",
  "webhook_outbox_idempotency_key_invalid",
];

/**
 * Returns null for transport/connection failures because their commit outcome
 * is unknowable. The caller must let the idempotency layer persist `uncertain`
 * rather than claiming `operationCommitted=false`.
 */
export function sdkExternalEventAtomicError(error: unknown): {
  status: number;
  reason: string;
  operationCommitted: false;
  requiredMigration?: string;
} | null {
  const code = String((error as { code?: unknown })?.code || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  const badInput = BAD_INPUT_REASONS.find((reason) => message.includes(reason));
  if (badInput) return { status: 400, reason: badInput, operationCommitted: false };
  if (message.includes("sdk_external_event_batch_not_found_for_tenant") || message.includes("webhook_outbox_tenant_not_found")) {
    return { status: 404, reason: "batch_not_found_for_tenant", operationCommitted: false };
  }
  if (message.includes("sdk_external_event_api_key_inactive")) {
    return { status: 401, reason: "sdk_api_key_inactive", operationCommitted: false };
  }
  if (message.includes("sdk_external_event_scope_denied")) {
    return { status: 403, reason: "sdk_scope_denied", operationCommitted: false };
  }
  if (
    message.includes("sdk_external_event_idempotency_scope_invalid")
    || message.includes("sdk_external_event_idempotency_not_writable")
    || message.includes("webhook_outbox_idempotency_conflict")
    || code === "23505"
    || code === "40001"
  ) {
    return { status: 409, reason: "sdk_external_event_conflict", operationCommitted: false };
  }
  if (
    code === "42P01"
    || code === "42703"
    || code === "42883"
    || message.includes("nexid_write_sdk_external_event_v1")
    || message.includes("nexid_enqueue_tenant_webhook_outbox_v1")
  ) {
    return {
      status: 503,
      reason: "sdk_event_atomic_outbox_migration_required",
      operationCommitted: false,
      requiredMigration: SDK_EVENT_ATOMIC_OUTBOX_MIGRATION,
    };
  }
  if (code === "42501") {
    return { status: 503, reason: "sdk_event_atomic_outbox_runtime_grant_required", operationCommitted: false };
  }
  return null;
}
