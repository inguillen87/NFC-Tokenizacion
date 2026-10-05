export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission, getAdminTenantScope } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { effectiveTenantFilter } from "../../../../lib/admin-tenant-filter";
import { AdminRewardError, parseAdminRewardCommand } from "../../../../lib/admin-reward-policy";
import { saveAdminReward } from "../../../../lib/admin-reward-service";

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "rewards:read");
  if (permission) return permission;

  const { searchParams } = new URL(req.url);
  const { scope, forcedTenantSlug } = getAdminTenantScope(req);
  const tenant = effectiveTenantFilter({
    forcedTenantSlug,
    requestedTenantSlug: searchParams.get("tenant"),
  });
  const explicitGlobalScope = searchParams.get("scope") === "global";

  if (!tenant && !(scope === "super_admin" && explicitGlobalScope)) {
    return json({ ok: false, error: "tenant_required" }, 400);
  }

  const rows = tenant
    ? await sql`
        SELECT r.id, r.program_id, t.slug AS tenant_slug, r.code, r.title, r.points_cost as points, r.status, r.description, r.type, r.image_url, r.stock_total, r.stock_remaining, r.requires_age_gate, r.network_visible
        FROM rewards r
        JOIN tenants t ON t.id = r.tenant_id
        WHERE t.slug = ${tenant}
        ORDER BY r.created_at DESC
      `
    : await sql`
        SELECT r.id, r.program_id, t.slug AS tenant_slug, r.code, r.title, r.points_cost as points, r.status, r.description, r.type, r.image_url, r.stock_total, r.stock_remaining, r.requires_age_gate, r.network_visible
        FROM rewards r
        JOIN tenants t ON t.id = r.tenant_id
        ORDER BY r.created_at DESC
      `;

  return json({
    ok: true,
    tenant: tenant || null,
    scope: tenant ? "tenant" : "global",
    rewards: rows,
  });
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "rewards:write");
  if (permission) return permission;

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const rawBody = await req.json().catch(() => null);
  const body = (rawBody && typeof rawBody === "object" && !Array.isArray(rawBody) ? rawBody : {}) as Record<string, any>;
  const tenantSlug = effectiveTenantFilter({
    forcedTenantSlug,
    requestedTenantSlug: String(body.tenant_slug || body.tenant || "")
  });

  if (!tenantSlug) {
    return json({ ok: false, error: "tenant_required" }, 400);
  }

  try {
    const command = parseAdminRewardCommand(rawBody);
    const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
    if (!tenantRows.length) return json({ ok: false, error: "tenant_not_found" }, 400);
    const reward = await saveAdminReward(String(tenantRows[0].id), command);
    return json({ ok: true, reward }, 200, { "cache-control": "private, no-store" });
  } catch (error) {
    return json({ ok: false, error: error instanceof AdminRewardError ? error.code : "reward_save_unavailable" },
      error instanceof AdminRewardError ? error.status : 503, { "cache-control": "private, no-store" });
  }
}
