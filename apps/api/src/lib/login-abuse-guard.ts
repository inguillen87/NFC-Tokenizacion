import { createHmac } from "crypto";
import { isIP } from "net";

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;
type Env = Record<string, string | undefined>;

const DEFAULT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_SUBJECT_SOURCE_MAX_ATTEMPTS = 5;
const DEFAULT_SOURCE_MAX_ATTEMPTS = 100;
const DEFAULT_BLOCK_SECONDS = 15 * 60;
const DEFAULT_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const NON_PRODUCTION_PEPPER = "nexid-login-rate-limit-non-production-pepper-only";

export type LoginRateLimitPolicy = {
  windowSeconds: number;
  subjectSourceMaxAttempts: number;
  sourceMaxAttempts: number;
  blockSeconds: number;
  retentionSeconds: number;
  trustedProxyHops: number;
  failClosed: boolean;
  pepper: string;
};

export type LoginAttemptReservation = {
  limited: boolean;
  retryAfterSeconds: number;
  clientIp: string;
  sourceKey: string;
  subjectSourceKey: string;
};

export class LoginAbuseGuardUnavailableError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "LoginAbuseGuardUnavailableError";
    this.code = code;
  }
}

function productionRuntime(env: Env) {
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production"
    || String(env.VERCEL_ENV || "").trim().toLowerCase() === "production";
}

function readInteger(env: Env, name: string, fallback: number, minimum: number, maximum: number) {
  const raw = String(env[name] || "").trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new LoginAbuseGuardUnavailableError(`login_rate_limit_invalid_${name.toLowerCase()}`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new LoginAbuseGuardUnavailableError(`login_rate_limit_invalid_${name.toLowerCase()}`);
  }
  return parsed;
}

