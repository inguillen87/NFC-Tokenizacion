import { sql, sqlSerializable, type SqlExecutor } from "./db";

export const PUBLIC_EXPERIENCE_EVENT_TYPES = [
  "PRODUCT_VIEWED",
  "TECHNICAL_SHEET_VIEWED",
  "SAFETY_SHEET_VIEWED",
  "PPE_CONTENT_VIEWED",
  "STEWARDSHIP_CONFIRMED",
  "CROPWISE_CTA_CLICKED",
  "ADVISOR_CONTACT_REQUESTED",
  "LOYALTY_OFFER_VIEWED",
  "LOYALTY_JOINED",
  "TRAINING_STARTED",
  "TRAINING_COMPLETED",
  "LEAD_CREATED",
  "PROBLEM_REPORTED",
] as const;

export type PublicExperienceEventType = (typeof PUBLIC_EXPERIENCE_EVENT_TYPES)[number];

const EVENT_TYPES = new Set<string>(PUBLIC_EXPERIENCE_EVENT_TYPES);
const SENSITIVE_EVENT_TYPES = new Set<PublicExperienceEventType>([
  "STEWARDSHIP_CONFIRMED",
  "CROPWISE_CTA_CLICKED",
  "ADVISOR_CONTACT_REQUESTED",
  "LOYALTY_OFFER_VIEWED",
  "LOYALTY_JOINED",
  "TRAINING_COMPLETED",
  "LEAD_CREATED",
]);
const PUBLIC_CLIENT_EVENT_TYPES = new Set<PublicExperienceEventType>([
  "PRODUCT_VIEWED",
  "TECHNICAL_SHEET_VIEWED",
  "SAFETY_SHEET_VIEWED",
  "PPE_CONTENT_VIEWED",
  "STEWARDSHIP_CONFIRMED",
  "CROPWISE_CTA_CLICKED",
  "ADVISOR_CONTACT_REQUESTED",
  "LOYALTY_OFFER_VIEWED",
  "TRAINING_STARTED",
  "PROBLEM_REPORTED",
]);
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const SAFE_DATA_KEYS = new Set([
  "surface",
  "placement",
  "ctaLabel",
  "destinationHost",
  "trainingStep",
  "locale",
  "sourceCarrier",
  "profileVersion",
]);
const BLOCKED_TRUST_STATES = new Set([
  "REPLAY_SUSPECT",
  "SUN_PROFILE_MISMATCH",
  "NOT_REGISTERED",
  "NOT_ACTIVE",
]);
const TRUSTED_NFC_STATES = new Set([
  "VALID",
  "VALID_AUTHENTIC",
  "VALID_CLOSED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_UNKNOWN_TAMPER",
]);
const TRUSTED_VERDICTS = new Set(["VALID", "VALID_OPENED"]);

export type PublicExperienceContext = {
  eventId: string;
  tenantId: string;
  batchId: string;
  tagId: string | null;
  bid: string;
  result: string;
  verdict: string;
  riskLevel: string;
  reason: string;
  productState: string;
};

function clean(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizePublicExperienceEventType(value: unknown): PublicExperienceEventType | null {
  const normalized = clean(value, 80).toUpperCase();
  return EVENT_TYPES.has(normalized) ? normalized as PublicExperienceEventType : null;
}

export function normalizePublicExperienceIdempotencyKey(value: unknown) {
  const normalized = clean(value, 128);
  return IDEMPOTENCY_KEY_RE.test(normalized) ? normalized : null;
}

export function sanitizePublicExperienceData(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!SAFE_DATA_KEYS.has(key)) continue;
    if (typeof raw === "boolean") result[key] = raw;
    else if (typeof raw === "number" && Number.isFinite(raw)) result[key] = Math.max(-1_000_000, Math.min(1_000_000, raw));
    else {
      const normalized = clean(raw, 240);
      if (normalized) result[key] = normalized;
    }
  }
  return result;
}

export function isSensitivePublicExperienceEvent(eventType: PublicExperienceEventType) {
  return SENSITIVE_EVENT_TYPES.has(eventType);
}

export function isPublicClientExperienceEvent(eventType: PublicExperienceEventType) {
  return PUBLIC_CLIENT_EVENT_TYPES.has(eventType);
}

