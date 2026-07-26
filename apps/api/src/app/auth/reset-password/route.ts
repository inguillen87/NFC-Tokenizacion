export const runtime = 'nodejs';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { auditAuthEvent, sha256 } from '../../../lib/iam';
import { hashPassword } from '../../../lib/password';
import { getRequestMeta } from '../../../lib/request-meta';
import { ensureEnterpriseIamSchema } from '../../../lib/commercial-runtime-schema';
import { enforceCriticalRateLimit } from '../../../lib/critical-rate-limit';
import { RequestBodyTooLargeError, readBoundedJsonBody } from '../../../lib/bounded-request-body';

export async function POST(req: Request) {
  const limited = await enforceCriticalRateLimit(req, { rateClass: 'auth', tenantId: 'platform', subjectId: 'admin-reset-password:unauthenticated' });
  if (limited) return limited;
  let body: { token?: string; password?: string };
  try {
    body = await readBoundedJsonBody<typeof body>(req, 8 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? 'request_body_too_large' : 'invalid_json' }, tooLarge ? 413 : 400);
  }
  const token = String(body.token || '').trim().slice(0, 256);
  const password = String(body.password || '');
  if (!token || password.length < 12 || password.length > 256) return json({ ok: false, reason: 'token and strong password required' }, 400);
  const meta = getRequestMeta(req);
  await ensureEnterpriseIamSchema();
  const tokenExists = await sql/*sql*/`
    SELECT id
    FROM password_reset_tokens
    WHERE token_hash = ${sha256(token)}
      AND consumed_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `;
  if (!tokenExists[0]) return json({ ok: false, reason: 'invalid or expired token' }, 400);
  const passwordHash = hashPassword(password);
  const rows = await sql/*sql*/`
    WITH consumed_token AS MATERIALIZED (
      UPDATE password_reset_tokens token_row
      SET consumed_at = now()
      WHERE token_row.token_hash = ${sha256(token)}
        AND token_row.consumed_at IS NULL
        AND token_row.expires_at > now()
      RETURNING token_row.id, token_row.user_id
    ),
    credential_write AS (
      INSERT INTO password_credentials (user_id, password_hash)
      SELECT user_id, ${passwordHash}
      FROM consumed_token
      ON CONFLICT (user_id)
      DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()
      RETURNING user_id
    ),
    user_activation AS (
      UPDATE users user_row
      SET admin_status = 'active'::admin_user_status, updated_at = now()
      FROM consumed_token
      WHERE user_row.id = consumed_token.user_id
      RETURNING user_row.id
    ),
    other_tokens_consumed AS (
      UPDATE password_reset_tokens other_token
      SET consumed_at = now()
      FROM consumed_token
      WHERE other_token.user_id = consumed_token.user_id
        AND other_token.id <> consumed_token.id
        AND other_token.consumed_at IS NULL
      RETURNING other_token.id
    ),
    invites_consumed AS (
      UPDATE user_invites invite
      SET consumed_at = now(), updated_at = now()
      FROM consumed_token
      JOIN users invited_user ON invited_user.id = consumed_token.user_id
      WHERE lower(invite.email) = lower(invited_user.email)
        AND invite.consumed_at IS NULL
      RETURNING invite.id
    ),
    revoked_sessions AS (
      UPDATE auth_sessions session
      SET revoked_at = now(), last_seen_at = now()
      FROM consumed_token
      WHERE session.user_id = consumed_token.user_id
        AND session.revoked_at IS NULL
      RETURNING session.id
    )
    SELECT consumed_token.user_id, user_row.email,
      COALESCE((
        SELECT membership.role::text
        FROM memberships membership
        WHERE membership.user_id = consumed_token.user_id
        ORDER BY CASE membership.role
          WHEN 'super_admin' THEN 1 WHEN 'tenant_admin' THEN 2 WHEN 'reseller' THEN 3 WHEN 'viewer' THEN 4 ELSE 9
        END
        LIMIT 1
      ), 'viewer') AS role,
      (SELECT count(*) FROM credential_write) AS credential_count,
      (SELECT count(*) FROM user_activation) AS activation_count,
      (SELECT count(*) FROM other_tokens_consumed) AS consumed_token_count,
      (SELECT count(*) FROM invites_consumed) AS consumed_invite_count,
      (SELECT count(*) FROM revoked_sessions) AS revoked_session_count
    FROM consumed_token
    JOIN users user_row ON user_row.id = consumed_token.user_id
  `;
  const row = rows[0];
  if (!row) return json({ ok: false, reason: 'invalid or expired token' }, 400);
  await auditAuthEvent(sql as any, { email: String(row.email), eventName: 'password_reset_completed', ok: true, role: String(row.role), ...meta }).catch(() => null);
  return json({ ok: true });
}
