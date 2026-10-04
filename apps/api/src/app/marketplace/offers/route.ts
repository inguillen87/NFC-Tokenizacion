export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
import { normalizeMarketplaceTenantSlug } from "../../../lib/marketplace-policy";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";

export async function GET(req: Request) {
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public",
    tenantId: "platform",
    subjectId: "public-marketplace-offers",
  });
  if (limited) return limited;

  await ensureConsumerPortalSchema();
  const url = new URL(req.url);
  const tenant = normalizeMarketplaceTenantSlug(url.searchParams.get("tenant") || "");
  const rows = await sql/*sql*/`
    SELECT
      o.id,
      o.marketplace_product_id,
      o.title,
      o.description,
      o.type,
      o.visibility,
      o.starts_at,
      o.ends_at,
      t.slug AS tenant_slug,
      p.title AS product_title
    FROM marketplace_offers o
    JOIN tenants t ON t.id = o.tenant_id
    LEFT JOIN marketplace_products p ON p.id = o.marketplace_product_id
    WHERE o.status = 'active'
      AND o.visibility = 'nexid_network'
      AND o.starts_at <= now()
      AND (o.ends_at IS NULL OR o.ends_at >= now())
      AND (${tenant} = '' OR t.slug = ${tenant})
      AND o.type <> 'p2p_resale'
    ORDER BY o.updated_at DESC
  `;
  return json({ ok: true, visibility: "nexid_network", p2p_resale_available: false, items: rows }, 200, {
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
}
