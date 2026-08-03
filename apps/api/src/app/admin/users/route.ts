export const runtime = 'nodejs';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { hashPassword } from '../../../lib/password';
import { requireApiSession } from '../../../lib/auth-guard';
import { resolveManagedAdminDelegationRequest } from '../../../lib/admin-role-catalog';
import { createManagedAdminUser } from '../../../lib/admin-user-management';

export async function GET(req: Request) {
  const { error, session } = await requireApiSession(req, 'users:manage');
  if (error || !session) return error;

  let rows;
  if (session.role === 'super-admin') {
    rows = await sql/*sql*/`
      SELECT u.id, u.email, COALESCE(u.full_name, split_part(u.email, '@', 1)) AS label,
        COALESCE(m.role::text, 'viewer') AS role, t.slug AS tenant_slug,
        u.admin_status::text AS admin_status,
        EXISTS (SELECT 1 FROM user_mfa_factors umf WHERE umf.user_id = u.id) AS mfa_enabled,
        COALESCE(json_agg(DISTINCT CASE WHEN rp.resource = '*' AND rp.action = '*' THEN '*' ELSE rp.resource || ':' || rp.action END) FILTER (WHERE rp.id IS NOT NULL AND rp.effect = 'allow'), '[]'::json) AS permissions
      FROM users u
      LEFT JOIN memberships m ON m.user_id = u.id
      LEFT JOIN tenants t ON t.id = m.tenant_id
      LEFT JOIN resource_permissions rp
        ON rp.user_id = u.id
       AND rp.tenant_id IS NOT DISTINCT FROM m.tenant_id
      GROUP BY u.id, u.email, u.full_name, u.admin_status, m.role, t.slug
      ORDER BY u.created_at DESC
      LIMIT 200
    `;
  } else {
    rows = await sql/*sql*/`
      SELECT u.id, u.email, COALESCE(u.full_name, split_part(u.email, '@', 1)) AS label,
        COALESCE(m.role::text, 'viewer') AS role, t.slug AS tenant_slug,
        u.admin_status::text AS admin_status,
        EXISTS (SELECT 1 FROM user_mfa_factors umf WHERE umf.user_id = u.id) AS mfa_enabled,
        COALESCE(json_agg(DISTINCT CASE WHEN rp.resource = '*' AND rp.action = '*' THEN '*' ELSE rp.resource || ':' || rp.action END) FILTER (WHERE rp.id IS NOT NULL AND rp.effect = 'allow'), '[]'::json) AS permissions
      FROM users u
      JOIN memberships m ON m.user_id = u.id
      LEFT JOIN tenants t ON t.id = m.tenant_id
      LEFT JOIN resource_permissions rp
        ON rp.user_id = u.id
       AND rp.tenant_id IS NOT DISTINCT FROM m.tenant_id
      WHERE m.tenant_id = ${session.tenantId}::uuid
      GROUP BY u.id, u.email, u.full_name, u.admin_status, m.role, t.slug
      ORDER BY u.created_at DESC
      LIMIT 200
    `;
  }
  return json({ ok: true, users: rows });
}

export async function POST(req: Request) {
  const { error, session } = await requireApiSession(req, 'users:manage');
  if (error || !session) return error;

  const body = await req.json().catch(() => ({})) as { email?: string; fullName?: string; password?: string; role?: string; tenantSlug?: string | null; permissions?: string[]; permissionMode?: string };
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.fullName || '').trim() || null;

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return json({ ok: false, reason: 'valid email and password(8+) required' }, 400);
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

  const userId = await createManagedAdminUser(sql as any, {
    email,
    fullName,
    passwordHash: hashPassword(password),
    tenantId,
    role: delegation.role,
    permissions: delegation.permissions,
  });
  if (!userId) return json({ ok: false, reason: 'user_already_exists' }, 409);

  return json({ ok: true, userId });
}
