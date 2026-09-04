export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantAccess } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureLoyaltySchema } from "../../../../lib/loyalty-schema";

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "crm:read");
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const requestedTenant = searchParams.get("tenant");
  const { effectiveTenantSlug: tenant } = getAdminTenantAccess(req, requestedTenant);

  await ensureLoyaltySchema();

  const rows = await sql/*sql*/`
    WITH active_programs AS MATERIALIZED (
      SELECT program.id
      FROM loyalty_programs program
      JOIN tenants t ON t.id = program.tenant_id
      WHERE program.status = 'active'
        AND (${tenant} = '' OR t.slug = ${tenant})
    ),
    member_totals AS (
      SELECT member.program_id, COUNT(*)::int AS total_members
      FROM loyalty_members member
      JOIN active_programs program ON program.id = member.program_id
      GROUP BY member.program_id
    ),
    ledger_totals AS (
      SELECT ledger.program_id,
        COALESCE(SUM(ledger.delta) FILTER (WHERE ledger.delta > 0), 0)::int AS points_issued,
        (COALESCE(SUM(ledger.delta) FILTER (WHERE ledger.delta < 0), 0) * -1)::int AS points_redeemed
      FROM points_ledger ledger
      JOIN active_programs program ON program.id = ledger.program_id
      GROUP BY ledger.program_id
    )
    SELECT
      COUNT(program.id)::int AS active_programs,
      COALESCE(SUM(members.total_members), 0)::int AS total_members,
      COALESCE(SUM(points.points_issued), 0)::int AS points_issued,
      COALESCE(SUM(points.points_redeemed), 0)::int AS points_redeemed
    FROM active_programs program
    LEFT JOIN member_totals members ON members.program_id = program.id
    LEFT JOIN ledger_totals points ON points.program_id = program.id
  `;

  return json(rows[0] || { active_programs: 0, total_members: 0, points_issued: 0, points_redeemed: 0 });
}
