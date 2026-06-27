export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';
import { encryptKey16 } from '../../../../lib/keys';
import { randomBytes } from 'node:crypto';
import { requireTenantSunProfile } from '../../../../lib/tenant-onboarding';
import { ensureCarrierProfileSchema } from '../../../../lib/commercial-runtime-schema';
import { getCarrierProfile, inferCarrierProfileFromPayload } from '../../../../lib/carrier-profiles';

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function requiredHex32(value: unknown, field: string) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(normalized)) {
    throw new Error(`${field} must be a 32-char hex string`);
  }
  return normalized;
}

function optionalHex32(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[0-9A-F]{32}$/.test(normalized)) {
    throw new Error('hex keys must be 32-char hex strings');
  }
  return normalized;
}

async function resolveTenant(input: string) {
  const normalized = input.trim();
  if (!normalized) return null;
  const rows = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await sql`SELECT id, slug FROM tenants WHERE id = ${normalized}::uuid LIMIT 1`
    : await sql`SELECT id, slug FROM tenants WHERE slug = ${normalized.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

function resolveApiOrigin(req: Request) {
  const forwardedProto = (req.headers.get('x-forwarded-proto') || '').trim();
  const forwardedHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').trim();
  if (forwardedHost) {
    const proto = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    return `${proto}://${forwardedHost}`.replace(/\/$/, '');
  }
  const fallback = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').trim();
  return fallback ? fallback.replace(/\/$/, '') : 'https://api.nexid.lat';
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureCarrierProfileSchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = firstString(body.mode).toLowerCase();
  const tenantSlug = firstString(body.tenant_slug, body.tenant, body.tenantId, body.tenant_id);
  const bid = firstString(body.bid, body.batch_id, body.batchId);
  if (!tenantSlug || !bid) return json({ ok: false, reason: 'tenant_slug and bid required' }, 400);
  if (!mode) return json({ ok: false, reason: 'mode required', allowed: ['supplier', 'internal'] }, 400);
  if (!['supplier', 'internal'].includes(mode)) return json({ ok: false, reason: 'invalid mode', allowed: ['supplier', 'internal'] }, 400);
  if (mode === 'supplier' && String(process.env.ALLOW_LEGACY_SUPPLIER_BATCH_REGISTER || '').toLowerCase() !== 'true') {
    return json({
      ok: false,
      reason: 'legacy_supplier_registration_disabled',
      message: 'Use /admin/supplier-orders. Legacy supplier registration does not satisfy encrypted key vault, manifest and QA gates.',
    }, 410);
  }
  if (mode === 'supplier') {
    const supplierAuth = checkAdmin(req, ['super_admin']);
    if (supplierAuth) return supplierAuth;
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

  const existingRows = await sql/*sql*/`
    SELECT id, bid, status, created_at
    FROM batches
    WHERE bid = ${bid}
    LIMIT 1
  `;
  if (existingRows[0]) {
    return json({
      ok: false,
      reason: 'batch_bid_already_exists',
      message: 'BID already exists. Registration never overwrites encrypted keys or sdm_config; use an explicit migration/update action.',
      batch: existingRows[0],
    }, 409);
  }

  try {
    const metaInput = firstString(body.k_meta_hex, body.k_meta_batch, body.kMetaHex);
    const fileInput = firstString(body.k_file_hex, body.k_file_batch, body.kFileHex);
    const maybeMeta = optionalHex32(metaInput);
    const maybeFile = optionalHex32(fileInput);
    const kMetaHex = mode === 'internal' ? maybeMeta || randomBytes(16).toString('hex').toUpperCase() : requiredHex32(metaInput, 'k_meta_hex');
    const kFileHex = mode === 'internal' ? maybeFile || randomBytes(16).toString('hex').toUpperCase() : requiredHex32(fileInput, 'k_file_hex');
    const metaCt = encryptKey16(Buffer.from(kMetaHex, 'hex'));
    const fileCt = encryptKey16(Buffer.from(kFileHex, 'hex'));

    const apiOrigin = resolveApiOrigin(req);
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

    const sdmConfig = {
      profile,
      sku,
      chip_model: chipModel,
      carrier_profile_code: carrierProfileCode,
      carrier_label: carrierProfile.label,
      carrier_capabilities: carrierProfile.capabilities,
      requested_quantity: Math.max(0, Math.trunc(Number(body.quantity || body.qty || body.requested_quantity || 0))) || undefined,
      notes: String(body.notes || '').trim() || undefined,
      source: 'supplier_wizard',
      mode,
      url_template: `${apiOrigin}/sun?v=1&bid=${encodeURIComponent(bid)}&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>`,
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

    const rows = await sql`
      INSERT INTO batches (tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config, carrier_profile_code)
      VALUES (${tenant.id}, ${bid}, 'active', ${metaCt}, ${fileCt}, ${JSON.stringify(sdmConfig)}::jsonb, ${carrierProfileCode})
      RETURNING id, bid, status, created_at
    `;

    return json({
      ok: true,
      batch: { ...rows[0], tenant_slug: tenant.slug, carrier_profile_code: carrierProfileCode, carrier_label: carrierProfile.label },
      carrier: carrierProfile,
      keys: { k_meta_hex: kMetaHex, k_file_hex: kFileHex },
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
    return json({ ok: false, reason: error instanceof Error ? error.message : 'invalid payload' }, 400);
  }
}
