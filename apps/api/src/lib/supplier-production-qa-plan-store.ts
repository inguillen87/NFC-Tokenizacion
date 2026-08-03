import { sql, type SqlExecutor } from "./db";

export const SUPPLIER_PRODUCTION_QA_PLAN_APPROVAL_PERMISSION =
  "qa.plan.approve" as const;

export type SupplierProductionQaStoredPlan = {
  id: string;
  operation_key: string;
  tenant_id: string;
  supplier_order_id: string;
  supplier_sub_batch_id: string;
  batch_id: string;
  bid: string;
  revision: number;
  lot_size: number;
  inspection_level: string;
  target_aql: number;
  sample_size: number;
  accept_number: number;
  reject_number: number;
  policy_reference: string;
  policy_document_sha256: string;
  stratification_dimension: "roll_id" | "case_id" | "pallet_id";
  cryptographic_sample_size: number;
  plan_binding: Record<string, unknown>;
  plan_canonical: string;
  plan_digest: string;
  submitted_by: string;
  submitted_at: string;
  decision_id: string | null;
  decision_status: "approved" | "rejected" | null;
  decision_reason: string | null;
  approval_evidence_ref: string | null;
  approval_evidence_sha256: string | null;
  decided_by: string | null;
  approver_email: string | null;
  decided_at: string | null;
};

export type SubmitSupplierProductionQaPlanInput = {
  planId: string;
  tenantId: string;
  supplierOrderId: string;
  supplierSubBatchId: string;
  batchId: string;
  bid: string;
  operationKey: string;
  revision: number;
  lotSize: number;
  inspectionLevel: string;
  targetAql: number;
  sampleSize: number;
  acceptNumber: number;
  rejectNumber: number;
  policyReference: string;
  policyDocumentSha256: string;
  stratificationDimension: "roll_id" | "case_id" | "pallet_id";
  cryptographicSampleSize: number;
  planBinding: Record<string, unknown>;
  planCanonical: string;
  planDigest: string;
  actorId: string;
  authSessionId: string;
  requestId: string | null;
};

