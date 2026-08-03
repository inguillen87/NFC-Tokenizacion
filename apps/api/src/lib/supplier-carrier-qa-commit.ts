import { sql } from "./db";
import { auditFreeformValuesAreSafe } from "./audit-freeform-secret-policy";
import {
  SUPPLIER_CARRIER_QA_MIGRATION,
  type SupplierCarrierQaReceiptRow,
} from "./supplier-carrier-qa-evidence";

export type SupplierCarrierQaCommitInput = {
  tenantId: string;
  supplierOrderId: string;
  supplierSubBatchId: string;
  batchId: string;
  bid: string;
  sampleCount: number;
  notes: string | null;
  evidence: Record<string, unknown>;
  evidenceDigest: string;
  receiptRows: SupplierCarrierQaReceiptRow[];
  operationKey: string;
  actorId: string;
  authSessionId: string;
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

export type SupplierCarrierQaCommitReceipt = {
  qaCheckId: string;
  status: "passed";
  evidenceDigest: string;
  evidenceEventHash: string;
  idempotentReplay: boolean;
};

/** Rolling-safe: this query resolves every post-0085 object by name. */
export async function hasSupplierCarrierQaV1(query: typeof sql = sql) {
  const rows = await query/*sql*/`
    SELECT
      to_regprocedure('public.nexid_commit_supplier_carrier_qa_v1(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_carrier_qa_v1_capability()') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_keyless_qa_activation_v1_capability()') IS NOT NULL
      AND to_regclass('public.supplier_qa_carrier_evidence_receipts') IS NOT NULL
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_commit_supplier_carrier_qa_v1(jsonb)'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_table_privilege(
        current_user,
        to_regclass('public.supplier_qa_carrier_evidence_receipts'),
        'SELECT,INSERT'
      ), false) AS available
  `;
  return rows[0]?.available === true;
}

export async function commitSupplierCarrierQa(
  input: SupplierCarrierQaCommitInput,
  query: typeof sql = sql,
): Promise<SupplierCarrierQaCommitReceipt> {
  if (!auditFreeformValuesAreSafe([input.notes])) {
    throw new Error("supplier_carrier_qa_sensitive_audit_input_rejected");
  }
  const payload = {
    tenant_id: input.tenantId,
    supplier_order_id: input.supplierOrderId,
    supplier_sub_batch_id: input.supplierSubBatchId,
    batch_id: input.batchId,
    bid: input.bid,
    status: "passed",
    sample_count: input.sampleCount,
    replay_checked: false,
    ttstatus_checked: false,
    notes: input.notes,
    evidence_json: input.evidence,
    evidence_digest: input.evidenceDigest,
    carrier_evidence_rows: input.receiptRows,
    operation_key: input.operationKey,
    actor_id: input.actorId,
    auth_session_id: input.authSessionId,
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
    FROM public.nexid_commit_supplier_carrier_qa_v1(${JSON.stringify(payload)}::jsonb)
  `;
  const row = rows[0];
  if (!row) throw new Error("supplier_carrier_qa_atomic_commit_readback_failed");
  if (String(row.qa_status || "").trim().toLowerCase() !== "passed") {
    throw new Error("supplier_carrier_qa_atomic_commit_readback_invalid");
  }
  return {
    qaCheckId: String(row.qa_check_id || ""),
    status: "passed",
    evidenceDigest: String(row.evidence_digest || ""),
    evidenceEventHash: String(row.evidence_event_hash || ""),
    idempotentReplay: row.idempotent_replay === true,
  };
}

const CONFLICT_REASONS = new Set([
  "supplier_carrier_qa_already_passed",
  "supplier_carrier_qa_batch_state_changed",
  "supplier_carrier_qa_carrier_profile_scope_mismatch",
  "supplier_carrier_qa_evidence_binding_changed",
  "supplier_carrier_qa_factory_release_evidence_required",
  "supplier_carrier_qa_gs1_registry_binding_invalid",
  "supplier_carrier_qa_idempotency_key_conflict",
  "supplier_carrier_qa_manifest_required",
  "supplier_carrier_qa_pre_release_state_required",
  "supplier_carrier_qa_sub_batch_state_changed",
  "supplier_carrier_qa_tag_binding_invalid",
  "supplier_carrier_qa_verification_context_changed",
]);

const BAD_INPUT_REASONS = new Set([
  "supplier_carrier_qa_actor_invalid",
  "supplier_carrier_qa_carrier_unsupported",
  "supplier_carrier_qa_digest_invalid",
  "supplier_carrier_qa_evidence_envelope_invalid",
  "supplier_carrier_qa_evidence_rows_invalid",
  "supplier_carrier_qa_idempotency_key_invalid",
  "supplier_carrier_qa_identity_invalid",
  "supplier_carrier_qa_input_invalid",
  "supplier_carrier_qa_notes_too_long",
  "supplier_carrier_qa_payload_invalid",
  "supplier_carrier_qa_sample_count_invalid",
  "supplier_carrier_qa_sensitive_audit_input_rejected",
  "supplier_carrier_qa_verification_context_invalid",
]);

export function supplierCarrierQaCommitError(error: unknown): {
  status: number;
  reason: string;
  requiredMigration?: string;
} {
  const code = String((error as { code?: unknown })?.code || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  const knownReason = [...CONFLICT_REASONS, ...BAD_INPUT_REASONS].find((candidate) => message.includes(candidate));
  if (knownReason && CONFLICT_REASONS.has(knownReason)) return { status: 409, reason: knownReason };
  if (knownReason && BAD_INPUT_REASONS.has(knownReason)) return { status: 400, reason: knownReason };
  if (message.includes("supplier_carrier_qa_scope_not_found")) {
    return { status: 404, reason: "supplier_carrier_qa_scope_not_found" };
  }
  if (
    code === "42P01"
    || code === "42703"
    || code === "42883"
    || message.includes("nexid_commit_supplier_carrier_qa_v1")
    || message.includes("nexid_supplier_carrier_qa_v1_capability")
    || message.includes("supplier_qa_carrier_evidence_receipts")
  ) {
    return {
      status: 503,
      reason: "supplier_carrier_qa_migration_required",
      requiredMigration: SUPPLIER_CARRIER_QA_MIGRATION,
    };
  }
  return { status: 503, reason: "supplier_carrier_qa_atomic_commit_unavailable" };
}
