export const runtime = 'nodejs';

import { sql } from '../../../../../lib/db';
import { json } from '../../../../../lib/http';
import { requireApiSession } from '../../../../../lib/auth-guard';
import { ensureEnterpriseIamSchema } from '../../../../../lib/commercial-runtime-schema';

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error } = await requireApiSession(req, 'users:manage');
  if (error) return error;
  await ensureEnterpriseIamSchema();
  const { userId } = await params;
  await sql`DELETE FROM user_mfa_factors WHERE user_id = ${userId}::uuid`;
  await sql`UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ${userId}::uuid AND revoked_at IS NULL`;
  return json({ ok: true });
}
