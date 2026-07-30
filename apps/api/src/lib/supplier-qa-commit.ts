import { sql } from "./db";

export const SUPPLIER_QA_ATOMIC_MIGRATION = "20260729130000_0070_supplier_qa_atomic_receipts.sql";
export const SUPPLIER_QA_VERIFICATION_CONTEXT_V2_MIGRATION =
  "20260730110000_0073_supplier_qa_verification_context_v2.sql";

export type SupplierQaCommitInput = {
  tenantId: string;
  supplierOrderId: string;
  supplierSubBatchId: string;
  batchId: string;
  bid: string;
  status: "passed" | "failed";
  sampleCount: number;
  replayChecked: boolean;
  ttstatusChecked: boolean;
  notes: string | null;
  evidence: Record<string, unknown>;
  evidenceDigest: string;
  diagnosticRefs: Array<{
    diagnostic_id: number;
    trace_id: string;
    reference_hash: string;
  }>;
  operationKey: string;
  actorId: string;
  actorEmail: string;
  expectedManifestHash: string;
  expectedCarrierProfileCode: string;
  expectedKeyFingerprint: string;
  expectedSdmConfig: Record<string, unknown>;
  expectedVerificationContextDigest: string;
  expectedVerificationContextBinding: Record<string, unknown>;
  expectedVerificationContextCanonical: string;
  userAgent: string | null;
  requestId: string | null;
};

export type SupplierQaCommitReceipt = {
  qaCheckId: string;
  status: "passed" | "failed";
  evidenceDigest: string;
  evidenceEventHash: string;
  idempotentReplay: boolean;
};

export function validSupplierQaIdempotencyKey(value: unknown) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(String(value || "").trim());
}

/**
 * Rolling-safe feature probe. Every referenced object is resolved by name so a
 * pre-0071/pre-0073 database returns false instead of failing while parsing a
 * query that mentions newer tables or columns.
 */
export async function hasSupplierQaVerificationContextV2(query: typeof sql = sql) {
  const rows = await query/*sql*/`
    SELECT
      to_regprocedure('public.nexid_commit_supplier_qa_v2(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_qa_verification_context_v2_capability()') IS NOT NULL
      AND to_regclass('public.supplier_qa_verification_context_receipts') IS NOT NULL
      AND to_regclass('public.supplier_pack_purpose_decisions') IS NOT NULL
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_commit_supplier_qa_v2(jsonb)'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_supplier_qa_canonical_json_v2(jsonb)'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_table_privilege(
        current_user,
        to_regclass('public.supplier_qa_verification_context_receipts'),
        'SELECT,INSERT'
      ), false)
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'supplier_orders'
          AND column_name = 'pack_purpose'
      ) AS available
  `;
  return rows[0]?.available === true;
}

export async function commitSupplierQa(
  input: SupplierQaCommitInput,
  query: typeof sql = sql,
): Promise<SupplierQaCommitReceipt> {
  const payload = {
    tenant_id: input.tenantId,
    supplier_order_id: input.supplierOrderId,
    supplier_sub_batch_id: input.supplierSubBatchId,
    batch_id: input.batchId,
    bid: input.bid,
    status: input.status,
    sample_count: input.sampleCount,
    replay_checked: input.replayChecked,
    ttstatus_checked: input.ttstatusChecked,
    notes: input.notes,
    evidence_json: input.evidence,
    evidence_digest: input.evidenceDigest,
    diagnostic_refs: input.diagnosticRefs,
    operation_key: input.operationKey,
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    expected_manifest_hash: input.expectedManifestHash,
    expected_carrier_profile_code: input.expectedCarrierProfileCode,
    expected_key_fingerprint: input.expectedKeyFingerprint,
    expected_sdm_config: input.expectedSdmConfig,
    expected_verification_context_digest: input.expectedVerificationContextDigest,
    expected_verification_context_binding: input.expectedVerificationContextBinding,
    expected_verification_context_canonical: input.expectedVerificationContextCanonical,
    user_agent: input.userAgent,
    request_id: input.requestId,
  };
  const rows = await query/*sql*/`
    SELECT *
    FROM public.nexid_commit_supplier_qa_v2(${JSON.stringify(payload)}::jsonb)
  `;
  const row = rows[0];
  if (!row) throw new Error("supplier_qa_atomic_commit_readback_failed");
  const status = String(row.qa_status || "").trim().toLowerCase();
  if (status !== "passed" && status !== "failed") {
    throw new Error("supplier_qa_atomic_commit_readback_invalid");
  }
  return {
    qaCheckId: String(row.qa_check_id || ""),
    status,
    evidenceDigest: String(row.evidence_digest || ""),
    evidenceEventHash: String(row.evidence_event_hash || ""),
    idempotentReplay: row.idempotent_replay === true,
  };
}

