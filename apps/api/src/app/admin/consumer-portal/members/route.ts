export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const tenant = new URL(req.url).searchParams.get('tenant') || '';
  if (!tenant) return json({ ok: false, error: 'tenant_required' }, 400);
  const rows = await sql/*sql*/`
    SELECT c.id, c.email, c.phone, c.display_name, m.status, m.points_balance, m.lifetime_points, m.joined_at
    FROM tenants t
    JOIN tenant_consumer_memberships m ON m.tenant_id = t.id
    JOIN consumers c ON c.id = m.consumer_id
    WHERE t.slug = ${tenant}
    ORDER BY m.updated_at DESC
    LIMIT 500
  `;
  return json({ ok: true, items: rows });
}
