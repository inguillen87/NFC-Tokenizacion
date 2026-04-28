export const ROLE_TO_SCOPE = {
  "super-admin": "super_admin",
  "tenant-admin": "tenant_admin",
  reseller: "reseller",
  viewer: "readonly_demo",
};

export function normalizeScope(scope, role) {
  const explicit = String(scope || "").trim();
  if (["super_admin", "tenant_admin", "reseller", "readonly_demo"].includes(explicit)) return explicit;
  return ROLE_TO_SCOPE[String(role || "").trim().toLowerCase()] || null;
}

export function evaluateAdminAccess({
  providedToken,
  expectedToken,
  requireScoped,
  scope,
  tenantSlug,
  requiredScopes = ["super_admin", "tenant_admin", "reseller", "readonly_demo"],
}) {
  if (scope) {
    if (!requiredScopes.includes(scope)) return { ok: false, status: 403 };
    if ((scope === "tenant_admin" || scope === "reseller") && !String(tenantSlug || "").trim()) {
      return { ok: false, status: 403 };
    }
    return { ok: true, status: 200 };
  }

  if (requireScoped) return { ok: false, status: 401 };
  if (!expectedToken || providedToken !== expectedToken) return { ok: false, status: 401 };
  return { ok: true, status: 200 };
}

export function resolveAdminTenantScope(scopeHeader, roleHeader, tenantSlugHeader) {
  const scope = normalizeScope(scopeHeader, roleHeader);
  const tenantSlug = String(tenantSlugHeader || "").trim().toLowerCase();
  const forcedTenantSlug = (scope === "tenant_admin" || scope === "reseller") && tenantSlug ? tenantSlug : "";
  return { scope, tenantSlug, forcedTenantSlug };
}
