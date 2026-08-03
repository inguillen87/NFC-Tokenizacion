import { permissionMatches } from "./permission-matcher.js";
import {
  parsePermissionGrant,
  resolveAdminUserDelegation,
  type AdminUserDelegationDecision,
  type AdminUserManagementSession,
} from "./admin-user-management-policy";

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

type EnterpriseRoleProfileRow = {
  code: string;
  display_name: string;
  tenant_bound: boolean;
  human_session_allowed: boolean;
  default_permissions: unknown;
  updated_at?: string | Date | null;
};

const ROLE_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
  tenant_owner: "Responsable máximo del workspace: gobierno del tenant, operación, integraciones y auditoría.",
  tenant_admin: "Administra la operación diaria del tenant, usuarios delegables y controles de producción autorizados.",
  security_analyst: "Investiga eventos, incidentes y evidencia de auditoría sin permisos de mutación operativa.",
  operations_manager: "Coordina pedidos, manifiestos, Packaging Lab, QA y activación dentro del tenant.",
  packaging_operator: "Opera Packaging Lab, manifiestos y reportes sin acceso a custodia de claves ni administración global.",
  marketing_manager: "Consulta reportes y señales comerciales sin modificar seguridad, custodia ni producción.",
  viewer: "Acceso de consulta mínimo, sin capacidades de mutación por defecto.",
  reseller_admin: "Gestiona pedidos y manifiestos autorizados del canal reseller dentro de su tenant.",
  api_integration: "Identidad no humana reservada para API keys; no puede recibir una sesión de usuario.",
  super_admin: "Control global de nexID. Debe permanecer fuera de tenants y exige los controles reforzados de la plataforma.",
  security_operator: "Opera reglas de riesgo, webhooks, proofs y auditoría cuando el delegante posee esas capacidades.",
});
const ENTERPRISE_CAPABILITY_RE = /^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)+$/;

function normalizedRole(value: unknown) {
  return String(value || "").trim().toLowerCase().replaceAll("-", "_");
}

function normalizedDefaultPermissions(value: unknown): string[] | null {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(candidate) || candidate.length > 128) return null;
  const permissions: string[] = [];
  const seen = new Set<string>();
  for (const entry of candidate) {
    const normalized = String(entry || "").trim().toLowerCase();
    const parsed = parsePermissionGrant(normalized);
    if (!parsed && !ENTERPRISE_CAPABILITY_RE.test(normalized)) return null;
    const permission = parsed?.permission || normalized;
    if (!seen.has(permission)) {
      seen.add(permission);
      permissions.push(permission);
    }
  }
  return permissions;
}

function roleProfileDecision(
  session: AdminUserManagementSession,
  row: EnterpriseRoleProfileRow,
): AdminUserDelegationDecision {
  const role = normalizedRole(row.code);
  const defaults = normalizedDefaultPermissions(row.default_permissions);
  const tenantBindingValid = role === "super_admin" ? row.tenant_bound === false : row.tenant_bound === true;
  if (!defaults || !row.human_session_allowed || !ROLE_DESCRIPTIONS[role]
    || !String(row.display_name || "").trim() || !tenantBindingValid) {
    return { ok: false, status: 400, reason: "enterprise_role_profile_invalid" };
  }

  const base = resolveAdminUserDelegation(session, role, []);
  if (!base.ok) return base;
  if (normalizedRole(session.role) === "super_admin") return base;

  const canDelegateDefaults = defaults.every((permission) => permissionMatches(
    session.permissions,
    permission,
    session.deniedPermissions,
  ));
  return canDelegateDefaults
    ? base
    : { ok: false, status: 403, reason: "permission_escalation_forbidden" };
}

async function activeHumanRoleProfile(query: Sql, requestedRole: unknown) {
  const role = normalizedRole(requestedRole);
  if (!role) return null;
  const rows = await query/*sql*/`
    SELECT code, display_name, tenant_bound, human_session_allowed,
      default_permissions, updated_at
    FROM enterprise_role_profiles
    WHERE code = ${role}
      AND active = true
      AND human_session_allowed = true
    LIMIT 1
  `;
  return (rows[0] || null) as EnterpriseRoleProfileRow | null;
}

export async function resolveManagedAdminDelegationRequest(
  query: Sql,
  session: AdminUserManagementSession,
  input: { role?: unknown; permissions?: unknown; permissionMode?: unknown },
): Promise<AdminUserDelegationDecision> {
  const permissionMode = String(input.permissionMode || "").trim().toLowerCase();
  if (permissionMode !== "role_default") {
    return { ok: false, status: 400, reason: "role_default_permission_mode_required" };
  }
  if (input.permissions !== undefined
    && (!Array.isArray(input.permissions) || input.permissions.length > 0)) {
    return { ok: false, status: 400, reason: "role_default_client_permissions_forbidden" };
  }

  const row = await activeHumanRoleProfile(query, input.role || "viewer");
  if (!row) return { ok: false, status: 400, reason: "invalid_role" };
  return roleProfileDecision(session, row);
}

export async function listDelegableEnterpriseRoleProfiles(
  query: Sql,
  session: AdminUserManagementSession,
) {
  const rows = await query/*sql*/`
    SELECT code, display_name, tenant_bound, human_session_allowed,
      default_permissions, updated_at
    FROM enterprise_role_profiles
    WHERE active = true
      AND human_session_allowed = true
    ORDER BY CASE code
      WHEN 'tenant_owner' THEN 1 WHEN 'tenant_admin' THEN 2
      WHEN 'security_analyst' THEN 3 WHEN 'operations_manager' THEN 4
      WHEN 'packaging_operator' THEN 5 WHEN 'marketing_manager' THEN 6
      WHEN 'viewer' THEN 7 WHEN 'reseller_admin' THEN 8
      WHEN 'security_operator' THEN 9 WHEN 'super_admin' THEN 10 ELSE 99 END
  ` as EnterpriseRoleProfileRow[];

  return rows.flatMap((row) => {
    const decision = roleProfileDecision(session, row);
    const defaults = normalizedDefaultPermissions(row.default_permissions);
    if (!decision.ok || !defaults) return [];
    const code = normalizedRole(row.code);
    return [{
      code,
      display_name: String(row.display_name || "").trim(),
      description: ROLE_DESCRIPTIONS[code],
      tenant_bound: row.tenant_bound === true,
      human_session_allowed: true,
      default_permissions: defaults,
      permission_mode: "role_default" as const,
      updated_at: row.updated_at || null,
    }];
  });
}
