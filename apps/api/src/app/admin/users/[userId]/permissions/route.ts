export const runtime = 'nodejs';

import { sql } from '../../../../../lib/db';
import { json } from '../../../../../lib/http';
import { requireApiSession } from '../../../../../lib/auth-guard';
import { isUuidString } from '../../../../../lib/iam';
import { resolveAdminUserDelegation } from '../../../../../lib/admin-user-management-policy';
import { replaceManagedAdminUserAccess } from '../../../../../lib/admin-user-management';

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error, session } = await requireApiSession(req, 'users:manage');
  if (error || !session) return error;

  const { userId } = await params;
  if (!isUuidString(userId)) return json({ ok: false, reason: 'invalid_user_id' }, 400);

  const body = await req.json().catch(() => ({})) as { permissions?: string[]; role?: string; tenantSlug?: string | null };
  const delegation = resolveAdminUserDelegation(session, body.role || 'viewer', body.permissions || []);
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

  const managedUserId = await replaceManagedAdminUserAccess(sql as any, {
    targetUserId: userId,
    actorIsSuperAdmin: session.role === 'super-admin',
    actorTenantId: session.tenantId,
    tenantId,
    role: delegation.role,
    permissions: delegation.permissions,
  });
  if (!managedUserId) return json({ ok: false, reason: 'managed_user_out_of_scope' }, 403);

  return json({ ok: true, userId: managedUserId });
}
