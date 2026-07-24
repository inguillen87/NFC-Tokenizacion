export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { timingSafeEqual } from "node:crypto";

import { json } from "../../../../lib/http";
import { processWebhookDeliveryBatch } from "../../../../lib/sdk-webhooks";

function secretMatches(provided: string, expected: string) {
  const left = Buffer.from(provided, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function isAuthorized(req: Request) {
  const expected = String(process.env.INTERNAL_WEBHOOK_WORKER_KEY || "").trim();
  const provided = String(req.headers.get("x-internal-webhook-key") || "").trim();
  return Boolean(expected && secretMatches(provided, expected));
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return json({ ok: false, reason: "unauthorized" }, 401);
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
