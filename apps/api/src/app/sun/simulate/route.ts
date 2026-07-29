export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, timingSafeEqual } from "node:crypto";
import { RequestBodyTooLargeError, readRequestTextBounded } from "../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { anchorTokenizationRequest } from "../../../lib/tokenization-engine";
import { ensureTokenizationRequestsSchema } from "../../../lib/tokenization-schema";
import { normalizeCoordinatePair } from "../../../lib/approximate-location";

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

const MAX_SIMULATION_BODY_BYTES = 32 * 1024;
const SIMULATION_RESULTS = new Set(["VALID", "REPLAY_SUSPECT", "TAMPER_RISK", "INVALID"]);

function clean(value: unknown, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function secretValue(value: unknown) {
  const secret = String(value || "").trim();
  return secret.length <= 512 ? secret : "";
}

function secretMatches(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const providedDigest = createHash("sha256").update(provided, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || clean(process.env.VERCEL_ENV, 32).toLowerCase() === "production";
}

export async function POST(req: Request): Promise<Response> {
  const providedKey = secretValue(req.headers.get("x-sun-sim-key"));
  const expectedKey = secretValue(process.env.SUN_SIMULATE_API_KEY);
  if (!expectedKey) {
    return json(
      { ok: false, reason: isProductionRuntime() ? "not_found" : "simulation_not_configured" },
      isProductionRuntime() ? 404 : 503,
      { "cache-control": "no-store" },
    );
  }
  if (!secretMatches(providedKey, expectedKey)) {
    return json({ ok: false, reason: "unauthorized" }, 401, { "cache-control": "no-store" });
  }

  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "simulation",
    subjectId: `sun-simulation-key:${createHash("sha256").update(expectedKey, "utf8").digest("hex")}`,
    globalPrincipal: true,
  });
  if (rateLimited) return rateLimited;

  let body: SimulateBody;
  try {
    const rawBody = await readRequestTextBounded(req, MAX_SIMULATION_BODY_BYTES);
    const parsed = JSON.parse(rawBody || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("simulation_payload_invalid");
    body = parsed as SimulateBody;
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json(
      { ok: false, reason: tooLarge ? "simulation_body_too_large" : "simulation_payload_invalid" },
      tooLarge ? 413 : 400,
      { "cache-control": "no-store" },
    );
  }

  const bid = clean(body.bid).toUpperCase();
  const uid = clean(body.uid).toUpperCase();
  const result = clean(body.result || "VALID", 32).toUpperCase();
  if (!bid || !uid) return json({ ok: false, reason: "bid and uid required" }, 400);
  if (!SIMULATION_RESULTS.has(result)) return json({ ok: false, reason: "invalid simulation result" }, 400);

  const batch = (await sql/*sql*/`
    SELECT b.id, b.tenant_id
    FROM batches b
    WHERE b.bid = ${bid}
    LIMIT 1
  `)[0];
  if (!batch?.id) return json({ ok: false, reason: "unknown batch" }, 404);

  const city = clean(body.city || "Simulation City", 80);
  const country = clean(body.country || "AR", 3).toUpperCase();
  const coordinate = normalizeCoordinatePair(body.lat, body.lng);
  const lat = coordinate?.lat ?? null;
  const lng = coordinate?.lng ?? null;
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
    await ensureTokenizationRequestsSchema();
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
      tokenization = await anchorTokenizationRequest({
        requestId: String(request.id),
        tenantId: String(batch.tenant_id),
        processor: "sun_simulation",
      });
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
