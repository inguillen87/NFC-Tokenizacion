export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sessionCookieHeader } from "../../../../lib/consumer-auth";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

export async function POST(req: Request) {
  const limited = await enforceCriticalRateLimit(req, { rateClass: "auth", tenantId: "platform", subjectId: "consumer-logout" });
  if (limited) return limited;
  return new Response(JSON.stringify({ ok: true }, null, 2), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "set-cookie": sessionCookieHeader(null) },
  });
}
