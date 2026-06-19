export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ensureSdkSchema } from "../../../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../../../lib/db";
import { json } from "../../../../../../lib/http";
import { authenticateSdkRequest } from "../../../../../../lib/sdk-auth";
import { clean, readJsonObject } from "../../_shared";

export async function GET(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = await authenticateSdkRequest(req, "sdk:products");
  if (!auth.ok) return auth.response;

  await ensureSdkSchema();
  const resolvedParams = await params;
  const bid = decodeURIComponent(resolvedParams.bid || "").trim();
  if (!bid) return json({ ok: false, reason: "bid_required", trace_id: auth.context.traceId }, 400);

  const rows = await sql/*sql*/`
    SELECT
      b.id::text AS batch_id,
      b.bid,
      b.status,
      b.sdm_config,
      b.carrier_profile_code AS batch_carrier_profile_code,
      b.active_for_claim,
      b.claim_pin_required,
      b.created_at,
      cp.code AS carrier_profile_code,
      cp.label AS carrier_label,
      cp.family AS carrier_family,
      cp.security_level AS carrier_security_level,
      COUNT(t.id)::int AS tag_count,
      COUNT(t.id) FILTER (WHERE t.status = 'active')::int AS active_tag_count,
      COUNT(t.id) FILTER (WHERE COALESCE(t.active_for_claim, b.active_for_claim) = true)::int AS active_for_claim_count
    FROM batches b
    LEFT JOIN tags t ON t.batch_id = b.id
    LEFT JOIN carrier_profiles cp ON cp.code = COALESCE(b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', ''))
    WHERE b.tenant_id = ${auth.context.tenantId}
      AND b.bid = ${bid}
    GROUP BY b.id, cp.code, cp.label, cp.family, cp.security_level
    LIMIT 1
  `;
  const batch = rows[0] as Record<string, unknown> | undefined;
  if (!batch) return json({ ok: false, reason: "batch_not_found_for_tenant", bid, trace_id: auth.context.traceId }, 404);

  const productRows = await sql/*sql*/`
    SELECT
      t.uid_hex,
      t.status,
      COALESCE(t.carrier_profile_code, ${clean(batch.carrier_profile_code || batch.batch_carrier_profile_code) || null}) AS carrier_profile_code,
      COALESCE(tp.product_name, tp.sku, NULLIF(${readJsonObject(batch.sdm_config).product_name || ""}, '')) AS product_name,
      tp.sku,
      tp.winery,
      tp.region,
      tp.grape_varietal,
      tp.vintage,
      tp.image_url,
      t.active_for_claim,
      t.claim_pin_required,
      t.scan_count,
      t.last_seen_at
    FROM tags t
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    WHERE t.batch_id = ${batch.batch_id}
    ORDER BY t.created_at ASC
    LIMIT 100
  `;
  const sdmConfig = readJsonObject(batch.sdm_config);

  return json({
    ok: true,
    tenant: { slug: auth.context.tenantSlug, name: auth.context.tenantName },
    batch: {
      id: String(batch.batch_id),
      bid: String(batch.bid),
      status: String(batch.status || "unknown"),
      createdAt: batch.created_at ? String(batch.created_at) : null,
      activeForClaim: Boolean(batch.active_for_claim),
      claimPinRequired: Boolean(batch.claim_pin_required || sdmConfig.claim_pin_required),
    },
    carrier: {
      code: clean(batch.carrier_profile_code || batch.batch_carrier_profile_code || sdmConfig.carrier_profile_code) || null,
      label: clean(batch.carrier_label) || null,
      family: clean(batch.carrier_family) || null,
      securityLevel: Number(batch.carrier_security_level || 0),
    },
    product: {
      name: clean(sdmConfig.product_name) || clean((productRows[0] as Record<string, unknown> | undefined)?.product_name) || `Batch ${bid}`,
      sku: clean(sdmConfig.sku) || clean((productRows[0] as Record<string, unknown> | undefined)?.sku) || null,
      winery: clean(sdmConfig.winery) || clean((productRows[0] as Record<string, unknown> | undefined)?.winery) || auth.context.tenantName,
      region: clean(sdmConfig.region) || clean((productRows[0] as Record<string, unknown> | undefined)?.region) || null,
      vintage: clean(sdmConfig.vintage) || clean((productRows[0] as Record<string, unknown> | undefined)?.vintage) || null,
    },
    stats: {
      tagCount: Number(batch.tag_count || 0),
      activeTagCount: Number(batch.active_tag_count || 0),
      activeForClaimCount: Number(batch.active_for_claim_count || 0),
    },
    tags: (productRows as Array<Record<string, unknown>>).map((row) => ({
      uidMasked: clean(row.uid_hex) ? `${clean(row.uid_hex).slice(0, 4)}****${clean(row.uid_hex).slice(-4)}` : null,
      status: clean(row.status) || "unknown",
      productName: clean(row.product_name) || null,
      sku: clean(row.sku) || null,
      carrierProfileCode: clean(row.carrier_profile_code) || null,
      activeForClaim: row.active_for_claim === null || row.active_for_claim === undefined ? Boolean(batch.active_for_claim) : Boolean(row.active_for_claim),
      claimPinRequired: row.claim_pin_required === null || row.claim_pin_required === undefined ? Boolean(batch.claim_pin_required || sdmConfig.claim_pin_required) : Boolean(row.claim_pin_required),
      scanCount: Number(row.scan_count || 0),
      lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    })),
    traceId: auth.context.traceId,
  });
}

