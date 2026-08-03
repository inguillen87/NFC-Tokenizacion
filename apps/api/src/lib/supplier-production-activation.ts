import { sql, type SqlExecutor } from "./db";

export const SUPPLIER_PRODUCTION_ACTIVATION_MIGRATION =
  "20260802090000_0076_supplier_production_activation_v2.sql";

export type SupplierProductionActivationReceiptV2 = {
  tenantId: string;
  supplierOrderId: string;
  supplierSubBatchId: string;
  batchId: string;
  bid: string;
  lotSize: number;
  qaPlanId: string;
  qaPlanDecisionId: string;
  productionSessionId: string;
  receiptId: string;
  qaCheckId: string;
  schemaVersion: "supplier-production-acceptance/v2";
  status: "passed";
  acceptanceContextDigest: string;
  decidedAt: string;
};

export type SupplierProductionActivationSelection =
  | { mode: "all" }
  | { mode: "count"; limit: number }
  | { mode: "uids"; uids: string[] }
  | { mode: "state_only" };

export type SupplierProductionActivationResult = {
  activationReceiptId: string;
  requestedCount: number;
  activatedCount: number;
  activatedUids: string[];
  remainingInactive: number;
  activationComplete: boolean;
  productionReceiptId: string;
  productionSessionId: string;
  evidenceEventHash: string;
  idempotentReplay: boolean;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function normalizedArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean);
  return [];
}

function exactText(value: unknown) {
  return String(value || "").trim();
}

export function supplierProductionActivationOperationKey(req: Request) {
  const value = exactText(req.headers.get("idempotency-key"));
  return IDEMPOTENCY_KEY_PATTERN.test(value) ? value : null;
}

export async function loadSupplierProductionActivationReceiptV2(input: {
  tenantId: string;
  supplierOrderId: string;
  supplierSubBatchId: string;
  batchId: string;
  bid: string;
  lotSize: number;
}, query: SqlExecutor = sql): Promise<SupplierProductionActivationReceiptV2 | null> {
  const rows = await query/*sql*/`
    SELECT
      receipt.tenant_id::text,
      receipt.supplier_order_id::text,
      receipt.supplier_sub_batch_id::text,
      receipt.batch_id::text,
      receipt.bid,
      receipt.lot_size,
      receipt.qa_plan_id::text,
      receipt.qa_plan_decision_id::text,
      receipt.production_session_id::text,
      receipt.production_receipt_id::text,
      receipt.qa_check_id::text,
      receipt.schema_version,
      receipt.receipt_status,
      receipt.acceptance_context_digest,
      receipt.decided_at
    FROM public.nexid_supplier_production_activation_receipt_v2(${input.batchId}::uuid) receipt
    WHERE receipt.tenant_id = ${input.tenantId}::uuid
      AND receipt.supplier_order_id = ${input.supplierOrderId}::uuid
      AND receipt.supplier_sub_batch_id = ${input.supplierSubBatchId}::uuid
      AND receipt.batch_id = ${input.batchId}::uuid
      AND upper(receipt.bid) = upper(${input.bid})
      AND receipt.lot_size = ${Math.trunc(input.lotSize)}
  `;
  if (rows.length !== 1) return null;
  const row = rows[0];
  const receipt: SupplierProductionActivationReceiptV2 = {
    tenantId: exactText(row.tenant_id),
    supplierOrderId: exactText(row.supplier_order_id),
    supplierSubBatchId: exactText(row.supplier_sub_batch_id),
    batchId: exactText(row.batch_id),
    bid: exactText(row.bid).toUpperCase(),
    lotSize: Number(row.lot_size || 0),
    qaPlanId: exactText(row.qa_plan_id),
    qaPlanDecisionId: exactText(row.qa_plan_decision_id),
    productionSessionId: exactText(row.production_session_id),
    receiptId: exactText(row.production_receipt_id),
    qaCheckId: exactText(row.qa_check_id),
    schemaVersion: "supplier-production-acceptance/v2",
    status: "passed",
    acceptanceContextDigest: exactText(row.acceptance_context_digest).toLowerCase(),
    decidedAt: exactText(row.decided_at),
  };
  if (
    row.schema_version !== receipt.schemaVersion
    || row.receipt_status !== receipt.status
    || !UUID_PATTERN.test(receipt.qaPlanId)
    || !UUID_PATTERN.test(receipt.qaPlanDecisionId)
    || !UUID_PATTERN.test(receipt.productionSessionId)
    || !UUID_PATTERN.test(receipt.receiptId)
    || !UUID_PATTERN.test(receipt.qaCheckId)
    || !SHA256_PATTERN.test(receipt.acceptanceContextDigest)
    || receipt.lotSize !== Math.trunc(input.lotSize)
  ) return null;
  return receipt;
}

