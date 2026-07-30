import { sql } from "./db";

export const COMMERCIAL_ASSET_SCOPE_MIGRATION_REQUIRED = "commercial_asset_scope_migration_required";
export const COMMERCIAL_ASSET_SCOPE_MIGRATION =
  "20260729160000_0072_tokenization_marketplace_execution_governance.sql";

export async function requireCommercialAssetScopeSchema() {
  // Read-only and ledger-backed by design. Runtime compatibility DDL must not
  // be able to impersonate the migration that installs the identity guards.
  const rows = await sql/*sql*/`
    SELECT
      EXISTS (
        SELECT 1
        FROM schema_migrations
        WHERE id = ${COMMERCIAL_ASSET_SCOPE_MIGRATION}
      ) AS migration_applied,
      to_regprocedure(
        'public.nexid_prepare_tokenization_execution_v1(uuid,uuid,uuid,text,integer)'
      ) IS NOT NULL AS governance_function_ready,
      has_function_privilege(
        current_user,
        'public.nexid_prepare_tokenization_execution_v1(uuid,uuid,uuid,text,integer)',
        'EXECUTE'
      ) AS governance_function_execute_ready,
      has_function_privilege(
        current_user,
        'public.nexid_assert_supplier_commercial_release_v1(uuid)',
        'EXECUTE'
      ) AS supplier_release_execute_ready,
      EXISTS (
        SELECT 1
        FROM pg_trigger trigger_row
        WHERE trigger_row.tgname = 'trg_nexid_marketplace_offer_asset_scope_v1'
          AND trigger_row.tgrelid = 'public.marketplace_offers'::regclass
          AND trigger_row.tgenabled <> 'D'
          AND NOT trigger_row.tgisinternal
      ) AS marketplace_offer_guard_ready,
      EXISTS (
        SELECT 1
        FROM pg_trigger trigger_row
        WHERE trigger_row.tgname = 'trg_nexid_marketplace_request_asset_scope_v1'
          AND trigger_row.tgrelid = 'public.marketplace_order_requests'::regclass
          AND trigger_row.tgenabled <> 'D'
          AND NOT trigger_row.tgisinternal
      ) AS marketplace_request_guard_ready,
      to_regclass('public.uq_marketplace_active_p2p_ownership') IS NOT NULL
        AS marketplace_ownership_uniqueness_ready,
      (
        SELECT count(*) = 5
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'marketplace_offers' AND column_name = 'ownership_id')
            OR (
              table_name = 'marketplace_order_requests'
              AND column_name IN ('source_tag_id', 'source_tap_event_created_at', 'source_batch_id')
            )
            OR (table_name = 'order_requests' AND column_name = 'tenant_id')
          )
      ) AS columns_ready
  `;
  const gate = rows[0];
  if (
    gate?.migration_applied !== true
    || gate?.governance_function_ready !== true
    || gate?.governance_function_execute_ready !== true
    || gate?.supplier_release_execute_ready !== true
    || gate?.marketplace_offer_guard_ready !== true
    || gate?.marketplace_request_guard_ready !== true
    || gate?.marketplace_ownership_uniqueness_ready !== true
    || gate?.columns_ready !== true
  ) {
    throw new Error(COMMERCIAL_ASSET_SCOPE_MIGRATION_REQUIRED);
  }
}

export function databaseErrorReason(error: unknown) {
  const candidate = error as { message?: unknown } | null;
  return String(candidate?.message || error || "").trim().toLowerCase();
}

export function isCommercialAssetScopeSchemaError(error: unknown) {
  const candidate = error as { code?: unknown } | null;
  const code = String(candidate?.code || "").trim();
  const reason = databaseErrorReason(error);
  return code === "42703"
    || code === "42P01"
    || code === "42883"
    || reason.includes("required_schema_migration_not_applied")
    || reason.includes(COMMERCIAL_ASSET_SCOPE_MIGRATION_REQUIRED);
}

export function supplierCommercialReleaseReason(error: unknown) {
  const reason = databaseErrorReason(error);
  for (const candidate of [
    "supplier_pack_purpose_unclassified",
    "supplier_trial_integration_non_sellable",
    "supplier_production_acceptance_v2_required",
    "supplier_commercial_scope_invalid",
    "supplier_commercial_batch_not_found",
  ]) {
    if (reason.includes(candidate)) return candidate;
  }
  return null;
}
