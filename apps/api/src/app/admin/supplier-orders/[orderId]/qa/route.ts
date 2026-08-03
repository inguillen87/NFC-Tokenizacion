export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminActor, getAdminTenantScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { hashEvidencePayload } from "../../../../../lib/proof-layer";
import { requiresSecureSunEncoding } from "../../../../../lib/supplier-ops";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../../../lib/bounded-request-body";
import {
  commitSupplierQa,
  hasSupplierQaVerificationContextV2,
  SUPPLIER_QA_VERIFICATION_CONTEXT_V2_MIGRATION,
  supplierQaCommitError,
  validSupplierQaIdempotencyKey,
} from "../../../../../lib/supplier-qa-commit";
import {
  parseSupplierQaSnapshotReferences,
  SUPPLIER_QA_SUN_EVIDENCE_VERSION,
  validateSupplierQaSunEvidence,
  type SupplierQaDiagnosticRow,
  type SupplierQaSnapshotReference,
} from "../../../../../lib/supplier-qa-evidence";
import { buildSupplierQaVerificationContext } from "../../../../../lib/supplier-qa-verification-context";
import { auditFreeformValuesAreSafe } from "../../../../../lib/audit-freeform-secret-policy";
import { buildSupplierOpsErrorReport } from "../../../../../lib/supplier-ops-error-report";
import {
  commitSupplierCarrierQa,
  hasSupplierCarrierQaV1,
  supplierCarrierQaCommitError,
} from "../../../../../lib/supplier-carrier-qa-commit";
import {
  isSupplierCarrierQaSupported,
  supplierCarrierQaObservationUids,
  SUPPLIER_CARRIER_QA_EVIDENCE_VERSION,
  SUPPLIER_CARRIER_QA_MIGRATION,
  validateSupplierCarrierQaEvidence,
} from "../../../../../lib/supplier-carrier-qa-evidence";
import { resolveSupplierPublicTagOrigin } from "../../../../../lib/supplier-public-tag-origin";

const MAX_QA_BODY_BYTES = 300 * 1024;
const MAX_QA_NOTES_LENGTH = 2_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeString(value: unknown) {
  return String(value || "").trim();
}

