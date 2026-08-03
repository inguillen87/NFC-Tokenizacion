export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { ensurePresetUser } from '../../../lib/auth-presets';
import { verifyPassword } from '../../../lib/password';
import { auditAuthEvent, createSession, getAuthUserByEmail, normalizeRole, roleAllowsHumanSession } from '../../../lib/iam';
import {
  clearSuccessfulLoginAttempt,
  getLoginRateLimitPolicy,
  LoginAbuseGuardUnavailableError,
  type LoginAttemptReservation,
  reserveLoginAttempt,
  shouldFailClosedLoginAbuseGuard,
} from '../../../lib/login-abuse-guard';
import { getRequestMeta } from '../../../lib/request-meta';
import { ensureEnterpriseIamSchema } from '../../../lib/commercial-runtime-schema';
import { RequestBodyTooLargeError, readBoundedJsonBody } from '../../../lib/bounded-request-body';
import { enforceCriticalRateLimit } from '../../../lib/critical-rate-limit';

const INVALID_PASSWORD_SENTINEL = 'scrypt$00000000000000000000000000000000$feb0ef155fa035f44af6bf3567ee67a88ced9da502be1a21ec55cecf894c19ccf26ac795c308a966e37ad4db6d37faafad93012b830c0b1819f3646edf611973';

function normalizeLoginEmail(rawEmail: string) {
  const normalized = String(rawEmail || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('@')) return normalized;

  const aliases: Record<string, string | undefined> = {
    'superadmin': process.env.SUPER_ADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'super-admin@example.com',
    'super-admin': process.env.SUPER_ADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'super-admin@example.com',
    'bodegaadmin': process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL || 'tenant-admin@example.com',
    'bodega-admin': process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL || 'tenant-admin@example.com',
    'tenantadmin': process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL || 'tenant-admin@example.com',
    'tenant-admin': process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL || 'tenant-admin@example.com',
  };
  return String(aliases[normalized] || normalized).trim().toLowerCase();
}

function unsafeMissingUsersFallbackAllowed() {
  const explicit = String(process.env.DASHBOARD_MISSING_USERS_TABLE_FALLBACK || "").trim().toLowerCase();
  const allowed = explicit === "1" || explicit === "true" || explicit === "yes" || explicit === "on";
  const production = [process.env.VERCEL_ENV, process.env.NODE_ENV]
    .some((value) => String(value || "").trim().toLowerCase() === "production");
  return allowed && !production;
}

function authHeaders(traceId: string, extra: Record<string, string> = {}) {
  return {
    'cache-control': 'no-store',
    'x-nexid-trace-id': traceId,
    'x-request-id': traceId,
    ...extra,
  };
}

function usablePasswordHash(value: unknown) {
  const candidate = String(value || '');
  return /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/i.test(candidate) ? candidate : INVALID_PASSWORD_SENTINEL;
}

function abuseGuardErrorCode(error: unknown) {
  if (error instanceof LoginAbuseGuardUnavailableError) return error.code;
  const databaseCode = String((error as { code?: string } | null)?.code || '').trim();
  return databaseCode ? `database_${databaseCode}` : 'login_rate_limit_store_unavailable';
}

async function clearAbuseGuardAfterSuccess(
  reservation: LoginAttemptReservation | null,
  failClosed: boolean,
  traceId: string,
) {
  if (!reservation) return true;
  try {
    await clearSuccessfulLoginAttempt(sql as any, reservation);
    return true;
  } catch (error) {
    console.warn('[login_abuse_guard_clear_failed]', JSON.stringify({
      reason: abuseGuardErrorCode(error),
      failClosed,
      traceId,
    }));
    return !failClosed;
  }
}

