export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin, getAdminTenantAccess } from '../../../../../lib/auth';
import { json } from '../../../../../lib/http';
import { sql } from '../../../../../lib/db';
import { ensureCarrierProfileSchema } from '../../../../../lib/commercial-runtime-schema';

export async function GET(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const { bid } = await params;
  const { forcedTenantSlug } = getAdminTenantAccess(req);
  await ensureCarrierProfileSchema();
  const matchingRows = forcedTenantSlug
    ? await sql`
      SELECT b.id, b.status, b.created_at
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql`
      SELECT id, status, created_at
      FROM batches
      WHERE bid = ${bid}
      ORDER BY created_at ASC, id ASC
    `;
  if (matchingRows.length > 1) {
    return json({
      ok: false,
      reason: 'DUPLICATE_BID',
      message: 'BID must be globally unique before reading a batch summary.',
      batches: matchingRows.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }
  if (!matchingRows[0]) return json({ ok: false, reason: 'batch not found' }, 404);

  const rows = await sql`
    SELECT
      b.id,
      b.bid,
      b.editorial_managed,
      b.status,
      b.created_at,
      t.slug AS tenant_slug,
      b.sdm_config,
      COALESCE(b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', '')) AS carrier_profile_code,
      cp.label AS carrier_label,
      cp.security_level AS carrier_security_level,
      cp.capabilities AS carrier_capabilities,
      cp.admin_copy AS carrier_admin_copy,
      cp.consumer_copy AS carrier_consumer_copy,
      cp.cost_band AS carrier_cost_band,
      COALESCE(b.sdm_config->>'chip_model', '') AS chip_model,
      COALESCE(b.sdm_config->>'sku', '') AS sku,
      COALESCE(NULLIF(b.sdm_config->>'product_name', ''), NULLIF(b.sdm_config #>> '{sun,product,name}', '')) AS product_name,
      COALESCE(NULLIF(b.sdm_config->>'winery', ''), NULLIF(b.sdm_config #>> '{sun,product,producer}', ''), t.name) AS winery,
      COALESCE(NULLIF(b.sdm_config->>'region', ''), NULLIF(b.sdm_config #>> '{sun,origin,region}', '')) AS region,
      COALESCE(NULLIF(b.sdm_config->>'grape_varietal', ''), NULLIF(b.sdm_config->>'varietal', ''), NULLIF(b.sdm_config #>> '{sun,product,varietal}', '')) AS grape_varietal,
      COALESCE(NULLIF(b.sdm_config->>'vintage', ''), NULLIF(b.sdm_config #>> '{sun,product,vintage}', '')) AS vintage,
      NULLIF(b.sdm_config->>'harvest_year', '') AS harvest_year,
      NULLIF(b.sdm_config->>'barrel_months', '') AS barrel_months,
      NULLIF(b.sdm_config->>'temperature_storage', '') AS temperature_storage,
      COALESCE(NULLIF(b.sdm_config->>'target_market', ''), NULLIF(b.sdm_config->>'target_country', '')) AS target_market,
      COALESCE(NULLIF(b.sdm_config->>'image_url', ''), NULLIF(b.sdm_config #>> '{sun,product,imageUrl}', '')) AS image_url,
      COALESCE(NULLIF(b.sdm_config->>'requested_quantity', ''), '0')::int AS requested_quantity,
      COUNT(DISTINCT tags.id)::int AS imported_tags,
      COUNT(DISTINCT tags.id) FILTER (WHERE tags.status='active')::int AS active_tags,
      COUNT(DISTINCT tags.id) FILTER (WHERE tags.status='inactive')::int AS inactive_tags,
      COUNT(DISTINCT tags.id) FILTER (WHERE tp.id IS NOT NULL)::int AS tag_profile_rows,
      COUNT(DISTINCT tags.id) FILTER (
        WHERE (
          NULLIF(tp.product_name, '') IS NOT NULL
          AND (
            COALESCE(NULLIF(b.sdm_config->>'product_name', ''), NULLIF(b.sdm_config #>> '{sun,product,name}', '')) IS NULL
            OR lower(NULLIF(tp.product_name, '')) <> lower(COALESCE(NULLIF(b.sdm_config->>'product_name', ''), NULLIF(b.sdm_config #>> '{sun,product,name}', '')))
          )
        ) OR (
          NULLIF(tp.sku, '') IS NOT NULL
          AND (
            COALESCE(NULLIF(b.sdm_config->>'sku', ''), NULLIF(b.sdm_config #>> '{sun,product,sku}', '')) IS NULL
            OR lower(NULLIF(tp.sku, '')) <> lower(COALESCE(NULLIF(b.sdm_config->>'sku', ''), NULLIF(b.sdm_config #>> '{sun,product,sku}', '')))
          )
        )
      )::int AS unit_product_overrides,
      COUNT(DISTINCT tags.id) FILTER (
        WHERE
          NULLIF(tp.locale_data #>> '{manifest,lot}', '') IS NOT NULL
          OR NULLIF(tp.locale_data #>> '{manifest,serial}', '') IS NOT NULL
          OR NULLIF(tp.locale_data #>> '{manifest,external_unit_id}', '') IS NOT NULL
          OR (
            jsonb_typeof(tp.locale_data #> '{manifest,unit_metadata}') = 'object'
            AND (tp.locale_data #> '{manifest,unit_metadata}') <> '{}'::jsonb
          )
      )::int AS unit_metadata_rows,
      COUNT(DISTINCT tags.id) FILTER (
        WHERE
          (
            jsonb_typeof(tp.locale_data->'iot') = 'object'
            AND (tp.locale_data->'iot') <> '{}'::jsonb
          )
          OR (
            jsonb_typeof(tp.locale_data #> '{manifest,iot}') = 'object'
            AND (tp.locale_data #> '{manifest,iot}') <> '{}'::jsonb
          )
      )::int AS iot_metadata_rows,
      (b.meta_key_ct IS NOT NULL) AS has_meta_key,
      (b.file_key_ct IS NOT NULL) AS has_file_key
    FROM batches b
    JOIN tenants t ON t.id = b.tenant_id
    LEFT JOIN carrier_profiles cp ON cp.code = COALESCE(b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', ''))
    LEFT JOIN tags ON tags.batch_id = b.id
    LEFT JOIN tag_profiles tp ON tp.tag_id = tags.id
    WHERE b.id = ${matchingRows[0].id}
    GROUP BY b.id, b.sdm_config, t.slug, t.name, cp.code, cp.label, cp.security_level, cp.capabilities, cp.admin_copy, cp.consumer_copy, cp.cost_band
    LIMIT 1
  `;

  const batch = rows[0];
  const [sampleUnits, manifestRows] = await Promise.all([
    sql`
      SELECT
        tg.uid_hex,
        tg.status,
        tg.carrier_profile_code,
        NULLIF(tp.product_name, '') AS product_name,
        NULLIF(tp.sku, '') AS sku,
        NULLIF(tp.locale_data #>> '{manifest,lot}', '') AS lot,
        NULLIF(tp.locale_data #>> '{manifest,serial}', '') AS serial,
        COALESCE(tp.locale_data #> '{manifest,unit_metadata}', '{}'::jsonb) AS unit_metadata,
        COALESCE(tp.locale_data->'iot', tp.locale_data #> '{manifest,iot}', '{}'::jsonb) AS iot,
        tp.updated_at
      FROM tags tg
      LEFT JOIN tag_profiles tp ON tp.tag_id = tg.id
      WHERE tg.batch_id = ${batch.id}
      ORDER BY tp.updated_at DESC NULLS LAST, tg.created_at DESC
      LIMIT 12
    `,
    sql`
      SELECT manifest_type, row_count, inserted_count, reactivated_count, duplicate_count, rejected_count, import_status, created_at
      FROM tenant_manifests
      WHERE batch_id = ${batch.id}
      ORDER BY created_at DESC
      LIMIT 5
    `,
  ]);

  return json({
    ok: true,
    batch: {
      ...batch,
      product_identity: {
        source: "batch",
        product_name: batch.product_name || null,
        sku: batch.sku || null,
        winery: batch.winery || null,
        region: batch.region || null,
        grape_varietal: batch.grape_varietal || null,
        vintage: batch.vintage || null,
        harvest_year: batch.harvest_year || null,
        barrel_months: batch.barrel_months || null,
        temperature_storage: batch.temperature_storage || null,
        target_market: batch.target_market || null,
        image_url: batch.image_url || null,
      },
      unit_metadata: {
        tag_profile_rows: Number(batch.tag_profile_rows || 0),
        unit_metadata_rows: Number(batch.unit_metadata_rows || 0),
        iot_metadata_rows: Number(batch.iot_metadata_rows || 0),
        unit_product_overrides: Number(batch.unit_product_overrides || 0),
        samples: sampleUnits.map((unit) => {
          const unitProduct = String(unit.product_name || "").trim().toLowerCase();
          const unitSku = String(unit.sku || "").trim().toLowerCase();
          const batchProduct = String(batch.product_name || "").trim().toLowerCase();
          const batchSku = String(batch.sku || "").trim().toLowerCase();
          return {
            uid_hex: unit.uid_hex,
            status: unit.status,
            carrier_profile_code: unit.carrier_profile_code || null,
            product_override: Boolean(
              (unitProduct && (!batchProduct || unitProduct !== batchProduct))
              || (unitSku && (!batchSku || unitSku !== batchSku))
            ),
            product_name: unit.product_name || null,
            sku: unit.sku || null,
            lot: unit.lot || null,
            serial: unit.serial || null,
            unit_metadata: unit.unit_metadata || {},
            iot: unit.iot || {},
            updated_at: unit.updated_at || null,
          };
        }),
      },
      manifests: manifestRows,
    },
  });
}
