export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { json } from "../../../../../../lib/http";
import { getActiveProgram, getOrCreateMember, getTapEvent } from "../../../../../../lib/loyalty-service";
import { consumeSunFreshHandoff } from "../../../../../../lib/sun-fresh-handoff";
import { evaluateTapCommercialRights, readCurrentTapCommercialRights } from "../../../../../../lib/tap-commercial-rights";

const MAX_BODY_BYTES = 16 * 1024;
const BLOCKED_RESULTS = new Set(["REPLAY_SUSPECT", "INVALID", "TAMPER_RISK", "TAMPER", "REVOKED", "NOT_REGISTERED", "NOT_ACTIVE"]);

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, reason: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "consumer",
    subjectId: `consumer:${consumer.id}:loyalty-enroll`,
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
  if (!evaluateTapCommercialRights(event).allowed || BLOCKED_RESULTS.has(String(event.result || "").toUpperCase())) {
    return json({ ok: false, reason: "event_security_blocked" }, 403);
  }
  const capability = await consumeSunFreshHandoff(req, body, {
    eventId: String(event.id),
    bid: String(event.bid || ""),
    uidHex: String(event.uid_hex || ""),
    readCounter: event.sdm_read_ctr,
  }, "loyalty_enroll");
  if (!capability.ok) {
    return json({ ok: false, reason: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403);
  }
  const currentRights = await readCurrentTapCommercialRights(event.id);
  if (!currentRights.allowed) {
    return json({ ok: false, reason: currentRights.reason }, currentRights.reason === "manual_opening_declared" ? 409 : 503);
  }
  const program = await getActiveProgram(event.tenant_id);
  if (!program) return json({ ok: false, reason: "no_active_program" }, 404);
  const locale = String(body.locale || consumer.preferred_locale || "es-AR").trim().slice(0, 12);
  const member = await getOrCreateMember({
    tenantId: event.tenant_id,
    programId: program.id,
    eventId: String(event.id),
    memberKey: `consumer:${consumer.id}`,
    consumerId: consumer.id,
    locale,
    email: consumer.email || null,
    phone: consumer.phone || null,
    displayName: consumer.display_name || null,
    country: event.country_code || consumer.country || null,
  });
  return json({
    ok: true,
    enrollment_status: "enrolled",
    member: { id: member.id, pointsBalance: member.points_balance, status: member.status },
  });
}
