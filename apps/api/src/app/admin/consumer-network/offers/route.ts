export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { resolveConsumerNetworkTenant } from "../../../../lib/consumer-network-metrics";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  await ensureConsumerPortalSchema();
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const requestedTenantSlug = new URL(req.url).searchParams.get("tenant");
  const tenant = resolveConsumerNetworkTenant({ forcedTenantSlug, requestedTenantSlug });

  const rows = await sql/*sql*/`
    SELECT
      o.id,
      o.title,
      o.description,
      o.status,
      o.type,
      o.visibility,
      o.starts_at,
      o.ends_at,
      o.eligibility_json,
      o.created_at,
      o.updated_at,
      t.slug AS tenant_slug,
      p.title AS product_title
    FROM marketplace_offers o
    JOIN tenants t ON t.id = o.tenant_id
    LEFT JOIN marketplace_products p ON p.id = o.marketplace_product_id
    WHERE (${tenant} = '' OR t.slug = ${tenant})
    ORDER BY o.updated_at DESC
    LIMIT 100
  `;

  return json({ ok: true, tenant: tenant || null, items: rows }, 200, {
    "cache-control": "no-store",
  });
}
