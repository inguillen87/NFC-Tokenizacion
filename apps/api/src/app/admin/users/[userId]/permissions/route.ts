export const runtime = 'nodejs';

import { sql } from '../../../../../lib/db';
import { json } from '../../../../../lib/http';
import { requireApiSession } from '../../../../../lib/auth-guard';
import { isUuidString } from '../../../../../lib/iam';
import { resolveManagedAdminDelegationRequest } from '../../../../../lib/admin-role-catalog';
import { resolveAdminUserPermissionOverrides } from '../../../../../lib/admin-user-management-policy';
import {
  getManagedAdminUserAccess,
  replaceManagedAdminUserPermissionOverrides,
  replaceManagedAdminUserRole,
} from '../../../../../lib/admin-user-management';

type PermissionUpdateBody = {
  allowPermissions?: unknown;
  deniedPermissions?: unknown;
  permissionMode?: unknown;
  permissions?: unknown;
  role?: unknown;
  tenantSlug?: unknown;
};

async function requestedTenantId(session: {
  role: string;
  tenantId: string | null;
}, tenantSlugInput: unknown) {
  if (session.role !== 'super-admin') return session.tenantId;
  const tenantSlug = String(tenantSlugInput || '').trim().toLowerCase();
  if (!tenantSlug) return null;
  const rows = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
  return rows[0]?.id ? String(rows[0].id) : undefined;
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error, session, meta } = await requireApiSession(req, 'users:manage');
  if (error || !session) return error;

  const { userId } = await params;
  if (!isUuidString(userId)) return json({ ok: false, reason: 'invalid_user_id' }, 400);

  const body = await req.json().catch(() => ({})) as PermissionUpdateBody;
  const permissionMode = String(body.permissionMode || '').trim().toLowerCase();

  if (permissionMode === 'explicit_overrides') {
    if (body.role !== undefined || body.permissions !== undefined
      || body.allowPermissions === undefined || body.deniedPermissions === undefined) {
      return json({ ok: false, reason: 'explicit_override_contract_required' }, 400);
    }

    const tenantId = await requestedTenantId(session, body.tenantSlug);
    if (tenantId === undefined) return json({ ok: false, reason: 'tenant_not_found' }, 404);
    const target = await getManagedAdminUserAccess(sql as any, {
      targetUserId: userId,
      actorIsSuperAdmin: session.role === 'super-admin',
      actorTenantId: session.tenantId,
      tenantId,
    });
    if (!target) return json({ ok: false, reason: 'managed_user_out_of_scope' }, 403);

    const overrides = resolveAdminUserPermissionOverrides(
      session,
      target.role,
      body.allowPermissions,
      body.deniedPermissions,
      target.roleDefaultPermissions,
    );
    if (!overrides.ok) {
      return json({ ok: false, reason: overrides.reason }, overrides.status);
    }

    const managedUserId = await replaceManagedAdminUserPermissionOverrides(sql as any, {
      targetUserId: userId,
      actorUserId: session.userId,
      actorIsSuperAdmin: session.role === 'super-admin',
      actorTenantId: session.tenantId,
      tenantId,
      role: overrides.role,
      allowPermissions: overrides.allowPermissions,
      deniedPermissions: overrides.deniedPermissions,
      roleDefaultPermissions: target.roleDefaultPermissions,
      ipAddress: meta.ip,
      requestId: meta.traceId,
      userAgent: meta.userAgent,
    });
    if (!managedUserId) return json({ ok: false, reason: 'managed_user_out_of_scope' }, 403);

    return json({
      ok: true,
      userId: managedUserId,
      permissionMode: 'explicit_overrides',
      permissions: overrides.allowPermissions,
      deniedPermissions: overrides.deniedPermissions,
    });
  }

  if (body.allowPermissions !== undefined || body.deniedPermissions !== undefined) {
    return json({ ok: false, reason: 'role_default_client_permissions_forbidden' }, 400);
  }
  const delegation = await resolveManagedAdminDelegationRequest(sql as any, session, {
    role: body.role || 'viewer',
    permissions: body.permissions,
    permissionMode,
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

  const managedUserId = await replaceManagedAdminUserRole(sql as any, {
    targetUserId: userId,
    actorIsSuperAdmin: session.role === 'super-admin',
    actorTenantId: session.tenantId,
    tenantId,
    role: delegation.role,
  });
  if (!managedUserId) return json({ ok: false, reason: 'managed_user_out_of_scope' }, 403);

  return json({ ok: true, userId: managedUserId, permissionMode: 'role_default' });
}
