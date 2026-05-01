export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.nexid.lat';
const UIDS = ['04B7723410E2AD','04B7723410E2AE','04B7723410E2AF','04B7723410E2B0','04B7723410E2B1','04B7723410E2B2','04B7723410E2B3','04B7723410E2B4','04B7723410E2B5','04B7723410E2B6'];

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as any));
  const uidHex = body.uidHex || UIDS[Math.floor(Math.random() * UIDS.length)];
  const mode = String(body.mode || 'valid');
  const action = body.action || (mode === 'tamper' ? 'uncork' : mode === 'replay' ? 'retail_scan' : 'verify');
  const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim() : 'Mendoza';
  const countryCode = typeof body.countryCode === 'string' && body.countryCode.trim() ? body.countryCode.trim().toUpperCase() : 'AR';
  const lat = typeof body.lat === 'number' && Number.isFinite(body.lat) ? body.lat : -32.8895;
  const lng = typeof body.lng === 'number' && Number.isFinite(body.lng) ? body.lng : -68.8458;
  const deviceLabel = typeof body.deviceLabel === 'string' && body.deviceLabel.trim() ? body.deviceLabel.trim() : `Demo scanner - ${city}`;

  const response = await fetch(`${API_BASE}/internal/demo/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: req.headers.get('authorization') || '' },
    body: JSON.stringify({ bid: 'DEMO-2026-02', uidHex, action, city, countryCode, lat, lng, deviceLabel }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({ ok: false }));
  return json({ ok: response.ok, payload, mode, uidHex }, response.status);
}
