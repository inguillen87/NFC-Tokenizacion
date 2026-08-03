export const DASHBOARD_ENTERPRISE_ROLES = [
  "tenant-owner",
  "tenant-admin",
  "security-analyst",
  "operations-manager",
  "packaging-operator",
  "marketing-manager",
  "viewer",
  "reseller-admin",
  "api-integration",
  "super-admin",
  "security-operator",
  "reseller",
] as const;

export type DashboardEnterpriseRole = (typeof DASHBOARD_ENTERPRISE_ROLES)[number];
export type DashboardHumanEnterpriseRole = Exclude<DashboardEnterpriseRole, "api-integration">;
export type DashboardHighImpactCapability =
  | "supplier_order.create"
  | "batch.keys.generate"
  | "supplier_pack.export"
  | "batch.lifecycle"
  | "batch.revoke"
  | "batch.tamper.configure"
  | "tag.tamper.override"
  | "batch.product.configure"
  | "alerts.ack"
  | "events.read_sensitive"
  | "consumer_experiences.read_pii"
  | "consumer_experiences.moderate"
  | "consumers.read_pii"
  | "leads.manage"
  | "qa.plan.approve"
  | "ownership.claim_policy.manage"
  | "api_keys.read"
  | "api_keys.manage"
  | "proofs.read"
  | "proofs.anchor";
export type DashboardAdminScope =
  | "super_admin"
  | "tenant_admin"
  | "tenant_operator"
  | "reseller"
  | "readonly_demo";

const ROLE_SET = new Set<string>(DASHBOARD_ENTERPRISE_ROLES);

export const DASHBOARD_HUMAN_ENTERPRISE_ROLES = DASHBOARD_ENTERPRISE_ROLES.filter(
  (role): role is DashboardHumanEnterpriseRole => role !== "api-integration",
);

export const DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES = Object.freeze({
  "supplier_order.create": ["tenant-owner", "tenant-admin", "operations-manager", "reseller-admin", "super-admin"],
  "batch.keys.generate": ["tenant-owner", "super-admin"],
  "supplier_pack.export": ["tenant-owner", "super-admin"],
  "batch.lifecycle": ["tenant-owner", "tenant-admin", "operations-manager", "super-admin"],
  "batch.revoke": ["tenant-owner", "tenant-admin", "super-admin"],
  "batch.tamper.configure": ["tenant-owner", "tenant-admin", "security-operator", "super-admin"],
  "tag.tamper.override": ["tenant-owner", "tenant-admin", "security-operator", "super-admin"],
  "batch.product.configure": ["tenant-owner", "tenant-admin", "marketing-manager", "super-admin"],
  "alerts.ack": ["tenant-owner", "tenant-admin", "operations-manager", "security-operator", "super-admin"],
  "events.read_sensitive": ["tenant-owner", "tenant-admin", "security-analyst", "operations-manager", "security-operator", "super-admin"],
  "consumer_experiences.read_pii": ["tenant-owner", "tenant-admin", "marketing-manager", "super-admin"],
  "consumer_experiences.moderate": ["tenant-owner", "tenant-admin", "marketing-manager", "super-admin"],
  "consumers.read_pii": ["tenant-owner", "tenant-admin", "marketing-manager", "super-admin"],
  "leads.manage": ["tenant-owner", "tenant-admin", "marketing-manager", "reseller-admin", "super-admin"],
  "qa.plan.approve": ["tenant-owner", "tenant-admin"],
  "ownership.claim_policy.manage": ["tenant-owner", "tenant-admin", "super-admin"],
  "api_keys.read": ["tenant-owner", "tenant-admin", "super-admin"],
  "api_keys.manage": ["tenant-owner", "tenant-admin", "super-admin"],
  "proofs.read": ["tenant-owner", "tenant-admin", "security-analyst", "security-operator", "super-admin"],
  "proofs.anchor": ["tenant-owner", "security-operator", "super-admin"],
} satisfies Readonly<Record<DashboardHighImpactCapability, readonly DashboardEnterpriseRole[]>>);

const ROLE_SCOPE = Object.freeze({
  "tenant-owner": "tenant_admin",
  "tenant-admin": "tenant_admin",
  "security-analyst": "tenant_operator",
  "operations-manager": "tenant_operator",
  "packaging-operator": "tenant_operator",
  "marketing-manager": "tenant_operator",
  viewer: "readonly_demo",
  "reseller-admin": "reseller",
  "api-integration": null,
  "super-admin": "super_admin",
  "security-operator": "tenant_operator",
  reseller: "reseller",
} satisfies Readonly<Record<DashboardEnterpriseRole, DashboardAdminScope | null>>);

