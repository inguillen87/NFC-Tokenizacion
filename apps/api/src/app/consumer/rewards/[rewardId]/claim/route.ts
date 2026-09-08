export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomUUID } from "node:crypto";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../lib/bounded-request-body";
import { insertConsumerRewardClaim } from "../../../../../lib/consumer-reward-queries";

export async function POST(req: Request, { params }: { params: Promise<{ rewardId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:reward-claim` });
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
  const idem = `consumer-reward-claim:${consumer.id}:${rewardId}`;
  const code = `NXR-${randomUUID().split('-')[0].toUpperCase()}`;
  const claimRows = await insertConsumerRewardClaim(sql, {
    consumerId: consumer.id,
    rewardId,
    idempotencyKey: idem,
    redemptionCode: code,
    locale: typeof body.locale === "string" ? body.locale.slice(0, 12) : "es-AR",
  });
  if (claimRows[0]) return json({ ok: true, claim: claimRows[0], duplicate: false });
  const existing = await sql/*sql*/`
    SELECT *
    FROM consumer_reward_claims
    WHERE idempotency_key = ${idem}
      AND consumer_id = ${consumer.id}
      AND reward_id = ${rewardId}
    LIMIT 1
  `;
  if (existing[0]) return json({ ok: true, claim: existing[0], duplicate: true });
  const eligibility = await sql/*sql*/`
    SELECT reward.id, reward.points_cost, reward.stock_remaining, member.points_balance
    FROM rewards reward
    LEFT JOIN loyalty_members member
      ON member.consumer_id = ${consumer.id}
     AND member.tenant_id = reward.tenant_id
     AND member.program_id = reward.program_id
    WHERE reward.id = ${rewardId}
    LIMIT 1
  `;
  if (!eligibility[0]) return json({ ok: false, error: "reward_not_available" }, 404);
  if (Number(eligibility[0].points_balance || 0) < Number(eligibility[0].points_cost || 0)) return json({ ok: false, error: "insufficient_points" }, 409);
  if (eligibility[0].stock_remaining !== null && Number(eligibility[0].stock_remaining) <= 0) return json({ ok: false, error: "out_of_stock" }, 409);
  return json({ ok: false, error: "reward_claim_conflict" }, 409);
}
