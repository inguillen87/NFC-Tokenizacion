export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";

export async function POST(req: Request) {
  await ensureConsumerPortalSchema();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);

  const uidHex = String(body.uidHex || "").trim();
  const price = Number(body.price || 0);
  const currency = String(body.currency || "USD").trim().toUpperCase();
  const description = String(body.description || "").trim();

  if (!uidHex) return json({ ok: false, error: "missing_uid_hex" }, 400);
  if (isNaN(price) || price <= 0) return json({ ok: false, error: "invalid_price" }, 400);

  // 1. Verify consumer ownership
  const ownershipRows = await sql/*sql*/`
    SELECT id, tenant_id
    FROM consumer_product_ownerships
    WHERE consumer_id = ${consumer.id}
      AND UPPER(uid_hex) = UPPER(${uidHex})
      AND status = 'claimed'
    LIMIT 1
  `;
  const ownership = ownershipRows[0];
  if (!ownership) {
    return json({ ok: false, error: "not_the_owner_or_not_claimed" }, 403);
  }

  // 2. Resolve tag batch and product info
  const tagRows = await sql/*sql*/`
    SELECT t.id AS tag_id, b.tenant_id, tp.sku, tp.product_name
    FROM tags t
    JOIN batches b ON b.id = t.batch_id
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    WHERE UPPER(t.uid_hex) = UPPER(${uidHex})
    LIMIT 1
  `;
  const tagInfo = tagRows[0];
  if (!tagInfo) {
    return json({ ok: false, error: "tag_not_found" }, 404);
  }

  const tenantId = tagInfo.tenant_id;
  const sku = tagInfo.sku || "";
  const productName = tagInfo.product_name || "Premium Asset";

  // Resolve matching marketplace product
  const productRows = await sql/*sql*/`
    SELECT id, title
    FROM marketplace_products
    WHERE tenant_id = ${tenantId}
      AND status = 'active'
    LIMIT 1
  `;
  const mpProduct = productRows[0];
  const mpProductId = mpProduct?.id || null;
  const title = body.title ? String(body.title).trim() : `${productName} (Resale)`;

  // 3. Create the P2P offer listing
  const offerRows = await sql/*sql*/`
    INSERT INTO marketplace_offers (
      tenant_id,
      marketplace_product_id,
      title,
      description,
      status,
      type,
      starts_at,
      visibility,
      seller_consumer_id,
      resale_price,
      resale_currency,
      resale_uid_hex
    ) VALUES (
      ${tenantId},
      ${mpProductId},
      ${title},
      ${description},
      'active',
      'p2p_resale',
      now(),
      'nexid_network',
      ${consumer.id},
      ${price},
      ${currency},
      ${uidHex}
    )
    RETURNING *
  `;

  return json({
    ok: true,
    offer: offerRows[0]
  }, 201);
}