const ROLE_LABEL = Object.freeze({
  "tenant-owner": "Tenant Owner",
  "tenant-admin": "Tenant Admin",
  "security-analyst": "Security Analyst",
  "operations-manager": "Operations Manager",
  "packaging-operator": "Packaging Operator",
  "marketing-manager": "Marketing Manager",
  viewer: "Viewer",
  "reseller-admin": "Reseller Admin",
  "api-integration": "API Integration",
  "super-admin": "Super Admin",
  "security-operator": "Security Operator",
  reseller: "Reseller",
} satisfies Readonly<Record<DashboardEnterpriseRole, string>>);

const ROLE_INITIALS = Object.freeze({
  "tenant-owner": "TO",
  "tenant-admin": "TA",
  "security-analyst": "AN",
  "operations-manager": "OM",
  "packaging-operator": "PO",
  "marketing-manager": "MM",
  viewer: "VI",
  "reseller-admin": "RA",
  "api-integration": "AI",
  "super-admin": "SA",
  "security-operator": "SO",
  reseller: "RS",
} satisfies Readonly<Record<DashboardEnterpriseRole, string>>);

export function normalizeDashboardEnterpriseRole(value: unknown): DashboardEnterpriseRole | null {
  const role = String(value || "").trim().toLowerCase().replaceAll("_", "-");
  return ROLE_SET.has(role) ? role as DashboardEnterpriseRole : null;
}

export function normalizeDashboardHumanSessionRole(value: unknown): DashboardHumanEnterpriseRole | null {
  const role = normalizeDashboardEnterpriseRole(value);
  return role && role !== "api-integration" ? role : null;
}

export function dashboardRoleAllowsHumanSession(value: unknown): value is DashboardHumanEnterpriseRole {
  return normalizeDashboardHumanSessionRole(value) !== null;
}

export function dashboardRoleToScope(value: unknown): DashboardAdminScope | null {
  const role = normalizeDashboardEnterpriseRole(value);
  return role ? ROLE_SCOPE[role] : null;
}

export function dashboardRoleHasHighImpactCapability(
  value: unknown,
  capability: unknown,
): boolean {
  const role = normalizeDashboardEnterpriseRole(value);
  const normalizedCapability = String(capability || "").trim().toLowerCase();
  if (!role || !(normalizedCapability in DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES)) return false;
  const allowedRoles = DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES[
    normalizedCapability as DashboardHighImpactCapability
  ] as readonly DashboardEnterpriseRole[];
  return allowedRoles.includes(role);
}

export function dashboardRoleLabel(value: unknown): string {
  const role = normalizeDashboardEnterpriseRole(value);
  return role ? ROLE_LABEL[role] : "Unknown role";
}

export function dashboardRoleInitials(value: unknown): string {
  const role = normalizeDashboardEnterpriseRole(value);
  return role ? ROLE_INITIALS[role] : "?";
}

export function dashboardRoleDescription(value: unknown, mode: "tenant" | "global"): string {
  const role = normalizeDashboardEnterpriseRole(value);
  if (!role) return "Rol no reconocido; el acceso permanece bloqueado.";
  if (role === "super-admin") return "Control global de tenants, seguridad, red comercial y plataforma.";
  if (role === "tenant-owner") return "Gobierno del tenant y delegación de su operación autorizada.";
  if (role === "tenant-admin") return mode === "tenant"
    ? "Administra la operación diaria autorizada del tenant."
    : "Administra un tenant operativo desde el workspace global.";
  if (role === "security-analyst") return "Investiga auditoría y reportes sin mutaciones operativas implícitas.";
  if (role === "security-operator") return "Opera controles de riesgo, webhooks y pruebas autorizadas.";
  if (role === "operations-manager") return "Coordina manifiestos, Packaging Lab, QA y activaciones autorizadas.";
  if (role === "packaging-operator") return "Opera packaging y manifiestos según sus permisos vigentes.";
  if (role === "marketing-manager") return "Consulta reportes y superficies comerciales autorizadas.";
  if (role === "reseller-admin" || role === "reseller") return "Opera el canal reseller dentro de su tenant autorizado.";
  if (role === "api-integration") return "Identidad de máquina; no admite sesión humana del dashboard.";
  return "Acceso de consulta limitado por permisos del workspace.";
}