export async function POST(req: Request) {
  const endpointLimit = await enforceCriticalRateLimit(req, {
    rateClass: 'auth',
    tenantId: 'platform',
    subjectId: 'admin-login:unauthenticated',
  });
  if (endpointLimit) return endpointLimit;
  let body: { email?: string; password?: string; mfaCode?: string; };
  try {
    body = await readBoundedJsonBody<typeof body>(req, 8 * 1024);
  } catch (error) {
    return json(
      { ok: false, reason: error instanceof RequestBodyTooLargeError ? 'request_body_too_large' : 'invalid_json' },
      error instanceof RequestBodyTooLargeError ? 413 : 400,
      { 'cache-control': 'no-store' },
    );
  }
  const email = normalizeLoginEmail(String(body.email || ''));
  const password = String(body.password || '').slice(0, 256);
  const mfaCode = String(body.mfaCode || '').replace(/\D/g, '').slice(0, 8);
  if (!email || !password) return json({ ok: false, reason: 'credentials required' }, 400, { 'cache-control': 'no-store' });

  const requestMeta = getRequestMeta(req);
  const meta = { ...requestMeta, ip: null as string | null };
  const failClosed = shouldFailClosedLoginAbuseGuard();
  let reservation: LoginAttemptReservation | null = null;
  try {
    const policy = getLoginRateLimitPolicy();
    const clientIp = requestMeta.ip;
    if (!clientIp) throw new LoginAbuseGuardUnavailableError('login_trusted_client_ip_unavailable');
    meta.ip = clientIp;

    // This preserves the repository's runtime-schema compatibility while the
    // migration remains the production source of truth.
    await ensureEnterpriseIamSchema();
    reservation = await reserveLoginAttempt(sql as any, { subject: email, clientIp }, policy);
  } catch (error) {
    console.warn('[login_abuse_guard_unavailable]', JSON.stringify({
      reason: abuseGuardErrorCode(error),
      failClosed,
      traceId: meta.traceId,
    }));
    if (failClosed) {
      return json(
        { ok: false, reason: 'authentication unavailable' },
        503,
        authHeaders(meta.traceId, { 'retry-after': '60' }),
      );
    }
  }

  if (reservation?.limited) {
    await auditAuthEvent(sql as any, {
      email,
      eventName: 'login_rate_limited',
      ok: false,
      ...meta,
      meta: { reason: 'attempt_budget_exhausted', source: 'dashboard' },
    }).catch(() => null);
    return json(
      { ok: false, reason: 'invalid credentials' },
      429,
      authHeaders(meta.traceId, { 'retry-after': String(reservation.retryAfterSeconds) }),
    );
  }

  let user;
  try {
    await ensurePresetUser(sql as any, email, { context: 'login' });
    user = await getAuthUserByEmail(sql as any, email);
  } catch (error) {
    const code = String((error as { code?: string } | null)?.code || "");
    if (code === "42P01") {
      if (unsafeMissingUsersFallbackAllowed()) {
        const fallback = {
          "super-admin": { email: "superadmin@nexid.lat", password: process.env.DASHBOARD_SUPERADMIN_FALLBACK_PASSWORD || "", role: "super-admin", label: "Super Admin" },
          "tenant-admin": { email: "demobodega@nexid.lat", password: process.env.DASHBOARD_TENANT_FALLBACK_PASSWORD || "", role: "tenant-admin", label: "Bodega Balmec Admin" },
        } as const;
        const matched = Object.values(fallback).find((entry) => entry.email === email && entry.password && entry.password === password);
        if (matched) {
          if (!await clearAbuseGuardAfterSuccess(reservation, failClosed, meta.traceId)) {
            return json({ ok: false, reason: 'authentication unavailable' }, 503, authHeaders(meta.traceId, { 'retry-after': '60' }));
          }
          return json({ ok: true, email: matched.email, role: matched.role, label: matched.label, permissions: ["*"], mfaRequired: false, sessionToken: `local.${Buffer.from(email).toString("base64url")}`, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), fallback: "missing_users_table_local_only" }, 200, authHeaders(meta.traceId));
        }
      }
      return json({ ok: false, reason: "authentication unavailable" }, 503, authHeaders(meta.traceId, { 'retry-after': '60' }));
    }
    throw error;
  }

  const userStatus = String(user && typeof user === "object" && "admin_status" in user ? (user as { admin_status?: string }).admin_status || "active" : "active");
  const passwordMatches = verifyPassword(password, usablePasswordHash(user?.password_hash));
  if (!user || !passwordMatches || userStatus !== 'active') {
    const blockedAccount = Boolean(user && passwordMatches && userStatus !== 'active');
    await auditAuthEvent(sql as any, {
      email,
      eventName: blockedAccount ? 'login_blocked' : 'login_failed',
      ok: false,
      role: user ? user.role : undefined,
      ...meta,
      meta: blockedAccount
        ? { reason: 'user_not_active', source: 'dashboard', userStatus }
        : { reason: 'invalid_credentials', source: 'dashboard' },
    }).catch(() => null);
    return json({ ok: false, reason: 'invalid credentials' }, 401, authHeaders(meta.traceId));
  }

  if (!roleAllowsHumanSession(user.role)) {
    await auditAuthEvent(sql as any, {
      email,
      eventName: 'login_blocked',
      ok: false,
      role: user.role,
      ...meta,
      meta: { reason: 'non_human_service_role', source: 'dashboard' },
    }).catch(() => null);
    return json({ ok: false, reason: 'invalid credentials' }, 401, authHeaders(meta.traceId));
  }

  if (user.mfa_enabled) {
    await auditAuthEvent(sql as any, {
      email,
      eventName: 'mfa_login_unavailable',
      ok: false,
      role: user.role,
      ...meta,
      meta: { source: 'dashboard', reason: 'legacy_plaintext_factor_disabled' },
    }).catch(() => null);
    return json(
      { ok: false, reason: 'mfa_login_temporarily_unavailable', mfaRequired: true },
      503,
      authHeaders(meta.traceId, { 'retry-after': '86400' }),
    );
  }

  if (!await clearAbuseGuardAfterSuccess(reservation, failClosed, meta.traceId)) {
    return json({ ok: false, reason: 'authentication unavailable' }, 503, authHeaders(meta.traceId, { 'retry-after': '60' }));
  }
  const session = await createSession(sql as any, { user, ...meta, mfaVerified: user.mfa_enabled });
  await auditAuthEvent(sql as any, { email, eventName: 'login', ok: true, role: user.role, ...meta, meta: { source: 'dashboard', mfaVerified: user.mfa_enabled } }).catch(() => null);

  return json({
    ok: true,
    email: user.email,
    role: normalizeRole(user.role),
    label: user.label,
    permissions: user.permissions,
    mfaRequired: false,
    sessionToken: `${session.id}.${session.secret}`,
    expiresAt: session.expiresAt,
  }, 200, authHeaders(meta.traceId));
}
