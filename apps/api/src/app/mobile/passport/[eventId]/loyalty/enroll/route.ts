export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { json } from "../../../../../../lib/http";
import { getActiveProgram, getOrCreateMember, getTapEvent } from "../../../../../../lib/loyalty-service";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";

function anonymousMemberKey(req: Request, eventId: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "no-ip";
  const ua = req.headers.get("user-agent") || "no-ua";
  const seed = `${eventId}:${ip}:${ua}`;
  return `anon:${createHash("sha256").update(seed).digest("hex").slice(0, 20)}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const body = await req.json().catch(() => ({}));
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  const program = await getActiveProgram(event.tenant_id);
  if (!program) return json({ ok: false, error: "program_not_found" }, 404);

  const consumer = await getConsumerFromRequest(req);
  const memberKey = consumer?.id ? `consumer:${consumer.id}` : anonymousMemberKey(req, eventId);
  const member = await getOrCreateMember({
    tenantId: event.tenant_id,
    programId: program.id,
    eventId: String(event.id),
    memberKey,
    consumerId: consumer?.id || null,
    locale: body.locale || consumer?.preferred_locale || "es-AR",
    email: body.email || consumer?.email || null,
    phone: body.phone || consumer?.phone || null,
    displayName: body.displayName || consumer?.display_name || null,
    country: body.country || event.country_code || null,
  });

  return json({
    ok: true,
    member: {
      id: member.id,
      status: member.status,
      email: member.email,
      phone: member.phone,
      displayName: member.display_name,
      pointsBalance: member.points_balance,
      consent: member.consent_json,
    },
  });
}
