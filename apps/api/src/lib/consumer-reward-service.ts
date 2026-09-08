import { ensureConsumerPortalSchema } from "./commercial-runtime-schema";
import { sql } from "./db";
import { refundConsumerRewardClaim } from "./consumer-reward-queries";

export async function cancelConsumerRewardClaim(input: {
  consumerId: string;
  claimId: string;
  rewardId?: string | null;
}) {
  await ensureConsumerPortalSchema();
  const idempotencyKey = `consumer-reward-cancel:${input.consumerId}:${input.claimId}`;
  const rows = await refundConsumerRewardClaim(sql, { ...input, idempotencyKey });
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
