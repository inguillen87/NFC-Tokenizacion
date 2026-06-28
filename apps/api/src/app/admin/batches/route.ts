export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../lib/db";
import { checkAdmin, getAdminTenantScope } from "../../../lib/auth";
import { json } from "../../../lib/http";
import { ensureCarrierProfileSchema } from "../../../lib/commercial-runtime-schema";
import { effectiveTenantFilter } from "../../../lib/admin-tenant-filter";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureCarrierProfileSchema();

  const { searchParams } = new URL(req.url);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenantSlug = effectiveTenantFilter({ forcedTenantSlug, requestedTenantSlug: searchParams.get("tenant") });

  const rows = tenantSlug
    ? await sql/*sql*/`
      SELECT
        b.id,
        b.bid,
        b.status,
        b.created_at,
        t.slug AS tenant_slug,
        NULLIF(COALESCE(b.sdm_config->>'profile', b.sdm_config->>'security_profile'), '') AS batch_profile,
        NULLIF(b.sdm_config->>'sku', '') AS sku,
        COALESCE(NULLIF(b.sdm_config->>'product_name', ''), NULLIF(b.sdm_config #>> '{sun,product,name}', '')) AS product_name,
        COALESCE(NULLIF(b.sdm_config->>'winery', ''), NULLIF(b.sdm_config #>> '{sun,product,producer}', ''), t.name) AS winery,
        COALESCE(NULLIF(b.sdm_config->>'region', ''), NULLIF(b.sdm_config #>> '{sun,origin,region}', '')) AS region,
        COALESCE(NULLIF(b.sdm_config->>'grape_varietal', ''), NULLIF(b.sdm_config->>'varietal', ''), NULLIF(b.sdm_config #>> '{sun,product,varietal}', '')) AS grape_varietal,
        COALESCE(NULLIF(b.sdm_config->>'vintage', ''), NULLIF(b.sdm_config #>> '{sun,product,vintage}', '')) AS vintage,
        COALESCE(b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', '')) AS carrier_profile_code,
        cp.label AS carrier_label,
        cp.security_level AS carrier_security_level,
        cp.capabilities AS carrier_capabilities,
        cp.admin_copy AS carrier_admin_copy,
        NULLIF(b.sdm_config->>'requested_quantity', '')::int AS requested_quantity,
        COUNT(DISTINCT tags.id)::int AS quantity,
        COUNT(DISTINCT tags.id) FILTER (WHERE tags.status = 'active')::int AS active_tags,
        COUNT(DISTINCT tags.id) FILTER (WHERE tags.status = 'inactive')::int AS inactive_tags,
        COUNT(DISTINCT tags.id) FILTER (WHERE tags.status = 'revoked')::int AS revoked_tags,
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
        )::int AS iot_metadata_rows
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      LEFT JOIN carrier_profiles cp ON cp.code = COALESCE(b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', ''))
      LEFT JOIN tags ON tags.batch_id = b.id
      LEFT JOIN tag_profiles tp ON tp.tag_id = tags.id
      WHERE t.slug = ${tenantSlug}
      GROUP BY b.id, t.slug, t.name, cp.code, cp.label, cp.security_level, cp.capabilities, cp.admin_copy
      ORDER BY b.created_at DESC
      LIMIT 300
    `
    : await sql/*sql*/`
      SELECT
        b.id,
        b.bid,
        b.status,
        b.created_at,
        t.slug AS tenant_slug,
        NULLIF(COALESCE(b.sdm_config->>'profile', b.sdm_config->>'security_profile'), '') AS batch_profile,
        NULLIF(b.sdm_config->>'sku', '') AS sku,
        COALESCE(NULLIF(b.sdm_config->>'product_name', ''), NULLIF(b.sdm_config #>> '{sun,product,name}', '')) AS product_name,
        COALESCE(NULLIF(b.sdm_config->>'winery', ''), NULLIF(b.sdm_config #>> '{sun,product,producer}', ''), t.name) AS winery,
        COALESCE(NULLIF(b.sdm_config->>'region', ''), NULLIF(b.sdm_config #>> '{sun,origin,region}', '')) AS region,
        COALESCE(NULLIF(b.sdm_config->>'grape_varietal', ''), NULLIF(b.sdm_config->>'varietal', ''), NULLIF(b.sdm_config #>> '{sun,product,varietal}', '')) AS grape_varietal,
        COALESCE(NULLIF(b.sdm_config->>'vintage', ''), NULLIF(b.sdm_config #>> '{sun,product,vintage}', '')) AS vintage,
        COALESCE(b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', '')) AS carrier_profile_code,
        cp.label AS carrier_label,
        cp.security_level AS carrier_security_level,
        cp.capabilities AS carrier_capabilities,
        cp.admin_copy AS carrier_admin_copy,
        NULLIF(b.sdm_config->>'requested_quantity', '')::int AS requested_quantity,
        COUNT(DISTINCT tags.id)::int AS quantity,
        COUNT(DISTINCT tags.id) FILTER (WHERE tags.status = 'active')::int AS active_tags,
        COUNT(DISTINCT tags.id) FILTER (WHERE tags.status = 'inactive')::int AS inactive_tags,
        COUNT(DISTINCT tags.id) FILTER (WHERE tags.status = 'revoked')::int AS revoked_tags,
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
        )::int AS iot_metadata_rows
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      LEFT JOIN carrier_profiles cp ON cp.code = COALESCE(b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', ''))
      LEFT JOIN tags ON tags.batch_id = b.id
      LEFT JOIN tag_profiles tp ON tp.tag_id = tags.id
      GROUP BY b.id, t.slug, t.name, cp.code, cp.label, cp.security_level, cp.capabilities, cp.admin_copy
      ORDER BY b.created_at DESC
      LIMIT 300
    `;

  return json(rows);
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  return json({
    ok: false,
    reason: "manual_batch_creation_disabled",
    message: "Manual batch creation with plaintext SUN keys is disabled. Create batches through Supplier Orders so K_META_BATCH and K_FILE_BATCH are generated server-side, stored in Tenant Vault and exported only through an encrypted one-time supplier pack.",
    next: "/admin/supplier-orders",
  }, 410);
}
