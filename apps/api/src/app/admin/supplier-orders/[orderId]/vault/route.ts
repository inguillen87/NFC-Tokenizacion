export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";

const SAFE_METADATA_KEYS = new Set([
  "bid",
  "filename",
  "plaintext_zip_sha256",
  "ciphertext_sha256",
  "envelope_sha256",
  "password_policy",
  "entry_count",
  "row_count",
  "manifest_type",
  "key_fingerprint",
  "key_version",
  "qa_status",
  "rotated_by",
  "rotation_reason",
  "sample_count",
  "replay_checked",
  "ttstatus_checked",
  "evidence_digest",
]);

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(input)) {
    if (SAFE_METADATA_KEYS.has(key)) output[key] = item;
  }
  const encryption = input.encryption;
  if (encryption && typeof encryption === "object" && !Array.isArray(encryption)) {
    const algorithm = (encryption as Record<string, unknown>).algorithm;
    if (algorithm) output.encryption_algorithm = algorithm;
  }
  return output;
}

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { orderId } = await params;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const orderRows = forcedTenantSlug
    ? await sql/*sql*/`
        SELECT so.id, so.tenant_id, so.customer_slug, so.order_name, t.slug AS tenant_slug
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        WHERE so.id = ${orderId}::uuid AND t.slug = ${forcedTenantSlug}
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT so.id, so.tenant_id, so.customer_slug, so.order_name, t.slug AS tenant_slug
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        WHERE so.id = ${orderId}::uuid
        LIMIT 1
      `;
  const order = orderRows[0];
  if (!order) return json({ ok: false, reason: "supplier_order_not_found" }, 404);

  const rows = await sql/*sql*/`
    SELECT
      va.id,
      va.resource_type,
      va.resource_id,
      va.artifact_type,
      va.content_hash,
      va.mime_type,
      va.status,
      va.metadata_json,
      va.created_at,
      ssb.bid
    FROM vault_artifacts va
    LEFT JOIN supplier_sub_batches ssb ON ssb.id = va.supplier_sub_batch_id
    WHERE va.supplier_order_id = ${order.id}
    ORDER BY va.created_at DESC
    LIMIT 100
  `;

  return json({
    ok: true,
    key_custody: {
      mode: "pilot_application_envelope_encryption",
      managed_kms: false,
      hsm_backed: false,
      secrets_exposed: false,
    },
    order: {
      id: order.id,
      tenant_slug: order.tenant_slug,
      customer_slug: order.customer_slug,
      order_name: order.order_name,
    },
    artifacts: rows.map((row) => ({
      id: row.id,
      bid: row.bid || null,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      artifact_type: row.artifact_type,
      content_hash: row.content_hash,
      mime_type: row.mime_type,
      status: row.status,
      created_at: row.created_at,
      metadata: sanitizeMetadata(row.metadata_json),
    })),
  });
}
