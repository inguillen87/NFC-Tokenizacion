export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { revokeConsumerSessionFromRequest, sessionCookieHeader } from "../../../../lib/consumer-auth";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { enforceConsumerMutationOrigin } from "../../../../lib/consumer-mutation-origin";

export async function POST(req: Request) {
  const crossSite = enforceConsumerMutationOrigin(req);
  if (crossSite) return crossSite;
  const limited = await enforceCriticalRateLimit(req, { rateClass: "auth", tenantId: "platform", subjectId: "consumer-logout" });
  if (limited) return limited;
  try {
    await revokeConsumerSessionFromRequest(req);
  } catch {
    console.error("[consumer_auth_audit]", JSON.stringify({ event: "consumer_session_logout_failed", at: new Date().toISOString() }));
    return new Response(JSON.stringify({ ok: false, error: "session_revocation_unavailable" }, null, 2), {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  return new Response(JSON.stringify({ ok: true }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": sessionCookieHeader(null),
    },
  });
}
