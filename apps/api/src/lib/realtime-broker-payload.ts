import { createHash } from "node:crypto";
import { normalizeEventDataProvenance } from "@product/core";

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,118}[a-z0-9])?$/;
const OPERATIONAL_REASON_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const MASKED_UID_PATTERN = /^(?:N\/A|[A-F0-9]\*{3}[A-F0-9]|[A-F0-9]{4}\*{4}[A-F0-9]{2})$/;
export const REALTIME_DELIVERY_ID_PATTERN = /^rtv1_[a-f0-9]{32}$/;

function boundedText(value: unknown, maximum: number) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

function opaqueId(value: unknown) {
  const normalized = boundedText(value, 160);
  return normalized && OPAQUE_ID_PATTERN.test(normalized) ? normalized : null;
}

function token(value: unknown, maximum = 160) {
  const normalized = boundedText(value, maximum);
  return normalized && TOKEN_PATTERN.test(normalized) ? normalized : null;
}

function tenantSlug(value: unknown) {
  const normalized = boundedText(value, 120)?.toLowerCase() || null;
  return normalized && TENANT_SLUG_PATTERN.test(normalized) ? normalized : null;
}

function timestamp(value: unknown) {
  const normalized = boundedText(value, 64);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function finiteNumber(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function nonNegativeInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

function copyOpaqueId(target: Record<string, unknown>, key: string, source: Record<string, unknown>) {
  const value = opaqueId(source[key]);
  if (value) target[key] = value;
}

function copyToken(target: Record<string, unknown>, key: string, source: Record<string, unknown>, maximum = 160) {
  const value = token(source[key], maximum);
  if (value) target[key] = value;
}

function copyNullableToken(target: Record<string, unknown>, key: string, source: Record<string, unknown>, maximum = 160) {
  const value = token(source[key], maximum);
  if (value) target[key] = value;
  else if (source[key] === null) target[key] = null;
}

function copyBoolean(target: Record<string, unknown>, key: string, source: Record<string, unknown>) {
  if (typeof source[key] === "boolean" || source[key] === null) target[key] = source[key];
}

function sanitizeConsentChannels(value: unknown) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(["email", "phone", "whatsapp"]);
  return [...new Set(value
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter((entry) => allowed.has(entry)))]
    .sort();
}

/**
 * The embedded projection intentionally contains only fields required by the
 * live dashboard. Raw UID, user-agent, contact details, device labels, free-form
 * reasons and event metadata remain in PostgreSQL and never enter the broker.
 */
export function minimizeTapProjectionForBroker(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  result.dataProvenance = normalizeEventDataProvenance(source.dataProvenance);

  for (const key of ["eventId", "tenantId", "batchId", "bid", "tagId"] as const) {
    const id = opaqueId(source[key]);
    if (id) result[key] = id;
    else if (source[key] === null) result[key] = null;
  }
  const normalizedTenantSlug = tenantSlug(source.tenantSlug);
  if (normalizedTenantSlug) result.tenantSlug = normalizedTenantSlug;
  else if (source.tenantSlug === null) result.tenantSlug = null;

  const uidMasked = boundedText(source.uidMasked, 32)?.toUpperCase() || null;
  if (uidMasked && MASKED_UID_PATTERN.test(uidMasked)) result.uidMasked = uidMasked;

  for (const key of ["occurredAt", "occurredAtUtc"] as const) {
    const valueAt = timestamp(source[key]);
    if (valueAt) result[key] = valueAt;
  }
  for (const key of ["occurredAtLocal", "timezone", "timezoneLabel", "timezoneOffset"] as const) {
    const displayValue = boundedText(source[key], 96);
    if (displayValue) result[key] = displayValue;
    else if (source[key] === null) result[key] = null;
  }

  for (const key of [
    "eventType",
    "result",
    "verdict",
    "interactionClass",
    "riskLevel",
    "source",
    "eventSource",
    "locationSource",
    "deviceOs",
    "deviceType",
  ] as const) copyNullableToken(result, key, source);

  for (const key of [
    "productIdentityRecognized",
    "authenticationVerified",
    "knownActor",
    "commercialConsentGranted",
  ] as const) copyBoolean(result, key, source);

  const knownActorCount = nonNegativeInteger(source.knownActorCount, 1_000_000_000);
  if (knownActorCount !== null) result.knownActorCount = knownActorCount;
  result.commercialConsentChannels = sanitizeConsentChannels(source.commercialConsentChannels);

  const reason = boundedText(source.reason, 128);
  result.reason = reason && OPERATIONAL_REASON_PATTERN.test(reason) ? reason : null;

  const city = boundedText(source.city, 120);
  const country = token(source.country, 3);
  if (city) result.city = city;
  else if (source.city === null) result.city = null;
  if (country) result.country = country.toUpperCase();
  else if (source.country === null) result.country = null;

  const lat = finiteNumber(source.lat, -90, 90);
  const lng = finiteNumber(source.lng, -180, 180);
  const accuracy = finiteNumber(source.locationAccuracyM, 0, 40_000_000);
  result.lat = lat;
  result.lng = lng;
  result.locationAccuracyM = accuracy;

  // A product name is display data needed by the command center. It is bounded
  // and control-character free, unlike generic title/company/free-text fields.
  const productName = boundedText(source.productName, 240);
  if (productName) result.productName = productName;
  else if (source.productName === null) result.productName = null;

  // A device label may contain a user supplied model/name. Coarse OS/type above
  // are sufficient for live aggregation and avoid publishing that fingerprint.
  result.deviceLabel = null;
  return result;
}

function deliveryId(payload: Record<string, unknown>) {
  const digest = createHash("sha256")
    .update("nexid-realtime-broker-v1\u0000")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 32);
  return `rtv1_${digest}`;
}

