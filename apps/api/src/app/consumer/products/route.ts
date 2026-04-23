export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
export async function GET(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const rows = await sql/*sql*/`
    SELECT id, product_name, brand_name, collection_type, ownership_status, first_tap_event_id, latest_tap_event_id, created_at
    FROM consumer_products
    WHERE consumer_id = ${consumer.id}
    ORDER BY updated_at DESC
  `;
  return json({ ok: true, items: rows });
}
