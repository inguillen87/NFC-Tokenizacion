import { ensureConsumerPortalSchema } from "./commercial-runtime-schema";
import { sql } from "./db";

export async function cancelConsumerRewardClaim(input: {
  consumerId: string;
  claimId: string;
  rewardId?: string | null;
}) {
  await ensureConsumerPortalSchema();
  const idempotencyKey = `consumer-reward-cancel:${input.consumerId}:${input.claimId}`;
  const rows = await sql/*sql*/`
    WITH locked AS MATERIALIZED (
      SELECT
        claim.id AS claim_id,
        claim.tenant_id,
        claim.reward_id,
        claim.points_spent,
        reward.program_id,
        member.id AS member_id
      FROM consumer_reward_claims claim
      JOIN rewards reward ON reward.id = claim.reward_id
      JOIN loyalty_members member
        ON member.consumer_id = claim.consumer_id
       AND member.tenant_id = claim.tenant_id
       AND member.program_id = reward.program_id
      WHERE claim.id = ${input.claimId}
        AND claim.consumer_id = ${input.consumerId}
        AND (${input.rewardId || null}::uuid IS NULL OR claim.reward_id = ${input.rewardId || null}::uuid)
        AND claim.status = 'claimed'
      FOR UPDATE OF claim, reward, member
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT tenant_id, program_id, member_id, NULL, 'ADMIN_ADJUSTMENT'::points_source,
        points_spent, 0, ${idempotencyKey}, 'Consumer reward cancellation refund',
        jsonb_build_object('claimId', claim_id, 'rewardId', reward_id, 'operation', 'refund')
      FROM locked
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    ),
    updated_member AS MATERIALIZED (
      UPDATE loyalty_members member
      SET points_balance = member.points_balance + locked.points_spent,
          updated_at = now()
      FROM locked, reserved_ledger
      WHERE member.id = locked.member_id
      RETURNING member.points_balance
    ),
    updated_reward AS MATERIALIZED (
      UPDATE rewards reward
      SET stock_remaining = CASE WHEN reward.stock_remaining IS NULL THEN NULL ELSE reward.stock_remaining + 1 END,
          updated_at = now()
      FROM locked, reserved_ledger
      WHERE reward.id = locked.reward_id
      RETURNING reward.id
    ),
    finalized_ledger AS MATERIALIZED (
      UPDATE points_ledger ledger
      SET balance_after = updated_member.points_balance
      FROM reserved_ledger, updated_member
      WHERE ledger.id = reserved_ledger.id
      RETURNING ledger.id
    ),
    cancelled_claim AS (
      UPDATE consumer_reward_claims claim
      SET status = 'cancelled', updated_at = now(),
          metadata_json = COALESCE(claim.metadata_json, '{}'::jsonb) || jsonb_build_object('cancelledAt', now()::text, 'pointsSource', 'loyalty_members')
      FROM locked, updated_member, updated_reward, finalized_ledger
      WHERE claim.id = locked.claim_id
        AND claim.status = 'claimed'
      RETURNING claim.*
    )
    SELECT * FROM cancelled_claim
  `;
  if (rows[0]) return { ok: true as const, duplicate: false, claim: rows[0] };
  const existing = await sql/*sql*/`
    SELECT *
    FROM consumer_reward_claims
    WHERE id = ${input.claimId}
      AND consumer_id = ${input.consumerId}
      AND (${input.rewardId || null}::uuid IS NULL OR reward_id = ${input.rewardId || null}::uuid)
    LIMIT 1
  `;
  if (String(existing[0]?.status || "") === "cancelled") {
    return { ok: true as const, duplicate: true, claim: existing[0] };
  }
  return { ok: false as const, error: "claim_not_found_or_invalid_state" as const };
}
