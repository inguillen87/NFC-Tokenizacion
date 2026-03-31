export const runtime = 'nodejs';

import { sql } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { requireApiSession } from '../../../../lib/auth-guard';

export async function POST(req: Request) {
  const { error, session } = await requireApiSession(req);
  if (error || !session) return error;
  await sql`DELETE FROM user_mfa_factors WHERE user_id = ${session.userId}::uuid`;
  await sql`UPDATE auth_sessions SET mfa_verified = false WHERE user_id = ${session.userId}::uuid`;
  return json({ ok: true });
}
