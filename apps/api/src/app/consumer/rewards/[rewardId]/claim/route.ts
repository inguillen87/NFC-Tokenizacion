export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomUUID } from "node:crypto";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sql, sqlSerializable } from "../../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../lib/bounded-request-body";
import { insertConsumerRewardClaim, readOwnPortalRewardClaimUnderLock } from "../../../../../lib/consumer-reward-queries";
import { enforceConsumerMutationOrigin } from "../../../../../lib/consumer-mutation-origin";

export async function POST(req: Request, { params }: { params: Promise<{ rewardId: string }> }) {
  const crossSite = enforceConsumerMutationOrigin(req);
  if (crossSite) return crossSite;
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:reward-claim` });
  if (limited) return limited;
  const { rewardId: suppliedRewardId } = await params;
  if (typeof suppliedRewardId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(suppliedRewardId)) {
    return json({ ok: false, error: "invalid_reward_id" }, 400);
  }
  const rewardId = suppliedRewardId;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 8 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "invalid_body" }, 400);
  const expectedPointsCost = body.expectedPointsCost;
  if (typeof expectedPointsCost !== "number" || !Number.isSafeInteger(expectedPointsCost)
    || expectedPointsCost < 0 || expectedPointsCost > 2_147_483_647) {
    return json({ ok: false, error: "invalid_expected_points_cost" }, 400);
  }
  await ensureConsumerPortalSchema();
  const idem = `consumer-reward-claim:${consumer.id}:${rewardId}`;
  const code = `NXR-${randomUUID().split('-')[0].toUpperCase()}`;
  let serializationConflict = false;
  try {
    const claimRows = await insertConsumerRewardClaim(sqlSerializable, {
      consumerId: consumer.id, rewardId, idempotencyKey: idem, redemptionCode: code,
      locale: typeof body.locale === "string" ? body.locale.slice(0, 12) : "es-AR",
      portalFirstClaim: { expectedPointsCost },
    });
    if (claimRows[0]) return json({ ok: true, claim: claimRows[0], duplicate: false });
  } catch (error) {
    // A serializable predicate conflict is never an automatic mutation retry.
    if (String((error as { code?: unknown } | null)?.code || "") === "40001") serializationConflict = true;
    else return json({ ok: false, error: "reward_claim_unavailable", refresh_required: true }, 503);
  }
  try {
    // Semantic UUID identity shares one historical receipt, including its original key.
    const existing = await readOwnPortalRewardClaimUnderLock(sqlSerializable, { consumerId: consumer.id, rewardId });
    if (existing.state === "ambiguous") return json({ ok: false, error: "reward_claim_history_ambiguous", refresh_required: true }, 409);
    if (existing.state === "single") return json({ ok: true, claim: existing.claim, duplicate: true });
  } catch (error) {
    const status = String((error as { code?: unknown } | null)?.code || "") === "40001" ? 409 : 503;
    return json({ ok: false, error: "reward_claim_unavailable", refresh_required: true }, status);
  }
  if (serializationConflict) return json({ ok: false, error: "reward_claim_conflict", refresh_required: true }, 409);
  let eligibility: Array<Record<string, unknown>>;
  try {
    eligibility = await sql/*sql*/`
    SELECT reward.id, reward.points_cost, reward.stock_remaining, member.points_balance
    FROM rewards reward
    LEFT JOIN loyalty_members member
      ON member.consumer_id = ${consumer.id}
     AND member.tenant_id = reward.tenant_id
     AND member.program_id = reward.program_id
    WHERE reward.id = ${rewardId}
    LIMIT 1
    `;
  } catch {
    return json({ ok: false, error: "reward_claim_unavailable", refresh_required: true }, 503);
  }
  if (!eligibility[0]) return json({ ok: false, error: "reward_not_available" }, 404);
  if (Number(eligibility[0].points_cost) !== expectedPointsCost) return json({ ok: false, error: "reward_price_changed", refresh_required: true }, 409);
  if (Number(eligibility[0].points_balance || 0) < Number(eligibility[0].points_cost || 0)) return json({ ok: false, error: "insufficient_points" }, 409);
  if (eligibility[0].stock_remaining !== null && Number(eligibility[0].stock_remaining) <= 0) return json({ ok: false, error: "out_of_stock" }, 409);
  return json({ ok: false, error: "reward_claim_conflict" }, 409);
}
