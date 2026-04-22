export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
export async function GET(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const consents = await sql/*sql*/`SELECT tenant_id, scope, granted, granted_at, revoked_at FROM consumer_tenant_consents WHERE consumer_id = ${consumer.id}`;
  return json({ ok: true, consumer, consents });
}
