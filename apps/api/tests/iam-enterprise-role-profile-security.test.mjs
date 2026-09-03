import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  isEnterpriseRoleProfileTenantBindingValid,
  isActiveHumanEnterpriseRoleProfile,
  isSessionPrincipalCurrent,
  roleTenantBindingValid,
} = await import("../src/lib/iam.ts");
const { checkAdminWithPermission } = await import("../src/lib/auth.ts");

function humanSession(role, permissions, deniedPermissions = []) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "operator@tenant-a.example",
    label: "Tenant operator",
    role,
    tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    tenantSlug: "tenant-a",
    permissions,
    deniedPermissions,
    mfaVerified: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rotatedCookieValue: null,
    setupCompleted: true,
  };
}

test("enterprise role profiles allow human authentication only while active and human-enabled", () => {
  assert.equal(isActiveHumanEnterpriseRoleProfile({
    role_profile_active: true,
    role_profile_human_session_allowed: true,
  }), true);
  assert.equal(isActiveHumanEnterpriseRoleProfile({
    role_profile_active: false,
    role_profile_human_session_allowed: true,
  }), false);
  assert.equal(isActiveHumanEnterpriseRoleProfile({
    role_profile_active: true,
    role_profile_human_session_allowed: false,
  }), false);
  assert.equal(isActiveHumanEnterpriseRoleProfile({}), false);
});

test("session currency rejects inactive and machine-only profiles when the catalog exists", () => {
  const current = {
    admin_status: "active",
    membership_current: true,
    membership_scope_unambiguous: true,
    role: "tenant_admin",
    tenant_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  };
  assert.equal(isSessionPrincipalCurrent({
    ...current,
    role_profile_active: true,
    role_profile_human_session_allowed: true,
    role_profile_tenant_bound: true,
  }, true), true);
  assert.equal(isSessionPrincipalCurrent({
    ...current,
    role_profile_active: false,
    role_profile_human_session_allowed: true,
    role_profile_tenant_bound: true,
  }, true), false);
  assert.equal(isSessionPrincipalCurrent({
    ...current,
    role_profile_active: true,
    role_profile_human_session_allowed: false,
    role_profile_tenant_bound: true,
  }, true), false);
  assert.equal(isSessionPrincipalCurrent(current, false), true);
  assert.equal(isSessionPrincipalCurrent({
    ...current,
    membership_scope_unambiguous: false,
  }, false), false);
});

test("role and profile tenant binding reject malformed global or tenant authority", () => {
  const tenantId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  assert.equal(roleTenantBindingValid("super_admin", null), true);
  assert.equal(roleTenantBindingValid("super-admin", tenantId), false);
  assert.equal(roleTenantBindingValid("tenant_admin", tenantId), true);
  assert.equal(roleTenantBindingValid("tenant_admin", null), false);
  assert.equal(roleTenantBindingValid("unknown_role", tenantId), false);

  assert.equal(isEnterpriseRoleProfileTenantBindingValid({
    role: "tenant_admin", tenant_id: tenantId, role_profile_tenant_bound: true,
  }), true);
  assert.equal(isEnterpriseRoleProfileTenantBindingValid({
    role: "tenant_admin", tenant_id: null, role_profile_tenant_bound: true,
  }), false);
  assert.equal(isEnterpriseRoleProfileTenantBindingValid({
    role: "super_admin", tenant_id: null, role_profile_tenant_bound: false,
  }), true);
  assert.equal(isEnterpriseRoleProfileTenantBindingValid({
    role: "super_admin", tenant_id: tenantId, role_profile_tenant_bound: false,
  }), false);
});

