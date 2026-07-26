export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { checkAdmin, getAdminTenantScope, type AdminScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { logAuditEvent } from "../../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import { decryptBatchKeyHex } from "../../../../../lib/batch-keys";
import {
  buildSupplierEncodingPack,
  buildSupplierPackPdfSummary,
  buildZipArchive,
  canExportSupplierPack,
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
    || req.headers.get("x-nexid-actor-id")
    || req.headers.get("x-dashboard-user")
    || req.headers.get("x-forwarded-user")
    || "unknown_admin"
  );
}

function parsePermissionHeader(value: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasScopedPermission(grants: string[], permission: string) {
  const current = permission.trim();
  for (const rawGrant of grants) {
    const grant = String(rawGrant || "").trim();
    if (!grant || grant === "*") continue;
    if (grant === current) return true;
    if (grant.endsWith(":*")) {
      const prefix = grant.slice(0, -2);
      if (current === prefix || current.startsWith(`${prefix}:`)) return true;
    }
  }
  return false;
}

function canExportFactoryPack(scope: AdminScope | null, permissions: string[]) {
  return scope === "super_admin"
    || scope === "security_operator"
    || hasScopedPermission(permissions, "supplier:export_pack");
}

function normalizePackPassword(value: unknown) {
  return String(value || "").trim();
}

function validatePackPassword(password: string) {
  if (password.length < 24) {
    return {
      ok: false as const,
      reason: "supplier_pack_password_required",
      message: "Generate a strong supplier-pack password outside the API response and send it to the factory over a separate channel.",
      min_length: 24,
    };
  }
  if (/[<>]/.test(password)) {
    return {
      ok: false as const,
      reason: "supplier_pack_password_invalid",
      message: "Supplier-pack password contains unsupported characters.",
    };
  }
  return { ok: true as const };
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = checkAdmin(req, ["super_admin", "security_operator", "tenant_admin"]);
  if (auth) return auth;
  const adminTenantScope = getAdminTenantScope(req);
  const permissionGrants = parsePermissionHeader(req.headers.get("x-nexid-permissions"));
  if (!canExportFactoryPack(adminTenantScope.scope, permissionGrants)) {
    return json({
      ok: false,
      reason: "supplier_pack_export_forbidden",
      message: "Supplier factory packs require superadmin, security-operator scope, or explicit supplier:export_pack permission.",
    }, 403);
  }
  await ensureSupplierOpsSchema();

  const { orderId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedBid = String(body.bid || body.batch_id || "").trim();
  const packPassword = normalizePackPassword(body.password || body.pack_password);
  const passwordGate = validatePackPassword(packPassword);
  if (!passwordGate.ok) return json(passwordGate, 400);
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
  if (adminTenantScope.forcedTenantSlug && String(order.tenant_slug || "").toLowerCase() !== adminTenantScope.forcedTenantSlug) {
    return json({
      ok: false,
      reason: "supplier_order_forbidden_for_tenant",
      message: "Supplier order belongs to a different tenant scope.",
    }, 403);
  }

  const rows = requestedBid
    ? await sql/*sql*/`
        SELECT
          ssb.id AS supplier_sub_batch_id,
          ssb.bid,
          ssb.expected_quantity,
          ssb.key_export_count,
          ssb.metadata_json,
          b.id AS batch_id,
          b.sdm_config,
          bk.id AS batch_key_id,
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
          ssb.key_export_count,
          ssb.metadata_json,
          b.id AS batch_id,
          b.sdm_config,
          bk.id AS batch_key_id,
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

  const alreadyExported = rows
    .map((row) => canExportSupplierPack({
      bid: String(row.bid || ""),
      exportCount: Number(row.export_count || 0),
      keyExportCount: Number(row.key_export_count || 0),
    }))
    .filter((gate) => !gate.ok);
  if (alreadyExported.length > 0) {
    return json({
      ok: false,
      reason: "supplier_pack_already_exported",
      message: "Supplier encoding packs are one-time artifacts. Rotate sub-batch keys or create a new supplier order instead of re-exporting plaintext factory material.",
      blocked: alreadyExported,
    }, 409);
  }

  const subBatchIds = rows.map((row) => String(row.supplier_sub_batch_id));
  const packs = [];
  const zipEntries: SupplierZipEntry[] = [];
  const artifactRecords: Array<Record<string, unknown>> = [];
  const evidenceRecords: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const kMetaHex = decryptBatchKeyHex(String(row.meta_key_ct), { tenantId: String(order.tenant_id), bid: String(row.bid), role: "K_META_BATCH" });
    const kFileHex = decryptBatchKeyHex(String(row.file_key_ct), { tenantId: String(order.tenant_id), bid: String(row.bid), role: "K_FILE_BATCH" });
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
    for (const [artifactType, contentHash, mimeType] of [
      ["supplier_pack_txt", pack.contentHash, "text/plain"],
      ["supplier_pack_json", jsonHash, "application/json"],
      ["supplier_pack_pdf_summary", pdfHash, "application/pdf"],
    ] as const) {
      artifactRecords.push({
        supplier_sub_batch_id: row.supplier_sub_batch_id,
        resource_type: "supplier_sub_batch",
        resource_id: row.supplier_sub_batch_id,
        artifact_type: artifactType,
        content_hash: contentHash,
        mime_type: mimeType,
        metadata_json: { bid: row.bid, key_fingerprint: row.key_fingerprint },
      });
    }
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
    evidenceRecords.push({
      resource_type: "supplier_sub_batch",
      resource_id: row.supplier_sub_batch_id,
      event_type: "supplier_pack_exported",
      payload_json: eventPayload,
      payload_hash: eventHash,
    });

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
    "- TXT and JSON contain profile-specific encoding instructions for that sub-batch.",
    "- K_META_BATCH and K_FILE_BATCH appear only for NTAG 424 DNA / TagTamper profiles.",
    "- PDF contains human-readable instructions and hashes.",
    "- CHECKSUMS.sha256 verifies every file before factory handoff.",
    "",
    "Security:",
    "- This encrypted container is the only browser payload.",
    "- KMS, DB URLs, admin keys, Polygon private keys, IOTA private keys and webhook secrets are never included.",
    "- Password is generated by the operator before export and is not returned by this API response.",
    "- Send the password to the factory over a separate channel.",
    "- Do not paste decrypted keys into chat, tickets, screenshots or logs.",
    "",
  ].join("\n");
  const archiveEntries: SupplierZipEntry[] = [{ path: "README_FIRST.txt", data: readme }, ...zipEntries];
  const checksums = archiveEntries
    .map((entry) => `${sha256Buffer(entry.data).replace(/^sha256:/, "")}  ${entry.path}`)
    .join("\n") + "\n";
  archiveEntries.push({ path: "CHECKSUMS.sha256", data: checksums });

  const zipBuffer = buildZipArchive(archiveEntries);
  const encrypted = encryptSupplierZipArchive(zipBuffer, packPassword, {
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
  const encryptedEnvelopeBase64 = encrypted.envelopeBuffer.toString("base64");
  artifactRecords.push({
    supplier_sub_batch_id: null,
    resource_type: "supplier_order",
    resource_id: order.id,
    artifact_type: "supplier_pack_zip_encrypted",
    content_hash: encrypted.envelopeHash,
    mime_type: "application/vnd.nexid.supplier-pack+json",
    encrypted_payload_base64: encryptedEnvelopeBase64,
    delivery_status: "ready",
    metadata_json: {
      filename: encryptedFilename,
      requested_bid: requestedBid || null,
      selected_sub_batch_ids: subBatchIds,
      plaintext_zip_sha256: encrypted.plaintextZipHash,
      ciphertext_sha256: encrypted.ciphertextHash,
      envelope_sha256: encrypted.envelopeHash,
      encryption: encrypted.encryption,
      password_policy: "operator_generated_not_returned_send_separately",
      entry_count: archiveEntries.length,
    },
  });

  // The encrypted artifact, audit evidence and all one-time counters commit in
  // one PostgreSQL statement. Any archive/persistence failure leaves every
  // export counter at zero, so the operator can retry safely.
  const persistedRows = await sql/*sql*/`
    WITH target AS MATERIALIZED (
      SELECT unnest(${subBatchIds}::uuid[]) AS supplier_sub_batch_id
    ),
    locked AS MATERIALIZED (
      SELECT ssb.id AS supplier_sub_batch_id
      FROM target
      JOIN supplier_sub_batches ssb ON ssb.id = target.supplier_sub_batch_id
      JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id
      WHERE ssb.key_export_count = 0
        AND bk.export_count = 0
      FOR UPDATE OF ssb, bk
    ),
    readiness AS MATERIALIZED (
      SELECT COUNT(*)::int = ${rows.length} AS ok
      FROM locked
    ),
    reserved_sub_batches AS (
      UPDATE supplier_sub_batches ssb
      SET key_export_count = key_export_count + 1,
          key_exported_at = now(),
          updated_at = now()
      FROM locked, readiness
      WHERE readiness.ok
        AND ssb.id = locked.supplier_sub_batch_id
      RETURNING ssb.id
    ),
    reserved_keys AS (
      UPDATE batch_keys bk
      SET export_count = export_count + 1,
          exported_at = now()
      FROM locked, readiness
      WHERE readiness.ok
        AND bk.supplier_sub_batch_id = locked.supplier_sub_batch_id
      RETURNING bk.supplier_sub_batch_id
    ),
    reserved_material AS (
      UPDATE batch_key_material material
      SET export_count = export_count + 1,
          exported_at = now(),
          exported_by = ${actor},
          updated_at = now()
      FROM locked, readiness
      WHERE readiness.ok
        AND material.supplier_sub_batch_id = locked.supplier_sub_batch_id
        AND material.status = 'active'
        AND material.export_count = 0
      RETURNING material.id
    ),
    reservation_gate AS MATERIALIZED (
      SELECT
        readiness.ok
          AND (SELECT COUNT(*) FROM reserved_sub_batches) = ${rows.length}
          AND (SELECT COUNT(*) FROM reserved_keys) = ${rows.length} AS ok,
        (SELECT COUNT(*)::int FROM reserved_sub_batches) AS reserved_sub_batches,
        (SELECT COUNT(*)::int FROM reserved_keys) AS reserved_keys,
        (SELECT COUNT(*)::int FROM reserved_material) AS reserved_material
      FROM readiness
    ),
    artifact_input AS MATERIALIZED (
      SELECT *
      FROM jsonb_to_recordset(${JSON.stringify(artifactRecords)}::jsonb) AS artifact(
        supplier_sub_batch_id uuid,
        resource_type text,
        resource_id text,
        artifact_type text,
        content_hash text,
        mime_type text,
        encrypted_payload_base64 text,
        delivery_status text,
        metadata_json jsonb
      )
    ),
    inserted_artifacts AS (
      INSERT INTO vault_artifacts (
        tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
        artifact_type, content_hash, mime_type, encrypted_payload_base64,
        delivery_status, delivery_attempt_count, last_delivery_attempt_at, metadata_json
      )
      SELECT
        ${order.tenant_id}, ${order.id}, artifact.supplier_sub_batch_id,
        artifact.resource_type, artifact.resource_id, artifact.artifact_type,
        artifact.content_hash, artifact.mime_type, artifact.encrypted_payload_base64,
        COALESCE(artifact.delivery_status, 'metadata_only'),
        CASE WHEN artifact.encrypted_payload_base64 IS NULL THEN 0 ELSE 1 END,
        CASE WHEN artifact.encrypted_payload_base64 IS NULL THEN NULL ELSE now() END,
        COALESCE(artifact.metadata_json, '{}'::jsonb)
      FROM artifact_input artifact
      CROSS JOIN reservation_gate gate
      WHERE gate.ok
      RETURNING id
    ),
    evidence_input AS MATERIALIZED (
      SELECT *
      FROM jsonb_to_recordset(${JSON.stringify(evidenceRecords)}::jsonb) AS evidence(
        resource_type text,
        resource_id text,
        event_type text,
        payload_json jsonb,
        payload_hash text
      )
    ),
    inserted_evidence AS (
      INSERT INTO evidence_events (tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash)
      SELECT ${order.tenant_id}, evidence.resource_type, evidence.resource_id,
             evidence.event_type, evidence.payload_json, evidence.payload_hash
      FROM evidence_input evidence
      CROSS JOIN reservation_gate gate
      WHERE gate.ok
      ON CONFLICT (payload_hash) DO NOTHING
      RETURNING id
    )
    SELECT gate.ok AS ready,
           gate.reserved_sub_batches,
           gate.reserved_keys,
           gate.reserved_material,
           (SELECT COUNT(*)::int FROM inserted_artifacts) AS inserted_artifacts,
           (SELECT COUNT(*)::int FROM inserted_evidence) AS inserted_evidence
    FROM reservation_gate gate
  `;
  const persisted = persistedRows[0] || {};
  if (persisted.ready !== true || Number(persisted.inserted_artifacts || 0) !== artifactRecords.length) {
    return json({
      ok: false,
      reason: "supplier_pack_export_conflict",
      message: "The encrypted artifact was not committed, so no one-time export counter was consumed. Retry after checking for a concurrent export.",
      requested: rows.length,
      reserved_sub_batches: Number(persisted.reserved_sub_batches || 0),
      reserved_keys: Number(persisted.reserved_keys || 0),
      artifact_persisted: false,
    }, 409);
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
    key_custody: {
      mode: "pilot_application_envelope_encryption",
      algorithm: "AES-256-GCM",
      aad_scope: ["tenant", "bid", "key_role", "key_version", "kek_version"],
      managed_kms: false,
      hsm_backed: false,
      boundary: "The KEK is a versioned application secret in the deployment platform; it is not a managed KMS/HSM key handle.",
    },
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
      base64: encryptedEnvelopeBase64,
      envelope_sha256: encrypted.envelopeHash,
      plaintext_zip_sha256: encrypted.plaintextZipHash,
      ciphertext_sha256: encrypted.ciphertextHash,
      encryption: encrypted.encryption,
      password_warning: "Password is not returned by the API. Use the operator-generated password and send it over a separate channel.",
      password_delivery: {
        mode: "operator_generated",
        returned: false,
        separate_channel_required: true,
      },
    },
    warning: "Encrypted supplier ZIP generated. The response does not include the pack password. Raw K_META_BATCH/K_FILE_BATCH are present only inside encrypted 424 DNA supplier folders.",
    packs,
  });
}
