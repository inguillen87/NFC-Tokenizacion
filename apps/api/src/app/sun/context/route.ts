export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { publishRealtimeEvent } from "../../../lib/realtime-events";
import { findNearestCity } from "../../../lib/geo-utils";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { consumeSunFreshHandoff } from "../../../lib/sun-fresh-handoff";

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
  const capability = await consumeSunFreshHandoff(req, body, {
    bid,
    eventId,
    uidHex: uid,
    readCounter: ctr,
  }, "sun_context");
  if (!capability.ok) {
    return json({ ok: false, reason: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403, { "cache-control": "no-store" });
  }

  const batchRows = await sql/*sql*/`SELECT id, tenant_id, bid FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "unknown batch" }, 404, { "cache-control": "no-store" });

  const rawLat = asNumber(body.geo?.lat);
  const rawLng = asNumber(body.geo?.lng);
  const rawAccuracy = asNumber(body.geo?.accuracy);
  const lat = rawLat !== null && rawLat >= -90 && rawLat <= 90 ? rawLat : null;
  const lng = rawLng !== null && rawLng >= -180 && rawLng <= 180 ? rawLng : null;
  const accuracy = rawAccuracy !== null && rawAccuracy >= 0 && rawAccuracy <= 50_000 ? rawAccuracy : null;
  const hasBrowserGps = lat !== null && lng !== null;
  const locationSource = hasBrowserGps ? "browser_gps_reported" : body.geoError ? "browser_geolocation_error_reported" : "browser_context_reported";
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
        lat,
        lng,
        accuracy,
        altitude: asNumber(body.geo?.altitude),
        speed: asNumber(body.geo?.speed),
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
  const shouldResolveCity = hasBrowserGps && (!target.city || !target.country_code);
  if (shouldResolveCity && lat !== null && lng !== null) {
    const matchedCity = findNearestCity(lat, lng);
    if (matchedCity) {
      resolvedCity = matchedCity.city;
      resolvedCountry = matchedCity.countryCode;
    }
  }
  const finalCity = firstText(target.city) || resolvedCity || null;
  const finalCountry = firstText(target.country_code) || resolvedCountry || null;

  try {
    await ensureEventLocationContextSchema();
    await sql/*sql*/`
      UPDATE events
      SET meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify(metaPayload)}::jsonb,
          lat = COALESCE(${lat}, lat),
          lng = COALESCE(${lng}, lng),
          geo_lat = COALESCE(${lat}, geo_lat),
          geo_lng = COALESCE(${lng}, geo_lng),
          location_accuracy_m = COALESCE(${accuracy}, location_accuracy_m),
          location_source = ${locationSource},
          location_updated_at = now(),
          city = COALESCE(NULLIF(city, ''), ${resolvedCity}, geo_city),
          country_code = COALESCE(NULLIF(country_code, ''), ${resolvedCountry}, geo_country),
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
    return json({ ok: true, updated: true, eventId: target.id, matchedBy, source: locationSource, accuracyM: accuracy, city: finalCity, countryCode: finalCountry, client_values_verified: false }, 200, { "cache-control": "no-store" });
  } catch {
    try {
      await sql/*sql*/`
        UPDATE events
        SET meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify(metaPayload)}::jsonb
        WHERE id = ${target.id}
      `;
      return json({ ok: true, updated: true, eventId: target.id, mode: "meta_only", matchedBy, source: locationSource, accuracyM: accuracy, client_values_verified: false }, 200, { "cache-control": "no-store" });
    } catch {
      return json({ ok: false, updated: false, reason: "context_persistence_unavailable", eventId: target.id, mode: "legacy_schema", matchedBy }, 503, { "cache-control": "no-store" });
    }
  }
}
