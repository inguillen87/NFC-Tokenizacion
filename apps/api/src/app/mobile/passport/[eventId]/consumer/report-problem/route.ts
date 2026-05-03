export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { sql } from "../../../../../../lib/db";
import { ensureTicketsSchema } from "../../../../../../lib/commercial-runtime-schema";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const body = await req.json().catch(() => ({}));
  const consumer = await getConsumerFromRequest(req);
  const { eventId } = await params;
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  await ensureTicketsSchema();
  await sql/*sql*/`
    INSERT INTO tickets (locale, contact, title, detail, status)
    VALUES ('es-AR', ${consumer?.email || consumer?.phone || 'consumer@portal'}, 'Problema de autenticidad / puntos', ${JSON.stringify({ eventId, reason: body.reason || 'user_report', consumerId: consumer?.id || null })}, 'open')
  `;
  return json({ ok: true, reported: true });
}
