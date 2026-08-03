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
      AND (
        o.type <> 'p2p_resale'
        OR EXISTS (
          SELECT 1
          FROM consumer_product_ownerships ownership
          JOIN tags tag
            ON tag.id = ownership.tag_id
           AND tag.batch_id = ownership.batch_id
           AND upper(tag.uid_hex) = upper(ownership.uid_hex)
           AND tag.status::text = 'active'
           AND (tag.lifecycle_state IS NULL OR tag.lifecycle_state = 'active')
          JOIN batches batch
            ON batch.id = ownership.batch_id
           AND batch.tenant_id = ownership.tenant_id
           AND batch.status::text IN ('active', 'active_in_market')
           AND batch.supplier_order_id IS NULL
           AND batch.supplier_sub_batch_id IS NULL
          WHERE ownership.id = o.ownership_id
            AND ownership.tenant_id = o.tenant_id
            AND ownership.consumer_id = o.seller_consumer_id
            AND ownership.status = 'claimed'
            AND upper(ownership.uid_hex) = upper(o.resale_uid_hex)
            AND NOT EXISTS (
              SELECT 1
              FROM supplier_sub_batches supplier_sub_batch
              WHERE supplier_sub_batch.batch_id = batch.id
                 OR (
                   supplier_sub_batch.tenant_id = batch.tenant_id
                   AND upper(supplier_sub_batch.bid) = upper(batch.bid)
                 )
            )
            AND (
              SELECT count(*)
              FROM events event
              WHERE event.id = ownership.event_id
                AND event.tenant_id = ownership.tenant_id
                AND event.batch_id = ownership.batch_id
                AND event.tag_id::text = ownership.tag_id::text
                AND upper(event.uid_hex) = upper(ownership.uid_hex)
                AND upper(event.bid) = upper(batch.bid)
                AND event.cmac_ok IS TRUE
                AND event.allowlisted IS TRUE
                AND upper(COALESCE(event.result, '')) = 'VALID'
            ) = 1
        )
      )
    ORDER BY o.updated_at DESC
  `;
  return json({ ok: true, visibility: "nexid_network", items: rows }, 200, {
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
}
