export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { checkAdmin, getAdminActor, getAdminPermissions, getAdminTenantScope, type AdminScope } from "../../../../../lib/auth";
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
import { evaluateSupplierPackagingExportGate } from "../../../../../lib/supplier-packaging-governance";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function safeDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown_error";
  const code = String((error as { code?: unknown }).code || "");
  return /^[A-Za-z0-9_-]{1,32}$/.test(code) ? code : "unknown_error";
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const adminTenantScope = getAdminTenantScope(req);
  const permissionGrants = getAdminPermissions(req);
  if (!canExportFactoryPack(adminTenantScope.scope, permissionGrants)) {
    return json({
      ok: false,
      reason: "supplier_pack_export_forbidden",
      message: "Supplier factory packs require superadmin or explicit supplier:export_pack permission.",
    }, 403);
  }
  await ensureSupplierOpsSchema();

  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) return json({ ok: false, reason: "supplier_order_not_found" }, 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedBid = String(body.bid || body.batch_id || "").trim();
  const packPassword = normalizePackPassword(body.password || body.pack_password);
  const passwordGate = validatePackPassword(packPassword);
  if (!passwordGate.ok) return json(passwordGate, 400);
  const actor = getAdminActor(req).email;

  let orderRows;
  try {
    orderRows = await sql/*sql*/`
      SELECT
        so.*,
        t.slug AS tenant_slug,
        public.nexid_effective_supplier_pack_purpose_v1(so.id) AS effective_pack_purpose,
        EXISTS (
          SELECT 1
          FROM supplier_packaging_governance_decisions decision
          WHERE decision.supplier_order_id = so.id
            AND decision.tenant_id = so.tenant_id
            AND decision.spec_revision = so.packaging_spec_revision
            AND decision.decision_status = 'approved'
            AND decision.spec_hash = so.packaging_spec_hash
            AND decision.spec_snapshot = so.packaging_spec_snapshot
            AND decision.evidence_refs = so.packaging_evidence_refs
            AND decision.validation_snapshot = so.packaging_validation_snapshot
            AND decision.decided_by = so.packaging_approved_by
            AND decision.decided_at = so.packaging_approved_at
        ) AS packaging_approval_history_receipt_consistent
      FROM supplier_orders so
      JOIN tenants t ON t.id = so.tenant_id
      WHERE so.id = ${orderId}::uuid
      LIMIT 1
    `;
  } catch (error) {
    const code = safeDatabaseErrorCode(error);
    console.error("[supplier_packaging_export_gate_unavailable]", code);
    return json({
      ok: false,
      reason: new Set(["42P01", "42703", "42883"]).has(code)
        ? "supplier_packaging_migration_required"
        : "supplier_packaging_governance_unavailable",
      ...(new Set(["42P01", "42703", "42883"]).has(code)
        ? { required_migration: "20260728143000_0063_supplier_packaging_governance.sql" }
        : {}),
    }, 503);
  }
  const order = orderRows[0];
  if (!order) return json({ ok: false, reason: "supplier_order_not_found" }, 404);
  if (adminTenantScope.forcedTenantSlug && String(order.tenant_slug || "").toLowerCase() !== adminTenantScope.forcedTenantSlug) {
    return json({
      ok: false,
      reason: "supplier_order_forbidden_for_tenant",
      message: "Supplier order belongs to a different tenant scope.",
    }, 403);
  }

  // Purpose is a custody-boundary decision, not descriptive metadata. Keep
  // every non-trial order outside the batch-key SELECT/decryption path. Legacy
  // classification is resolved by the append-only governance decision; it is
  // never inferred from order names, quantities, carrier profiles or QA state.
  const effectivePackPurpose = String(order.effective_pack_purpose || "").trim();
  if (!effectivePackPurpose || effectivePackPurpose === "legacy_unclassified") {
    return json({
      ok: false,
      reason: "supplier_pack_purpose_unclassified",
      message: "Classify this legacy supplier order through the audited purpose workflow before exporting factory key material.",
    }, 409);
  }
  if (effectivePackPurpose === "production") {
    return json({
      ok: false,
      reason: "supplier_production_qa_plan_required",
      message: "Production factory export remains blocked until a tenant-approved production QA plan and release receipt are implemented.",
    }, 409);
  }
  if (effectivePackPurpose !== "trial_integration") {
    return json({
      ok: false,
      reason: "supplier_pack_purpose_unclassified",
      message: "Unsupported supplier pack purpose. Reconcile the audited order classification before export.",
    }, 409);
  }
  const packPurpose = effectivePackPurpose;
  const commercialDisposition = "NON_SELLABLE" as const;
  const activationAllowed = false as const;

  // This gate deliberately precedes both the batch-key SELECT and every call
  // to decryptBatchKeyHex. An unapproved or inconsistent packaging record must
  // never cross the factory-key custody boundary.
  const packagingGate = evaluateSupplierPackagingExportGate({
    status: order.packaging_governance_status,
    specRevision: order.packaging_spec_revision,
    carrierProfileCode: order.carrier_profile_code,
    specSnapshot: order.packaging_spec_snapshot,
    specHash: order.packaging_spec_hash,
    evidenceRefs: order.packaging_evidence_refs,
    validationSnapshot: order.packaging_validation_snapshot,
    approvalHistoryReceiptConsistent: order.packaging_approval_history_receipt_consistent,
  });
  if (!packagingGate.ok) {
    return json({
      ok: false,
      reason: "supplier_packaging_approval_required",
      packaging_governance_status: packagingGate.status,
      gaps: packagingGate.gaps,
    }, 409);
  }
  const packagingApprovalMetadata = {
    schema: "nexid-supplier-packaging-approval-v1",
    spec_revision: packagingGate.specRevision,
    spec_hash: packagingGate.specHash,
    carrier_profile_code: String(order.carrier_profile_code || ""),
    physical_packaging_approved: true,
    pack_purpose: packPurpose,
    commercial_disposition: commercialDisposition,
    activation_allowed: activationAllowed,
    spec: packagingGate.specSnapshot,
  };

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
      packPurpose,
      quantity: Number(row.expected_quantity || 0),
      chipModel: String(order.chip_model || ""),
      carrierProfile: String(order.carrier_profile_code || ""),
      materialType: order.material_type || null,
      notes: order.notes || null,
      kMetaHex,
      kFileHex,
      urlTemplate,
    });

    const governedPackJson = {
      ...pack.json,
      PACK_PURPOSE: packPurpose,
      COMMERCIAL_DISPOSITION: commercialDisposition,
      ACTIVATION_ALLOWED: activationAllowed,
    };
    const governedPackText = [
      "NON_SELLABLE - TRIAL INTEGRATION ONLY - DO NOT SELL, SHIP, OR ACTIVATE",
      `COMMERCIAL_DISPOSITION=${commercialDisposition}`,
      `ACTIVATION_ALLOWED=${activationAllowed}`,
      pack.text.trimEnd(),
      "",
    ].join("\n");
    const governedPackContentHash = sha256Text(governedPackText);
    const jsonBody = JSON.stringify(governedPackJson, null, 2);
    const jsonHash = sha256Text(jsonBody);
    const pdfBody = buildSupplierPackPdfSummary({
      clientSlug: String(order.customer_slug || order.tenant_slug),
      batchId: String(row.bid),
      packPurpose,
      commercialDisposition,
      activationAllowed,
      quantity: Number(row.expected_quantity || 0),
      chipModel: String(order.chip_model || ""),
      carrierProfile: String(order.carrier_profile_code || ""),
      keyFingerprint: String(row.key_fingerprint || ""),
      contentHash: governedPackContentHash,
      jsonHash,
      urlTemplate,
    });
    const pdfHash = sha256Buffer(pdfBody);
    const textFilename = `${row.bid}_supplier_encoding_pack.txt`;
    const jsonFilename = `${row.bid}_supplier_encoding_pack.json`;
    const pdfFilename = `${row.bid}_supplier_encoding_summary.pdf`;
    zipEntries.push(
      { path: `${row.bid}/${textFilename}`, data: governedPackText },
      { path: `${row.bid}/${jsonFilename}`, data: jsonBody },
      { path: `${row.bid}/${pdfFilename}`, data: pdfBody },
    );
    for (const [artifactType, contentHash, mimeType] of [
      ["supplier_pack_txt", governedPackContentHash, "text/plain"],
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
        metadata_json: {
          bid: row.bid,
          pack_purpose: packPurpose,
          commercial_disposition: commercialDisposition,
          activation_allowed: activationAllowed,
          key_fingerprint: row.key_fingerprint,
          packaging_spec_revision: packagingGate.specRevision,
          packaging_spec_hash: packagingGate.specHash,
        },
      });
    }
    const eventPayload = {
      supplier_order_id: order.id,
      supplier_sub_batch_id: row.supplier_sub_batch_id,
      bid: row.bid,
      pack_purpose: packPurpose,
      commercial_disposition: commercialDisposition,
      activation_allowed: activationAllowed,
      content_hash: governedPackContentHash,
      json_hash: jsonHash,
      key_fingerprint: row.key_fingerprint,
      exported_by: actor,
      pdf_hash: pdfHash,
      packaging_spec_revision: packagingGate.specRevision,
      packaging_spec_hash: packagingGate.specHash,
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
      content_hash: governedPackContentHash,
      json_hash: jsonHash,
      pdf_hash: pdfHash,
      pack_purpose: packPurpose,
      commercial_disposition: commercialDisposition,
      activation_allowed: activationAllowed,
    });
  }

  const readme = [
    "NON_SELLABLE - TRIAL INTEGRATION ONLY - DO NOT SELL, SHIP, OR ACTIVATE",
    `PACK_PURPOSE=${packPurpose}`,
    `COMMERCIAL_DISPOSITION=${commercialDisposition}`,
    `ACTIVATION_ALLOWED=${activationAllowed}`,
    "",
    "nexID Supplier Encoding Pack",
    "",
    `Order: ${order.order_name || order.id}`,
    `Tenant: ${order.tenant_slug}`,
    `Customer: ${order.customer_slug || order.tenant_slug}`,
    `Sub-batches: ${packs.length}`,
    `Approved packaging revision: ${packagingGate.specRevision}`,
    `Approved packaging hash: ${packagingGate.specHash}`,
    "",
    "Contents:",
    "- One folder per sub-batch.",
    "- TXT and JSON contain profile-specific encoding instructions for that sub-batch.",
    "- K_META_BATCH and K_FILE_BATCH appear only for NTAG 424 DNA / TagTamper profiles.",
    "- PDF contains human-readable instructions and hashes.",
    "- CHECKSUMS.sha256 verifies every file before factory handoff.",
    "- PACKAGING_APPROVAL.json is the approved, non-secret production specification bound to this export.",
    "",
    "Security:",
    "- This encrypted container is the only browser payload.",
    "- KMS, DB URLs, admin keys, Polygon private keys, IOTA private keys and webhook secrets are never included.",
    "- Password is generated by the operator before export and is not returned by this API response.",
    "- Send the password to the factory over a separate channel.",
    "- Do not paste decrypted keys into chat, tickets, screenshots or logs.",
    "",
  ].join("\n");
  const archiveEntries: SupplierZipEntry[] = [
    { path: "README_FIRST.txt", data: readme },
    { path: "PACKAGING_APPROVAL.json", data: JSON.stringify(packagingApprovalMetadata, null, 2) },
    ...zipEntries,
  ];
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
    pack_purpose: packPurpose,
    commercial_disposition: commercialDisposition,
    activation_allowed: activationAllowed,
    packaging_spec_revision: packagingGate.specRevision,
    packaging_spec_hash: packagingGate.specHash,
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
      pack_purpose: packPurpose,
      commercial_disposition: commercialDisposition,
      activation_allowed: activationAllowed,
      packaging_spec_revision: packagingGate.specRevision,
      packaging_spec_hash: packagingGate.specHash,
    },
  });

  // The encrypted artifact, audit evidence and all one-time counters commit in
  // one PostgreSQL statement. Any archive/persistence failure leaves every
  // export counter at zero, so the operator can retry safely.
  const persistedRows = await sql/*sql*/`
    WITH approved_order AS MATERIALIZED (
      SELECT so.id
      FROM supplier_orders so
      JOIN supplier_packaging_governance_decisions decision
        ON decision.supplier_order_id = so.id
       AND decision.tenant_id = so.tenant_id
       AND decision.spec_revision = so.packaging_spec_revision
       AND decision.decision_status = 'approved'
       AND decision.spec_hash = so.packaging_spec_hash
       AND decision.spec_snapshot = so.packaging_spec_snapshot
       AND decision.evidence_refs = so.packaging_evidence_refs
       AND decision.validation_snapshot = so.packaging_validation_snapshot
       AND decision.decided_by = so.packaging_approved_by
       AND decision.decided_at = so.packaging_approved_at
      WHERE so.id = ${order.id}
        AND so.tenant_id = ${order.tenant_id}
        AND public.nexid_effective_supplier_pack_purpose_v1(so.id) = ${packPurpose}
        AND so.packaging_governance_status = 'approved'
        AND so.packaging_spec_revision = ${packagingGate.specRevision}
        AND so.packaging_spec_hash = ${packagingGate.specHash}
      FOR SHARE OF so
    ),
    target AS MATERIALIZED (
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
      SELECT
        COUNT(*)::int = ${rows.length} AS keys_ready,
        EXISTS (SELECT 1 FROM approved_order) AS packaging_ready
      FROM locked
    ),
    reserved_sub_batches AS (
      UPDATE supplier_sub_batches ssb
      SET key_export_count = key_export_count + 1,
          key_exported_at = now(),
          updated_at = now()
      FROM locked, readiness
      WHERE readiness.keys_ready AND readiness.packaging_ready
        AND ssb.id = locked.supplier_sub_batch_id
      RETURNING ssb.id
    ),
    reserved_keys AS (
      UPDATE batch_keys bk
      SET export_count = export_count + 1,
          exported_at = now()
      FROM locked, readiness
      WHERE readiness.keys_ready AND readiness.packaging_ready
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
      WHERE readiness.keys_ready AND readiness.packaging_ready
        AND material.supplier_sub_batch_id = locked.supplier_sub_batch_id
        AND material.status = 'active'
        AND material.export_count = 0
      RETURNING material.id
    ),
    reservation_gate AS MATERIALIZED (
      SELECT
        readiness.keys_ready
          AND readiness.packaging_ready
          AND (SELECT COUNT(*) FROM reserved_sub_batches) = ${rows.length}
          AND (SELECT COUNT(*) FROM reserved_keys) = ${rows.length} AS ok,
        readiness.packaging_ready,
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
           gate.packaging_ready,
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
      reason: persisted.packaging_ready === false
        ? "supplier_packaging_approval_changed"
        : "supplier_pack_export_conflict",
      message: persisted.packaging_ready === false
        ? "Packaging approval changed during export. No artifact or one-time counter was committed; review the current packaging revision before retrying."
        : "The encrypted artifact was not committed, so no one-time export counter was consumed. Retry after checking for a concurrent export.",
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
      pack_purpose: packPurpose,
      commercial_disposition: commercialDisposition,
      activation_allowed: activationAllowed,
      packaging_spec_revision: packagingGate.specRevision,
      packaging_spec_hash: packagingGate.specHash,
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
      pack_purpose: packPurpose,
      commercial_disposition: commercialDisposition,
      activation_allowed: activationAllowed,
      packaging_spec_revision: packagingGate.specRevision,
      packaging_spec_hash: packagingGate.specHash,
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
      pack_purpose: packPurpose,
      commercial_disposition: commercialDisposition,
      activation_allowed: activationAllowed,
      password_warning: "Password is not returned by the API. Use the operator-generated password and send it over a separate channel.",
      password_delivery: {
        mode: "operator_generated",
        returned: false,
        separate_channel_required: true,
      },
    },
    warning: "NON_SELLABLE trial-integration ZIP generated. Activation is forbidden. The response does not include the pack password. Raw K_META_BATCH/K_FILE_BATCH are present only inside encrypted 424 DNA supplier folders.",
    packs,
  });
}
