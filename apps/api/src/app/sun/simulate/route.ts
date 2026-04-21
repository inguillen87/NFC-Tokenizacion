export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { anchorTokenizationRequest } from "../../../lib/tokenization-engine";

type SimulateBody = {
  bid?: string;
  uid?: string;
  result?: "VALID" | "REPLAY_SUSPECT" | "TAMPER_RISK" | "INVALID";
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  autoTokenize?: boolean;
};

function clean(value: unknown, max = 120) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(req: Request): Promise<Response> {
  const providedKey = clean(req.headers.get("x-sun-sim-key"), 200);
  const expectedKey = clean(process.env.SUN_SIMULATE_API_KEY, 200);
  if (expectedKey && providedKey !== expectedKey) {
    return json({ ok: false, reason: "invalid simulation key" }, 401);
  }

  const body = await req.json().catch(() => ({})) as SimulateBody;
  const bid = clean(body.bid).toUpperCase();
  const uid = clean(body.uid).toUpperCase();
  const result = clean(body.result || "VALID", 32).toUpperCase();
  if (!bid || !uid) return json({ ok: false, reason: "bid and uid required" }, 400);

  const batch = (await sql/*sql*/`
    SELECT b.id, b.tenant_id
    FROM batches b
    WHERE b.bid = ${bid}
    LIMIT 1
  `)[0];
  if (!batch?.id) return json({ ok: false, reason: "unknown batch" }, 404);

  const city = clean(body.city || "Simulation City", 80);
  const country = clean(body.country || "AR", 3).toUpperCase();
  const lat = Number.isFinite(Number(body.lat)) ? Number(body.lat) : null;
  const lng = Number.isFinite(Number(body.lng)) ? Number(body.lng) : null;
  const reason = result === "VALID" ? "sun_simulated_ok" : result === "REPLAY_SUSPECT" ? "sun_simulated_replay" : result === "TAMPER_RISK" ? "sun_simulated_tamper" : "sun_simulated_invalid";

  const insertedEvent = (await sql/*sql*/`
    INSERT INTO events (
      tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status, result, reason,
      city, country_code, lat, lng, source, user_agent, meta, raw_query
    ) VALUES (
      ${batch.tenant_id},
      ${batch.id},
      ${uid},
      0,
      0,
      ${result === "VALID"},
      ${result === "VALID"},
      ${result === "VALID" ? "active" : "revoked"}::tag_status,
      ${result},
      ${reason},
      ${city},
      ${country},
      ${lat},
      ${lng},
      'demo',
      ${"sun-simulated-client/1.0"},
      ${JSON.stringify({ simulated: true, created_by: "sun_simulate_route" })}::jsonb,
      ${JSON.stringify({ simulated: true, bid, uid })}::jsonb
    )
    RETURNING id, created_at
  `)[0];

  let tokenization: Record<string, unknown> | null = null;
  if (result === "VALID" && body.autoTokenize === true) {
    const request = (await sql/*sql*/`
      INSERT INTO tokenization_requests (
        tenant_id, batch_id, bid, uid_hex, status, network, asset_ref, requested_by, next_attempt_at, meta
      ) VALUES (
        ${batch.tenant_id},
        ${batch.id},
        ${bid},
        ${uid},
        'pending',
        'polygon-amoy',
        ${`${bid}:${uid}`},
        'sun_simulation',
        now(),
        ${JSON.stringify({ simulated: true, source: "sun_simulate_route" })}::jsonb
      )
      RETURNING id, status, requested_at
    `)[0];
    tokenization = request || null;
    if (request?.id) {
      tokenization = await anchorTokenizationRequest({ requestId: String(request.id), processor: "sun_simulation" });
    }
  }

  return json({
    ok: true,
    simulated: true,
    event: insertedEvent || null,
    tap: { bid, uid, result, reason, city, country, lat, lng },
    tokenization,
  });
}
