export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, authenticated: false }, 401);
  return json({ ok: true, authenticated: true, consumer });
}
