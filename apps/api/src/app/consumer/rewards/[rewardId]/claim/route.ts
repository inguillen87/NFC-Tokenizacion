export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomUUID } from "node:crypto";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sqlSerializable } from "../../../../../lib/db";
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
  const hasClaimIntent = Object.hasOwn(body, "claimIntent");
  if (hasClaimIntent && body.claimIntent !== "portal-first-reservation.v1") {
    return json({ ok: false, error: "unsupported_claim_intent" }, 400);
  }
  let portalFirstClaim: { expectedPointsCost: number } | undefined;
  if (hasClaimIntent) {
    const expectedPointsCost = body.expectedPointsCost;
    if (typeof expectedPointsCost !== "number" || !Number.isSafeInteger(expectedPointsCost)
      || expectedPointsCost < 0 || expectedPointsCost > 2_147_483_647) {
      return json({ ok: false, error: "invalid_expected_points_cost" }, 400);
    }
    portalFirstClaim = { expectedPointsCost };
  }
  await ensureConsumerPortalSchema();
  const idem = `consumer-reward-claim:${consumer.id}:${rewardId}`;
  const code = `NXR-${randomUUID().split('-')[0].toUpperCase()}`;
  // A legacy body can recover its own historical receipt without a new price.
  // This read is advisory to the write: the writer also rechecks semantic identity.
  try {
    const prior = await readOwnPortalRewardClaimUnderLock(sqlSerializable, { consumerId: consumer.id, rewardId });
    if (prior.state === "ambiguous") return json({ ok: false, error: "reward_claim_history_ambiguous", refresh_required: true }, 409);
    if (prior.state === "single") return json({ ok: true, claim: prior.claim, duplicate: true });
  } catch (error) {
    const status = String((error as { code?: unknown } | null)?.code || "") === "40001" ? 409 : 503;
    return json({ ok: false, error: "reward_claim_unavailable", refresh_required: true }, status);
  }
  let serializationConflict = false;
  try {
    const claimRows = await insertConsumerRewardClaim(sqlSerializable, {
      consumerId: consumer.id, rewardId, idempotencyKey: idem, redemptionCode: code,
      locale: typeof body.locale === "string" ? body.locale.slice(0, 12) : "es-AR",
      // Always server-owned; a consumer body cannot disable HTTP identity.
      consumerHttpClaim: true,
      ...(portalFirstClaim ? { portalFirstClaim } : {}),
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
  // The authoritative writer and own receipt readback found no permitted result.
  // Do not inspect an unscoped reward for price, stock, existence or balance hints.
  return json({ ok: false, error: "reward_claim_conflict", refresh_required: true }, 409);
}
