export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: 'unauthorized' }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:notification-read` });
  if (limited) return limited;
  await ensureConsumerPortalSchema();
  const { id } = await params;
  const rows = await sql/*sql*/`UPDATE consumer_notifications SET read_at = now() WHERE id = ${id} AND consumer_id = ${consumer.id} RETURNING *`;
  if (!rows[0]) return json({ ok: false, error: 'notification_not_found' }, 404);
  return json({ ok: true, notification: rows[0] });
}
