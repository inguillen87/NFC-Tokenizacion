import { evaluateAdminAccess, normalizeScope, resolveAdminTenantAccess, resolveAdminTenantScope } from "./admin-auth-policy";
import { permissionMatches } from "./permission-matcher.js";
export type AdminScope = "super_admin" | "security_operator" | "tenant_admin" | "reseller" | "readonly_demo";

function resolveScope(req: Request): AdminScope | null {
  return normalizeScope(req.headers.get("x-nexid-admin-scope"), req.headers.get("x-dashboard-role")) as AdminScope | null;
}

export function getAdminTenantScope(req: Request) {
  return resolveAdminTenantScope(
    req.headers.get("x-nexid-admin-scope"),
    req.headers.get("x-dashboard-role"),
    req.headers.get("x-nexid-tenant-slug"),
  );
}

export function checkAdmin(req: Request, requiredScopes: AdminScope[] = ["super_admin", "tenant_admin", "reseller"]): Response | null {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = String(process.env.ADMIN_API_KEY || "").trim();
  const requireScoped = String(process.env.REQUIRE_SCOPED_ADMIN_AUTH || "").toLowerCase() === "true";
  const scope = resolveScope(req);

  const verdict = evaluateAdminAccess({
    providedToken: token,
    expectedToken: expected,
    requireScoped,
    scope,
    tenantSlug: req.headers.get("x-nexid-tenant-slug"),
    requiredScopes,
  });
  if (verdict.ok) return null;
  return new Response(verdict.status === 403 ? "Forbidden" : "Unauthorized", { status: verdict.status });
}

export function getAdminTenantAccess(req: Request, requestedTenantSlug?: string | null) {
  return resolveAdminTenantAccess(
    req.headers.get("x-nexid-admin-scope"),
    req.headers.get("x-dashboard-role"),
    req.headers.get("x-nexid-tenant-slug"),
    requestedTenantSlug,
  );
}

export function checkAdminPermission(req: Request, requiredPermission: string): Response | null {
  const scope = resolveScope(req);
  // A trusted unscoped ADMIN_API_KEY remains the legacy super-admin path.
  if (!scope || scope === "super_admin") return null;
  const permissions = String(req.headers.get("x-nexid-permissions") || "")
    .split(",")
    .map((permission) => permission.trim())
    .filter(Boolean);
  if (permissionMatches(permissions, requiredPermission)) return null;
  return new Response("Forbidden", { status: 403 });
}
