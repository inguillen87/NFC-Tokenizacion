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
      COALESCE(e.product_name, cp.product_name, 'Producto NFC') AS product_name,
      t.slug AS tenant_slug,
      COALESCE(b.bid, 'n/a') AS bid,
      COUNT(*)::int AS saved_count,
      COUNT(*) FILTER (WHERE cp.ownership_status = 'claimed')::int AS claimed_count,
      MAX(cp.updated_at) AS latest_activity_at
    FROM consumer_products cp
    JOIN tenants t ON t.id = cp.tenant_id
    LEFT JOIN events e ON e.id = cp.latest_tap_event_id
    LEFT JOIN batches b ON b.id = e.batch_id
    WHERE (${tenant} = '' OR t.slug = ${tenant})
    GROUP BY COALESCE(e.product_name, cp.product_name, 'Producto NFC'), t.slug, COALESCE(b.bid, 'n/a')
    ORDER BY claimed_count DESC, saved_count DESC
    LIMIT 100
  `;
  return json({ ok: true, tenant: tenant || null, items: rows });
}
