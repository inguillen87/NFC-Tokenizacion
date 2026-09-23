import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  DASHBOARD_ENTERPRISE_ROLES,
  DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES,
  DASHBOARD_HUMAN_ENTERPRISE_ROLES,
  dashboardRoleAllowsHumanSession,
  dashboardRoleToScope,
  normalizeDashboardEnterpriseRole,
} = await import("../src/lib/enterprise-runtime-rbac.ts");
const {
  ENTERPRISE_PERMISSION_ALIASES,
  dashboardCanReadSensitiveAlerts,
  dashboardCanReadSensitiveRiskAnalytics,
  dashboardHighImpactPermissionMatches,
  dashboardPermissionDenied,
  dashboardPermissionMatches,
} = await import("../src/lib/permission-policy.ts");
const {
  dashboardContent,
  roleAccess,
} = await import("../src/lib/dashboard-content.ts");

const EXPECTED_ROLE_SCOPES = Object.freeze({
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
  "supplier-operator": "supplier_operator",
  "security-operator": "tenant_operator",
  reseller: "reseller",
});

const EXPECTED_PERMISSION_ALIASES = Object.freeze({
  "supplier_request.assigned.read": ["supplier_requests:assigned_read"],
  "supplier_request.assigned.review": ["supplier_requests:assigned_review"],
  "supplier_request.assign": ["supplier_requests:assign"],
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
});

const ROLE_DEFAULTS = Object.freeze({
  "supplier-operator": ["supplier_request.assigned.read", "supplier_request.assigned.review"],
  "tenant-owner": ["users:manage", "supplier_order.create", "batch.keys.generate", "supplier_pack.export", "manifest.import", "packaging_lab.manage", "qa.approve", "qa.plan.approve", "batch.activate", "batch.lifecycle", "batch.revoke", "batch.tamper.configure", "tag.tamper.override", "batch.product.configure", "alerts.ack", "risk_rules.write", "webhooks.manage", "proofs.read", "proofs.anchor", "ownership.claim_policy.manage", "api_keys.read", "api_keys.manage", "audit.read", "events.read_sensitive", "consumer_experiences.read_pii", "consumer_experiences.moderate", "consumers.read_pii", "leads.manage", "reports.export"],
  "tenant-admin": ["users:manage", "supplier_order.create", "manifest.import", "packaging_lab.manage", "qa.approve", "qa.plan.approve", "batch.activate", "batch.lifecycle", "batch.revoke", "batch.tamper.configure", "tag.tamper.override", "batch.product.configure", "alerts.ack", "webhooks.manage", "proofs.read", "ownership.claim_policy.manage", "api_keys.read", "api_keys.manage", "audit.read", "events.read_sensitive", "consumer_experiences.read_pii", "consumer_experiences.moderate", "consumers.read_pii", "leads.manage", "reports.export"],
  "security-analyst": ["proofs.read", "audit.read", "events.read_sensitive", "reports.export"],
  "operations-manager": ["supplier_order.create", "manifest.import", "packaging_lab.manage", "qa.approve", "batch.activate", "batch.lifecycle", "alerts.ack", "events.read_sensitive", "reports.export"],
  "packaging-operator": ["packaging_lab.manage", "manifest.import", "reports.export"],
  "marketing-manager": ["batch.product.configure", "consumer_experiences.read_pii", "consumer_experiences.moderate", "consumers.read_pii", "leads.manage", "reports.export"],
  viewer: [],
  "reseller-admin": ["supplier_order.create", "manifest.import", "leads.manage", "reports.export"],
  "api-integration": [],
  "super-admin": ["supplier_order.create", "batch.keys.generate", "supplier_pack.export", "manifest.import", "packaging_lab.manage", "qa.approve", "batch.activate", "batch.lifecycle", "batch.revoke", "batch.tamper.configure", "tag.tamper.override", "batch.product.configure", "alerts.ack", "risk_rules.write", "webhooks.manage", "proofs.read", "proofs.anchor", "ownership.claim_policy.manage", "api_keys.read", "api_keys.manage", "audit.read", "events.read_sensitive", "consumer_experiences.read_pii", "consumer_experiences.moderate", "consumers.read_pii", "leads.manage", "reports.export"],
  "security-operator": ["batch.tamper.configure", "tag.tamper.override", "alerts.ack", "risk_rules.write", "webhooks.manage", "proofs.read", "proofs.anchor", "audit.read", "events.read_sensitive", "reports.export"],
  reseller: [],
});

