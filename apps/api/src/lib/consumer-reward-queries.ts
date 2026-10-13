import type { SqlExecutor } from "./db";

type ClaimInput = {
  consumerId: string;
  rewardId: string;
  idempotencyKey: string;
  redemptionCode: string;
  locale: string;
  /** Server-owned context; never copied directly from a consumer request body. */
  metadata?: Record<string, unknown>;
  /** A free campaign response cannot debit points after a concurrent price change. */
  maximumPointsCost?: 0;
  /** Server-owned opt-in; campaigns retain their existing first-class contract. */
  portalFirstClaim?: { expectedPointsCost: number };
};

type RefundInput = {
  consumerId: string;
  claimId: string;
  rewardId?: string | null;
  idempotencyKey: string;
};

/**
 * CTE writes share a snapshot: insert the final ledger balance from the locked
 * member instead of trying to update that newly inserted ledger row. Only the
 * ledger idempotency conflict is a no-op; a receipt conflict must roll back all
 * writes, including the points and stock changes.
 */
export async function insertConsumerRewardClaim(query: SqlExecutor, input: ClaimInput) {
  if (input.portalFirstClaim && (!Number.isSafeInteger(input.portalFirstClaim.expectedPointsCost)
    || input.portalFirstClaim.expectedPointsCost < 0 || input.portalFirstClaim.expectedPointsCost > 2_147_483_647)) {
    throw new Error("invalid_portal_expected_points_cost");
  }
  return query/*sql*/`
    WITH locked AS MATERIALIZED (
      SELECT
        reward.id AS reward_id,
        reward.tenant_id,
        reward.program_id,
        reward.points_cost,
        program.start_at AS program_start_at,
        program.end_at AS program_end_at,
        reward.starts_at AS reward_starts_at,
        reward.ends_at AS reward_ends_at,
        member.id AS member_id,
        member.points_balance AS balance_before
      FROM rewards reward
      JOIN loyalty_programs program
        ON program.id = reward.program_id
       AND program.tenant_id = reward.tenant_id
      JOIN tenant_consumer_memberships membership
        ON membership.consumer_id = ${input.consumerId}
       AND membership.tenant_id = reward.tenant_id
      JOIN loyalty_members member
        ON member.consumer_id = ${input.consumerId}
       AND member.tenant_id = reward.tenant_id
       AND member.program_id = reward.program_id
      WHERE reward.id = ${input.rewardId}
        AND program.status = 'active'
        AND program.start_at <= now()
        AND (program.end_at IS NULL OR program.end_at > now())
        AND membership.status = 'active'
        AND reward.status = 'active'
        AND reward.starts_at <= now()
        AND (reward.ends_at IS NULL OR reward.ends_at > now())
        -- No supported verified-age authorization exists for this writer.
        AND program.age_gate_required = false
        AND reward.requires_age_gate = false
        -- Stored eligibility rules require a supported verifier; never ignore
        -- configured restrictions or interpret unknown JSON as unrestricted.
        AND reward.eligibility_json = '{}'::jsonb
        -- Only the authenticated portal opts into a first-reservation contract.
        -- Unknown configured policy stays blocked; no rule is silently discarded.
        AND (${Boolean(input.portalFirstClaim)}::boolean = false OR (
          reward.redemption_limit_per_member IS NULL
          AND reward.fulfillment_json = '{}'::jsonb
          AND reward.points_cost = ${input.portalFirstClaim?.expectedPointsCost ?? null}::integer
          AND (SELECT count(*) FROM loyalty_members own_member
            WHERE own_member.consumer_id = ${input.consumerId}::uuid
              AND own_member.tenant_id = reward.tenant_id
              AND own_member.program_id = reward.program_id) = 1
          AND NOT EXISTS (SELECT 1 FROM consumer_reward_claims own_claim
            WHERE own_claim.consumer_id = ${input.consumerId}::uuid
              AND own_claim.reward_id = reward.id)
        ))
        AND reward.points_cost >= 0
        AND (${input.maximumPointsCost ?? null}::integer IS NULL OR reward.points_cost <= ${input.maximumPointsCost ?? null}::integer)
        AND (reward.stock_remaining IS NULL OR reward.stock_remaining > 0)
        AND member.status IN ('enrolled', 'verified')
        AND member.points_balance >= reward.points_cost
        AND NOT EXISTS (
          SELECT 1 FROM consumer_reward_claims existing
          WHERE existing.idempotency_key = ${input.idempotencyKey}
        )
      FOR UPDATE OF reward, member
      FOR SHARE OF program, membership
    ),
    locked_consumer AS MATERIALIZED (
      -- Acquire account authority after the balance lock. A block committed
      -- while that lock was pending must win over this new claim.
      SELECT consumer.status AS consumer_status
      FROM consumers consumer
      JOIN locked ON consumer.id = ${input.consumerId}
      FOR SHARE OF consumer
    ),
    eligible AS MATERIALIZED (
      -- now() is the transaction-start clock. Recheck after every authority
      -- and balance lock, since either validity window can expire while waiting.
      SELECT locked.* FROM locked JOIN locked_consumer ON true
      WHERE program_start_at <= clock_timestamp()
        AND (program_end_at IS NULL OR program_end_at > clock_timestamp())
        AND reward_starts_at <= clock_timestamp()
        AND (reward_ends_at IS NULL OR reward_ends_at > clock_timestamp())
        AND consumer_status IN ('anonymous', 'registered', 'verified')
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT tenant_id, program_id, member_id, NULL, 'REWARD_REDEEMED'::points_source,
        -points_cost, balance_before - points_cost, ${input.idempotencyKey}, 'Authenticated consumer reward claim',
        jsonb_build_object('rewardId', reward_id, 'consumerId', ${input.consumerId}::text)
      FROM eligible
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    ),
    updated_member AS MATERIALIZED (
      UPDATE loyalty_members member
      SET points_balance = locked.balance_before - locked.points_cost,
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
      FROM locked, reserved_ledger, updated_member
      WHERE reward.id = locked.reward_id
        AND (reward.stock_remaining IS NULL OR reward.stock_remaining > 0)
      RETURNING reward.id
    ),
    inserted_claim AS (
      INSERT INTO consumer_reward_claims (
        consumer_id, tenant_id, reward_id, tap_event_id, status,
        points_spent, redemption_code, idempotency_key, metadata_json
      )
      SELECT ${input.consumerId}, locked.tenant_id, locked.reward_id, NULL, 'claimed',
        locked.points_cost, ${input.redemptionCode}, ${input.idempotencyKey},
        ${JSON.stringify({ ...input.metadata, locale: input.locale, points_source: "loyalty_members" })}::jsonb
      FROM locked, reserved_ledger, updated_member, updated_reward
      RETURNING *
    )
    SELECT * FROM inserted_claim
  `;
}

