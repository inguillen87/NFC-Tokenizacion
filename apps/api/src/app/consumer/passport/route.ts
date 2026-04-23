export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";

export async function GET(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);

  const memberships = await sql/*sql*/`
    SELECT t.slug, t.name, m.points_balance, m.lifetime_points, m.joined_at
    FROM tenant_consumer_memberships m
    JOIN tenants t ON t.id = m.tenant_id
    WHERE m.consumer_id = ${consumer.id}
    ORDER BY m.updated_at DESC
    LIMIT 20
  `;
  const products = await sql/*sql*/`
    SELECT product_name, brand_name, ownership_status, created_at
    FROM consumer_products
    WHERE consumer_id = ${consumer.id}
    ORDER BY updated_at DESC
    LIMIT 12
  `;

  return json({ ok: true, passport: { consumer, memberships, products } });
}
