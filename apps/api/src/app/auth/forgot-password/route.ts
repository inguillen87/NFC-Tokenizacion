export const runtime = 'nodejs';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { auditAuthEvent, createResetToken, getAuthUserByEmail, RESET_TOKEN_TTL_MS, sha256 } from '../../../lib/iam';
import { getRequestMeta } from '../../../lib/request-meta';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string };
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return json({ ok: false, reason: 'email required' }, 400);
  const meta = getRequestMeta(req);
  const user = await getAuthUserByEmail(sql as any, email);
  if (!user) {
    await auditAuthEvent(sql as any, { email, eventName: 'password_reset_requested', ok: false, ...meta, meta: { reason: 'user_not_found' } }).catch(() => null);
    return json({ ok: true });
  }
  const token = createResetToken();
  await sql`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_ip, user_agent, meta)
    VALUES (${user.id}::uuid, ${sha256(token)}, now() + interval '30 minutes', ${meta.ip}, ${meta.userAgent}, ${JSON.stringify({ email })}::jsonb)`;
  await auditAuthEvent(sql as any, { email, eventName: 'password_reset_requested', ok: true, role: user.role, ...meta }).catch(() => null);
  return json({ ok: true, resetToken: process.env.NODE_ENV === 'production' ? undefined : token, expiresInMs: RESET_TOKEN_TTL_MS });
}
