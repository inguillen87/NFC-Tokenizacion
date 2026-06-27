export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, randomBytes } from "node:crypto";
import { checkAdmin } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { decryptKey16 } from "../../../../../lib/keys";
import { logAuditEvent } from "../../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import { buildSupplierEncodingPack } from "../../../../../lib/supplier-ops";
import { hashEvidencePayload } from "../../../../../lib/proof-layer";

function sha256Text(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function safeActor(req: Request) {
  return (
    req.headers.get("x-nexid-actor")
    || req.headers.get("x-dashboard-user")
    || req.headers.get("x-forwarded-user")
    || "super_admin"
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { orderId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedBid = String(body.bid || body.batch_id || "").trim();
  const actor = safeActor(req);

  const orderRows = await sql/*sql*/`
    SELECT so.*, t.slug AS tenant_slug
    FROM supplier_orders so
    JOIN tenants t ON t.id = so.tenant_id
    WHERE so.id = ${orderId}::uuid
    LIMIT 1
  `;
  const order = orderRows[0];
  if (!order) return json({ ok: false, reason: "supplier_order_not_found" }, 404);

  const rows = requestedBid
    ? await sql/*sql*/`
        SELECT
          ssb.id AS supplier_sub_batch_id,
          ssb.bid,
          ssb.expected_quantity,
          ssb.metadata_json,
          b.id AS batch_id,
          b.sdm_config,
          bk.meta_key_ct,
          bk.file_key_ct,
          bk.key_fingerprint,
          bk.export_count
        FROM supplier_sub_batches ssb
        JOIN batches b ON b.id = ssb.batch_id
        JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id
        WHERE ssb.supplier_order_id = ${order.id} AND ssb.bid = ${requestedBid}
        ORDER BY ssb.sequence_index ASC
      `
    : await sql/*sql*/`
        SELECT
          ssb.id AS supplier_sub_batch_id,
          ssb.bid,
          ssb.expected_quantity,
          ssb.metadata_json,
          b.id AS batch_id,
          b.sdm_config,
          bk.meta_key_ct,
          bk.file_key_ct,
          bk.key_fingerprint,
          bk.export_count
        FROM supplier_sub_batches ssb
        JOIN batches b ON b.id = ssb.batch_id
        JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id
        WHERE ssb.supplier_order_id = ${order.id}
        ORDER BY ssb.sequence_index ASC
      `;
  if (!rows.length) return json({ ok: false, reason: "supplier_sub_batch_not_found" }, 404);

  const passwordRecommendation = `nexID-${String(order.customer_slug || order.tenant_slug).toUpperCase()}-${randomBytes(8).toString("hex").toUpperCase()}`;
  const packs = [];

  for (const row of rows) {
    const kMetaHex = decryptKey16(String(row.meta_key_ct)).toString("hex").toUpperCase();
    const kFileHex = decryptKey16(String(row.file_key_ct)).toString("hex").toUpperCase();
    const urlTemplate = String(row.metadata_json?.url_template || row.sdm_config?.url_template || "");
    const pack = buildSupplierEncodingPack({
      clientSlug: String(order.customer_slug || order.tenant_slug),
      batchId: String(row.bid),
      quantity: Number(row.expected_quantity || 0),
      chipModel: String(order.chip_model || ""),
      carrierProfile: String(order.carrier_profile_code || ""),
      materialType: order.material_type || null,
      notes: order.notes || null,
      kMetaHex,
      kFileHex,
      urlTemplate,
    });

    const jsonBody = JSON.stringify(pack.json, null, 2);
    const jsonHash = sha256Text(jsonBody);
    await sql/*sql*/`
      INSERT INTO vault_artifacts (
        tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
        artifact_type, content_hash, mime_type, metadata_json
      ) VALUES
        (${order.tenant_id}, ${order.id}, ${row.supplier_sub_batch_id}, 'supplier_sub_batch', ${row.supplier_sub_batch_id}, 'supplier_pack_txt', ${pack.contentHash}, 'text/plain', ${JSON.stringify({ bid: row.bid, key_fingerprint: row.key_fingerprint })}::jsonb),
        (${order.tenant_id}, ${order.id}, ${row.supplier_sub_batch_id}, 'supplier_sub_batch', ${row.supplier_sub_batch_id}, 'supplier_pack_json', ${jsonHash}, 'application/json', ${JSON.stringify({ bid: row.bid, key_fingerprint: row.key_fingerprint })}::jsonb)
    `;
    await sql/*sql*/`
      UPDATE batch_keys
      SET export_count = export_count + 1, exported_at = now()
      WHERE supplier_sub_batch_id = ${row.supplier_sub_batch_id}
    `;
    await sql/*sql*/`
      UPDATE supplier_sub_batches
      SET key_export_count = key_export_count + 1, key_exported_at = now(), updated_at = now()
      WHERE id = ${row.supplier_sub_batch_id}
    `;

    const eventPayload = {
      supplier_order_id: order.id,
      supplier_sub_batch_id: row.supplier_sub_batch_id,
      bid: row.bid,
      content_hash: pack.contentHash,
      json_hash: jsonHash,
      key_fingerprint: row.key_fingerprint,
      exported_by: actor,
    };
    const eventHash = hashEvidencePayload({
      tenantId: String(order.tenant_id),
      resourceType: "supplier_sub_batch",
      resourceId: String(row.supplier_sub_batch_id),
      eventType: "supplier_pack_exported",
      payload: eventPayload,
    });
    await sql/*sql*/`
      INSERT INTO evidence_events (tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash)
      VALUES (${order.tenant_id}, 'supplier_sub_batch', ${row.supplier_sub_batch_id}, 'supplier_pack_exported', ${JSON.stringify(eventPayload)}::jsonb, ${eventHash})
      ON CONFLICT (payload_hash) DO NOTHING
    `;

    packs.push({
      folder: String(row.bid),
      bid: row.bid,
      key_fingerprint: row.key_fingerprint,
      text_filename: `${row.bid}_supplier_encoding_pack.txt`,
      json_filename: `${row.bid}_supplier_encoding_pack.json`,
      pdf_summary_filename: `${row.bid}_supplier_encoding_summary.pdf`,
      text: pack.text,
      json: pack.json,
      content_hash: pack.contentHash,
      json_hash: jsonHash,
    });
  }

  await logAuditEvent({
    actorId: null,
    tenantId: String(order.tenant_id),
    action: "supplier_pack_exported",
    resourceType: "supplier_order",
    resourceId: String(order.id),
    afterData: {
      order_id: order.id,
      exported_by: actor,
      bids: packs.map((pack) => ({
        bid: pack.bid,
        content_hash: pack.content_hash,
        key_fingerprint: pack.key_fingerprint,
      })),
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    order: {
      id: order.id,
      tenant_slug: order.tenant_slug,
      customer_slug: order.customer_slug,
      order_name: order.order_name,
    },
    zip_layout: "one-folder-per-sub-batch",
    password_recommendation: passwordRecommendation,
    warning: "This response contains one-time supplier plaintext keys. Do not store it in chat, logs, tickets, or screenshots.",
    packs,
  });
}
