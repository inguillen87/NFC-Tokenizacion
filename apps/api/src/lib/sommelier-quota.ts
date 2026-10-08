import { sql, type SqlExecutor } from "./db";
import { rateLimitBucketKey } from "./sun-rate-limit-store";
import type { SommelierEnv } from "./sommelier-access";
type QuotaBucket = { scope: string; key: string; window: number; limit: number; charge: number };
export type SommelierQuotaResult = { ok: true } | { ok: false; reason: "sommelier_rate_limited" | "sommelier_budget_exhausted" | "sommelier_quota_unavailable"; retryAfter: number };
export const SOMMELIER_DAILY_BUDGET_MICRO_USD = 500_000;
/** Existing table only. No DDL, repairs, releases or local fail-open fallback.
 * Admission failures may consume quotas; this conservative reservation is never
 * refunded after a provider attempt, including network failures and fallback.
 */
export async function reserveSommelierBuckets(buckets: QuotaBucket[], env: SommelierEnv, execute: SqlExecutor = sql): Promise<SommelierQuotaResult> {
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
  } catch { return { ok: false, reason: "sommelier_quota_unavailable", retryAfter: 30 }; }
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
