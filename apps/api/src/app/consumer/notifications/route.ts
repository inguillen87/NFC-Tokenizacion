export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";

export async function GET(req: Request) {
  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: 'unauthorized' }, 401);
  const rows = await sql/*sql*/`SELECT * FROM consumer_notifications WHERE consumer_id = ${consumer.id} ORDER BY created_at DESC LIMIT 200`;
  return json({ ok: true, items: rows });
}
