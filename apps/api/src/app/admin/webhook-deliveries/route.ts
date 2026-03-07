export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || "";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 500);

  const rows = tenant
    ? await sql/*sql*/`
      SELECT wd.id, tn.slug AS tenant_slug, we.url, wd.event_name, wd.status_code, wd.ok, wd.attempt_count, wd.last_error, wd.created_at, wd.delivered_at
      FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      JOIN tenants tn ON tn.id = we.tenant_id
      WHERE tn.slug = ${tenant}
      ORDER BY wd.created_at DESC
      LIMIT ${limit}
    `
    : await sql/*sql*/`
      SELECT wd.id, tn.slug AS tenant_slug, we.url, wd.event_name, wd.status_code, wd.ok, wd.attempt_count, wd.last_error, wd.created_at, wd.delivered_at
      FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      JOIN tenants tn ON tn.id = we.tenant_id
      ORDER BY wd.created_at DESC
      LIMIT ${limit}
    `;

  return json(rows);
}
