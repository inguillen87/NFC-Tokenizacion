const APPROXIMATE_DECIMALS = 3;
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
  const boundedAccuracy = rawAccuracy !== null && rawAccuracy >= 0 && rawAccuracy <= 50_000
    ? rawAccuracy
    : APPROXIMATE_LOCATION_MIN_ACCURACY_M;

  return {
    accepted: true as const,
    reason: "consented_approximate_location",
    lat: roundCoordinate(coordinate.lat),
    lng: roundCoordinate(coordinate.lng),
    accuracy: Math.round(Math.max(APPROXIMATE_LOCATION_MIN_ACCURACY_M, boundedAccuracy)),
  };
}