function parseQaDecision(body: Record<string, unknown>) {
  if (typeof body.passed === "boolean") return body.passed;
  if (typeof body.qa_passed === "boolean") return body.qa_passed;
  const status = safeString(body.status).toLowerCase();
  if (status === "passed") return true;
  if (status === "failed") return false;
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdminWithPermission(req, "qa.approve");
  if (auth) return auth;

  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) return json({ ok: false, reason: "supplier_order_not_found" }, 404);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_QA_BODY_BYTES);
  } catch (error) {
    return json({
      ok: false,
      reason: error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json_body",
    }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  const passed = parseQaDecision(body);
  if (passed == null) return json({ ok: false, reason: "qa_decision_required" }, 400);
  const operationKey = String(req.headers.get("idempotency-key") || "").trim();
  if (!validSupplierQaIdempotencyKey(operationKey)) {
    return json({
      ok: false,
      reason: "idempotency_key_required",
      message: "Send an Idempotency-Key header (8-128 safe characters) and reuse it only for an exact retry of this QA decision.",
    }, 400);
  }
  const bid = safeString(body.bid || body.batch_id);
  if (!bid) return json({ ok: false, reason: "bid_required" }, 400);

  let verificationContextV2Available = false;
  try {
    verificationContextV2Available = await hasSupplierQaVerificationContextV2();
  } catch {
    verificationContextV2Available = false;
  }
  if (!verificationContextV2Available) {
    return json({
      ok: false,
      reason: "supplier_qa_verification_context_v2_migration_required",
      required_migration: SUPPLIER_QA_VERIFICATION_CONTEXT_V2_MIGRATION,
    }, 503);
  }

  const rows = forcedTenantSlug
    ? await sql/*sql*/`
        SELECT
          so.id AS supplier_order_id,
          so.tenant_id,
          so.pack_purpose AS declared_pack_purpose,
          COALESCE(purpose_decision.to_purpose, so.pack_purpose) AS effective_pack_purpose,
          ssb.id AS supplier_sub_batch_id,
          ssb.batch_id,
          ssb.bid,
          ssb.expected_quantity,
          ssb.manifest_status,
          ssb.manifest_count,
          ssb.manifest_hash,
          ssb.manifest_imported_at,
          ssb.qa_status,
          ssb.activated_at,
          ssb.status AS supplier_sub_batch_status,
          ssb.key_export_count,
          ssb.metadata_json AS supplier_sub_batch_metadata,
          to_char(ssb.key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS key_exported_at,
          bk.key_fingerprint,
          COALESCE(bk.export_count, 0) AS batch_key_export_count,
          to_char(bk.exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS batch_key_exported_at,
          b.meta_key_ct,
          b.file_key_ct,
          (SELECT count(*)::integer FROM batch_keys scoped_key
            WHERE scoped_key.supplier_sub_batch_id = ssb.id
               OR scoped_key.batch_id = b.id
               OR (scoped_key.tenant_id = ssb.tenant_id AND upper(scoped_key.bid) = upper(ssb.bid))) AS batch_key_row_count,
          (SELECT count(*)::integer FROM batch_key_material scoped_material
            WHERE scoped_material.supplier_sub_batch_id = ssb.id
               OR scoped_material.batch_id = b.id
               OR (scoped_material.tenant_id = ssb.tenant_id AND upper(scoped_material.bid) = upper(ssb.bid))) AS batch_key_material_row_count,
          so.carrier_profile_code AS order_carrier_profile_code,
          so.packaging_governance_status,
          so.packaging_spec_revision,
          so.packaging_spec_hash,
          b.carrier_profile_code,
          b.status AS batch_status,
          b.sdm_config AS batch_sdm_config,
          t.slug AS tenant_slug
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        LEFT JOIN supplier_pack_purpose_decisions purpose_decision
          ON purpose_decision.supplier_order_id = so.id
         AND purpose_decision.tenant_id = so.tenant_id
        JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        JOIN batches b ON b.id = ssb.batch_id AND b.tenant_id = so.tenant_id AND b.bid = ssb.bid
        LEFT JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id AND bk.batch_id = b.id AND bk.tenant_id = so.tenant_id AND bk.bid = ssb.bid AND bk.status = 'active'
        WHERE so.id = ${orderId}::uuid
          AND ssb.tenant_id = so.tenant_id
          AND ssb.bid = ${bid}
          AND t.slug = ${forcedTenantSlug}
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT
          so.id AS supplier_order_id,
          so.tenant_id,
          so.pack_purpose AS declared_pack_purpose,
          COALESCE(purpose_decision.to_purpose, so.pack_purpose) AS effective_pack_purpose,
          ssb.id AS supplier_sub_batch_id,
          ssb.batch_id,
          ssb.bid,
          ssb.expected_quantity,
          ssb.manifest_status,
          ssb.manifest_count,
          ssb.manifest_hash,
          ssb.manifest_imported_at,
          ssb.qa_status,
          ssb.activated_at,
          ssb.status AS supplier_sub_batch_status,
          ssb.key_export_count,
          ssb.metadata_json AS supplier_sub_batch_metadata,
          to_char(ssb.key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS key_exported_at,
          bk.key_fingerprint,
          COALESCE(bk.export_count, 0) AS batch_key_export_count,
          to_char(bk.exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS batch_key_exported_at,
          b.meta_key_ct,
          b.file_key_ct,
          (SELECT count(*)::integer FROM batch_keys scoped_key
            WHERE scoped_key.supplier_sub_batch_id = ssb.id
               OR scoped_key.batch_id = b.id
               OR (scoped_key.tenant_id = ssb.tenant_id AND upper(scoped_key.bid) = upper(ssb.bid))) AS batch_key_row_count,
          (SELECT count(*)::integer FROM batch_key_material scoped_material
            WHERE scoped_material.supplier_sub_batch_id = ssb.id
               OR scoped_material.batch_id = b.id
               OR (scoped_material.tenant_id = ssb.tenant_id AND upper(scoped_material.bid) = upper(ssb.bid))) AS batch_key_material_row_count,
          so.carrier_profile_code AS order_carrier_profile_code,
          so.packaging_governance_status,
          so.packaging_spec_revision,
          so.packaging_spec_hash,
          b.carrier_profile_code,
          b.status AS batch_status,
          b.sdm_config AS batch_sdm_config,
          t.slug AS tenant_slug
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        LEFT JOIN supplier_pack_purpose_decisions purpose_decision
          ON purpose_decision.supplier_order_id = so.id
         AND purpose_decision.tenant_id = so.tenant_id
        JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        JOIN batches b ON b.id = ssb.batch_id AND b.tenant_id = so.tenant_id AND b.bid = ssb.bid
        LEFT JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id AND bk.batch_id = b.id AND bk.tenant_id = so.tenant_id AND bk.bid = ssb.bid AND bk.status = 'active'
        WHERE so.id = ${orderId}::uuid
          AND ssb.tenant_id = so.tenant_id
          AND ssb.bid = ${bid}
        LIMIT 1
      `;
  const subBatch = rows[0];
  if (!subBatch) return json({ ok: false, reason: "supplier_sub_batch_not_found" }, 404);

  const effectivePackPurpose = String(subBatch.effective_pack_purpose || "legacy_unclassified").trim().toLowerCase();
  if (!new Set(["legacy_unclassified", "trial_integration", "production"]).has(effectivePackPurpose)) {
    return json({ ok: false, reason: "supplier_pack_purpose_scope_invalid" }, 409);
  }
  if (passed && effectivePackPurpose === "legacy_unclassified") {
    return json({
      ok: false,
      reason: "supplier_pack_purpose_unclassified",
      message: "Classify this historical supplier order through the audited legacy-to-trial workflow before recording a passing integration receipt.",
    }, 409);
  }
  if (passed && subBatch.manifest_status !== "imported") {
    return json({
      ok: false,
      reason: "manifest_required_before_qa",
      message: "Import and validate the UID manifest before marking QA as passed.",
    }, 409);
  }
  const carrierProfileCode = String(subBatch.carrier_profile_code || "").trim().toLowerCase();
  const orderCarrierProfileCode = String(subBatch.order_carrier_profile_code || "").trim().toLowerCase();
  if (!carrierProfileCode || !orderCarrierProfileCode || carrierProfileCode !== orderCarrierProfileCode) {
    return json({
      ok: false,
      reason: "qa_carrier_profile_scope_mismatch",
      message: "Supplier order and batch carrier profiles must match before QA can be evaluated.",
    }, 409);
  }
  const requiresTtstatus = carrierProfileCode === "ntag424_dna_tt";
  const requiresSecureSun = requiresSecureSunEncoding(carrierProfileCode);
  const carrierQaSupported = isSupplierCarrierQaSupported(carrierProfileCode);
  if (passed && effectivePackPurpose === "production" && requiresSecureSun) {
    return json({
      ok: false,
      reason: "supplier_qa_production_acceptance_v2_required",
      message: "Secure SUN production lots must use the precommitted Production Acceptance v2 session; this carrier-capture path cannot replace CMAC, replay or TagTamper evidence.",
    }, 409);
  }
  const keylessMetadata = subBatch.supplier_sub_batch_metadata
    && typeof subBatch.supplier_sub_batch_metadata === "object"
    && !Array.isArray(subBatch.supplier_sub_batch_metadata)
      ? subBatch.supplier_sub_batch_metadata as Record<string, unknown>
      : {};
  if (passed && requiresSecureSun && (
    Number(subBatch.batch_key_row_count || 0) !== 1
    || Number(subBatch.batch_key_material_row_count || 0) !== 2
    || !String(subBatch.key_fingerprint || "").match(/^[0-9A-F]{16}$/)
    || !subBatch.meta_key_ct
    || !subBatch.file_key_ct
  )) {
    return json({ ok: false, reason: "supplier_qa_sun_key_scope_invalid" }, 409);
  }
  if (passed && !requiresSecureSun && (
    Number(subBatch.batch_key_row_count || 0) !== 0
    || Number(subBatch.batch_key_material_row_count || 0) !== 0
    || subBatch.key_fingerprint
    || subBatch.meta_key_ct
    || subBatch.file_key_ct
    || String(keylessMetadata.key_material_mode || "") !== "none"
    || keylessMetadata.software_envelope !== false
    || keylessMetadata.managed_kms !== false
    || keylessMetadata.hsm_backed !== false
  )) {
    return json({
      ok: false,
      reason: "supplier_carrier_qa_keyless_scope_invalid",
      message: "Keyless carrier QA requires zero batch-key rows and an explicit none/false/false custody boundary.",
    }, 409);
  }
  if (passed && !requiresSecureSun && !carrierQaSupported) {
    return json({
      ok: false,
      reason: "qa_carrier_evidence_strategy_not_implemented",
      message: "This carrier needs a dedicated evidence adapter. It cannot fall back to SUN evidence or operator self-attestation.",
    }, 409);
  }
  if (passed && carrierQaSupported) {
    const carrierQaAvailable = await hasSupplierCarrierQaV1().catch(() => false);
    if (!carrierQaAvailable) {
      return json({
        ok: false,
        reason: "supplier_carrier_qa_migration_required",
        required_migration: SUPPLIER_CARRIER_QA_MIGRATION,
      }, 503);
    }
  }
  const batchSdmConfig = subBatch.batch_sdm_config
    && typeof subBatch.batch_sdm_config === "object"
    && !Array.isArray(subBatch.batch_sdm_config)
      ? subBatch.batch_sdm_config as Record<string, unknown>
      : {};
  const verificationContext = buildSupplierQaVerificationContext({
    tenantId: subBatch.tenant_id,
    batchId: subBatch.batch_id,
    bid: subBatch.bid,
    manifestHash: subBatch.manifest_hash,
    carrierProfileCode,
    keyFingerprint: subBatch.key_fingerprint,
    sdmConfig: batchSdmConfig,
    supplierOrderId: subBatch.supplier_order_id,
    supplierSubBatchId: subBatch.supplier_sub_batch_id,
    supplierSubBatchStatus: subBatch.supplier_sub_batch_status,
    batchStatus: subBatch.batch_status,
    keyExportCount: subBatch.key_export_count,
    keyExportedAt: subBatch.key_exported_at,
    batchKeyExportCount: subBatch.batch_key_export_count,
    batchKeyExportedAt: subBatch.batch_key_exported_at,
    packagingGovernanceStatus: subBatch.packaging_governance_status,
    packagingSpecRevision: subBatch.packaging_spec_revision,
    packagingSpecHash: subBatch.packaging_spec_hash,
    packPurpose: effectivePackPurpose,
  });
  if (!verificationContext) {
    return json({
      ok: false,
      reason: "qa_verification_context_incomplete",
      message: "The immutable supplier, manifest, key, packaging and purpose scope is incomplete; QA cannot evaluate this batch.",
    }, 409);
  }
  const { carrierConfigDigest, verificationContextDigest } = verificationContext;
  const notesText = safeString(body.notes);
  if (notesText.length > MAX_QA_NOTES_LENGTH) {
    return json({ ok: false, reason: "qa_notes_too_long", maximum_length: MAX_QA_NOTES_LENGTH }, 400);
  }
  if (!auditFreeformValuesAreSafe([notesText])) {
    return json({ ok: false, reason: "supplier_carrier_qa_sensitive_audit_input_rejected" }, 400);
  }
  const notes = notesText || null;
  const actor = getAdminActor(req);
  const actorEmail = actor.email;
  const notesDigest = notes ? hashEvidencePayload({ notes }) : null;
  let keylessProductionAcceptance: {
    sampleSize: number;
    qaPlanId: string;
    qaPlanDigest: string;
    qaPlanDecisionId: string;
    packagingLabApprovalId: string;
    packagingLabReceiptDigest: string;
  } | null = null;
  if (passed && effectivePackPurpose === "production" && carrierQaSupported) {
    const acceptanceRows = await sql/*sql*/`
      SELECT
        plan.id::text AS qa_plan_id,
        plan.sample_size,
        plan.plan_digest,
        plan_decision.id::text AS qa_plan_decision_id,
        lab.approval_id::text AS packaging_lab_approval_id,
        lab.receipt_digest AS packaging_lab_receipt_digest
      FROM supplier_production_qa_plans plan
      JOIN supplier_production_qa_plan_decisions plan_decision
        ON plan_decision.plan_id = plan.id
       AND plan_decision.tenant_id = plan.tenant_id
       AND plan_decision.supplier_order_id = plan.supplier_order_id
       AND plan_decision.supplier_sub_batch_id = plan.supplier_sub_batch_id
       AND plan_decision.batch_id = plan.batch_id
       AND upper(plan_decision.bid) = upper(plan.bid)
       AND plan_decision.schema_version = 'supplier-production-qa-plan-decision/v1'
       AND plan_decision.decision_status = 'approved'
       AND plan_decision.approver_role IN ('tenant_owner', 'tenant_admin')
       AND plan_decision.plan_digest = plan.plan_digest
      JOIN LATERAL public.nexid_packaging_lab_activation_receipt_v1(plan.batch_id) lab
        ON lab.tenant_id = plan.tenant_id
       AND lab.supplier_order_id = plan.supplier_order_id
       AND lab.supplier_sub_batch_id = plan.supplier_sub_batch_id
       AND lab.batch_id = plan.batch_id
      WHERE plan.tenant_id = ${subBatch.tenant_id}::uuid
        AND plan.supplier_order_id = ${subBatch.supplier_order_id}::uuid
        AND plan.supplier_sub_batch_id = ${subBatch.supplier_sub_batch_id}::uuid
        AND plan.batch_id = ${subBatch.batch_id}::uuid
        AND upper(plan.bid) = upper(${subBatch.bid})
        AND plan.schema_version = 'supplier-production-qa-plan/v1'
        AND plan.lot_size = ${Number(subBatch.expected_quantity || 0)}
        AND NOT EXISTS (
          SELECT 1 FROM supplier_production_qa_plans newer_plan
          WHERE newer_plan.tenant_id = plan.tenant_id
            AND newer_plan.supplier_sub_batch_id = plan.supplier_sub_batch_id
            AND newer_plan.revision > plan.revision
        )
      LIMIT 1
    `;
    const acceptance = acceptanceRows[0];
    if (!acceptance) {
      return json({
        ok: false,
        reason: "supplier_keyless_production_qa_plan_or_physical_evidence_required",
        message: "Production keyless QA requires the current tenant-approved sampling plan and a current carrier-appropriate Packaging Lab approval.",
      }, 409);
    }
    keylessProductionAcceptance = {
      sampleSize: Number(acceptance.sample_size || 0),
      qaPlanId: String(acceptance.qa_plan_id || ""),
      qaPlanDigest: String(acceptance.plan_digest || ""),
      qaPlanDecisionId: String(acceptance.qa_plan_decision_id || ""),
      packagingLabApprovalId: String(acceptance.packaging_lab_approval_id || ""),
      packagingLabReceiptDigest: String(acceptance.packaging_lab_receipt_digest || ""),
    };
  }
  const suppliedSnapshotUrls = Array.isArray(body.snapshot_urls)
    ? body.snapshot_urls
    : Array.isArray(body.snapshotUrls)
      ? body.snapshotUrls
      : Array.isArray(body.sample_urls)
        ? body.sample_urls
        : [];
  const suppliedCarrierObservations = Array.isArray(body.carrier_observations)
    ? body.carrier_observations
    : Array.isArray(body.carrierObservations)
      ? body.carrierObservations
      : [];
  let verifiedEvidence: Extract<ReturnType<typeof validateSupplierQaSunEvidence>, { ok: true }> | null = null;
  let verifiedCarrierEvidence: Extract<ReturnType<typeof validateSupplierCarrierQaEvidence>, { ok: true }> | null = null;
  let verifiedReferences: SupplierQaSnapshotReference[] = [];
  if (passed && requiresSecureSun) {
    const parsedReferences = parseSupplierQaSnapshotReferences(suppliedSnapshotUrls);
    if (!parsedReferences.ok) {
      const message = "Paste Nexid result-page URLs containing both snapshot and trace. Raw SUN URLs and operator checkboxes are not accepted as QA evidence.";
      return json({
        ok: false,
        reason: parsedReferences.reason,
        message,
        bid: subBatch.bid,
        reference_count: parsedReferences.referenceCount,
        carrier_profile_code: subBatch.carrier_profile_code,
        error_report: buildSupplierOpsErrorReport({
          stage: "qa",
          bid: String(subBatch.bid),
          reason: parsedReferences.reason,
          message,
          issues: [{
            code: parsedReferences.reason,
            field: "snapshot_urls",
            value: `received=${parsedReferences.referenceCount}`,
            detail: "Use only Nexid result-page references with an authorized snapshot and trace; never paste raw SUN query material into the report.",
          }],
        }),
      }, 409);
    }
    const diagnosticIds = parsedReferences.references.map((reference) => reference.diagnosticId);
    const diagnosticRows = await sql/*sql*/`
      SELECT
        d.id,
        d.trace_id,
        d.created_at::text AS created_at,
        d.bid,
        d.uid_hex,
        d.read_counter,
        d.auth_status,
        d.replay_status,
        d.product_state,
        d.tamper_status,
        d.tamper_opened,
        d.tagtamper_config_detected,
        d.request_json->>'evidence_source' AS evidence_source,
        d.result_json,
        e.id AS event_id,
        e.created_at::text AS event_created_at,
        e.tenant_id::text AS event_tenant_id,
        e.batch_id::text AS event_batch_id,
        e.bid AS event_bid,
        e.uid_hex AS event_uid_hex,
        COALESCE(e.read_counter, e.sdm_read_ctr) AS event_counter,
        e.cmac_ok AS event_cmac_ok,
        e.source::text AS event_source,
        e.result AS event_result,
        e.meta->>'replay_original_event_id' AS replay_original_event_id,
        EXISTS (
          SELECT 1
          FROM tags tg
          WHERE tg.batch_id = ${subBatch.batch_id}
            AND UPPER(tg.uid_hex) = UPPER(d.uid_hex)
        ) AS manifest_uid_match,
        (
          SELECT tg.lifecycle_state::text
          FROM tags tg
          WHERE tg.batch_id = ${subBatch.batch_id}
            AND UPPER(tg.uid_hex) = UPPER(d.uid_hex)
          LIMIT 1
        ) AS manifest_tag_lifecycle_state
      FROM sun_diagnostics d
      LEFT JOIN events e
        ON e.id = CASE
          WHEN d.result_json #>> '{raw_result,event_id}' ~ '^[1-9][0-9]*$'
          THEN (d.result_json #>> '{raw_result,event_id}')::bigint
          ELSE NULL
        END
       AND e.tenant_id = ${subBatch.tenant_id}::uuid
       AND e.batch_id = ${subBatch.batch_id}::uuid
      WHERE d.id = ANY(${diagnosticIds}::bigint[])
        AND d.tool_type = 'sun_scan'
    ` as SupplierQaDiagnosticRow[];
    const evidenceGate = validateSupplierQaSunEvidence({
      references: parsedReferences.references,
      diagnostics: diagnosticRows,
      expectedBid: String(subBatch.bid),
      expectedTenantId: String(subBatch.tenant_id),
      expectedBatchId: String(subBatch.batch_id),
      expectedQuantity: Number(subBatch.expected_quantity || 0),
      manifestHash: String(subBatch.manifest_hash || ""),
      carrierProfileCode: String(subBatch.carrier_profile_code || ""),
      keyFingerprint: String(subBatch.key_fingerprint || ""),
      carrierConfigDigest,
      verificationContextDigest,
      manifestImportedAt: String(subBatch.manifest_imported_at || ""),
      requiresTtstatus,
      requiresSecureSun,
    });
    if (!evidenceGate.ok) {
      const message = requiresTtstatus
        ? "QA requires ten distinct manifest UIDs with canonical SUN events, an event-linked replay for each, and one later electronically decoded TagTamper opening."
        : "QA requires ten distinct manifest UIDs with canonical SUN events and an event-linked replay for each. The server does not accept operator declarations.";
      return json({
        ok: false,
        reason: evidenceGate.reason,
        message,
        bid: subBatch.bid,
        required_manifest_uids: evidenceGate.requiredTags,
        received_manifest_uids: "receivedTags" in evidenceGate ? evidenceGate.receivedTags : undefined,
        carrier_profile_code: subBatch.carrier_profile_code,
        error_report: buildSupplierOpsErrorReport({
          stage: "qa",
          bid: String(subBatch.bid),
          reason: evidenceGate.reason,
          message,
          issues: [{
            code: evidenceGate.reason,
            field: "canonical_sun_evidence",
            value: `required_manifest_uids=${evidenceGate.requiredTags};received_manifest_uids=${"receivedTags" in evidenceGate ? evidenceGate.receivedTags : 0}`,
            detail: requiresTtstatus
              ? "Complete distinct valid scans, event-linked replays, and one later electronic TagTamper opening. This report does not attest physical presence."
              : "Complete distinct valid scans and event-linked replays. This report does not attest physical presence.",
          }],
        }),
      }, 409);
    }
    verifiedEvidence = evidenceGate;
    verifiedReferences = parsedReferences.references;
  } else if (passed && carrierQaSupported) {
    if (suppliedSnapshotUrls.length > 0) {
      return json({
        ok: false,
        reason: "qa_evidence_mode_conflict",
        message: "Static carrier QA accepts carrier_observations only. SUN snapshot references cannot prove QR, GS1 or static NFC encoding.",
      }, 400);
    }
    const observationUids = supplierCarrierQaObservationUids(suppliedCarrierObservations);
    const manifestRows = observationUids.length
      ? await sql/*sql*/`
          SELECT id::text AS id, upper(uid_hex) AS uid_hex
          FROM tags
          WHERE batch_id = ${subBatch.batch_id}::uuid
            AND upper(uid_hex) = ANY(${observationUids}::text[])
          ORDER BY upper(uid_hex), id
        ` as Array<{ id: string; uid_hex: string }>
      : [];
    const manifestTagIds = manifestRows.map((row) => String(row.id));
    const gs1Rows = carrierProfileCode === "gs1_digital_link" && manifestTagIds.length
      ? await sql/*sql*/`
          SELECT
            identity.id::text AS id,
            identity.tag_id::text AS tag_id,
            identity.gtin,
            identity.lot,
            identity.serial,
            identity.status
          FROM gs1_digital_link_identities identity
          JOIN gs1_gtin_prefix_entitlements entitlement
            ON entitlement.id = identity.entitlement_id
           AND entitlement.tenant_id = identity.tenant_id
           AND entitlement.status = 'active'
           AND identity.gtin LIKE entitlement.canonical_gtin_prefix || '%'
          WHERE identity.tenant_id = ${subBatch.tenant_id}::uuid
            AND identity.batch_id = ${subBatch.batch_id}::uuid
            AND identity.tag_id = ANY(${manifestTagIds}::uuid[])
            AND identity.status = 'active'
          ORDER BY identity.tag_id, identity.id
        ` as Array<Record<string, unknown>>
      : [];
    const evidenceGate = validateSupplierCarrierQaEvidence({
      observations: suppliedCarrierObservations,
      carrierProfileCode,
      expectedTenantId: subBatch.tenant_id,
      expectedTenantSlug: subBatch.tenant_slug,
      expectedBatchId: subBatch.batch_id,
      expectedBid: subBatch.bid,
      expectedQuantity: subBatch.expected_quantity,
      manifestHash: subBatch.manifest_hash,
      manifestImportedAt: subBatch.manifest_imported_at,
      carrierConfigDigest,
      verificationContextDigest,
      publicOrigin: resolveSupplierPublicTagOrigin(),
      manifestTags: manifestRows.map((row) => ({ id: String(row.id), uidHex: String(row.uid_hex) })),
      gs1Identities: gs1Rows.map((row) => ({
        id: String(row.id || ""),
        tagId: String(row.tag_id || ""),
        gtin: String(row.gtin || ""),
        lot: String(row.lot || ""),
        serial: String(row.serial || ""),
        status: String(row.status || ""),
      })),
      operationKey,
      checkedBy: actorEmail,
      notes,
      notesDigest,
      packPurpose: effectivePackPurpose,
      productionAcceptance: keylessProductionAcceptance,
    });
    if (!evidenceGate.ok) {
      const message = "QA requires distinct, recent carrier captures whose UID and exact encoded target match this imported manifest. Static carriers do not provide SUN, anti-replay or tamper proof.";
      return json({
        ok: false,
        reason: evidenceGate.reason,
        message,
        bid: subBatch.bid,
        required_manifest_uids: evidenceGate.requiredTags,
        received_manifest_uids: evidenceGate.receivedTags,
        carrier_profile_code: carrierProfileCode,
        server_verified_sun_evidence: false,
        cryptographic_authentication_verified: false,
        error_report: buildSupplierOpsErrorReport({
          stage: "qa",
          bid: String(subBatch.bid),
          reason: evidenceGate.reason,
          message,
          issues: [{
            code: evidenceGate.reason,
            field: "carrier_observations",
            value: `required_manifest_uids=${evidenceGate.requiredTags};received_manifest_uids=${evidenceGate.receivedTags}`,
            detail: "Submit uid_hex, encoded_url, captured_at and the carrier-specific capture_method. This validates carrier encoding only and never upgrades it to cryptographic NFC evidence.",
          }],
        }),
      }, 409);
    }
    verifiedCarrierEvidence = evidenceGate;
  }

  const status = passed ? "passed" : "failed";
  const sampleCount = verifiedEvidence?.sampleCount || verifiedCarrierEvidence?.sampleCount || 0;
  const replayChecked = verifiedEvidence?.replayChecked || false;
  const ttstatusChecked = verifiedEvidence?.ttstatusChecked || false;
  const evidenceDigest = verifiedEvidence?.evidenceDigest || verifiedCarrierEvidence?.evidenceDigest || hashEvidencePayload({
    schema_version: SUPPLIER_QA_SUN_EVIDENCE_VERSION,
    bid: String(subBatch.bid),
    status,
    rejected_by_actor_id: actor.id,
    operation_key: operationKey,
    notes_digest: notesDigest,
  });
  const evidence = verifiedCarrierEvidence
    ? verifiedCarrierEvidence.evidence
    : verifiedEvidence
      ? {
        ...verifiedEvidence.evidence,
        evidence_digest: evidenceDigest,
        requires_secure_sun: requiresSecureSun,
        pack_purpose: effectivePackPurpose,
        acceptance_scope: "trial_integration",
        commercial_disposition: "NON_SELLABLE",
        activation_allowed: false,
        operation_key: operationKey,
        notes_digest: notesDigest,
        notes,
        checked_by: actorEmail,
        }
      : {
        schema_version: SUPPLIER_QA_SUN_EVIDENCE_VERSION,
        evidence_source: "operator_rejection",
        server_verified_sun_evidence: false,
        physical_ceremony_verified: false,
        evidence_digest: evidenceDigest,
        requires_secure_sun: requiresSecureSun,
        pack_purpose: effectivePackPurpose,
        acceptance_scope: effectivePackPurpose === "production" ? "production_lot" : effectivePackPurpose,
        commercial_disposition: effectivePackPurpose === "production" ? "BLOCKED_PENDING_PRODUCTION_QA" : "NON_SELLABLE",
        activation_allowed: false,
        operation_key: operationKey,
        notes_digest: notesDigest,
        notes,
        checked_by: actorEmail,
      };

  let receipt;
  try {
    receipt = verifiedCarrierEvidence
      ? await commitSupplierCarrierQa({
          tenantId: String(subBatch.tenant_id),
          supplierOrderId: String(subBatch.supplier_order_id),
          supplierSubBatchId: String(subBatch.supplier_sub_batch_id),
          batchId: String(subBatch.batch_id),
          bid: String(subBatch.bid),
          sampleCount,
          notes,
          evidence,
          evidenceDigest,
          receiptRows: verifiedCarrierEvidence.receiptRows,
          operationKey,
          actorId: actor.id,
          authSessionId: actor.sessionId,
          actorEmail,
          expectedManifestHash: String(subBatch.manifest_hash || ""),
          expectedCarrierProfileCode: carrierProfileCode,
          expectedKeyFingerprint: String(subBatch.key_fingerprint || ""),
          expectedSdmConfig: batchSdmConfig,
          expectedVerificationContextDigest: verificationContextDigest,
          expectedVerificationContextBinding: verificationContext.binding,
          expectedVerificationContextCanonical: verificationContext.canonicalPayload,
          userAgent: req.headers.get("user-agent"),
          requestId: req.headers.get("x-request-id"),
        })
      : await commitSupplierQa({
          tenantId: String(subBatch.tenant_id),
          supplierOrderId: String(subBatch.supplier_order_id),
          supplierSubBatchId: String(subBatch.supplier_sub_batch_id),
          batchId: String(subBatch.batch_id),
          bid: String(subBatch.bid),
          status,
          sampleCount,
          replayChecked,
          ttstatusChecked,
          notes,
          evidence,
          evidenceDigest,
          diagnosticRefs: verifiedReferences.map((reference) => ({
            diagnostic_id: reference.diagnosticId,
            trace_id: reference.traceId,
            reference_hash: reference.referenceHash,
          })),
          operationKey,
          actorId: actor.id,
          actorEmail,
          expectedManifestHash: String(subBatch.manifest_hash || ""),
          expectedCarrierProfileCode: carrierProfileCode,
          expectedKeyFingerprint: String(subBatch.key_fingerprint || ""),
          expectedSdmConfig: batchSdmConfig,
          expectedVerificationContextDigest: verificationContextDigest,
          expectedVerificationContextBinding: verificationContext.binding,
          expectedVerificationContextCanonical: verificationContext.canonicalPayload,
          userAgent: req.headers.get("user-agent"),
          requestId: req.headers.get("x-request-id"),
        });
  } catch (error) {
    const failure = verifiedCarrierEvidence
      ? supplierCarrierQaCommitError(error)
      : supplierQaCommitError(error);
    return json({
      ok: false,
      reason: failure.reason,
      ...(failure.requiredMigration ? { required_migration: failure.requiredMigration } : {}),
    }, failure.status);
  }

  return json({
    ok: true,
    bid: subBatch.bid,
    qa_status: status,
    pack_purpose: effectivePackPurpose,
    acceptance_scope: effectivePackPurpose === "production" ? "production_lot" : effectivePackPurpose,
    commercial_disposition: effectivePackPurpose === "production" && passed
      ? "BLOCKED_PENDING_ACTIVATION"
      : effectivePackPurpose === "production"
        ? "BLOCKED_PENDING_PRODUCTION_QA"
        : "NON_SELLABLE",
    activation_allowed: false,
    activation_gate: passed
      ? effectivePackPurpose === "production"
        ? "production_keyless_qa_passed_pending_activation"
        : "trial_integration_non_sellable"
      : "blocked_until_qa_passed",
    qa_check_id: receipt.qaCheckId,
    evidence_hash: receipt.evidenceEventHash,
    evidence_digest: receipt.evidenceDigest,
    idempotent_replay: receipt.idempotentReplay,
    sample_count: sampleCount,
    evidence_schema_version: verifiedCarrierEvidence
      ? SUPPLIER_CARRIER_QA_EVIDENCE_VERSION
      : SUPPLIER_QA_SUN_EVIDENCE_VERSION,
    server_verified_sun_evidence: Boolean(verifiedEvidence),
    carrier_encoding_binding_verified: Boolean(verifiedCarrierEvidence),
    cryptographic_authentication_verified: Boolean(verifiedEvidence),
    anti_replay_verified: Boolean(verifiedEvidence?.replayChecked),
    physical_ceremony_verified: false,
    packaging_lab_approval_verified: Boolean(keylessProductionAcceptance),
    requires_secure_sun: requiresSecureSun,
    requires_ttstatus: requiresTtstatus,
  });
}
