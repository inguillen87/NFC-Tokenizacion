export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ rewardId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const { rewardId } = await params;
  const body = await req.json().catch(() => ({}));
  const redemptionId = body.redemptionId || null;
  if (!redemptionId) return json({ ok: false, error: 'redemptionId_required' }, 400);

  const rows = await sql/*sql*/`
    UPDATE consumer_reward_claims
    SET status = 'redeemed', updated_at = now(), metadata_json = metadata_json || ${JSON.stringify({ redeemedBy: 'consumer', at: new Date().toISOString() })}::jsonb
    WHERE id = ${redemptionId}
      AND reward_id = ${rewardId}
      AND consumer_id = ${consumer.id}
      AND status = 'claimed'
    RETURNING *
  `;
  if (!rows[0]) return json({ ok: false, error: 'claim_not_found_or_invalid_state' }, 404);
  return json({ ok: true, claim: rows[0] });
}
