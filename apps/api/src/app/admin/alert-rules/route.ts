export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../lib/auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { effectiveTenantFilter } from "../../../lib/admin-tenant-filter";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const { searchParams } = new URL(req.url);
  const tenantFilter = effectiveTenantFilter({ forcedTenantSlug, requestedTenantSlug: searchParams.get("tenant") });
  const rows = await sql/*sql*/`
    SELECT r.*, t.slug AS tenant_slug
    FROM alert_rules r
    LEFT JOIN tenants t ON t.id = r.tenant_id
    WHERE (${tenantFilter} = '' OR t.slug = ${tenantFilter})
    ORDER BY r.created_at DESC
  `;
  return json({ ok: true, items: rows });
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tenantSlug = effectiveTenantFilter({ forcedTenantSlug, requestedTenantSlug: String(body.tenant_slug || "") });
  const type = String(body.type || "").trim();
  if (!type) return json({ ok: false, error: "type_required" }, 400);
  const tenantRows = tenantSlug ? await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1` : [];
  const tenantId = tenantRows[0]?.id || null;
  const rows = await sql/*sql*/`
    INSERT INTO alert_rules (tenant_id, type, severity, threshold, window_minutes, enabled, config)
    VALUES (${tenantId}, ${type}, ${String(body.severity || "high")}, ${Number(body.threshold || 1)}, ${Number(body.window_minutes || 60)}, ${body.enabled !== false}, ${JSON.stringify(body.config || {})}::jsonb)
    ON CONFLICT (tenant_id, type)
    DO UPDATE SET severity = EXCLUDED.severity, threshold = EXCLUDED.threshold, window_minutes = EXCLUDED.window_minutes, enabled = EXCLUDED.enabled, config = EXCLUDED.config, updated_at = now()
    RETURNING *
  `;
  return json({ ok: true, item: rows[0] });
}