export function isPublicExperienceContextBlocked(context: Pick<PublicExperienceContext, "result" | "verdict" | "riskLevel" | "reason" | "productState">) {
  const states = [context.result, context.verdict, context.reason, context.productState]
    .map((value) => clean(value, 200).toUpperCase());
  if (states.some((state) => BLOCKED_TRUST_STATES.has(state) || Array.from(BLOCKED_TRUST_STATES).some((blocked) => state.includes(blocked)))) return true;
  if (["HIGH", "CRITICAL"].includes(clean(context.riskLevel, 40).toUpperCase())) return true;
  const result = clean(context.result, 80).toUpperCase();
  const productState = clean(context.productState, 80).toUpperCase();
  const verdict = clean(context.verdict, 80).toUpperCase();
  return !TRUSTED_NFC_STATES.has(result) && !TRUSTED_NFC_STATES.has(productState)
    || !TRUSTED_VERDICTS.has(verdict);
}

export async function loadPublicExperienceContext(
  eventId: string,
  tenantId: string,
  query: SqlExecutor = sql,
): Promise<PublicExperienceContext | null> {
  const rows = await query/*sql*/`
    SELECT e.id::text AS event_id, e.tenant_id::text AS tenant_id,
      e.batch_id::text AS batch_id, e.tag_id::text AS tag_id, b.bid,
      COALESCE(e.result::text, '') AS result,
      COALESCE(e.verdict::text, '') AS verdict,
      COALESCE(e.risk_level::text, '') AS risk_level,
      COALESCE(e.reason::text, '') AS reason,
      COALESCE(e.meta->>'product_state', e.meta->'sun_atomic'->>'product_state', '') AS product_state
    FROM events e
    JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
    WHERE e.id = ${eventId}::bigint
      AND e.tenant_id = ${tenantId}::uuid
    LIMIT 1
  ` as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;
  return {
    eventId: String(row.event_id),
    tenantId: String(row.tenant_id),
    batchId: String(row.batch_id),
    tagId: row.tag_id ? String(row.tag_id) : null,
    bid: String(row.bid),
    result: String(row.result || ""),
    verdict: String(row.verdict || ""),
    riskLevel: String(row.risk_level || ""),
    reason: String(row.reason || ""),
    productState: String(row.product_state || ""),
  };
}

export async function recordPublicExperienceEvent(input: {
  context: PublicExperienceContext;
  eventType: PublicExperienceEventType;
  idempotencyKey: string;
  data: Record<string, string | number | boolean>;
  traceId: string;
}, query: SqlExecutor = sqlSerializable) {
  const persistedData = {
    ...input.data,
    publicIdempotencyKey: input.idempotencyKey,
    sourceTapEventId: input.context.eventId,
    traceId: clean(input.traceId, 160),
  };
  const rows = await query/*sql*/`
    WITH lock_key AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${input.context.tenantId}:${input.idempotencyKey}`}, 0)
      )
    ), existing AS MATERIALIZED (
      SELECT external_event.id::text AS id, external_event.created_at::text AS created_at,
        external_event.event_type, external_event.data->>'sourceTapEventId' AS source_tap_event_id
      FROM sdk_external_events external_event
      CROSS JOIN lock_key
      WHERE external_event.tenant_id = ${input.context.tenantId}::uuid
        AND external_event.source = 'public_passport'
        AND external_event.data->>'publicIdempotencyKey' = ${input.idempotencyKey}
      ORDER BY external_event.created_at ASC, external_event.id ASC
      LIMIT 1
    ), inserted AS (
      INSERT INTO sdk_external_events (
        tenant_id, api_key_id, batch_id, tag_id, bid, uid_hex,
        event_type, source, occurred_at, data
      )
      SELECT ${input.context.tenantId}::uuid, NULL, ${input.context.batchId}::uuid,
        ${input.context.tagId}::uuid, ${input.context.bid}, NULL,
        ${input.eventType}, 'public_passport', now(), ${JSON.stringify(persistedData)}::jsonb
      FROM lock_key
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING id::text AS id, created_at::text AS created_at
    )
    SELECT inserted.id, inserted.created_at, false AS replayed, false AS conflict FROM inserted
    UNION ALL
    SELECT existing.id, existing.created_at, true AS replayed,
      (existing.event_type <> ${input.eventType} OR existing.source_tap_event_id <> ${input.context.eventId}) AS conflict
    FROM existing
    LIMIT 1
  ` as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row?.id || !row.created_at) throw new Error("public_experience_event_write_failed");
  if (row.conflict === true) throw new Error("public_experience_event_idempotency_conflict");
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    replayed: row.replayed === true,
  };
}
