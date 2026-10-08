import { sql, type SqlExecutor } from "./db";
import { rateLimitBucketKey } from "./sun-rate-limit-store";
import type { SommelierEnv } from "./sommelier-access";
import { NeonDbError } from "@neondatabase/serverless";
type QuotaBucket = { scope: string; key: string; window: number; limit: number; charge: number };
export type SommelierQuotaResult = { ok: true } | { ok: false; reason: "sommelier_rate_limited" | "sommelier_budget_exhausted" | "sommelier_quota_unavailable"; retryAfter: number };
export const SOMMELIER_DAILY_BUDGET_MICRO_USD = 500_000;
const TRANSPORT_FAILURE_CATEGORIES = {
  401: "transport_http_auth", 402: "transport_http_payment_required", 403: "transport_http_auth",
  404: "transport_http_endpoint_unavailable", 405: "transport_http_request_rejected",
  408: "transport_http_timeout", 409: "transport_http_conflict", 410: "transport_http_endpoint_unavailable",
  413: "transport_http_request_rejected", 415: "transport_http_request_rejected", 422: "transport_http_request_rejected",
  429: "transport_http_rate_limited", 500: "transport_http_unavailable", 501: "transport_http_unavailable",
  502: "transport_http_unavailable", 503: "transport_http_unavailable", 504: "transport_http_timeout",
} as const;
export type SommelierQuotaFailure = {
  category: "database_not_configured" | "database_connection_string_invalid" | "required_schema_migration_missing" | "required_schema_migration_config_invalid" | "undefined_relation" | "undefined_column" | "permission_denied" | "connection_failure" | "authentication_failure" | "database_not_found" | "database_temporarily_unavailable" | "database_capacity_exhausted" | "query_cancelled" | "transaction_conflict" | "constraint_violation" | "invalid_database_input" | "parameter_type_ambiguous" | "parameter_type_mismatch" | "database_internal_error" | "database_feature_unsupported" | "database_query_syntax_error" | "database_function_undefined" | "database_parameter_undefined" | "invalid_database_parameter" | "invalid_database_encoding" | "database_user_exception" | "malformed_quota_receipt" | "quota_configuration_invalid" | (typeof TRANSPORT_FAILURE_CATEGORIES)[keyof typeof TRANSPORT_FAILURE_CATEGORIES] | "unknown";
  sqlState: "42P01" | "42703" | "42501" | "08000" | "08001" | "08003" | "08004" | "08006" | "08007" | "08P01" | "28P01" | "28000" | "3D000" | "57P03" | "53300" | "57014" | "40001" | "40P01" | "23505" | "23514" | "22P02" | "42P18" | "42725" | "42P08" | "42804" | "XX000" | "0A000" | "42601" | "42883" | "42P02" | "22023" | "22021" | "P0001" | null;
  transportStatus?: keyof typeof TRANSPORT_FAILURE_CATEGORIES;
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
    if (code === "28P01" || code === "28000") return { category: "authentication_failure", sqlState: code };
    if (code === "3D000") return { category: "database_not_found", sqlState: code };
    if (code === "57P03") return { category: "database_temporarily_unavailable", sqlState: code };
    if (code === "53300") return { category: "database_capacity_exhausted", sqlState: code };
    if (code === "57014") return { category: "query_cancelled", sqlState: code };
    if (code === "40001" || code === "40P01") return { category: "transaction_conflict", sqlState: code };
    if (code === "23505" || code === "23514") return { category: "constraint_violation", sqlState: code };
    if (code === "22P02") return { category: "invalid_database_input", sqlState: code };
    if (code === "42P18" || code === "42725" || code === "42P08") return { category: "parameter_type_ambiguous", sqlState: code };
    if (code === "42804") return { category: "parameter_type_mismatch", sqlState: code };
    if (code === "XX000") return { category: "database_internal_error", sqlState: code };
    if (code === "0A000") return { category: "database_feature_unsupported", sqlState: code };
    if (code === "42601") return { category: "database_query_syntax_error", sqlState: code };
    if (code === "42883") return { category: "database_function_undefined", sqlState: code };
    if (code === "42P02") return { category: "database_parameter_undefined", sqlState: code };
    if (code === "22023") return { category: "invalid_database_parameter", sqlState: code };
    if (code === "22021") return { category: "invalid_database_encoding", sqlState: code };
    if (code === "P0001") return { category: "database_user_exception", sqlState: code };
    // These exact installed-driver prefixes can contain credentials afterward.
    // Classify without extracting, retaining or logging any suffix or sourceError.
    if (typeof message === "string") {
      if (message.startsWith("No database connection string was provided to `neon()`.")) return { category: "database_not_configured", sqlState: null };
      if (message.startsWith("Database connection string provided to `neon()` is not a valid URL. Connection string:") || message.startsWith("Database connection string format for `neon()` should be:")) return { category: "database_connection_string_invalid", sqlState: null };
      if (message.startsWith("Error connecting to database:")) return { category: "connection_failure", sqlState: null };
      // Compare fixed prefixes, so no regexp capture retains the private body.
      for (const [status, category] of Object.entries(TRANSPORT_FAILURE_CATEGORIES)) {
        if (message.startsWith(`Server error (HTTP status ${status}): `)) return { category, sqlState: null, transportStatus: Number(status) as keyof typeof TRANSPORT_FAILURE_CATEGORIES };
      }
    }
  } catch { /* Malformed diagnostic input must not affect quota admission. */ }
  return { category: "unknown", sqlState: null };
}
export type SommelierDatabaseTarget = "nexid_main" | "nexid_staging" | "unverified" | "missing" | "invalid";
/** A coarse configured-host label only, not database or credential validation. */
export function classifySommelierDatabaseTarget(env: SommelierEnv): SommelierDatabaseTarget {
  try {
    const connection = env.DATABASE_URL;
    if (!connection) return "missing";
    if (typeof connection !== "string" || connection.length > 16_384) return "invalid";
    const parsed = new URL(connection);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") return "invalid";
    const host = parsed.hostname;
    if (host === "ep-fancy-morning-ai5gdrnd.c-4.us-east-1.aws.neon.tech" || host === "ep-fancy-morning-ai5gdrnd-pooler.c-4.us-east-1.aws.neon.tech") return "nexid_main";
    if (host === "ep-solitary-surf-aiixcsmk.c-4.us-east-1.aws.neon.tech" || host === "ep-solitary-surf-aiixcsmk-pooler.c-4.us-east-1.aws.neon.tech") return "nexid_staging";
    return "unverified";
  } catch { return "invalid"; }
}
export type SommelierQuotaErrorKind = "NeonDbError" | "TypeError" | "RangeError" | "Error" | "unknown";
export type SommelierQuotaFailureStage = "validate_configuration" | "derive_bucket_key" | "execute_bucket" | "validate_receipt";
/** Runtime classes only. Never evaluate name/message/cause getters. */
export function classifySommelierQuotaErrorKind(error: unknown): SommelierQuotaErrorKind {
  try {
    if (error instanceof NeonDbError) return "NeonDbError";
    if (error instanceof TypeError) return "TypeError";
    if (error instanceof RangeError) return "RangeError";
    if (error instanceof Error) return "Error";
  } catch { /* Hostile prototypes do not affect admission or diagnostics. */ }
  return "unknown";
}
type QuotaFailureLogger = (failure: SommelierQuotaFailure & { databaseTarget: SommelierDatabaseTarget; errorKind: SommelierQuotaErrorKind; failureStage: SommelierQuotaFailureStage }) => void;
const logQuotaFailure: QuotaFailureLogger = (failure) => console.warn("[sommelier_quota_unavailable]", JSON.stringify(failure));
/** Existing table only. No DDL, repairs, releases or local fail-open fallback.
 * Admission failures may consume quotas; this conservative reservation is never
 * refunded after a provider attempt, including network failures and fallback.
 */
