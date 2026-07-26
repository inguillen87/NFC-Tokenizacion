export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../lib/bounded-request-body";
import { cancelConsumerRewardClaim } from "../../../../../lib/consumer-reward-service";

export async function POST(req: Request, { params }: { params: Promise<{ rewardId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:reward-cancel` });
  if (limited) return limited;
  const { rewardId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 8 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  await ensureConsumerPortalSchema();
  const redemptionId = String(body.redemptionId || "").trim();
  if (!redemptionId) return json({ ok: false, error: "redemptionId_required" }, 400);

  const result = await cancelConsumerRewardClaim({ consumerId: consumer.id, claimId: redemptionId, rewardId });
  if (!result.ok) return json({ ok: false, error: result.error }, 404);
  return json({ ok: true, claim: result.claim, duplicate: result.duplicate });
}
