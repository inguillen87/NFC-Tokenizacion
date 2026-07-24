import { permissionMatches } from "./permission-matcher.js";

export type ManagedAdminRole = "super_admin" | "tenant_admin" | "reseller" | "viewer";

export type AdminUserManagementSession = {
  role: string;
  tenantId: string | null;
  permissions: string[];
};

export type AdminUserDelegationDecision =
  | { ok: true; role: ManagedAdminRole; permissions: string[] }
  | { ok: false; status: 400 | 403; reason: string };

const MANAGED_ROLES = new Set<ManagedAdminRole>(["super_admin", "tenant_admin", "reseller", "viewer"]);
const TENANT_DELEGABLE_ROLES = new Set<ManagedAdminRole>(["tenant_admin", "reseller", "viewer"]);
const PERMISSION_RE = /^[a-z0-9][a-z0-9_.-]*:(?:\*|[a-z0-9][a-z0-9_.-]*)$/;
const MAX_PERMISSION_COUNT = 128;
const MAX_PERMISSION_LENGTH = 128;

function normalizeRole(rawRole: unknown) {
  return String(rawRole || "").trim().toLowerCase().replaceAll("-", "_");
}

function normalizePermissions(rawPermissions: unknown): string[] | null {
  if (!Array.isArray(rawPermissions) || rawPermissions.length > MAX_PERMISSION_COUNT) return null;

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawPermission of rawPermissions) {
    const permission = String(rawPermission || "").trim().toLowerCase();
    if (!permission || permission.length > MAX_PERMISSION_LENGTH || (permission !== "*" && !PERMISSION_RE.test(permission))) return null;
    if (!seen.has(permission)) {
      seen.add(permission);
      normalized.push(permission);
    }
  }
  return normalized;
}

export function resolveAdminUserDelegation(
  session: AdminUserManagementSession,
  requestedRole: unknown,
  requestedPermissions: unknown,
): AdminUserDelegationDecision {
  const role = normalizeRole(requestedRole);
  if (!MANAGED_ROLES.has(role as ManagedAdminRole)) {
    return { ok: false, status: 400, reason: "invalid_role" };
  }

  const permissions = normalizePermissions(requestedPermissions);
  if (!permissions) {
    return { ok: false, status: 400, reason: "invalid_permissions" };
  }

  const normalizedSessionRole = normalizeRole(session.role);
  if (normalizedSessionRole === "super_admin") {
    return { ok: true, role: role as ManagedAdminRole, permissions };
  }

  if (normalizedSessionRole !== "tenant_admin" || !session.tenantId) {
    return { ok: false, status: 403, reason: "tenant_delegation_forbidden" };
  }
  if (!TENANT_DELEGABLE_ROLES.has(role as ManagedAdminRole)) {
    return { ok: false, status: 403, reason: "role_escalation_forbidden" };
  }
  if (permissions.includes("*") || permissions.some((permission) => !permissionMatches(session.permissions, permission))) {
    return { ok: false, status: 403, reason: "permission_escalation_forbidden" };
  }

  return { ok: true, role: role as ManagedAdminRole, permissions };
}

export function isProductionRuntime(nodeEnv: string | undefined, deploymentEnv?: string | undefined) {
  return [nodeEnv, deploymentEnv]
    .some((value) => String(value || "").trim().toLowerCase() === "production");
}

export function isProductionSecretExposureAllowed(nodeEnv: string | undefined, flag: string | undefined, deploymentEnv?: string | undefined) {
  return !isProductionRuntime(nodeEnv, deploymentEnv)
    && String(flag || "").trim().toLowerCase() === "true";
}
