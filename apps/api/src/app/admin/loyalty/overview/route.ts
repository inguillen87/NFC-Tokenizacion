export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureLoyaltySchema } from "../../../../lib/loyalty-schema";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || "";

  await ensureLoyaltySchema();

  const rows = tenant
    ? await sql/*sql*/`
      SELECT
        COUNT(DISTINCT p.id)::int AS active_programs,
        COUNT(DISTINCT m.id)::int AS total_members,
        COALESCE(SUM(l.delta) FILTER (WHERE l.delta > 0), 0)::int AS points_issued,
        COALESCE(SUM(l.delta) FILTER (WHERE l.delta < 0), 0)::int * -1 AS points_redeemed
      FROM loyalty_programs p
      LEFT JOIN loyalty_members m ON m.program_id = p.id
      LEFT JOIN points_ledger l ON l.program_id = p.id
      JOIN tenants t ON t.id = p.tenant_id
      WHERE t.slug = ${tenant} AND p.status = 'active'
    `
    : await sql/*sql*/`
      SELECT
        COUNT(DISTINCT p.id)::int AS active_programs,
        COUNT(DISTINCT m.id)::int AS total_members,
        COALESCE(SUM(l.delta) FILTER (WHERE l.delta > 0), 0)::int AS points_issued,
        COALESCE(SUM(l.delta) FILTER (WHERE l.delta < 0), 0)::int * -1 AS points_redeemed
      FROM loyalty_programs p
      LEFT JOIN loyalty_members m ON m.program_id = p.id
      LEFT JOIN points_ledger l ON l.program_id = p.id
      WHERE p.status = 'active'
    `;

  return json(rows[0] || { active_programs: 0, total_members: 0, points_issued: 0, points_redeemed: 0 });
}
