export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../../../../lib/db";
import { json } from "../../../../../../lib/http";
import { awardPoints, getActiveProgram } from "../../../../../../lib/loyalty-service";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const eventId = (await params).eventId;
  const body = await req.json().catch(() => ({}));
  const memberKey = String(body.memberKey || req.headers.get("x-forwarded-for") || "anonymous").trim();

  const eventRows = await sql`
    SELECT e.id, e.tenant_id, e.uid_hex, e.result, e.batch_id
    FROM events e
    WHERE e.id = ${eventId}
    LIMIT 1
  `;
  const event = eventRows[0];
  if (!event) return json({ ok: false, reason: "event_not_found" }, 404);

  if (["REPLAY_SUSPECT", "INVALID", "TAMPER_RISK", "TAMPER", "REVOKED", "NOT_REGISTERED"].includes(String(event.result).toUpperCase())) {
    return json({ ok: false, reason: "event_security_blocked" }, 403);
  }

  const program = await getActiveProgram(event.tenant_id);
  if (!program) return json({ ok: false, reason: "no_active_program" }, 404);

  // Find member
  const memberRows = await sql`
    SELECT id, status FROM loyalty_members
    WHERE program_id = ${program.id} AND member_key = ${memberKey}
    LIMIT 1
  `;
  const member = memberRows[0];
  if (!member) return json({ ok: false, reason: "member_not_found" }, 404);

  const delta = Number(program.rules_json?.points_per_tap || 10);
  const idempotencyKey = `claim_tap_${eventId}_${member.id}`;

  const award = await awardPoints({
    tenantId: event.tenant_id,
    programId: program.id,
    memberId: member.id,
    tapEventId: eventId,
    delta,
    source: "TAP_VALID",
    idempotencyKey,
    reason: "Claimed manual tap",
    metadata: { uidHex: event.uid_hex },
  });

  if (!award.awarded && award.duplicate) {
    return json({ ok: false, reason: "already_claimed", points: 0 }, 409);
  }

  return json({
    ok: true,
    pointsAwarded: delta,
    message: "Points claimed successfully"
  });
}
