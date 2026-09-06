import { normalizeWgs84CoordinatePair } from "@product/core";

type EventRow = Record<string, unknown>;

export const CONSENTED_BROWSER_LOCATION_SOURCES = new Set([
  "browser_geolocation_approximate_consent",
  "browser_gps_approximate_consent",
]);

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function finiteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Read only the observation selected from this event row, never product or request coordinates. */
export function postTapBrowserLocation(row: EventRow) {
  const raw = row.post_tap_location_observation;
  const observation = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as EventRow : null;
  if (!observation || observation.consent !== true || text(observation.precision).toLowerCase() !== "approximate") return null;
  const source = text(observation.source).toLowerCase();
  if (!CONSENTED_BROWSER_LOCATION_SOURCES.has(source)) return null;
  const coordinate = normalizeWgs84CoordinatePair(observation.lat, observation.lng);
  const accuracyM = finiteNumber(observation.accuracyM);
  if (!coordinate || accuracyM === null || accuracyM < 150 || accuracyM > 50_000) return null;
  return {
    city: text(observation.city) || null,
    country: text(observation.countryCode) || null,
    // Defence in depth for internal admin projection: never increase the
    // three-decimal precision allowed by the consented capture contract.
    coordinate: {
      lat: Math.round(coordinate.lat * 1_000) / 1_000,
      lng: Math.round(coordinate.lng * 1_000) / 1_000,
    },
    source,
    accuracyM,
  };
}

/** Display projection only. Preserve the canonical event and its original HTTP/IP evidence. */
export function projectConsentedPostTapLocation(row: EventRow): EventRow {
  const observation = postTapBrowserLocation(row);
  if (!observation) return row;
  return {
    ...row,
    city: observation.city,
    country_code: observation.country,
    lat: observation.coordinate.lat,
    lng: observation.coordinate.lng,
    location_source: observation.source,
    location_accuracy_m: observation.accuracyM,
  };
}
