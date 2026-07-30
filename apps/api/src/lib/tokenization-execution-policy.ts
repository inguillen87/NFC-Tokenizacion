export const TOKENIZATION_EXECUTION_GOVERNANCE_MIGRATION =
  "20260729160000_0072_tokenization_marketplace_execution_governance.sql";

export type TokenizationExecutionClass =
  | "legacy_unclassified"
  | "simulation"
  | "testnet_trial"
  | "live_chain";
export type TokenizationExecutionDisposition =
  | "acquired"
  | "lease_replay"
  | "busy"
  | "reconcile_required"
  | "already_final"
  | "simulation_only";

export type TokenizationFailurePhase = "pre_external" | "external_started";

export type TokenizationFailurePolicy = {
  status: "blocked" | "reconciling";
  reason: string;
  retryable: false;
};

const SAFE_PRE_EXTERNAL_REASONS = new Set([
  "executor_required_in_production",
  "executor_required_for_live_chain",
  "executor_secret_required_in_production",
  "executor_secret_required_for_live_chain",
  "executor_url_invalid",
  "executor_https_required_in_production",
  "invalid_POLYGON_CONTRACT_ADDRESS",
  "missing_POLYGON_MINTER_PRIVATE_KEY_for_direct_minter",
  "missing_POLYGON_RPC_URL_for_local_minter",
  "polygon_anchor_expected_recipient_invalid",
  "polygon_anchor_metadata_binding_invalid",
  "polygon_anchor_network_mismatch",
  "polygon_anchor_token_uri_invalid",
  "polygon_anchor_unavailable_configure_local_minter_or_executor",
  "polygon_anchor_verification_unavailable",
  "polygon_exportable_signer_forbidden_in_production_use_executor",
]);

export function tokenizationFailurePolicy(
  error: unknown,
  phase: TokenizationFailurePhase,
): TokenizationFailurePolicy {
  // Once an external executor/RPC call begins, failure cannot prove that no
  // transaction was broadcast. The request must be reconciled and must never
  // be put back on the automatic-send queue.
  if (phase === "external_started") {
    return {
      status: "reconciling",
      reason: "tokenization_execution_reconciliation_required",
      retryable: false,
    };
  }

  const message = error instanceof Error ? error.message : "";
  return {
    status: "blocked",
    reason: SAFE_PRE_EXTERNAL_REASONS.has(message)
      ? message
      : "tokenization_execution_unavailable",
    retryable: false,
  };
}

export function tokenizationExecutionGovernanceError(error: unknown): {
  status: number;
  reason: string;
  requiredMigration?: string;
} {
  const code = String((error as { code?: unknown })?.code || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  if (
    new Set(["42P01", "42703", "42883"]).has(code)
    || message.includes("required_schema_migration_not_applied")
    || (/does not exist|undefined/i.test(message)
      && /nexid_prepare_tokenization_execution_v1|tokenization_execution/i.test(message))
  ) {
    return {
      status: 503,
      reason: "tokenization_execution_governance_migration_required",
      requiredMigration: TOKENIZATION_EXECUTION_GOVERNANCE_MIGRATION,
    };
  }

  const knownConflict = [
    "tokenization_execution_busy",
    "tokenization_execution_reconciliation_required",
    "tokenization_request_network_class_mismatch",
    "supplier_production_release_required",
  ].find((reason) => message.includes(reason));
  if (knownConflict) return { status: 409, reason: knownConflict };
  if (message.includes("tokenization_request_not_found")) {
    return { status: 404, reason: "tokenization_request_not_found" };
  }
  return { status: 503, reason: "tokenization_execution_governance_unavailable" };
}
