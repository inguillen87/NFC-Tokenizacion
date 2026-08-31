import {
  DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES,
  dashboardRoleHasHighImpactCapability,
  type DashboardHighImpactCapability,
} from "./enterprise-runtime-rbac";

export const ENTERPRISE_PERMISSION_ALIASES = Object.freeze({
  "supplier_order.create": ["supplier_orders:write"],
  "batch.keys.generate": ["supplier:batch_keys_generate"],
  "supplier_pack.export": ["supplier:pack_export"],
  "manifest.import": ["supplier:manifest_import"],
  "packaging_lab.manage": ["supplier:packaging_lab_manage"],
  "packaging_lab.override": ["supplier:packaging_lab_override"],
  "qa.approve": ["supplier:qa_approve", "supplier:qa"],
  "qa.plan.approve": ["supplier:production_qa_plan:approve"],
  "batch.activate": ["supplier:batch_activate"],
  "batch.activation.override": ["supplier:activate_override"],
  "batch.internal.register": ["batch:register_internal"],
  "batch.keys.rotate": ["supplier:key_rotate"],
  "batch.lifecycle": ["batch:lifecycle"],
  "api_keys.read": ["sdk:keys:read"],
  "api_keys.manage": ["sdk:keys:write"],
  "risk_rules.write": ["risk_rules:write"],
  "webhooks.manage": ["webhooks:read", "webhooks:write"],
  "proofs.read": ["proof:read"],
  "proofs.anchor": ["proof:write"],
  "audit.read": ["audit:read"],
  "reports.export": ["reports:export", "analytics:read"],
} satisfies Readonly<Record<string, readonly string[]>>);

const ENTERPRISE_COMPOUND_PERMISSIONS = new Set([
  "reports.export",
  "webhooks.manage",
]);

const ENTERPRISE_PERMISSION_CANONICAL = Object.freeze(
  Object.fromEntries(Object.entries(ENTERPRISE_PERMISSION_ALIASES).flatMap(
    ([canonical, aliases]) => aliases.map((alias) => [alias, canonical]),
  )) as Readonly<Record<string, string>>,
);

function canonicalPermission(permission: string) {
  return ENTERPRISE_PERMISSION_CANONICAL[permission] || permission;
}

const DASHBOARD_REQUEST_FALLBACKS = Object.freeze({
  "api_keys.read": ["tenant:read"],
  "api_keys.manage": ["tenant:write"],
} satisfies Readonly<Record<string, readonly string[]>>);

function aliasesFor(permission: string): readonly string[] {
  return ENTERPRISE_PERMISSION_ALIASES[permission as keyof typeof ENTERPRISE_PERMISSION_ALIASES] || [];
}

function requestFallbacksFor(permission: string): readonly string[] {
  return DASHBOARD_REQUEST_FALLBACKS[permission as keyof typeof DASHBOARD_REQUEST_FALLBACKS] || [];
}

function expandedPermissions(value: unknown): string[] {
  const permission = String(value || "").trim().toLowerCase();
  if (!permission) return [];
  const canonical = canonicalPermission(permission);
  if (permission !== canonical && ENTERPRISE_COMPOUND_PERMISSIONS.has(canonical)) {
    return [permission];
  }
  return [permission, canonical, ...aliasesFor(canonical)];
}

function expandedDenyPermissions(value: unknown): string[] {
  const permission = String(value || "").trim().toLowerCase();
  if (!permission) return [];
  const canonical = canonicalPermission(permission);
  // Compound aliases model separate actions. Denying one action blocks the
  // compound capability without silently denying its sibling action. A deny
  // on the canonical capability continues to deny every represented action.
  if (permission !== canonical && ENTERPRISE_COMPOUND_PERMISSIONS.has(canonical)) {
    return [permission];
  }
  return [permission, canonical, ...aliasesFor(canonical)];
}

function matchesOne(grant: string, target: string) {
  if (grant === "*" || grant === target) return true;
  if (!grant.endsWith(":*")) return false;
  const scope = grant.slice(0, -2);
  return target === scope || target.startsWith(`${scope}:`);
}

export function dashboardPermissionDenied(denied: unknown, requested?: string | null) {
  const current = String(requested || "").trim().toLowerCase();
  if (!current) return false;
  const canonical = canonicalPermission(current);
  const targets = [
    ...expandedDenyPermissions(current),
    ...(current === canonical ? requestFallbacksFor(canonical) : []),
  ];
  return (Array.isArray(denied) ? denied : []).some((rawDeny) => (
    expandedDenyPermissions(rawDeny).some((deny) => targets.some((target) => matchesOne(deny, target)))
  ));
}