/**
 * Closed allowlist at the broker boundary. Publishers may accept richer
 * domain objects, but only this projection may leave the API process.
 */
export function minimizeRealtimePayloadForBroker(value: Record<string, unknown>) {
  const result: Record<string, unknown> = {};

  for (const key of [
    "id",
    "alert_id",
    "tenant_id",
    "batch_id",
    "tag_id",
    "lead_id",
    "ticket_id",
    "incident_id",
    "incident_event_id",
    "event_id",
    "sdk_event_id",
  ] as const) copyOpaqueId(result, key, value);

  const normalizedTenantSlug = tenantSlug(value.tenant_slug);
  if (normalizedTenantSlug) result.tenant_slug = normalizedTenantSlug;

  for (const key of [
    "event_type",
    "severity",
    "type",
    "verdict",
    "risk_level",
    "result",
    "location_source",
    "device_os",
    "device_type",
    "source",
    "incident_status",
    "incident_severity",
    "status",
    "external_event_type",
  ] as const) copyToken(result, key, value);

  for (const key of ["cmac_ok", "allowlisted", "known_actor", "commercial_consent_granted"] as const) {
    copyBoolean(result, key, value);
  }
  const knownActorCount = nonNegativeInteger(value.known_actor_count, 1_000_000_000);
  if (knownActorCount !== null) result.known_actor_count = knownActorCount;
  if (Array.isArray(value.commercial_consent_channels)) {
    result.commercial_consent_channels = sanitizeConsentChannels(value.commercial_consent_channels);
  }

  const reason = boundedText(value.reason, 128);
  if (reason && OPERATIONAL_REASON_PATTERN.test(reason)) result.reason = reason;
  else if (value.reason === null) result.reason = null;

  const createdAt = timestamp(value.created_at);
  if (createdAt) result.created_at = createdAt;
  const city = boundedText(value.city, 120);
  const countryCode = token(value.country_code, 3);
  const productName = boundedText(value.product_name, 240);
  const bid = opaqueId(value.bid);
  if (city) result.city = city;
  else if (value.city === null) result.city = null;
  if (countryCode) result.country_code = countryCode.toUpperCase();
  else if (value.country_code === null) result.country_code = null;
  if (productName) result.product_name = productName;
  if (bid) result.bid = bid;

  if ("lat" in value) result.lat = finiteNumber(value.lat, -90, 90);
  if ("lng" in value) result.lng = finiteNumber(value.lng, -180, 180);
  if ("location_accuracy_m" in value) {
    result.location_accuracy_m = finiteNumber(value.location_accuracy_m, 0, 40_000_000);
  }

  const tapProjection = minimizeTapProjectionForBroker(value.tap_projection);
  if (tapProjection) result.tap_projection = tapProjection;

  result.realtime_delivery_id = deliveryId(result);
  return result;
}
