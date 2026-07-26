export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../lib/bounded-request-body";

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
  await ensureConsumerPortalSchema();
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
