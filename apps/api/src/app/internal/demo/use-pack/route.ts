export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { getDemoPack } from '../../../../lib/demo-packs';
import { seedDemoPack } from '../../../../lib/demo-seed';

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const pack = String(body.pack || 'wine-secure');
  if (!getDemoPack(pack)) return json({ ok: false, reason: 'unknown pack' }, 404);

  const result = await seedDemoPack({
    pack,
    forceBid: String(body.forceBid || body.bid || '').trim() || undefined,
  });

  return json(result);
}
