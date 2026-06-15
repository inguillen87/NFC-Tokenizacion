export const runtime = 'nodejs';

import { sql } from '../../../../../lib/db';
import { json } from '../../../../../lib/http';
import { requireApiSession } from '../../../../../lib/auth-guard';

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error, session } = await requireApiSession(req, 'users:manage');
  if (error || !session) return error;

  const { userId } = await params;

  if (session.role !== 'super-admin') {
    const targetMembership = await sql`
      SELECT tenant_id FROM memberships WHERE user_id = ${userId}::uuid LIMIT 1
    `;
    if (targetMembership.length === 0 || targetMembership[0].tenant_id !== session.tenantId) {
      return json({ ok: false, reason: 'unauthorized tenant boundary' }, 403);
    }
  }

  const body = await req.json().catch(() => ({})) as { permissions?: string[]; role?: string; tenantSlug?: string | null };
  const permissions = Array.isArray(body.permissions) ? body.permissions.map((item) => String(item)) : [];
  let role = String(body.role || 'viewer').replace('-', '_');

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

  await sql`DELETE FROM memberships WHERE user_id = ${userId}::uuid`;
  await sql`INSERT INTO memberships (user_id, tenant_id, role) VALUES (${userId}::uuid, ${tenantId}::uuid, ${role}::membership_role)`;
  await sql`DELETE FROM resource_permissions WHERE user_id = ${userId}::uuid`;

  for (const entry of permissions) {
    const [resource, action] = entry.split(':');
    if (resource && action) await sql`INSERT INTO resource_permissions (user_id, resource, action) VALUES (${userId}::uuid, ${resource}, ${action}) ON CONFLICT DO NOTHING`;
  }

  return json({ ok: true });
}
