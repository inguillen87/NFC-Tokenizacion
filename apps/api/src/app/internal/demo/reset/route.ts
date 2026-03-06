export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  await sql`DELETE FROM tenants WHERE slug='demobodega'`;
  return json({ ok: true, message: 'Demo Bodega reset complete' });
}
