export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
export async function GET(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const rows = await sql/*sql*/`
    SELECT t.id AS tenant_id, t.slug, t.name, m.status, m.points_balance, m.lifetime_points, m.joined_at,
      COALESCE((SELECT jsonb_object_agg(scope, granted) FROM consumer_tenant_consents c WHERE c.tenant_id = t.id AND c.consumer_id = ${consumer.id}), '{}'::jsonb) AS consents
    FROM tenant_consumer_memberships m
    JOIN tenants t ON t.id = m.tenant_id
    WHERE m.consumer_id = ${consumer.id}
    ORDER BY m.updated_at DESC
  `;
  return json({ ok: true, items: rows });
}
