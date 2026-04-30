export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { maskConsumerEmail, resolveConsumerNetworkTenant } from "../../../../lib/consumer-network-metrics";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenant = resolveConsumerNetworkTenant({ forcedTenantSlug, requestedTenantSlug: new URL(req.url).searchParams.get("tenant") });
  const rows = await sql/*sql*/`
    SELECT c.id AS consumer_id, c.display_name, c.email, m.status, m.points_balance, m.lifetime_points, m.joined_at, m.last_activity_at, t.slug AS tenant_slug
    FROM tenant_consumer_memberships m
    JOIN tenants t ON t.id = m.tenant_id
    JOIN consumers c ON c.id = m.consumer_id
    WHERE (${tenant} = '' OR t.slug = ${tenant})
    ORDER BY m.last_activity_at DESC
    LIMIT 500
  `;
  const items = rows.map((row) => ({
    ...row,
    email: undefined,
    email_masked: maskConsumerEmail(row.email as string | null | undefined),
  }));
  return json({ ok: true, tenant: tenant || null, items });
}
