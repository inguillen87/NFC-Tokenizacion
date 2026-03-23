export const runtime = 'nodejs';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { auditAuthEvent, sha256 } from '../../../lib/iam';
import { hashPassword } from '../../../lib/password';
import { getRequestMeta } from '../../../lib/request-meta';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { token?: string; password?: string };
  const token = String(body.token || '').trim();
  const password = String(body.password || '');
  if (!token || password.length < 8) return json({ ok: false, reason: 'token and strong password required' }, 400);
  const meta = getRequestMeta(req);
  const rows = await sql/*sql*/`
    SELECT prt.user_id, u.email, COALESCE(m.role::text, 'viewer') AS role
    FROM password_reset_tokens prt
    JOIN users u ON u.id = prt.user_id
    LEFT JOIN memberships m ON m.user_id = u.id
    WHERE prt.token_hash = ${sha256(token)}
      AND prt.consumed_at IS NULL
      AND prt.expires_at > now()
    ORDER BY CASE m.role WHEN 'super_admin' THEN 1 WHEN 'tenant_admin' THEN 2 WHEN 'reseller' THEN 3 WHEN 'viewer' THEN 4 ELSE 9 END
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return json({ ok: false, reason: 'invalid or expired token' }, 400);
  await sql`UPDATE password_credentials SET password_hash = ${hashPassword(password)}, updated_at = now() WHERE user_id = ${row.user_id}::uuid`;
  await sql`UPDATE password_reset_tokens SET consumed_at = now() WHERE token_hash = ${sha256(token)} AND consumed_at IS NULL`;
  await sql`UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ${row.user_id}::uuid AND revoked_at IS NULL`;
  await auditAuthEvent(sql as any, { email: String(row.email), eventName: 'password_reset_completed', ok: true, role: String(row.role), ...meta }).catch(() => null);
  return json({ ok: true });
}