export async function reserveSommelierBuckets(buckets: QuotaBucket[], env: SommelierEnv, execute: SqlExecutor = sql, logFailure: QuotaFailureLogger = logQuotaFailure): Promise<SommelierQuotaResult> {
  let failureStage: SommelierQuotaFailureStage = "validate_configuration";
  try {
    if (!env.RATE_LIMIT_KEY_PEPPER || Buffer.byteLength(env.RATE_LIMIT_KEY_PEPPER, "utf8") < 32 || Buffer.byteLength(env.RATE_LIMIT_KEY_PEPPER, "utf8") > 4096) throw new Error("quota_pepper_unavailable");
    for (const bucket of buckets) {
      failureStage = "validate_configuration";
      if (!Number.isSafeInteger(bucket.charge) || bucket.charge < 1 || !Number.isSafeInteger(bucket.limit) || bucket.limit < 1 || !Number.isSafeInteger(bucket.window) || bucket.window < 1) throw new Error("quota_invalid");
      failureStage = "derive_bucket_key";
      const key = rateLimitBucketKey(bucket.scope, bucket.key, env);
      failureStage = "execute_bucket";
      const rows = await execute`
        INSERT INTO sun_rate_limit_buckets(scope,scope_key_hash,window_started_at,hit_count,updated_at)
        VALUES(${key.scope},${key.scopeKeyHash},now(),${bucket.charge},now())
        ON CONFLICT(scope,scope_key_hash) DO UPDATE SET
          hit_count=CASE WHEN sun_rate_limit_buckets.window_started_at+(${bucket.window}||' seconds')::interval<=now() THEN ${bucket.charge} ELSE sun_rate_limit_buckets.hit_count+${bucket.charge} END,
          window_started_at=CASE WHEN sun_rate_limit_buckets.window_started_at+(${bucket.window}||' seconds')::interval<=now() THEN now() ELSE sun_rate_limit_buckets.window_started_at END,
          updated_at=now()
        RETURNING hit_count::text AS hits,GREATEST(1,CEIL(EXTRACT(EPOCH FROM(window_started_at+(${bucket.window}||' seconds')::interval-now())))::int) AS retry_after`;
      failureStage = "validate_receipt";
      if (rows.length !== 1 || !/^[0-9]+$/.test(String(rows[0].hits)) || !Number.isSafeInteger(Number(rows[0].hits)) || Number(rows[0].hits) < bucket.charge || !Number.isSafeInteger(Number(rows[0].retry_after)) || Number(rows[0].retry_after) < 1) throw new Error("quota_receipt_invalid");
      if (Number(rows[0].hits) > bucket.limit) return { ok: false, reason: bucket.scope.includes("budget") ? "sommelier_budget_exhausted" : "sommelier_rate_limited", retryAfter: Number(rows[0].retry_after) };
    }
    return { ok: true };
  } catch (error) {
    try { logFailure({ ...classifySommelierQuotaFailure(error), databaseTarget: classifySommelierDatabaseTarget(env), errorKind: classifySommelierQuotaErrorKind(error), failureStage }); } catch { /* Logging failure never opens admission. */ }
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
