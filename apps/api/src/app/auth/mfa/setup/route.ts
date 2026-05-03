export const runtime = 'nodejs';

import { sql } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { buildTotpUri, generateRecoveryCodes, generateTotpSecret, verifyTotpCode } from '../../../../lib/iam';
import { requireApiSession } from '../../../../lib/auth-guard';
import { ensureEnterpriseIamSchema } from '../../../../lib/commercial-runtime-schema';

export async function POST(req: Request) {
  const { error, session } = await requireApiSession(req);
  if (error || !session) return error;
  const body = await req.json().catch(() => ({})) as { code?: string; secret?: string };
  const code = String(body.code || '').trim();
  let secret = String(body.secret || '').trim();
  if (!secret) {
    secret = generateTotpSecret();
    return json({ ok: true, stage: 'enroll', secret, otpauthUrl: buildTotpUri(session.email, secret) });
  }
  if (!verifyTotpCode(secret, code)) return json({ ok: false, reason: 'invalid mfa code' }, 400);
  const recoveryCodes = generateRecoveryCodes();
  await ensureEnterpriseIamSchema();
  await sql`INSERT INTO user_mfa_factors (user_id, secret, recovery_codes, enabled_at, updated_at)
    VALUES (${session.userId}::uuid, ${secret}, ${JSON.stringify(recoveryCodes)}::jsonb, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, recovery_codes = EXCLUDED.recovery_codes, enabled_at = now(), updated_at = now()`;
  await sql`UPDATE auth_sessions SET mfa_verified = true WHERE id = ${session.id}::uuid`;
  return json({ ok: true, recoveryCodes });
}
