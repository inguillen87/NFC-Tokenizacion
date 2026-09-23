import { batchWorkbenchPermissions } from "./batch-workbench-permissions";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { ensureEnterpriseIamSchema } from "./commercial-runtime-schema";
import { permissionDenied, permissionMatches } from "./permission-matcher.js";
import { roleMayUseEnterpriseCapability } from "./enterprise-capability-policy";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
export const SESSION_IDLE_MS = 1000 * 60 * 30;
export const RESET_TOKEN_TTL_MS = 1000 * 60 * 30;

const MFA_WINDOW_SECONDS = 30;

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

export const ENTERPRISE_USER_ROLES = [
  "tenant_owner", "tenant_admin", "security_analyst", "operations_manager",
  "packaging_operator", "marketing_manager", "viewer", "reseller_admin",
  "api_integration", "super_admin", "security_operator", "reseller", "supplier_operator",
] as const;

export type UserRole = (typeof ENTERPRISE_USER_ROLES)[number];
export type SessionRole =
  | "tenant-owner" | "tenant-admin" | "security-analyst" | "operations-manager"
  | "packaging-operator" | "marketing-manager" | "viewer" | "reseller-admin"
  | "api-integration" | "super-admin" | "security-operator" | "reseller" | "supplier-operator";

const USER_ROLE_SET = new Set<string>(ENTERPRISE_USER_ROLES);
const HUMAN_SESSION_ROLES = new Set<UserRole>(ENTERPRISE_USER_ROLES.filter((role) => role !== "api_integration"));

export type AuthUser = {
  id: string;
  email: string;
  label: string;
  admin_status: "invited" | "pending_activation" | "active" | "disabled";
  role: UserRole;
  tenant_id: string | null;
  password_hash: string;
  permissions: string[];
  deniedPermissions: string[];
  mfa_enabled: boolean;
};

export type SessionRecord = {
  id: string;
  userId: string;
  email: string;
  label: string;
  role: SessionRole;
  tenantId: string | null;
  tenantSlug: string | null;
  permissions: string[];
  deniedPermissions?: string[];
  mfaVerified: boolean;
  expiresAt: string;
  rotatedCookieValue: string | null;
  setupCompleted: boolean;
};

export function normalizeRole(role: string): SessionRole {
  const normalized = String(role || "viewer").trim().toLowerCase().replaceAll("-", "_");
  const safeRole = USER_ROLE_SET.has(normalized) ? normalized : "viewer";
  return safeRole.replaceAll("_", "-") as SessionRole;
}

export function denormalizeRole(role: string): UserRole {
  const normalized = String(role || "viewer").trim().toLowerCase().replaceAll("-", "_");
  return (USER_ROLE_SET.has(normalized) ? normalized : "viewer") as UserRole;
}

export function roleAllowsHumanSession(role: string) {
  return HUMAN_SESSION_ROLES.has(denormalizeRole(role));
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken(size = 32) {
  return randomBytes(size).toString("base64url");
}

export function createResetToken() {
  return `rst_${createOpaqueToken(24)}`;
}

export function createSessionSecret() {
  return createOpaqueToken(32);
}

export function generateRecoveryCodes() {
  return Array.from({ length: 6 }, () => randomBytes(4).toString("hex").toUpperCase());
}

function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function base32Encode(input: Buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of input) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += alphabet[Number.parseInt(chunk, 2)];
  }
  return output;
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function buildTotpUri(email: string, secret: string) {
  const issuer = encodeURIComponent("nexID Dashboard");
  const label = encodeURIComponent(`nexID:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=${MFA_WINDOW_SECONDS}`;
}

export function verifyTotpCode(secret: string, code: string, now = Date.now()) {
  const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);
  if (cleanCode.length !== 6) return false;
  const key = base32Decode(secret);
  for (const offset of [-1, 0, 1]) {
    const counter = Math.floor(now / 1000 / MFA_WINDOW_SECONDS) + offset;
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));
    const digest = createHmac("sha1", key).update(buf).digest();
    const pos = digest[digest.length - 1] & 0x0f;
    const truncated = (digest.readUInt32BE(pos) & 0x7fffffff) % 1_000_000;
    if (truncated.toString().padStart(6, "0") === cleanCode) return true;
  }
  return false;
}

