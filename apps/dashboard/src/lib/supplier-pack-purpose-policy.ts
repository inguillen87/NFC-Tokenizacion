export type SupplierPackPurpose = "" | "trial_integration" | "production" | "legacy_unclassified";

export const LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION =
  "CLASSIFY_LEGACY_SUPPLIER_ORDER_AS_TRIAL";

export function resolveSupplierPackPurpose(input: {
  declaredPackPurpose?: unknown;
  effectivePackPurpose?: unknown;
}): Exclude<SupplierPackPurpose, ""> {
  const purpose = String(input.effectivePackPurpose || input.declaredPackPurpose || "")
    .trim()
    .toLowerCase();
  if (purpose === "trial_integration" || purpose === "production") return purpose;
  return "legacy_unclassified";
}

export function normalizeLegacyTrialClassificationReason(value: unknown) {
  const reason = typeof value === "string" ? value.trim() : "";
  const length = Array.from(reason).length;
  return {
    reason,
    length,
    valid: length >= 16 && length <= 1000,
  };
}

export function legacyTrialClassificationAttemptSignature(input: {
  supplierOrderId: string;
  reason: string;
  confirmation: string;
}) {
  return JSON.stringify({
    supplier_order_id: input.supplierOrderId,
    reason: input.reason,
    confirmation: input.confirmation,
  });
}
