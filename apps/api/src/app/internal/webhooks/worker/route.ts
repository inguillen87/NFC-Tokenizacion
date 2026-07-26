export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { processWebhookDeliveryBatch } from "../../../../lib/sdk-webhooks";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { authenticateWebhookWorkerRequest } from "../../../../lib/webhook-worker-auth";

export async function POST(req: Request) {
  if (!await authenticateWebhookWorkerRequest(req)) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "webhook",
    tenantId: "platform",
    subjectId: "internal:webhook-worker",
    globalPrincipal: true,
  });
  if (rateLimited) return rateLimited;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const requestedLimit = Number(body.limit || 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 10;
  const results = await processWebhookDeliveryBatch(limit);

  return json({
    ok: true,
    claimed: results.length,
    delivered: results.filter((result) => result.status === "delivered").length,
    retry_scheduled: results.filter((result) => result.status === "retry_scheduled").length,
    dead_letter: results.filter((result) => result.status === "dead_letter").length,
    lease_lost: results.filter((result) => result.status === "lease_lost").length,
    results,
  });
}
