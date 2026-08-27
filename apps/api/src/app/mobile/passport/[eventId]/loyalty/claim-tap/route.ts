export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../../lib/db";
import { json } from "../../../../../../lib/http";
import { awardPoints, evaluateLoyaltyForTap, getActiveProgram, getTapEvent } from "../../../../../../lib/loyalty-service";
import { consumeSunFreshHandoff } from "../../../../../../lib/sun-fresh-handoff";
import { readCurrentTapCommercialRights } from "../../../../../../lib/tap-commercial-rights";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, reason: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "consumer",
    subjectId: `consumer:${consumer.id}:loyalty-claim-tap`,
  });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  const { eventId } = await params;
  if (!/^\d+$/.test(eventId)) return json({ ok: false, reason: "invalid_event_id" }, 400);
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, reason: "event_not_found" }, 404);
  const capability = await consumeSunFreshHandoff(req, body, {
    eventId: String(event.id),
    bid: String(event.bid || ""),
    uidHex: String(event.uid_hex || ""),
    readCounter: event.sdm_read_ctr,
  }, "loyalty_claim_tap");
  if (!capability.ok) {
    return json({ ok: false, reason: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403);
  }
  const currentRights = await readCurrentTapCommercialRights(event.id);
  if (!currentRights.allowed) {
    return json({ ok: false, reason: currentRights.reason, pointsAwarded: 0 }, currentRights.reason === "manual_opening_declared" ? 409 : 503);
  }
  const program = await getActiveProgram(event.tenant_id);
  if (!program) return json({ ok: false, reason: "no_active_program" }, 404);
  const memberRows = await sql/*sql*/`
    SELECT id, status
    FROM loyalty_members
    WHERE tenant_id = ${event.tenant_id}
      AND program_id = ${program.id}
      AND consumer_id = ${consumer.id}
      AND status IN ('enrolled', 'verified')
    LIMIT 1
  `;
  const member = memberRows[0];
  if (!member) return json({ ok: false, reason: "consumer_not_enrolled" }, 409);
  const eligibility = await evaluateLoyaltyForTap({ eventId: String(event.id), memberId: member.id, program, event });
  if (!eligibility.award) {
    const duplicate = eligibility.reason === "already_awarded";
    return json({ ok: false, reason: eligibility.reason, pointsAwarded: 0 }, duplicate ? 409 : 403);
  }
  const rules = typeof program.rules_json === "string" ? JSON.parse(program.rules_json || "{}") : (program.rules_json || {});
  const configuredDelta = Number(rules.pointsPerValidTap || 10);
  const delta = Number.isSafeInteger(configuredDelta) && configuredDelta > 0 && configuredDelta <= 10_000 ? configuredDelta : 10;
  const award = await awardPoints({
    tenantId: event.tenant_id,
    programId: program.id,
    memberId: member.id,
    tapEventId: String(event.id),
    delta,
    source: "TAP_VALID",
    idempotencyKey: `tap:${event.id}:member:${member.id}`,
    reason: "Eligible NFC event claimed by authenticated member",
    metadata: { result: event.result || null },
  });
  if (!award.awarded) return json({ ok: false, reason: "already_claimed", pointsAwarded: 0 }, 409);
  return json({ ok: true, pointsAwarded: delta, claim_status: "awarded" });
}
