import { sql } from "./db";

export const SUPPLIER_PACK_PURPOSE_GOVERNANCE_MIGRATION =
  "20260729143000_0071_supplier_pack_purpose_governance.sql";
export const LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION =
  "CLASSIFY_LEGACY_SUPPLIER_ORDER_AS_TRIAL";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export type LegacyTrialClassificationItem = {
  supplier_sub_batch_id: string;
  qa_check_id: string | null;
};

export type LegacyTrialClassificationInput = {
  tenantId: string;
  supplierOrderId: string;
  actorId: string;
  operationKey: string;
  reason: string;
  confirmation: typeof LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION;
  requestId: string;
  items: LegacyTrialClassificationItem[];
};

export type LegacyTrialClassificationReceipt = {
  decisionId: string;
  supplierOrderId: string;
  effectivePackPurpose: "trial_integration";
  scopeDigest: string;
  idempotentReplay: boolean;
};

export type LegacyTrialClassificationBodyResult =
  | {
      ok: true;
      reason: string;
      confirmation: typeof LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION;
    }
  | { ok: false; reason: string };

export function validLegacyTrialClassificationIdempotencyKey(value: unknown) {
  return IDEMPOTENCY_KEY_PATTERN.test(String(value || "").trim());
}

export function parseLegacyTrialClassificationBody(
  value: unknown,
): LegacyTrialClassificationBodyResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "supplier_pack_purpose_body_invalid" };
  }
  const body = value as Record<string, unknown>;
  const allowedFields = new Set(["reason", "confirmation"]);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    return { ok: false, reason: "supplier_pack_purpose_body_fields_invalid" };
  }
  if (typeof body.reason !== "string") {
    return { ok: false, reason: "supplier_pack_purpose_reason_invalid" };
  }
  const reason = body.reason.trim();
  const reasonLength = Array.from(reason).length;
  if (reasonLength < 16 || reasonLength > 1000) {
    return { ok: false, reason: "supplier_pack_purpose_reason_invalid" };
  }
  if (body.confirmation !== LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION) {
    return { ok: false, reason: "supplier_pack_purpose_confirmation_required" };
  }
  return {
    ok: true,
    reason,
    confirmation: LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION,
  };
}

export async function classifyLegacySupplierOrderTrial(
  input: LegacyTrialClassificationInput,
  query: typeof sql = sql,
): Promise<LegacyTrialClassificationReceipt> {
  const payload = {
    tenant_id: input.tenantId,
    supplier_order_id: input.supplierOrderId,
    actor_id: input.actorId,
    operation_key: input.operationKey,
    reason: input.reason,
    confirmation: input.confirmation,
    request_id: input.requestId,
    // These are trusted database projections assembled by the route. The HTTP
    // body never supplies classification scope or QA receipt identifiers.
    items: input.items,
  };
  const rows = await query/*sql*/`
    SELECT *
    FROM public.nexid_classify_legacy_supplier_order_trial_v1(${JSON.stringify(payload)}::jsonb)
  `;
  const row = rows[0];
  const decisionId = String(row?.decision_id || "").trim().toLowerCase();
  const supplierOrderId = String(row?.supplier_order_id || "").trim().toLowerCase();
  const effectivePackPurpose = String(row?.effective_pack_purpose || "").trim().toLowerCase();
  const scopeDigest = String(row?.scope_digest || "").trim().toLowerCase();
  if (
    !UUID_PATTERN.test(decisionId)
    || !UUID_PATTERN.test(supplierOrderId)
    || supplierOrderId !== input.supplierOrderId.toLowerCase()
    || effectivePackPurpose !== "trial_integration"
    || !SHA256_PATTERN.test(scopeDigest)
    || typeof row?.idempotent_replay !== "boolean"
  ) {
    throw new Error("supplier_pack_purpose_classification_readback_invalid");
  }
  return {
    decisionId,
    supplierOrderId,
    effectivePackPurpose: "trial_integration",
    scopeDigest,
    idempotentReplay: row.idempotent_replay,
  };
}

const BAD_INPUT_REASONS = new Set([
  "supplier_pack_purpose_confirmation_required",
  "supplier_pack_purpose_identity_invalid",
  "supplier_pack_purpose_identity_required",
  "supplier_pack_purpose_input_invalid",
  "supplier_pack_purpose_items_duplicate",
  "supplier_pack_purpose_items_invalid",
  "supplier_pack_purpose_operation_key_invalid",
  "supplier_pack_purpose_reason_invalid",
]);

const CONFLICT_REASONS = new Set([
  "supplier_pack_purpose_active_scope_forbidden",
  "supplier_pack_purpose_already_classified",
  "supplier_pack_purpose_idempotency_conflict",
  "supplier_pack_purpose_qa_receipt_mismatch",
  "supplier_pack_purpose_scope_enumeration_mismatch",
]);

export function legacyTrialClassificationError(error: unknown): {
  status: number;
  reason: string;
  requiredMigration?: string;
} {
  const code = String((error as { code?: unknown })?.code || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  const missingGovernanceObject = /does not exist|undefined/i.test(message)
    && /nexid_classify_legacy_supplier_order_trial_v1|supplier_pack_purpose_decisions|supplier_pack_purpose_decision_items/i.test(message);
  if (
    new Set(["42P01", "42703", "42883"]).has(code)
    || message.includes("required_schema_migration_not_applied")
    || missingGovernanceObject
  ) {
    return {
      status: 503,
      reason: "supplier_pack_purpose_governance_migration_required",
      requiredMigration: SUPPLIER_PACK_PURPOSE_GOVERNANCE_MIGRATION,
    };
  }
  const badInputReason = [...BAD_INPUT_REASONS].find((candidate) => message.includes(candidate));
  if (badInputReason) return { status: 400, reason: badInputReason };
  if (message.includes("supplier_pack_purpose_actor_scope_invalid")) {
    return { status: 403, reason: "supplier_pack_purpose_actor_scope_invalid" };
  }
  if (message.includes("supplier_order_not_found")) {
    return { status: 404, reason: "supplier_order_not_found" };
  }
  const conflictReason = [...CONFLICT_REASONS].find((candidate) => message.includes(candidate));
  if (conflictReason) return { status: 409, reason: conflictReason };
  return { status: 503, reason: "supplier_pack_purpose_classification_unavailable" };
}
