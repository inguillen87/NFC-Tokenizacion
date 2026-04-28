export const runtime = 'nodejs';

import { sql } from '../../../../../lib/db';
import { json } from '../../../../../lib/http';
import { createResetToken, sha256 } from '../../../../../lib/iam';
import { requireApiSession } from '../../../../../lib/auth-guard';

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error } = await requireApiSession(req, 'users:manage');
  if (error) return error;
  const { userId } = await params;
  const token = createResetToken();
  await sql`UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = ${userId}::uuid AND consumed_at IS NULL`;
  await sql`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, meta) VALUES (${userId}::uuid, ${sha256(token)}, now() + interval '30 minutes', '{"source":"admin"}'::jsonb)`;
  const exposeResetToken = String(process.env.DEV_EXPOSE_RESET_TOKEN || '').toLowerCase() === 'true';
  return json({ ok: true, resetToken: exposeResetToken ? token : undefined });
}
