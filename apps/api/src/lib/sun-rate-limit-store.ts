import { createHmac } from "node:crypto";
import { sql } from "./db";

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;
type Env = Record<string, string | undefined>;

const DEFAULT_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const NON_PRODUCTION_RATE_LIMIT_KEY_PEPPER = "nexid-rate-limit-local-development-only-v1";
let ensuredTable = false;

function productionRuntime(env: Env) {
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production"
    || String(env.VERCEL_ENV || "").trim().toLowerCase() === "production";
}

export function shouldFailClosedSunRateLimit(env: Env = process.env) {
  if (productionRuntime(env)) return true;
  const configured = String(env.SUN_RATE_LIMIT_FAIL_CLOSED || "").trim().toLowerCase();
  if (!configured) return false;
  if (["1", "true", "yes", "on"].includes(configured)) return true;
  if (["0", "false", "no", "off"].includes(configured)) return false;
  return true;
}

function boundedInteger(value: number, name: string, minimum: number, maximum: number) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`sun_rate_limit_invalid_${name}`);
  }
  return value;
}

export function rateLimitKeyPepper(env: Env = process.env) {
  const configured = String(env.RATE_LIMIT_KEY_PEPPER || "").trim();
  if (configured) {
    const length = Buffer.byteLength(configured, "utf8");
    if (length < 32 || length > 4_096) {
      throw new Error("rate_limit_key_pepper_invalid");
    }
    return configured;
  }
  if (productionRuntime(env)) throw new Error("rate_limit_key_pepper_required");
  return NON_PRODUCTION_RATE_LIMIT_KEY_PEPPER;
}

export function rateLimitBucketKey(scope: string, scopeKey: string, env: Env = process.env) {
  const normalizedScope = String(scope || "").trim().toLowerCase();
  const normalizedKey = String(scopeKey || "").trim();
  if (!/^[a-z0-9:_-]{1,80}$/.test(normalizedScope)) {
    throw new Error("sun_rate_limit_invalid_scope");
  }
  if (!normalizedKey || normalizedKey.length > 2_048) {
    throw new Error("sun_rate_limit_invalid_scope_key");
  }
  return {
    scope: normalizedScope,
    scopeKeyHash: createHmac("sha256", rateLimitKeyPepper(env))
      .update(["nexid-rate-limit-v3", normalizedScope, normalizedKey].join("\0"), "utf8")
      .digest("hex"),
  };
}

async function ensureSunRateLimitTable() {
  if (ensuredTable) return;
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS sun_rate_limit_buckets (
      scope text NOT NULL,
      scope_key_hash text NOT NULL,
      window_started_at timestamptz NOT NULL DEFAULT now(),
      hit_count bigint NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (scope, scope_key_hash),
      CONSTRAINT sun_rate_limit_buckets_scope_check
        CHECK (scope ~ '^[a-z0-9:_-]{1,80}$'),
      CONSTRAINT sun_rate_limit_buckets_key_check
        CHECK (scope_key_hash ~ '^[0-9a-f]{64}$'),
      CONSTRAINT sun_rate_limit_buckets_count_check
        CHECK (hit_count >= 0)
    )
  `;
  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_sun_rate_limit_buckets_updated
      ON sun_rate_limit_buckets (updated_at)
  `;
  ensuredTable = true;
}

export type SunRateLimitLease = {
  scope: string;
  scopeKeyHash: string;
  windowStartedAt: string;
};

type SunRateLimitLeaseReservation = {
  hits: number;
  limited: boolean;
  retryAfterSeconds: number;
  lease: SunRateLimitLease;
};

