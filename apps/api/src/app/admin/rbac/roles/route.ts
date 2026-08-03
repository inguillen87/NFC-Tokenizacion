export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminPrincipal } from "../../../../lib/auth";
import { listDelegableEnterpriseRoleProfiles } from "../../../../lib/admin-role-catalog";
import { ensureEnterpriseIamSchema } from "../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "users:manage");
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  try {
    await ensureEnterpriseIamSchema();
    const roles = await listDelegableEnterpriseRoleProfiles(sql as any, {
      role: principal.role,
      tenantId: principal.tenantId,
      permissions: principal.permissions,
      deniedPermissions: principal.deniedPermissions,
    });
    if (!roles.length) return json({ ok: false, reason: "enterprise_rbac_no_delegable_roles" }, 403, NO_STORE);
    return json({ ok: true, permissionMode: "role_default", roles }, 200, NO_STORE);
  } catch (error) {
    const code = String((error as { code?: unknown })?.code || "");
    return json({
      ok: false,
      reason: ["42P01", "42703"].includes(code) ? "enterprise_rbac_migration_required" : "enterprise_rbac_unavailable",
      ...(["42P01", "42703"].includes(code)
        ? { requiredMigration: "20260802230000_0088_enterprise_event_profile.sql" }
        : {}),
    }, 503, { ...NO_STORE, "retry-after": "1" });
  }
}