export async function activateSupplierProductionTagsV2(input: {
  tenantId: string;
  supplierOrderId: string;
  supplierSubBatchId: string;
  batchId: string;
  bid: string;
  lotSize: number;
  actorId: string;
  authSessionId: string;
  operationKey: string;
  selection: SupplierProductionActivationSelection;
  requestId?: string | null;
}, query: SqlExecutor = sql): Promise<SupplierProductionActivationResult> {
  const selection = input.selection.mode === "uids"
    ? {
        selection_mode: "uids",
        limit: 0,
        uids: input.selection.uids.map((uid) => uid.trim().toUpperCase()).filter(Boolean),
      }
    : input.selection.mode === "count"
      ? { selection_mode: "count", limit: Math.trunc(input.selection.limit), uids: [] }
      : input.selection.mode === "state_only"
        ? { selection_mode: "state_only", limit: 0, uids: [] }
        : { selection_mode: "all", limit: 0, uids: [] };
  const payload = {
    tenant_id: input.tenantId,
    supplier_order_id: input.supplierOrderId,
    supplier_sub_batch_id: input.supplierSubBatchId,
    batch_id: input.batchId,
    bid: input.bid.trim().toUpperCase(),
    lot_size: Math.trunc(input.lotSize),
    actor_id: input.actorId,
    auth_session_id: input.authSessionId,
    operation_key: input.operationKey,
    request_id: exactText(input.requestId).slice(0, 160) || null,
    ...selection,
  };
  const rows = await query/*sql*/`
    SELECT *
    FROM public.nexid_activate_supplier_tags_v2(${JSON.stringify(payload)}::jsonb)
  `;
  if (rows.length !== 1) throw new Error("supplier_production_activation_receipt_missing");
  const row = rows[0];
  const result: SupplierProductionActivationResult = {
    activationReceiptId: exactText(row.activation_receipt_id),
    requestedCount: Number(row.requested_count || 0),
    activatedCount: Number(row.activated_count || 0),
    activatedUids: normalizedArray(row.activated_uids),
    remainingInactive: Number(row.remaining_inactive || 0),
    activationComplete: row.activation_complete === true,
    productionReceiptId: exactText(row.production_receipt_id),
    productionSessionId: exactText(row.production_session_id),
    evidenceEventHash: exactText(row.evidence_event_hash).toLowerCase(),
    idempotentReplay: row.idempotent_replay === true,
  };
  if (
    !UUID_PATTERN.test(result.activationReceiptId)
    || !Number.isInteger(result.requestedCount) || result.requestedCount < 0
    || !Number.isInteger(result.activatedCount) || result.activatedCount < 0
    || result.activatedCount > result.requestedCount
    || result.activatedUids.length !== result.activatedCount
    || !Number.isInteger(result.remainingInactive) || result.remainingInactive < 0
    || !UUID_PATTERN.test(result.productionReceiptId)
    || !UUID_PATTERN.test(result.productionSessionId)
    || !SHA256_PATTERN.test(result.evidenceEventHash)
  ) throw new Error("supplier_production_activation_receipt_invalid");
  return result;
}

export function supplierProductionActivationDatabaseReason(error: unknown) {
  const source = error && typeof error === "object"
    ? `${String((error as { code?: unknown }).code || "")} ${String((error as { message?: unknown }).message || "")}`
    : String(error || "");
  const known = [
    "supplier_production_acceptance_v2_required",
    "supplier_commercial_scope_invalid",
    "supplier_pack_purpose_unclassified",
    "supplier_trial_integration_non_sellable",
    "supplier_production_activation_actor_scope_invalid",
    "supplier_production_activation_idempotency_conflict",
    "supplier_production_activation_tags_incomplete",
    "supplier_production_activation_uids_duplicate",
    "supplier_production_activation_uids_not_activatable",
  ];
  return known.find((reason) => source.includes(reason)) || null;
}
