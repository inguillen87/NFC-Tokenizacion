import type { UserRole } from "./dashboard-content";

export type DashboardTenantScopeSession = {
  role: UserRole;
  tenantSlug?: string | null;
};

export type DashboardTenantScope = {
  tenantSlug: string;
  isGlobal: boolean;
  canSelectTenant: boolean;
};

export class DashboardTenantScopeError extends Error {
  readonly code: "tenant_scope_required" | "tenant_scope_invalid";

  constructor(code: DashboardTenantScopeError["code"]) {
    super(code);
    this.name = "DashboardTenantScopeError";
    this.code = code;
  }
}

const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;

export function normalizeDashboardTenantSlug(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  return String(first || "").trim().toLowerCase();
}

function requireValidTenantSlug(value: unknown, required: boolean): string {
  const slug = normalizeDashboardTenantSlug(value);
  if (!slug) {
    if (required) throw new DashboardTenantScopeError("tenant_scope_required");
    return "";
  }
  if (!TENANT_SLUG_PATTERN.test(slug)) {
    throw new DashboardTenantScopeError("tenant_scope_invalid");
  }
  return slug;
}

/**
 * Only a super-admin may intentionally request the global scope or another tenant.
 * Every other role is bound to the tenant stored in its validated session. Query
 * parameters are deliberately ignored for those roles.
 */
export function resolveDashboardTenantScope(
  session: DashboardTenantScopeSession,
  requestedTenant?: unknown,
): DashboardTenantScope {
  if (session.role === "super-admin") {
    const tenantSlug = requireValidTenantSlug(requestedTenant, false);
    return {
      tenantSlug,
      isGlobal: !tenantSlug,
      canSelectTenant: true,
    };
  }

  const tenantSlug = requireValidTenantSlug(session.tenantSlug, true);
  return {
    tenantSlug,
    isGlobal: false,
    canSelectTenant: false,
  };
}
