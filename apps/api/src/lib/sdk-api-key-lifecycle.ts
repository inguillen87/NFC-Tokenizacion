import { sql } from "./db";

export async function hasSdkApiKeyLifecycleV1() {
  const rows = await sql/*sql*/`
    SELECT
      to_regclass('public.tenant_api_key_lifecycle_receipts') IS NOT NULL
      AND to_regclass('public.tenant_api_key_policy_receipts') IS NOT NULL
      AND to_regprocedure('public.nexid_tenant_api_key_lifecycle_v1_capability()') IS NOT NULL
      AND to_regprocedure('public.nexid_create_tenant_api_key_v1(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_create_tenant_api_key_v2(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_mutate_tenant_api_key_v1(jsonb)') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_trigger trigger_row
        WHERE NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND trigger_row.tgname = 'trg_tenant_api_key_lifecycle_guard_v1'
          AND trigger_row.tgrelid = to_regclass('public.tenant_api_keys')
      )
      AND EXISTS (
        SELECT 1
        FROM pg_trigger trigger_row
        WHERE NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND trigger_row.tgname = 'trg_tenant_api_key_lifecycle_receipts_append_only'
          AND trigger_row.tgrelid = to_regclass('public.tenant_api_key_lifecycle_receipts')
      )
      AND EXISTS (
        SELECT 1
        FROM pg_trigger trigger_row
        WHERE NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND trigger_row.tgname = 'trg_tenant_api_key_policy_receipts_append_only'
          AND trigger_row.tgrelid = to_regclass('public.tenant_api_key_policy_receipts')
      ) AS ready
  `;
  return Boolean(rows[0]?.ready);
}

export function sdkApiKeyDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown_error";
  const code = String((error as { code?: unknown }).code || "");
  return /^[A-Za-z0-9_-]{1,32}$/.test(code) ? code : "unknown_error";
}
