export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomUUID } from "node:crypto";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../lib/bounded-request-body";

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
  const claimRows = await sql/*sql*/`
    WITH locked AS MATERIALIZED (
      SELECT
        reward.id AS reward_id,
        reward.tenant_id,
        reward.program_id,
        reward.points_cost,
        member.id AS member_id
      FROM rewards reward
      JOIN loyalty_members member
        ON member.consumer_id = ${consumer.id}
       AND member.tenant_id = reward.tenant_id
       AND member.program_id = reward.program_id
      WHERE reward.id = ${rewardId}
        AND reward.status = 'active'
        AND reward.starts_at <= now()
        AND (reward.ends_at IS NULL OR reward.ends_at >= now())
        AND (reward.stock_remaining IS NULL OR reward.stock_remaining > 0)
        AND member.status IN ('enrolled', 'verified')
        AND member.points_balance >= reward.points_cost
      FOR UPDATE OF reward, member
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT tenant_id, program_id, member_id, NULL, 'REWARD_REDEEMED'::points_source,
        -abs(points_cost), 0, ${idem}, 'Authenticated consumer reward claim',
        jsonb_build_object('rewardId', reward_id, 'consumerId', ${consumer.id}::text)
      FROM locked
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    ),
    updated_member AS MATERIALIZED (
      UPDATE loyalty_members member
      SET points_balance = member.points_balance - locked.points_cost,
          updated_at = now()
      FROM locked, reserved_ledger
      WHERE member.id = locked.member_id
        AND member.points_balance >= locked.points_cost
      RETURNING member.points_balance
    ),
    updated_reward AS MATERIALIZED (
      UPDATE rewards reward
      SET stock_remaining = CASE WHEN reward.stock_remaining IS NULL THEN NULL ELSE reward.stock_remaining - 1 END,
          updated_at = now()
      FROM locked, reserved_ledger
      WHERE reward.id = locked.reward_id
        AND (reward.stock_remaining IS NULL OR reward.stock_remaining > 0)
      RETURNING reward.id
    ),
    finalized_ledger AS MATERIALIZED (
      UPDATE points_ledger ledger
      SET balance_after = updated_member.points_balance
      FROM reserved_ledger, updated_member
      WHERE ledger.id = reserved_ledger.id
      RETURNING ledger.id
    ),
    inserted_claim AS (
      INSERT INTO consumer_reward_claims (
        consumer_id, tenant_id, reward_id, tap_event_id, status,
        points_spent, redemption_code, idempotency_key, metadata_json
      )
      SELECT ${consumer.id}, locked.tenant_id, locked.reward_id, NULL, 'claimed',
        abs(locked.points_cost), ${code}, ${idem},
        ${JSON.stringify({ locale: typeof body.locale === "string" ? body.locale.slice(0, 12) : "es-AR", points_source: "loyalty_members" })}::jsonb
      FROM locked, updated_member, updated_reward, finalized_ledger
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING *
    )
    SELECT * FROM inserted_claim
  `;
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