function readBoolean(env: Env, name: string, fallback: boolean) {
  const raw = String(env[name] || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  throw new LoginAbuseGuardUnavailableError(`login_rate_limit_invalid_${name.toLowerCase()}`);
}

export function shouldFailClosedLoginAbuseGuard(env: Env = process.env) {
  if (productionRuntime(env)) return true;
  try {
    return readBoolean(env, "LOGIN_RATE_LIMIT_FAIL_CLOSED", false);
  } catch {
    return true;
  }
}

export function getLoginRateLimitPolicy(env: Env = process.env): LoginRateLimitPolicy {
  const isProduction = productionRuntime(env);
  const windowSeconds = readInteger(env, "LOGIN_RATE_LIMIT_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS, 60, 3_600);
  const subjectSourceMaxAttempts = readInteger(
    env,
    "LOGIN_RATE_LIMIT_SUBJECT_SOURCE_MAX_ATTEMPTS",
    DEFAULT_SUBJECT_SOURCE_MAX_ATTEMPTS,
    1,
    50,
  );
  const sourceMaxAttempts = readInteger(
    env,
    "LOGIN_RATE_LIMIT_SOURCE_MAX_ATTEMPTS",
    DEFAULT_SOURCE_MAX_ATTEMPTS,
    5,
    1_000,
  );
  const blockSeconds = readInteger(env, "LOGIN_RATE_LIMIT_BLOCK_SECONDS", DEFAULT_BLOCK_SECONDS, 60, 86_400);
  const retentionSeconds = readInteger(
    env,
    "LOGIN_RATE_LIMIT_RETENTION_SECONDS",
    DEFAULT_RETENTION_SECONDS,
    3_600,
    31 * 24 * 60 * 60,
  );
  const trustedProxyHops = readInteger(env, "LOGIN_TRUSTED_PROXY_HOPS", 0, 0, 10);
  const pepper = String(env.LOGIN_RATE_LIMIT_PEPPER || "").trim() || (isProduction ? "" : NON_PRODUCTION_PEPPER);

  if (sourceMaxAttempts < subjectSourceMaxAttempts) {
    throw new LoginAbuseGuardUnavailableError("login_rate_limit_source_threshold_too_low");
  }
  if (retentionSeconds < windowSeconds + blockSeconds) {
    throw new LoginAbuseGuardUnavailableError("login_rate_limit_retention_too_short");
  }
  if (isProduction && pepper.length < 32) {
    throw new LoginAbuseGuardUnavailableError("login_rate_limit_pepper_required");
  }
  if (isProduction && trustedProxyHops < 1) {
    throw new LoginAbuseGuardUnavailableError("login_trusted_proxy_hops_required");
  }

  return {
    windowSeconds,
    subjectSourceMaxAttempts,
    sourceMaxAttempts,
    blockSeconds,
    retentionSeconds,
    trustedProxyHops,
    failClosed: shouldFailClosedLoginAbuseGuard(env),
    pepper,
  };
}

function normalizeForwardedIp(value: string) {
  const candidate = value.trim();
  if (!candidate) return null;
  if (isIP(candidate)) return candidate;

  const bracketed = candidate.match(/^\[([^\]]+)](?::\d{1,5})?$/);
  if (bracketed && isIP(bracketed[1])) return bracketed[1];

  const ipv4WithPort = candidate.match(/^([^:]+):(\d{1,5})$/);
  if (ipv4WithPort && isIP(ipv4WithPort[1]) === 4) return ipv4WithPort[1];
  return null;
}

export function resolveTrustedLoginClientIp(req: Request, policy: Pick<LoginRateLimitPolicy, "trustedProxyHops">) {
  if (policy.trustedProxyHops < 1) return null;

  const forwardedFor = String(req.headers.get("x-forwarded-for") || "").trim();
  if (!forwardedFor) return null;
  const chain = forwardedFor.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (chain.length === 0 || chain.length > 32) return null;

  // X-Forwarded-For is ordered client -> nearest upstream proxy. Only entries
  // to the right of this index are trusted; attacker-prepended entries stay left.
  const clientIndex = Math.max(0, chain.length - policy.trustedProxyHops);
  return normalizeForwardedIp(chain[clientIndex]);
}

function bucketKey(pepper: string, scope: "source" | "source_subject", parts: string[]) {
  return createHmac("sha256", pepper).update(["nexid-login-v1", scope, ...parts].join("\0")).digest("hex");
}

export async function reserveLoginAttempt(
  sql: Sql,
  input: { subject: string; clientIp: string },
  policy: LoginRateLimitPolicy,
): Promise<LoginAttemptReservation> {
  const sourceKey = bucketKey(policy.pepper, "source", [input.clientIp]);
  const subjectSourceKey = bucketKey(policy.pepper, "source_subject", [input.clientIp, input.subject]);

  const rows = await sql/*sql*/`
    WITH current_buckets(bucket_kind, bucket_key) AS (
      VALUES
        ('source'::text, ${sourceKey}::text),
        ('source_subject'::text, ${subjectSourceKey}::text)
    ),
    stale AS (
      SELECT bucket.bucket_kind, bucket.bucket_key
      FROM admin_login_attempt_buckets bucket
      WHERE bucket.updated_at < now() - (${policy.retentionSeconds} || ' seconds')::interval
        AND NOT EXISTS (
          SELECT 1
          FROM current_buckets current_bucket
          WHERE current_bucket.bucket_kind = bucket.bucket_kind
            AND current_bucket.bucket_key = bucket.bucket_key
        )
      ORDER BY bucket.updated_at, bucket.bucket_kind, bucket.bucket_key
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    ),
    purged AS (
      DELETE FROM admin_login_attempt_buckets bucket
      USING stale
      WHERE bucket.bucket_kind = stale.bucket_kind
        AND bucket.bucket_key = stale.bucket_key
      RETURNING 1
    ),
    source_reserved AS (
      INSERT INTO admin_login_attempt_buckets (
        bucket_kind,
        bucket_key,
        window_started_at,
        attempt_count,
        blocked_until,
        updated_at
      )
      VALUES ('source', ${sourceKey}, now(), 1, NULL, now())
      ON CONFLICT (bucket_kind, bucket_key) DO UPDATE SET
        attempt_count = CASE
          WHEN admin_login_attempt_buckets.blocked_until > now()
            THEN admin_login_attempt_buckets.attempt_count
          WHEN admin_login_attempt_buckets.window_started_at + (${policy.windowSeconds} || ' seconds')::interval <= now()
            OR (admin_login_attempt_buckets.blocked_until IS NOT NULL AND admin_login_attempt_buckets.blocked_until <= now())
            THEN 1
          ELSE admin_login_attempt_buckets.attempt_count + 1
        END,
        window_started_at = CASE
          WHEN admin_login_attempt_buckets.blocked_until > now()
            THEN admin_login_attempt_buckets.window_started_at
          WHEN admin_login_attempt_buckets.window_started_at + (${policy.windowSeconds} || ' seconds')::interval <= now()
            OR (admin_login_attempt_buckets.blocked_until IS NOT NULL AND admin_login_attempt_buckets.blocked_until <= now())
            THEN now()
          ELSE admin_login_attempt_buckets.window_started_at
        END,
        blocked_until = CASE
          WHEN admin_login_attempt_buckets.blocked_until > now()
            THEN admin_login_attempt_buckets.blocked_until
          WHEN admin_login_attempt_buckets.window_started_at + (${policy.windowSeconds} || ' seconds')::interval <= now()
            OR (admin_login_attempt_buckets.blocked_until IS NOT NULL AND admin_login_attempt_buckets.blocked_until <= now())
            THEN NULL
          WHEN admin_login_attempt_buckets.attempt_count + 1 > ${policy.sourceMaxAttempts}
            THEN now() + (${policy.blockSeconds} || ' seconds')::interval
          ELSE NULL
        END,
        updated_at = now()
      RETURNING bucket_kind, blocked_until
    ),
    subject_source_reserved AS (
      INSERT INTO admin_login_attempt_buckets (
        bucket_kind,
        bucket_key,
        window_started_at,
        attempt_count,
        blocked_until,
        updated_at
      )
      SELECT 'source_subject', ${subjectSourceKey}, now(), 1, NULL, now()
      FROM source_reserved
      WHERE source_reserved.blocked_until IS NULL OR source_reserved.blocked_until <= now()
      ON CONFLICT (bucket_kind, bucket_key) DO UPDATE SET
        attempt_count = CASE
          WHEN admin_login_attempt_buckets.blocked_until > now()
            THEN admin_login_attempt_buckets.attempt_count
          WHEN admin_login_attempt_buckets.window_started_at + (${policy.windowSeconds} || ' seconds')::interval <= now()
            OR (admin_login_attempt_buckets.blocked_until IS NOT NULL AND admin_login_attempt_buckets.blocked_until <= now())
            THEN 1
          ELSE admin_login_attempt_buckets.attempt_count + 1
        END,
        window_started_at = CASE
          WHEN admin_login_attempt_buckets.blocked_until > now()
            THEN admin_login_attempt_buckets.window_started_at
          WHEN admin_login_attempt_buckets.window_started_at + (${policy.windowSeconds} || ' seconds')::interval <= now()
            OR (admin_login_attempt_buckets.blocked_until IS NOT NULL AND admin_login_attempt_buckets.blocked_until <= now())
            THEN now()
          ELSE admin_login_attempt_buckets.window_started_at
        END,
        blocked_until = CASE
          WHEN admin_login_attempt_buckets.blocked_until > now()
            THEN admin_login_attempt_buckets.blocked_until
          WHEN admin_login_attempt_buckets.window_started_at + (${policy.windowSeconds} || ' seconds')::interval <= now()
            OR (admin_login_attempt_buckets.blocked_until IS NOT NULL AND admin_login_attempt_buckets.blocked_until <= now())
            THEN NULL
          WHEN admin_login_attempt_buckets.attempt_count + 1 > ${policy.subjectSourceMaxAttempts}
            THEN now() + (${policy.blockSeconds} || ' seconds')::interval
          ELSE NULL
        END,
        updated_at = now()
      RETURNING bucket_kind, blocked_until
    ),
    reserved AS (
      SELECT bucket_kind, blocked_until FROM source_reserved
      UNION ALL
      SELECT bucket_kind, blocked_until FROM subject_source_reserved
    )
    SELECT
      bucket_kind,
      blocked_until > now() AS is_limited,
      CASE
        WHEN blocked_until > now()
          THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (blocked_until - now())))::int)
        ELSE 0
      END AS retry_after_seconds
    FROM reserved
    ORDER BY bucket_kind
  `;

  const sourceRow = rows.find((row) => String(row?.bucket_kind || "") === "source");
  const subjectSourceRow = rows.find((row) => String(row?.bucket_kind || "") === "source_subject");
  const sourceLimited = sourceRow?.is_limited === true || String(sourceRow?.is_limited) === "true";
  if (!sourceRow || rows.length > 2 || (!sourceLimited && !subjectSourceRow)) {
    throw new LoginAbuseGuardUnavailableError("login_rate_limit_store_invalid_response");
  }
  const limitedRows = rows.filter((row) => row?.is_limited === true || String(row?.is_limited) === "true");
  const retryAfterSeconds = limitedRows.reduce(
    (maximum, row) => Math.max(maximum, Number(row?.retry_after_seconds || 0)),
    0,
  );

  return {
    limited: limitedRows.length > 0,
    retryAfterSeconds: limitedRows.length > 0 ? Math.max(1, retryAfterSeconds || policy.blockSeconds) : 0,
    clientIp: input.clientIp,
    sourceKey,
    subjectSourceKey,
  };
}

export async function clearSuccessfulLoginAttempt(sql: Sql, reservation: LoginAttemptReservation) {
  await sql/*sql*/`
    WITH subject_reset AS (
      DELETE FROM admin_login_attempt_buckets
      WHERE bucket_kind = 'source_subject'
        AND bucket_key = ${reservation.subjectSourceKey}
      RETURNING 1
    )
    UPDATE admin_login_attempt_buckets
    SET
      attempt_count = GREATEST(0, attempt_count - 1),
      window_started_at = CASE WHEN attempt_count <= 1 THEN now() ELSE window_started_at END,
      updated_at = now()
    WHERE bucket_kind = 'source'
      AND bucket_key = ${reservation.sourceKey}
      AND (blocked_until IS NULL OR blocked_until <= now())
  `;
}