export function dashboardPermissionMatches(
  granted: unknown,
  requested?: string | null,
  denied: unknown = [],
) {
  const current = String(requested || "").trim().toLowerCase();
  if (!current) return true;
  if (dashboardPermissionDenied(denied, current)) return false;
  const canonical = canonicalPermission(current);

  const grants = (Array.isArray(granted) ? granted : []).flatMap(expandedPermissions);
  if (grants.some((grant) => matchesOne(grant, current) || matchesOne(grant, canonical))) return true;

  const requestedAliases = aliasesFor(canonical);
  if (requestedAliases.length > 0) {
    const aliasMatches = (target: string) => grants.some((grant) => matchesOne(grant, target));
    if (ENTERPRISE_COMPOUND_PERMISSIONS.has(canonical)
      ? requestedAliases.every(aliasMatches)
      : requestedAliases.some(aliasMatches)) return true;
  }

  return (current === canonical ? requestFallbacksFor(canonical) : []).some((target) => (
    grants.some((grant) => matchesOne(grant, target))
  ));
}

export function isDashboardHighImpactCapability(value: unknown): value is DashboardHighImpactCapability {
  const capability = String(value || "").trim().toLowerCase();
  return capability in DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES;
}

export function dashboardHighImpactPermissionMatches(
  role: unknown,
  granted: unknown,
  requested: unknown,
  denied: unknown = [],
) {
  const capability = String(requested || "").trim().toLowerCase();
  return isDashboardHighImpactCapability(capability)
    && dashboardRoleHasHighImpactCapability(role, capability)
    && dashboardPermissionMatches(granted, capability, denied);
}

export function dashboardCanReadSensitiveRiskAnalytics(
  role: unknown,
  granted: unknown,
  denied: unknown = [],
) {
  return dashboardHighImpactPermissionMatches(
    role,
    granted,
    "events.read_sensitive",
    denied,
  ) && dashboardPermissionMatches(granted, "reports.export", denied);
}

export function dashboardCanReadSensitiveAlerts(
  role: unknown,
  granted: unknown,
  denied: unknown = [],
) {
  return dashboardHighImpactPermissionMatches(
    role,
    granted,
    "events.read_sensitive",
    denied,
  ) && dashboardPermissionMatches(granted, "audit.read", denied);
}

