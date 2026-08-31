export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { publishRealtimeEvent } from "../../../lib/realtime-events";
import { findNearestCity } from "../../../lib/geo-utils";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { consumeSunFreshHandoff, requireSunFreshHandoff } from "../../../lib/sun-fresh-handoff";
import { normalizeConsentedApproximateLocation, sanitizePublicLocationProjection } from "../../../lib/approximate-location";
import { isPostTapLocationTimingValid } from "../../../lib/sun-tap-location";

const MAX_CONTEXT_BODY_BYTES = 32 * 1024;
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const UID_RE = /^[0-9A-F]{8,32}$/;

type ContextBody = {
  bid?: string;
  uid?: string;
  eventId?: string | number;
  ctr?: number;
  contextStatus?: string;
  scannedAt?: string;
  geo?: {
    lat?: number;
    lng?: number;
    accuracy?: number | null;
    measuredAt?: string | null;
    altitude?: number | null;
    speed?: number | null;
  };
  geoConsent?: boolean;
  geoPrecision?: string;
  locationRequestedAt?: string;
  client?: Record<string, unknown>;
  geoError?: string;
};

function asNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
    if (text) return text;
  }
  return "";
}

function sqlState(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const direct = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  if (direct) return direct;
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : null;
  return cause && typeof cause === "object" && "code" in cause
    ? String((cause as { code?: unknown }).code || "")
    : "";
}

function safeClientContext(client: Record<string, unknown> | undefined) {
  return {
    timezone: firstText(client?.timezone).slice(0, 80) || null,
  };
}

