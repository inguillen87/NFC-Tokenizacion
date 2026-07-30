import { createHash } from "node:crypto";

import { evaluateSecurityAlerts } from "./alert-engine";
import { normalizeCoordinatePair, redactSensitiveQueryValues } from "./approximate-location";
import { writeCanonicalEvent } from "./canonical-event-writer";

export type TapEventPayload = {
  tenantId?: string | null;
  tenantSlug?: string | null;
  batchId?: string | null;
  tagId?: string | null;
  uidHex?: string | null;
  bid?: string | null;
  source: "real" | "demo" | "imported" | "sun" | "demo_simulation" | "admin_manual" | "mobile_action" | "tokenization" | "warranty" | "ownership";
  eventType: "TAP_VALID" | "TAP_INVALID" | "REPLAY_SUSPECT" | "UNKNOWN_BATCH" | "NOT_REGISTERED" | "NOT_ACTIVE" | "REVOKED" | "BROKEN" | "TAMPERED" | "OWNERSHIP_ACTIVATED" | "WARRANTY_REGISTERED" | "PROVENANCE_VIEWED" | "TOKENIZATION_REQUESTED" | "TOKENIZATION_SIMULATED" | "TOKENIZATION_ANCHORED" | "EXPORT_GENERATED";
  verdict: "valid" | "invalid" | "replay_suspect" | "blocked_replay" | "revoked" | "broken" | "tampered" | "unknown_batch" | "not_registered" | "not_active";
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  readCounter?: number | null;
  sdmReadCtr?: number | null;
  piccDataHash?: string | null;
  cmacHash?: string | null;
  cmacOk?: boolean | null;
  allowlisted?: boolean | null;
  tagStatus?: string | null;
  rawUrlHash?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  city?: string | null;
  province?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  geoPrecision?: "none" | "ip" | "browser_rounded" | "browser_exact";
  productName?: string | null;
  metadataJson?: Record<string, unknown>;
  reason?: string | null;
  meta?: Record<string, unknown>;
  traceId: string;
  ip?: string | null;
  geoCity?: string | null;
  geoCountry?: string | null;
  deviceLabel?: string | null;
  rawQuery?: Record<string, unknown>;
};

function operationKey(traceId: string) {
  const normalized = String(traceId || "").trim();
  if (/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,220}$/.test(normalized)) return `tap:${normalized}`;
  return `tap:${createHash("sha256").update(normalized, "utf8").digest("hex")}`;
}
export async function recordTapEvent(payload: TapEventPayload): Promise<number | null> {
  // Unknown/unresolved batches cannot satisfy the canonical events FK contract.
  // The caller records those attempts in the dedicated SUN attempt store.
  if (!payload.batchId) return null;

  const coordinate = normalizeCoordinatePair(payload.lat, payload.lng);
  const persistedRawQuery = redactSensitiveQueryValues(payload.rawQuery);
  const mode = payload.source === "demo_simulation"
    ? "simulated" as const
    : payload.source === "demo"
      ? "demo" as const
      : "live" as const;

  try {
    const receipt = await writeCanonicalEvent({
      operationKey: operationKey(payload.traceId),
      eventName: payload.eventType === "PROVENANCE_VIEWED" ? "provenance.viewed" : mode === "live" ? "provenance.viewed" : "demo.tap.simulated",
      mode,
      family: "tap",
      batchId: payload.batchId,
      uidHex: payload.uidHex,
      eventType: payload.eventType,
      result: payload.verdict.toUpperCase(),
      verdict: payload.verdict,
      riskLevel: payload.riskLevel,
      reason: payload.reason,
      readCounter: payload.readCounter,
      sdmReadCtr: payload.sdmReadCtr,
      cmacOk: payload.cmacOk,
      allowlisted: payload.allowlisted,
      userAgent: payload.userAgent,
      city: payload.city,
      countryCode: payload.countryCode,
      lat: coordinate?.lat ?? null,
      lng: coordinate?.lng ?? null,
      geoPrecision: payload.geoPrecision,
      productName: payload.productName,
      piccDataHash: payload.piccDataHash,
      cmacHash: payload.cmacHash,
      rawUrlHash: payload.rawUrlHash,
      ipHash: payload.ipHash,
      deviceLabel: payload.deviceLabel,
      rawQuery: persistedRawQuery,
      meta: {
        ...(payload.meta || payload.metadataJson || {}),
        trace_id: payload.traceId,
        requested_tenant_id_ignored: Boolean(payload.tenantId),
        requested_tag_status_ignored: Boolean(payload.tagStatus),
      },
      webhookData: {
        result: payload.verdict.toUpperCase(),
        riskLevel: payload.riskLevel,
        product: payload.productName || null,
      },
    });

    void evaluateSecurityAlerts({
      eventId: receipt.eventId,
      tenantId: receipt.tenantId,
      tenantSlug: payload.tenantSlug || null,
      uidHex: payload.uidHex || null,
      result: payload.verdict.toUpperCase(),
      countryCode: payload.countryCode || payload.geoCountry || null,
      deviceLabel: payload.deviceLabel || null,
    }).catch(() => null);

    return receipt.eventId;
  } catch (error) {
    console.error("Failed to record canonical tap event:", error);
    return null;
  }
}
