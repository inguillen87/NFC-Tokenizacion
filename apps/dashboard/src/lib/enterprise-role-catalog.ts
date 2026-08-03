export const ENTERPRISE_ROLE_PERMISSION_MODE = "role_default" as const;

export type EnterpriseRoleCatalogEntry = {
  code: string;
  displayName: string;
  description: string;
  tenantBound: boolean;
  humanSessionAllowed: true;
  defaultPermissions: string[];
  permissionMode: typeof ENTERPRISE_ROLE_PERMISSION_MODE;
  updatedAt: string | null;
};

const ROLE_CODE = /^[a-z][a-z0-9_]{2,79}$/;
const PERMISSION = /^(?:\*|[a-z0-9][a-z0-9_.-]*(?::[a-z0-9][a-z0-9_.-]*)*(?::(?:[a-z0-9][a-z0-9_.-]*|\*))|[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)+)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeEnterpriseRoleCode(value: unknown) {
  return String(value || "").trim().toLowerCase().replaceAll("-", "_");
}

function parsePermissions(value: unknown) {
  if (!Array.isArray(value) || value.length > 128) return null;
  const permissions: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const permission = String(entry || "").trim().toLowerCase();
    if (!PERMISSION.test(permission)) return null;
    if (!seen.has(permission)) {
      seen.add(permission);
      permissions.push(permission);
    }
  }
  return permissions;
}

export function parseEnterpriseRoleCatalog(value: unknown): EnterpriseRoleCatalogEntry[] | null {
  if (!isRecord(value)
    || value.ok !== true
    || value.permissionMode !== ENTERPRISE_ROLE_PERMISSION_MODE
    || !Array.isArray(value.roles)
    || value.roles.length < 1
    || value.roles.length > 32) return null;

  const roles: EnterpriseRoleCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const candidate of value.roles) {
    if (!isRecord(candidate)) return null;
    const code = normalizeEnterpriseRoleCode(candidate.code);
    const displayName = String(candidate.display_name || "").trim();
    const description = String(candidate.description || "").trim();
    const defaultPermissions = parsePermissions(candidate.default_permissions);
    const updatedAt = candidate.updated_at == null ? null : String(candidate.updated_at).trim();
    if (!ROLE_CODE.test(code)
      || seen.has(code)
      || !displayName || displayName.length > 120
      || !description || description.length > 600
      || candidate.human_session_allowed !== true
      || typeof candidate.tenant_bound !== "boolean"
      || candidate.permission_mode !== ENTERPRISE_ROLE_PERMISSION_MODE
      || !defaultPermissions
      || (updatedAt !== null && (!updatedAt || !Number.isFinite(Date.parse(updatedAt))))) return null;
    seen.add(code);
    roles.push({
      code,
      displayName,
      description,
      tenantBound: candidate.tenant_bound,
      humanSessionAllowed: true,
      defaultPermissions,
      permissionMode: ENTERPRISE_ROLE_PERMISSION_MODE,
      updatedAt,
    });
  }
  return roles;
}

export function enterpriseRoleCatalogFailureMessage(status: number, reason?: unknown) {
  if (status === 401) return "La sesión venció o no está autenticada. Volvé a iniciar sesión antes de administrar roles.";
  if (status === 403) return "Tu sesión no está autorizada para delegar roles enterprise.";
  if (String(reason || "").includes("migration_required")) return "El catálogo RBAC enterprise todavía no está disponible en este entorno.";
  return "No se pudo validar el catálogo autoritativo de roles. Las altas y ediciones permanecen bloqueadas.";
}
