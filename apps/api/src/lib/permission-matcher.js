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
  "risk_rules.write": ["risk_rules:write"],
  "webhooks.manage": ["webhooks:read", "webhooks:write"],
  "api_keys.read": ["sdk:keys:read"],
  "api_keys.manage": ["sdk:keys:write"],
  "proofs.read": ["proof:read"],
  "proofs.anchor": ["proof:write"],
  "audit.read": ["audit:read"],
  "reports.export": ["reports:export", "analytics:read"],
});

// These canonical permissions intentionally bundle distinct legacy actions.
// Every alias is required. Other multi-alias entries are historical synonyms,
// where any one alias is sufficient after the role boundary passes.
const ENTERPRISE_COMPOUND_PERMISSIONS = new Set([
  "reports.export",
  "webhooks.manage",
]);

const ENTERPRISE_PERMISSION_CANONICAL = Object.freeze(
  Object.fromEntries(Object.entries(ENTERPRISE_PERMISSION_ALIASES).flatMap(
    ([canonical, aliases]) => aliases.map((alias) => [alias, canonical]),
  )),
);

function canonicalPermission(value) {
  return ENTERPRISE_PERMISSION_CANONICAL[value] || value;
}

function expandedPermissions(value) {
  const permission = String(value || "").trim().toLowerCase();
  if (!permission) return [];
  const canonical = canonicalPermission(permission);
  const aliases = ENTERPRISE_PERMISSION_ALIASES[canonical] || [];
  if (permission !== canonical && ENTERPRISE_COMPOUND_PERMISSIONS.has(canonical)) {
    return [permission];
  }
  return [permission, canonical, ...aliases];
}

function expandedDenyPermissions(value) {
  const permission = String(value || "").trim().toLowerCase();
  if (!permission) return [];
  const canonical = canonicalPermission(permission);
  // Compound aliases are distinct actions (for example webhook read versus
  // write), not interchangeable historical spellings. An action-level deny
  // must still block the compound capability, while remaining scoped to that
  // action when another alias is requested directly. A canonical deny keeps
  // denying every action represented by the compound capability.
  if (permission !== canonical && ENTERPRISE_COMPOUND_PERMISSIONS.has(canonical)) {
    return [permission];
  }
  return [permission, canonical, ...(ENTERPRISE_PERMISSION_ALIASES[canonical] || [])];
}

function matchesOne(grant, target) {
  if (grant === "*" || grant === target) return true;
  if (!grant.endsWith(":*")) return false;
  const scope = grant.slice(0, -2);
  return target === scope || target.startsWith(`${scope}:`);
}

/**
 * Denies are evaluated against both the canonical dotted permission and every
 * legacy alias it represents. A deny of any required alias denies the compound
 * dotted capability; a dotted deny also denies each legacy alias it expands to.
 */
export function permissionDenied(denied, requested) {
  const current = String(requested || "").trim().toLowerCase();
  if (!current) return false;
  const targets = expandedDenyPermissions(current);
  return (Array.isArray(denied) ? denied : []).some((rawDeny) => {
    const denies = expandedDenyPermissions(rawDeny);
    return denies.some((deny) => targets.some((target) => matchesOne(deny, target)));
  });
}

export function permissionMatches(granted, requested, denied = []) {
  const current = String(requested || "").trim().toLowerCase();
  if (!current) return true;
  if (permissionDenied(denied, current)) return false;
  const canonical = canonicalPermission(current);
  const requestedAliases = ENTERPRISE_PERMISSION_ALIASES[canonical] || [];

  const grants = (Array.isArray(granted) ? granted : []).flatMap(expandedPermissions);
  if (grants.some((grant) => matchesOne(grant, current) || matchesOne(grant, canonical))) return true;
  // Multiple legacy grants may collectively satisfy one compound dotted
  // capability. Every required action must be covered; one partial grant can
  // never become `webhooks.manage` or another compound permission by itself.
  if (requestedAliases.length) {
    const aliasMatches = (target) => grants.some((grant) => matchesOne(grant, target));
    if (ENTERPRISE_COMPOUND_PERMISSIONS.has(canonical)
      ? requestedAliases.every(aliasMatches)
      : requestedAliases.some(aliasMatches)) return true;
  }

  return false;
}
