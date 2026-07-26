export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { json } from "../../../../lib/http";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

export async function POST(req: Request) {
  const sourceLimited = await enforceCriticalRateLimit(req, {
    rateClass: "auth",
    tenantId: "platform",
    subjectId: "consumer-associate-verify:source",
  });
  if (sourceLimited) return sourceLimited;
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  return json({
    ok: false,
    error: "contact_linking_temporarily_unavailable",
    state: "feature_disabled",
    detail: "No OTP was consumed, no contact was changed and no loyalty points were awarded.",
  }, 503, { "cache-control": "no-store" });
}
