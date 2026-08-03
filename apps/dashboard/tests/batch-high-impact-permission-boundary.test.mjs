import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  DASHBOARD_ENTERPRISE_ROLES,
  DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES,
  dashboardRoleHasHighImpactCapability,
} = await import("../src/lib/enterprise-runtime-rbac.ts");
const {
  dashboardHighImpactPermissionMatches,
  dashboardPermissionMatches,
  requiredPermissionForAdminResource,
} = await import("../src/lib/permission-policy.ts");

const EXPECTED = Object.freeze({
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
});

test("high-impact batch capabilities are exact dotted grants with no legacy broad alias", () => {
  assert.deepEqual(DASHBOARD_HIGH_IMPACT_CAPABILITY_ROLES, EXPECTED);

  for (const role of DASHBOARD_ENTERPRISE_ROLES) {
    for (const capability of Object.keys(EXPECTED)) {
      const expected = EXPECTED[capability].includes(role);
      assert.equal(dashboardRoleHasHighImpactCapability(role, capability), expected, `${role}:${capability}`);
      assert.equal(
        dashboardHighImpactPermissionMatches(role, [capability], capability),
        expected,
        `${role}:${capability}:session-grant`,
      );
    }
  }

  for (const capability of Object.keys(EXPECTED)) {
    assert.equal(dashboardPermissionMatches(["batches:write"], capability), false, capability);
  }
  assert.equal(dashboardHighImpactPermissionMatches("operations-manager", ["batch.revoke"], "batch.revoke"), false);
  assert.equal(dashboardHighImpactPermissionMatches("tenant-admin", ["batch.revoke"], "batch.revoke", ["batch.revoke"]), false);
  assert.equal(dashboardHighImpactPermissionMatches("tenant-admin", ["*"], "batch.revoke"), true);
  assert.equal(dashboardHighImpactPermissionMatches("viewer", ["*"], "batch.revoke"), false);
  assert.equal(dashboardHighImpactPermissionMatches("tenant-admin", ["supplier:production_qa_plan:approve"], "qa.plan.approve"), true);
  assert.equal(dashboardHighImpactPermissionMatches("super-admin", ["*"], "qa.plan.approve"), false);
  assert.equal(dashboardHighImpactPermissionMatches("operations-manager", ["supplier_order.create"], "supplier_order.create"), true);
  assert.equal(dashboardHighImpactPermissionMatches("operations-manager", ["supplier_order.create"], "batch.keys.generate"), false);
  assert.equal(dashboardHighImpactPermissionMatches("operations-manager", ["supplier_order.create"], "supplier_pack.export"), false);
  assert.equal(dashboardHighImpactPermissionMatches("tenant-admin", ["proofs.read"], "proofs.anchor"), false);
});

test("admin BFF binds only the exact high-impact batch method and path pairs", () => {
  const exact = [
    ["POST", "supplier-orders", "supplier_order.create"],
    ["POST", "supplier-orders/order-1/export", "supplier_pack.export"],
    ["POST", "supplier-orders/order-1/export-pack", "supplier_pack.export"],
    ["PATCH", "batches/SYG-2026/state", "batch.lifecycle"],
    ["POST", "batches/SYG-2026/revoke", "batch.revoke"],
    ["PATCH", "batches/SYG-2026/tamper-config", "batch.tamper.configure"],
    ["POST", "tags/mark-opened", "tag.tamper.override"],
    ["PATCH", "batches/SYG-2026/product-config", "batch.product.configure"],
    ["PATCH", "alerts/alert-123/ack", "alerts.ack"],
    ["GET", "events", "events.read_sensitive"],
    ["GET", "events/stream", "events.read_sensitive"],
    ["GET", "alerts", "audit.read"],
    ["GET", "security-alerts", "audit.read"],
    ["GET", "consumer-experiences", "consumer_experiences.read_pii"],
    ["PATCH", "consumer-experiences", "consumer_experiences.moderate"],
    ["GET", "consumer-portal/members", "consumers.read_pii"],
    ["GET", "leads", "leads.manage"],
    ["POST", "leads", "leads.manage"],
    ["POST", "supplier-orders/order-1/sub-batches/SYG-2026/production-acceptance/plan/plan-1/decision", "qa.plan.approve"],
    ["POST", "sdk/claim-policy", "ownership.claim_policy.manage"],
    ["POST", "batches/SYG-2026/import-manifest", "manifest.import"],
    ["POST", "supplier-orders/order-1/qa", "qa.approve"],
    ["POST", "batches/SYG-2026/activate-all", "batch.activate"],
    ["GET", "sdk/api-keys", "api_keys.read"],
    ["POST", "sdk/api-keys", "api_keys.manage"],
    ["PATCH", "sdk/api-keys/key-1", "api_keys.manage"],
    ["GET", "proof/anchors", "proofs.read"],
    ["POST", "proof/events", "proofs.anchor"],
  ];
  for (const [method, path, capability] of exact) {
    assert.equal(requiredPermissionForAdminResource(method, path), capability, `${method} ${path}`);
  }

  for (const [method, path, expectedFallback] of [
    ["GET", "batches/SYG-2026/state", null],
    ["POST", "batches/SYG-2026/state", null],
    ["PATCH", "batches/SYG-2026/revoke", null],
    ["POST", "batches/SYG-2026/child/revoke", null],
    ["POST", "batches/SYG-2026/tamper-config", null],
    ["GET", "tags/mark-opened", "tags:read"],
    ["POST", "batches/SYG-2026/product-config", null],
    ["POST", "alerts/alert-123/ack", null],
    ["POST", "events", null],
    ["POST", "consumer-experiences", null],
    ["PATCH", "leads", null],
    ["GET", "supplier-orders/order-1/sub-batches/SYG-2026/production-acceptance/plan/plan-1/decision", null],
    ["GET", "sdk/claim-policy", null],
    ["GET", "batches/SYG-2026/import-manifest", null],
    ["GET", "supplier-orders/order-1/qa", null],
    ["GET", "batches/SYG-2026/activate-all", null],
  ]) {
    assert.equal(requiredPermissionForAdminResource(method, path), expectedFallback, `${method} ${path}`);
  }
});

test("BFF and UI consume the same fail-closed high-impact batch policy", async () => {
  const [proxy, page, control, forms] = await Promise.all([
    readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(app)/batches/[bid]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(app)/batches/[bid]/batch-lifecycle-control.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin-action-forms.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(proxy, /dashboardHighImpactPermissionMatches\([\s\S]*requiredPermission/);
  assert.match(page, /dashboardHighImpactPermissionMatches\([\s\S]*"batch\.lifecycle"/);
  assert.match(page, /dashboardHighImpactPermissionMatches\([\s\S]*"batch\.revoke"/);
  assert.match(page, /canManageLifecycle \|\| canRevoke/);

  assert.match(control, /\/state`[\s\S]*method: "PATCH"/);
  assert.match(control, /\/revoke`[\s\S]*method: "POST"/);
  assert.match(control, /canManageLifecycle \?/);
  assert.match(control, /canRevoke \?/);

  assert.match(forms, /dashboardHighImpactPermissionMatches\([\s\S]*"batch\.revoke"/);
  assert.match(forms, /canRevoke \? \(/);
  assert.doesNotMatch(forms, /!canEdit \|\| !revoke\.batchId/);
});
