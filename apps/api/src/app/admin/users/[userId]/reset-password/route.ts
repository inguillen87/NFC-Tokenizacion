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
  await sql`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, meta) VALUES (${userId}::uuid, ${sha256(token)}, now() + interval '30 minutes', '{"source":"admin"}'::jsonb)`;
  return json({ ok: true, resetToken: process.env.NODE_ENV === 'production' ? undefined : token });
}
