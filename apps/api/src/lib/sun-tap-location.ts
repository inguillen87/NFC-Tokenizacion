import { sql } from "./db";
import { normalizeCoordinatePair } from "./approximate-location";

export const SUN_EDGE_LOCATION_SOURCE = "edge_ip_approx";
export const SUN_EDGE_LOCATION_PRECISION = "ip";

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
