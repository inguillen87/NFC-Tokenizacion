export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomBytes } from "crypto";
import { sql } from "../../../lib/db";
import { checkAdmin } from "../../../lib/auth";
import { encryptKey16 } from "../../../lib/keys";
import { json } from "../../../lib/http";

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
  return "custom";
}

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

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
        COALESCE(b.sdm_config->>'profile', b.sdm_config->>'security_profile', 'custom') AS batch_profile,
        COALESCE(NULLIF(b.sdm_config->>'sku', ''), '-') AS sku,
        NULLIF(b.sdm_config->>'requested_quantity', '')::int AS requested_quantity,
        COUNT(tags.id)::int AS quantity,
        COUNT(tags.id) FILTER (WHERE tags.status = 'active')::int AS active_tags,
        COUNT(tags.id) FILTER (WHERE tags.status = 'inactive')::int AS inactive_tags,
        COUNT(tags.id) FILTER (WHERE tags.status = 'revoked')::int AS revoked_tags
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      LEFT JOIN tags ON tags.batch_id = b.id
      WHERE t.slug = ${tenantSlug}
      GROUP BY b.id, t.slug
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
        COALESCE(b.sdm_config->>'profile', b.sdm_config->>'security_profile', 'custom') AS batch_profile,
        COALESCE(NULLIF(b.sdm_config->>'sku', ''), '-') AS sku,
        NULLIF(b.sdm_config->>'requested_quantity', '')::int AS requested_quantity,
        COUNT(tags.id)::int AS quantity,
        COUNT(tags.id) FILTER (WHERE tags.status = 'active')::int AS active_tags,
        COUNT(tags.id) FILTER (WHERE tags.status = 'inactive')::int AS inactive_tags,
        COUNT(tags.id) FILTER (WHERE tags.status = 'revoked')::int AS revoked_tags
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      LEFT JOIN tags ON tags.batch_id = b.id
      GROUP BY b.id, t.slug
      ORDER BY b.created_at DESC
      LIMIT 300
    `;

  return json(rows);
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const tenantInput = String(body.tenant_slug || body.tenantId || "").trim();
  const bid = String(body.bid || body.batchId || "").trim();
  if (!tenantInput || !bid) return json({ ok: false, reason: "tenant_slug and bid required" }, 400);

  const tenant = await resolveTenant(tenantInput);
  if (!tenant) return json({ ok: false, reason: "tenant not found" }, 404);

  try {
    const kMetaHex = normalizeHexKey(body.k_meta_hex, "k_meta_hex") || randomBytes(16).toString("hex").toUpperCase();
    const kFileHex = normalizeHexKey(body.k_file_hex, "k_file_hex") || randomBytes(16).toString("hex").toUpperCase();
    const metaCt = encryptKey16(Buffer.from(kMetaHex, "hex"));
    const fileCt = encryptKey16(Buffer.from(kFileHex, "hex"));

    const incomingConfig = typeof body.sdm_config === "object" && body.sdm_config ? { ...(body.sdm_config as Record<string, unknown>) } : {};
    const requestedQuantity = Math.max(0, Math.trunc(Number(body.quantity || incomingConfig.requested_quantity || 0)));
    const sku = String(body.sku || incomingConfig.sku || "").trim();
    const profile = inferBatchProfile({ ...incomingConfig, profile: body.profile || incomingConfig.profile });

    const sdmConfig = {
      mac_input: "enc_plus_cmac_literal",
      url_template: `https://api.nexid.lat/sun/?v=1&bid=${bid}&picc_data=00000000000000000000000000000000&enc=00000000000000000000000000000000&cmac=0000000000000000`,
      requested_quantity: requestedQuantity || undefined,
      sku: sku || undefined,
      profile,
      ...incomingConfig,
    };

    const rows = await sql/*sql*/`
      INSERT INTO batches (tenant_id, bid, meta_key_ct, file_key_ct, sdm_config)
      VALUES (${tenant.id}, ${bid}, ${metaCt}, ${fileCt}, ${JSON.stringify(sdmConfig)}::jsonb)
      RETURNING id, bid, status, created_at
    `;

    return json({
      batch: { ...rows[0], tenant_slug: tenant.slug, profile, requested_quantity: requestedQuantity, sku },
      keys: { k_meta_hex: kMetaHex, k_file_hex: kFileHex },
      ndef_url_template: `https://api.nexid.lat/sun/?v=1&bid=${bid}&picc_data=00000000000000000000000000000000&enc=00000000000000000000000000000000&cmac=0000000000000000`
    }, 201);
  } catch (error) {
    return json({ ok: false, reason: error instanceof Error ? error.message : "invalid batch payload" }, 400);
  }
}
