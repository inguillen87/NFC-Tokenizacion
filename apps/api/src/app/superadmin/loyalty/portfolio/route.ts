export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const rows = await sql`
    SELECT
      t.slug as tenant_slug,
      t.name as tenant_name,
      p.id as program_id,
      p.name as program_name,
      p.status as program_status,
      COUNT(DISTINCT m.id)::int as enrolled_members,
      COALESCE(SUM(l.delta) FILTER (WHERE l.delta > 0), 0)::int as points_issued
    FROM tenants t
    JOIN loyalty_programs p ON p.tenant_id = t.id
    LEFT JOIN loyalty_members m ON m.program_id = p.id
    LEFT JOIN points_ledger l ON l.program_id = p.id
    GROUP BY t.slug, t.name, p.id, p.name, p.status
    ORDER BY enrolled_members DESC
  `;

  return json({ ok: true, portfolio: rows });
}
