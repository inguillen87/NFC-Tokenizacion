import { createHash } from "node:crypto";

import { normalizeCoordinatePair } from "./approximate-location";
import { sql } from "./db";
import { findForbiddenProofPayloadKey, stableJson } from "./proof-layer";
import { publishRealtimeEvent } from "./realtime-events";

export const CANONICAL_EVENT_NAMES = [
  "demo.tap.simulated",
  "ownership.activated",
  "provenance.viewed",
  "tokenization.anchored",
  "tokenization.requested",
  "tokenization.simulated",
  "warranty.review_requested",
] as const;

export type CanonicalEventName = (typeof CANONICAL_EVENT_NAMES)[number];
export type CanonicalEventMode = "live" | "demo" | "simulated";
export type CanonicalEventFamily = "tap" | "lifecycle";
export type CanonicalEventVerdict =
  | "valid"
  | "invalid"
  | "replay_suspect"
  | "blocked_replay"
  | "revoked"
  | "broken"
  | "tampered"
  | "unknown_batch"
  | "not_registered"
  | "not_active";
export type CanonicalEventRisk = "none" | "low" | "medium" | "high" | "critical";

export type CanonicalEventReceipt = {
  canonicalOperationId: string;
  eventId: number;
  eventCreatedAt: string;
  tenantId: string;
  batchId: string;
  tagId: string | null;
  bid: string;
  eventName: CanonicalEventName;
  eventMode: CanonicalEventMode;
  replayed: boolean;
  webhookOutbox: {
    attempted: number;
    queued: number;
    deduplicated: number;
    confirmed: number;
  };
};

export type CanonicalEventInput = {
  operationKey: string;
  eventName: CanonicalEventName;
  mode: CanonicalEventMode;
  family: CanonicalEventFamily;
  referenceEventId?: number | string | null;
  referenceEventCreatedAt?: string | Date | null;
  batchId?: string | null;
  uidHex?: string | null;
  eventType: string;
  result: string;
  verdict: CanonicalEventVerdict;
  riskLevel: CanonicalEventRisk;
  reason?: string | null;
  readCounter?: number | null;
  sdmReadCtr?: number | null;
  cmacOk?: boolean | null;
  allowlisted?: boolean | null;
  userAgent?: string | null;
  city?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  geoPrecision?: "none" | "ip" | "browser_rounded" | "browser_exact";
  productName?: string | null;
  piccDataHash?: string | null;
  cmacHash?: string | null;
  rawUrlHash?: string | null;
  ipHash?: string | null;
  deviceLabel?: string | null;
  rawQuery?: Record<string, unknown> | null;
  meta?: Record<string, unknown>;
  webhookData?: Record<string, unknown>;
};

const EVENT_NAME_SET = new Set<string>(CANONICAL_EVENT_NAMES);
const OPERATION_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,254}$/;

export class CanonicalEventWriteError extends Error {
  readonly code: string;
  readonly causeDetail?: unknown;

  constructor(code: string, causeDetail?: unknown) {
    super(code);
    this.name = "CanonicalEventWriteError";
    this.code = code;
    this.causeDetail = causeDetail;
  }
}

