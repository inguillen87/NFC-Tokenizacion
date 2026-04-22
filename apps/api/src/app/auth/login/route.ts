export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { ensurePresetUser } from '../../../lib/auth-presets';
import { verifyPassword } from '../../../lib/password';
import { auditAuthEvent, createSession, getAuthUserByEmail, normalizeRole, verifyTotpCode } from '../../../lib/iam';
import { getRequestMeta } from '../../../lib/request-meta';

function normalizeLoginEmail(rawEmail: string) {
  const normalized = String(rawEmail || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('@')) return normalized;

  const aliases: Record<string, string | undefined> = {
    'superadmin': process.env.SUPER_ADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'inguillen@nexid.lat',
    'super-admin': process.env.SUPER_ADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'inguillen@nexid.lat',
    'bodegaadmin': process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL || 'demobodega@nexid.lat',
    'bodega-admin': process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL || 'demobodega@nexid.lat',
    'tenantadmin': process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL || 'demobodega@nexid.lat',
    'tenant-admin': process.env.TENANT_ADMIN_EMAIL || process.env.BODEGA_ADMIN_EMAIL || process.env.NEXT_PUBLIC_TENANT_ADMIN_EMAIL || 'demobodega@nexid.lat',
  };
  return String(aliases[normalized] || normalized).trim().toLowerCase();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string; password?: string; mfaCode?: string; };
  const email = normalizeLoginEmail(String(body.email || ''));
  const password = String(body.password || '').trim();
  const mfaCode = String(body.mfaCode || '').trim();
  if (!email || !password) return json({ ok: false, reason: 'email and password required' }, 400);

  const meta = getRequestMeta(req);
  await ensurePresetUser(sql as any, email);
  const user = await getAuthUserByEmail(sql as any, email);

  if (!user || !verifyPassword(password, String(user.password_hash || ''))) {
    await auditAuthEvent(sql as any, { email, eventName: 'login_failed', ok: false, role: user?.role, ...meta, meta: { reason: 'invalid_credentials', source: 'dashboard' } }).catch(() => null);
    return json({ ok: false, reason: 'invalid credentials' }, 401);
  }

  if (user.mfa_enabled) {
    const factor = await sql`SELECT secret FROM user_mfa_factors WHERE user_id = ${user.id}::uuid LIMIT 1`;
    const secret = factor[0]?.secret ? String(factor[0].secret) : '';
    if (!secret || !verifyTotpCode(secret, mfaCode)) {
      await auditAuthEvent(sql as any, { email, eventName: 'mfa_challenge_failed', ok: false, role: user.role, ...meta, meta: { source: 'dashboard' } }).catch(() => null);
      return json({ ok: false, reason: 'mfa required', mfaRequired: true }, 401);
    }
    await sql`UPDATE user_mfa_factors SET last_verified_at = now(), updated_at = now() WHERE user_id = ${user.id}::uuid`;
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
  });
}
