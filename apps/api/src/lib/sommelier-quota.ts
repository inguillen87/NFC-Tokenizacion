import { sql, type SqlExecutor } from "./db";
import { rateLimitBucketKey } from "./sun-rate-limit-store";
import type { SommelierEnv } from "./sommelier-access";
type QuotaBucket = { scope: string; key: string; window: number; limit: number; charge: number };
export type SommelierQuotaResult = { ok: true } | { ok: false; reason: "sommelier_rate_limited" | "sommelier_budget_exhausted" | "sommelier_quota_unavailable"; retryAfter: number };
export const SOMMELIER_DAILY_BUDGET_MICRO_USD = 500_000;
export type SommelierQuotaFailure = {
  category: "database_not_configured" | "required_schema_migration_missing" | "required_schema_migration_config_invalid" | "undefined_relation" | "undefined_column" | "permission_denied" | "connection_failure" | "malformed_quota_receipt" | "quota_configuration_invalid" | "unknown";
  sqlState: "42P01" | "42703" | "42501" | "08000" | "08001" | "08003" | "08004" | "08006" | "08007" | "08P01" | null;
};
/** Closed diagnostic vocabulary only; never serialize the error, SQL or caller. */
export function classifySommelierQuotaFailure(error: unknown): SommelierQuotaFailure {
  try {
    if (!error || (typeof error !== "object" && typeof error !== "function")) return { category: "unknown", sqlState: null };
    // Read data properties only. Error getters, cause, stack and toJSON are ignored.
    const message = Object.getOwnPropertyDescriptor(error, "message")?.value;
    const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
    if (message === "DATABASE_URL is not set") return { category: "database_not_configured", sqlState: null };
    if (message === "required_schema_migration_not_applied") return { category: "required_schema_migration_missing", sqlState: null };
    if (message === "required_schema_migration_id_invalid") return { category: "required_schema_migration_config_invalid", sqlState: null };
    if (message === "quota_receipt_invalid") return { category: "malformed_quota_receipt", sqlState: null };
    if (["quota_pepper_unavailable", "quota_invalid", "rate_limit_key_pepper_invalid", "rate_limit_key_pepper_required", "sun_rate_limit_invalid_scope", "sun_rate_limit_invalid_scope_key"].includes(message)) return { category: "quota_configuration_invalid", sqlState: null };
    if (code === "42P01") return { category: "undefined_relation", sqlState: code };
    if (code === "42703") return { category: "undefined_column", sqlState: code };
    if (code === "42501") return { category: "permission_denied", sqlState: code };
    if (code === "08000" || code === "08001" || code === "08003" || code === "08004" || code === "08006" || code === "08007" || code === "08P01") return { category: "connection_failure", sqlState: code };
  } catch { /* Malformed diagnostic input must not affect quota admission. */ }
  return { category: "unknown", sqlState: null };
}
type QuotaFailureLogger = (failure: SommelierQuotaFailure) => void;
const logQuotaFailure: QuotaFailureLogger = (failure) => console.warn("[sommelier_quota_unavailable]", JSON.stringify(failure));
/** Existing table only. No DDL, repairs, releases or local fail-open fallback.
 * Admission failures may consume quotas; this conservative reservation is never
 * refunded after a provider attempt, including network failures and fallback.
 */
export async function reserveSommelierBuckets(buckets: QuotaBucket[], env: SommelierEnv, execute: SqlExecutor = sql, logFailure: QuotaFailureLogger = logQuotaFailure): Promise<SommelierQuotaResult> {
  try {
    if (!env.RATE_LIMIT_KEY_PEPPER || Buffer.byteLength(env.RATE_LIMIT_KEY_PEPPER, "utf8") < 32 || Buffer.byteLength(env.RATE_LIMIT_KEY_PEPPER, "utf8") > 4096) throw new Error("quota_pepper_unavailable");
    for (const bucket of buckets) {
      if (!Number.isSafeInteger(bucket.charge) || bucket.charge < 1 || !Number.isSafeInteger(bucket.limit) || bucket.limit < 1 || !Number.isSafeInteger(bucket.window) || bucket.window < 1) throw new Error("quota_invalid");
      const key = rateLimitBucketKey(bucket.scope, bucket.key, env);
      const rows = await execute`
        INSERT INTO sun_rate_limit_buckets(scope,scope_key_hash,window_started_at,hit_count,updated_at)
        VALUES(${key.scope},${key.scopeKeyHash},now(),${bucket.charge},now())
        ON CONFLICT(scope,scope_key_hash) DO UPDATE SET
          hit_count=CASE WHEN sun_rate_limit_buckets.window_started_at+(${bucket.window}||' seconds')::interval<=now() THEN ${bucket.charge} ELSE sun_rate_limit_buckets.hit_count+${bucket.charge} END,
          window_started_at=CASE WHEN sun_rate_limit_buckets.window_started_at+(${bucket.window}||' seconds')::interval<=now() THEN now() ELSE sun_rate_limit_buckets.window_started_at END,
          updated_at=now()
        RETURNING hit_count::text AS hits,GREATEST(1,CEIL(EXTRACT(EPOCH FROM(window_started_at+(${bucket.window}||' seconds')::interval-now())))::int) AS retry_after`;
      if (rows.length !== 1 || !/^[0-9]+$/.test(String(rows[0].hits)) || !Number.isSafeInteger(Number(rows[0].hits)) || Number(rows[0].hits) < bucket.charge || !Number.isSafeInteger(Number(rows[0].retry_after)) || Number(rows[0].retry_after) < 1) throw new Error("quota_receipt_invalid");
      if (Number(rows[0].hits) > bucket.limit) return { ok: false, reason: bucket.scope.includes("budget") ? "sommelier_budget_exhausted" : "sommelier_rate_limited", retryAfter: Number(rows[0].retry_after) };
    }
    return { ok: true };
  } catch (error) {
    try { logFailure(classifySommelierQuotaFailure(error)); } catch { /* Logging failure never opens admission. */ }
    return { ok: false, reason: "sommelier_quota_unavailable", retryAfter: 30 };
  }
}
export function sommelierIssuanceBuckets(ipHash: string): QuotaBucket[] {
  return [{ scope: "sommelier:issue:source-minute", key: ipHash, window: 60, limit: 4, charge: 1 }, { scope: "sommelier:issue:source-hour", key: ipHash, window: 3600, limit: 20, charge: 1 }, { scope: "sommelier:issue:global-day", key: "all", window: 86400, limit: 200, charge: 1 }];
}
export function sommelierChatBuckets(caller: string, tenant: string): QuotaBucket[] {
  return [{ scope: "sommelier:chat:caller-minute", key: caller, window: 60, limit: 6, charge: 1 }, { scope: "sommelier:chat:caller-hour", key: caller, window: 3600, limit: 30, charge: 1 }, { scope: "sommelier:chat:tenant-minute", key: tenant, window: 60, limit: 20, charge: 1 }, { scope: "sommelier:chat:global-minute", key: "all", window: 60, limit: 30, charge: 1 }];
}
export function sommelierProviderBuckets(tenant: string, charge: number): QuotaBucket[] {
  return [{ scope: "sommelier:provider:global-day", key: "all", window: 86400, limit: 300, charge: 1 }, { scope: "sommelier:budget:global-day", key: "all", window: 86400, limit: SOMMELIER_DAILY_BUDGET_MICRO_USD, charge }, { scope: "sommelier:budget:tenant-day", key: tenant, window: 86400, limit: 100_000, charge }];
}