/** Portal-only semantic UUID readback. Execute with sqlSerializable; never retry a write.
 * Locks protect the returned historical row; keys and receipts are not normalized. */
export async function readOwnPortalRewardClaimUnderLock(query: SqlExecutor, input: { consumerId: string; rewardId: string }) {
  const rows = await query/*sql*/`
    WITH locked_reward AS MATERIALIZED (
      SELECT reward.id, reward.tenant_id FROM rewards reward
      WHERE reward.id = ${input.rewardId}::uuid
      FOR UPDATE OF reward
    ), locked_consumer AS MATERIALIZED (
      SELECT consumer.id FROM consumers consumer JOIN locked_reward ON true
      WHERE consumer.id = ${input.consumerId}::uuid
        AND consumer.status IN ('anonymous', 'registered', 'verified')
      FOR SHARE OF consumer
    )
    SELECT claim.*, locked_reward.tenant_id AS reward_tenant_id
    FROM consumer_reward_claims claim
    JOIN locked_reward ON locked_reward.id = claim.reward_id
    JOIN locked_consumer ON locked_consumer.id = claim.consumer_id
    ORDER BY claim.id LIMIT 2
    FOR SHARE OF claim
  `;
  if (rows.length === 0) return { state: "absent" as const };
  if (rows.length !== 1 || rows[0].tenant_id !== rows[0].reward_tenant_id) return { state: "ambiguous" as const };
  const { reward_tenant_id: _tenant, ...claim } = rows[0];
  return { state: "single" as const, claim };
}

export async function refundConsumerRewardClaim(query: SqlExecutor, input: RefundInput) {
  return query/*sql*/`
    WITH locked AS MATERIALIZED (
      SELECT
        claim.id AS claim_id,
        claim.tenant_id,
        claim.reward_id,
        claim.points_spent,
        reward.program_id,
        member.id AS member_id,
        member.points_balance AS balance_before
      FROM consumer_reward_claims claim
      JOIN rewards reward ON reward.id = claim.reward_id AND reward.tenant_id = claim.tenant_id
      JOIN loyalty_members member
        ON member.consumer_id = claim.consumer_id
       AND member.tenant_id = claim.tenant_id
       AND member.program_id = reward.program_id
      WHERE claim.id = ${input.claimId}
        AND claim.consumer_id = ${input.consumerId}
        AND (${input.rewardId || null}::uuid IS NULL OR claim.reward_id = ${input.rewardId || null}::uuid)
        AND claim.status = 'claimed'
        AND claim.points_spent >= 0
      FOR UPDATE OF claim, reward, member
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT tenant_id, program_id, member_id, NULL, 'ADMIN_ADJUSTMENT'::points_source,
        points_spent, balance_before + points_spent, ${input.idempotencyKey}, 'Consumer reward cancellation refund',
        jsonb_build_object('claimId', claim_id, 'rewardId', reward_id, 'operation', 'refund')
      FROM locked
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    ),
    updated_member AS MATERIALIZED (
      UPDATE loyalty_members member
      SET points_balance = locked.balance_before + locked.points_spent,
          updated_at = now()
      FROM locked, reserved_ledger
      WHERE member.id = locked.member_id
      RETURNING member.points_balance
    ),
    updated_reward AS MATERIALIZED (
      UPDATE rewards reward
      SET stock_remaining = CASE WHEN reward.stock_remaining IS NULL THEN NULL ELSE reward.stock_remaining + 1 END,
          updated_at = now()
      FROM locked, reserved_ledger, updated_member
      WHERE reward.id = locked.reward_id
      RETURNING reward.id
    ),
    cancelled_claim AS (
      UPDATE consumer_reward_claims claim
      SET status = 'cancelled', updated_at = now(),
          metadata_json = COALESCE(claim.metadata_json, '{}'::jsonb) || jsonb_build_object('cancelledAt', now()::text, 'pointsSource', 'loyalty_members')
      FROM locked, reserved_ledger, updated_member, updated_reward
      WHERE claim.id = locked.claim_id
        AND claim.status = 'claimed'
      RETURNING claim.*
    )
    SELECT * FROM cancelled_claim
  `;
}