export function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function sessionCookieValue(sessionId: string, secret: string) {
  return `${sessionId}.${secret}`;
}

export function parseSessionCookie(value: string | undefined | null) {
  if (!value) return null;
  const [sessionId, secret] = value.split(".");
  if (!sessionId || !secret) return null;
  return { sessionId, secret };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidString(value: string | undefined | null) {
  return Boolean(value && UUID_RE.test(value));
}

export function roleTenantBindingValid(role: string, tenantId: unknown) {
  const normalized = String(role || "").trim().toLowerCase().replaceAll("-", "_");
  if (!USER_ROLE_SET.has(normalized)) return false;
  if (normalized === "super_admin" || normalized === "supplier_operator") return tenantId === null;
  return isUuidString(typeof tenantId === "string" ? tenantId : null);
}

export function isEnterpriseRoleProfileTenantBindingValid(profile: {
  role?: unknown;
  tenant_id?: unknown;
  role_profile_tenant_bound?: unknown;
}) {
  const normalized = String(profile.role || "").trim().toLowerCase().replaceAll("-", "_");
  if (!USER_ROLE_SET.has(normalized)) return false;
  const expectedTenantBound = normalized !== "super_admin" && normalized !== "supplier_operator";
  return profile.role_profile_tenant_bound === expectedTenantBound
    && roleTenantBindingValid(normalized, profile.tenant_id);
}

export function parsePermissions(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  return [];
}

export function hasPermission(session: { role: string; permissions: string[]; deniedPermissions?: string[] }, permission?: string | null) {
  if (!permission) return true;
  const role = String(session.role || "").replaceAll("_", "-");
  if (!roleMayUseEnterpriseCapability(role, permission)) return false;
  if (role === "super-admin") return !permissionDenied(session.deniedPermissions, permission);
  return permissionMatches(session.permissions, permission, session.deniedPermissions);
}

export function isActiveHumanEnterpriseRoleProfile(profile: {
  role_profile_active?: unknown;
  role_profile_human_session_allowed?: unknown;
}) {
  return profile.role_profile_active === true
    && profile.role_profile_human_session_allowed === true;
}

async function hasEnterpriseRoleProfiles(sql: Sql) {
  const rows = await sql/*sql*/`
    SELECT to_regclass('public.enterprise_role_profiles') IS NOT NULL AS ready
  `;
  return rows[0]?.ready === true;
}

export function currentRolePermissions(input: { role: string; permissions: string[]; deniedPermissions?: string[] }) {
  if (input.role.replaceAll("_", "-") !== "supplier-operator") return batchWorkbenchPermissions(input);
  return ["supplier_request.assigned.read", "supplier_request.assigned.review"].filter(cap =>
    permissionMatches(input.permissions.filter(value => roleMayUseEnterpriseCapability(input.role, value)), cap, input.deniedPermissions));
}

export async function getAuthUserByEmail(sql: Sql, email: string): Promise<AuthUser | null> {
  await ensureEnterpriseIamSchema();
  const roleProfilesReady = await hasEnterpriseRoleProfiles(sql);
  const rows = roleProfilesReady ? await sql/*sql*/`
    SELECT
      u.id,
      u.email,
      COALESCE(u.full_name, split_part(u.email, '@', 1)) AS label,
      u.admin_status,
      pc.password_hash,
      COALESCE(m.role::text, 'viewer') AS role,
      m.tenant_id,
      COALESCE(json_agg(DISTINCT CASE
        WHEN rp.resource = '*' AND rp.action = '*' THEN '*'
        ELSE rp.resource || ':' || rp.action
      END) FILTER (WHERE rp.id IS NOT NULL AND rp.effect = 'allow'), '[]'::json) AS permissions,
      COALESCE(json_agg(DISTINCT CASE
        WHEN rp.resource = '*' AND rp.action = '*' THEN '*'
        ELSE rp.resource || ':' || rp.action
      END) FILTER (WHERE rp.id IS NOT NULL AND rp.effect = 'deny'), '[]'::json) AS denied_permissions,
      COALESCE(role_profile.default_permissions, '[]'::jsonb) AS role_default_permissions,
      role_profile.active AS role_profile_active,
      role_profile.human_session_allowed AS role_profile_human_session_allowed,
      role_profile.tenant_bound AS role_profile_tenant_bound,
      EXISTS (SELECT 1 FROM user_mfa_factors umf WHERE umf.user_id = u.id) AS mfa_enabled
    FROM users u
    LEFT JOIN password_credentials pc ON pc.user_id = u.id
    LEFT JOIN memberships m ON m.user_id = u.id
    LEFT JOIN resource_permissions rp
      ON rp.user_id = u.id
     AND rp.tenant_id IS NOT DISTINCT FROM m.tenant_id
    JOIN enterprise_role_profiles role_profile
      ON role_profile.code = m.role::text
     AND role_profile.active = true
     AND role_profile.human_session_allowed = true
    WHERE lower(u.email) = ${email}
      AND (
        m.role = 'super_admin'::membership_role
        OR 1 = (
          SELECT count(*)
          FROM memberships active_membership
          WHERE active_membership.user_id = u.id
        )
      )
    GROUP BY u.id, u.email, u.full_name, u.admin_status, pc.password_hash, m.role, m.tenant_id,
      role_profile.default_permissions, role_profile.active, role_profile.human_session_allowed,
      role_profile.tenant_bound
    ORDER BY CASE m.role
      WHEN 'super_admin' THEN 1
      WHEN 'tenant_owner' THEN 2
      WHEN 'tenant_admin' THEN 3
      WHEN 'security_operator' THEN 4
      WHEN 'security_analyst' THEN 5
      WHEN 'operations_manager' THEN 6
      WHEN 'packaging_operator' THEN 7
      WHEN 'marketing_manager' THEN 8
      WHEN 'reseller_admin' THEN 9
      WHEN 'reseller' THEN 10
      WHEN 'viewer' THEN 11
      WHEN 'api_integration' THEN 12
      ELSE 9
    END, m.tenant_id ASC NULLS FIRST, m.role::text ASC
    LIMIT 1
  ` : await sql/*sql*/`
    SELECT
      u.id,
      u.email,
      COALESCE(u.full_name, split_part(u.email, '@', 1)) AS label,
      u.admin_status,
      pc.password_hash,
      COALESCE(m.role::text, 'viewer') AS role,
      m.tenant_id,
      COALESCE(json_agg(DISTINCT CASE
        WHEN rp.resource = '*' AND rp.action = '*' THEN '*'
        ELSE rp.resource || ':' || rp.action
      END) FILTER (WHERE rp.id IS NOT NULL AND rp.effect = 'allow'), '[]'::json) AS permissions,
      COALESCE(json_agg(DISTINCT CASE
        WHEN rp.resource = '*' AND rp.action = '*' THEN '*'
        ELSE rp.resource || ':' || rp.action
      END) FILTER (WHERE rp.id IS NOT NULL AND rp.effect = 'deny'), '[]'::json) AS denied_permissions,
      '[]'::jsonb AS role_default_permissions,
      EXISTS (SELECT 1 FROM user_mfa_factors umf WHERE umf.user_id = u.id) AS mfa_enabled
    FROM users u
    LEFT JOIN password_credentials pc ON pc.user_id = u.id
    LEFT JOIN memberships m ON m.user_id = u.id
    LEFT JOIN resource_permissions rp
      ON rp.user_id = u.id
     AND rp.tenant_id IS NOT DISTINCT FROM m.tenant_id
    WHERE lower(u.email) = ${email}
      AND (
        m.role = 'super_admin'::membership_role
        OR 1 = (
          SELECT count(*)
          FROM memberships active_membership
          WHERE active_membership.user_id = u.id
        )
      )
    GROUP BY u.id, u.email, u.full_name, u.admin_status, pc.password_hash, m.role, m.tenant_id
    ORDER BY CASE m.role
      WHEN 'super_admin' THEN 1 WHEN 'tenant_admin' THEN 2
      WHEN 'reseller' THEN 3 WHEN 'viewer' THEN 4 ELSE 9
    END, m.tenant_id ASC NULLS FIRST, m.role::text ASC
    LIMIT 1
  `;
  const row = rows[0] as AuthUser | undefined;
  if (!row) return null;
  if (row.role === "supplier_operator" && !roleProfilesReady) return null;
  if (!roleTenantBindingValid(row.role, row.tenant_id)) return null;
  if (roleProfilesReady && !isActiveHumanEnterpriseRoleProfile(row as AuthUser & {
    role_profile_active?: unknown;
    role_profile_human_session_allowed?: unknown;
  })) return null;
  if (roleProfilesReady && !isEnterpriseRoleProfileTenantBindingValid(row as AuthUser & {
    role_profile_tenant_bound?: unknown;
  })) return null;
  return {
    ...row,
    permissions: currentRolePermissions({role:String(row.role),permissions:[...new Set([
      ...parsePermissions((row as any).role_default_permissions),
      ...parsePermissions((row as any).permissions),
    ])],deniedPermissions:parsePermissions((row as any).denied_permissions)}),
    deniedPermissions: parsePermissions((row as any).denied_permissions),
  };
}

export async function auditAuthEvent(sql: Sql, payload: { email: string; eventName: string; ok: boolean; role?: string | null; ip?: string | null; userAgent?: string | null; meta?: Record<string, unknown> }) {
  await ensureEnterpriseIamSchema();
  await sql/*sql*/`
    INSERT INTO user_auth_events (email, event_name, ok, role, ip, user_agent, meta)
    VALUES (${payload.email}, ${payload.eventName}, ${payload.ok}, ${payload.role || null}, ${payload.ip || null}, ${payload.userAgent || null}, ${JSON.stringify(payload.meta || {})}::jsonb)
  `;
}

export async function createSession(sql: Sql, payload: { user: AuthUser; ip?: string | null; userAgent?: string | null; mfaVerified: boolean; }) {
  await ensureEnterpriseIamSchema();
  if (!roleAllowsHumanSession(payload.user.role)) throw new Error("human_session_role_forbidden");
  if (!roleTenantBindingValid(payload.user.role, payload.user.tenant_id)) {
    throw new Error("enterprise_role_tenant_binding_invalid");
  }
  const secret = createSessionSecret();
  const rows = await sql/*sql*/`
    INSERT INTO auth_sessions (user_id, session_token_hash, role, tenant_id, permissions, mfa_verified, expires_at, last_seen_at, created_ip, user_agent, meta)
    VALUES (
      ${payload.user.id}::uuid,
      ${sha256(secret)},
      ${payload.user.role}::membership_role,
      ${payload.user.tenant_id}::uuid,
      ${JSON.stringify(payload.user.permissions || [])}::jsonb,
      ${payload.mfaVerified},
      now() + interval '12 hours',
      now(),
      ${payload.ip || null},
      ${payload.userAgent || null},
      ${JSON.stringify({ email: payload.user.email })}::jsonb
    )
    RETURNING id, expires_at
  `;
  return { id: rows[0].id as string, secret, expiresAt: rows[0].expires_at };
}

export async function resolveSession(
  sql: Sql,
  cookieValue: string | undefined | null,
  options: { rotate?: boolean } = {},
): Promise<SessionRecord | null> {
  const parsed = parseSessionCookie(cookieValue);
  if (!parsed) return null;
  if (!isUuidString(parsed.sessionId)) return null;
  await ensureEnterpriseIamSchema();
  const roleProfilesReady = await hasEnterpriseRoleProfiles(sql);
  const rows = roleProfilesReady ? await sql/*sql*/`
    SELECT s.id, s.user_id, s.session_token_hash, s.role::text AS role, s.tenant_id, s.mfa_verified, s.expires_at, s.last_seen_at, s.revoked_at,
      tn.slug AS tenant_slug,
      u.email, u.admin_status, COALESCE(u.full_name, split_part(u.email, '@', 1)) AS label,
      EXISTS (
        SELECT 1
        FROM memberships current_membership
        WHERE current_membership.user_id = s.user_id
          AND current_membership.role = s.role
          AND current_membership.tenant_id IS NOT DISTINCT FROM s.tenant_id
      ) AS membership_current,
      (
        s.role = 'super_admin'::membership_role
        OR 1 = (
          SELECT count(*)
          FROM memberships active_membership
          WHERE active_membership.user_id = s.user_id
        )
      ) AS membership_scope_unambiguous,
      COALESCE((
        SELECT json_agg(DISTINCT CASE
          WHEN current_permission.resource = '*' AND current_permission.action = '*' THEN '*'
          ELSE current_permission.resource || ':' || current_permission.action
        END)
        FROM resource_permissions current_permission
        WHERE current_permission.user_id = s.user_id
          AND current_permission.tenant_id IS NOT DISTINCT FROM s.tenant_id
          AND current_permission.effect = 'allow'
      ), '[]'::json) AS current_permissions,
      COALESCE((
        SELECT json_agg(DISTINCT CASE
          WHEN current_denial.resource = '*' AND current_denial.action = '*' THEN '*'
          ELSE current_denial.resource || ':' || current_denial.action
        END)
        FROM resource_permissions current_denial
        WHERE current_denial.user_id = s.user_id
          AND current_denial.tenant_id IS NOT DISTINCT FROM s.tenant_id
          AND current_denial.effect = 'deny'
      ), '[]'::json) AS current_denied_permissions,
      COALESCE((tsp.metadata->>'setup_completed')::boolean, true) AS setup_completed,
      COALESCE(role_profile.default_permissions, '[]'::jsonb) AS role_default_permissions,
      role_profile.active AS role_profile_active,
      role_profile.human_session_allowed AS role_profile_human_session_allowed,
      role_profile.tenant_bound AS role_profile_tenant_bound
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN tenants tn ON tn.id = s.tenant_id
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = s.tenant_id
    JOIN enterprise_role_profiles role_profile
      ON role_profile.code = s.role::text
     AND role_profile.active = true
     AND role_profile.human_session_allowed = true
    WHERE s.id = ${parsed.sessionId}::uuid
    LIMIT 1
  ` : await sql/*sql*/`
    SELECT s.id, s.user_id, s.session_token_hash, s.role::text AS role, s.tenant_id, s.mfa_verified, s.expires_at, s.last_seen_at, s.revoked_at,
      tn.slug AS tenant_slug,
      u.email, u.admin_status, COALESCE(u.full_name, split_part(u.email, '@', 1)) AS label,
      EXISTS (
        SELECT 1
        FROM memberships current_membership
        WHERE current_membership.user_id = s.user_id
          AND current_membership.role = s.role
          AND current_membership.tenant_id IS NOT DISTINCT FROM s.tenant_id
      ) AS membership_current,
      (
        s.role = 'super_admin'::membership_role
        OR 1 = (
          SELECT count(*)
          FROM memberships active_membership
          WHERE active_membership.user_id = s.user_id
        )
      ) AS membership_scope_unambiguous,
      COALESCE((
        SELECT json_agg(DISTINCT CASE
          WHEN current_permission.resource = '*' AND current_permission.action = '*' THEN '*'
          ELSE current_permission.resource || ':' || current_permission.action
        END)
        FROM resource_permissions current_permission
        WHERE current_permission.user_id = s.user_id
          AND current_permission.tenant_id IS NOT DISTINCT FROM s.tenant_id
          AND current_permission.effect = 'allow'
      ), '[]'::json) AS current_permissions,
      COALESCE((
        SELECT json_agg(DISTINCT CASE
          WHEN current_denial.resource = '*' AND current_denial.action = '*' THEN '*'
          ELSE current_denial.resource || ':' || current_denial.action
        END)
        FROM resource_permissions current_denial
        WHERE current_denial.user_id = s.user_id
          AND current_denial.tenant_id IS NOT DISTINCT FROM s.tenant_id
          AND current_denial.effect = 'deny'
      ), '[]'::json) AS current_denied_permissions,
      COALESCE((tsp.metadata->>'setup_completed')::boolean, true) AS setup_completed,
      '[]'::jsonb AS role_default_permissions
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN tenants tn ON tn.id = s.tenant_id
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = s.tenant_id
    WHERE s.id = ${parsed.sessionId}::uuid
    LIMIT 1
  `;
  const session = rows[0];
  if (!session || session.revoked_at) return null;
  if (!safeCompare(sha256(parsed.secret), String(session.session_token_hash))) return null;
  const now = Date.now();
  if (new Date(session.expires_at).getTime() <= now) return null;
  if (!isSessionPrincipalCurrent(session, roleProfilesReady)) {
    await sql/*sql*/`
      UPDATE auth_sessions
      SET revoked_at = now(), last_seen_at = now()
      WHERE id = ${parsed.sessionId}::uuid AND revoked_at IS NULL
    `;
    return null;
  }
  const idleMs = now - new Date(session.last_seen_at).getTime();
  let rotatedCookieValue: string | null = null;
  let refreshedRows: Array<{ expires_at: unknown }>;
  if (options.rotate === true && idleMs > SESSION_IDLE_MS / 2) {
    const newSecret = createSessionSecret();
    refreshedRows = await sql/*sql*/`
      UPDATE auth_sessions
      SET session_token_hash = ${sha256(newSecret)}, last_seen_at = now(), expires_at = now() + interval '12 hours'
      WHERE id = ${parsed.sessionId}::uuid
        AND session_token_hash = ${String(session.session_token_hash)}
        AND revoked_at IS NULL
        AND expires_at > now()
      RETURNING expires_at
    `;
    // A concurrent request may have rotated this session after our SELECT.
    // Never return a second, already-invalid bearer: exactly one CAS winner
    // receives the authoritative rotated secret and every stale contender fails.
    if (!refreshedRows[0]) return null;
    rotatedCookieValue = sessionCookieValue(parsed.sessionId, newSecret);
  } else {
    refreshedRows = await sql/*sql*/`
      UPDATE auth_sessions
      SET last_seen_at = now(), expires_at = now() + interval '12 hours'
      WHERE id = ${parsed.sessionId}::uuid
        AND session_token_hash = ${String(session.session_token_hash)}
        AND revoked_at IS NULL
        AND expires_at > now()
      RETURNING expires_at
    `;
    if (!refreshedRows[0]) return null;
  }
  return {
    id: String(session.id),
    userId: String(session.user_id),
    email: String(session.email),
    label: String(session.label),
    role: normalizeRole(String(session.role)),
    tenantId: session.tenant_id ? String(session.tenant_id) : null,
    tenantSlug: session.tenant_slug ? String(session.tenant_slug) : null,
    permissions: currentRolePermissions({role:String(session.role),permissions:[...new Set([
      ...parsePermissions(session.role_default_permissions),
      ...parsePermissions(session.current_permissions),
    ])],deniedPermissions:parsePermissions(session.current_denied_permissions)}),
    deniedPermissions: parsePermissions(session.current_denied_permissions),
    mfaVerified: Boolean(session.mfa_verified),
    rotatedCookieValue,
    expiresAt: String(refreshedRows[0].expires_at),
    setupCompleted: Boolean(session.setup_completed),
  };
}

export function isSessionPrincipalCurrent(
  session: {
    admin_status?: unknown;
    membership_current?: unknown;
    membership_scope_unambiguous?: unknown;
    role_profile_active?: unknown;
    role_profile_human_session_allowed?: unknown;
    role_profile_tenant_bound?: unknown;
    role?: unknown;
    tenant_id?: unknown;
  },
  requireEnterpriseRoleProfile = false,
) {
  return String(session.admin_status || '').trim().toLowerCase() === 'active'
    && session.membership_current === true
    && session.membership_scope_unambiguous === true
    && roleTenantBindingValid(String(session.role || ""), session.tenant_id)
    && (!(requireEnterpriseRoleProfile || String(session.role).replaceAll("-", "_") === "supplier_operator") || (
      isActiveHumanEnterpriseRoleProfile(session)
      && isEnterpriseRoleProfileTenantBindingValid(session)
    ));
}

export async function revokeSession(sql: Sql, cookieValue: string | undefined | null) {
  const parsed = parseSessionCookie(cookieValue);
  if (!parsed) return null;
  if (!isUuidString(parsed.sessionId)) return null;
  await ensureEnterpriseIamSchema();
  const rows = await sql/*sql*/`
    UPDATE auth_sessions
    SET revoked_at = now(), last_seen_at = now()
    WHERE id = ${parsed.sessionId}::uuid AND revoked_at IS NULL
    RETURNING user_id
  `;
  return rows[0] || null;
}