const CONFLICT_REASONS = new Set([
  "supplier_qa_already_passed",
  "supplier_qa_batch_state_changed",
  "supplier_qa_carrier_profile_scope_mismatch",
  "supplier_qa_diagnostic_context_changed",
  "supplier_qa_evidence_references_invalid",
  "supplier_qa_evidence_references_mismatch",
  "supplier_qa_factory_release_evidence_required",
  "supplier_qa_idempotency_key_conflict",
  "supplier_qa_legacy_context_receipt_unbound",
  "supplier_qa_manifest_required",
  "supplier_qa_pre_release_state_required",
  "supplier_qa_server_evidence_required",
  "supplier_qa_snapshot_already_consumed",
  "supplier_qa_sub_batch_state_changed",
  "supplier_qa_verification_context_changed",
  "supplier_qa_verified_sample_required",
]);

const BAD_INPUT_REASONS = new Set([
  "supplier_qa_actor_invalid",
  "supplier_qa_decision_invalid",
  "supplier_qa_diagnostic_refs_duplicate",
  "supplier_qa_diagnostic_refs_invalid",
  "supplier_qa_digest_invalid",
  "supplier_qa_evidence_envelope_invalid",
  "supplier_qa_idempotency_key_invalid",
  "supplier_qa_identity_invalid",
  "supplier_qa_input_invalid",
  "supplier_qa_notes_too_long",
  "supplier_qa_payload_invalid",
  "supplier_qa_rejection_evidence_invalid",
  "supplier_qa_sample_count_invalid",
  "supplier_qa_verification_context_v2_invalid",
]);

export function supplierQaCommitError(error: unknown): {
  status: number;
  reason: string;
  requiredMigration?: string;
} {
  const code = String((error as { code?: unknown })?.code || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  const knownReason = [...CONFLICT_REASONS, ...BAD_INPUT_REASONS]
    .find((candidate) => message.includes(candidate));
  if (knownReason && CONFLICT_REASONS.has(knownReason)) return { status: 409, reason: knownReason };
  if (knownReason && BAD_INPUT_REASONS.has(knownReason)) return { status: 400, reason: knownReason };
  if (message.includes("supplier_qa_scope_not_found")) return { status: 404, reason: "supplier_qa_scope_not_found" };
  if (
    message.includes("nexid_commit_supplier_qa_v1")
    || message.includes("supplier_qa_diagnostic_consumptions")
  ) {
    return {
      status: 503,
      reason: "supplier_qa_atomic_migration_required",
      requiredMigration: SUPPLIER_QA_ATOMIC_MIGRATION,
    };
  }
  if (
    code === "42P01"
    || code === "42703"
    || code === "42883"
    || message.includes("nexid_commit_supplier_qa_v2")
    || message.includes("nexid_supplier_qa_verification_context_v2")
    || message.includes("supplier_qa_verification_context_receipts")
    || message.includes("supplier_pack_purpose_decisions")
  ) {
    return {
      status: 503,
      reason: "supplier_qa_verification_context_v2_migration_required",
      requiredMigration: SUPPLIER_QA_VERIFICATION_CONTEXT_V2_MIGRATION,
    };
  }
  return { status: 503, reason: "supplier_qa_atomic_commit_unavailable" };
}
