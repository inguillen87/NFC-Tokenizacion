import { checkAdmin, checkAdminPermission, getAdminTenantScope } from "./auth";
import { sql } from "./db";
import { json } from "./http";
import { effectiveTenantFilter } from "./admin-tenant-filter";
import { ADMIN_REWARD_CREATE_INTENT, AdminRewardError, parseAdminRewardCommand } from "./admin-reward-policy";
import { saveAdminReward } from "./admin-reward-service";

/** The route chooses its mode. Preserve the original Request: auth binds its principal by identity. */
export async function handleAdminRewardPost(req: Request, mode: "legacy" | "strict-create") {
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
    if (mode === "strict-create" && command.creationIntent !== ADMIN_REWARD_CREATE_INTENT) {
      throw new AdminRewardError("invalid_reward_creation_intent");
    }
    const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
    if (!tenantRows.length) return json({ ok: false, error: "tenant_not_found" }, 400);
    const reward = await saveAdminReward(String(tenantRows[0].id), command);
    return json({ ok: true, reward }, 200, { "cache-control": "private, no-store" });
  } catch (error) {
    return json({ ok: false, error: error instanceof AdminRewardError ? error.code : "reward_save_unavailable" },
      error instanceof AdminRewardError ? error.status : 503, { "cache-control": "private, no-store" });
  }
}
