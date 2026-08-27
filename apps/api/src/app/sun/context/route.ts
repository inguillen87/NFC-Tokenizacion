export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { publishRealtimeEvent } from "../../../lib/realtime-events";
import { findNearestCity } from "../../../lib/geo-utils";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { requireSunFreshHandoff } from "../../../lib/sun-fresh-handoff";
import { normalizeConsentedApproximateLocation } from "../../../lib/approximate-location";

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
    altitude?: number | null;
    speed?: number | null;
  };
  geoConsent?: boolean;
  geoPrecision?: string;
  client?: Record<string, unknown>;
  geoError?: string;
};

function asNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
    if (text) return text;
  }
  return "";
}

function inferDeviceOs(platform: string, userAgent: string) {
  const normalized = `${platform} ${userAgent}`.toLowerCase();
  if (/iphone|ipad|ios|mac os/.test(normalized)) return "iOS";
  if (/android/.test(normalized)) return "Android";
  if (/windows/.test(normalized)) return "Windows";
  if (/linux/.test(normalized)) return "Linux";
  return "";
}

function inferDeviceType(mobile: unknown, platform: string, userAgent: string) {
  if (mobile === true) return "mobile";
  const normalized = `${platform} ${userAgent}`.toLowerCase();
  if (/ipad|tablet/.test(normalized)) return "tablet";
  if (/mobi|iphone|android/.test(normalized)) return "mobile";
  return "desktop";
}

function deviceContext(client: Record<string, unknown> | undefined) {
  const platform = firstText(client?.platform);
  const userAgent = firstText(client?.userAgent, client?.browser);
  const deviceOs = firstText(client?.os) || inferDeviceOs(platform, userAgent);
  const deviceType = firstText(client?.deviceType) || inferDeviceType(client?.mobile, platform, userAgent);
  const deviceLabel = firstText(platform, deviceOs, deviceType);
  return {
    deviceLabel: deviceLabel.slice(0, 80) || null,
    deviceOs: deviceOs || null,
    deviceType: deviceType || null,
  };
}

function safeClientContext(client: Record<string, unknown> | undefined) {
  const viewport = client?.viewport && typeof client.viewport === "object" && !Array.isArray(client.viewport)
    ? client.viewport as Record<string, unknown>
    : {};
  return {
    language: firstText(client?.language).slice(0, 24) || null,
    languages: Array.isArray(client?.languages)
      ? client.languages.map((value) => firstText(value).slice(0, 24)).filter(Boolean).slice(0, 8)
      : [],
    platform: firstText(client?.platform).slice(0, 80) || null,
    userAgent: firstText(client?.userAgent).slice(0, 512) || null,
    mobile: client?.mobile === true,
    timezone: firstText(client?.timezone).slice(0, 80) || null,
    viewport: {
      width: asNumber(viewport.width),
      height: asNumber(viewport.height),
      pixelRatio: asNumber(viewport.pixelRatio),
    },
  };
}

