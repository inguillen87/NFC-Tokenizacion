import { maskUid, normalizeEventVerdict, normalizeWgs84CoordinatePair, resolveEventLocalTime } from "@product/core";
import { sql } from "./db";

export type PhysicalTapSealState = "closed" | "opened" | "other";

type PhysicalTapRow = Record<string, unknown>;

const CLOSED_STATES = new Set(["VALID_CLOSED"]);
const OPENED_STATES = new Set([
  "OPENED",
  "OPENED_PREVIOUSLY",
  "MANUAL_OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_MANUAL_OPENED",
]);
const CONSENTED_BROWSER_LOCATION_SOURCES = new Set([
  "browser_geolocation_approximate_consent",
  "browser_gps_approximate_consent",
]);
const BROWSER_LOCATION_SOURCES_WITH_ACCURACY = new Set([
  ...CONSENTED_BROWSER_LOCATION_SOURCES,
  "browser_gps_reported",
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

function record(value: unknown): PhysicalTapRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as PhysicalTapRow
    : null;
}

function postTapBrowserLocation(row: PhysicalTapRow) {
  const observation = record(row.post_tap_location_observation);
  if (!observation || observation.consent !== true || text(observation.precision).toLowerCase() !== "approximate") {
    return null;
  }
  const source = text(observation.source).toLowerCase();
  if (!CONSENTED_BROWSER_LOCATION_SOURCES.has(source)) return null;
  const coordinate = normalizeWgs84CoordinatePair(observation.lat, observation.lng);
  const accuracyM = finiteNumber(observation.accuracyM);
  if (!coordinate || accuracyM === null || accuracyM < 150 || accuracyM > 50_000) return null;
  return {
    city: text(observation.city) || null,
    country: text(observation.countryCode) || null,
    coordinate,
    source,
    accuracyM,
  };
}

function canonicalReportedState(row: PhysicalTapRow) {
  const bindingStatus = text(row.tt_binding_status).toUpperCase();
  const canonicalState = text(row.tt_canonical_product_state).toUpperCase();
  if (bindingStatus === "BOUND" && (CLOSED_STATES.has(canonicalState) || OPENED_STATES.has(canonicalState))) {
    return canonicalState;
  }
  return text(row.result).toUpperCase();
}

export function classifyPhysicalTapSealState(value: unknown): PhysicalTapSealState {
  const state = text(value).toUpperCase();
  if (CLOSED_STATES.has(state)) return "closed";
  if (OPENED_STATES.has(state)) return "opened";
  return "other";
}

export function isAuthenticatedNfcMessage(input: { result?: unknown; verdict?: unknown; reason?: unknown }) {
  return normalizeEventVerdict(input) === "valid";
}

function locationProjection(row: PhysicalTapRow) {
  const browserObservation = postTapBrowserLocation(row);
  if (browserObservation) {
    return {
      city: browserObservation.city,
      region: null,
      country: browserObservation.country,
      lat: browserObservation.coordinate.lat,
      lng: browserObservation.coordinate.lng,
      source: browserObservation.source,
      precision: "browser_approximate_consent",
      accuracyM: browserObservation.accuracyM,
      evidence: "persisted_event",
    };
  }
  const direct = normalizeWgs84CoordinatePair(row.lat, row.lng);
  const edgeApprox = normalizeWgs84CoordinatePair(row.geo_lat, row.geo_lng);
  const coordinate = direct || edgeApprox;
  const declaredSource = text(row.location_source).toLowerCase();
  const geoPrecision = text(row.geo_precision).toLowerCase();
  const source = coordinate
    ? declaredSource || (edgeApprox && !direct ? "edge_ip_approx" : "unknown_approx")
    : "none";
  const browserConsent = BROWSER_LOCATION_SOURCES_WITH_ACCURACY.has(source);
  const accuracy = browserConsent ? finiteNumber(row.location_accuracy_m) : null;
  return {
    city: text(row.city) || text(row.geo_city) || null,
    region: null,
    country: text(row.country_code) || text(row.geo_country) || null,
    lat: coordinate?.lat ?? null,
    lng: coordinate?.lng ?? null,
    source,
    precision: coordinate
      ? browserConsent || geoPrecision === "browser_rounded" || geoPrecision === "browser_exact"
        ? "browser_approximate_consent"
        : "approximate"
      : "none",
    accuracyM: accuracy,
    evidence: coordinate ? "persisted_event" : "none",
  };
}

export function normalizeAdminPhysicalTap(row: PhysicalTapRow) {
  const reportedState = canonicalReportedState(row);
  const sealState = classifyPhysicalTapSealState(reportedState);
  const messageValid = isAuthenticatedNfcMessage({
    result: row.result,
    verdict: row.verdict,
    reason: row.reason,
  });
  const time = resolveEventLocalTime(row);
  const ttBindingStatus = text(row.tt_binding_status).toUpperCase();
  const ttBound = ttBindingStatus === "BOUND";
  const source = text(row.source).toLowerCase();

  return {
    eventId: text(row.id),
    tenantSlug: text(row.tenant_slug),
    bid: text(row.bid),
    productName: text(row.product_name) || null,
    uidMasked: maskUid(text(row.uid_hex)),
    messageValid,
    sealState,
    reportedState,
    result: text(row.result).toUpperCase(),
    verdict: normalizeEventVerdict({ verdict: row.verdict, result: row.result, reason: row.reason }),
    source,
    dataMode: source === "real" ? "physical_real" : "non_production",
    readCounter: finiteNumber(row.read_counter),
    occurredAt: {
      utc: time.occurredAtUtc,
      local: time.occurredAtLocal,
      timezone: time.timezone,
      label: time.timezoneLabel,
    },
    location: locationProjection(row),
    evidence: {
      kind: ttBound ? "physical_nfc_tt_evidenced" : "real_tap_event_carrier_unconfirmed",
      messageAuthentication: messageValid ? "validated" : "not_validated",
      ttStatusReported: ttBound,
      ttState: ttBound ? text(row.tt_canonical_product_state).toUpperCase() || null : null,
      ttRaw: ttBound ? text(row.tt_raw).toUpperCase() || null : null,
      ttBindingStatus: ttBindingStatus || "NOT_AVAILABLE",
      ttBindingReason: text(row.tt_binding_reason) || null,
      ttStatusSource: ttBound ? text(row.tt_status_source) || null : null,
      ttStatusOffset: ttBound ? finiteNumber(row.tt_status_offset) : null,
      ttStatusLength: ttBound ? finiteNumber(row.tt_status_length) : null,
      ttEvidenceAuthority: ttBound ? "nexid_tt_durable_receipt" : "not_reported",
      physicalPackagingMeaning: "integration_dependent",
    },
  };
}

export function summarizeAdminPhysicalTaps(rawRows: PhysicalTapRow[]) {
  const rows = rawRows.map(normalizeAdminPhysicalTap);
  const closed = rows.filter((row) => row.sealState === "closed").length;
  const opened = rows.filter((row) => row.sealState === "opened").length;
  const distinctUnits = new Set(rawRows.map((row) => text(row.uid_hex)).filter(Boolean)).size;
  const latestAt = rows
    .map((row) => row.occurredAt.utc)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;
  return {
    total: rows.length,
    closed,
    opened,
    other: Math.max(rows.length - closed - opened, 0),
    distinctUnits,
    latestAt,
    comparisonAvailable: closed > 0 && opened > 0,
    comparisonMeaning: "independent_physical_taps_not_a_product_journey",
  };
}

export async function listAdminPhysicalTaps(input: {
  tenantSlug: string;
  bid?: string | null;
  limit?: number;
  rangeSql?: string;
}) {
  const tenantSlug = text(input.tenantSlug).toLowerCase();
  if (!tenantSlug) throw new Error("physical_taps_tenant_required");
  const bid = text(input.bid);
  const limit = Math.min(Math.max(Number(input.limit || 20), 1), 100);
  const rangeSql = text(input.rangeSql) || "30 days";

  const rawRows = await sql/*sql*/`
    SELECT
      e.id,
      e.tenant_id,
      e.batch_id,
      e.uid_hex,
      e.result,
      e.reason,
      e.verdict,
      e.event_type,
      e.read_counter,
      e.source,
      e.created_at,
      e.city,
      e.country_code,
      e.lat,
      e.lng,
      e.geo_city,
      e.geo_country,
      e.geo_lat,
      e.geo_lng,
      e.geo_precision,
      e.location_source,
      e.location_accuracy_m,
      to_jsonb(e)->'post_tap_location_observation' AS post_tap_location_observation,
      tn.slug AS tenant_slug,
      b.bid,
      COALESCE(
        NULLIF(e.product_name, ''),
        NULLIF(tp.product_name, ''),
        NULLIF(tp.sku, ''),
        NULLIF(b.sdm_config->>'product_name', ''),
        NULLIF(b.sdm_config #>> '{sun,product,name}', ''),
        NULLIF(b.sdm_config->>'sku', ''),
        NULLIF(b.sdm_config #>> '{sun,product,sku}', '')
      ) AS product_name,
      tt.tt_raw,
      tt.canonical_product_state AS tt_canonical_product_state,
      tt.binding_status AS tt_binding_status,
      tt.binding_reason AS tt_binding_reason,
      tt.status_source AS tt_status_source,
      tt.status_offset AS tt_status_offset,
      tt.status_length AS tt_status_length
    FROM events e
    JOIN batches b ON b.id = e.batch_id
    JOIN tenants tn ON tn.id = b.tenant_id
    LEFT JOIN tag_profiles tp ON tp.tag_id = e.tag_id
    LEFT JOIN sun_tt_truth_receipts tt
      ON tt.event_id = e.id
      AND tt.event_created_at = e.created_at
    WHERE tn.slug = ${tenantSlug}
      AND (${bid} = '' OR b.bid = ${bid})
      AND LOWER(COALESCE(e.source::text, '')) = 'real'
      AND e.event_type::text IN ('TAP_VALID', 'TAP_INVALID', 'REPLAY_SUSPECT')
      AND e.created_at >= now() - ${rangeSql}::interval
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT ${limit}
  `;

  const rows = (rawRows as PhysicalTapRow[]).map(normalizeAdminPhysicalTap);
  return {
    availability: "available" as const,
    summary: summarizeAdminPhysicalTaps(rawRows as PhysicalTapRow[]),
    rows,
  };
}
