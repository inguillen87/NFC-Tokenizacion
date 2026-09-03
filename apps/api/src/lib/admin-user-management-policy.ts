import { permissionDenied, permissionMatches } from "./permission-matcher.js";
import { roleMayUseEnterpriseCapability } from "./enterprise-capability-policy";

export type ManagedAdminRole =
  | "tenant_owner" | "tenant_admin" | "security_analyst" | "operations_manager"
  | "packaging_operator" | "marketing_manager" | "viewer" | "reseller_admin"
  | "api_integration" | "super_admin" | "security_operator" | "reseller";

export type AdminUserManagementSession = {
  role: string;
  tenantId: string | null;
  permissions: string[];
  deniedPermissions?: string[];
};

export type AdminUserDelegationDecision =
  | { ok: true; role: ManagedAdminRole; permissions: string[] }
  | { ok: false; status: 400 | 403; reason: string };

export type AdminUserPermissionOverridesDecision =
  | {
      ok: true;
      role: ManagedAdminRole;
      allowPermissions: string[];
      deniedPermissions: string[];
    }
  | { ok: false; status: 400 | 403; reason: string };

const MANAGED_ROLES = new Set<ManagedAdminRole>([
  "tenant_owner", "tenant_admin", "security_analyst", "operations_manager",
  "packaging_operator", "marketing_manager", "viewer", "reseller_admin",
  "api_integration", "super_admin", "security_operator", "reseller",
]);
const TENANT_DELEGABLE_ROLES = new Set<ManagedAdminRole>([
  "tenant_admin", "security_analyst", "operations_manager", "packaging_operator",
  "marketing_manager", "viewer", "reseller_admin", "security_operator", "reseller",
]);
const PERMISSION_RE = /^[a-z0-9][a-z0-9_.-]*(?::[a-z0-9][a-z0-9_.-]*)*(?::(?:[a-z0-9][a-z0-9_.-]*|\*))$/;
const ENTERPRISE_CAPABILITY_RE = /^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)+$/;
const MAX_PERMISSION_COUNT = 128;
const MAX_PERMISSION_LENGTH = 128;

export type ParsedPermissionGrant = {
  permission: string;
  resource: string;
  action: string;
};

/**
 * Parses the external permission form while preserving every segment after
 * the first colon as the database action. Wildcards are allowed only as the
 * complete grant or as the final segment of a scoped grant.
 */
export function parsePermissionGrant(rawPermission: unknown): ParsedPermissionGrant | null {
  const permission = String(rawPermission || "").trim().toLowerCase();
  if (!permission || permission.length > MAX_PERMISSION_LENGTH) return null;
  if (permission === "*") return { permission, resource: "*", action: "*" };
  if (!PERMISSION_RE.test(permission)) return null;

  const separator = permission.indexOf(":");
  if (separator <= 0 || separator >= permission.length - 1) return null;
  return {
    permission,
    resource: permission.slice(0, separator),
    action: permission.slice(separator + 1),
  };
}

function normalizeRole(rawRole: unknown) {
  return String(rawRole || "").trim().toLowerCase().replaceAll("-", "_");
}

function normalizePermissions(rawPermissions: unknown): string[] | null {
  if (!Array.isArray(rawPermissions) || rawPermissions.length > MAX_PERMISSION_COUNT) return null;

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawPermission of rawPermissions) {
    const parsed = parsePermissionGrant(rawPermission);
    if (!parsed) return null;
    const { permission } = parsed;
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
  if (role === "api_integration") {
    return { ok: false, status: 400, reason: "api_integration_requires_tenant_api_key" };
  }

  const permissions = normalizePermissions(requestedPermissions);
  if (!permissions) {
    return { ok: false, status: 400, reason: "invalid_permissions" };
  }

  const normalizedSessionRole = normalizeRole(session.role);
  if (normalizedSessionRole === "super_admin") {
    return { ok: true, role: role as ManagedAdminRole, permissions };
  }

  if (!new Set(["tenant_owner", "tenant_admin"]).has(normalizedSessionRole) || !session.tenantId) {
    return { ok: false, status: 403, reason: "tenant_delegation_forbidden" };
  }
  if (!TENANT_DELEGABLE_ROLES.has(role as ManagedAdminRole)) {
    return { ok: false, status: 403, reason: "role_escalation_forbidden" };
  }
  if (permissions.includes("*") || permissions.some((permission) => !permissionMatches(
    session.permissions,
    permission,
    session.deniedPermissions,
  ))) {
    return { ok: false, status: 403, reason: "permission_escalation_forbidden" };
  }

  return { ok: true, role: role as ManagedAdminRole, permissions };
}

