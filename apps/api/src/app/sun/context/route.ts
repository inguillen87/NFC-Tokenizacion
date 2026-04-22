export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { publishRealtimeEvent } from "../../../lib/realtime-events";

type ContextBody = {
  bid?: string;
  uid?: string;
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

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as ContextBody;
  const bid = String(body.bid || "").trim();
  const uid = String(body.uid || "").trim().toUpperCase();
  const ctr = asNumber(body.ctr);

  if (!bid || !uid) {
    return json({ ok: false, reason: "bid + uid required" }, 400);
  }

  const batchRows = await sql/*sql*/`SELECT id FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "unknown batch" }, 404);

  const lat = asNumber(body.geo?.lat);
  const lng = asNumber(body.geo?.lng);
  const metaPayload = {
    sun_context: {
      status: body.contextStatus || "unknown",
      scannedAt: body.scannedAt || new Date().toISOString(),
      geo: {
        lat,
        lng,
        accuracy: asNumber(body.geo?.accuracy),
        altitude: asNumber(body.geo?.altitude),
        speed: asNumber(body.geo?.speed),
      },
      client: body.client || {},
      geoError: body.geoError || null,
    },
  };

  const targetRows = ctr === null
    ? await sql/*sql*/`
      SELECT id
      FROM events
      WHERE batch_id = ${batch.id}
        AND uid_hex = ${uid}
      ORDER BY created_at DESC
      LIMIT 1
    `
    : await sql/*sql*/`
      SELECT id
      FROM events
      WHERE batch_id = ${batch.id}
        AND uid_hex = ${uid}
        AND sdm_read_ctr = ${ctr}
      ORDER BY created_at DESC
      LIMIT 1
    `;
  const target = targetRows[0];
  if (!target) return json({ ok: false, reason: "event not found" }, 404);
  const matchedBy = ctr === null ? "latest_uid_event" : "uid_and_ctr";

  try {
    await sql/*sql*/`
      UPDATE events
      SET meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify(metaPayload)}::jsonb,
          lat = COALESCE(${lat}, lat),
          lng = COALESCE(${lng}, lng),
          geo_lat = COALESCE(${lat}, geo_lat),
          geo_lng = COALESCE(${lng}, geo_lng),
          city = COALESCE(city, geo_city),
          country_code = COALESCE(country_code, geo_country),
          device_label = COALESCE(device_label, ${String((body.client?.platform as string) || "").slice(0, 80) || null})
      WHERE id = ${target.id}
    `;
    publishRealtimeEvent({
      id: target.id,
      bid,
      uid_hex: uid,
      result: String(body.contextStatus || "unknown").toUpperCase(),
      city: null,
      country_code: null,
      lat,
      lng,
      source: "mobile_action",
      created_at: new Date().toISOString(),
    });
    return json({ ok: true, updated: true, eventId: target.id, matchedBy });
  } catch {
    try {
      await sql/*sql*/`
        UPDATE events
        SET meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify(metaPayload)}::jsonb
        WHERE id = ${target.id}
      `;
      return json({ ok: true, updated: true, eventId: target.id, mode: "meta_only", matchedBy });
    } catch {
      return json({ ok: true, updated: false, eventId: target.id, mode: "legacy_schema", matchedBy });
    }
  }
}
