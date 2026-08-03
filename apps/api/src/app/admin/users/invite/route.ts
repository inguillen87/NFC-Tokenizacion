export const runtime = 'nodejs';

import { sql } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { createResetToken, sha256 } from '../../../../lib/iam';
import { requireApiSession } from '../../../../lib/auth-guard';
import { ensureEnterpriseIamSchema } from '../../../../lib/commercial-runtime-schema';
import { isProductionRuntime, isProductionSecretExposureAllowed } from '../../../../lib/admin-user-management-policy';
import { resolveManagedAdminDelegationRequest } from '../../../../lib/admin-role-catalog';
import { createManagedAdminInvite } from '../../../../lib/admin-user-management';

const configuredInviteTtlMinutes = Number(process.env.ADMIN_INVITE_TTL_MINUTES || 60 * 24 * 3);
const INVITE_TTL_MINUTES = Number.isFinite(configuredInviteTtlMinutes) && configuredInviteTtlMinutes > 0
  ? Math.min(configuredInviteTtlMinutes, 60 * 24 * 30)
  : 60 * 24 * 3;

export async function POST(req: Request) {
  const { error, session } = await requireApiSession(req, 'users:manage');
  if (error || !session) return error;
  await ensureEnterpriseIamSchema();

  const body = await req.json().catch(() => ({})) as { email?: string; role?: string; tenantSlug?: string | null; permissions?: string[]; fullName?: string; permissionMode?: string };
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim() || null;
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, reason: 'valid email required' }, 400);
  }

  const delegation = await resolveManagedAdminDelegationRequest(sql as any, session, {
    role: body.role || 'viewer',
    permissions: body.permissions || [],
    permissionMode: body.permissionMode,
  });
  if (!delegation.ok) {
    return json({ ok: false, reason: delegation.reason }, delegation.status);
  }

  let tenantId: string | null = null;
  if (session.role === 'super-admin') {
    const tenantSlug = body.tenantSlug ? String(body.tenantSlug).trim().toLowerCase() : null;
    if (delegation.role === 'super_admin') {
      if (tenantSlug) return json({ ok: false, reason: 'super_admin_must_be_global' }, 400);
    } else {
      if (!tenantSlug) return json({ ok: false, reason: 'tenant_required' }, 400);
      tenantId = (await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`)[0]?.id || null;
      if (!tenantId) return json({ ok: false, reason: 'tenant_not_found' }, 404);
    }
  } else {
    tenantId = session.tenantId;
  }

  const token = createResetToken();
  const userId = await createManagedAdminInvite(sql as any, {
    email,
    fullName,
    tenantId,
    role: delegation.role,
    permissions: delegation.permissions,
    invitedBy: session.userId || null,
    tokenHash: sha256(token),
    ttlMinutes: INVITE_TTL_MINUTES,
  });
  if (!userId) return json({ ok: false, reason: 'user_already_exists' }, 409);

  const allowDevLink = isProductionSecretExposureAllowed(process.env.NODE_ENV, process.env.DEV_EXPOSE_ACTIVATION_LINK, process.env.VERCEL_ENV);
  const activationLink = allowDevLink
    ? `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3002'}/reset-password?token=${encodeURIComponent(token)}`
    : undefined;

  return json({
    ok: true,
    userId,
    inviteExpiresInMinutes: INVITE_TTL_MINUTES,
    activationToken: isProductionRuntime(process.env.NODE_ENV, process.env.VERCEL_ENV) ? undefined : token,
    activationLink,
  });
}
