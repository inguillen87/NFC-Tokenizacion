export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { deleteConsumerAccountAndRevokeSessions, getConsumerFromRequest, sessionCookieHeader } from "../../../../lib/consumer-auth";
import { json } from "../../../../lib/http";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { enforceConsumerMutationOrigin } from "../../../../lib/consumer-mutation-origin";
export async function POST(req: Request) {
  const crossSite = enforceConsumerMutationOrigin(req);
  if (crossSite) return crossSite;
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: 'unauthorized' }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:privacy-delete` });
  if (limited) return limited;
  let deleted;
  try {
    deleted = await deleteConsumerAccountAndRevokeSessions(String(consumer.id));
  } catch {
    return json({ ok: false, error: "account_deletion_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!deleted) {
    return json({ ok: false, error: "account_state_changed" }, 409, {
      "cache-control": "no-store",
      "set-cookie": sessionCookieHeader(null),
    });
  }
  return json({ ok: true, status: "delete_requested" }, 200, {
    "cache-control": "no-store",
    "set-cookie": sessionCookieHeader(null),
  });
}
