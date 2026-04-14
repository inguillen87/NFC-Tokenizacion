export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';
import { encryptKey16 } from '../../../../lib/keys';
import { randomBytes } from 'node:crypto';

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

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = firstString(body.mode, 'supplier').toLowerCase();
  const tenantSlug = firstString(body.tenant_slug, body.tenant, body.tenantId, body.tenant_id);
  const bid = firstString(body.bid, body.batch_id, body.batchId);
  if (!tenantSlug || !bid) return json({ ok: false, reason: 'tenant_slug and bid required' }, 400);

  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return json({ ok: false, reason: 'tenant not found' }, 404);

  try {
    const metaInput = firstString(body.k_meta_hex, body.k_meta_batch, body.kMetaHex);
    const fileInput = firstString(body.k_file_hex, body.k_file_batch, body.kFileHex);
    const maybeMeta = optionalHex32(metaInput);
    const maybeFile = optionalHex32(fileInput);
    const kMetaHex = mode === 'internal' ? maybeMeta || randomBytes(16).toString('hex').toUpperCase() : requiredHex32(metaInput, 'k_meta_hex');
    const kFileHex = mode === 'internal' ? maybeFile || randomBytes(16).toString('hex').toUpperCase() : requiredHex32(fileInput, 'k_file_hex');
    const metaCt = encryptKey16(Buffer.from(kMetaHex, 'hex'));
    const fileCt = encryptKey16(Buffer.from(kFileHex, 'hex'));

    const sdmConfig = {
      profile: firstString(body.profile, body.sku, 'supplier') || 'supplier',
      sku: firstString(body.sku, body.profile) || undefined,
      chip_model: firstString(body.chip_model, body.chip, body.chip_type) || undefined,
      requested_quantity: Math.max(0, Math.trunc(Number(body.quantity || body.qty || body.requested_quantity || 0))) || undefined,
      notes: String(body.notes || '').trim() || undefined,
      source: 'supplier_wizard',
      mode,
      url_template: `https://api.nexid.lat/sun?v=1&bid=${encodeURIComponent(bid)}&picc_data=...&enc=...&cmac=...`,
    };

    const rows = await sql`
      INSERT INTO batches (tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config)
      VALUES (${tenant.id}, ${bid}, 'active', ${metaCt}, ${fileCt}, ${JSON.stringify(sdmConfig)}::jsonb)
      ON CONFLICT (bid)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        status = 'active',
        meta_key_ct = EXCLUDED.meta_key_ct,
        file_key_ct = EXCLUDED.file_key_ct,
        sdm_config = EXCLUDED.sdm_config,
        updated_at = now()
      RETURNING id, bid, status, created_at
    `;

    return json({
      ok: true,
      batch: { ...rows[0], tenant_slug: tenant.slug },
      keys: { k_meta_hex: kMetaHex, k_file_hex: kFileHex },
      ndef_url_template: sdmConfig.url_template,
    });
  } catch (error) {
    return json({ ok: false, reason: error instanceof Error ? error.message : 'invalid payload' }, 400);
  }
}
