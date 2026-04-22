export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../../lib/http";
import { getActiveProgram, getOrCreateMember, getTapEvent } from "../../../../../../lib/loyalty-service";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const body = await req.json().catch(() => ({}));
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  const program = await getActiveProgram(event.tenant_id);
  if (!program) return json({ ok: false, error: "program_not_found" }, 404);

  const member = await getOrCreateMember({
    tenantId: event.tenant_id,
    programId: program.id,
    eventId: String(event.id),
    locale: body.locale || "es-AR",
    email: body.email || null,
    displayName: body.displayName || null,
    country: body.country || event.country_code || null,
  });

  return json({
    ok: true,
    member: {
      id: member.id,
      status: member.status,
      email: member.email,
      displayName: member.display_name,
      pointsBalance: member.points_balance,
      consent: member.consent_json,
    },
  });
}
