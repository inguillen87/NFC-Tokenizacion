export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomBytes } from "crypto";
import { sql } from "../../../lib/db";
import { checkAdmin } from "../../../lib/auth";
import { encryptKey16 } from "../../../lib/keys";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get("tenant") || "";

  const rows = tenantSlug
    ? await sql/*sql*/`
      SELECT b.id, b.bid, b.status, b.created_at, t.slug AS tenant_slug
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE t.slug = ${tenantSlug}
      ORDER BY b.created_at DESC
      LIMIT 300
    `
    : await sql/*sql*/`
      SELECT b.id, b.bid, b.status, b.created_at, t.slug AS tenant_slug
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      ORDER BY b.created_at DESC
      LIMIT 300
    `;

  return json(rows);
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const tenantSlug = String(body.tenant_slug || "").toLowerCase();
  const bid = String(body.bid || "");
  if (!tenantSlug || !bid) return json({ ok: false, reason: "tenant_slug and bid required" }, 400);

  const tenants = await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
  const tenant = tenants[0];
  if (!tenant) return json({ ok: false, reason: "tenant not found" }, 404);

  const kMetaHex = body.k_meta_hex ? String(body.k_meta_hex).toUpperCase() : randomBytes(16).toString("hex").toUpperCase();
  const kFileHex = body.k_file_hex ? String(body.k_file_hex).toUpperCase() : randomBytes(16).toString("hex").toUpperCase();
  const metaCt = encryptKey16(Buffer.from(kMetaHex, "hex"));
  const fileCt = encryptKey16(Buffer.from(kFileHex, "hex"));

  const sdmConfig = body.sdm_config || {
    mac_input: "enc_plus_cmac_literal",
    url_template: `https://api.nexid.lat/sun/?v=1&bid=${bid}&picc_data=00000000000000000000000000000000&enc=00000000000000000000000000000000&cmac=0000000000000000`
  };

  const rows = await sql/*sql*/`
    INSERT INTO batches (tenant_id, bid, meta_key_ct, file_key_ct, sdm_config)
    VALUES (${tenant.id}, ${bid}, ${metaCt}, ${fileCt}, ${JSON.stringify(sdmConfig)}::jsonb)
    RETURNING id, bid, status, created_at
  `;

  return json({
    batch: rows[0],
    keys: { k_meta_hex: kMetaHex, k_file_hex: kFileHex },
    ndef_url_template: `https://api.nexid.lat/sun/?v=1&bid=${bid}&picc_data=00000000000000000000000000000000&enc=00000000000000000000000000000000&cmac=0000000000000000`
  }, 201);
}