function bounded(value: unknown, maximum: number) {
  return String(value || "").trim().slice(0, maximum);
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function canonicalEventRequestFingerprint(input: CanonicalEventInput) {
  // Trace ids and diagnostic metadata are intentionally excluded. An exact
  // operation replay may arrive through another HTTP request while retaining
  // the same business semantics.
  const stableMeta = { ...(input.meta || {}) };
  delete stableMeta.trace_id;
  delete stableMeta.traceId;
  const semanticPayload = {
    operationKey: input.operationKey,
    eventName: input.eventName,
    mode: input.mode,
    family: input.family,
    referenceEventId: input.referenceEventId ? String(input.referenceEventId) : null,
    referenceEventCreatedAt: input.referenceEventCreatedAt
      ? new Date(input.referenceEventCreatedAt).toISOString()
      : null,
    batchId: input.batchId || null,
    uidHex: bounded(input.uidHex, 128).toUpperCase() || null,
    eventType: input.eventType,
    result: input.result,
    verdict: input.verdict,
    riskLevel: input.riskLevel,
    reason: input.reason || null,
    readCounter: input.readCounter ?? null,
    sdmReadCtr: input.sdmReadCtr ?? input.readCounter ?? null,
    cmacOk: input.cmacOk ?? null,
    allowlisted: input.allowlisted ?? null,
    userAgent: input.userAgent || null,
    city: input.city || null,
    countryCode: input.countryCode || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    geoPrecision: input.geoPrecision || "none",
    productName: input.productName || null,
    piccDataHash: input.piccDataHash || null,
    cmacHash: input.cmacHash || null,
    rawUrlHash: input.rawUrlHash || null,
    ipHash: input.ipHash || null,
    deviceLabel: input.deviceLabel || null,
    rawQuery: input.rawQuery || null,
    meta: stableMeta,
    webhookData: input.webhookData || {},
  };
  return createHash("sha256").update(stableJson(semanticPayload), "utf8").digest("hex");
}

function validateInput(input: CanonicalEventInput) {
  if (!OPERATION_KEY_RE.test(input.operationKey)) throw new CanonicalEventWriteError("canonical_event_operation_key_invalid");
  if (!EVENT_NAME_SET.has(input.eventName)) throw new CanonicalEventWriteError("canonical_event_name_invalid");
  const referenceEventId = input.referenceEventId == null ? null : positiveInteger(input.referenceEventId);
  let referenceEventCreatedAt: string | null = null;
  if (input.referenceEventCreatedAt != null) {
    const parsed = new Date(input.referenceEventCreatedAt);
    if (!Number.isFinite(parsed.getTime())) throw new CanonicalEventWriteError("canonical_event_reference_created_at_invalid");
    referenceEventCreatedAt = parsed.toISOString();
  }
  const batchId = bounded(input.batchId, 64) || null;
  if (!referenceEventId && !batchId) throw new CanonicalEventWriteError("canonical_event_server_reference_required");
  if (input.referenceEventId != null && !referenceEventId) throw new CanonicalEventWriteError("canonical_event_reference_event_invalid");
  const eventType = bounded(input.eventType, 80).toUpperCase();
  const result = bounded(input.result, 80).toUpperCase();
  if (!eventType || !result) throw new CanonicalEventWriteError("canonical_event_type_invalid");
  const webhookData = input.webhookData || {};
  const forbiddenWebhookKey = findForbiddenProofPayloadKey(webhookData);
  if (forbiddenWebhookKey) {
    throw new CanonicalEventWriteError(`canonical_event_webhook_forbidden_key:${forbiddenWebhookKey}`);
  }
  if (Buffer.byteLength(JSON.stringify(webhookData), "utf8") > 32 * 1024) {
    throw new CanonicalEventWriteError("canonical_event_webhook_payload_too_large");
  }
  const meta = input.meta || {};
  if (Buffer.byteLength(JSON.stringify(meta), "utf8") > 64 * 1024) {
    throw new CanonicalEventWriteError("canonical_event_meta_too_large");
  }
  const coordinate = normalizeCoordinatePair(input.lat, input.lng);
  if ((input.lat != null || input.lng != null) && !coordinate) {
    throw new CanonicalEventWriteError("canonical_event_coordinates_invalid");
  }
  const rawQuery = input.rawQuery || null;
  if (rawQuery && (Array.isArray(rawQuery) || Buffer.byteLength(JSON.stringify(rawQuery), "utf8") > 32 * 1024)) {
    throw new CanonicalEventWriteError("canonical_event_raw_query_invalid");
  }
  return { referenceEventId, referenceEventCreatedAt, batchId, eventType, result, webhookData, meta, coordinate, rawQuery };
}

export async function writeCanonicalEvent(input: CanonicalEventInput): Promise<CanonicalEventReceipt> {
  const validated = validateInput(input);
  const dbPayload = {
    operation_key: input.operationKey,
    request_fingerprint: canonicalEventRequestFingerprint(input),
    event_name: input.eventName,
    event_mode: input.mode,
    event_family: input.family,
    reference_event_id: validated.referenceEventId,
    reference_event_created_at: validated.referenceEventCreatedAt,
    batch_id: validated.batchId,
    uid_hex: bounded(input.uidHex, 128).toUpperCase() || null,
    event_type: validated.eventType,
    result: validated.result,
    verdict: input.verdict,
    risk_level: input.riskLevel,
    reason: bounded(input.reason, 500) || null,
    read_counter: input.readCounter ?? null,
    sdm_read_ctr: input.sdmReadCtr ?? input.readCounter ?? null,
    cmac_ok: input.cmacOk ?? null,
    allowlisted: input.allowlisted ?? null,
    user_agent: bounded(input.userAgent, 512) || null,
    city: bounded(input.city, 120) || null,
    country_code: bounded(input.countryCode, 3).toUpperCase() || null,
    lat: validated.coordinate?.lat ?? null,
    lng: validated.coordinate?.lng ?? null,
    geo_precision: input.geoPrecision || "none",
    product_name: bounded(input.productName, 240) || null,
    picc_data_hash: bounded(input.piccDataHash, 160) || null,
    cmac_hash: bounded(input.cmacHash, 160) || null,
    raw_url_hash: bounded(input.rawUrlHash, 160) || null,
    ip_hash: bounded(input.ipHash, 160) || null,
    device_label: bounded(input.deviceLabel, 160) || null,
    raw_query: validated.rawQuery,
    meta: validated.meta,
    webhook_data: validated.webhookData,
  };

  let rows: Array<Record<string, unknown>>;
  try {
    rows = await sql/*sql*/`
      SELECT *
      FROM nexid_write_canonical_event_v1(${JSON.stringify(dbPayload)}::jsonb)
    ` as Array<Record<string, unknown>>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "canonical_event_write_failed";
    const known = message.match(/canonical_event_[a-z0-9_:.-]+/i)?.[0]?.toLowerCase();
    throw new CanonicalEventWriteError(known || "canonical_event_write_unavailable", error);
  }

  const row = rows[0];
  const eventId = positiveInteger(row?.event_id);
  const canonicalOperationId = bounded(row?.canonical_operation_id, 64);
  const tenantId = bounded(row?.tenant_id, 64);
  const batchId = bounded(row?.batch_id, 64);
  const bid = bounded(row?.bid, 160);
  const eventCreatedAt = bounded(row?.event_created_at, 80);
  if (!row || !eventId || !canonicalOperationId || !tenantId || !batchId || !bid || !eventCreatedAt) {
    throw new CanonicalEventWriteError("canonical_event_receipt_invalid");
  }

  const attempted = Number(row.webhook_attempted || 0);
  const queued = Number(row.webhook_queued || 0);
  const deduplicated = Number(row.webhook_deduplicated || 0);
  const receipt: CanonicalEventReceipt = {
    canonicalOperationId,
    eventId,
    eventCreatedAt,
    tenantId,
    batchId,
    tagId: bounded(row.tag_id, 64) || null,
    bid,
    eventName: input.eventName,
    eventMode: input.mode,
    replayed: Boolean(row.replayed),
    webhookOutbox: {
      attempted,
      queued,
      deduplicated,
      confirmed: queued + deduplicated,
    },
  };

  if (!receipt.replayed) {
    publishRealtimeEvent({
      id: receipt.eventId,
      tenant_id: receipt.tenantId,
      batch_id: receipt.batchId,
      tag_id: receipt.tagId || undefined,
      bid: receipt.bid,
      result: validated.result,
      verdict: input.verdict,
      risk_level: input.riskLevel,
      source: input.mode === "live" ? (input.family === "tap" ? "real" : "imported") : "demo",
      event_type: validated.eventType,
      created_at: receipt.eventCreatedAt,
      meta: {
        canonical_event_name: input.eventName,
        event_mode: input.mode,
        simulated: input.mode !== "live",
      },
    });
  }

  return receipt;
}
