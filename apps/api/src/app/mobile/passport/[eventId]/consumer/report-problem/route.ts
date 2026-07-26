export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { sql } from "../../../../../../lib/db";
import { ensureTicketsSchema } from "../../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";
import { consumeSunFreshHandoff } from "../../../../../../lib/sun-fresh-handoff";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:report-problem` });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const { eventId } = await params;
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  const capability = await consumeSunFreshHandoff(req, body, {
    eventId: String(event.id), bid: String(event.bid || ""), uidHex: String(event.uid_hex || ""), readCounter: event.sdm_read_ctr,
  }, "consumer_report_problem");
  if (!capability.ok) return json({ ok: false, error: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403);
  await ensureTicketsSchema();
  await sql/*sql*/`
    INSERT INTO tickets (locale, contact, title, detail, status)
    VALUES ('es-AR', ${consumer.email || consumer.phone || 'consumer@portal'}, 'Problema reportado sobre evidencia NFC / puntos', ${JSON.stringify({ eventId, reason: String(body.reason || 'user_report').slice(0, 240), consumerId: consumer.id })}, 'open')
  `;
  return json({ ok: true, reported: true, ticket_created: true });
}
