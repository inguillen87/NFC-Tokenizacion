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
    SELECT
      COUNT(DISTINCT m.consumer_id)::int AS members,
      COUNT(DISTINCT h.consumer_id)::int FILTER (WHERE h.verdict = 'VALID')::int AS verified_tappers,
      COUNT(h.id)::int AS tap_events,
      COUNT(DISTINCT o.id)::int AS order_requests
    FROM tenants t
    LEFT JOIN tenant_consumer_memberships m ON m.tenant_id = t.id
    LEFT JOIN consumer_tap_history h ON h.tenant_id = t.id
    LEFT JOIN marketplace_order_requests o ON o.tenant_id = t.id
    WHERE t.slug = ${tenant}
  `;
  return json({ ok: true, overview: rows[0] || {} });
}