async function reserveSunRateLimitRecord(
  query: Sql,
  scope: string,
  scopeKey: string,
  windowSeconds: number,
  maxHits: number,
  retentionSeconds = DEFAULT_RETENTION_SECONDS,
  requireLease = false,
): Promise<SunRateLimitLeaseReservation> {
  const key = rateLimitBucketKey(scope, scopeKey);
  const window = boundedInteger(windowSeconds, "window_seconds", 1, 86_400);
  const maximum = boundedInteger(maxHits, "max_hits", 1, 1_000_000);
  const retention = boundedInteger(retentionSeconds, "retention_seconds", window, 31 * 24 * 60 * 60);

  const rows = await query/*sql*/`
    WITH stale AS (
      SELECT bucket.scope, bucket.scope_key_hash
      FROM sun_rate_limit_buckets bucket
      WHERE bucket.updated_at < now() - (${retention} || ' seconds')::interval
        AND NOT (
          bucket.scope = ${key.scope}
          AND bucket.scope_key_hash = ${key.scopeKeyHash}
        )
      ORDER BY bucket.updated_at, bucket.scope, bucket.scope_key_hash
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    ),
    purged AS (
      DELETE FROM sun_rate_limit_buckets bucket
      USING stale
      WHERE bucket.scope = stale.scope
        AND bucket.scope_key_hash = stale.scope_key_hash
      RETURNING 1
    ),
    reserved AS (
      INSERT INTO sun_rate_limit_buckets (
        scope,
        scope_key_hash,
        window_started_at,
        hit_count,
        updated_at
      )
      VALUES (${key.scope}, ${key.scopeKeyHash}, now(), 1, now())
      ON CONFLICT (scope, scope_key_hash) DO UPDATE SET
        hit_count = CASE
          WHEN sun_rate_limit_buckets.window_started_at + (${window} || ' seconds')::interval <= now()
            THEN 1
          ELSE sun_rate_limit_buckets.hit_count + 1
        END,
        window_started_at = CASE
          WHEN sun_rate_limit_buckets.window_started_at + (${window} || ' seconds')::interval <= now()
            THEN now()
          ELSE sun_rate_limit_buckets.window_started_at
        END,
        updated_at = now()
      RETURNING hit_count, window_started_at
    )
    SELECT
      hit_count::bigint AS hits,
      -- The configured budget remains usable; only the next reservation is
      -- rejected. A preflight read uses >= because it precedes that next hit.
      hit_count > ${maximum} AS limited,
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (window_started_at + (${window} || ' seconds')::interval - now())))::int
      ) AS retry_after_seconds,
      window_started_at::text AS lease_window_started_at
    FROM reserved
  `;
  const row = rows[0];
  const hits = Number(row?.hits);
  if (!row || !Number.isSafeInteger(hits) || hits < 1) {
    throw new Error("sun_rate_limit_store_invalid_response");
  }
  const windowStartedAt = String(row.lease_window_started_at || "").trim();
  if (requireLease && !windowStartedAt) throw new Error("sun_rate_limit_store_invalid_lease");
  return {
    hits,
    limited: row.limited === true || String(row.limited) === "true",
    retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds || window)),
    lease: {
      scope: key.scope,
      scopeKeyHash: key.scopeKeyHash,
      windowStartedAt,
    },
  };
}

export async function reserveSunRateLimit(
  query: Sql,
  scope: string,
  scopeKey: string,
  windowSeconds: number,
  maxHits: number,
  retentionSeconds = DEFAULT_RETENTION_SECONDS,
): Promise<{ hits: number; limited: boolean; retryAfterSeconds: number }> {
  const reservation = await reserveSunRateLimitRecord(query, scope, scopeKey, windowSeconds, maxHits, retentionSeconds);
  return {
    hits: reservation.hits,
    limited: reservation.limited,
    retryAfterSeconds: reservation.retryAfterSeconds,
  };
}

export async function reserveSunRateLimitLease(
  scope: string,
  scopeKey: string,
  windowSeconds: number,
  maxHits: number,
): Promise<SunRateLimitLeaseReservation & { unavailable?: boolean }> {
  try {
    return await reserveSunRateLimitRecord(sql, scope, scopeKey, windowSeconds, maxHits, DEFAULT_RETENTION_SECONDS, true);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code || "")
      : "";
    if (code !== "42P01") throw error;
    try {
      await ensureSunRateLimitTable();
      return await reserveSunRateLimitRecord(sql, scope, scopeKey, windowSeconds, maxHits, DEFAULT_RETENTION_SECONDS, true);
    } catch (repairError) {
      const repairCode = typeof repairError === "object" && repairError && "code" in repairError
        ? String((repairError as { code?: string }).code || "")
        : "";
      if (repairCode === "42P01" || repairCode === "42501") {
        return {
          hits: 0,
          limited: false,
          retryAfterSeconds: 30,
          unavailable: true,
          lease: { scope: "unavailable", scopeKeyHash: "", windowStartedAt: "" },
        };
      }
      throw repairError;
    }
  }
}

