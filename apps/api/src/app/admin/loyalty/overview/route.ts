export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const tenant = new URL(req.url).searchParams.get("tenant") || "";
  if (!tenant) return json({ ok: false, error: "tenant_required" }, 400);

  const rows = await sql/*sql*/`
    SELECT
      lp.id AS program_id,
      lp.name AS program_name,
      COUNT(DISTINCT lm.id)::int AS members,
      COUNT(DISTINCT lm.id) FILTER (WHERE lm.status = 'enrolled')::int AS enrolled_members,
      COUNT(DISTINCT lm.id) FILTER (WHERE lm.status = 'anonymous')::int AS anonymous_members,
      COALESCE(SUM(CASE WHEN pl.delta > 0 THEN pl.delta ELSE 0 END), 0)::int AS points_issued,
      COALESCE(SUM(CASE WHEN pl.delta < 0 THEN ABS(pl.delta) ELSE 0 END), 0)::int AS points_redeemed,
      COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'active')::int AS active_rewards,
      COUNT(rr.id)::int AS redemptions
    FROM tenants t
    JOIN loyalty_programs lp ON lp.tenant_id = t.id AND lp.status = 'active'
    LEFT JOIN loyalty_members lm ON lm.program_id = lp.id
    LEFT JOIN points_ledger pl ON pl.program_id = lp.id
    LEFT JOIN rewards r ON r.program_id = lp.id
    LEFT JOIN reward_redemptions rr ON rr.program_id = lp.id
    WHERE t.slug = ${tenant}
    GROUP BY lp.id, lp.name
    ORDER BY lp.created_at DESC
    LIMIT 1
  `;

  return json(rows[0] || {
    program_id: null,
    program_name: null,
    members: 0,
    enrolled_members: 0,
    anonymous_members: 0,
    points_issued: 0,
    points_redeemed: 0,
    active_rewards: 0,
    redemptions: 0,
  });
}