test("dashboard runtime recognizes all 13 backend roles and maps their scopes without fallback escalation", () => {
  assert.deepEqual(DASHBOARD_ENTERPRISE_ROLES, Object.keys(EXPECTED_ROLE_SCOPES));
  assert.equal(DASHBOARD_HUMAN_ENTERPRISE_ROLES.length, 12);

  for (const [role, scope] of Object.entries(EXPECTED_ROLE_SCOPES)) {
    assert.equal(normalizeDashboardEnterpriseRole(role.replaceAll("-", "_")), role);
    assert.equal(dashboardRoleToScope(role), scope, role);
    assert.equal(dashboardRoleAllowsHumanSession(role), role !== "api-integration", role);
  }

  for (const unsupported of ["", "admin", "superuser", "tenant_operator", null, undefined]) {
    assert.equal(normalizeDashboardEnterpriseRole(unsupported), null);
    assert.equal(dashboardRoleToScope(unsupported), null);
    assert.equal(dashboardRoleAllowsHumanSession(unsupported), false);
  }
});

test("dashboard dotted aliases stay exactly aligned with the backend permission contract", () => {
  assert.deepEqual(ENTERPRISE_PERMISSION_ALIASES, EXPECTED_PERMISSION_ALIASES);

  for (const [canonical, aliases] of Object.entries(EXPECTED_PERMISSION_ALIASES)) {
    for (const alias of aliases) {
      assert.equal(dashboardPermissionMatches([canonical], alias), true, `${canonical} -> ${alias}`);
      assert.equal(dashboardPermissionMatches([canonical], alias, [alias]), false, `deny ${alias}`);
    }
    assert.equal(dashboardPermissionMatches(aliases, canonical), true, `legacy aliases -> ${canonical}`);
    if (["reports.export", "webhooks.manage"].includes(canonical)) {
      assert.equal(dashboardPermissionMatches([aliases[0]], canonical), false, `partial alias cannot synthesize ${canonical}`);
    } else if (aliases.length > 1) {
      assert.equal(dashboardPermissionMatches([aliases[0]], canonical), true, `legacy synonym -> ${canonical}`);
    }
    assert.equal(dashboardPermissionDenied([canonical], aliases[0]), true, `${canonical} deny -> ${aliases[0]}`);
  }

  assert.equal(dashboardPermissionMatches(["tenant:*"], "api_keys.read"), true);
  assert.equal(dashboardPermissionMatches(["tenant:read"], "api_keys.manage"), false);
  assert.equal(dashboardPermissionMatches(["tenant:*"], "sdk:keys:read"), false);
  assert.equal(dashboardPermissionDenied(["webhooks:write"], "webhooks:read"), false);
  assert.equal(dashboardPermissionDenied(["webhooks:read"], "webhooks:write"), false);
  assert.equal(dashboardPermissionMatches(["webhooks.manage"], "webhooks:read", ["webhooks:write"]), true);
  assert.equal(dashboardPermissionMatches(["webhooks.manage"], "webhooks:write", ["webhooks:write"]), false);
  assert.equal(dashboardPermissionMatches(["*"], "reports.export", ["*"]), false);
});

test("every enterprise role receives only the UI capabilities implied by its authoritative defaults", () => {
  const checks = {
    manifest: "supplier:manifest_import",
    packaging: "supplier:packaging_lab_manage",
    qa: "supplier:qa_approve",
    activation: "supplier:batch_activate",
    risk: "risk_rules:write",
    webhooks: "webhooks:write",
    proof: "proof:write",
    analytics: "analytics:read",
  };
  const expected = {
    "supplier-operator":  [0, 0, 0, 0, 0, 0, 0, 0],
    "tenant-owner":       [1, 1, 1, 1, 1, 1, 1, 1],
    "tenant-admin":       [1, 1, 1, 1, 0, 1, 0, 1],
    "security-analyst":   [0, 0, 0, 0, 0, 0, 0, 1],
    "operations-manager": [1, 1, 1, 1, 0, 0, 0, 1],
    "packaging-operator":  [1, 1, 0, 0, 0, 0, 0, 1],
    "marketing-manager":  [0, 0, 0, 0, 0, 0, 0, 1],
    viewer:                [0, 0, 0, 0, 0, 0, 0, 0],
    "reseller-admin":     [1, 0, 0, 0, 0, 0, 0, 1],
    "api-integration":    [0, 0, 0, 0, 0, 0, 0, 0],
    "super-admin":        [1, 1, 1, 1, 1, 1, 1, 1],
    "security-operator":  [0, 0, 0, 0, 1, 1, 1, 1],
    reseller:              [0, 0, 0, 0, 0, 0, 0, 0],
  };

  for (const role of DASHBOARD_ENTERPRISE_ROLES) {
    const actual = Object.values(checks).map((permission) => Number(
      dashboardPermissionMatches(ROLE_DEFAULTS[role], permission),
    ));
    assert.deepEqual(actual, expected[role], role);
  }
});

