export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { resolveConsumerNetworkTenant } from "../../../../lib/consumer-network-metrics";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenant = resolveConsumerNetworkTenant({ forcedTenantSlug, requestedTenantSlug: new URL(req.url).searchParams.get("tenant") });

  const rows = await sql/*sql*/`
    SELECT
      h.tap_event_id,
      h.verdict,
      h.risk_level,
      h.city,
      h.country,
      h.created_at,
      t.slug AS tenant_slug,
      c.display_name AS consumer_display_name
    FROM consumer_tap_history h
    JOIN tenants t ON t.id = h.tenant_id
    LEFT JOIN consumers c ON c.id = h.consumer_id
    WHERE (${tenant} = '' OR t.slug = ${tenant})
    ORDER BY h.created_at DESC
    LIMIT 200
  `;
  return json({ ok: true, tenant: tenant || null, items: rows });
}
