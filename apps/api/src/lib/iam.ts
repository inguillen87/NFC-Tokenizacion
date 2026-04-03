import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
export const SESSION_IDLE_MS = 1000 * 60 * 30;
export const RESET_TOKEN_TTL_MS = 1000 * 60 * 30;

const MFA_WINDOW_SECONDS = 30;

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

type UserRole = "super_admin" | "tenant_admin" | "reseller" | "viewer";

export type AuthUser = {
  id: string;
  email: string;
  label: string;
  role: UserRole;
  tenant_id: string | null;
  password_hash: string;
  permissions: string[];
  mfa_enabled: boolean;
};

export type SessionRecord = {
  id: string;
  userId: string;
  email: string;
  label: string;
  role: "super-admin" | "tenant-admin" | "reseller" | "viewer";
  permissions: string[];
  mfaVerified: boolean;
  expiresAt: string;
  rotatedCookieValue: string | null;
};

export function normalizeRole(role: string): "super-admin" | "tenant-admin" | "reseller" | "viewer" {
  return (role || "viewer").replaceAll("_", "-") as ReturnType<typeof normalizeRole>;
}

export function denormalizeRole(role: string): UserRole {
  return (role || "viewer").replaceAll("-", "_") as UserRole;
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

export function parsePermissions(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  return [];
}

export function hasPermission(session: { role: string; permissions: string[] }, permission?: string | null) {
  if (!permission) return true;
  if (session.role === "super-admin") return true;
  return session.permissions.includes(permission);
}

export async function getAuthUserByEmail(sql: Sql, email: string): Promise<AuthUser | null> {
  const rows = await sql/*sql*/`
    SELECT
      u.id,
      u.email,
      COALESCE(u.full_name, split_part(u.email, '@', 1)) AS label,
      pc.password_hash,
      COALESCE(m.role::text, 'viewer') AS role,
      m.tenant_id,
      COALESCE(json_agg(DISTINCT rp.resource || ':' || rp.action) FILTER (WHERE rp.id IS NOT NULL), '[]'::json) AS permissions,
      EXISTS (SELECT 1 FROM user_mfa_factors umf WHERE umf.user_id = u.id) AS mfa_enabled
    FROM users u
    JOIN password_credentials pc ON pc.user_id = u.id
    LEFT JOIN memberships m ON m.user_id = u.id
    LEFT JOIN resource_permissions rp ON rp.user_id = u.id
    WHERE lower(u.email) = ${email}
    GROUP BY u.id, u.email, u.full_name, pc.password_hash, m.role, m.tenant_id
    ORDER BY CASE m.role
      WHEN 'super_admin' THEN 1
      WHEN 'tenant_admin' THEN 2
      WHEN 'reseller' THEN 3
      WHEN 'viewer' THEN 4
      ELSE 9
    END
    LIMIT 1
  `;
  const row = rows[0] as AuthUser | undefined;
  return row ? { ...row, permissions: parsePermissions((row as any).permissions) } : null;
}

export async function auditAuthEvent(sql: Sql, payload: { email: string; eventName: string; ok: boolean; role?: string | null; ip?: string | null; userAgent?: string | null; meta?: Record<string, unknown> }) {
  await sql/*sql*/`
    INSERT INTO user_auth_events (email, event_name, ok, role, ip, user_agent, meta)
    VALUES (${payload.email}, ${payload.eventName}, ${payload.ok}, ${payload.role || null}, ${payload.ip || null}, ${payload.userAgent || null}, ${JSON.stringify(payload.meta || {})}::jsonb)
  `;
}

export async function createSession(sql: Sql, payload: { user: AuthUser; ip?: string | null; userAgent?: string | null; mfaVerified: boolean; }) {
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

export async function resolveSession(sql: Sql, cookieValue: string | undefined | null) : Promise<SessionRecord | null> {
  const parsed = parseSessionCookie(cookieValue);
  if (!parsed) return null;
  const rows = await sql/*sql*/`
    SELECT s.id, s.user_id, s.session_token_hash, s.role::text AS role, s.permissions, s.mfa_verified, s.expires_at, s.last_seen_at, s.revoked_at,
      u.email, COALESCE(u.full_name, split_part(u.email, '@', 1)) AS label
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${parsed.sessionId}::uuid
    LIMIT 1
  `;
  const session = rows[0];
  if (!session || session.revoked_at) return null;
  if (!safeCompare(sha256(parsed.secret), String(session.session_token_hash))) return null;
  const now = Date.now();
  if (new Date(session.expires_at).getTime() <= now) return null;
  const idleMs = now - new Date(session.last_seen_at).getTime();
  let rotatedCookieValue: string | null = null;
  if (idleMs > SESSION_IDLE_MS / 2) {
    const newSecret = createSessionSecret();
    await sql/*sql*/`
      UPDATE auth_sessions
      SET session_token_hash = ${sha256(newSecret)}, last_seen_at = now(), expires_at = now() + interval '12 hours'
      WHERE id = ${parsed.sessionId}::uuid
    `;
    rotatedCookieValue = sessionCookieValue(parsed.sessionId, newSecret);
  } else {
    await sql/*sql*/`UPDATE auth_sessions SET last_seen_at = now(), expires_at = now() + interval '12 hours' WHERE id = ${parsed.sessionId}::uuid`;
  }
  return {
    id: String(session.id),
    userId: String(session.user_id),
    email: String(session.email),
    label: String(session.label),
    role: normalizeRole(String(session.role)),
    permissions: parsePermissions(session.permissions),
    mfaVerified: Boolean(session.mfa_verified),
    rotatedCookieValue,
    expiresAt: String(session.expires_at),
  };
}

export async function revokeSession(sql: Sql, cookieValue: string | undefined | null) {
  const parsed = parseSessionCookie(cookieValue);
  if (!parsed) return null;
  const rows = await sql/*sql*/`
    UPDATE auth_sessions
    SET revoked_at = now(), last_seen_at = now()
    WHERE id = ${parsed.sessionId}::uuid AND revoked_at IS NULL
    RETURNING user_id
  `;
  return rows[0] || null;
}
