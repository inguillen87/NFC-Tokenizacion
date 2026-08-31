const APPROXIMATE_DECIMALS = 3;
const PUBLIC_TIMELINE_DECIMALS = 2;
export const APPROXIMATE_LOCATION_MIN_ACCURACY_M = 150;

function finiteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundCoordinate(value: number) {
  const factor = 10 ** APPROXIMATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Public SUN timelines never expose the coordinate persisted for an event.
 * Two decimals are intentionally coarser than the consented capture used for
 * internal operational diagnostics.
 */
export function coarsenPublicTimelineLocation(lat: unknown, lng: unknown) {
  const coordinate = normalizeCoordinatePair(lat, lng);
  if (!coordinate) return null;
  const factor = 10 ** PUBLIC_TIMELINE_DECIMALS;
  return {
    lat: Math.round(coordinate.lat * factor) / factor,
    lng: Math.round(coordinate.lng * factor) / factor,
  };
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizedLocationToken(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function durableLocationEvidence(metadata: unknown) {
  const meta = objectRecord(metadata);
  if (!meta) return [];
  const sunContext = objectRecord(meta.sun_context);
  return [
    objectRecord(meta.geo_evidence),
    objectRecord(sunContext?.tap_request_location),
    objectRecord(sunContext?.geo),
  ].filter(
    (value): value is Record<string, unknown> => value !== null,
  );
}

function evidenceAccuracy(value: unknown) {
  const evidence = objectRecord(value);
  return finiteNumber(evidence?.accuracy ?? evidence?.accuracy_m ?? evidence?.accuracyM);
}

export type PublicLocationProjection = { lat: number | null; lng: number | null };

/** Fail-closed projection for unauthenticated/public location surfaces. */
export function sanitizePublicLocationProjection(input: {
  lat?: unknown;
  lng?: unknown;
  locationSource?: unknown;
  geoPrecision?: unknown;
  locationAccuracyM?: unknown;
  metadata?: unknown;
}): PublicLocationProjection {
  const publicPair = coarsenPublicTimelineLocation(input.lat, input.lng);
  if (!publicPair) return { lat: null, lng: null };

  const evidence = durableLocationEvidence(input.metadata);
  const explicitSource = normalizedLocationToken(input.locationSource);
  const explicitPrecision = normalizedLocationToken(input.geoPrecision);
  const evidenceWithSource = evidence.find((item) => normalizedLocationToken(item.source));
  const source = explicitSource || normalizedLocationToken(evidenceWithSource?.source);
  const matchingEvidence = evidence.find((item) => normalizedLocationToken(item.source) === source);
  const precision = explicitPrecision || normalizedLocationToken(matchingEvidence?.precision);

  if (["edge_ip_approx", "ip_approx", "ip_geo"].includes(source)) {
    return ["ip", "ip_approximate", "approximate"].includes(precision)
      ? publicPair
      : { lat: null, lng: null };
  }

  if (!["browser_geolocation_approximate_consent", "browser_gps_approximate_consent"].includes(source)) {
    return { lat: null, lng: null };
  }
  if (!["approximate", "browser_rounded"].includes(precision)) return { lat: null, lng: null };

  const consentEvidence = evidence.find((item) => (
    ["browser_geolocation_approximate_consent", "browser_gps_approximate_consent"].includes(normalizedLocationToken(item.source))
    && item.consent === true
    && normalizedLocationToken(item.precision) === "approximate"
  ));
  if (!consentEvidence) return { lat: null, lng: null };

  const accuracy = finiteNumber(input.locationAccuracyM) ?? evidenceAccuracy(consentEvidence);
  return accuracy !== null && accuracy >= APPROXIMATE_LOCATION_MIN_ACCURACY_M
    ? publicPair
    : { lat: null, lng: null };
}

export function normalizeCoordinatePair(lat: unknown, lng: unknown) {
  const parsedLat = finiteNumber(lat);
  const parsedLng = finiteNumber(lng);
  if (
    parsedLat === null
    || parsedLng === null
    || parsedLat < -90
    || parsedLat > 90
    || parsedLng < -180
    || parsedLng > 180
  ) return null;
  return { lat: parsedLat, lng: parsedLng };
}

const LOCATION_QUERY_KEYS = new Set([
  "lat",
  "lng",
  "latitude",
  "longitude",
  "gpslat",
  "gpslng",
  "accuracy",
  "gpsaccuracy",
]);

const SUN_DYNAMIC_AUTH_QUERY_KEYS = new Set([
  "piccdata",
  "piccdatahex",
  "encryptedpiccdata",
  "encpiccdata",
  "enc",
  "enchex",
  "encrypteddata",
  "cmac",
  "cmachex",
  "suncmac",
  "mac",
]);

function normalizedQueryKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function redactSensitiveQueryValues(input: Record<string, unknown> | null | undefined) {
  if (!input) return null;
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key,
    LOCATION_QUERY_KEYS.has(normalizedQueryKey(key))
      ? "[redacted_location]"
      : SUN_DYNAMIC_AUTH_QUERY_KEYS.has(normalizedQueryKey(key))
        ? "[redacted_sun_dynamic]"
        : value,
  ]));
}

/** @deprecated Use redactSensitiveQueryValues for all persistence/log projections. */
export function redactExactLocationQueryValues(input: Record<string, unknown> | null | undefined) {
  return redactSensitiveQueryValues(input);
}

export function normalizeConsentedApproximateLocation(input: {
  consent?: unknown;
  precision?: unknown;
  lat?: unknown;
  lng?: unknown;
  accuracy?: unknown;
}) {
  if (input.consent !== true) {
    return { accepted: false as const, reason: "location_consent_required", lat: null, lng: null, accuracy: null };
  }
  if (String(input.precision || "").trim().toLowerCase() !== "approximate") {
    return { accepted: false as const, reason: "approximate_location_required", lat: null, lng: null, accuracy: null };
  }

  const coordinate = normalizeCoordinatePair(input.lat, input.lng);
  if (!coordinate) {
    return { accepted: false as const, reason: "invalid_location", lat: null, lng: null, accuracy: null };
  }
  const rawAccuracy = finiteNumber(input.accuracy);
  if (rawAccuracy === null || rawAccuracy < 0 || rawAccuracy > 50_000) {
    return { accepted: false as const, reason: "invalid_location_accuracy", lat: null, lng: null, accuracy: null };
  }

  return {
    accepted: true as const,
    reason: "consented_approximate_location",
    lat: roundCoordinate(coordinate.lat),
    lng: roundCoordinate(coordinate.lng),
    accuracy: Math.round(Math.max(APPROXIMATE_LOCATION_MIN_ACCURACY_M, rawAccuracy)),
  };
}