test("login and live session queries bind to an active human catalog profile", async () => {
  const source = await readFile(new URL("../src/lib/iam.ts", import.meta.url), "utf8");
  const guardedJoins = source.match(/JOIN enterprise_role_profiles role_profile\s+ON role_profile\.code = (?:m|s)\.role::text\s+AND role_profile\.active = true\s+AND role_profile\.human_session_allowed = true/g) || [];

  assert.equal(guardedJoins.length, 2);
  assert.match(source, /roleProfilesReady && !isActiveHumanEnterpriseRoleProfile\(row/);
  assert.match(source, /role_profile\.tenant_bound AS role_profile_tenant_bound/g);
  assert.match(source, /roleTenantBindingValid\(row\.role, row\.tenant_id\)/);
  assert.match(source, /isSessionPrincipalCurrent\(session, roleProfilesReady\)/);
  assert.match(source, /WHEN 'reseller' THEN 10/);
});

test("login, live sessions, listings, and permission writers isolate grants by tenant", async () => {
  const [
    iam,
    managedUsers,
    presets,
    bootstrap,
    clerkSync,
    usersRoute,
    supplierQa,
    ephemeralE2e,
  ] = await Promise.all([
    "../src/lib/iam.ts",
    "../src/lib/admin-user-management.ts",
    "../src/lib/auth-presets.ts",
    "../scripts/bootstrap-saas.mjs",
    "../src/app/auth/clerk-sync/route.ts",
    "../src/app/admin/users/route.ts",
    "../scripts/validate-supplier-atomic-postgres-qa.mjs",
    "../scripts/enterprise-ephemeral-e2e.mjs",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

  assert.equal((iam.match(/rp\.tenant_id IS NOT DISTINCT FROM m\.tenant_id/g) || []).length, 2);
  assert.equal((iam.match(/current_permission\.tenant_id IS NOT DISTINCT FROM s\.tenant_id/g) || []).length, 2);
  assert.equal((iam.match(/current_denial\.tenant_id IS NOT DISTINCT FROM s\.tenant_id/g) || []).length, 2);
  assert.equal((iam.match(/AS membership_scope_unambiguous/g) || []).length, 2);
  assert.ok((iam.match(/FROM memberships active_membership/g) || []).length >= 4);
  assert.match(iam, /session\.membership_scope_unambiguous === true/);

  assert.equal((managedUsers.match(/INSERT INTO resource_permissions \(user_id, tenant_id, resource, action\)/g) || []).length, 2);
  assert.match(managedUsers, /scoped_permission\.tenant_id IS DISTINCT FROM \$\{input\.tenantId\}::uuid/);
  assert.match(presets, /INSERT INTO resource_permissions \(user_id, tenant_id, resource, action\)[\s\S]*\$\{tenantIdForMembership\}::uuid/);
  assert.match(bootstrap, /INSERT INTO resource_permissions \(user_id, tenant_id, resource, action\) VALUES \(\$\{userId\}::uuid, NULL/);
  assert.match(clerkSync, /INSERT INTO resource_permissions \(user_id, tenant_id, resource, action\)[\s\S]*VALUES \(\$\{userId\}::uuid, NULL/);
  assert.equal((usersRoute.match(/rp\.tenant_id IS NOT DISTINCT FROM m\.tenant_id/g) || []).length, 2);
  assert.match(supplierQa, /id, user_id, tenant_id, resource, action, effect/);
  assert.match(ephemeralE2e, /INSERT INTO resource_permissions \(user_id, tenant_id, resource, action, effect\)/);

  for (const source of [managedUsers, presets, bootstrap, clerkSync, supplierQa, ephemeralE2e]) {
    assert.doesNotMatch(source, /INSERT INTO resource_permissions \(user_id, resource, action/);
  }
});

test("canonical capabilities authorize specialized humans without restoring role-wide access", async () => {
  const allowedQa = new Request("https://api.nexid.test/admin/supplier-orders/id/qa", {
    headers: { authorization: "Bearer qa-session" },
  });
  assert.equal(await checkAdminWithPermission(
    allowedQa,
    "qa.approve",
    async () => humanSession("operations-manager", ["qa.approve"]),
  ), null);

  const deniedQa = new Request("https://api.nexid.test/admin/supplier-orders/id/qa", {
    headers: { authorization: "Bearer denied-qa-session" },
  });
  assert.equal((await checkAdminWithPermission(
    deniedQa,
    "qa.approve",
    async () => humanSession("operations-manager", ["qa.approve"], ["qa.approve"]),
  ))?.status, 403);

  const allowedManifest = new Request("https://api.nexid.test/admin/batches/bid/import-manifest", {
    headers: { authorization: "Bearer manifest-session" },
  });
  assert.equal(await checkAdminWithPermission(
    allowedManifest,
    "manifest.import",
    async () => humanSession("packaging-operator", ["manifest.import"]),
  ), null);

  const legacyReseller = new Request("https://api.nexid.test/admin/batches/bid/import-manifest", {
    headers: { authorization: "Bearer reseller-session" },
  });
  assert.equal((await checkAdminWithPermission(
    legacyReseller,
    "manifest.import",
    async () => humanSession("reseller", []),
  ))?.status, 403);
});

test("declared enterprise capabilities are wired through permission gates at their API boundaries", async () => {
  const sources = await Promise.all([
    "../src/app/admin/batches/[bid]/activate-all/route.ts",
    "../src/app/admin/tags/activate/route.ts",
    "../src/app/admin/audit-logs/route.ts",
    "../src/app/admin/analytics/route.ts",
    "../src/app/admin/proof/events/route.ts",
    "../src/app/admin/proof/anchors/route.ts",
    "../src/app/admin/alert-rules/route.ts",
    "../src/app/admin/alert-rules/[id]/route.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const combined = sources.join("\n");

  assert.ok((combined.match(/checkAdminWithPermission\(req, ['"]batch\.activate['"]\)/g) || []).length >= 2);
  assert.match(combined, /checkAdminWithPermission\(req, "audit\.read"\)/);
  assert.match(combined, /checkAdminWithPermission\(req, "analytics:read"\)/);
  assert.ok((combined.match(/checkAdminWithPermission\(req, "proof:(?:read|write)"\)/g) || []).length >= 4);
  assert.ok((combined.match(/checkAdminWithPermission\(req, "risk_rules:write"\)/g) || []).length >= 3);
  assert.doesNotMatch(combined, /checkAdmin\(req, \[["']super_admin["'], ["']tenant_admin["']\]\)/);
});
