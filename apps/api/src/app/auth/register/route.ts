export const runtime = 'nodejs';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { createResetToken, sha256 } from '../../../lib/iam';
import { ensureEnterpriseIamSchema } from '../../../lib/commercial-runtime-schema';
import { isProductionRuntime } from '../../../lib/admin-user-management-policy';

export async function POST(req: Request) {
  await ensureEnterpriseIamSchema();
  const body = await req.json().catch(() => ({})) as { email?: string; fullName?: string; company?: string; tenantSlug?: string; role?: string };
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim() || null;
  const company = String(body.company || '').trim() || null;
  const tenantSlug = String(body.tenantSlug || '').trim().toLowerCase() || null;
  const role = String(body.role || 'tenant_admin').replace('-', '_');
  if (!email) return json({ ok: false, reason: 'email required' }, 400);

  const selfRegistrationEnabled = String(process.env.ENABLE_ADMIN_SELF_REGISTRATION || '').toLowerCase() === 'true';
  if (!selfRegistrationEnabled) {
    await sql`INSERT INTO access_requests (email, full_name, company, tenant_slug, role_requested, meta)
      VALUES (${email}, ${fullName}, ${company}, ${tenantSlug}, ${role}, ${JSON.stringify({ source: 'dashboard_register' })}::jsonb)`;
    return json({ ok: true, mode: 'request_access', message: 'access request submitted' });
  }

  const token = createResetToken();
  const createdRows = await sql/*sql*/`
    WITH existing_user AS MATERIALIZED (
      SELECT id
      FROM users
      WHERE lower(email) = ${email}
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE
    ),
    new_user AS (
      INSERT INTO users (email, full_name, admin_status)
      SELECT ${email}, ${fullName}, 'pending_activation'::admin_user_status
      WHERE NOT EXISTS (SELECT 1 FROM existing_user)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    ),
    new_reset_token AS (
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, meta)
      SELECT id, ${sha256(token)}, now() + interval '30 minutes',
        ${JSON.stringify({ source: 'self_register', email })}::jsonb
      FROM new_user
      RETURNING id
    )
    SELECT new_user.id, (SELECT count(*) FROM new_reset_token) AS reset_count
    FROM new_user
  `;
  const userId = createdRows[0]?.id ? String(createdRows[0].id) : null;

  return json({
    ok: true,
    mode: 'pending_activation',
    activationToken: userId && !isProductionRuntime(process.env.NODE_ENV, process.env.VERCEL_ENV) ? token : undefined,
  });
}
