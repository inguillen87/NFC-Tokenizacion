export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../lib/db";
import { checkAdmin } from "../../../lib/auth";
import { encryptKey16 } from "../../../lib/keys";
import { json } from "../../../lib/http";
import { requireTenantSunProfile } from "../../../lib/tenant-onboarding";
import { ensureCarrierProfileSchema } from "../../../lib/commercial-runtime-schema";
import { getCarrierProfile, inferCarrierProfileFromPayload } from "../../../lib/carrier-profiles";

function normalizeHexKey(value: unknown, field: string) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim().toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(normalized)) {
    throw new Error(`${field} must be a 32-char hex string`);
  }
  return normalized;
}

async function resolveTenant(input: string) {
  const normalized = String(input || "").trim();
  if (!normalized) return null;

  const rows = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await sql/*sql*/`SELECT id, slug FROM tenants WHERE id = ${normalized}::uuid LIMIT 1`
    : await sql/*sql*/`SELECT id, slug FROM tenants WHERE slug = ${normalized.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

function inferBatchProfile(config: Record<string, unknown>) {
  const explicit = String(config.profile || config.security_profile || "").trim();
  if (explicit) return explicit;
  const icType = String(config.ic_type || config.tag_type || "").toUpperCase();
  if (icType.includes("424")) return "secure";
  if (icType.includes("215") || icType.includes("216") || icType.includes("213")) return "basic";
  return null;
}

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureCarrierProfileSchema();

  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get("tenant") || "";

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
  await ensureCarrierProfileSchema();

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const tenantInput = String(body.tenant_slug || body.tenantId || "").trim();
  const bid = String(body.bid || body.batchId || "").trim();
  if (!tenantInput || !bid) return json({ ok: false, reason: "tenant_slug and bid required" }, 400);

  const tenant = await resolveTenant(tenantInput);
  if (!tenant) return json({ ok: false, reason: "tenant not found" }, 404);
  const readiness = await requireTenantSunProfile(String(tenant.id)).catch((error) => ({ ok: false, missing: (error as Error & { missing?: string[] }).missing || ["tenant_sun_profiles"] }));
  if (!readiness.ok) {
    return json({
      ok: false,
      reason: "tenant_sun_profile_incomplete",
      message: "Create or complete the tenant SUN profile before creating batches. This prevents generic future-tenant fallbacks.",
      missing: readiness.missing,
    }, 409);
  }
  const existingRows = await sql/*sql*/`
    SELECT id, bid, status, created_at
    FROM batches
    WHERE bid = ${bid}
    LIMIT 1
  `;
  if (existingRows[0]) {
    return json({
      ok: false,
      reason: "batch_bid_already_exists",
      message: "BID already exists. Batch creation never overwrites encrypted keys or sdm_config; use an explicit migration/update action.",
      batch: existingRows[0],
    }, 409);
  }

  try {
    const kMetaHex = normalizeHexKey(body.k_meta_hex, "k_meta_hex");
    const kFileHex = normalizeHexKey(body.k_file_hex, "k_file_hex");
    if (!kMetaHex || !kFileHex) {
      return json({ ok: false, reason: "k_meta_hex and k_file_hex are required (32 hex chars each)" }, 400);
    }
    const metaCt = encryptKey16(Buffer.from(kMetaHex, "hex"));
    const fileCt = encryptKey16(Buffer.from(kFileHex, "hex"));

    const incomingConfig = typeof body.sdm_config === "object" && body.sdm_config ? { ...(body.sdm_config as Record<string, unknown>) } : {};
    const carrierProfileCode = inferCarrierProfileFromPayload({ ...incomingConfig, ...body });
    const carrierProfile = getCarrierProfile(carrierProfileCode);
    if (!carrierProfileCode || !carrierProfile) {
      return json({
        ok: false,
        reason: "carrier_profile_required",
        message: "Set carrier_profile_code (qr_basic, gs1_digital_link, ntag213, ntag215, ntag216, ntag424_dna, ntag424_dna_tt) before creating a batch.",
      }, 400);
    }
    const requestedQuantity = Math.max(0, Math.trunc(Number(body.quantity || incomingConfig.requested_quantity || 0)));
    const sku = String(body.sku || incomingConfig.sku || "").trim();
    const profile = inferBatchProfile({ ...incomingConfig, profile: body.profile || incomingConfig.profile }) || carrierProfile.label;
    if (!profile) {
      return json({ ok: false, reason: "batch_profile_required", message: "Set profile/security_profile or chip type before creating a batch." }, 400);
    }

    const sdmConfig = {
      mac_input: "enc_plus_cmac_literal",
      mac_input_candidates: ["enc_plus_cmac_literal", "enc_only_ascii", "query_from_enc_to_cmac", "query_from_picc_data_to_cmac"],
      url_template: `https://api.nexid.lat/sun/?v=1&bid=${bid}&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>`,
      ttstatus_enabled: true,
      ttstatus_source: "enc_decrypted",
      ttstatus_offset: 0,
      ttstatus_length: 2,
      ttstatus_closed_values: ["4343"],
      ttstatus_opened_values: ["4F4F", "4F43"],
      ttstatus_invalid_values: ["4949"],
      requested_quantity: requestedQuantity || undefined,
      sku: sku || undefined,
      profile,
      carrier_profile_code: carrierProfileCode,
      carrier_label: carrierProfile.label,
      carrier_capabilities: carrierProfile.capabilities,
      ...incomingConfig,
    };

    const rows = await sql/*sql*/`
      INSERT INTO batches (tenant_id, bid, meta_key_ct, file_key_ct, sdm_config, carrier_profile_code)
      VALUES (${tenant.id}, ${bid}, ${metaCt}, ${fileCt}, ${JSON.stringify(sdmConfig)}::jsonb, ${carrierProfileCode})
      RETURNING id, bid, status, created_at
    `;

    return json({
      batch: { ...rows[0], tenant_slug: tenant.slug, profile, requested_quantity: requestedQuantity, sku, carrier_profile_code: carrierProfileCode, carrier_label: carrierProfile.label },
      carrier: carrierProfile,
      keys: { k_meta_hex: kMetaHex, k_file_hex: kFileHex },
      ndef_url_template: `https://api.nexid.lat/sun/?v=1&bid=${bid}&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>`
    }, 201);
  } catch (error) {
    if (typeof error === "object" && error && (error as { code?: string }).code === "23505") {
      return json({
        ok: false,
        reason: "batch_bid_already_exists",
        message: "BID already exists. Batch creation never overwrites encrypted keys or sdm_config; use an explicit migration/update action.",
      }, 409);
    }
    return json({ ok: false, reason: error instanceof Error ? error.message : "invalid batch payload" }, 400);
  }
}
