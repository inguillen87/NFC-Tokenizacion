export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../lib/bounded-request-body";
import { consumerRewardClaimExpiresAt } from "../../../../../lib/consumer-rewards-read-model";

export async function POST(req: Request, { params }: { params: Promise<{ rewardId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:reward-redeem` });
  if (limited) return limited;
  const { rewardId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 8 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "invalid_body" }, 400);
  const redemptionId = body.redemptionId || null;
  if (!redemptionId) return json({ ok: false, error: 'redemptionId_required' }, 400);
  await ensureConsumerPortalSchema();

  const claims = await sql/*sql*/`
    SELECT id, created_at, created_at::text AS claimed_at_text,
      metadata_json->'expires_at' AS expires_at_value
    FROM consumer_reward_claims
    WHERE id = ${redemptionId}
      AND reward_id = ${rewardId}
      AND consumer_id = ${consumer.id}
      AND status = 'claimed'
    LIMIT 1
  `;
  const claim = claims[0];
  const expiresAt = claim ? consumerRewardClaimExpiresAt(claim.expires_at_value, claim.created_at) : null;
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) return json({ ok: false, error: 'claim_not_found_or_invalid_state' }, 404);

  const rows = await sql/*sql*/`
    WITH locked AS MATERIALIZED (
      SELECT id, created_at::text AS claimed_at_text,
        metadata_json->'expires_at' AS expires_at_value
      FROM consumer_reward_claims
      WHERE id = ${redemptionId}
        AND reward_id = ${rewardId}
        AND consumer_id = ${consumer.id}
        AND status = 'claimed'
      FOR UPDATE
    ),
    eligible AS MATERIALIZED (
      SELECT id FROM locked
      WHERE ${expiresAt}::timestamptz > clock_timestamp()
        AND claimed_at_text = ${claim.claimed_at_text}
        AND COALESCE(expires_at_value, 'null'::jsonb) = ${JSON.stringify(claim.expires_at_value ?? null)}::jsonb
    )
    UPDATE consumer_reward_claims
    SET status = 'redeemed', updated_at = now(), metadata_json = metadata_json || ${JSON.stringify({ redeemedBy: 'consumer', at: new Date().toISOString() })}::jsonb
    FROM eligible
    WHERE consumer_reward_claims.id = eligible.id
      AND consumer_reward_claims.status = 'claimed'
    RETURNING consumer_reward_claims.*
  `;
  if (!rows[0]) return json({ ok: false, error: 'claim_not_found_or_invalid_state' }, 404);
  return json({ ok: true, claim: rows[0] });
}
