export const runtime = 'nodejs';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { hashPassword } from '../../../lib/password';
import { requireApiSession } from '../../../lib/auth-guard';

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
        COALESCE(json_agg(DISTINCT rp.resource || ':' || rp.action) FILTER (WHERE rp.id IS NOT NULL), '[]'::json) AS permissions
      FROM users u
      LEFT JOIN memberships m ON m.user_id = u.id
      LEFT JOIN tenants t ON t.id = m.tenant_id
      LEFT JOIN resource_permissions rp ON rp.user_id = u.id
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
        COALESCE(json_agg(DISTINCT rp.resource || ':' || rp.action) FILTER (WHERE rp.id IS NOT NULL), '[]'::json) AS permissions
      FROM users u
      JOIN memberships m ON m.user_id = u.id
      LEFT JOIN tenants t ON t.id = m.tenant_id
      LEFT JOIN resource_permissions rp ON rp.user_id = u.id
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

  const body = await req.json().catch(() => ({})) as { email?: string; fullName?: string; password?: string; role?: string; tenantSlug?: string | null; permissions?: string[]; adminStatus?: string };
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.fullName || '').trim() || null;
  let role = String(body.role || 'viewer').replace('-', '_');
  const permissions = Array.isArray(body.permissions) ? body.permissions.map((item) => String(item)) : [];
  const adminStatus = String(body.adminStatus || 'active');

  if (!email || password.length < 8) return json({ ok: false, reason: 'email and password(8+) required' }, 400);

  if (session.role !== 'super-admin') {
    if (role === 'super_admin') {
      role = 'tenant_admin';
    }
  }

  let tenantId = null;
  if (session.role === 'super-admin') {
    const tenantSlug = body.tenantSlug ? String(body.tenantSlug).trim().toLowerCase() : null;
    tenantId = tenantSlug ? (await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`)[0]?.id || null : null;
  } else {
    tenantId = session.tenantId;
  }

  const userId = (await sql`INSERT INTO users (email, full_name, admin_status) VALUES (${email}, ${fullName}, ${adminStatus}::admin_user_status) ON CONFLICT (email) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, users.full_name), admin_status = EXCLUDED.admin_status RETURNING id`)[0]?.id;
  await sql`INSERT INTO password_credentials (user_id, password_hash) VALUES (${userId}::uuid, ${hashPassword(password)}) ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`;
  await sql`DELETE FROM memberships WHERE user_id = ${userId}::uuid`;
  await sql`INSERT INTO memberships (user_id, tenant_id, role) VALUES (${userId}::uuid, ${tenantId}::uuid, ${role}::membership_role)`;
  await sql`DELETE FROM resource_permissions WHERE user_id = ${userId}::uuid`;

  for (const entry of permissions) {
    const [resource, action] = entry.split(':');
    if (resource && action) await sql`INSERT INTO resource_permissions (user_id, resource, action) VALUES (${userId}::uuid, ${resource}, ${action}) ON CONFLICT DO NOTHING`;
  }

  return json({ ok: true, userId });
}
