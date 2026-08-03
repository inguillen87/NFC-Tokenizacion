export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin, checkAdminPermission, getAdminActor, getAdminTenantAccess } from '../../../../lib/auth';
import { buildBatchKeyLifecycleRecords, generateBatchKeyHex } from '../../../../lib/batch-keys';
import { readBoundedJsonBody, RequestBodyTooLargeError } from '../../../../lib/bounded-request-body';
import { json } from '../../../../lib/http';
import { sql, sqlSerializable } from '../../../../lib/db';
import { createHash } from 'node:crypto';
import { requireTenantSunProfile } from '../../../../lib/tenant-onboarding';
import { ensureCarrierProfileSchema } from '../../../../lib/commercial-runtime-schema';
import { getCarrierProfile, inferCarrierProfileFromPayload } from '../../../../lib/carrier-profiles';
import { resolveSupplierPublicTagOrigin } from '../../../../lib/supplier-public-tag-origin';

const MAX_BODY_BYTES = 32 * 1024;
const BID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
}

async function resolveTenant(input: string) {
  const normalized = input.trim();
  if (!normalized) return null;
  const rows = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await sql`SELECT id, slug FROM tenants WHERE id = ${normalized}::uuid LIMIT 1`
    : await sql`SELECT id, slug FROM tenants WHERE slug = ${normalized.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

function keyFingerprint(kMetaHex: string, kFileHex: string) {
  return `sha256:${createHash('sha256').update(`${kMetaHex}:${kFileHex}`).digest('hex')}`;
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ['super_admin', 'tenant_admin', 'reseller']);
  if (auth) return auth;
  await ensureCarrierProfileSchema();

  let body: Record<string, unknown>;
  try {
    const parsed = await readBoundedJsonBody<unknown>(req, MAX_BODY_BYTES);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    body = parsed as Record<string, unknown>;
  } catch (error) {
    return json({
      ok: false,
      reason: error instanceof RequestBodyTooLargeError
        ? 'internal_batch_body_too_large'
        : 'internal_batch_payload_invalid',
    }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  const mode = firstString(body.mode).toLowerCase();
  const requestedTenantSlug = firstString(body.tenant_slug, body.tenant, body.tenantId, body.tenant_id);
  const adminTenantAccess = getAdminTenantAccess(req, requestedTenantSlug);
  const { effectiveTenantSlug: tenantSlug } = adminTenantAccess;
  const bid = firstString(body.bid, body.batch_id, body.batchId);
  if (!tenantSlug || !bid) return json({ ok: false, reason: 'tenant_slug and bid required' }, 400);
  if (!BID_RE.test(bid)) return json({ ok: false, reason: 'batch_bid_invalid' }, 400);
  if (!mode) return json({ ok: false, reason: 'mode required', allowed: ['supplier', 'internal'] }, 400);
  if (!['supplier', 'internal'].includes(mode)) return json({ ok: false, reason: 'invalid mode', allowed: ['supplier', 'internal'] }, 400);
  if (mode === 'supplier') {
    return json({
      ok: false,
      reason: 'legacy_supplier_registration_disabled',
      message: 'Use /admin/supplier-orders. Supplier batches require server-side key generation, encrypted one-time supplier packs, immutable manifests and QA gates.',
    }, 410);
  }
  const internalRegistrationPermission = checkAdminPermission(req, 'batch:register_internal');
  if (internalRegistrationPermission) {
    return json({
      ok: false,
      reason: 'internal_batch_registration_forbidden',
      message: 'Internal encrypted batch registration requires superadmin or explicit batch:register_internal permission. Use Supplier Orders for production supplier stock.',
    }, 403);
  }

  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return json({ ok: false, reason: 'tenant not found' }, 404);
  const readiness = await requireTenantSunProfile(String(tenant.id)).catch((error) => ({ ok: false, missing: (error as Error & { missing?: string[] }).missing || ['tenant_sun_profiles'] }));
  if (!readiness.ok) {
    return json({
      ok: false,
      reason: 'tenant_sun_profile_incomplete',
      message: 'Complete SUN tenant profile before registering supplier/internal batches.',
      missing: readiness.missing,
    }, 409);
  }

  const profile = firstString(body.profile, body.security_profile);
  const sku = firstString(body.sku);
  const chipModel = firstString(body.chip_model, body.chip, body.chip_type);
  const carrierProfileCode = inferCarrierProfileFromPayload(body);
  const carrierProfile = getCarrierProfile(carrierProfileCode);
  if (!profile || !sku || !chipModel || !carrierProfileCode || !carrierProfile) {
    return json({
      ok: false,
      reason: 'batch_identity_required',
      missing: [
        'profile',
        'sku',
        'chip_model',
        'carrier_profile_code',
      ].filter((field) => field === 'profile' ? !profile : field === 'sku' ? !sku : field === 'chip_model' ? !chipModel : !carrierProfileCode),
    }, 400);
  }
  const quantityValue = body.quantity ?? body.qty ?? body.requested_quantity;
  const requestedQuantity = quantityValue === undefined || quantityValue === null || quantityValue === ''
    ? undefined
    : Number(quantityValue);
  if (requestedQuantity !== undefined && (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > 1_000_000)) {
    return json({ ok: false, reason: 'batch_quantity_invalid' }, 400);
  }

  try {
    const keyVersion = 1;
    const kMetaHex = generateBatchKeyHex();
    const kFileHex = generateBatchKeyHex();
    const fingerprint = keyFingerprint(kMetaHex, kFileHex);
    const createdBy = getAdminActor(req).email;
    const keyMaterial = buildBatchKeyLifecycleRecords({
      tenantId: String(tenant.id),
      bid,
      kMetaHex,
      kFileHex,
      keyVersion,
      createdBy,
    });
    const metaRecord = keyMaterial.find((item) => item.keyRole === 'K_META_BATCH');
    const fileRecord = keyMaterial.find((item) => item.keyRole === 'K_FILE_BATCH');
    const metaCt = metaRecord?.encryptedKeyCt;
    const fileCt = fileRecord?.encryptedKeyCt;
    if (!metaCt || !fileCt || !metaRecord?.keyFingerprint || !fileRecord?.keyFingerprint) {
      throw new Error('batch key lifecycle records are incomplete');
    }

    const publicTagOrigin = resolveSupplierPublicTagOrigin();

    const sdmConfig = {
      profile,
      sku,
      chip_model: chipModel,
      carrier_profile_code: carrierProfileCode,
      carrier_label: carrierProfile.label,
      carrier_capabilities: carrierProfile.capabilities,
      requested_quantity: requestedQuantity,
      notes: String(body.notes || '').trim() || undefined,
      source: 'server_generated_internal',
      mode,
      key_version: keyVersion,
      url_template: `${publicTagOrigin}/sun?v=1&bid=${encodeURIComponent(bid)}&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>`,
      mac_input: 'enc_plus_cmac_literal',
      mac_input_candidates: ['enc_plus_cmac_literal', 'enc_only_ascii', 'query_from_enc_to_cmac', 'query_from_picc_data_to_cmac'],
      tagtamper_enabled: true,
      tamper_status_enabled: true,
      tamper_status_source: 'enc_decrypted',
      tamper_status_offset: 0,
      tamper_status_length: 2,
      tamper_closed_values: ['4343'],
      tamper_open_values: ['4F4F', '4F43'],
      tamper_invalid_values: ['4949'],
      tamper_unknown_policy: 'UNKNOWN',
      ttstatus_enabled: true,
      ttstatus_source: 'enc_decrypted',
      ttstatus_offset: 0,
      ttstatus_length: 2,
      ttstatus_closed_values: ['4343'],
      ttstatus_opened_values: ['4F4F', '4F43'],
      ttstatus_invalid_values: ['4949'],
      ttstatus_plain_or_encrypted: 'encrypted',
    };

    const rows = await sqlSerializable/*sql*/`
      WITH bid_lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended(
          'supplier-bid' || chr(31) || upper(trim(${bid})),
          0
        )) AS acquired
      ), inserted_batch AS (
        INSERT INTO batches (tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config, carrier_profile_code)
        SELECT ${tenant.id}, ${bid}, 'active', ${metaCt}, ${fileCt}, ${JSON.stringify(sdmConfig)}::jsonb, ${carrierProfileCode}
        FROM bid_lock
        WHERE NOT EXISTS (
          SELECT 1 FROM batches existing_batch
          WHERE upper(trim(existing_batch.bid)) = upper(trim(${bid}))
        )
          AND NOT EXISTS (
            SELECT 1 FROM supplier_sub_batches existing_sub_batch
            WHERE upper(trim(existing_sub_batch.bid)) = upper(trim(${bid}))
        )
        RETURNING id, bid, status, created_at
      ), inserted_pair AS (
        INSERT INTO batch_keys (
          tenant_id, batch_id, bid, meta_key_ct, file_key_ct, key_fingerprint,
          key_version, created_by
        )
        SELECT ${tenant.id}, inserted_batch.id, inserted_batch.bid, ${metaCt}, ${fileCt}, ${fingerprint},
               ${keyVersion}, ${createdBy}
        FROM inserted_batch
        RETURNING id
      ), inserted_material AS (
        INSERT INTO batch_key_material (
          tenant_id, batch_id, bid, key_role, key_version, encrypted_key_ct,
          key_fingerprint, status, created_by, metadata_json
        )
        SELECT ${tenant.id}, inserted_batch.id, inserted_batch.bid,
               'K_META_BATCH', ${keyVersion}, ${metaCt}, ${metaRecord.keyFingerprint},
               'active', ${createdBy}, ${JSON.stringify({
                 source: 'internal_batch_register',
                 pair_fingerprint: fingerprint,
                 software_envelope: true,
                 managed_kms: false,
                 hsm_backed: false,
               })}::jsonb
        FROM inserted_batch
        UNION ALL
        SELECT ${tenant.id}, inserted_batch.id, inserted_batch.bid,
               'K_FILE_BATCH', ${keyVersion}, ${fileCt}, ${fileRecord.keyFingerprint},
               'active', ${createdBy}, ${JSON.stringify({
                 source: 'internal_batch_register',
                 pair_fingerprint: fingerprint,
                 software_envelope: true,
                 managed_kms: false,
                 hsm_backed: false,
               })}::jsonb
        FROM inserted_batch
        RETURNING id
      )
      SELECT inserted_batch.id, inserted_batch.bid, inserted_batch.status, inserted_batch.created_at,
             (SELECT count(*)::integer FROM inserted_pair) AS key_pair_count,
             (SELECT count(*)::integer FROM inserted_material) AS key_material_count
      FROM inserted_batch
    `;
    if (!rows[0]) {
      return json({
        ok: false,
        reason: 'batch_bid_already_exists',
        message: 'BID already exists. Registration never overwrites encrypted keys or sdm_config; use an explicit migration/update action.',
      }, 409);
    }
    if (Number(rows[0].key_pair_count) !== 1 || Number(rows[0].key_material_count) !== 2) {
      throw new Error('internal batch lifecycle receipt is incomplete');
    }

    return json({
      ok: true,
      batch: {
        id: rows[0].id,
        bid: rows[0].bid,
        status: rows[0].status,
        created_at: rows[0].created_at,
        tenant_slug: tenant.slug,
        carrier_profile_code: carrierProfileCode,
        carrier_label: carrierProfile.label,
      },
      carrier: carrierProfile,
      key_custody: {
        status: 'tenant_vault_encrypted',
        exposed: false,
        fingerprint,
      },
      ndef_url_template: sdmConfig.url_template,
    });
  } catch (error) {
    if (typeof error === 'object' && error && (error as { code?: string }).code === '23505') {
      return json({
        ok: false,
        reason: 'batch_bid_already_exists',
        message: 'BID already exists. Registration never overwrites encrypted keys or sdm_config; use an explicit migration/update action.',
      }, 409);
    }
    return json({ ok: false, reason: 'internal_batch_registration_unavailable' }, 503);
  }
}
