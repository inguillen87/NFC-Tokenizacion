export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
export async function GET(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const rows = await sql/*sql*/`
    SELECT h.tap_event_id, h.verdict, h.risk_level, h.city, h.country, h.created_at, t.slug AS tenant_slug
    FROM consumer_tap_history h
    JOIN tenants t ON t.id = h.tenant_id
    WHERE h.consumer_id = ${consumer.id}
    ORDER BY h.created_at DESC
    LIMIT 200
  `;
  return json({ ok: true, items: rows });
}