function clientTimestamp(value: unknown) {
  const text = firstText(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  const now = Date.now();
  if (parsed > now + 60_000 || parsed < now - 15 * 60_000) return null;
  return new Date(parsed).toISOString();
}

async function resolveEventLocationStorage() {
  const rows = await sql/*sql*/`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'events' AND c.column_name = 'geo_precision'
      ) AS has_geo_precision,
      EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'events' AND c.column_name = 'location_accuracy_m'
      ) AS has_location_accuracy_m,
      EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'events' AND c.column_name = 'location_source'
      ) AS has_location_source,
      EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'events' AND c.column_name = 'location_updated_at'
      ) AS has_location_updated_at,
      COALESCE((
        SELECT c.data_type = 'USER-DEFINED' AND c.udt_name = 'geo_precision'
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'events' AND c.column_name = 'geo_precision'
        LIMIT 1
      ), false) AS geo_precision_is_enum,
      EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public' AND t.typname = 'geo_precision' AND e.enumlabel = 'approximate'
      ) AS supports_approximate
  `;
  const row = rows[0] || {};
  const requiredColumns = [
    ["geo_precision", row.has_geo_precision],
    ["location_accuracy_m", row.has_location_accuracy_m],
    ["location_source", row.has_location_source],
    ["location_updated_at", row.has_location_updated_at],
  ] as const;
  const missingColumns: string[] = requiredColumns
    .filter(([, present]) => present !== true)
    .map(([column]) => column);
  const isEnum = row.geo_precision_is_enum === true;
  const supportsApproximate = row.supports_approximate === true;
  if (isEnum && !supportsApproximate) missingColumns.push("geo_precision.approximate");
  return {
    ready: missingColumns.length === 0,
    missingColumns,
  };
}

export function OPTIONS(): Response {
  return new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
}

export async function POST(req: Request): Promise<Response> {
  const requestReceivedAtMs = Date.now();
  if (!String(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return json({ ok: false, reason: "unsupported_media_type" }, 415, { "cache-control": "no-store" });
  }
  let body: ContextBody & Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<ContextBody & Record<string, unknown>>(req, MAX_CONTEXT_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400, { "cache-control": "no-store" });
  }
  const bid = String(body.bid || "").trim();
  const uid = String(body.uid || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  const eventId = String(body.eventId || "").trim();
  const ctr = asNumber(body.ctr);

  if (!BID_RE.test(bid) || !/^\d+$/.test(eventId) || (uid && !UID_RE.test(uid))) {
    return json({ ok: false, reason: "valid bid and eventId required; uid must be valid when supplied" }, 400, { "cache-control": "no-store" });
  }
  if (ctr === null || !Number.isSafeInteger(ctr) || ctr < 0) {
    return json({ ok: false, reason: "valid ctr required" }, 400, { "cache-control": "no-store" });
  }
  const preAuthLimited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "platform",
    subjectId: "sun-context:unauthenticated",
  });
  if (preAuthLimited) return preAuthLimited;
  // The public passport intentionally does not expose the raw UID. Verify the
  // signed event scope first, then bind the one-time consumption to the UID
  // loaded from the canonical event below.
  const capabilityPreflight = requireSunFreshHandoff(req, body, {
    bid,
    eventId,
    readCounter: ctr,
  });
  if (!capabilityPreflight.ok) {
    return json({ ok: false, reason: "fresh_tap_capability_required", fresh_token_status: capabilityPreflight.reason }, 403, { "cache-control": "no-store" });
  }
  const capabilityScopedLimit = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: `sun-bid:${bid}`,
    subjectId: `sun-event:${eventId}`,
  });
  if (capabilityScopedLimit) return capabilityScopedLimit;

  const batchRows = await sql/*sql*/`SELECT id, tenant_id, bid FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "unknown batch" }, 404, { "cache-control": "no-store" });

  const approximateLocation = normalizeConsentedApproximateLocation({
    consent: body.geoConsent,
    precision: body.geoPrecision,
    lat: body.geo?.lat,
    lng: body.geo?.lng,
    accuracy: body.geo?.accuracy,
  });
  const lat = approximateLocation.lat;
  const lng = approximateLocation.lng;
  const accuracy = approximateLocation.accuracy;
  const hasBrowserGps = approximateLocation.accepted;
  if (!hasBrowserGps) {
    return json({ ok: false, reason: approximateLocation.reason, locationAccepted: false }, 422, { "cache-control": "no-store" });
  }
  const locationSource = hasBrowserGps
    ? "browser_gps_approximate_consent"
    : body.geoError
      ? "browser_geolocation_error_reported"
      : body.geo
        ? "browser_geolocation_ignored_without_consent"
        : "browser_context_reported";
  const client = safeClientContext(body.client);
  const device = { deviceLabel: null, deviceOs: null, deviceType: null };
  const locationRequestedAt = clientTimestamp(body.locationRequestedAt || body.scannedAt);
  const locationMeasuredAt = clientTimestamp(body.geo?.measuredAt);
  if (
    !locationRequestedAt
    || !locationMeasuredAt
    || Date.parse(locationMeasuredAt) < Date.parse(locationRequestedAt)
  ) {
    return json({ ok: false, reason: "fresh_location_measurement_required", locationAccepted: false }, 422, { "cache-control": "no-store" });
  }
  const targetRows = await sql/*sql*/`
      SELECT
        e.id,
        e.tenant_id,
        e.batch_id,
        e.tag_id,
        e.uid_hex,
        e.result,
        e.reason,
        e.created_at,
        e.city,
        e.country_code,
        e.lat,
        e.lng,
        e.sdm_read_ctr,
        COALESCE(NULLIF(e.bid, ''), b.bid) AS bid,
        tn.slug AS tenant_slug,
        COALESCE(
          NULLIF(e.product_name, ''),
          NULLIF(b.sdm_config->>'product_name', ''),
          NULLIF(b.sdm_config #>> '{sun,product,name}', ''),
          NULLIF(b.sdm_config->>'sku', ''),
          NULLIF(b.sdm_config #>> '{sun,product,sku}', '')
        ) AS product_name
      FROM events e
      JOIN batches b ON b.id = e.batch_id
      LEFT JOIN tenants tn ON tn.id = COALESCE(e.tenant_id, b.tenant_id)
      WHERE e.id = ${eventId}::bigint
        AND e.batch_id = ${batch.id}
        AND (${uid || null}::text IS NULL OR UPPER(e.uid_hex) = ${uid || null})
        AND e.sdm_read_ctr = ${ctr}
        AND e.created_at >= now() - interval '10 minutes'
      LIMIT 1
  `;
  const target = targetRows[0];
  if (!target) return json({ ok: false, reason: "capability_bound_event_not_found" }, 404, { "cache-control": "no-store" });
  if (!isPostTapLocationTimingValid({
    eventCreatedAt: target.created_at,
    locationRequestedAt,
    locationMeasuredAt,
    requestReceivedAtMs,
  })) {
    return json({ ok: false, reason: "post_tap_location_timing_invalid", locationAccepted: false }, 422, { "cache-control": "no-store" });
  }
  const targetUid = String(target.uid_hex || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (!UID_RE.test(targetUid)) {
    return json({ ok: false, reason: "capability_bound_event_uid_invalid" }, 409, { "cache-control": "no-store" });
  }
  let storage: Awaited<ReturnType<typeof resolveEventLocationStorage>>;
  try {
    storage = await resolveEventLocationStorage();
  } catch {
    return json({ ok: false, updated: false, reason: "sun_context_schema_check_unavailable", eventId: target.id }, 503, { "cache-control": "no-store" });
  }
  if (!storage.ready) {
    return json({
      ok: false,
      updated: false,
      reason: "sun_context_schema_not_ready",
      eventId: target.id,
      missingColumns: storage.missingColumns,
    }, 503, { "cache-control": "no-store" });
  }
  const capability = await consumeSunFreshHandoff(req, body, {
    bid,
    eventId,
    uidHex: targetUid,
    readCounter: ctr,
  }, "sun_context");
  if (!capability.ok) {
    return json({ ok: false, reason: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403, { "cache-control": "no-store" });
  }
  const capabilityBinding = capability.payload;
  const boundReadCounter = Number(capabilityBinding.readCounter);
  if (!Number.isSafeInteger(boundReadCounter) || boundReadCounter < 0) {
    return json({ ok: false, updated: false, reason: "capability_bound_snapshot_mismatch", eventId: capabilityBinding.eventId }, 409, { "cache-control": "no-store" });
  }
  const matchedBy = "signed_event_bid_uid_ctr";
  const locationReceivedAt = new Date().toISOString();
  const metaPayload = {
    sun_context: {
      evidence_scope: "signed_fresh_event_capability",
      client_values_verified: false,
      status: firstText(body.contextStatus).slice(0, 80) || "unknown",
      tapReceivedAt: target.created_at ? new Date(String(target.created_at)).toISOString() : null,
      locationRequestedAt,
      locationMeasuredAt,
      locationReceivedAt,
      timingSemantics: hasBrowserGps ? "browser_location_confirmed_after_tap" : "browser_context_after_tap",
      geo: {
        source: locationSource,
        verification: "client_reported_not_independently_verified",
        consent: body.geoConsent === true,
        precision: hasBrowserGps ? "approximate" : "not_stored",
        normalization: "rounded_3_decimals_min_150m",
        lat,
        lng,
        accuracy,
        altitude: null,
        speed: null,
      },
      client,
      device,
      geoError: firstText(body.geoError).slice(0, 240) || null,
    },
  };

  let resolvedCity: string | null = null;
  let resolvedCountry: string | null = null;
  // The edge/IP locality belongs to the HTTP tap evidence. A consented browser
  // GPS reading is a different, later observation, so derive its locality even
  // when the edge already supplied a city/country.
  const shouldResolveCity = hasBrowserGps;
  if (shouldResolveCity && lat !== null && lng !== null) {
    const matchedCity = findNearestCity(lat, lng);
    if (matchedCity) {
      resolvedCity = matchedCity.city;
      resolvedCountry = matchedCity.countryCode;
    }
  }
  // Once the user explicitly confirms browser location, its coordinate and
  // derived locality must stay aligned. The original edge/IP zone remains in
  // tap_request_location metadata as the at-request evidence.
  const finalCity = hasBrowserGps ? resolvedCity : firstText(target.city) || null;
  const finalCountry = hasBrowserGps ? resolvedCountry : firstText(target.country_code) || null;
  const snapshotTapPatch = {
    city: resolvedCity,
    country: resolvedCountry,
    lat,
    lng,
    locationSource,
    geoPrecision: "approximate",
    accuracyM: accuracy,
    tapReceivedAt: target.created_at ? new Date(String(target.created_at)).toISOString() : null,
    locationRequestedAt,
    locationMeasuredAt,
    locationReceivedAt,
    locationTiming: "browser_location_confirmed_after_tap",
    locationEvidence: {
      sun_context: {
        evidence_scope: "signed_fresh_event_capability",
        client_values_verified: false,
        timingSemantics: "browser_location_confirmed_after_tap",
        locationRequestedAt,
        locationMeasuredAt,
        locationReceivedAt,
        geo: {
          source: locationSource,
          verification: "client_reported_not_independently_verified",
          consent: true,
          precision: "approximate",
          normalization: "rounded_3_decimals_min_150m",
          accuracy,
        },
      },
    },
  };

  let persistenceRows: Array<Record<string, unknown>>;
  try {
    persistenceRows = await sql/*sql*/`
      WITH bound_pair AS MATERIALIZED (
        SELECT
          diagnostic.id AS diagnostic_id,
          event.id AS event_id,
          event.created_at AS event_created_at
        FROM sun_diagnostics diagnostic
        JOIN events event
          ON event.id = ${capabilityBinding.eventId}::bigint
        WHERE diagnostic.id = ${capabilityBinding.diagnosticId}
          AND diagnostic.trace_id = ${capabilityBinding.traceId}
          AND diagnostic.tool_type = 'sun_scan'
          AND diagnostic.request_json->>'evidence_source' = 'public_sun_route'
          AND diagnostic.bid = ${capabilityBinding.bid}
          AND UPPER(diagnostic.uid_hex) = ${targetUid}
          AND diagnostic.read_counter = ${boundReadCounter}
          AND diagnostic.result_json #>> '{raw_result,event_id}' = ${capabilityBinding.eventId}
          AND diagnostic.result_json #>> '{contract,identity,eventId}' = ${capabilityBinding.eventId}
          AND diagnostic.result_json #>> '{contract,eventId}' = ${capabilityBinding.eventId}
          AND UPPER(COALESCE(diagnostic.result_json #>> '{raw_result,bid}', '')) = UPPER(${capabilityBinding.bid})
          AND UPPER(COALESCE(diagnostic.result_json #>> '{raw_result,uid}', '')) = ${targetUid}
          AND diagnostic.result_json #>> '{raw_result,ctr}' = ${String(boundReadCounter)}
          AND COALESCE(diagnostic.result_json #>> '{raw_result,tenant_id}', '') = ${String(target.tenant_id || '')}
          AND jsonb_typeof(diagnostic.result_json #> '{contract,tapContext}') = 'object'
          AND event.tenant_id = ${target.tenant_id}
          AND event.batch_id = ${target.batch_id}
          AND UPPER(event.uid_hex) = ${targetUid}
          AND event.sdm_read_ctr = ${boundReadCounter}
          AND COALESCE(event.read_counter, event.sdm_read_ctr) = ${boundReadCounter}
          AND UPPER(COALESCE(event.bid, '')) = UPPER(${capabilityBinding.bid})
          AND event.meta->>'trace_id' = ${capabilityBinding.traceId}
          AND event.created_at >= now() - interval '10 minutes'
          AND diagnostic.created_at >= event.created_at
          AND diagnostic.created_at - event.created_at <= interval '5 minutes'
          AND COALESCE(NULLIF(LOWER(event.location_source), ''), 'none') IN ('none', 'edge_ip_approx', 'ip_approx', 'ip_geo')
          AND NOT EXISTS (
            SELECT 1
            FROM supplier_qa_diagnostic_consumptions consumption
            WHERE consumption.diagnostic_id = diagnostic.id
               OR (
                 consumption.canonical_event_id = event.id
                 AND consumption.canonical_event_created_at = event.created_at
               )
          )
        FOR UPDATE OF diagnostic, event
      ),
      unique_pair AS MATERIALIZED (
        SELECT binding.*
        FROM bound_pair binding
        WHERE (SELECT COUNT(*) FROM bound_pair) = 1
      ),
      updated_event AS (
        UPDATE events event
        SET meta = COALESCE(event.meta, '{}'::jsonb) || ${JSON.stringify(metaPayload)}::jsonb,
            lat = ${lat},
            lng = ${lng},
            geo_lat = ${lat},
            geo_lng = ${lng},
            location_accuracy_m = ${accuracy},
            location_source = 'browser_gps_approximate_consent',
            geo_precision = 'approximate',
            location_updated_at = now(),
            city = ${resolvedCity},
            country_code = ${resolvedCountry},
            geo_city = ${resolvedCity},
            geo_country = ${resolvedCountry},
            device_label = COALESCE(NULLIF(event.device_label, ''), ${device.deviceLabel})
        FROM unique_pair binding
        WHERE event.id = binding.event_id
          AND event.created_at = binding.event_created_at
        RETURNING event.id, event.created_at
      ),
      updated_diagnostic AS (
        UPDATE sun_diagnostics diagnostic
        SET result_json = jsonb_set(
          diagnostic.result_json,
          '{contract,tapContext}',
          (diagnostic.result_json #> '{contract,tapContext}') || ${JSON.stringify(snapshotTapPatch)}::jsonb,
          false
        )
        FROM unique_pair binding
        CROSS JOIN updated_event event
        WHERE diagnostic.id = binding.diagnostic_id
          AND event.id = binding.event_id
        RETURNING diagnostic.id
      )
      SELECT
        event.id AS event_id,
        diagnostic.id AS diagnostic_id
      FROM updated_event event
      CROSS JOIN updated_diagnostic diagnostic
    `;
  } catch (error) {
    if (sqlState(error) === "55000") {
      return json({
        ok: false,
        updated: false,
        reason: "sun_context_evidence_already_consumed",
        eventId: capabilityBinding.eventId,
        matchedBy,
      }, 409, { "cache-control": "no-store" });
    }
    return json({
      ok: false,
      updated: false,
      reason: "context_persistence_unavailable",
      eventId: capabilityBinding.eventId,
      matchedBy,
    }, 503, { "cache-control": "no-store" });
  }
  if (persistenceRows.length !== 1) {
    // A QA consumption is an expected conflict, not a malformed signed
    // snapshot. The atomic writer excludes consumed evidence; classify that
    // zero-row outcome with a read-only check while keeping every write closed.
    let evidenceAlreadyConsumed = false;
    try {
      const consumptionRows = await sql/*sql*/`
        SELECT EXISTS (
          SELECT 1
          FROM supplier_qa_diagnostic_consumptions consumption
          WHERE consumption.diagnostic_id = ${capabilityBinding.diagnosticId}
             OR (
               consumption.canonical_event_id = ${capabilityBinding.eventId}::bigint
               AND consumption.canonical_event_created_at = ${target.created_at}::timestamptz
             )
        ) AS evidence_already_consumed
      `;
      evidenceAlreadyConsumed = consumptionRows[0]?.evidence_already_consumed === true;
    } catch {
      return json({
        ok: false,
        updated: false,
        reason: "context_persistence_unavailable",
        eventId: capabilityBinding.eventId,
        matchedBy,
      }, 503, { "cache-control": "no-store" });
    }
    if (evidenceAlreadyConsumed) {
      return json({
        ok: false,
        updated: false,
        reason: "sun_context_evidence_already_consumed",
        eventId: capabilityBinding.eventId,
        matchedBy,
      }, 409, { "cache-control": "no-store" });
    }
    return json({
      ok: false,
      updated: false,
      reason: "capability_bound_snapshot_mismatch",
      eventId: capabilityBinding.eventId,
      matchedBy,
    }, 409, { "cache-control": "no-store" });
  }

  publishRealtimeEvent({
    id: target.id,
    tenant_id: target.tenant_id || null,
    tenant_slug: target.tenant_slug || null,
    batch_id: target.batch_id || null,
    tag_id: target.tag_id || null,
    bid: target.bid || bid,
    uid_hex: target.uid_hex || targetUid,
    result: target.result || "UNKNOWN",
    city: finalCity,
    country_code: finalCountry,
    lat,
    lng,
    location_source: locationSource,
    location_accuracy_m: accuracy,
    device_label: device.deviceLabel,
    device_os: device.deviceOs,
    device_type: device.deviceType,
    product_name: target.product_name || null,
    source: "real",
    created_at: target.created_at || new Date().toISOString(),
    meta: metaPayload,
  });
  const publicLocation = sanitizePublicLocationProjection({
    lat,
    lng,
    locationSource,
    geoPrecision: hasBrowserGps ? "approximate" : "none",
    locationAccuracyM: accuracy,
    metadata: metaPayload,
  });
  return json({
    ok: true,
    updated: true,
    eventId: target.id,
    matchedBy,
    location: {
      source: locationSource,
      precision: hasBrowserGps ? "approximate" : "none",
      accuracyM: accuracy,
      city: finalCity,
      countryCode: finalCountry,
      lat: publicLocation.lat,
      lng: publicLocation.lng,
      tapReceivedAt: target.created_at ? new Date(String(target.created_at)).toISOString() : null,
      measuredAt: locationMeasuredAt,
      receivedAt: locationReceivedAt,
      timing: hasBrowserGps ? "confirmed_after_tap" : "context_after_tap",
    },
    client_values_verified: false,
  }, 200, { "cache-control": "no-store" });
}
