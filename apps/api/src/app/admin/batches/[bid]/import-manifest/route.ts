export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../../../lib/db";
import { checkAdminWithPermission, getAdminActor, getAdminTenantScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { parseTagManifest } from "../../../../../lib/tag-manifest";
import { requireTenantSunProfile } from "../../../../../lib/tenant-onboarding";
import { ensureCarrierProfileSchema } from "../../../../../lib/commercial-runtime-schema";
import { getCarrierProfile, normalizeCarrierProfileCode } from "../../../../../lib/carrier-profiles";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import { canImportSupplierManifest, requiresSecureSunEncoding, validateSupplierManifestQuantity } from "../../../../../lib/supplier-ops";
import { RequestBodyTooLargeError, readRequestTextBounded } from "../../../../../lib/bounded-request-body";
import {
  hasSupplierManifestImportV2,
  importTagManifestV2,
  SUPPLIER_MANIFEST_IMPORT_V2_MIGRATION,
  supplierManifestImportError,
  type AtomicManifestRow,
} from "../../../../../lib/supplier-manifest-import";
import { buildSupplierOpsErrorReport } from "../../../../../lib/supplier-ops-error-report";

const MAX_MANIFEST_BODY_BYTES = 16 * 1024 * 1024;

type ManifestPayload = {
  csv?: string;
  activateImported?: boolean;
  dryRun?: boolean;
  overrideReason?: string;
};

const SENSITIVE_MANIFEST_COLUMN = /^(?:k_?meta(?:_?hex)?|k_?file(?:_?hex)?|key_?(?:meta|file)|meta_?key(?:_?(?:hex|ct))?|file_?key(?:_?(?:hex|ct))?|master_?key|root_?key|private_?key|secret(?:_?key)?|client_?secret|access_?token|refresh_?token|bearer_?token|auth_?token|encryption_?key|decryption_?key|api_?key|password|passphrase|mnemonic(?:_?phrase)?|seed_?phrase|(?:wallet|signing|recovery|secret)_?seed)$/i;

function sensitiveManifestColumns(rows: Array<{ raw: Record<string, string> }>) {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row.raw)
    .map((key) => key.trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter((key) => SENSITIVE_MANIFEST_COLUMN.test(key))))).sort();
}

function sanitizeManifestRejections(
  rows: Array<{ row: number; reason: string; value?: string }>,
) {
  return rows.map((entry) => entry.reason === "invalid_sun_payload"
    ? { row: entry.row, reason: entry.reason, value: "[REDACTED_SUN_PAYLOAD]" }
    : entry);
}

