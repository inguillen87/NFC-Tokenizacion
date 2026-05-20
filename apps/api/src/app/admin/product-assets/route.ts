export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { ensureCarrierProfileSchema } from "../../../lib/commercial-runtime-schema";
import { ensureSunTenantProfilesSchema } from "../../../lib/sun-tenant-profile-schema";
import { buildProductAssetProfile, readProductAssetMedia, summarizeAssetReadiness } from "../../../lib/product-asset-profile";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanUid(value: unknown) {
  return cleanText(value).replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

function galleryFrom(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter((item) => /^https?:\/\//i.test(item));
  return cleanText(value)
    .split(/[|,;\n]/)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
}

function maskUid(uid: unknown) {
  const raw = cleanUid(uid);
  if (!raw) return null;
  if (raw.length <= 8) return `${raw.slice(0, 4)}****`;
  return `${raw.slice(0, 4)}****${raw.slice(-4)}`;
}

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await Promise.all([ensureSunTenantProfilesSchema(), ensureCarrierProfileSchema()]);

  const url = new URL(req.url);
  const tenant = cleanText(url.searchParams.get("tenant") || url.searchParams.get("tenantSlug"));
  const bid = cleanText(url.searchParams.get("bid"));
  const uid = cleanUid(url.searchParams.get("uid") || url.searchParams.get("uidHex"));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));

  const rows = await sql/*sql*/`
    SELECT
      tg.uid_hex,
      tg.status AS tag_status,
      b.bid,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      tsp.vertical AS tenant_vertical,
      tp.sku,
      tp.product_name,
      tp.image_url,
      tp.winery,
      tp.region,
      tp.locale_data,
      tp.updated_at
    FROM tags tg
    JOIN batches b ON b.id = tg.batch_id
    JOIN tenants t ON t.id = b.tenant_id
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = t.id
    LEFT JOIN tag_profiles tp ON tp.tag_id = tg.id
    WHERE (${tenant} = '' OR t.slug = ${tenant})
      AND (${bid} = '' OR b.bid = ${bid})
      AND (${uid} = '' OR UPPER(tg.uid_hex) = UPPER(${uid}))
    ORDER BY tp.updated_at DESC NULLS LAST, tg.created_at DESC
    LIMIT ${limit}
  `;

  const items = rows.map((row) => {
    const media = readProductAssetMedia(row.locale_data);
    const profile = buildProductAssetProfile({
      tenantSlug: row.tenant_slug,
      brandName: row.winery || row.tenant_name,
      productName: row.product_name || row.sku,
      bid: row.bid,
      vertical: row.tenant_vertical,
      imageUrl: media.imageUrl || row.image_url || null,
      labelImageUrl: media.labelImageUrl || null,
      modelUrl: media.modelUrl || null,
      galleryUrls: media.galleryUrls || [],
      sku: row.sku,
    });
    return {
      uidMasked: maskUid(row.uid_hex),
      uidHex: row.uid_hex,
      tagStatus: row.tag_status,
      tenantSlug: row.tenant_slug,
      bid: row.bid,
      updatedAt: row.updated_at || null,
      assetReadiness: summarizeAssetReadiness(profile),
      profile,
    };
  });

  return json({ ok: true, count: items.length, items });
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await Promise.all([ensureSunTenantProfilesSchema(), ensureCarrierProfileSchema()]);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tenantSlug = cleanText(body.tenantSlug || body.tenant || "demobodega");
  const bid = cleanText(body.bid || body.batchId);
  const uidHex = cleanUid(body.uidHex || body.uid);
  if (!bid) return json({ ok: false, error: "bid_required" }, 400);
  if (!/^[0-9A-F]{8,32}$/.test(uidHex)) return json({ ok: false, error: "valid_uid_hex_required" }, 400);

  const tagRows = await sql/*sql*/`
    SELECT tg.id, tg.uid_hex, b.bid, t.slug AS tenant_slug, t.name AS tenant_name, tsp.vertical AS tenant_vertical
    FROM tags tg
    JOIN batches b ON b.id = tg.batch_id
    JOIN tenants t ON t.id = b.tenant_id
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = t.id
    WHERE b.bid = ${bid}
      AND UPPER(tg.uid_hex) = UPPER(${uidHex})
      AND (${tenantSlug} = '' OR t.slug = ${tenantSlug})
    LIMIT 1
  `;
  const tag = tagRows[0];
  if (!tag) return json({ ok: false, error: "tag_not_found_for_batch" }, 404);

  const galleryUrls = galleryFrom(body.galleryUrls || body.gallery_urls || body.gallery);
  const media = {
    imageUrl: cleanText(body.imageUrl || body.image_url || body.photoUrl || body.photo_url) || null,
    labelImageUrl: cleanText(body.labelImageUrl || body.label_image_url || body.packshotUrl || body.packshot_url) || null,
    modelUrl: cleanText(body.modelUrl || body.model_url || body.glbUrl || body.glb_url) || null,
    galleryUrls,
  };
  const manifest = {
    lot: cleanText(body.lot || body.lote),
    serial: cleanText(body.serial || body.serialNumber || body.serial_number),
    expires_at: cleanText(body.expiresAt || body.expires_at),
    asset_source: cleanText(body.assetSource || body.asset_source || "admin_product_assets"),
  };

  await sql/*sql*/`
    INSERT INTO tag_profiles (tag_id, sku, product_name, region, winery, image_url, notes, locale_data)
    VALUES (
      ${tag.id},
      ${cleanText(body.sku) || null},
      ${cleanText(body.productName || body.product_name) || null},
      ${cleanText(body.region || body.originLabel || body.origin_label) || null},
      ${cleanText(body.brandName || body.brand_name || body.winery || tag.tenant_name) || null},
      ${media.imageUrl},
      ${cleanText(body.notes) || null},
      ${JSON.stringify({ media, manifest, assetBank: { uploaded_at: new Date().toISOString(), tenant_slug: tag.tenant_slug, bid } })}::jsonb
    )
    ON CONFLICT (tag_id) DO UPDATE SET
      sku = COALESCE(EXCLUDED.sku, tag_profiles.sku),
      product_name = COALESCE(EXCLUDED.product_name, tag_profiles.product_name),
      region = COALESCE(EXCLUDED.region, tag_profiles.region),
      winery = COALESCE(EXCLUDED.winery, tag_profiles.winery),
      image_url = COALESCE(EXCLUDED.image_url, tag_profiles.image_url),
      notes = COALESCE(EXCLUDED.notes, tag_profiles.notes),
      locale_data = COALESCE(tag_profiles.locale_data, '{}'::jsonb) || EXCLUDED.locale_data,
      updated_at = now()
  `;

  const profile = buildProductAssetProfile({
    tenantSlug: tag.tenant_slug,
    brandName: cleanText(body.brandName || body.brand_name || body.winery || tag.tenant_name),
    productName: cleanText(body.productName || body.product_name),
    bid,
    vertical: tag.tenant_vertical,
    imageUrl: media.imageUrl,
    labelImageUrl: media.labelImageUrl,
    modelUrl: media.modelUrl,
    galleryUrls,
    sku: cleanText(body.sku),
  });

  return json({
    ok: true,
    tenantSlug: tag.tenant_slug,
    bid,
    uidMasked: maskUid(tag.uid_hex),
    assetReadiness: summarizeAssetReadiness(profile),
    profile,
  });
}
