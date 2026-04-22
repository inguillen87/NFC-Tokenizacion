export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
export async function POST(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: 'unauthorized' }, 401);
  await sql/*sql*/`UPDATE consumers SET status = 'deleted', email = NULL, phone = NULL, display_name = NULL, updated_at = now() WHERE id = ${consumer.id}`;
  return json({ ok: true, status: 'delete_requested' });
}
