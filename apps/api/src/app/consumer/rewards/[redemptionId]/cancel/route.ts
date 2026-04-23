export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ redemptionId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const { redemptionId } = await params;

  const claimRows = await sql/*sql*/`
    UPDATE consumer_reward_claims
    SET status = 'cancelled', updated_at = now()
    WHERE id = ${redemptionId}
      AND consumer_id = ${consumer.id}
      AND status = 'claimed'
    RETURNING *
  `;
  const claim = claimRows[0];
  if (!claim) return json({ ok: false, error: 'claim_not_found_or_invalid_state' }, 404);

  await sql/*sql*/`
    UPDATE tenant_consumer_memberships
    SET points_balance = points_balance + ${claim.points_spent}, updated_at = now()
    WHERE tenant_id = ${claim.tenant_id} AND consumer_id = ${consumer.id}
  `;
  await sql/*sql*/`
    UPDATE rewards
    SET stock_remaining = CASE WHEN stock_remaining IS NULL THEN NULL ELSE stock_remaining + 1 END,
        updated_at = now()
    WHERE id = ${claim.reward_id}
  `;

  return json({ ok: true, claim });
}
