export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { checkAdmin } from "../../../../../../lib/auth";
import { sql } from "../../../../../../lib/db";
import { json } from "../../../../../../lib/http";
import { decryptKey16 } from "../../../../../../lib/keys";
import { summarizeBatchSdmConfig } from "../../../../../../lib/sun-service";

function fingerprintFromCiphertext(ct: unknown, context: { tenantId: string; bid: string; role: "K_META_BATCH" | "K_FILE_BATCH"; keyVersion: number }) {
  if (!ct) return null;
  try {
    const hex = decryptKey16(String(ct), context).toString("hex").toUpperCase();
    return createHash("sha256").update(Buffer.from(hex, "hex")).digest("hex").slice(0, 16).toUpperCase();
  } catch {
    return "KMS_DECRYPT_FAILED";
  }
}

export async function GET(req: Request, context: { params: Promise<{ bid: string }> }) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;

  const { bid: rawBid } = await context.params;
  const bid = decodeURIComponent(String(rawBid || "")).trim();
  if (!bid) return json({ ok: false, reason: "bid required" }, 400);

  const rows = await sql/*sql*/`
    SELECT
      b.id,
      b.bid,
      b.tenant_id,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      b.status,
      b.carrier_profile_code,
      b.sdm_config,
      b.meta_key_ct,
      b.file_key_ct,
      b.created_at,
      COUNT(tags.id)::int AS tag_count,
      COUNT(tags.id) FILTER (WHERE tags.status = 'active')::int AS active_tag_count
    FROM batches b
    LEFT JOIN tenants t ON t.id = b.tenant_id
    LEFT JOIN tags ON tags.batch_id = b.id
    WHERE b.bid = ${bid}
    GROUP BY b.id, t.id
    ORDER BY b.created_at ASC, b.id ASC
  `;

  if (!rows.length) return json({ ok: false, reason: "batch not found", bid, batches: [] }, 404);

  const batches = rows.map((row) => {
    const keyVersion = Number((row.sdm_config as { key_version?: unknown } | null)?.key_version || 1);
    const keyContext = {
      tenantId: String(row.tenant_id),
      bid: String(row.bid),
      keyVersion: Number.isSafeInteger(keyVersion) && keyVersion > 0 ? keyVersion : 1,
    };
    return ({
    id: row.id,
    bid: row.bid,
    tenant_id: row.tenant_id,
    tenant_slug: row.tenant_slug || null,
    tenant_name: row.tenant_name || null,
    status: row.status || null,
    carrier_profile_code: row.carrier_profile_code || null,
    created_at: row.created_at || null,
    tag_count: Number(row.tag_count || 0),
    active_tag_count: Number(row.active_tag_count || 0),
    keys_present: Boolean(row.meta_key_ct && row.file_key_ct),
    key_fingerprints: {
      k_meta_sha256_prefix: fingerprintFromCiphertext(row.meta_key_ct, { ...keyContext, role: "K_META_BATCH" }),
      k_file_sha256_prefix: fingerprintFromCiphertext(row.file_key_ct, { ...keyContext, role: "K_FILE_BATCH" }),
    },
    batch_sdm_config: summarizeBatchSdmConfig(row.sdm_config),
    });
  });
  const duplicate = batches.length > 1;

  return json({
    ok: !duplicate,
    reason: duplicate ? "DUPLICATE_BID" : undefined,
    message: duplicate ? "BID must be globally unique because /sun only receives bid." : undefined,
    bid,
    count: batches.length,
    batches,
  }, duplicate ? 409 : 200);
}
