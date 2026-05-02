export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../../../../lib/db";
import { json } from "../../../../../../lib/http";
import { ensureDefaultLoyaltyProgram, ensureLoyaltySchema } from "../../../../../../lib/loyalty-schema";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const eventId = (await params).eventId;
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  const memberKey = String(body.memberKey || req.headers.get("x-forwarded-for") || "anonymous").trim();

  if (!email && !phone) {
    return json({ ok: false, reason: "missing_contact" }, 400);
  }

  // Get the tap event and ensure it's valid
  const eventRows = await sql`
    SELECT e.id, e.tenant_id, e.uid_hex, e.result, e.batch_id, t.slug as tenant_slug
    FROM events e
    JOIN tenants t ON t.id = e.tenant_id
    WHERE e.id = ${eventId}
    LIMIT 1
  `;
  const event = eventRows[0];
  if (!event) return json({ ok: false, reason: "event_not_found" }, 404);

  await ensureLoyaltySchema();

  // Replay, revoked, tampered can't enroll via this flow for security
  if (["REPLAY_SUSPECT", "INVALID", "TAMPER_RISK", "TAMPER", "REVOKED", "NOT_REGISTERED"].includes(String(event.result).toUpperCase())) {
    return json({ ok: false, reason: "event_security_blocked" }, 403);
  }

  const program = await ensureDefaultLoyaltyProgram({ tenantId: event.tenant_id, tenantSlug: event.tenant_slug });
  if (!program) return json({ ok: false, reason: "no_active_program" }, 404);

  // Enroll member or update if exists
  const memberRows = await sql`
    INSERT INTO loyalty_members (tenant_id, program_id, member_key, email, phone, status, first_tap_at, last_tap_at)
    VALUES (${event.tenant_id}, ${program.id}, ${memberKey}, ${email || null}, ${phone || null}, 'enrolled', now(), now())
    ON CONFLICT (program_id, email) DO UPDATE
    SET status = 'enrolled', last_tap_at = now(), phone = COALESCE(EXCLUDED.phone, loyalty_members.phone)
    RETURNING id, points_balance, status
  `;

  return json({
    ok: true,
    message: "Enrolled successfully",
    member: memberRows[0]
  });
}
