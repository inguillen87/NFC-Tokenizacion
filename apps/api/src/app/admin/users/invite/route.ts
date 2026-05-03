export const runtime = 'nodejs';

import { sql } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { createResetToken, sha256 } from '../../../../lib/iam';
import { requireApiSession } from '../../../../lib/auth-guard';
import { ensureEnterpriseIamSchema } from '../../../../lib/commercial-runtime-schema';

const INVITE_TTL_MINUTES = Number(process.env.ADMIN_INVITE_TTL_MINUTES || 60 * 24 * 3);

export async function POST(req: Request) {
  const { error, session } = await requireApiSession(req, 'users:manage');
  if (error || !session) return error;
  await ensureEnterpriseIamSchema();

  const body = await req.json().catch(() => ({})) as { email?: string; role?: string; tenantSlug?: string | null; permissions?: string[]; fullName?: string };
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim() || null;
  const role = String(body.role || 'viewer').replace('-', '_');
  if (!email) return json({ ok: false, reason: 'email required' }, 400);

  const tenantSlug = body.tenantSlug ? String(body.tenantSlug).trim().toLowerCase() : null;
  const tenantId = tenantSlug ? (await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`)[0]?.id || null : null;
  const permissions = Array.isArray(body.permissions) && body.permissions.length
    ? body.permissions.map((item) => String(item))
    : ['events:read', 'analytics:read'];

  const userRows = await sql`INSERT INTO users (email, full_name, admin_status)
    VALUES (${email}, ${fullName}, 'invited'::admin_user_status)
    ON CONFLICT (email) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, users.full_name), admin_status = 'invited'::admin_user_status
    RETURNING id`;
  const userId = userRows[0]?.id;
  if (!userId) return json({ ok: false, reason: 'failed to create invite user' }, 500);

  await sql`DELETE FROM memberships WHERE user_id = ${userId}::uuid`;
  await sql`INSERT INTO memberships (user_id, tenant_id, role) VALUES (${userId}::uuid, ${tenantId}::uuid, ${role}::membership_role)`;

  await sql`DELETE FROM resource_permissions WHERE user_id = ${userId}::uuid`;
  for (const entry of permissions) {
    const [resource, action] = entry.split(':');
    if (resource && action) await sql`INSERT INTO resource_permissions (user_id, resource, action) VALUES (${userId}::uuid, ${resource}, ${action}) ON CONFLICT DO NOTHING`;
  }

  const token = createResetToken();
  await sql`UPDATE user_invites SET consumed_at = now() WHERE email = ${email} AND consumed_at IS NULL`;
  await sql`INSERT INTO user_invites (email, role, tenant_id, permissions, invited_by, token_hash, expires_at)
    VALUES (${email}, ${role}::membership_role, ${tenantId}::uuid, ${JSON.stringify(permissions)}::jsonb, ${session.userId || null}::uuid, ${sha256(token)}, now() + (${INVITE_TTL_MINUTES} * interval '1 minute'))`;

  await sql`UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = ${userId}::uuid AND consumed_at IS NULL`;
  await sql`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, meta)
    VALUES (${userId}::uuid, ${sha256(token)}, now() + (${INVITE_TTL_MINUTES} * interval '1 minute'), ${JSON.stringify({ source: 'invite', email })}::jsonb)`;

  const allowDevLink = String(process.env.DEV_EXPOSE_ACTIVATION_LINK || '').toLowerCase() === 'true';
  const activationLink = allowDevLink
    ? `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3002'}/reset-password?token=${encodeURIComponent(token)}`
    : undefined;

  return json({ ok: true, inviteExpiresInMinutes: INVITE_TTL_MINUTES, activationToken: process.env.NODE_ENV === 'production' ? undefined : token, activationLink });
}
