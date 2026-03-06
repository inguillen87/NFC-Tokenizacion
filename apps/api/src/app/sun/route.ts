export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json } from '../../lib/http';
import { processSunScan } from '../../lib/sun-service';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.SUN_RATE_LIMIT_PER_MIN || 120);
const rateMap = new Map<string, { count: number; start: number }>();

function isRateLimited(ip: string | null) {
  if (!ip) return false;
  const now = Date.now();
  const current = rateMap.get(ip);
  if (!current || now - current.start > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }
  current.count += 1;
  rateMap.set(ip, current);
  return current.count > RATE_LIMIT_MAX;
}

async function dispatchValidScanWebhook(payload: Record<string, unknown>) {
  const url = process.env.SCAN_WEBHOOK_URL;
  if (!url) return;
  const secret = process.env.SCAN_WEBHOOK_SECRET || '';
  await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-nexid-signature': secret } : {}),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  }).catch(() => null);
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const bid = url.searchParams.get('bid') || '';
  const picc_data = url.searchParams.get('picc_data') || '';
  const enc = url.searchParams.get('enc') || '';
  const cmac = url.searchParams.get('cmac') || '';

  const ua = req.headers.get('user-agent') || '';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const geoCity = req.headers.get('x-vercel-ip-city') || null;
  const geoCountry = req.headers.get('x-vercel-ip-country') || null;
  const geoLat = Number(req.headers.get('x-vercel-ip-latitude') || '');
  const geoLng = Number(req.headers.get('x-vercel-ip-longitude') || '');

  if (isRateLimited(ip)) {
    return json({ ok: false, reason: 'rate_limited', limitPerMinute: RATE_LIMIT_MAX }, 429);
  }

  if (!bid || !picc_data || !enc || !cmac) {
    return json({ ok: false, reason: 'missing params', need: ['bid', 'picc_data', 'enc', 'cmac'] }, 400);
  }

  const result = await processSunScan({
    bid,
    piccDataHex: picc_data,
    encHex: enc,
    cmacHex: cmac,
    rawQuery: Object.fromEntries(url.searchParams.entries()),
    context: {
      ip,
      userAgent: ua,
      city: geoCity,
      countryCode: geoCountry,
      lat: Number.isFinite(geoLat) ? geoLat : null,
      lng: Number.isFinite(geoLng) ? geoLng : null,
      source: 'real',
    },
  });

  if (result.body.ok) {
    void dispatchValidScanWebhook({
      event: 'tag.scan.valid',
      bid,
      uid: result.body.uid,
      counter: result.body.ctr,
      ip,
      userAgent: ua,
      geoCity,
      geoCountry,
      geoLat: Number.isFinite(geoLat) ? geoLat : null,
      geoLng: Number.isFinite(geoLng) ? geoLng : null,
      ts: new Date().toISOString(),
    });
  }

  return json(result.body, result.status);
}