test("authoritative defaults and role allowlists agree for every high-impact capability", () => {
  for (const role of DASHBOARD_ENTERPRISE_ROLES) {
    for (const [capability, allowedRoles] of Object.entries(DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES)) {
      const expected = allowedRoles.includes(role) && dashboardPermissionMatches(ROLE_DEFAULTS[role], capability);
      assert.equal(
        dashboardHighImpactPermissionMatches(role, ROLE_DEFAULTS[role], capability),
        expected,
        `${role}:${capability}`,
      );
      assert.equal(
        dashboardHighImpactPermissionMatches(role, ROLE_DEFAULTS[role], capability, [capability]),
        false,
        `${role}:${capability}:deny`,
      );
    }
  }

  for (const role of DASHBOARD_ENTERPRISE_ROLES) {
    const expected = DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES["events.read_sensitive"].includes(role)
      && ROLE_DEFAULTS[role].includes("reports.export")
      && ROLE_DEFAULTS[role].includes("events.read_sensitive");
    assert.equal(
      dashboardCanReadSensitiveRiskAnalytics(role, ROLE_DEFAULTS[role]),
      expected,
      `${role}:risk-analytics`,
    );
  }

  assert.equal(dashboardCanReadSensitiveAlerts("security-analyst", ["audit.read", "events.read_sensitive"]), true);
  assert.equal(dashboardCanReadSensitiveAlerts("security-analyst", ["audit.read"]), false);
  assert.equal(dashboardCanReadSensitiveAlerts("security-analyst", ["audit.read", "events.read_sensitive"], ["events.read_sensitive"]), false);
});

test("every dashboard locale and navigation profile is exhaustive for the enterprise role catalog", () => {
  assert.deepEqual(Object.keys(roleAccess).sort(), [...DASHBOARD_ENTERPRISE_ROLES].sort());
  assert.deepEqual(roleAccess["api-integration"], []);

  for (const [locale, content] of Object.entries(dashboardContent)) {
    assert.deepEqual(
      Object.keys(content.roles).sort(),
      [...DASHBOARD_ENTERPRISE_ROLES].sort(),
      locale,
    );
  }

  for (const role of DASHBOARD_ENTERPRISE_ROLES) {
    assert.equal(
      roleAccess[role].includes("events"),
      DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES["events.read_sensitive"].includes(role),
      `${role}:events`,
    );
    assert.equal(
      roleAccess[role].includes("experiences"),
      DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES["consumer_experiences.read_pii"].includes(role),
      `${role}:experiences`,
    );
  }
});

test("admin BFF, stream and UI runtime consume the shared fail-closed role catalog", async () => {
  const [proxy, stream, session, forms, shell, layout, destinations] = await Promise.all([
    readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/events/stream/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin-action-forms.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(app)/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/dashboard-destination-policy.ts", import.meta.url), "utf8"),
  ]);

  assert.match(proxy, /import \{ dashboardRoleToScope \} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/enterprise-runtime-rbac"/);
  assert.doesNotMatch(proxy, /function dashboardRoleToScope/);
  assert.match(proxy, /demoSession && scopedRole === "readonly_demo"/);
  assert.doesNotMatch(proxy, /policy\.allowDemoFallback \|\| scopedRole === "readonly_demo"/);
  assert.match(proxy, /dashboardCanReadSensitiveAlerts\(/);
  assert.match(proxy, /requiredPermissions: \["audit\.read", "events\.read_sensitive"\]/);

  assert.match(stream, /dashboardRoleToScope\(session\?\.role\)/);
  assert.doesNotMatch(stream, /session\?\.role === "tenant-admin"[\s\S]*\? "readonly_demo"/);

  assert.match(session, /normalizeDashboardHumanSessionRole\(data\.session\.role\)/);
  assert.match(session, /if \(!role\) return null/);

  assert.match(forms, /import type \{ UserRole \} from "\.\.\/lib\/dashboard-content"/);
  assert.doesNotMatch(forms, /type Role = "super-admin" \| "tenant-admin" \| "reseller" \| "viewer"/);
  assert.match(forms, /Partial<Record<UserRole, string>>/);

  assert.match(shell, /currentRole: UserRole/);
  assert.match(shell, /currentRole === "reseller-admin" \|\| currentRole === "reseller"/);
  assert.match(shell, /dashboardCanOpenDestination\(destination, destinationAccess\)/);
  assert.match(destinations, /dashboardPermissionMatches\(permissions, permission, deniedPermissions\)/);
  assert.match(destinations, /dashboardHighImpactPermissionMatches\([\s\S]*deniedPermissions/);
  assert.match(layout, /currentDeniedPermissions=\{session\.deniedPermissions\}/);
});
