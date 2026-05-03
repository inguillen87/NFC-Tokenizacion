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
  const rows = await sql/*sql*/`
    SELECT o.id, o.status, o.quantity, o.created_at, p.title AS product_title, t.slug AS tenant_slug
    FROM marketplace_order_requests o
    LEFT JOIN marketplace_products p ON p.id = o.marketplace_product_id
    JOIN tenants t ON t.id = o.tenant_id
    WHERE o.consumer_id = ${consumer.id}
    ORDER BY o.created_at DESC
  `;
  return json({ ok: true, items: rows });
}
