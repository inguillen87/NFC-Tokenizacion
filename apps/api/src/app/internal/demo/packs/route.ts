export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { listDemoPacks } from '../../../../lib/demo-packs';

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const packs = listDemoPacks().map((p) => ({ key: p.key, icType: p.icType, batchId: p.batchId }));
  return json({ ok: true, packs });
}
