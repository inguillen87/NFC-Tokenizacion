export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
export async function GET(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: 'unauthorized' }, 401);
  const rows = await sql/*sql*/`
    SELECT r.id, r.title, t.slug AS tenant_slug
    FROM rewards r
    JOIN tenants t ON t.id = r.tenant_id
    JOIN tenant_consumer_memberships m ON m.tenant_id = r.tenant_id AND m.consumer_id = ${consumer.id}
    WHERE r.type IN ('EXPERIENCE','TASTING','TOUR','VIP_ACCESS') AND r.status = 'active'
    ORDER BY r.created_at DESC
  `;
  return json({ ok: true, items: rows });
}