async function readPayload(req: Request): Promise<ManifestPayload & { csv: string }> {
  const contentType = req.headers.get("content-type") || "";
  const raw = await readRequestTextBounded(req, MAX_MANIFEST_BODY_BYTES);
  if (contentType.includes("application/json")) {
    const body = (raw.trim() ? JSON.parse(raw) : {}) as ManifestPayload;
    return {
      csv: String(body.csv || ""),
      activateImported: Boolean(body.activateImported),
      dryRun: Boolean(body.dryRun),
      overrideReason: String(body.overrideReason || (body as Record<string, unknown>).override_reason || "").trim(),
    };
  }

  return { csv: raw, activateImported: false, dryRun: false };
}

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = await checkAdminWithPermission(req, "manifest.import");
  if (auth) return auth;
  let atomicManifestAvailable = false;
  try {
    atomicManifestAvailable = await hasSupplierManifestImportV2();
  } catch {
    atomicManifestAvailable = false;
  }
  if (!atomicManifestAvailable) {
    return json({
      ok: false,
      reason: "supplier_manifest_import_v2_migration_required",
      required_migration: SUPPLIER_MANIFEST_IMPORT_V2_MIGRATION,
    }, 503);
  }
  await ensureCarrierProfileSchema();
  await ensureSupplierOpsSchema();

  const { bid } = await params;
  const adminScope = getAdminTenantScope(req);
  const { forcedTenantSlug } = adminScope;
  const batchRows = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT
        b.id, b.tenant_id, b.carrier_profile_code, b.sdm_config, b.status, b.created_at,
        b.supplier_order_id, b.supplier_sub_batch_id, b.expected_quantity, b.manifest_status, b.qa_status
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql/*sql*/`
      SELECT
        id, tenant_id, carrier_profile_code, sdm_config, status, created_at,
        supplier_order_id, supplier_sub_batch_id, expected_quantity, manifest_status, qa_status
      FROM batches
      WHERE bid = ${bid}
      ORDER BY created_at ASC, id ASC
    `;
  if (batchRows.length > 1) {
    return json({
      ok: false,
      reason: "DUPLICATE_BID",
      message: "BID must be globally unique before importing a manifest.",
      batches: batchRows.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

  // Validate batch status
  const allowedStatuses = ['production_registered', 'active_in_market', 'active'];
  if (!allowedStatuses.includes(batch.status)) {
    return json({
      ok: false,
      reason: 'invalid_batch_state',
      message: `Cannot import manifest while batch status is '${batch.status}'. Batch status must be 'production_registered' or 'active_in_market'.`
    }, 400);
  }

  const batchCarrierCode = normalizeCarrierProfileCode(batch.carrier_profile_code || batch.sdm_config?.carrier_profile_code);
  const batchCarrier = getCarrierProfile(batchCarrierCode);
  if (!batchCarrierCode || !batchCarrier) {
    return json({
      ok: false,
      reason: "batch_carrier_profile_required",
      message: "The batch must have a carrier_profile_code before importing manifests. Edit/register the batch with qr_basic, gs1_digital_link, ntag213, ntag215, ntag216, ntag424_dna or ntag424_dna_tt.",
    }, 409);
  }
  if (requiresSecureSunEncoding(batchCarrierCode)) {
    const readiness = await requireTenantSunProfile(String(batch.tenant_id)).catch((error) => ({ ok: false, missing: (error as Error & { missing?: string[] }).missing || ["tenant_sun_profiles"] }));
    if (!readiness.ok) {
      return json({
        ok: false,
        reason: "tenant_sun_profile_incomplete",
        message: "Complete tenant SUN profile before importing secure SUN manifests.",
        missing: readiness.missing,
      }, 409);
    }
  }

  let payload: ManifestPayload & { csv: string };
  try {
    payload = await readPayload(req);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json({ ok: false, reason: "manifest_body_too_large", max_bytes: MAX_MANIFEST_BODY_BYTES }, 413);
    }
    return json({ ok: false, reason: "manifest_body_invalid" }, 400);
  }
  if (!payload.csv.trim()) return json({ ok: false, reason: "empty csv body" }, 400);

  const manifest = parseTagManifest(payload.csv, bid);
  if (!manifest.rows.length && !manifest.rejectedRows.length) return json({ ok: false, reason: "manifest has no rows" }, 400);
  const sensitiveColumns = sensitiveManifestColumns(manifest.rows);
  if (sensitiveColumns.length > 0) {
    const message = "UID manifests must not contain NFC keys, credentials, seed phrases, or other secret material.";
    return json({
      ok: false,
      reason: "supplier_manifest_sensitive_columns_forbidden",
      message,
      rejected_columns: sensitiveColumns,
      error_report: buildSupplierOpsErrorReport({
        stage: "manifest",
        bid,
        reason: "supplier_manifest_sensitive_columns_forbidden",
        message,
        issues: sensitiveColumns.map((field) => ({
          code: "sensitive_column_forbidden",
          field,
          detail: "Remove the column and rotate any secret that may have been disclosed in the supplier file.",
        })),
      }),
    }, 400);
  }

  const supplierSubBatchRows = await sql/*sql*/`
    SELECT
      id, supplier_order_id, tenant_id, batch_id, bid, expected_quantity,
      manifest_status, manifest_count, manifest_hash, qa_status
    FROM supplier_sub_batches
    WHERE batch_id = ${batch.id} OR bid = ${bid}
    LIMIT 1
  `;
  const supplierSubBatch = supplierSubBatchRows[0] || null;
  const supplierImportGate = supplierSubBatch
    ? canImportSupplierManifest({ manifestStatus: supplierSubBatch.manifest_status })
    : { ok: true as const };
  if (!supplierImportGate.ok && !payload.dryRun) {
    return json({
      ok: false,
      reason: supplierImportGate.reason,
      message: "Supplier manifest is immutable after import. Create a corrective sub-batch or new supplier order instead of overwriting UID evidence.",
      bid,
      manifest_status: supplierSubBatch.manifest_status,
      manifest_count: Number(supplierSubBatch.manifest_count || 0),
      manifest_hash: supplierSubBatch.manifest_hash || null,
    }, 409);
  }
  const supplierQuantityGate = supplierSubBatch
    ? validateSupplierManifestQuantity(manifest, Number(supplierSubBatch.expected_quantity || 0))
    : { ok: true as const };
  const quantityOverrideReason = String(payload.overrideReason || "").trim();
  const quantityOverrideBy = getAdminActor(req).email;
  let quantityOverride = false;
  if (!supplierQuantityGate.ok) {
    if (adminScope.scope !== "super_admin") {
      return json({
        ok: false,
        reason: "supplier_manifest_quantity_override_forbidden",
        message: "Only a superadmin can override a supplier manifest quantity mismatch.",
        expected: supplierQuantityGate.expected,
        received: supplierQuantityGate.received,
        bid,
        required_scope: "super_admin",
      }, 403);
    }
    if (quantityOverrideReason.length < 16 || !quantityOverrideBy) {
      const message = "Supplier manifest quantity must match the planned sub-batch quantity unless a superadmin provides an explicit audited reason.";
      return json({
        ok: false,
        reason: supplierQuantityGate.reason,
        message,
        expected: supplierQuantityGate.expected,
        received: supplierQuantityGate.received,
        bid,
        override_required: {
          fields: ["overrideReason"],
          min_reason_length: 16,
          required_scope: "super_admin",
        },
        error_report: buildSupplierOpsErrorReport({
          stage: "manifest",
          bid,
          reason: supplierQuantityGate.reason,
          message,
          issues: [{
            code: supplierQuantityGate.reason,
            field: "row_count",
            value: `expected=${supplierQuantityGate.expected};received=${supplierQuantityGate.received}`,
            detail: "Correct the supplier file, create a corrective sub-batch, or use the explicitly audited superadmin quantity exception.",
          }],
        }),
      }, 409);
    }
    quantityOverride = true;
  }

  const manifestUids = Array.from(new Set(manifest.rows.map((row) => row.uidHex.toUpperCase()).filter(Boolean)));
  const duplicateGlobalRows = manifestUids.length
    ? await sql/*sql*/`
        SELECT DISTINCT tg.uid_hex, b.bid, t.slug AS tenant_slug
        FROM tags tg
        JOIN batches b ON b.id = tg.batch_id
        JOIN tenants t ON t.id = b.tenant_id
        WHERE UPPER(tg.uid_hex) = ANY(${manifestUids})
          AND tg.batch_id <> ${batch.id}
        ORDER BY tg.uid_hex ASC
        LIMIT 50
      `
    : [];
  if (duplicateGlobalRows.length > 0) {
    const duplicateUids = duplicateGlobalRows.map((row) => row.uid_hex);
    const safeRejectedRows = duplicateUids.map((uidHex) => ({
      reason: "global_uid_duplicate",
      uid_hex: uidHex,
    }));
    if (!payload.dryRun) {
      await sql/*sql*/`
        INSERT INTO tenant_manifests (
          tenant_id, batch_id, bid, manifest_type, row_count, duplicate_count, rejected_count,
          content_hash, import_status, errors_json, carrier_profile_code,
          supplier_order_id, supplier_sub_batch_id, expected_quantity
        ) VALUES (
          ${batch.tenant_id}, ${batch.id}, ${bid}, ${manifest.manifestType}, ${manifest.rows.length},
          ${duplicateGlobalRows.length}, ${duplicateGlobalRows.length}, ${manifest.contentHash},
          'rejected', ${JSON.stringify(safeRejectedRows)}::jsonb, ${batchCarrierCode},
          ${supplierSubBatch?.supplier_order_id || null}, ${supplierSubBatch?.id || null},
          ${supplierSubBatch?.expected_quantity || null}
        )
      `;
    }
    const message = "Manifest contains UIDs already registered in another batch. Supplier UIDs must be globally unique.";
    return json({
      ok: false,
      reason: "global_uid_duplicate",
      message,
      duplicateUids,
      ...(adminScope.scope === "super_admin" ? { duplicates: duplicateGlobalRows } : {}),
      bid,
      error_report: buildSupplierOpsErrorReport({
        stage: "manifest",
        bid,
        reason: "global_uid_duplicate",
        message,
        issues: duplicateUids.map((uidHex) => ({
          code: "global_uid_duplicate",
          field: "uid_hex",
          value: uidHex,
          detail: "UID already belongs to another registered batch; it cannot be silently reassigned.",
        })),
      }),
    }, 409);
  }
  if (supplierSubBatch && payload.activateImported) {
    return json({
      ok: false,
      reason: "supplier_activation_requires_qa",
      message: "Industrial supplier batches must be imported first, QA-approved, then activated from the activation endpoint.",
      bid,
    }, 409);
  }

  if (manifest.rejectedRows.length > 0) {
    const safeRejectedRows = sanitizeManifestRejections(manifest.rejectedRows);
    if (!payload.dryRun) {
      await sql/*sql*/`
        INSERT INTO tenant_manifests (
          tenant_id, batch_id, bid, manifest_type, row_count, duplicate_count, rejected_count,
          content_hash, import_status, errors_json, carrier_profile_code,
          supplier_order_id, supplier_sub_batch_id, expected_quantity
        ) VALUES (
          ${batch.tenant_id}, ${batch.id}, ${bid}, ${manifest.manifestType}, ${manifest.rows.length},
          ${manifest.duplicateUids.length}, ${manifest.rejectedRows.length}, ${manifest.contentHash},
          'rejected', ${JSON.stringify(safeRejectedRows)}::jsonb, ${batchCarrierCode},
          ${supplierSubBatch?.supplier_order_id || null}, ${supplierSubBatch?.id || null},
          ${supplierSubBatch?.expected_quantity || null}
        )
      `;
    }
    return json({
      ok: false,
      reason: "manifest_validation_failed",
      rejectedRows: safeRejectedRows,
      duplicateUids: manifest.duplicateUids,
      error_report: buildSupplierOpsErrorReport({
        stage: "manifest",
        bid,
        reason: "manifest_validation_failed",
        message: "The supplier manifest contains invalid rows and was not imported.",
        issues: [
          ...safeRejectedRows.map((entry) => ({
            row: entry.row,
            code: entry.reason,
            value: entry.value,
          })),
          ...manifest.duplicateUids.map((uidHex) => ({
            code: "duplicate_uid_in_file",
            field: "uid_hex",
            value: uidHex,
          })),
        ],
      }),
    }, 400);
  }

  // Dry run simulation
  if (payload.dryRun) {
    const existingTags = manifestUids.length > 0
      ? await sql/*sql*/`
        SELECT uid_hex
        FROM tags
        WHERE batch_id = ${batch.id} AND uid_hex = ANY(${manifestUids})
      `
      : [];
    const existingSet = new Set(existingTags.map((t) => String(t.uid_hex).toUpperCase()));

    let simulatedInserted = 0;
    let simulatedReactivated = 0;

    for (const row of manifest.rows) {
      const isExisting = existingSet.has(row.uidHex.toUpperCase());
      if (!isExisting) {
        simulatedInserted += 1;
      } else if (payload.activateImported) {
        simulatedReactivated += 1;
      }
    }

    return json({
      ok: true,
      dryRun: true,
      batch: bid,
      manifestType: manifest.manifestType,
      importedRows: manifest.rows.length,
      inserted: simulatedInserted,
      reactivated: simulatedReactivated,
      registeredSunPayloads: manifest.rows.filter(r => r.sunPayloadHashes).length,
      ignored: 0,
      duplicateUids: manifest.duplicateUids,
      activated: payload.activateImported,
      carrier: batchCarrier,
      supplier_gate: supplierSubBatch ? {
        expected_quantity: Number(supplierSubBatch.expected_quantity || 0),
        manifest_status: supplierImportGate.ok ? "would_import" : "already_imported",
        manifest_count: Number(supplierSubBatch.manifest_count || 0),
        manifest_hash: supplierSubBatch.manifest_hash || null,
        qa_status: supplierSubBatch.qa_status || "pending",
        activation_requires_qa: true,
        quantity_override: quantityOverride ? {
          reason: quantityOverrideReason,
          override_by: quantityOverrideBy,
          expected: "expected" in supplierQuantityGate ? supplierQuantityGate.expected : null,
          received: "received" in supplierQuantityGate ? supplierQuantityGate.received : null,
        } : null,
      } : null,
    });
  }

  const invalidCarrierRow = manifest.rows.find((row) => !getCarrierProfile(row.carrierProfileCode || batchCarrierCode));
  if (invalidCarrierRow) {
    return json({ ok: false, reason: "invalid_carrier_profile", value: invalidCarrierRow.carrierProfileCode }, 400);
  }
  const atomicRows: AtomicManifestRow[] = manifest.rows.map((row) => {
    const rowCarrierCode = row.carrierProfileCode || batchCarrierCode;
    const rowCarrier = getCarrierProfile(rowCarrierCode)!;
    const hasUnitManifest = Boolean(
      row.lot
      || row.serial
      || row.expiresAt
      || row.imageUrl
      || row.labelImageUrl
      || row.modelUrl
      || row.galleryUrls.length
      || Object.keys(row.unitMetadata).length
      || row.iotData
      || rowCarrierCode !== batchCarrierCode,
    );
    const hasProductOverride = Boolean(row.productName || row.sku);
    const media = {
      imageUrl: row.imageUrl,
      labelImageUrl: row.labelImageUrl,
      modelUrl: row.modelUrl,
      galleryUrls: row.galleryUrls,
    };
    return {
      uidHex: row.uidHex,
      carrierProfileCode: rowCarrierCode,
      profile: hasUnitManifest || hasProductOverride ? {
        sku: hasProductOverride ? row.sku : null,
        product_name: hasProductOverride ? row.productName : null,
        notes: row.lot || row.serial || row.expiresAt || Object.keys(row.unitMetadata).length || row.iotData
          ? JSON.stringify({ lot: row.lot, serial: row.serial, expires_at: row.expiresAt, ...row.unitMetadata, iot: row.iotData })
          : null,
        image_url: row.imageUrl,
        locale_data: {
          media,
          manifest: {
            lot: row.lot,
            serial: row.serial,
            external_unit_id: row.serial,
            expires_at: row.expiresAt,
            unit_metadata: row.unitMetadata,
            carrier_profile_code: rowCarrierCode,
            carrier_label: rowCarrier.label,
          },
          iot: row.iotData,
        },
      } : null,
      sunPayload: row.sunPayloadHashes ? {
        raw_url_hash: row.sunPayloadHashes.rawUrlHash,
        picc_data_hash: row.sunPayloadHashes.piccDataHash,
        enc_hash: row.sunPayloadHashes.encHash,
        cmac_hash: row.sunPayloadHashes.cmacHash,
      } : null,
    };
  });

  const actor = getAdminActor(req);
  let atomicImport;
  try {
    atomicImport = await importTagManifestV2({
      tenantId: String(batch.tenant_id),
      batchId: String(batch.id),
      bid,
      carrierProfileCode: batchCarrierCode,
      manifestType: manifest.manifestType,
      contentHash: manifest.contentHash,
      activateImported: Boolean(payload.activateImported),
      supplierOrderId: supplierSubBatch ? String(supplierSubBatch.supplier_order_id) : null,
      supplierSubBatchId: supplierSubBatch ? String(supplierSubBatch.id) : null,
      expectedQuantity: supplierSubBatch ? Number(supplierSubBatch.expected_quantity || 0) : null,
      quantityOverride: quantityOverride ? { reason: quantityOverrideReason } : null,
      actorId: actor.id,
      authSessionId: actor.sessionId,
      requestId: req.headers.get("x-request-id"),
      userAgent: req.headers.get("user-agent"),
      rows: atomicRows,
    });
  } catch (error) {
    const mapped = supplierManifestImportError(error);
    return json({
      ok: false,
      reason: mapped.reason,
      ...(mapped.requiredMigration ? { required_migration: mapped.requiredMigration } : {}),
    }, mapped.status);
  }

  const inserted = atomicImport.inserted;
  const reactivated = atomicImport.reactivated;
  const registeredSunPayloads = atomicImport.registeredSunPayloads;

  return json({
    ok: true,
    batch: bid,
    manifestType: manifest.manifestType,
    importedRows: manifest.rows.length,
    inserted,
    reactivated,
    registeredSunPayloads,
    ignored: 0,
    duplicateUids: [],
    activated: payload.activateImported,
    carrier: batchCarrier,
    supplier_gate: supplierSubBatch ? {
      expected_quantity: Number(supplierSubBatch.expected_quantity || 0),
      manifest_status: "imported",
      qa_status: supplierSubBatch.qa_status || "pending",
      activation_requires_qa: true,
      quantity_override: quantityOverride ? {
        reason: quantityOverrideReason,
        override_by: quantityOverrideBy,
        expected: "expected" in supplierQuantityGate ? supplierQuantityGate.expected : null,
        received: "received" in supplierQuantityGate ? supplierQuantityGate.received : null,
      } : null,
    } : null,
  });
}
