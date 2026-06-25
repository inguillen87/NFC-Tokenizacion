export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
import { normalizeMarketplaceTenantSlug } from "../../../lib/marketplace-policy";

export async function GET(req: Request) {
  await ensureConsumerPortalSchema();
  const url = new URL(req.url);
  const tenant = normalizeMarketplaceTenantSlug(url.searchParams.get("tenant") || "");
  const rows = await sql/*sql*/`
    SELECT o.*, t.slug AS tenant_slug, p.title AS product_title
    FROM marketplace_offers o
    JOIN tenants t ON t.id = o.tenant_id
    LEFT JOIN marketplace_products p ON p.id = o.marketplace_product_id
    WHERE o.status = 'active'
      AND o.starts_at <= now()
      AND (o.ends_at IS NULL OR o.ends_at >= now())
      AND (${tenant} = '' OR t.slug = ${tenant})
    ORDER BY o.updated_at DESC
  `;
  return json({ ok: true, items: rows });
}