function normalizeRoleDefaultPermissions(rawPermissions: unknown): string[] | null {
  let candidate = rawPermissions;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(candidate) || candidate.length > MAX_PERMISSION_COUNT) return null;

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawPermission of candidate) {
    const value = String(rawPermission || "").trim().toLowerCase();
    if (!value || value.length > MAX_PERMISSION_LENGTH) return null;
    const parsed = parsePermissionGrant(value);
    if (!parsed && !ENTERPRISE_CAPABILITY_RE.test(value)) return null;
    const permission = parsed?.permission || value;
    if (!seen.has(permission)) {
      seen.add(permission);
      normalized.push(permission);
    }
  }
  return normalized;
}

/**
 * Validates an intentional override replacement independently from role
 * assignment. Both arrays must be supplied by the caller so an omitted field
 * can never be interpreted as an instruction to erase existing overrides.
 */
export function resolveAdminUserPermissionOverrides(
  session: AdminUserManagementSession,
  targetRole: unknown,
  rawAllowPermissions: unknown,
  rawDeniedPermissions: unknown,
  rawRoleDefaultPermissions: unknown,
): AdminUserPermissionOverridesDecision {
  const delegation = resolveAdminUserDelegation(session, targetRole, rawAllowPermissions);
  if (!delegation.ok) return delegation;

  const deniedPermissions = normalizePermissions(rawDeniedPermissions);
  if (!deniedPermissions) {
    return { ok: false, status: 400, reason: "invalid_denied_permissions" };
  }

  const allowSet = new Set(delegation.permissions);
  if (deniedPermissions.some((permission) => allowSet.has(permission))) {
    return { ok: false, status: 400, reason: "permission_override_conflict" };
  }

  const roleDefaultPermissions = normalizeRoleDefaultPermissions(rawRoleDefaultPermissions);
  if (!roleDefaultPermissions) {
    return { ok: false, status: 400, reason: "enterprise_role_profile_invalid" };
  }

  if ([...roleDefaultPermissions, ...delegation.permissions, ...deniedPermissions].some(
    (permission) => !roleMayUseEnterpriseCapability(delegation.role, permission),
  )) {
    return { ok: false, status: 403, reason: "permission_outside_role_boundary" };
  }

  if (normalizeRole(session.role) !== "super_admin"
    && roleDefaultPermissions.some((permission) => (
      !permissionDenied(deniedPermissions, permission)
      && !permissionMatches(session.permissions, permission, session.deniedPermissions)
    ))) {
    return { ok: false, status: 403, reason: "permission_escalation_forbidden" };
  }

  return {
    ok: true,
    role: delegation.role,
    allowPermissions: [...delegation.permissions].sort(),
    deniedPermissions: [...deniedPermissions].sort(),
  };
}

export function isProductionRuntime(nodeEnv: string | undefined, deploymentEnv?: string | undefined) {
  return [nodeEnv, deploymentEnv]
    .some((value) => String(value || "").trim().toLowerCase() === "production");
}

export function isProductionSecretExposureAllowed(nodeEnv: string | undefined, flag: string | undefined, deploymentEnv?: string | undefined) {
  return !isProductionRuntime(nodeEnv, deploymentEnv)
    && String(flag || "").trim().toLowerCase() === "true";
}
