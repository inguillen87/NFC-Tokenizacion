export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { seedDemoPack } from '../../../../lib/demo-seed';
import {
  DEMO_BATCH_BID,
  inspectReservedDemoBatch,
  requireReservedDemoBatch,
  validateDemoResourceScopeRequest,
} from '../../../../lib/demo-resource-scope';

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const requestScope = validateDemoResourceScopeRequest(req, body);
  if (!requestScope.ok) return json({ ok: false, reason: requestScope.reason }, requestScope.status);

  try {
    // seedDemoPack upserts by BID, so existing ownership must be checked first.
    const existingBatch = await inspectReservedDemoBatch();
    if (!existingBatch.ok) return json({ ok: false, reason: existingBatch.reason }, existingBatch.status);

    const result = await seedDemoPack({
      pack: String(body.pack || 'wine-secure'),
      forceBid: DEMO_BATCH_BID,
    });
    const seededBatch = await requireReservedDemoBatch();
    if (!seededBatch.ok) return json({ ok: false, reason: seededBatch.reason }, seededBatch.status);

    const shouldGenerate = body.generateLiveEvents !== false;
    const eventCount = Math.max(0, Math.min(Number(body.eventCount || 20), 120));
    if (shouldGenerate && result.ok && result.bid) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
      const authHeader = req.headers.get("authorization") || "";
      const cities = [
        { city: "Mendoza", countryCode: "AR", lat: -32.8895, lng: -68.8458 },
        { city: "San Martín", countryCode: "AR", lat: -33.081, lng: -68.468 },
        { city: "Luján de Cuyo", countryCode: "AR", lat: -33.039, lng: -68.883 },
        { city: "Buenos Aires", countryCode: "AR", lat: -34.6037, lng: -58.3816 },
      ];
      const uids = Array.isArray((result as { uids?: string[] }).uids) ? (result as { uids?: string[] }).uids! : [];
      for (let i = 0; i < eventCount; i += 1) {
        const uidHex = uids.length ? uids[i % uids.length] : "";
        const place = cities[i % cities.length];
        await fetch(`${apiBase}/internal/demo/scan`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: authHeader },
          cache: "no-store",
          body: JSON.stringify({
            bid: DEMO_BATCH_BID,
            uidHex,
            action: i % 9 === 0 ? "uncork" : i % 5 === 0 ? "retail_scan" : "verify",
            city: place.city,
            countryCode: place.countryCode,
            lat: place.lat,
            lng: place.lng,
          }),
        }).catch(() => null);
      }
    }
    return json(result);
  } catch (error) {
    const err = error as Error;
    return json({ ok: false, reason: err.message }, 500);
  }
}
