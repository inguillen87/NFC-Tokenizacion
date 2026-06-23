export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { publishRealtimeEvent } from "../../../lib/realtime-events";
import { findNearestCity } from "../../../lib/geo-utils";

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

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
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

function contextJson(payload: unknown, status = 200) {
  const response = json(payload, status);
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
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
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as ContextBody;
  const bid = String(body.bid || "").trim();
  const uid = String(body.uid || "").trim().toUpperCase();
  const eventId = String(body.eventId || "").trim();
  const ctr = asNumber(body.ctr);

  if (!bid || (!uid && !eventId)) {
    return contextJson({ ok: false, reason: "bid + uid_or_eventId required" }, 400);
  }
  if (eventId && !/^\d+$/.test(eventId)) {
    return contextJson({ ok: false, reason: "invalid eventId" }, 400);
  }

  const batchRows = await sql/*sql*/`SELECT id, tenant_id, bid FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return contextJson({ ok: false, reason: "unknown batch" }, 404);

  const lat = asNumber(body.geo?.lat);
  const lng = asNumber(body.geo?.lng);
  const accuracy = asNumber(body.geo?.accuracy);
  const hasBrowserGps = lat !== null && lng !== null;
  const locationSource = hasBrowserGps ? "browser_gps" : body.geoError ? "browser_geolocation_error" : "browser_context";
  const metaPayload = {
    sun_context: {
      status: body.contextStatus || "unknown",
      scannedAt: body.scannedAt || new Date().toISOString(),
      geo: {
        source: locationSource,
        lat,
        lng,
        accuracy,
        altitude: asNumber(body.geo?.altitude),
        speed: asNumber(body.geo?.speed),
      },
      client: body.client || {},
      geoError: body.geoError || null,
    },
  };

  const targetRows = eventId
    ? await sql/*sql*/`
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
        AND e.created_at >= now() - interval '6 hours'
      LIMIT 1
    `
    : ctr === null
    ? await sql/*sql*/`
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
      WHERE e.batch_id = ${batch.id}
        AND e.uid_hex = ${uid}
        AND e.created_at >= now() - interval '6 hours'
      ORDER BY e.created_at DESC
      LIMIT 1
    `
    : await sql/*sql*/`
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
      WHERE e.batch_id = ${batch.id}
        AND e.uid_hex = ${uid}
        AND e.sdm_read_ctr = ${ctr}
        AND e.created_at >= now() - interval '6 hours'
      ORDER BY e.created_at DESC
      LIMIT 1
    `;
  const target = targetRows[0];
  if (!target) return contextJson({ ok: false, reason: "recent event not found" }, 404);
  const matchedBy = eventId ? "event_id" : ctr === null ? "latest_uid_event" : "uid_and_ctr";

  let resolvedCity: string | null = null;
  let resolvedCountry: string | null = null;
  if (lat !== null && lng !== null) {
    const matchedCity = findNearestCity(lat, lng);
    if (matchedCity) {
      resolvedCity = matchedCity.city;
      resolvedCountry = matchedCity.countryCode;
    }
  }

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
          city = COALESCE(${resolvedCity}, city, geo_city),
          country_code = COALESCE(${resolvedCountry}, country_code, geo_country),
          device_label = COALESCE(device_label, ${String((body.client?.platform as string) || "").slice(0, 80) || null})
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
      result: target.result || String(body.contextStatus || "unknown").toUpperCase(),
      city: resolvedCity || target.city || null,
      country_code: resolvedCountry || target.country_code || null,
      lat: lat ?? firstNumber(target.lat),
      lng: lng ?? firstNumber(target.lng),
      location_source: locationSource,
      location_accuracy_m: accuracy,
      product_name: target.product_name || null,
      source: "real",
      created_at: target.created_at || new Date().toISOString(),
      meta: metaPayload,
    });
    return contextJson({ ok: true, updated: true, eventId: target.id, matchedBy, source: locationSource, accuracyM: accuracy });
  } catch {
    try {
      await sql/*sql*/`
        UPDATE events
        SET meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify(metaPayload)}::jsonb
        WHERE id = ${target.id}
      `;
      return contextJson({ ok: true, updated: true, eventId: target.id, mode: "meta_only", matchedBy, source: locationSource, accuracyM: accuracy });
    } catch {
      return contextJson({ ok: true, updated: false, eventId: target.id, mode: "legacy_schema", matchedBy, source: locationSource, accuracyM: accuracy });
    }
  }
}
