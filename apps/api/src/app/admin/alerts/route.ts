export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { searchParams } = new URL(req.url);
  const tenant = String(searchParams.get("tenant") || "").trim().toLowerCase();
  const severity = String(searchParams.get("severity") || "").trim().toLowerCase();
  const type = String(searchParams.get("type") || "").trim();
  const rows = await sql/*sql*/`
    SELECT a.*, t.slug AS tenant_slug
    FROM security_alerts a
    LEFT JOIN tenants t ON t.id = a.tenant_id
    WHERE (${tenant} = '' OR t.slug = ${tenant})
      AND (${severity} = '' OR a.severity = ${severity})
      AND (${type} = '' OR a.type = ${type})
    ORDER BY a.created_at DESC
    LIMIT 200
  `;
  return json({ ok: true, items: rows });
}
