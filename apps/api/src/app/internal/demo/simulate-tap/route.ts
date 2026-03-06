export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';
const UIDS = ['04B7723410E2AD','04B7723410E2AE','04B7723410E2AF','04B7723410E2B0','04B7723410E2B1','04B7723410E2B2','04B7723410E2B3','04B7723410E2B4','04B7723410E2B5','04B7723410E2B6'];

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as any));
  const uidHex = body.uidHex || UIDS[Math.floor(Math.random() * UIDS.length)];
  const mode = String(body.mode || 'valid');
  const action = mode === 'tamper' ? 'uncork' : mode === 'replay' ? 'retail_scan' : 'verify';

  const response = await fetch(`${API_BASE}/internal/demo/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: req.headers.get('authorization') || '' },
    body: JSON.stringify({ bid: 'DEMO-2026-02', uidHex, action, city: 'Mendoza', countryCode: 'AR', lat: -32.8895, lng: -68.8458 }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({ ok: false }));
  return json({ ok: response.ok, payload, mode, uidHex }, response.status);
}
