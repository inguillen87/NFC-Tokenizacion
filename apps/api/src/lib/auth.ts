import { evaluateAdminAccess, normalizeScope } from "./admin-auth-policy";
export type AdminScope = "super_admin" | "tenant_admin" | "reseller" | "readonly_demo";

function resolveScope(req: Request): AdminScope | null {
  return normalizeScope(req.headers.get("x-nexid-admin-scope"), req.headers.get("x-dashboard-role")) as AdminScope | null;
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
