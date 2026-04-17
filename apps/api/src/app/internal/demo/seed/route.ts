export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { seedDemoPack } from '../../../../lib/demo-seed';

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  try {
    const result = await seedDemoPack({
      pack: String(body.pack || 'wine-secure'),
      forceBid: String(body.forceBid || body.bid || '').trim() || undefined,
    });
    return json(result);
  } catch (error) {
    const err = error as Error;
    return json({ ok: false, reason: err.message }, 500);
  }
}
