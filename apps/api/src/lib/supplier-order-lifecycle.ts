import { sql } from "./db";
import { auditFreeformValuesAreSafe } from "./audit-freeform-secret-policy";

export const SUPPLIER_ORDER_LIFECYCLE_MIGRATION =
  "20260802210000_0086_supplier_order_lifecycle.sql";

export const SUPPLIER_ORDER_LIFECYCLE_CHANNELS = [
  "secure_transfer",
  "tenant_portal",
  "courier",
  "email_notice",
  "in_person",
  "other",
] as const;

export type SupplierOrderLifecycleTransition = "mark_sent" | "record_tenant_handover";

export type SupplierOrderLifecycleReceipt = {
  id: string;
  supplier_order_id: string;
  transition: SupplierOrderLifecycleTransition;
  from_status: string;
  to_status: string;
  pack_purpose: "trial_integration" | "production";
  event_hash: string;
  created_at: string;
  idempotent_replay: boolean;
  tenant_acceptance_claimed: false;
  physical_handover_verified: false;
  qa_override: false;
  activation_override: false;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function validSupplierOrderLifecycleOperationKey(value: unknown) {
  return /^[A-Za-z0-9._:-]{8,128}$/.test(String(value || "").trim());
}

export async function hasSupplierOrderLifecycleV1(query = sql) {
  const rows = await query/*sql*/`
    SELECT
      to_regclass('public.supplier_order_lifecycle_receipts') IS NOT NULL
      AND to_regprocedure('public.nexid_transition_supplier_order_v1(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_order_lifecycle_v1_capability()') IS NOT NULL
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_transition_supplier_order_v1(jsonb)'),
        'EXECUTE'
      ), false) AS ready
  `;
  return rows.length === 1 && rows[0]?.ready === true;
}

export async function transitionSupplierOrderLifecycleV1(input: {
  supplierOrderId: string;
  transition: SupplierOrderLifecycleTransition;
  operationKey: string;
  recipientRef: string;
  deliveryChannel: typeof SUPPLIER_ORDER_LIFECYCLE_CHANNELS[number];
  evidenceRef: string;
  reason: string;
  actorId: string;
  authSessionId: string;
  requestId?: string | null;
  userAgent?: string | null;
}, query = sql): Promise<SupplierOrderLifecycleReceipt> {
  if (!auditFreeformValuesAreSafe([input.recipientRef, input.evidenceRef, input.reason])) {
    throw new Error("supplier_order_lifecycle_sensitive_audit_input_rejected");
  }
  const payload = {
    supplier_order_id: input.supplierOrderId,
    transition: input.transition,
    operation_key: input.operationKey,
    recipient_ref: input.recipientRef,
    delivery_channel: input.deliveryChannel,
    evidence_ref: input.evidenceRef,
    reason: input.reason,
    actor_id: input.actorId,
    auth_session_id: input.authSessionId,
    request_id: input.requestId || null,
    user_agent: input.userAgent || null,
  };
  const rows = await query/*sql*/`
    SELECT public.nexid_transition_supplier_order_v1(${JSON.stringify(payload)}::jsonb) AS receipt
  `;
  const receipt = rows[0]?.receipt as SupplierOrderLifecycleReceipt | undefined;
  if (!receipt
    || !UUID_PATTERN.test(String(receipt.id || ""))
    || !UUID_PATTERN.test(String(receipt.supplier_order_id || ""))
    || !SHA256_PATTERN.test(String(receipt.event_hash || ""))
    || !["mark_sent", "record_tenant_handover"].includes(String(receipt.transition || ""))
    || receipt.tenant_acceptance_claimed !== false
    || receipt.physical_handover_verified !== false
    || receipt.qa_override !== false
    || receipt.activation_override !== false) {
    throw new Error("supplier_order_lifecycle_readback_invalid");
  }
  return receipt;
}

const BAD_INPUT_REASONS = [
  "supplier_order_lifecycle_input_invalid",
  "supplier_order_lifecycle_identity_invalid",
  "supplier_order_lifecycle_payload_invalid",
  "supplier_order_lifecycle_sensitive_audit_input_rejected",
];

const CONFLICT_REASONS = [
  "supplier_binding_required",
  "supplier_binding_spec_changed",
  "supplier_binding_recipient_mismatch",
  "supplier_binding_receipt_invalid",
  "supplier_order_lifecycle_idempotency_conflict",
  "supplier_order_lifecycle_transition_already_recorded",
  "supplier_order_lifecycle_pack_purpose_invalid",
  "supplier_order_lifecycle_sub_batches_required",
  "supplier_order_mark_sent_state_invalid",
  "supplier_order_mark_sent_export_receipt_required",
  "supplier_order_handover_dispatch_receipt_required",
  "supplier_order_handover_qa_gate_required",
  "supplier_order_handover_activation_complete_required",
  "supplier_order_handover_trial_must_remain_inactive",
  "supplier_order_lifecycle_state_changed",
];

export function supplierOrderLifecycleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  const badInput = BAD_INPUT_REASONS.find((reason) => message.includes(reason));
  if (badInput) return { status: 400, reason: badInput };
  if (message.includes("supplier_order_lifecycle_actor_scope_invalid")) {
    return { status: 403, reason: "supplier_order_lifecycle_forbidden" };
  }
  if (message.includes("supplier_order_lifecycle_order_not_found") || code === "P0002") {
    return { status: 404, reason: "supplier_order_not_found" };
  }
  const conflict = CONFLICT_REASONS.find((reason) => message.includes(reason));
  if (conflict || code === "23505" || code === "40001") {
    return { status: 409, reason: conflict || "supplier_order_lifecycle_conflict" };
  }
  if (message.includes("nexid_transition_supplier_order_v1")
    || message.includes("nexid_supplier_order_lifecycle_v1_capability")
    || code === "42883" || code === "42P01") {
    return {
      status: 503,
      reason: "supplier_order_lifecycle_migration_required",
      requiredMigration: SUPPLIER_ORDER_LIFECYCLE_MIGRATION,
    };
  }
  return { status: 503, reason: "supplier_order_lifecycle_unavailable" };
}
