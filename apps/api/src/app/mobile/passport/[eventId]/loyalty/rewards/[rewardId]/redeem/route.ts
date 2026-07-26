export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../../../../../lib/consumer-auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../../../../lib/db";
import { json } from "../../../../../../../../lib/http";
import { getActiveProgram, getTapEvent, redeemReward } from "../../../../../../../../lib/loyalty-service";
import { consumeSunFreshHandoff } from "../../../../../../../../lib/sun-fresh-handoff";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string; rewardId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "consumer",
    subjectId: `consumer:${consumer.id}:loyalty-redeem`,
  });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  const { eventId, rewardId } = await params;
  if (!/^\d+$/.test(eventId)) return json({ ok: false, error: "invalid_event_id" }, 400);
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  const capability = await consumeSunFreshHandoff(req, body, {
    eventId: String(event.id),
    bid: String(event.bid || ""),
    uidHex: String(event.uid_hex || ""),
    readCounter: event.sdm_read_ctr,
  }, `loyalty_redeem:${String(rewardId).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64)}`);
  if (!capability.ok) {
    return json({ ok: false, error: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403);
  }
  const program = await getActiveProgram(event.tenant_id);
  if (!program) return json({ ok: false, error: "program_not_found" }, 404);
  const memberRows = await sql/*sql*/`
    SELECT id
    FROM loyalty_members
    WHERE tenant_id = ${event.tenant_id}
      AND program_id = ${program.id}
      AND consumer_id = ${consumer.id}
      AND status IN ('enrolled', 'verified')
    LIMIT 1
  `;
  const memberId = String(memberRows[0]?.id || "");
  if (!memberId) return json({ ok: false, error: "consumer_not_enrolled" }, 409);
  const redemption = await redeemReward({
    eventId: String(event.id),
    rewardId,
    memberId,
    locale: String(body.locale || consumer.preferred_locale || "es-AR").slice(0, 12),
  });
  return json(redemption, redemption.status);
}
