export const runtime = 'nodejs';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { createResetToken, sha256 } from '../../../lib/iam';

export async function POST(req: Request) {
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

  const userId = (await sql`INSERT INTO users (email, full_name, admin_status)
    VALUES (${email}, ${fullName}, 'pending_activation'::admin_user_status)
    ON CONFLICT (email) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, users.full_name), admin_status = 'pending_activation'::admin_user_status
    RETURNING id`)[0]?.id;

  const token = createResetToken();
  await sql`UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = ${userId}::uuid AND consumed_at IS NULL`;
  await sql`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, meta)
    VALUES (${userId}::uuid, ${sha256(token)}, now() + interval '30 minutes', ${JSON.stringify({ source: 'self_register', email })}::jsonb)`;

  return json({ ok: true, mode: 'pending_activation', activationToken: process.env.NODE_ENV === 'production' ? undefined : token });
}
