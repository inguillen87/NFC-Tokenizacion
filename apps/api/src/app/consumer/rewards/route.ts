export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
export async function GET(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const rows = await sql/*sql*/`
    SELECT r.id, r.title, r.points_cost, r.stock_remaining, t.slug AS tenant_slug,
      CASE
        WHEN r.ends_at IS NOT NULL AND r.ends_at < now() THEN 'expired'
        WHEN r.stock_remaining IS NOT NULL AND r.stock_remaining <= 0 THEN 'out_of_stock'
        WHEN COALESCE(m.points_balance, 0) >= r.points_cost THEN 'available'
        ELSE 'locked'
      END AS state
    FROM rewards r
    JOIN tenants t ON t.id = r.tenant_id
    LEFT JOIN tenant_consumer_memberships m ON m.tenant_id = r.tenant_id AND m.consumer_id = ${consumer.id}
    WHERE r.status = 'active'
    ORDER BY r.created_at DESC
    LIMIT 100
  `;
  return json({ ok: true, items: rows });
}
