export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomUUID } from "node:crypto";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";

export async function POST(req: Request, { params }: { params: Promise<{ rewardId: string }> }) {
  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const { rewardId } = await params;
  const body = await req.json().catch(() => ({}));
  const idem = String(body.idempotencyKey || `claim:${consumer.id}:${rewardId}`);

  const rewardRows = await sql/*sql*/`
    SELECT r.*, m.id AS membership_id, m.points_balance
    FROM rewards r
    JOIN tenant_consumer_memberships m ON m.tenant_id = r.tenant_id
    WHERE r.id = ${rewardId}
      AND m.consumer_id = ${consumer.id}
      AND r.status = 'active'
      AND r.starts_at <= now()
      AND (r.ends_at IS NULL OR r.ends_at >= now())
    LIMIT 1
  `;
  const reward = rewardRows[0];
  if (!reward) return json({ ok: false, error: "reward_not_available" }, 404);

  if (reward.stock_remaining !== null && Number(reward.stock_remaining) <= 0) return json({ ok: false, error: "out_of_stock" }, 409);
  if (Number(reward.points_balance) < Number(reward.points_cost)) return json({ ok: false, error: "insufficient_points" }, 409);

  const existing = await sql/*sql*/`SELECT * FROM consumer_reward_claims WHERE idempotency_key = ${idem} LIMIT 1`;
  if (existing[0]) return json({ ok: true, claim: existing[0], duplicate: true });

  await sql/*sql*/`
    UPDATE tenant_consumer_memberships
    SET points_balance = points_balance - ${Number(reward.points_cost)}, updated_at = now()
    WHERE id = ${reward.membership_id} AND points_balance >= ${Number(reward.points_cost)}
  `;
  await sql/*sql*/`
    UPDATE rewards
    SET stock_remaining = CASE WHEN stock_remaining IS NULL THEN NULL WHEN stock_remaining > 0 THEN stock_remaining - 1 ELSE stock_remaining END,
        updated_at = now()
    WHERE id = ${reward.id} AND (stock_remaining IS NULL OR stock_remaining > 0)
  `;

  const code = `NXR-${randomUUID().split('-')[0].toUpperCase()}`;
  const claimRows = await sql/*sql*/`
    INSERT INTO consumer_reward_claims (consumer_id, tenant_id, reward_id, tap_event_id, status, points_spent, redemption_code, idempotency_key, metadata_json)
    VALUES (${consumer.id}, ${reward.tenant_id}, ${reward.id}, ${body.tapEventId || null}, 'claimed', ${Number(reward.points_cost)}, ${code}, ${idem}, ${JSON.stringify({ locale: body.locale || 'es-AR' })}::jsonb)
    RETURNING *
  `;
  return json({ ok: true, claim: claimRows[0] });
}
