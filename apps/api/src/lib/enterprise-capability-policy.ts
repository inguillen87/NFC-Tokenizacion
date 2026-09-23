/**
 * Authoritative human-role boundary for canonical enterprise and commercial
 * capabilities.
 *
 * A permission grant is necessary but is not sufficient for the high-impact
 * capabilities listed here. This prevents a stale/custom legacy
 * resource_permissions row from turning an unrelated tenant role into a
 * physical-truth, PII or custody operator. Unknown legacy permissions retain
 * their historical behavior until they are deliberately added to this map.
 */
const REQUESTED_PERMISSION_CANONICAL = Object.freeze<Record<string, string>>({
  "supplier_requests:assigned_read": "supplier_request.assigned.read",
  "supplier_requests:assigned_review": "supplier_request.assigned.review",
  "supplier_requests:assign": "supplier_request.assign",
  "supplier_orders:write": "supplier_order.create",
  "supplier:batch_keys_generate": "batch.keys.generate",
  "supplier:pack_export": "supplier_pack.export",
  "analytics:read": "reports.export",
  "reports:export": "reports.export",
  "audit:read": "audit.read",
  "proof:read": "proofs.read",
  "proof:write": "proofs.anchor",
  "risk_rules:write": "risk_rules.write",
  "supplier:qa_approve": "qa.approve",
  "supplier:qa": "qa.approve",
  "supplier:production_qa_plan:approve": "qa.plan.approve",
  "supplier:manifest_import": "manifest.import",
  "supplier:packaging_lab_manage": "packaging_lab.manage",
  "supplier:packaging_lab_override": "packaging_lab.override",
  "supplier:batch_activate": "batch.activate",
  "supplier:activate_override": "batch.activation.override",
  "batch:register_internal": "batch.internal.register",
  "supplier:key_rotate": "batch.keys.rotate",
  "batch:lifecycle": "batch.lifecycle",
  "webhooks:read": "webhooks.manage",
  "webhooks:write": "webhooks.manage",
  "sdk:keys:read": "api_keys.read",
  "sdk:keys:write": "api_keys.manage",
});

const ENTERPRISE_CAPABILITY_ROLES = Object.freeze<Record<string, readonly string[]>>({
  "supplier_request.assigned.read": ["supplier-operator"],
  "supplier_request.assigned.review": ["supplier-operator"],
  "supplier_request.assign": ["super-admin"],
  "supplier_order.create": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager", "reseller-admin"],
  "batch.keys.generate": ["super-admin", "tenant-owner"],
  "supplier_pack.export": ["super-admin", "tenant-owner"],
  "users:manage": ["super-admin", "tenant-owner", "tenant-admin"],
  "manifest.import": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager", "packaging-operator", "reseller-admin"],
  "packaging_lab.manage": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager", "packaging-operator"],
  "packaging_lab.override": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager"],
  "qa.approve": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager"],
  // A quality-plan approval is tenant-owned dual control. NexID global admins
  // may operate QA but cannot approve the customer's policy on its behalf.
  "qa.plan.approve": ["tenant-owner", "tenant-admin"],
  "batch.activate": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager"],
  "batch.activation.override": ["super-admin", "tenant-owner", "tenant-admin"],
  "batch.internal.register": ["super-admin", "tenant-owner", "tenant-admin"],
  "batch.keys.rotate": ["super-admin", "tenant-owner", "tenant-admin"],
  "batch.lifecycle": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager"],
  "batch.revoke": ["super-admin", "tenant-owner", "tenant-admin"],
  "batch.tamper.configure": ["super-admin", "tenant-owner", "tenant-admin", "security-operator"],
  "tag.tamper.override": ["super-admin", "tenant-owner", "tenant-admin", "security-operator"],
  "batch.product.review": ["super-admin", "tenant-owner", "tenant-admin"],
  "batch.product.publish": ["super-admin", "tenant-owner", "tenant-admin"],
  "batch.product.configure": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
  "ownership.claim_policy.manage": ["super-admin", "tenant-owner", "tenant-admin"],
  "risk_rules.write": ["super-admin", "tenant-owner", "security-operator"],
  "alerts.ack": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager", "security-operator"],
  "webhooks.manage": ["super-admin", "tenant-owner", "tenant-admin", "security-operator", "api-integration"],
  "api_keys.read": ["super-admin", "tenant-owner", "tenant-admin"],
  "api_keys.manage": ["super-admin", "tenant-owner", "tenant-admin"],
  "proofs.read": ["super-admin", "tenant-owner", "tenant-admin", "security-analyst", "security-operator"],
  "proofs.anchor": ["super-admin", "tenant-owner", "security-operator"],
  "audit.read": ["super-admin", "tenant-owner", "tenant-admin", "security-analyst", "security-operator"],
  "events.read_sensitive": ["super-admin", "tenant-owner", "tenant-admin", "security-analyst", "operations-manager", "security-operator"],
  "incidents:read": ["super-admin", "tenant-owner", "tenant-admin", "security-analyst", "operations-manager", "security-operator"],
  "incidents:write": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager", "security-operator"],
  "consumer_experiences.read_pii": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
  "consumer_experiences.moderate": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
  "consumers.read_pii": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
  "leads.manage": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager", "reseller-admin"],
  "reports.export": [
    "super-admin", "tenant-owner", "tenant-admin", "security-analyst",
    "operations-manager", "packaging-operator", "marketing-manager",
    "reseller-admin", "security-operator",
  ],
  "crm:read": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
  "campaigns:read": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
  "campaigns:write": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
  "campaigns:test_whatsapp": ["super-admin", "tenant-owner", "tenant-admin"],
  "rewards:read": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
  "rewards:write": ["super-admin", "tenant-owner", "tenant-admin"],
  "rewards:validate": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager"],
  "marketplace:read": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
  "marketplace:write": ["super-admin", "tenant-owner", "tenant-admin"],
});

const COMMERCIAL_PERMISSION_NAMESPACES = new Set([
  "crm",
  "campaigns",
  "rewards",
  "marketplace",
]);

function normalizeRole(value: unknown) {
  return String(value || "").trim().toLowerCase().replaceAll("_", "-");
}

export function canonicalEnterpriseCapability(value: unknown) {
  const requested = String(value || "").trim().toLowerCase();
  return REQUESTED_PERMISSION_CANONICAL[requested] || requested;
}

export function roleMayUseEnterpriseCapability(role: unknown, requestedPermission: unknown) {
  const canonical = canonicalEnterpriseCapability(requestedPermission);
  if (normalizeRole(role) === "supplier-operator") return canonical === "supplier_request.assigned.read" || canonical === "supplier_request.assigned.review";
  const allowlist = ENTERPRISE_CAPABILITY_ROLES[canonical];
  if (!allowlist) {
    const namespace = canonical.split(":", 1)[0];
    // Commercial capabilities are allowlist-only: a namespace wildcard or a
    // newly introduced action remains unavailable until explicitly reviewed.
    return !COMMERCIAL_PERMISSION_NAMESPACES.has(namespace);
  }
  return allowlist.includes(normalizeRole(role));
}

export function enterpriseCapabilityRoles(requestedPermission: unknown) {
  const canonical = canonicalEnterpriseCapability(requestedPermission);
  return [...(ENTERPRISE_CAPABILITY_ROLES[canonical] || [])];
}
