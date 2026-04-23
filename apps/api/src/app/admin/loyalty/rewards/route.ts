export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || "";

  const rows = tenant
    ? await sql`
        SELECT r.code, r.title, r.points_cost as points, r.status
        FROM rewards r
        JOIN tenants t ON t.id = r.tenant_id
        WHERE t.slug = ${tenant}
        ORDER BY r.created_at DESC
      `
    : await sql`
        SELECT r.code, r.title, r.points_cost as points, r.status
        FROM rewards r
        ORDER BY r.created_at DESC
      `;

  return json({ ok: true, rewards: rows });
}
