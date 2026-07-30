export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { RequestBodyTooLargeError, readRequestTextBounded } from "../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import {
  ensureTokenizationCommercialScopeSchema,
  isTokenizationCommercialScopeSchemaError,
  TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED,
} from "../../../lib/tokenization-schema";
import { normalizeCoordinatePair } from "../../../lib/approximate-location";
import { CanonicalEventWriteError, writeCanonicalEvent } from "../../../lib/canonical-event-writer";
import { recordTokenizationCanonicalEvent } from "../../../lib/tokenization-event-service";

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

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id
    FROM batches b
    WHERE b.bid = ${bid}
    ORDER BY b.created_at ASC
    LIMIT 2
  `;
  if (batchRows.length > 1) return json({ ok: false, reason: "ambiguous batch; use a globally unique BID" }, 409);
  const batch = batchRows[0];
  if (!batch?.id) return json({ ok: false, reason: "unknown batch" }, 404);

  const city = clean(body.city || "Simulation City", 80);
  const country = clean(body.country || "AR", 3).toUpperCase();
  const coordinate = normalizeCoordinatePair(body.lat, body.lng);
  const lat = coordinate?.lat ?? null;
  const lng = coordinate?.lng ?? null;
  const reason = result === "VALID" ? "sun_simulated_ok" : result === "REPLAY_SUSPECT" ? "sun_simulated_replay" : result === "TAMPER_RISK" ? "sun_simulated_tamper" : "sun_simulated_invalid";

  const suppliedOperationKey = clean(req.headers.get("idempotency-key"), 220);
  const operationSuffix = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,220}$/.test(suppliedOperationKey)
    ? suppliedOperationKey
    : randomUUID();
  let insertedEvent;
  try {
    insertedEvent = await writeCanonicalEvent({
      operationKey: `sun-simulate:${operationSuffix}`,
      eventName: "demo.tap.simulated",
      mode: "simulated",
      family: "tap",
      batchId: String(batch.id),
      uidHex: uid,
      eventType: result === "VALID" ? "TAP_VALID" : result === "REPLAY_SUSPECT" ? "REPLAY_SUSPECT" : result === "TAMPER_RISK" ? "TAMPERED" : "TAP_INVALID",
      result,
      verdict: result === "VALID" ? "valid" : result === "REPLAY_SUSPECT" ? "replay_suspect" : result === "TAMPER_RISK" ? "tampered" : "invalid",
      riskLevel: result === "VALID" ? "none" : result === "REPLAY_SUSPECT" ? "high" : result === "TAMPER_RISK" ? "critical" : "high",
      reason,
      readCounter: 0,
      sdmReadCtr: 0,
      cmacOk: result === "VALID",
      allowlisted: result === "VALID",
      userAgent: "sun-simulated-client/1.0",
      city,
      countryCode: country,
      lat,
      lng,
      meta: { simulated: true, created_by: "sun_simulate_route", metric_scope: "simulation" },
      webhookData: {
        result,
        riskLevel: result === "VALID" ? "none" : result === "TAMPER_RISK" ? "critical" : "high",
        uidHash: `sha256:${createHash("sha256").update(uid, "utf8").digest("hex")}`,
      },
    });
  } catch (error) {
    const reason = error instanceof CanonicalEventWriteError ? error.code : "canonical_event_write_unavailable";
    return json({ ok: false, reason, simulated: true, source: "demo" }, 503, { "cache-control": "no-store", "retry-after": "2" });
  }

  let tokenization: Record<string, unknown> | null = null;
  if (result === "VALID" && body.autoTokenize === true) {
    try {
      await ensureTokenizationCommercialScopeSchema();
    } catch (error) {
      if (isTokenizationCommercialScopeSchemaError(error)) {
        return json({
          ok: false,
          reason: TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED,
          simulated: true,
          source: "demo",
        }, 503, { "cache-control": "no-store", "retry-after": "2" });
      }
      throw error;
    }
    const request = (await sql/*sql*/`
      INSERT INTO tokenization_requests (
        tenant_id, batch_id, tag_id, source_event_id, source_event_created_at, bid, uid_hex, execution_class,
        status, network, asset_ref, requested_by, next_attempt_at, external_ref, meta
      ) VALUES (
        ${batch.tenant_id},
        ${batch.id},
        ${insertedEvent.tagId},
        ${insertedEvent.eventId}::bigint,
        ${insertedEvent.eventCreatedAt},
        ${bid},
        ${uid},
        'simulation',
        'simulated',
        'simulation',
        ${`${bid}:${uid}`},
        'sun_simulation',
        NULL,
        ${`simulation:sun:${insertedEvent.eventId}`},
        ${JSON.stringify({ simulated: true, source: "sun_simulate_route", event_id: insertedEvent.eventId, execution_class: "simulation" })}::jsonb
      )
      RETURNING id, tenant_id, batch_id, tag_id, source_event_id, source_event_created_at,
                bid, uid_hex, execution_class, status, network, external_ref, requested_at
    `)[0];
    if (request?.id) {
      const canonicalEvent = await recordTokenizationCanonicalEvent({
        request,
        state: "simulated",
        runtimeMode: "simulated",
        processor: "sun_simulation",
      });
      if (!canonicalEvent.ok) {
        return json({
          ok: false,
          reason: canonicalEvent.reason,
          simulated: true,
          source: "demo",
          operation_committed: true,
          tokenization_request: request,
        }, 503, { "cache-control": "no-store", "retry-after": "2" });
      }
      tokenization = { ...request, simulated: true, canonical_event: canonicalEvent.receipt };
    }
  }

  return json({
    ok: true,
    simulated: true,
    source: "demo",
    metric_scope: "simulation",
    event: insertedEvent || null,
    tap: { bid, uid, result, reason, city, country, lat, lng },
    tokenization,
  });
}