export function requiredPermissionForAdminResource(method: string, normalizedPath: string) {
  const normalizedMethod = String(method || "").toUpperCase();
  if (normalizedMethod === "POST" && normalizedPath === "supplier-orders") {
    return "supplier_order.create";
  }
  if (normalizedMethod === "POST" && /^supplier-orders\/[^/]+\/(?:export|export-pack)$/.test(normalizedPath)) {
    return "supplier_pack.export";
  }
  if (normalizedMethod === "PATCH" && /^batches\/[^/]+\/state$/.test(normalizedPath)) {
    return "batch.lifecycle";
  }
  if (normalizedMethod === "POST" && /^batches\/[^/]+\/revoke$/.test(normalizedPath)) {
    return "batch.revoke";
  }
  if (normalizedMethod === "PATCH" && /^batches\/[^/]+\/tamper-config$/.test(normalizedPath)) {
    return "batch.tamper.configure";
  }
  if (normalizedMethod === "POST" && normalizedPath === "tags/mark-opened") {
    return "tag.tamper.override";
  }
  if (normalizedMethod === "PATCH" && /^batches\/[^/]+\/product-config$/.test(normalizedPath)) {
    return "batch.product.configure";
  }
  if (normalizedMethod === "PATCH" && /^alerts\/[^/]+\/ack$/.test(normalizedPath)) {
    return "alerts.ack";
  }
  if (normalizedMethod === "GET" && (normalizedPath === "events" || normalizedPath === "events/stream")) {
    return "events.read_sensitive";
  }
  if (normalizedMethod === "GET" && normalizedPath === "sun/physical-taps") {
    return "events.read_sensitive";
  }
  if (normalizedMethod === "GET" && (normalizedPath === "alerts" || normalizedPath === "security-alerts")) {
    return "audit.read";
  }
  if (normalizedMethod === "GET" && normalizedPath === "consumer-experiences") {
    return "consumer_experiences.read_pii";
  }
  if (normalizedMethod === "PATCH" && normalizedPath === "consumer-experiences") {
    return "consumer_experiences.moderate";
  }
  if (normalizedMethod === "GET" && normalizedPath === "consumer-portal/members") {
    return "consumers.read_pii";
  }
  if ((normalizedMethod === "GET" || normalizedMethod === "POST") && normalizedPath === "leads") {
    return "leads.manage";
  }
  if (
    normalizedMethod === "POST"
    && /^supplier-orders\/[^/]+\/sub-batches\/[^/]+\/production-acceptance\/plan\/[^/]+\/decision$/.test(normalizedPath)
  ) {
    return "qa.plan.approve";
  }
  if (normalizedMethod === "POST" && normalizedPath === "sdk/claim-policy") {
    return "ownership.claim_policy.manage";
  }
  if (normalizedMethod === "POST" && /^batches\/[^/]+\/import-manifest$/.test(normalizedPath)) {
    return "manifest.import";
  }
  if (normalizedMethod === "POST" && /^supplier-orders\/[^/]+\/qa$/.test(normalizedPath)) {
    return "qa.approve";
  }
  if (normalizedMethod === "POST" && /^batches\/[^/]+\/activate-all$/.test(normalizedPath)) {
    return "batch.activate";
  }
  if (normalizedPath === "tenant-vault" || normalizedPath.startsWith("tenant-vault/")) {
    return normalizedMethod === "GET" ? "supplier_orders:read" : null;
  }
  if (/^supplier-orders\/[^/]+\/purpose\/classify-trial$/.test(normalizedPath)) {
    return "supplier:pack_purpose_classify_trial";
  }
  if (/^supplier-orders\/[^/]+\/packaging-lab(?:\/report)?$/.test(normalizedPath)) {
    // The API applies action-level manage/approve/override permissions from the
    // authenticated principal.  The proxy only establishes that this operator
    // may open the tenant-scoped supplier-order surface.
    return "supplier_orders:read";
  }
  if (normalizedPath === "observability/service-levels") {
    return "analytics:read";
  }
  if (normalizedMethod === "GET" && normalizedPath === "risk-analytics") {
    return "reports.export";
  }
  if (normalizedPath === "tags" || normalizedPath.startsWith("tags/")) {
    return normalizedMethod === "GET" ? "tags:read" : "tags:write";
  }
  if (normalizedPath === "incidents" || normalizedPath.startsWith("incidents/")) {
    return normalizedMethod === "GET" ? "incidents:read" : "incidents:write";
  }
  if (normalizedPath === "sdk/api-keys" || normalizedPath.startsWith("sdk/api-keys/")) {
    return normalizedMethod === "GET" ? "api_keys.read" : "api_keys.manage";
  }
  if (normalizedPath === "proof" || normalizedPath.startsWith("proof/")) {
    return normalizedMethod === "GET" ? "proofs.read" : "proofs.anchor";
  }
  if (normalizedPath === "offline-verifier" || normalizedPath.startsWith("offline-verifier/")) {
    return "supplier:offline_verifier";
  }
  if (
    normalizedPath === "tokenization"
    || normalizedPath.startsWith("tokenization/")
    || normalizedPath === "polygon/wallet"
    || normalizedPath === "product-assets"
  ) {
    return normalizedMethod === "GET" ? "tokenization:read" : "tokenization:write";
  }
  return null;
}

export function requiresMfaForAdminResource(method: string, normalizedPath: string) {
  const normalizedMethod = String(method || "").toUpperCase();
  return normalizedMethod !== "GET"
    && normalizedMethod !== "HEAD"
    && (
      normalizedPath === "sdk/claim-policy"
      || normalizedPath === "sdk/api-keys"
      || normalizedPath.startsWith("sdk/api-keys/")
    );
}

export function requiresSuperAdminForAdminResource(method: string, normalizedPath: string) {
  const normalizedMethod = String(method || "").toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") return false;
  return /^supplier-orders\/[^/]+\/lifecycle$/.test(normalizedPath)
    || /^tenant-vault\/[^/]+\/artifacts\/[^/]+\/download$/.test(normalizedPath)
    || /^offline-verifier\/(devices|bundles)(?:\/|$)/.test(normalizedPath);
}

export function isSupplierManifestQuantityOverrideRequest(method: string, normalizedPath: string, rawBody: string) {
  if (String(method || "").toUpperCase() !== "POST") return false;
  if (!/^batches\/[^/]+\/import-manifest$/.test(normalizedPath)) return false;
  try {
    const payload = JSON.parse(String(rawBody || "")) as Record<string, unknown>;
    return Boolean(String(payload.overrideReason || payload.override_reason || "").trim());
  } catch {
    return false;
  }
}
