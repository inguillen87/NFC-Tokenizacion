export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.nexid.lat';

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as any));
  const bid = String(body.bid || 'DEMO-2026-02');
  const count = Math.min(Math.max(Number(body.count || 10), 1), 20);
  const mode = String(body.mode || 'valid');
  const uids = ['04B7723410E2AD','04B7723410E2AE','04B7723410E2AF','04B7723410E2B0','04B7723410E2B1','04B7723410E2B2','04B7723410E2B3','04B7723410E2B4','04B7723410E2B5','04B7723410E2B6'];

  const results = [];
  for (let i=0;i<count;i++) {
    const action = mode === 'tamper' ? 'uncork' : mode === 'replay' ? 'retail_scan' : 'verify';
    const r = await fetch(`${API_BASE}/internal/demo/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: req.headers.get('authorization') || '' },
      body: JSON.stringify({ bid, uidHex: uids[i % uids.length], action, city: i % 2 ? 'São Paulo' : 'Mendoza', countryCode: i % 2 ? 'BR' : 'AR' }),
      cache: 'no-store',
    });
    results.push(await r.json().catch(() => ({ ok: false })));
  }

  return json({ ok: true, count: results.length, results });
}
