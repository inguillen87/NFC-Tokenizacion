export const runtime = 'nodejs';

import { sql } from '../../../../../lib/db';
import { json } from '../../../../../lib/http';
import { requireApiSession } from '../../../../../lib/auth-guard';

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error } = await requireApiSession(req, 'users:manage');
  if (error) return error;
  const { userId } = await params;
  const body = await req.json().catch(() => ({})) as { permissions?: string[]; role?: string; tenantSlug?: string | null };
  const permissions = Array.isArray(body.permissions) ? body.permissions.map((item) => String(item)) : [];
  const role = String(body.role || 'viewer').replace('-', '_');
  const tenantSlug = body.tenantSlug ? String(body.tenantSlug).trim().toLowerCase() : null;
  const tenantId = tenantSlug ? (await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`)[0]?.id || null : null;
  await sql`DELETE FROM memberships WHERE user_id = ${userId}::uuid`;
  await sql`INSERT INTO memberships (user_id, tenant_id, role) VALUES (${userId}::uuid, ${tenantId}::uuid, ${role}::membership_role)`;
  await sql`DELETE FROM resource_permissions WHERE user_id = ${userId}::uuid`;
  for (const entry of permissions) {
    const [resource, action] = entry.split(':');
    if (resource && action) await sql`INSERT INTO resource_permissions (user_id, resource, action) VALUES (${userId}::uuid, ${resource}, ${action}) ON CONFLICT DO NOTHING`;
  }
  return json({ ok: true });
}
