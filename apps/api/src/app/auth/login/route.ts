export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { ensurePresetUser } from '../../../lib/auth-presets';
import { verifyPassword } from '../../../lib/password';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string; password?: string };
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '').trim();
  if (!email || !password) return json({ ok: false, reason: 'email and password required' }, 400);

  await ensurePresetUser(sql as any, email);

  const rows = await sql/*sql*/`
    SELECT u.id, u.email, COALESCE(u.full_name, split_part(u.email, '@', 1)) AS label, pc.password_hash, m.role
    FROM users u
    JOIN password_credentials pc ON pc.user_id = u.id
    LEFT JOIN memberships m ON m.user_id = u.id
    WHERE lower(u.email) = ${email}
    ORDER BY CASE m.role
      WHEN 'super_admin' THEN 1
      WHEN 'tenant_admin' THEN 2
      WHEN 'reseller' THEN 3
      WHEN 'viewer' THEN 4
      ELSE 9
    END
    LIMIT 1
  `;
  const user = rows[0];
  if (!user || !verifyPassword(password, String(user.password_hash || ''))) {
    return json({ ok: false, reason: 'invalid credentials' }, 401);
  }

  try {
    await sql/*sql*/`
      INSERT INTO user_auth_events (email, event_name, ok, role, meta)
      VALUES (${email}, 'login', true, ${String(user.role || 'viewer')}, ${JSON.stringify({ source: 'dashboard' })}::jsonb)
    `;
  } catch {}

  return json({ ok: true, email: user.email, role: String(user.role || 'viewer').replace('_', '-'), label: user.label });
}
