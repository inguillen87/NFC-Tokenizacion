export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, randomBytes } from "node:crypto";
import { checkAdmin } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { decryptKey16 } from "../../../../../lib/keys";
import { logAuditEvent } from "../../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import {
  buildSupplierEncodingPack,
  buildSupplierPackPdfSummary,
  buildZipArchive,
  encryptSupplierZipArchive,
  sha256Buffer,
  type SupplierZipEntry,
} from "../../../../../lib/supplier-ops";
import { hashEvidencePayload } from "../../../../../lib/proof-layer";

function sha256Text(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function safeFilename(value: unknown, fallback: string) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
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
  const zipEntries: SupplierZipEntry[] = [];

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
    const pdfBody = buildSupplierPackPdfSummary({
      clientSlug: String(order.customer_slug || order.tenant_slug),
      batchId: String(row.bid),
      quantity: Number(row.expected_quantity || 0),
      chipModel: String(order.chip_model || ""),
      carrierProfile: String(order.carrier_profile_code || ""),
      keyFingerprint: String(row.key_fingerprint || ""),
      contentHash: pack.contentHash,
      jsonHash,
      urlTemplate,
    });
    const pdfHash = sha256Buffer(pdfBody);
    const textFilename = `${row.bid}_supplier_encoding_pack.txt`;
    const jsonFilename = `${row.bid}_supplier_encoding_pack.json`;
    const pdfFilename = `${row.bid}_supplier_encoding_summary.pdf`;
    zipEntries.push(
      { path: `${row.bid}/${textFilename}`, data: pack.text },
      { path: `${row.bid}/${jsonFilename}`, data: jsonBody },
      { path: `${row.bid}/${pdfFilename}`, data: pdfBody },
    );
    await sql/*sql*/`
      INSERT INTO vault_artifacts (
        tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
        artifact_type, content_hash, mime_type, metadata_json
      ) VALUES
        (${order.tenant_id}, ${order.id}, ${row.supplier_sub_batch_id}, 'supplier_sub_batch', ${row.supplier_sub_batch_id}, 'supplier_pack_txt', ${pack.contentHash}, 'text/plain', ${JSON.stringify({ bid: row.bid, key_fingerprint: row.key_fingerprint })}::jsonb),
        (${order.tenant_id}, ${order.id}, ${row.supplier_sub_batch_id}, 'supplier_sub_batch', ${row.supplier_sub_batch_id}, 'supplier_pack_json', ${jsonHash}, 'application/json', ${JSON.stringify({ bid: row.bid, key_fingerprint: row.key_fingerprint })}::jsonb),
        (${order.tenant_id}, ${order.id}, ${row.supplier_sub_batch_id}, 'supplier_sub_batch', ${row.supplier_sub_batch_id}, 'supplier_pack_pdf_summary', ${pdfHash}, 'application/pdf', ${JSON.stringify({ bid: row.bid, key_fingerprint: row.key_fingerprint })}::jsonb)
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
      pdf_hash: pdfHash,
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
      text_filename: textFilename,
      json_filename: jsonFilename,
      pdf_summary_filename: pdfFilename,
      content_hash: pack.contentHash,
      json_hash: jsonHash,
      pdf_hash: pdfHash,
    });
  }

  const readme = [
    "nexID Supplier Encoding Pack",
    "",
    `Order: ${order.order_name || order.id}`,
    `Tenant: ${order.tenant_slug}`,
    `Customer: ${order.customer_slug || order.tenant_slug}`,
    `Sub-batches: ${packs.length}`,
    "",
    "Contents:",
    "- One folder per sub-batch.",
    "- TXT and JSON contain supplier encoding keys for that sub-batch only.",
    "- PDF contains human-readable instructions and hashes.",
    "- CHECKSUMS.sha256 verifies every file before factory handoff.",
    "",
    "Security:",
    "- This encrypted container is the only browser payload.",
    "- KMS, DB URLs, admin keys, Polygon private keys, IOTA private keys and webhook secrets are never included.",
    "- Password is shown once in nexID and must be sent over a separate channel.",
    "- Do not paste decrypted keys into chat, tickets, screenshots or logs.",
    "",
  ].join("\n");
  const archiveEntries: SupplierZipEntry[] = [{ path: "README_FIRST.txt", data: readme }, ...zipEntries];
  const checksums = archiveEntries
    .map((entry) => `${sha256Buffer(entry.data).replace(/^sha256:/, "")}  ${entry.path}`)
    .join("\n") + "\n";
  archiveEntries.push({ path: "CHECKSUMS.sha256", data: checksums });

  const zipBuffer = buildZipArchive(archiveEntries);
  const encrypted = encryptSupplierZipArchive(zipBuffer, passwordRecommendation, {
    order_id: order.id,
    tenant_slug: order.tenant_slug,
    customer_slug: order.customer_slug,
    order_name: order.order_name,
    zip_layout: "one-folder-per-sub-batch",
    sub_batches: packs.map((pack) => ({
      bid: pack.bid,
      key_fingerprint: pack.key_fingerprint,
      content_hash: pack.content_hash,
      json_hash: pack.json_hash,
      pdf_hash: pack.pdf_hash,
    })),
  });
  const encryptedFilename = `nexid-supplier-pack-${safeFilename(order.customer_slug || order.tenant_slug, "supplier")}-${String(order.id).slice(0, 8)}.zip.enc`;
  await sql/*sql*/`
    INSERT INTO vault_artifacts (
      tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
      artifact_type, content_hash, mime_type, metadata_json
    ) VALUES (
      ${order.tenant_id}, ${order.id}, ${null}, 'supplier_order', ${order.id},
      'supplier_pack_zip_encrypted', ${encrypted.envelopeHash}, 'application/vnd.nexid.supplier-pack+json',
      ${JSON.stringify({
        filename: encryptedFilename,
        plaintext_zip_sha256: encrypted.plaintextZipHash,
        ciphertext_sha256: encrypted.ciphertextHash,
        envelope_sha256: encrypted.envelopeHash,
        encryption: encrypted.encryption,
        password_policy: "shown_once_not_stored_send_separately",
        entry_count: archiveEntries.length,
      })}::jsonb
    )
  `;

  await logAuditEvent({
    actorId: null,
    tenantId: String(order.tenant_id),
    action: "supplier_pack_exported",
    resourceType: "supplier_order",
    resourceId: String(order.id),
    afterData: {
      order_id: order.id,
      exported_by: actor,
      encrypted_pack_hash: encrypted.envelopeHash,
      plaintext_zip_hash: encrypted.plaintextZipHash,
      bids: packs.map((pack) => ({
        bid: pack.bid,
        content_hash: pack.content_hash,
        json_hash: pack.json_hash,
        pdf_hash: pack.pdf_hash,
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
    encrypted_pack: {
      filename: encryptedFilename,
      mime_type: "application/vnd.nexid.supplier-pack+json",
      encoding: "base64",
      base64: encrypted.envelopeBuffer.toString("base64"),
      envelope_sha256: encrypted.envelopeHash,
      plaintext_zip_sha256: encrypted.plaintextZipHash,
      ciphertext_sha256: encrypted.ciphertextHash,
      encryption: encrypted.encryption,
      password: passwordRecommendation,
      password_warning: "Shown once. Not stored. Send it over a separate channel.",
    },
    warning: "Encrypted supplier ZIP generated. The response does not include raw K_META_BATCH or K_FILE_BATCH outside the encrypted package.",
    packs,
  });
}