export type DecideSupplierProductionQaPlanInput = {
  decisionId: string;
  planId: string;
  tenantId: string;
  operationKey: string;
  decisionStatus: "approved" | "rejected";
  reason: string;
  approvalEvidenceRef: string;
  approvalEvidenceSha256: string;
  planDigest: string;
  actorId: string;
  authSessionId: string;
  requestId: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

function normalizePlan(row: Record<string, unknown>): SupplierProductionQaStoredPlan {
  return {
    ...(row as unknown as SupplierProductionQaStoredPlan),
    id: String(row.id || ""),
    operation_key: String(row.operation_key || ""),
    tenant_id: String(row.tenant_id || ""),
    supplier_order_id: String(row.supplier_order_id || ""),
    supplier_sub_batch_id: String(row.supplier_sub_batch_id || ""),
    batch_id: String(row.batch_id || ""),
    bid: String(row.bid || ""),
    revision: Number(row.revision || 0),
    lot_size: Number(row.lot_size || 0),
    target_aql: Number(row.target_aql),
    sample_size: Number(row.sample_size || 0),
    accept_number: Number(row.accept_number || 0),
    reject_number: Number(row.reject_number || 0),
    cryptographic_sample_size: Number(row.cryptographic_sample_size || 0),
    submitted_at: String(row.submitted_at || ""),
    decision_id: row.decision_id ? String(row.decision_id) : null,
    decision_status: row.decision_status === "approved" || row.decision_status === "rejected"
      ? row.decision_status
      : null,
    decision_reason: row.decision_reason ? String(row.decision_reason) : null,
    approval_evidence_ref: row.approval_evidence_ref ? String(row.approval_evidence_ref) : null,
    approval_evidence_sha256: row.approval_evidence_sha256
      ? String(row.approval_evidence_sha256)
      : null,
    decided_by: row.decided_by ? String(row.decided_by) : null,
    approver_email: row.approver_email ? String(row.approver_email) : null,
    decided_at: row.decided_at ? String(row.decided_at) : null,
  };
}

export async function listSupplierProductionQaPlans(input: {
  tenantId: string;
  supplierOrderId: string;
  bid?: string | null;
}, query: SqlExecutor = sql) {
  const rows = await query/*sql*/`
    SELECT
      plan_row.*,
      decision_row.id AS decision_id,
      decision_row.decision_status,
      decision_row.reason AS decision_reason,
      decision_row.approval_evidence_ref,
      decision_row.approval_evidence_sha256,
      decision_row.decided_by,
      lower(approver.email) AS approver_email,
      decision_row.decided_at::text AS decided_at,
      plan_row.submitted_at::text AS submitted_at
    FROM supplier_production_qa_plans plan_row
    LEFT JOIN supplier_production_qa_plan_decisions decision_row ON decision_row.plan_id = plan_row.id
    LEFT JOIN users approver ON approver.id = decision_row.decided_by
    WHERE plan_row.tenant_id = ${input.tenantId}::uuid
      AND plan_row.supplier_order_id = ${input.supplierOrderId}::uuid
      AND (${input.bid || null}::text IS NULL OR upper(plan_row.bid) = upper(${input.bid || null}))
    ORDER BY plan_row.revision DESC, plan_row.submitted_at DESC, plan_row.id DESC
    LIMIT 50
  `;
  return rows.map(normalizePlan);
}

export async function submitSupplierProductionQaPlan(
  input: SubmitSupplierProductionQaPlanInput,
  query: SqlExecutor = sql,
) {
  const payload = {
    plan_id: input.planId,
    tenant_id: input.tenantId,
    supplier_order_id: input.supplierOrderId,
    supplier_sub_batch_id: input.supplierSubBatchId,
    batch_id: input.batchId,
    bid: input.bid,
    schema_version: "supplier-production-qa-plan/v1",
    operation_key: input.operationKey,
    revision: input.revision,
    lot_size: input.lotSize,
    inspection_level: input.inspectionLevel,
    target_aql: input.targetAql,
    sample_size: input.sampleSize,
    accept_number: input.acceptNumber,
    reject_number: input.rejectNumber,
    policy_reference: input.policyReference,
    policy_document_sha256: input.policyDocumentSha256,
    stratification_dimension: input.stratificationDimension,
    cryptographic_sample_size: input.cryptographicSampleSize,
    plan_binding: input.planBinding,
    plan_canonical: input.planCanonical,
    plan_digest: input.planDigest,
    actor_id: input.actorId,
    auth_session_id: input.authSessionId,
    request_id: input.requestId,
  };
  const rows = await query/*sql*/`
    SELECT * FROM public.nexid_submit_supplier_production_qa_plan_v1(${JSON.stringify(payload)}::jsonb)
  `;
  const row = rows[0];
  const receipt = {
    planId: String(row?.plan_id || ""),
    revision: Number(row?.plan_revision || 0),
    planDigest: String(row?.plan_digest || ""),
    submittedAt: String(row?.submitted_at || ""),
    idempotentReplay: row?.idempotent_replay === true,
  };
  if (!UUID_PATTERN.test(receipt.planId)
    || !Number.isSafeInteger(receipt.revision) || receipt.revision < 1
    || !SHA256_PATTERN.test(receipt.planDigest)
    || !Number.isFinite(Date.parse(receipt.submittedAt))) {
    throw new Error("supplier_production_qa_plan_readback_invalid");
  }
  return receipt;
}

export async function decideSupplierProductionQaPlan(
  input: DecideSupplierProductionQaPlanInput,
  query: SqlExecutor = sql,
) {
  const payload = {
    decision_id: input.decisionId,
    plan_id: input.planId,
    tenant_id: input.tenantId,
    operation_key: input.operationKey,
    decision_status: input.decisionStatus,
    reason: input.reason,
    approval_evidence_ref: input.approvalEvidenceRef,
    approval_evidence_sha256: input.approvalEvidenceSha256,
    plan_digest: input.planDigest,
    actor_id: input.actorId,
    auth_session_id: input.authSessionId,
    request_id: input.requestId,
  };
  const rows = await query/*sql*/`
    SELECT * FROM public.nexid_decide_supplier_production_qa_plan_v1(${JSON.stringify(payload)}::jsonb)
  `;
  const row = rows[0];
  const receipt = {
    decisionId: String(row?.decision_id || ""),
    decisionStatus: String(row?.decision_status || ""),
    decidedAt: String(row?.decided_at || ""),
    idempotentReplay: row?.idempotent_replay === true,
  };
  if (!UUID_PATTERN.test(receipt.decisionId)
    || !new Set(["approved", "rejected"]).has(receipt.decisionStatus)
    || !Number.isFinite(Date.parse(receipt.decidedAt))) {
    throw new Error("supplier_production_qa_plan_decision_readback_invalid");
  }
  return receipt as typeof receipt & { decisionStatus: "approved" | "rejected" };
}
