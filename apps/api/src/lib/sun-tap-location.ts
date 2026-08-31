import { sql } from "./db";
import { normalizeCoordinatePair } from "./approximate-location";

export const SUN_EDGE_LOCATION_SOURCE = "edge_ip_approx";
export const SUN_EDGE_LOCATION_PRECISION = "ip";
export const SUN_POST_TAP_LOCATION_CLOCK_SKEW_MS = 60_000;

function timestampMs(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/**
 * Binds a browser measurement to the fresh SUN event that authorized it.
 * Client clocks may differ slightly, but a location from before the event or
 * materially in the future must never be attached to that event.
 */
export function isPostTapLocationTimingValid(input: {
  eventCreatedAt: unknown;
  locationRequestedAt: unknown;
  locationMeasuredAt: unknown;
  requestReceivedAtMs: number;
  allowedClockSkewMs?: number;
}) {
  const eventCreatedAtMs = timestampMs(input.eventCreatedAt);
  const locationRequestedAtMs = timestampMs(input.locationRequestedAt);
  const locationMeasuredAtMs = timestampMs(input.locationMeasuredAt);
  const requestReceivedAtMs = timestampMs(input.requestReceivedAtMs);
  const allowedClockSkewMs = Number.isFinite(input.allowedClockSkewMs)
    ? Math.max(0, Number(input.allowedClockSkewMs))
    : SUN_POST_TAP_LOCATION_CLOCK_SKEW_MS;

  return Number.isFinite(eventCreatedAtMs)
    && Number.isFinite(locationRequestedAtMs)
    && Number.isFinite(locationMeasuredAtMs)
    && Number.isFinite(requestReceivedAtMs)
    && locationMeasuredAtMs >= locationRequestedAtMs
    && locationRequestedAtMs >= eventCreatedAtMs - allowedClockSkewMs
    && locationMeasuredAtMs >= eventCreatedAtMs - allowedClockSkewMs
    && locationMeasuredAtMs <= requestReceivedAtMs + allowedClockSkewMs;
}

export function buildSunRequestLocationEvidence(input: {
  lat?: unknown;
  lng?: unknown;
  city?: unknown;
  country?: unknown;
  recordedAt?: string | null;
}) {
  const coordinate = normalizeCoordinatePair(input.lat, input.lng);
  if (!coordinate) return null;
  const recordedAt = String(input.recordedAt || "").trim() || new Date().toISOString();
  return {
    coordinate,
    source: SUN_EDGE_LOCATION_SOURCE,
    precision: SUN_EDGE_LOCATION_PRECISION,
    evidence: {
      schema_version: "sun-tap-request-location/v1",
      source: SUN_EDGE_LOCATION_SOURCE,
      precision: "ip_approximate",
      verification: "network_edge_estimate_not_device_gps",
      timing: "tap_http_request_received",
      recorded_at: recordedAt,
      city: String(input.city || "").trim() || null,
      country: String(input.country || "").trim() || null,
      consent: false,
    },
  };
}

async function geoPrecisionStorage() {
  const rows = await sql/*sql*/`
    SELECT c.data_type, c.udt_name
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = 'events'
      AND c.column_name = 'geo_precision'
    LIMIT 1
  `;
  const row = rows[0] || {};
  return String(row.data_type || "").toUpperCase() === "USER-DEFINED"
    && String(row.udt_name || "") === "geo_precision"
    ? "enum" as const
    : "text" as const;
}

/**
 * Adds a durable source/precision classification to the canonical SUN event.
 * The scan transaction already persisted the coordinate; this best-effort
 * enrichment makes it clear that the value is an edge/IP zone captured when
 * the HTTP tap request reached nexID, not GPS from the NFC tag.
 */
export async function persistSunRequestLocation(input: {
  eventId?: string | number | null;
  lat?: unknown;
  lng?: unknown;
  city?: unknown;
  country?: unknown;
  recordedAt?: string | null;
}) {
  const eventId = Number(input.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) return false;
  const location = buildSunRequestLocationEvidence(input);
  if (!location) return false;
  const metaPatch = JSON.stringify({
    geo_evidence: location.evidence,
    tap_request_location: location.evidence,
  });
  const storage = await geoPrecisionStorage();

  try {
    if (storage === "enum") {
      await sql/*sql*/`
        UPDATE events
        SET location_source = ${location.source},
            geo_precision = ${location.precision}::geo_precision,
            location_accuracy_m = NULL,
            location_updated_at = COALESCE(location_updated_at, created_at),
            meta = COALESCE(meta, '{}'::jsonb) || ${metaPatch}::jsonb
        WHERE id = ${eventId}
      `;
    } else {
      await sql/*sql*/`
        UPDATE events
        SET location_source = ${location.source},
            geo_precision = ${location.precision},
            location_accuracy_m = NULL,
            location_updated_at = COALESCE(location_updated_at, created_at),
            meta = COALESCE(meta, '{}'::jsonb) || ${metaPatch}::jsonb
        WHERE id = ${eventId}
      `;
    }
    return true;
  } catch {
    // Pre-0097 installations still retain the truthful evidence in metadata.
    try {
      if (storage === "enum") {
        await sql/*sql*/`
          UPDATE events
          SET geo_precision = ${location.precision}::geo_precision,
              meta = COALESCE(meta, '{}'::jsonb) || ${metaPatch}::jsonb
          WHERE id = ${eventId}
        `;
      } else {
        await sql/*sql*/`
          UPDATE events
          SET geo_precision = ${location.precision},
              meta = COALESCE(meta, '{}'::jsonb) || ${metaPatch}::jsonb
          WHERE id = ${eventId}
        `;
      }
      return true;
    } catch {
      return false;
    }
  }
}
