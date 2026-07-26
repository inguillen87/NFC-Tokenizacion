export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { cancelConsumerRewardClaim } from "../../../../../lib/consumer-reward-service";

export async function POST(req: Request, { params }: { params: Promise<{ redemptionId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:redemption-cancel` });
  if (limited) return limited;
  await ensureConsumerPortalSchema();

  const { redemptionId } = await params;
  const normalizedRedemptionId = String(redemptionId || "").trim();
  if (!normalizedRedemptionId) return json({ ok: false, error: "redemptionId_required" }, 400);

  const result = await cancelConsumerRewardClaim({ consumerId: consumer.id, claimId: normalizedRedemptionId });
  if (!result.ok) return json({ ok: false, error: result.error }, 404);
  return json({ ok: true, claim: result.claim, duplicate: result.duplicate });
}
