export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { checkAdminWithPermission, getAdminActor, getAdminPrincipal, getAdminTenantScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import { decryptBatchKeyHex } from "../../../../../lib/batch-keys";
import {
  buildSupplierEncodingPack,
  buildSupplierManifestTemplate,
  buildSupplierPackPdfSummary,
  buildZipArchive,
  canExportSupplierPack,
  encryptSupplierZipArchive,
  requiresSecureSunEncoding,
  sha256Buffer,
  type SupplierProductionQaPlanApproval,
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

function databaseInstant(value: unknown) {
  const parsed = new Date(String(value || ""));
  if (!Number.isFinite(parsed.getTime())) throw new Error("supplier_production_qa_approval_timestamp_invalid");
  return parsed.toISOString();
}

type ApprovedProductionQaPlan = SupplierProductionQaPlanApproval & {
  supplier_order_id: string;
  supplier_sub_batch_id: string;
  batch_id: string;
  bid: string;
  plan_schema: "supplier-production-qa-plan/v1";
  plan_binding: Record<string, unknown>;
  submitted_at: string;
  approval_reason: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdminWithPermission(req, "supplier_pack.export");
  if (auth) return auth;
  if (!getAdminPrincipal(req).mfaVerified) {
    return json({ ok: false, reason: "supplier_pack_export_mfa_required" }, 403);
  }
  await ensureSupplierOpsSchema();

  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) return json({ ok: false, reason: "supplier_order_not_found" }, 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedBid = String(body.bid || body.batch_id || "").trim();
  const packPassword = normalizePackPassword(body.password || body.pack_password);
  const passwordGate = validatePackPassword(packPassword);
  if (!passwordGate.ok) return json(passwordGate, 400);
  const actorPrincipal = getAdminActor(req);
  const actor = actorPrincipal.email;
  const forcedTenantSlug = getAdminTenantScope(req).forcedTenantSlug || null;

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
        AND (${forcedTenantSlug}::text IS NULL OR t.slug = ${forcedTenantSlug})
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

  // Purpose is a custody-boundary decision, not descriptive metadata. Legacy
  // classification is resolved by the append-only governance decision; it is
  // never inferred from order names, quantities, carrier profiles or QA state.
  // Production crosses the key boundary only after its per-BID plan approvals.
  const effectivePackPurpose = String(order.effective_pack_purpose || "").trim();
  if (!effectivePackPurpose || effectivePackPurpose === "legacy_unclassified") {
    return json({
      ok: false,
      reason: "supplier_pack_purpose_unclassified",
      message: "Classify this legacy supplier order through the audited purpose workflow before exporting factory key material.",
    }, 409);
  }
  if (!new Set(["trial_integration", "production"]).has(effectivePackPurpose)) {
    return json({
      ok: false,
      reason: "supplier_pack_purpose_unclassified",
      message: "Unsupported supplier pack purpose. Reconcile the audited order classification before export.",
    }, 409);
  }
  const packPurpose = effectivePackPurpose as "trial_integration" | "production";
  const isProduction = packPurpose === "production";
  const commercialDisposition = isProduction
    ? "PENDING_RECEIVING_QA" as const
    : "NON_SELLABLE" as const;
  const activationAllowed = false as const;
  const custodyWarning = isProduction
    ? "PENDING_RECEIVING_QA production encoding pack. Factory encoding does not activate, release, claim or tokenize products; tenant receiving QA and its independent acceptance decision remain mandatory."
    : "NON_SELLABLE trial-integration pack. Do not sell, ship, claim, tokenize or activate products encoded from this pack.";

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
  const secureSunProfile = requiresSecureSunEncoding(order.carrier_profile_code);

  // Scope is selected without joining batch_keys. For production, every BID
  // must cross the tenant-approved plan gate before ciphertext is selected or
  // decryptBatchKeyHex can run.
  const scopeRows = requestedBid
    ? await sql/*sql*/`
        SELECT
          ssb.id AS supplier_sub_batch_id,
          ssb.bid,
          ssb.expected_quantity,
          ssb.key_export_count,
          ssb.metadata_json,
          b.id AS batch_id,
          b.sdm_config
        FROM supplier_sub_batches ssb
        JOIN batches b
          ON b.id = ssb.batch_id
         AND b.tenant_id = ssb.tenant_id
         AND b.supplier_order_id = ssb.supplier_order_id
         AND b.supplier_sub_batch_id = ssb.id
         AND upper(b.bid) = upper(ssb.bid)
        WHERE ssb.supplier_order_id = ${order.id}
          AND ssb.tenant_id = ${order.tenant_id}
          AND ssb.bid = ${requestedBid}
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
          b.sdm_config
        FROM supplier_sub_batches ssb
        JOIN batches b
          ON b.id = ssb.batch_id
         AND b.tenant_id = ssb.tenant_id
         AND b.supplier_order_id = ssb.supplier_order_id
         AND b.supplier_sub_batch_id = ssb.id
         AND upper(b.bid) = upper(ssb.bid)
        WHERE ssb.supplier_order_id = ${order.id}
          AND ssb.tenant_id = ${order.tenant_id}
        ORDER BY ssb.sequence_index ASC
      `;
  if (!scopeRows.length) return json({ ok: false, reason: "supplier_sub_batch_not_found" }, 404);

  const subBatchIds = scopeRows.map((row) => String(row.supplier_sub_batch_id));
  const approvedProductionPlans = new Map<string, ApprovedProductionQaPlan>();
  if (isProduction) {
    let approvalRows: Array<Record<string, unknown>>;
    try {
      approvalRows = await sql/*sql*/`
        SELECT
          plan.id AS qa_plan_id,
          plan.supplier_order_id,
          plan.supplier_sub_batch_id,
          plan.batch_id,
          plan.bid,
          plan.schema_version AS qa_plan_schema,
          plan.revision AS qa_plan_revision,
          plan.lot_size AS qa_plan_lot_size,
          plan.inspection_level AS qa_plan_inspection_level,
          plan.target_aql::text AS qa_plan_target_aql,
          plan.sample_size AS qa_plan_sample_size,
          plan.accept_number AS qa_plan_accept_number,
          plan.reject_number AS qa_plan_reject_number,
          plan.policy_reference AS qa_plan_policy_reference,
          plan.policy_document_sha256 AS qa_plan_policy_document_sha256,
          plan.stratification_dimension AS qa_plan_stratification_dimension,
          plan.cryptographic_sample_size AS qa_plan_cryptographic_sample_size,
          plan.plan_binding AS qa_plan_binding,
          plan.plan_digest AS qa_plan_digest,
          plan.submitted_at AS qa_plan_submitted_at,
          decision.id AS qa_plan_decision_id,
          decision.schema_version AS qa_plan_decision_schema,
          decision.reason AS qa_plan_approval_reason,
          decision.approval_evidence_ref AS qa_plan_approval_evidence_ref,
          decision.approval_evidence_sha256 AS qa_plan_approval_evidence_sha256,
          decision.decided_at AS qa_plan_approved_at,
          lower(approver.email) AS qa_plan_approved_by
        FROM unnest(${subBatchIds}::uuid[]) AS requested_scope(supplier_sub_batch_id)
        JOIN supplier_sub_batches ssb
          ON ssb.id = requested_scope.supplier_sub_batch_id
         AND ssb.tenant_id = ${order.tenant_id}
         AND ssb.supplier_order_id = ${order.id}
        JOIN supplier_production_qa_plans plan
          ON plan.tenant_id = ssb.tenant_id
         AND plan.supplier_order_id = ssb.supplier_order_id
         AND plan.supplier_sub_batch_id = ssb.id
         AND plan.batch_id = ssb.batch_id
         AND upper(plan.bid) = upper(ssb.bid)
         AND plan.schema_version = 'supplier-production-qa-plan/v1'
         AND plan.lot_size = ssb.expected_quantity
        JOIN supplier_production_qa_plan_decisions decision
          ON decision.plan_id = plan.id
         AND decision.tenant_id = plan.tenant_id
         AND decision.supplier_order_id = plan.supplier_order_id
         AND decision.supplier_sub_batch_id = plan.supplier_sub_batch_id
         AND decision.batch_id = plan.batch_id
         AND upper(decision.bid) = upper(plan.bid)
         AND decision.schema_version = 'supplier-production-qa-plan-decision/v1'
         AND decision.plan_digest = plan.plan_digest
         AND decision.decision_status = 'approved'
         AND decision.approver_role IN ('tenant_owner', 'tenant_admin')
         AND decision.decided_at <= now()
        JOIN users approver ON approver.id = decision.decided_by
        WHERE NOT EXISTS (
          SELECT 1
          FROM supplier_production_qa_plans newer_plan
          WHERE newer_plan.tenant_id = plan.tenant_id
            AND newer_plan.supplier_sub_batch_id = plan.supplier_sub_batch_id
            AND newer_plan.revision > plan.revision
        )
        ORDER BY ssb.sequence_index ASC
      `;
    } catch (error) {
      const code = safeDatabaseErrorCode(error);
      console.error("[supplier_production_qa_export_gate_unavailable]", code);
      return json({
        ok: false,
        reason: new Set(["42P01", "42703", "42883"]).has(code)
          ? "supplier_production_qa_migration_required"
          : "supplier_production_qa_governance_unavailable",
        ...(new Set(["42P01", "42703", "42883"]).has(code)
          ? { required_migration: "20260801090000_0075_supplier_production_qa_acceptance.sql" }
          : {}),
      }, 503);
    }

    for (const row of approvalRows) {
      const approval: ApprovedProductionQaPlan = {
        supplier_order_id: String(row.supplier_order_id),
        supplier_sub_batch_id: String(row.supplier_sub_batch_id),
        batch_id: String(row.batch_id),
        bid: String(row.bid),
        plan_schema: "supplier-production-qa-plan/v1",
        plan_id: String(row.qa_plan_id),
        plan_revision: Number(row.qa_plan_revision),
        plan_digest: String(row.qa_plan_digest),
        decision_id: String(row.qa_plan_decision_id),
        decision_schema: "supplier-production-qa-plan-decision/v1",
        approved_by: String(row.qa_plan_approved_by),
        approved_at: databaseInstant(row.qa_plan_approved_at),
        approval_evidence_ref: String(row.qa_plan_approval_evidence_ref),
        approval_evidence_sha256: String(row.qa_plan_approval_evidence_sha256),
        lot_size: Number(row.qa_plan_lot_size),
        inspection_level: String(row.qa_plan_inspection_level),
        target_aql: String(row.qa_plan_target_aql),
        sample_size: Number(row.qa_plan_sample_size),
        accept_number: Number(row.qa_plan_accept_number),
        reject_number: Number(row.qa_plan_reject_number),
        policy_reference: String(row.qa_plan_policy_reference),
        policy_document_sha256: String(row.qa_plan_policy_document_sha256),
        stratification_dimension: String(row.qa_plan_stratification_dimension) as ApprovedProductionQaPlan["stratification_dimension"],
        cryptographic_sample_size: Number(row.qa_plan_cryptographic_sample_size),
        plan_binding: row.qa_plan_binding as Record<string, unknown>,
        submitted_at: databaseInstant(row.qa_plan_submitted_at),
        approval_reason: String(row.qa_plan_approval_reason),
      };
      approvedProductionPlans.set(approval.supplier_sub_batch_id, approval);
    }

    let blockedBids = scopeRows
      .filter((row) => !approvedProductionPlans.has(String(row.supplier_sub_batch_id)))
      .map((row) => String(row.bid));
    if (approvedProductionPlans.size !== scopeRows.length || blockedBids.length > 0) {
      if (blockedBids.length === 0) blockedBids = scopeRows.map((row) => String(row.bid));
      return json({
        ok: false,
        reason: "supplier_production_qa_plan_required",
        message: "Every production BID requires a current tenant-approved QA plan bound to the same order, sub-batch, batch, BID and lot size before factory keys can be selected.",
        blocked_bids: blockedBids,
      }, 409);
    }
  }

  // Secure SUN packs require exactly one wrapped key pair. Every other carrier
  // is intentionally keyless: the query proves that no batch-key row or role
  // material exists before any archive is built.
  const rows = secureSunProfile
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
        FROM unnest(${subBatchIds}::uuid[]) AS requested_scope(supplier_sub_batch_id)
        JOIN supplier_sub_batches ssb
          ON ssb.id = requested_scope.supplier_sub_batch_id
         AND ssb.tenant_id = ${order.tenant_id}
         AND ssb.supplier_order_id = ${order.id}
        JOIN batches b
          ON b.id = ssb.batch_id
         AND b.tenant_id = ssb.tenant_id
         AND b.supplier_order_id = ssb.supplier_order_id
         AND b.supplier_sub_batch_id = ssb.id
         AND upper(b.bid) = upper(ssb.bid)
        JOIN batch_keys bk
          ON bk.supplier_sub_batch_id = ssb.id
         AND bk.tenant_id = ssb.tenant_id
         AND bk.supplier_order_id = ssb.supplier_order_id
         AND bk.batch_id = ssb.batch_id
         AND upper(bk.bid) = upper(ssb.bid)
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
          NULL::uuid AS batch_key_id,
          NULL::text AS meta_key_ct,
          NULL::text AS file_key_ct,
          NULL::text AS key_fingerprint,
          0::integer AS export_count
        FROM unnest(${subBatchIds}::uuid[]) AS requested_scope(supplier_sub_batch_id)
        JOIN supplier_sub_batches ssb
          ON ssb.id = requested_scope.supplier_sub_batch_id
         AND ssb.tenant_id = ${order.tenant_id}
         AND ssb.supplier_order_id = ${order.id}
        JOIN batches b
          ON b.id = ssb.batch_id
         AND b.tenant_id = ssb.tenant_id
         AND b.supplier_order_id = ssb.supplier_order_id
         AND b.supplier_sub_batch_id = ssb.id
         AND upper(b.bid) = upper(ssb.bid)
        WHERE b.meta_key_ct IS NULL
          AND b.file_key_ct IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM batch_keys unexpected_key
            WHERE unexpected_key.supplier_sub_batch_id = ssb.id
               OR unexpected_key.batch_id = b.id
               OR (unexpected_key.tenant_id = ssb.tenant_id AND upper(unexpected_key.bid) = upper(ssb.bid))
          )
          AND NOT EXISTS (
            SELECT 1
            FROM batch_key_material unexpected_material
            WHERE unexpected_material.supplier_sub_batch_id = ssb.id
               OR unexpected_material.batch_id = b.id
               OR (unexpected_material.tenant_id = ssb.tenant_id AND upper(unexpected_material.bid) = upper(ssb.bid))
          )
        ORDER BY ssb.sequence_index ASC
      `;
  if (rows.length !== scopeRows.length) {
    return json({
      ok: false,
      reason: secureSunProfile
        ? "supplier_pack_key_scope_incomplete"
        : "supplier_pack_keyless_scope_invalid",
      message: secureSunProfile
        ? "The scoped batch-key set is incomplete. No key material was decrypted and no export counter was consumed."
        : "A keyless carrier contains unexpected batch-key material or an invalid batch binding. Nothing was decrypted and no export counter was consumed.",
    }, 409);
  }

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

  const productionQaPlanApprovalReceipt = isProduction ? {
    schema: "nexid-supplier-production-qa-plan-approval-receipt/v1",
    tenant_id: String(order.tenant_id),
    tenant_slug: String(order.tenant_slug),
    supplier_order_id: String(order.id),
    requested_bid: requestedBid || null,
    pack_purpose: packPurpose,
    commercial_disposition: commercialDisposition,
    activation_allowed: activationAllowed,
    receiving_qa_required: true,
    warning: custodyWarning,
    plans: scopeRows.map((row) => approvedProductionPlans.get(String(row.supplier_sub_batch_id))!),
  } : null;
  const productionQaPlanApprovalBody = productionQaPlanApprovalReceipt
    ? JSON.stringify(productionQaPlanApprovalReceipt, null, 2)
    : null;
  const productionQaPlanApprovalHash = productionQaPlanApprovalBody
    ? sha256Text(productionQaPlanApprovalBody)
    : null;

  const packs = [];
  const zipEntries: SupplierZipEntry[] = [];
  const artifactRecords: Array<Record<string, unknown>> = [];
  const evidenceRecords: Array<Record<string, unknown>> = [];

  if (productionQaPlanApprovalBody && productionQaPlanApprovalHash) {
    artifactRecords.push({
      supplier_sub_batch_id: null,
      resource_type: "supplier_order",
      resource_id: order.id,
      artifact_type: "supplier_production_qa_plan_approval_receipt",
      content_hash: productionQaPlanApprovalHash,
      mime_type: "application/json",
      metadata_json: {
        filename: "PRODUCTION_QA_PLAN_APPROVAL.json",
        plan_count: approvedProductionPlans.size,
        selected_sub_batch_ids: subBatchIds,
        pack_purpose: packPurpose,
        commercial_disposition: commercialDisposition,
        activation_allowed: activationAllowed,
        receiving_qa_required: true,
      },
    });
  }

  for (const row of rows) {
    const productionQaPlanApproval = isProduction
      ? approvedProductionPlans.get(String(row.supplier_sub_batch_id))!
      : null;
    const kMetaHex = secureSunProfile
      ? decryptBatchKeyHex(String(row.meta_key_ct), { tenantId: String(order.tenant_id), bid: String(row.bid), role: "K_META_BATCH" })
      : null;
    const kFileHex = secureSunProfile
      ? decryptBatchKeyHex(String(row.file_key_ct), { tenantId: String(order.tenant_id), bid: String(row.bid), role: "K_FILE_BATCH" })
      : null;
    const urlTemplate = String(row.metadata_json?.url_template || row.sdm_config?.url_template || "");
    const manifestTemplate = buildSupplierManifestTemplate({
      carrierProfile: order.carrier_profile_code,
      batchId: row.bid,
    });
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
      productionQaPlanApproved: productionQaPlanApproval !== null,
    });

    const governedPackJson = {
      ...pack.json,
      PACK_PURPOSE: packPurpose,
      COMMERCIAL_DISPOSITION: commercialDisposition,
      ACTIVATION_ALLOWED: activationAllowed,
      RECEIVING_QA_REQUIRED: isProduction,
      PRODUCTION_QA_PLAN_APPROVAL: productionQaPlanApproval,
      PRODUCTION_QA_PLAN_APPROVAL_RECEIPT_SHA256: productionQaPlanApprovalHash,
    };
    const governedPackText = [
      isProduction
        ? "PENDING_RECEIVING_QA - PRODUCTION ENCODING ONLY - DO NOT ACTIVATE OR RELEASE"
        : "NON_SELLABLE - TRIAL INTEGRATION ONLY - DO NOT SELL, SHIP, OR ACTIVATE",
      `COMMERCIAL_DISPOSITION=${commercialDisposition}`,
      `ACTIVATION_ALLOWED=${activationAllowed}`,
      `RECEIVING_QA_REQUIRED=${isProduction}`,
      ...(productionQaPlanApproval ? [
        `PRODUCTION_QA_PLAN_ID=${productionQaPlanApproval.plan_id}`,
        `PRODUCTION_QA_PLAN_REVISION=${productionQaPlanApproval.plan_revision}`,
        `PRODUCTION_QA_PLAN_DIGEST=${productionQaPlanApproval.plan_digest}`,
        `PRODUCTION_QA_PLAN_DECISION_ID=${productionQaPlanApproval.decision_id}`,
        `PRODUCTION_QA_PLAN_APPROVED_BY=${productionQaPlanApproval.approved_by}`,
        `PRODUCTION_QA_PLAN_APPROVED_AT=${productionQaPlanApproval.approved_at}`,
        `PRODUCTION_QA_PLAN_APPROVAL_EVIDENCE=${productionQaPlanApproval.approval_evidence_ref}`,
        `PRODUCTION_QA_PLAN_APPROVAL_EVIDENCE_SHA256=${productionQaPlanApproval.approval_evidence_sha256}`,
        `PRODUCTION_QA_PLAN_APPROVAL_RECEIPT_SHA256=${productionQaPlanApprovalHash}`,
        "RECEIVING_QA_STATUS=PENDING",
      ] : []),
      custodyWarning,
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
      productionQaPlanApproval,
      productionQaPlanApprovalReceiptHash: productionQaPlanApprovalHash,
    });
    const pdfHash = sha256Buffer(pdfBody);
    const textFilename = `${row.bid}_supplier_encoding_pack.txt`;
    const jsonFilename = `${row.bid}_supplier_encoding_pack.json`;
    const pdfFilename = `${row.bid}_supplier_encoding_summary.pdf`;
    const manifestTemplatePath = `${row.bid}/${manifestTemplate.filename}`;
    zipEntries.push(
      { path: `${row.bid}/${textFilename}`, data: governedPackText },
      { path: `${row.bid}/${jsonFilename}`, data: jsonBody },
      { path: `${row.bid}/${pdfFilename}`, data: pdfBody },
      { path: manifestTemplatePath, data: manifestTemplate.csv },
    );
    for (const [artifactType, contentHash, mimeType] of [
      ["supplier_pack_txt", governedPackContentHash, "text/plain"],
      ["supplier_pack_json", jsonHash, "application/json"],
      ["supplier_pack_pdf_summary", pdfHash, "application/pdf"],
      ["supplier_manifest_template_csv", manifestTemplate.contentHash, "text/csv"],
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
          key_fingerprint: secureSunProfile ? row.key_fingerprint : null,
          key_material_mode: secureSunProfile ? "secure_sun" : "none",
          manifest_template_filename: manifestTemplate.filename,
          manifest_template_path: manifestTemplatePath,
          manifest_template_sha256: manifestTemplate.contentHash,
          manifest_template_headers: manifestTemplate.headers,
          packaging_spec_revision: packagingGate.specRevision,
          packaging_spec_hash: packagingGate.specHash,
          production_qa_plan_id: productionQaPlanApproval?.plan_id || null,
          production_qa_plan_digest: productionQaPlanApproval?.plan_digest || null,
          production_qa_plan_decision_id: productionQaPlanApproval?.decision_id || null,
          production_qa_plan_approval_receipt_sha256: productionQaPlanApprovalHash,
          receiving_qa_required: isProduction,
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
      key_fingerprint: secureSunProfile ? row.key_fingerprint : null,
      key_material_mode: secureSunProfile ? "secure_sun" : "none",
      manifest_template_path: manifestTemplatePath,
      manifest_template_sha256: manifestTemplate.contentHash,
      manifest_template_headers: manifestTemplate.headers,
      exported_by: actor,
      pdf_hash: pdfHash,
      packaging_spec_revision: packagingGate.specRevision,
      packaging_spec_hash: packagingGate.specHash,
      production_qa_plan_id: productionQaPlanApproval?.plan_id || null,
      production_qa_plan_digest: productionQaPlanApproval?.plan_digest || null,
      production_qa_plan_decision_id: productionQaPlanApproval?.decision_id || null,
      production_qa_plan_approval_evidence_sha256: productionQaPlanApproval?.approval_evidence_sha256 || null,
      production_qa_plan_approval_receipt_sha256: productionQaPlanApprovalHash,
      receiving_qa_required: isProduction,
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
      key_fingerprint: secureSunProfile ? row.key_fingerprint : null,
      key_material_mode: secureSunProfile ? "secure_sun" : "none",
      text_filename: textFilename,
      json_filename: jsonFilename,
      pdf_summary_filename: pdfFilename,
      manifest_template_filename: manifestTemplate.filename,
      manifest_template_path: manifestTemplatePath,
      content_hash: governedPackContentHash,
      json_hash: jsonHash,
      pdf_hash: pdfHash,
      manifest_template_sha256: manifestTemplate.contentHash,
      manifest_template_headers: manifestTemplate.headers,
      pack_purpose: packPurpose,
      commercial_disposition: commercialDisposition,
      activation_allowed: activationAllowed,
      receiving_qa_required: isProduction,
      production_qa_plan_id: productionQaPlanApproval?.plan_id || null,
      production_qa_plan_digest: productionQaPlanApproval?.plan_digest || null,
      production_qa_plan_decision_id: productionQaPlanApproval?.decision_id || null,
      production_qa_plan_approval_receipt_sha256: productionQaPlanApprovalHash,
    });
  }

  const readme = [
    isProduction
      ? "PENDING_RECEIVING_QA - PRODUCTION ENCODING ONLY - DO NOT ACTIVATE OR RELEASE"
      : "NON_SELLABLE - TRIAL INTEGRATION ONLY - DO NOT SELL, SHIP, OR ACTIVATE",
    `PACK_PURPOSE=${packPurpose}`,
    `COMMERCIAL_DISPOSITION=${commercialDisposition}`,
    `ACTIVATION_ALLOWED=${activationAllowed}`,
    `RECEIVING_QA_REQUIRED=${isProduction}`,
    custodyWarning,
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
    "- manifest-template.csv provides the carrier-specific import headers for that sub-batch.",
    "- K_META_BATCH and K_FILE_BATCH appear only for NTAG 424 DNA / TagTamper profiles.",
    "- PDF contains human-readable instructions and hashes.",
    "- CHECKSUMS.sha256 verifies every file before factory handoff.",
    "- PACKAGING_APPROVAL.json is the approved, non-secret production specification bound to this export.",
    ...(isProduction ? [
      "- PRODUCTION_QA_PLAN_APPROVAL.json is the immutable tenant approval receipt for every selected BID.",
      `- Production QA approval receipt hash: ${productionQaPlanApprovalHash}`,
      "- This approval authorizes factory encoding only; it does not replace receiving QA or activate products.",
    ] : []),
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
    ...(productionQaPlanApprovalBody
      ? [{ path: "PRODUCTION_QA_PLAN_APPROVAL.json", data: productionQaPlanApprovalBody }]
      : []),
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
    production_qa_plan_approval_receipt_sha256: productionQaPlanApprovalHash,
    receiving_qa_required: isProduction,
    zip_layout: "one-folder-per-sub-batch",
    sub_batches: packs.map((pack) => ({
      bid: pack.bid,
      key_fingerprint: pack.key_fingerprint,
      key_material_mode: pack.key_material_mode,
      content_hash: pack.content_hash,
      json_hash: pack.json_hash,
      pdf_hash: pack.pdf_hash,
      manifest_template_path: pack.manifest_template_path,
      manifest_template_sha256: pack.manifest_template_sha256,
      manifest_template_headers: pack.manifest_template_headers,
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
      key_material_mode: secureSunProfile ? "secure_sun" : "none",
      manifest_templates: packs.map((pack) => ({
        bid: pack.bid,
        path: pack.manifest_template_path,
        sha256: pack.manifest_template_sha256,
        headers: pack.manifest_template_headers,
      })),
      pack_purpose: packPurpose,
      commercial_disposition: commercialDisposition,
      activation_allowed: activationAllowed,
      packaging_spec_revision: packagingGate.specRevision,
      packaging_spec_hash: packagingGate.specHash,
      production_qa_plan_approval_receipt_sha256: productionQaPlanApprovalHash,
      receiving_qa_required: isProduction,
    },
  });

  const productionPlanLockRecords = isProduction
    ? scopeRows.map((row) => {
        const approval = approvedProductionPlans.get(String(row.supplier_sub_batch_id))!;
        return {
          supplier_sub_batch_id: approval.supplier_sub_batch_id,
          batch_id: approval.batch_id,
          bid: approval.bid,
          plan_id: approval.plan_id,
          plan_revision: approval.plan_revision,
          plan_digest: approval.plan_digest,
          decision_id: approval.decision_id,
          approval_evidence_sha256: approval.approval_evidence_sha256,
          lot_size: approval.lot_size,
        };
      })
    : [];

  const exportAuditData = {
    order_id: order.id,
    exported_by: actor,
    encrypted_pack_hash: encrypted.envelopeHash,
    plaintext_zip_hash: encrypted.plaintextZipHash,
    pack_purpose: packPurpose,
    commercial_disposition: commercialDisposition,
    activation_allowed: activationAllowed,
    packaging_spec_revision: packagingGate.specRevision,
    packaging_spec_hash: packagingGate.specHash,
    receiving_qa_required: isProduction,
    production_qa_plan_approval_receipt_sha256: productionQaPlanApprovalHash,
    bids: packs.map((pack) => ({
      bid: pack.bid,
      content_hash: pack.content_hash,
      json_hash: pack.json_hash,
      pdf_hash: pack.pdf_hash,
      key_fingerprint: pack.key_fingerprint,
      key_material_mode: pack.key_material_mode,
      manifest_template_path: pack.manifest_template_path,
      manifest_template_sha256: pack.manifest_template_sha256,
      manifest_template_headers: pack.manifest_template_headers,
      production_qa_plan_id: pack.production_qa_plan_id,
      production_qa_plan_digest: pack.production_qa_plan_digest,
      production_qa_plan_decision_id: pack.production_qa_plan_decision_id,
    })),
  };
  const exportAuditHash = createHash("sha256")
    .update(JSON.stringify(exportAuditData))
    .digest("hex");

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
    production_plan_input AS MATERIALIZED (
      SELECT *
      FROM jsonb_to_recordset(${JSON.stringify(productionPlanLockRecords)}::jsonb) AS plan_input(
        supplier_sub_batch_id uuid,
        batch_id uuid,
        bid text,
        plan_id uuid,
        plan_revision integer,
        plan_digest text,
        decision_id uuid,
        approval_evidence_sha256 text,
        lot_size integer
      )
    ),
    approved_production_plans AS MATERIALIZED (
      SELECT plan.id, plan.supplier_sub_batch_id
      FROM production_plan_input plan_input
      JOIN supplier_sub_batches ssb
        ON ssb.id = plan_input.supplier_sub_batch_id
       AND ssb.tenant_id = ${order.tenant_id}
       AND ssb.supplier_order_id = ${order.id}
       AND ssb.batch_id = plan_input.batch_id
       AND upper(ssb.bid) = upper(plan_input.bid)
       AND ssb.expected_quantity = plan_input.lot_size
      JOIN supplier_production_qa_plans plan
        ON plan.id = plan_input.plan_id
       AND plan.tenant_id = ssb.tenant_id
       AND plan.supplier_order_id = ssb.supplier_order_id
       AND plan.supplier_sub_batch_id = ssb.id
       AND plan.batch_id = ssb.batch_id
       AND upper(plan.bid) = upper(ssb.bid)
       AND plan.schema_version = 'supplier-production-qa-plan/v1'
       AND plan.revision = plan_input.plan_revision
       AND plan.lot_size = plan_input.lot_size
       AND plan.plan_digest = plan_input.plan_digest
      JOIN supplier_production_qa_plan_decisions plan_decision
        ON plan_decision.id = plan_input.decision_id
       AND plan_decision.plan_id = plan.id
       AND plan_decision.tenant_id = plan.tenant_id
       AND plan_decision.supplier_order_id = plan.supplier_order_id
       AND plan_decision.supplier_sub_batch_id = plan.supplier_sub_batch_id
       AND plan_decision.batch_id = plan.batch_id
       AND upper(plan_decision.bid) = upper(plan.bid)
       AND plan_decision.schema_version = 'supplier-production-qa-plan-decision/v1'
       AND plan_decision.decision_status = 'approved'
       AND plan_decision.approver_role IN ('tenant_owner', 'tenant_admin')
       AND plan_decision.plan_digest = plan.plan_digest
       AND plan_decision.approval_evidence_sha256 = plan_input.approval_evidence_sha256
       AND plan_decision.decided_at <= now()
      WHERE ${packPurpose}::text = 'production'
        AND NOT EXISTS (
          SELECT 1
          FROM supplier_production_qa_plans newer_plan
          WHERE newer_plan.tenant_id = plan.tenant_id
            AND newer_plan.supplier_sub_batch_id = plan.supplier_sub_batch_id
            AND newer_plan.revision > plan.revision
        )
      FOR KEY SHARE OF plan, plan_decision
    ),
    advisory_locks AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(
        'supplier-pack-export' || chr(31) || target.supplier_sub_batch_id::text,
        0
      )) AS acquired
      FROM target
      ORDER BY target.supplier_sub_batch_id
    ),
    locked_sub_batches AS MATERIALIZED (
      SELECT ssb.id AS supplier_sub_batch_id, ssb.batch_id
      FROM target
      CROSS JOIN approved_order
      JOIN supplier_sub_batches ssb
        ON ssb.id = target.supplier_sub_batch_id
       AND ssb.tenant_id = ${order.tenant_id}
       AND ssb.supplier_order_id = ${order.id}
      JOIN batches b
        ON b.id = ssb.batch_id
       AND b.tenant_id = ssb.tenant_id
       AND b.supplier_order_id = ssb.supplier_order_id
       AND b.supplier_sub_batch_id = ssb.id
       AND upper(b.bid) = upper(ssb.bid)
      WHERE ssb.key_export_count = 0
        AND (SELECT COUNT(*) FROM advisory_locks) = ${rows.length}
        AND (
          (${secureSunProfile}::boolean AND b.meta_key_ct IS NOT NULL AND b.file_key_ct IS NOT NULL)
          OR (
            NOT ${secureSunProfile}::boolean
            AND b.meta_key_ct IS NULL
            AND b.file_key_ct IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM batch_keys unexpected_key
              WHERE unexpected_key.supplier_sub_batch_id = ssb.id
                 OR unexpected_key.batch_id = b.id
                 OR (unexpected_key.tenant_id = ssb.tenant_id AND upper(unexpected_key.bid) = upper(ssb.bid))
            )
            AND NOT EXISTS (
              SELECT 1 FROM batch_key_material unexpected_material
              WHERE unexpected_material.supplier_sub_batch_id = ssb.id
                 OR unexpected_material.batch_id = b.id
                 OR (unexpected_material.tenant_id = ssb.tenant_id AND upper(unexpected_material.bid) = upper(ssb.bid))
            )
          )
        )
      FOR UPDATE OF ssb
    ),
    locked_keys AS MATERIALIZED (
      SELECT bk.supplier_sub_batch_id
      FROM locked_sub_batches locked
      JOIN batch_keys bk
        ON bk.supplier_sub_batch_id = locked.supplier_sub_batch_id
       AND bk.batch_id = locked.batch_id
       AND bk.tenant_id = ${order.tenant_id}
       AND bk.supplier_order_id = ${order.id}
       AND bk.export_count = 0
      WHERE ${secureSunProfile}::boolean
      FOR UPDATE OF bk
    ),
    locked_key_material AS MATERIALIZED (
      SELECT material.id, material.supplier_sub_batch_id
      FROM locked_keys locked
      JOIN batch_key_material material
        ON material.supplier_sub_batch_id = locked.supplier_sub_batch_id
       AND material.tenant_id = ${order.tenant_id}
       AND material.supplier_order_id = ${order.id}
       AND material.status = 'active'
       AND material.export_count = 0
      WHERE ${secureSunProfile}::boolean
      FOR UPDATE OF material
    ),
    readiness AS MATERIALIZED (
      SELECT
        (SELECT COUNT(*)::int FROM locked_sub_batches) = ${rows.length} AS sub_batches_ready,
        CASE WHEN ${secureSunProfile}::boolean
          THEN (SELECT COUNT(*)::int FROM locked_keys) = ${rows.length}
          ELSE (SELECT COUNT(*)::int FROM locked_keys) = 0
        END AS key_scope_ready,
        CASE WHEN ${secureSunProfile}::boolean
          THEN (SELECT COUNT(*)::int FROM locked_key_material) = ${rows.length * 2}
          ELSE (SELECT COUNT(*)::int FROM locked_key_material) = 0
        END AS key_material_scope_ready,
        EXISTS (SELECT 1 FROM approved_order) AS packaging_ready,
        (
          ${packPurpose}::text <> 'production'
          OR (SELECT COUNT(*)::int FROM approved_production_plans) = ${rows.length}
        ) AS production_qa_ready
    ),
    reserved_sub_batches AS (
      UPDATE supplier_sub_batches ssb
      SET key_export_count = key_export_count + 1,
          key_exported_at = now(),
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object(
            'supplier_pack_export_count', key_export_count + 1,
            'supplier_pack_exported_at', now(),
            'key_material_mode', CASE WHEN ${secureSunProfile}::boolean THEN 'secure_sun' ELSE 'none' END
          ),
          updated_at = now()
      FROM locked_sub_batches locked, readiness
      WHERE readiness.sub_batches_ready AND readiness.key_scope_ready
        AND readiness.key_material_scope_ready
        AND readiness.packaging_ready AND readiness.production_qa_ready
        AND ssb.id = locked.supplier_sub_batch_id
      RETURNING ssb.id
    ),
    reserved_keys AS (
      UPDATE batch_keys bk
      SET export_count = export_count + 1,
          exported_at = now()
      FROM locked_keys locked, readiness
      WHERE readiness.sub_batches_ready AND readiness.key_scope_ready
        AND readiness.key_material_scope_ready
        AND readiness.packaging_ready AND readiness.production_qa_ready
        AND bk.supplier_sub_batch_id = locked.supplier_sub_batch_id
      RETURNING bk.supplier_sub_batch_id
    ),
    reserved_material AS (
      UPDATE batch_key_material material
      SET export_count = export_count + 1,
          exported_at = now(),
          exported_by = ${actor},
          updated_at = now()
      FROM locked_key_material locked, readiness
      WHERE readiness.sub_batches_ready AND readiness.key_scope_ready
        AND readiness.key_material_scope_ready
        AND readiness.packaging_ready AND readiness.production_qa_ready
        AND material.id = locked.id
      RETURNING material.id
    ),
    reservation_gate AS MATERIALIZED (
      SELECT
        readiness.sub_batches_ready
          AND readiness.key_scope_ready
          AND readiness.key_material_scope_ready
          AND readiness.packaging_ready
          AND readiness.production_qa_ready
          AND (SELECT COUNT(*) FROM reserved_sub_batches) = ${rows.length}
          AND (SELECT COUNT(*) FROM reserved_keys) = CASE
            WHEN ${secureSunProfile}::boolean THEN ${rows.length} ELSE 0 END
          AND (SELECT COUNT(*) FROM reserved_material) = CASE
            WHEN ${secureSunProfile}::boolean THEN ${rows.length * 2} ELSE 0 END AS ok,
        readiness.packaging_ready,
        readiness.production_qa_ready,
        (SELECT COUNT(*)::int FROM approved_production_plans) AS approved_production_plans,
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
    ),
    inserted_audit AS (
      INSERT INTO audit_logs (
        actor_id, tenant_id, action, resource_type, resource_id,
        after_hash, user_agent, request_id
      )
      SELECT
        ${actorPrincipal.id}::uuid, ${order.tenant_id}, 'supplier_pack_exported',
        'supplier_order', ${String(order.id)}, ${exportAuditHash},
        ${req.headers.get("user-agent") || null}, ${req.headers.get("x-request-id") || null}
      FROM reservation_gate gate
      WHERE gate.ok
        AND (SELECT COUNT(*)::int FROM inserted_artifacts) = ${artifactRecords.length}
      RETURNING id
    )
      SELECT gate.ok AS ready,
           gate.packaging_ready,
           gate.production_qa_ready,
           gate.approved_production_plans,
           gate.reserved_sub_batches,
           gate.reserved_keys,
           gate.reserved_material,
           (SELECT COUNT(*)::int FROM inserted_artifacts) AS inserted_artifacts,
           (SELECT COUNT(*)::int FROM inserted_evidence) AS inserted_evidence,
           (SELECT COUNT(*)::int FROM inserted_audit) AS inserted_audit
    FROM reservation_gate gate
  `;
  const persisted = persistedRows[0] || {};
  if (
    persisted.ready !== true
    || Number(persisted.inserted_artifacts || 0) !== artifactRecords.length
    || Number(persisted.inserted_audit || 0) !== 1
  ) {
    const productionQaChanged = isProduction && persisted.production_qa_ready === false;
    return json({
      ok: false,
      reason: productionQaChanged
        ? "supplier_production_qa_plan_approval_changed"
        : persisted.packaging_ready === false
          ? "supplier_packaging_approval_changed"
          : "supplier_pack_export_conflict",
      message: productionQaChanged
        ? "A production QA plan approval changed during export. No artifact or one-time counter was committed; review every selected BID before retrying."
        : persisted.packaging_ready === false
          ? "Packaging approval changed during export. No artifact or one-time counter was committed; review the current packaging revision before retrying."
          : "The encrypted artifact was not committed, so no one-time export counter was consumed. Retry after checking for a concurrent export.",
      requested: rows.length,
      approved_production_plans: Number(persisted.approved_production_plans || 0),
      reserved_sub_batches: Number(persisted.reserved_sub_batches || 0),
      reserved_keys: Number(persisted.reserved_keys || 0),
      artifact_persisted: false,
    }, 409);
  }

  return json({
    ok: true,
    key_custody: secureSunProfile ? {
      mode: "pilot_application_envelope_encryption",
      algorithm: "AES-256-GCM",
      aad_scope: ["tenant", "bid", "key_role", "key_version", "kek_version"],
      managed_kms: false,
      hsm_backed: false,
      boundary: "The KEK is a versioned application secret in the deployment platform; it is not a managed KMS/HSM key handle.",
    } : {
      mode: "not_applicable_keyless_carrier",
      algorithm: null,
      aad_scope: [],
      managed_kms: false,
      hsm_backed: false,
      boundary: "This carrier profile has no K_META_BATCH/K_FILE_BATCH and no batch-key custody record.",
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
      receiving_qa_required: isProduction,
      production_qa_plan_approval_receipt_sha256: productionQaPlanApprovalHash,
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
      receiving_qa_required: isProduction,
      production_qa_plan_approval_receipt_sha256: productionQaPlanApprovalHash,
      password_warning: "Password is not returned by the API. Use the operator-generated password and send it over a separate channel.",
      password_delivery: {
        mode: "operator_generated",
        returned: false,
        separate_channel_required: true,
      },
    },
    warning: secureSunProfile
      ? `${custodyWarning} The response does not include the pack password. Raw K_META_BATCH/K_FILE_BATCH are present only inside encrypted 424 DNA supplier folders.`
      : `${custodyWarning} The response does not include the pack password. This keyless carrier pack contains no K_META_BATCH/K_FILE_BATCH.`,
    packs,
  });
}
