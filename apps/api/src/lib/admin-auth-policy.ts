import type { AdminScope } from "./auth";

export const ROLE_TO_SCOPE: Record<string, AdminScope> = {
  "super-admin": "super_admin",
  "tenant-admin": "tenant_admin",
  reseller: "reseller",
  viewer: "readonly_demo",
};

export function normalizeScope(scope: string | null | undefined, role: string | null | undefined): AdminScope | null {
  const explicit = String(scope || "").trim();
  if (explicit === "super_admin" || explicit === "tenant_admin" || explicit === "reseller" || explicit === "readonly_demo") {
    return explicit;
  }
  return ROLE_TO_SCOPE[String(role || "").trim().toLowerCase()] || null;
}

export function evaluateAdminAccess({
  providedToken,
  expectedToken,
  requireScoped,
  scope,
  tenantSlug,
  requiredScopes = ["super_admin", "tenant_admin", "reseller", "readonly_demo"],
}: {
  providedToken: string;
  expectedToken: string;
  requireScoped: boolean;
  scope: AdminScope | null;
  tenantSlug?: string | null;
  requiredScopes?: AdminScope[];
}) {
  if (scope) {
    if (!requiredScopes.includes(scope)) return { ok: false, status: 403 as const };
    if ((scope === "tenant_admin" || scope === "reseller") && !String(tenantSlug || "").trim()) {
      return { ok: false, status: 403 as const };
    }
    return { ok: true, status: 200 as const };
  }

  if (requireScoped) return { ok: false, status: 401 as const };
  if (!expectedToken || providedToken !== expectedToken) return { ok: false, status: 401 as const };
  return { ok: true, status: 200 as const };
}

export function resolveAdminTenantScope(scopeHeader: string | null | undefined, roleHeader: string | null | undefined, tenantSlugHeader: string | null | undefined) {
  const scope = normalizeScope(scopeHeader, roleHeader);
  const tenantSlug = String(tenantSlugHeader || "").trim().toLowerCase();
  const forcedTenantSlug = (scope === "tenant_admin" || scope === "reseller") && tenantSlug ? tenantSlug : "";
  return { scope, tenantSlug, forcedTenantSlug };
}
