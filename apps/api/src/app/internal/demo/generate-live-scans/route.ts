export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import {
  DEMO_BATCH_BID,
  requireReservedDemoBatch,
  validateDemoResourceScopeRequest,
} from '../../../../lib/demo-resource-scope';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.nexid.lat';

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const requestScope = validateDemoResourceScopeRequest(req, body);
  if (!requestScope.ok) return json({ ok: false, reason: requestScope.reason }, requestScope.status);

  const batchScope = await requireReservedDemoBatch();
  if (!batchScope.ok) return json({ ok: false, reason: batchScope.reason }, batchScope.status);

  const count = Math.min(Math.max(Number(body.count || 10), 1), 20);
  const mode = String(body.mode || 'valid');
  const uids = ['0487856A0B1090','048A876A0B1090','0483846A0B1090','047F846A0B1090','047B846A0B1090','0477846A0B1090','0474856A0B1090','0470856A0B1090','0483826A0B1090','0465846A0B1090'];

  const results = [];
  for (let i=0;i<count;i++) {
    const action = mode === 'tamper' ? 'uncork' : mode === 'replay' ? 'retail_scan' : 'verify';
    const r = await fetch(`${API_BASE}/internal/demo/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: req.headers.get('authorization') || '' },
      body: JSON.stringify({ bid: DEMO_BATCH_BID, uidHex: uids[i % uids.length], action, city: i % 2 ? 'São Paulo' : 'Mendoza', countryCode: i % 2 ? 'BR' : 'AR' }),
      cache: 'no-store',
    });
    results.push(await r.json().catch(() => ({ ok: false })));
  }

  return json({ ok: true, count: results.length, results });
}
