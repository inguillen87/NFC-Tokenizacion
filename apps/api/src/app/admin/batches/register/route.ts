export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin, getAdminTenantScope, type AdminScope } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';
import { encryptKey16 } from '../../../../lib/keys';
import { createHash, randomBytes } from 'node:crypto';
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

function parsePermissionHeader(value: string | null) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasScopedPermission(grants: string[], permission: string) {
  const current = permission.trim();
  for (const rawGrant of grants) {
    const grant = String(rawGrant || '').trim();
    if (!grant || grant === '*') continue;
    if (grant === current) return true;
    if (grant.endsWith(':*')) {
      const prefix = grant.slice(0, -2);
      if (current === prefix || current.startsWith(`${prefix}:`)) return true;
    }
  }
  return false;
}

function canRegisterInternalBatch(scope: AdminScope | null, permissions: string[]) {
  return scope === null
    || scope === 'super_admin'
    || scope === 'security_operator'
    || hasScopedPermission(permissions, 'batch:register_internal');
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
  const auth = checkAdmin(req, ['super_admin', 'tenant_admin', 'security_operator', 'reseller']);
  if (auth) return auth;
  await ensureCarrierProfileSchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = firstString(body.mode).toLowerCase();
  const tenantSlug = firstString(body.tenant_slug, body.tenant, body.tenantId, body.tenant_id);
  const bid = firstString(body.bid, body.batch_id, body.batchId);
  if (!tenantSlug || !bid) return json({ ok: false, reason: 'tenant_slug and bid required' }, 400);
  if (!mode) return json({ ok: false, reason: 'mode required', allowed: ['supplier', 'internal'] }, 400);
  if (!['supplier', 'internal'].includes(mode)) return json({ ok: false, reason: 'invalid mode', allowed: ['supplier', 'internal'] }, 400);
  if (mode === 'supplier') {
    return json({
      ok: false,
      reason: 'legacy_supplier_registration_disabled',
      message: 'Use /admin/supplier-orders. Supplier batches require server-side key generation, encrypted one-time supplier packs, immutable manifests and QA gates.',
    }, 410);
  }
  const adminTenantScope = getAdminTenantScope(req);
  const permissionGrants = parsePermissionHeader(req.headers.get('x-nexid-permissions'));
  if (!canRegisterInternalBatch(adminTenantScope.scope, permissionGrants)) {
    return json({
      ok: false,
      reason: 'internal_batch_registration_forbidden',
      message: 'Internal encrypted batch registration requires superadmin, security-operator scope, or batch:register_internal permission. Use Supplier Orders for production supplier stock.',
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
    const kMetaHex = randomBytes(16).toString('hex').toUpperCase();
    const kFileHex = randomBytes(16).toString('hex').toUpperCase();
    const fingerprint = keyFingerprint(kMetaHex, kFileHex);
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
      source: 'server_generated_internal',
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
    return json({ ok: false, reason: error instanceof Error ? error.message : 'invalid payload' }, 400);
  }
}