async function ensureEventLocationContextSchema() {
  try {
    await sql/*sql*/`ALTER TABLE events ADD COLUMN IF NOT EXISTS location_accuracy_m double precision`;
    await sql/*sql*/`ALTER TABLE events ADD COLUMN IF NOT EXISTS location_source text`;
    await sql/*sql*/`ALTER TABLE events ADD COLUMN IF NOT EXISTS location_updated_at timestamptz`;
  } catch {
    // Older deployments can still persist context in meta.
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
}

export async function POST(req: Request): Promise<Response> {
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "platform",
    subjectId: "sun-context:capability",
  });
  if (limited) return limited;
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

  if (!BID_RE.test(bid) || !UID_RE.test(uid) || !/^\d+$/.test(eventId)) {
    return json({ ok: false, reason: "valid bid, uid and eventId required" }, 400, { "cache-control": "no-store" });
  }
  if (ctr === null || !Number.isSafeInteger(ctr) || ctr < 0) {
    return json({ ok: false, reason: "valid ctr required" }, 400, { "cache-control": "no-store" });
  }
  // Location context is a replace-by-event update, not a one-shot commercial
  // action. Keep it retryable during the short signed capability lifetime while
  // still binding every write to the exact physical event, tag and read counter.
  const capability = requireSunFreshHandoff(req, body, {
    bid,
    eventId,
    uidHex: uid,
    readCounter: ctr,
  });
  if (!capability.ok) {
    return json({ ok: false, reason: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403, { "cache-control": "no-store" });
  }

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
  const locationSource = hasBrowserGps
    ? "browser_gps_approximate_consent"
    : body.geoError
      ? "browser_geolocation_error_reported"
      : body.geo
        ? "browser_geolocation_ignored_without_consent"
        : "browser_context_reported";
  const client = safeClientContext(body.client);
  const device = deviceContext(client);
  const metaPayload = {
    sun_context: {
      evidence_scope: "signed_fresh_event_capability",
      client_values_verified: false,
      status: firstText(body.contextStatus).slice(0, 80) || "unknown",
      clientReportedAt: firstText(body.scannedAt).slice(0, 80) || null,
      receivedAt: new Date().toISOString(),
      geo: {
        source: locationSource,
        verification: "client_reported_not_independently_verified",
        consent: body.geoConsent === true,
        precision: hasBrowserGps ? "approximate" : "not_stored",
        normalization: hasBrowserGps ? "rounded_3_decimals_min_150m" : approximateLocation.reason,
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
        COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, '')) AS city,
        COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) AS country_code,
        COALESCE(e.lat, e.geo_lat) AS lat,
        COALESCE(e.lng, e.geo_lng) AS lng,
        e.location_source,
        e.location_accuracy_m,
        e.geo_precision,
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
        AND UPPER(e.uid_hex) = ${uid}
        AND e.sdm_read_ctr = ${ctr}
        AND e.created_at >= now() - interval '10 minutes'
      LIMIT 1
    `;
  const target = targetRows[0];
  if (!target) return json({ ok: false, reason: "capability_bound_event_not_found" }, 404, { "cache-control": "no-store" });
  const matchedBy = "signed_event_bid_uid_ctr";

  let resolvedCity: string | null = null;
  let resolvedCountry: string | null = null;
  if (hasBrowserGps && lat !== null && lng !== null) {
    const matchedCity = findNearestCity(lat, lng);
    if (matchedCity) {
      resolvedCity = matchedCity.city;
      resolvedCountry = matchedCity.countryCode;
    }
  }
  // A consented device location supersedes the earlier edge/IP approximation.
  // If the rounded coordinate is outside our coarse city catalog, clear the old
  // IP label instead of attaching a known-wrong city to the new coordinates.
  const finalCity = hasBrowserGps ? resolvedCity : firstText(target.city) || null;
  const finalCountry = hasBrowserGps ? resolvedCountry : firstText(target.country_code) || null;
  const persistedLocationSource = hasBrowserGps
    ? locationSource
    : firstText(target.location_source) || null;
  const persistedAccuracy = hasBrowserGps
    ? accuracy
    : firstNumber(target.location_accuracy_m);

  try {
    await ensureEventLocationContextSchema();
    await sql/*sql*/`
      UPDATE events
      SET meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify(metaPayload)}::jsonb,
          lat = CASE WHEN ${hasBrowserGps} THEN ${lat} ELSE lat END,
          lng = CASE WHEN ${hasBrowserGps} THEN ${lng} ELSE lng END,
          geo_lat = CASE WHEN ${hasBrowserGps} THEN ${lat} ELSE geo_lat END,
          geo_lng = CASE WHEN ${hasBrowserGps} THEN ${lng} ELSE geo_lng END,
          location_accuracy_m = CASE WHEN ${hasBrowserGps} THEN ${accuracy} ELSE location_accuracy_m END,
          location_source = CASE WHEN ${hasBrowserGps} THEN ${locationSource} ELSE location_source END,
          location_updated_at = CASE WHEN ${hasBrowserGps} THEN now() ELSE location_updated_at END,
          geo_precision = CASE WHEN ${hasBrowserGps} THEN 'browser_rounded' ELSE geo_precision END,
          city = CASE WHEN ${hasBrowserGps} THEN ${resolvedCity} ELSE city END,
          country_code = CASE WHEN ${hasBrowserGps} THEN ${resolvedCountry} ELSE country_code END,
          geo_city = CASE WHEN ${hasBrowserGps} THEN ${resolvedCity} ELSE geo_city END,
          geo_country = CASE WHEN ${hasBrowserGps} THEN ${resolvedCountry} ELSE geo_country END,
          device_label = COALESCE(NULLIF(device_label, ''), ${device.deviceLabel})
      WHERE id = ${target.id}
    `;
    publishRealtimeEvent({
      id: target.id,
      tenant_id: target.tenant_id || null,
      tenant_slug: target.tenant_slug || null,
      batch_id: target.batch_id || null,
      tag_id: target.tag_id || null,
      bid: target.bid || bid,
      uid_hex: target.uid_hex || uid,
      result: target.result || "UNKNOWN",
      city: finalCity,
      country_code: finalCountry,
      lat: lat ?? firstNumber(target.lat),
      lng: lng ?? firstNumber(target.lng),
      location_source: persistedLocationSource,
      location_accuracy_m: persistedAccuracy,
      device_label: device.deviceLabel,
      device_os: device.deviceOs,
      device_type: device.deviceType,
      product_name: target.product_name || null,
      source: "real",
      created_at: target.created_at || new Date().toISOString(),
      meta: metaPayload,
    });
    return json({
      ok: true,
      updated: true,
      eventId: target.id,
      matchedBy,
      source: persistedLocationSource || locationSource,
      contextSource: locationSource,
      locationUpdated: hasBrowserGps,
      accuracyM: persistedAccuracy,
      city: finalCity,
      countryCode: finalCountry,
      client_values_verified: false,
    }, 200, { "cache-control": "no-store" });
  } catch {
    try {
      await sql/*sql*/`
        UPDATE events
        SET meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify(metaPayload)}::jsonb
        WHERE id = ${target.id}
      `;
      if (hasBrowserGps) {
        return json({
          ok: false,
          updated: false,
          locationUpdated: false,
          eventId: target.id,
          mode: "meta_only",
          matchedBy,
          reason: "location_persistence_unavailable",
          client_values_verified: false,
        }, 503, { "cache-control": "no-store" });
      }
      return json({ ok: true, updated: true, locationUpdated: false, eventId: target.id, mode: "meta_only", matchedBy, source: locationSource, accuracyM: accuracy, client_values_verified: false }, 200, { "cache-control": "no-store" });
    } catch {
      return json({ ok: false, updated: false, reason: "context_persistence_unavailable", eventId: target.id, mode: "legacy_schema", matchedBy }, 503, { "cache-control": "no-store" });
    }
  }
}