export async function releaseSunRateLimitLeases(
  leases: readonly SunRateLimitLease[],
): Promise<{ released: boolean; unavailable?: boolean }> {
  if (!leases.length) return { released: true };
  const validLeases = leases.map((lease) => {
    if (!/^[a-z0-9:_-]{1,80}$/.test(lease.scope)) throw new Error("sun_rate_limit_invalid_lease_scope");
    if (!/^[0-9a-f]{64}$/.test(lease.scopeKeyHash)) throw new Error("sun_rate_limit_invalid_lease_key");
    if (!lease.windowStartedAt || lease.windowStartedAt.length > 80) throw new Error("sun_rate_limit_invalid_lease_window");
    return lease;
  });
  try {
    await sql/*sql*/`
      WITH requested AS (
        SELECT
          requested.scope,
          requested.scope_key_hash,
          requested.window_started_at::timestamptz AS window_started_at
        FROM jsonb_to_recordset(${JSON.stringify(validLeases.map((lease) => ({
          scope: lease.scope,
          scope_key_hash: lease.scopeKeyHash,
          window_started_at: lease.windowStartedAt,
        })))}::jsonb) AS requested(scope text, scope_key_hash text, window_started_at text)
      )
      UPDATE sun_rate_limit_buckets bucket
      SET
        hit_count = GREATEST(bucket.hit_count - 1, 0),
        updated_at = now()
      FROM requested
      WHERE bucket.scope = requested.scope
        AND bucket.scope_key_hash = requested.scope_key_hash
        AND bucket.window_started_at = requested.window_started_at
        AND bucket.hit_count > 0
    `;
    return { released: true };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code || "")
      : "";
    if (code === "42P01" || code === "42501") return { released: false, unavailable: true };
    throw error;
  }
}

export async function hitSunRateLimit(
  scope: string,
  scopeKey: string,
  windowSeconds: number,
  maxHits: number,
): Promise<{ hits: number; limited: boolean; retryAfterSeconds: number; unavailable?: boolean }> {
  try {
    return await reserveSunRateLimit(sql, scope, scopeKey, windowSeconds, maxHits);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code || "")
      : "";
    if (code !== "42P01") throw error;

    console.warn("[sun_rate_limit_store_missing]", JSON.stringify({ scope }));
    try {
      console.warn("[sun_rate_limit_repair]", JSON.stringify({ scope }));
      await ensureSunRateLimitTable();
      return await reserveSunRateLimit(sql, scope, scopeKey, windowSeconds, maxHits);
    } catch (repairError) {
      const repairCode = typeof repairError === "object" && repairError && "code" in repairError
        ? String((repairError as { code?: string }).code || "")
        : "";
      if (repairCode === "42P01" || repairCode === "42501") {
        return { hits: 0, limited: false, retryAfterSeconds: 30, unavailable: true };
      }
      throw repairError;
    }
  }
}

export async function readSunRateLimit(
  scope: string,
  scopeKey: string,
  windowSeconds: number,
  maxHits: number,
): Promise<{ hits: number; limited: boolean }> {
  const key = rateLimitBucketKey(scope, scopeKey);
  const window = boundedInteger(windowSeconds, "window_seconds", 1, 86_400);
  const maximum = boundedInteger(maxHits, "max_hits", 1, 1_000_000);

  try {
    const rows = await sql/*sql*/`
      SELECT CASE
        WHEN window_started_at + (${window} || ' seconds')::interval <= now() THEN 0
        ELSE hit_count
      END::bigint AS hits
      FROM sun_rate_limit_buckets
      WHERE scope = ${key.scope}
        AND scope_key_hash = ${key.scopeKeyHash}
      LIMIT 1
    `;
    const hits = Number(rows[0]?.hits || 0);
    // This check runs before a prospective attempt. Equality means the caller
    // already consumed the full budget, while reserveSunRateLimit rejects N+1.
    return { hits, limited: hits >= maximum };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code || "")
      : "";
    if (code !== "42P01") throw error;
    await ensureSunRateLimitTable();
    return readSunRateLimit(scope, scopeKey, windowSeconds, maxHits);
  }
}
