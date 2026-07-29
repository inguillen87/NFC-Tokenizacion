export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { getDemoPack } from '../../../../lib/demo-packs';
import { seedDemoPack } from '../../../../lib/demo-seed';
import {
  DEMO_BATCH_BID,
  inspectReservedDemoBatch,
  requireReservedDemoBatch,
  validateDemoResourceScopeRequest,
} from '../../../../lib/demo-resource-scope';

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const requestScope = validateDemoResourceScopeRequest(req, body);
  if (!requestScope.ok) return json({ ok: false, reason: requestScope.reason }, requestScope.status);
  const pack = String(body.pack || 'wine-secure');
  if (!getDemoPack(pack)) return json({ ok: false, reason: 'unknown pack' }, 404);

  const existingBatch = await inspectReservedDemoBatch();
  if (!existingBatch.ok) return json({ ok: false, reason: existingBatch.reason }, existingBatch.status);

  const result = await seedDemoPack({
    pack,
    forceBid: DEMO_BATCH_BID,
  });
  const seededBatch = await requireReservedDemoBatch();
  if (!seededBatch.ok) return json({ ok: false, reason: seededBatch.reason }, seededBatch.status);

  return json(result);
}
