export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../lib/auth";
import { ensureSdkSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

function clean(value: unknown) {
  return String(value || "").trim();
}

async function resolveTenant(req: Request, requestedTenant?: string | null) {
  const tenantSlug = clean(getAdminTenantScope(req).forcedTenantSlug || requestedTenant).toLowerCase();
  if (!tenantSlug) return null;
  const rows = await sql/*sql*/`SELECT id::text AS id, slug FROM tenants WHERE slug = ${tenantSlug} OR id::text = ${tenantSlug} LIMIT 1`;
  return rows[0] as { id: string; slug: string } | undefined;
}

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureSdkSchema();

  const { searchParams } = new URL(req.url);
  const tenant = await resolveTenant(req, searchParams.get("tenant"));
  if (getAdminTenantScope(req).forcedTenantSlug && !tenant) return json({ ok: false, reason: "tenant_not_found" }, 404);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 500);

  const rows = tenant
    ? await sql/*sql*/`
      SELECT wd.id, tn.slug AS tenant_slug, we.url, wd.event_name, wd.status_code, wd.ok, wd.attempt_count, wd.last_error, wd.created_at, wd.delivered_at
      FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      JOIN tenants tn ON tn.id = we.tenant_id
      WHERE we.tenant_id = ${tenant.id}
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
