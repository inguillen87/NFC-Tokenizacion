export const CANONICAL_BASELINE_GUIDE =
  "docs/enterprise-hardening/2026-07-29/canonical-database-baseline-required.md";

export const CANONICAL_BASELINE_REMEDIATION = Object.freeze([
  "Use the dedicated enterprise E2E harness for an explicitly confirmed empty loopback database.",
  "Keep ordinary db-apply bootstrap fail-closed; production and shared databases require an audited ledger.",
  "Use db-apply --only only for a reviewed additive historical gap on an existing ledgered database.",
]);

export class DbApplySafetyError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "DbApplySafetyError";
    this.code = code;
    this.details = details;
  }
}

export function assertSafeDbApplyStart({
  hasMigrationLedger,
  initialized,
  appliedCount = 0,
  only = "",
  allowCleanBootstrap = false,
}) {
  if (!hasMigrationLedger && !initialized) {
    if (allowCleanBootstrap && !only) return;
    throw new DbApplySafetyError("canonical_baseline_required", {
      guide: CANONICAL_BASELINE_GUIDE,
      remediation: CANONICAL_BASELINE_REMEDIATION,
      database_mutated: false,
    });
  }
  if (!hasMigrationLedger && initialized && !only) {
    throw new DbApplySafetyError("existing_schema_without_migration_history", {
      remediation: [
        "Audit the existing schema and migration history.",
        "Apply only a reviewed additive migration with --only after approval.",
      ],
      database_mutated: false,
    });
  }
  if (hasMigrationLedger && appliedCount === 0 && !initialized) {
    if (allowCleanBootstrap && !only) return;
    throw new DbApplySafetyError("canonical_baseline_required", {
      guide: CANONICAL_BASELINE_GUIDE,
      remediation: CANONICAL_BASELINE_REMEDIATION,
      database_mutated: false,
    });
  }
}
