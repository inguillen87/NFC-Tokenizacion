import { sql } from "./db";
import { normalizeCoordinatePair, redactSensitiveQueryValues } from "./approximate-location";

export type SunAtomicPersistenceInput = {
  tenantId: string;
  tenantSlug?: string | null;
  batchId: string;
  bid: string;
  resolvedUidHex?: string | null;
  resolvedCtr?: number | null;
  registeredTagId?: string | null;
  registeredTagStatus?: string | null;
  cryptographicVerification: boolean;
  payloadVerified: boolean;
  supplierPayloadMatch: boolean;
  supplierPayloadOnly: boolean;
  preRegistryResult?: string | null;
  forceResult?: string | null;
  reasonIfNotReplay?: string | null;
  source?: "real" | "demo" | "imported";
  userAgent?: string | null;
  city?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  ip?: string | null;
  geoCity?: string | null;
  geoCountry?: string | null;
  deviceLabel?: string | null;
  productName?: string | null;
  piccDataHash: string;
  encHash: string;
  cmacHash: string;
  rawUrlHash: string;
  meta?: Record<string, unknown>;
  rawQuery?: Record<string, unknown>;
};

export type SunAtomicPersistenceResult = {
  eventId: number;
  finalResult: string;
  authStatus: string;
  finalReason: string | null;
  replaySuspect: boolean;
  replayOriginalEventId: number | null;
  allowlisted: boolean;
  tagId: string | null;
  tagStatus: string | null;
  previousLastSeenCtr: number | null;
  lastSeenCtr: number | null;
  scanCount: number | null;
  eventType: string;
  verdict: string;
  riskLevel: string;
  createdAt: string;
};

function requiredPositiveSafeInteger(value: unknown, reason: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(reason);
  return parsed;
}

function nullableSafeInteger(value: unknown, reason: string) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(reason);
  return parsed;
}

function requiredText(value: unknown, reason: string) {
  const parsed = String(value || "").trim();
  if (!parsed) throw new Error(reason);
  return parsed;
}

function nullableText(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = String(value).trim();
  return parsed || null;
}

export async function persistSunScanAtomically(
  input: SunAtomicPersistenceInput,
): Promise<SunAtomicPersistenceResult> {
  const coordinate = normalizeCoordinatePair(input.lat, input.lng);
  const persistedRawQuery = redactSensitiveQueryValues(input.rawQuery);
  const envelope = {
    version: 1,
    tenant_id: input.tenantId,
    tenant_slug: input.tenantSlug || null,
    batch_id: input.batchId,
    bid: input.bid,
    resolved_uid_hex: input.resolvedUidHex || null,
    resolved_ctr: input.resolvedCtr ?? null,
    registered_tag_id: input.registeredTagId || null,
    registered_tag_status: input.registeredTagStatus || null,
    cryptographic_verification: input.cryptographicVerification,
    payload_verified: input.payloadVerified,
    supplier_payload_match: input.supplierPayloadMatch,
    supplier_payload_only: input.supplierPayloadOnly,
    pre_registry_result: input.preRegistryResult || null,
    force_result: input.forceResult || null,
    reason_if_not_replay: input.reasonIfNotReplay || null,
    source: input.source || "real",
    user_agent: input.userAgent || null,
    city: input.city || null,
    country_code: input.countryCode || null,
    lat: coordinate?.lat ?? null,
    lng: coordinate?.lng ?? null,
    ip: input.ip || null,
    geo_city: input.geoCity || null,
    geo_country: input.geoCountry || null,
    device_label: input.deviceLabel || null,
    product_name: input.productName || null,
    picc_data_hash: input.piccDataHash,
    enc_hash: input.encHash,
    cmac_hash: input.cmacHash,
    raw_url_hash: input.rawUrlHash,
    meta: input.meta || {},
    raw_query: persistedRawQuery,
  };

  // One SQL statement owns every canonical SUN state transition. Do not add a
  // best-effort fallback here: a missing function or failed commit must reject
  // the persistent scan so a tag counter can never advance without its event.
  const rows = await sql/*sql*/`
    SELECT *
    FROM public.nexid_persist_sun_scan_v1(${JSON.stringify(envelope)}::jsonb)
  `;
  if (rows.length !== 1) throw new Error("sun_atomic_persistence_receipt_missing");

  const row = rows[0] as Record<string, unknown>;
  const eventId = requiredPositiveSafeInteger(row.event_id, "sun_atomic_event_id_invalid");
  const replayOriginalEventId = nullableSafeInteger(
    row.replay_original_event_id,
    "sun_atomic_replay_event_id_invalid",
  );
  const previousLastSeenCtr = nullableSafeInteger(
    row.previous_last_seen_ctr,
    "sun_atomic_previous_counter_invalid",
  );
  const lastSeenCtr = nullableSafeInteger(row.last_seen_ctr, "sun_atomic_counter_invalid");
  const scanCount = nullableSafeInteger(row.scan_count, "sun_atomic_scan_count_invalid");

  if (typeof row.replay_suspect !== "boolean" || typeof row.allowlisted !== "boolean") {
    throw new Error("sun_atomic_boolean_receipt_invalid");
  }

  return {
    eventId,
    finalResult: requiredText(row.final_result, "sun_atomic_result_invalid"),
    authStatus: requiredText(row.auth_status, "sun_atomic_auth_status_invalid"),
    finalReason: nullableText(row.final_reason),
    replaySuspect: row.replay_suspect,
    replayOriginalEventId,
    allowlisted: row.allowlisted,
    tagId: nullableText(row.tag_id),
    tagStatus: nullableText(row.tag_status),
    previousLastSeenCtr,
    lastSeenCtr,
    scanCount,
    eventType: requiredText(row.event_type, "sun_atomic_event_type_invalid"),
    verdict: requiredText(row.verdict, "sun_atomic_verdict_invalid"),
    riskLevel: requiredText(row.risk_level, "sun_atomic_risk_level_invalid"),
    createdAt: requiredText(row.created_at, "sun_atomic_created_at_invalid"),
  };
}
