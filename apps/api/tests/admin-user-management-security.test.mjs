import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  isProductionSecretExposureAllowed,
  isProductionRuntime,
  resolveAdminUserDelegation,
} = await import("../src/lib/admin-user-management-policy.ts");
const { isSessionPrincipalCurrent } = await import("../src/lib/iam.ts");

const tenantSession = {
  role: "tenant-admin",
  tenantId: "11111111-1111-4111-8111-111111111111",
  permissions: ["users:manage", "batches:*", "analytics:read", "events:read"],
};

async function source(relativePath) {
  return readFile(new URL(`../src/${relativePath}`, import.meta.url), "utf8");
}

test("tenant admins cannot delegate super-admin, wildcard, or permissions they do not hold", () => {
  assert.deepEqual(resolveAdminUserDelegation(tenantSession, "super_admin", []), {
    ok: false,
    status: 403,
    reason: "role_escalation_forbidden",
  });
  assert.deepEqual(resolveAdminUserDelegation(tenantSession, "viewer", ["*"]), {
    ok: false,
    status: 403,
    reason: "permission_escalation_forbidden",
  });
  assert.deepEqual(resolveAdminUserDelegation(tenantSession, "viewer", ["proof:write"]), {
    ok: false,
    status: 403,
    reason: "permission_escalation_forbidden",
  });
});

test("tenant delegation accepts only covered grants and deduplicates them", () => {
  assert.deepEqual(
    resolveAdminUserDelegation(tenantSession, "tenant-admin", ["batches:write", "analytics:read", "batches:write"]),
    { ok: true, role: "tenant_admin", permissions: ["batches:write", "analytics:read"] },
  );
  assert.equal(resolveAdminUserDelegation(tenantSession, "viewer", ["batches:read"]).ok, true);
  assert.equal(resolveAdminUserDelegation(tenantSession, "viewer", ["proof:read"]).ok, false);
});

test("delegation rejects missing tenant context, unknown roles, and malformed grants", () => {
  assert.equal(resolveAdminUserDelegation({ ...tenantSession, tenantId: null }, "viewer", []).status, 403);
  assert.equal(resolveAdminUserDelegation(tenantSession, "owner", []).status, 400);
  assert.equal(resolveAdminUserDelegation(tenantSession, "viewer", ["events:"]).status, 400);
  assert.equal(resolveAdminUserDelegation(tenantSession, "viewer", [""]).status, 400);
});

test("super-admin keeps explicit global delegation without weakening input validation", () => {
  const superSession = { role: "super-admin", tenantId: null, permissions: [] };
  assert.deepEqual(resolveAdminUserDelegation(superSession, "super_admin", ["*"]), {
    ok: true,
    role: "super_admin",
    permissions: ["*"],
  });
  assert.equal(resolveAdminUserDelegation(superSession, "invalid", ["*"]).ok, false);
});

test("production never exposes admin activation or reset secrets", () => {
  assert.equal(isProductionSecretExposureAllowed("production", "true"), false);
  assert.equal(isProductionSecretExposureAllowed("development", "true", "production"), false);
  assert.equal(isProductionSecretExposureAllowed("development", "true"), true);
  assert.equal(isProductionSecretExposureAllowed("development", "false"), false);
  assert.equal(isProductionRuntime("production", "preview"), true);
});

test("disabled, invited, or membership-drifted sessions fail closed", () => {
  assert.equal(isSessionPrincipalCurrent({ admin_status: "active", membership_current: true }), true);
  assert.equal(isSessionPrincipalCurrent({ admin_status: "disabled", membership_current: true }), false);
  assert.equal(isSessionPrincipalCurrent({ admin_status: "invited", membership_current: true }), false);
  assert.equal(isSessionPrincipalCurrent({ admin_status: "active", membership_current: false }), false);
});

test("email-based create and invite are atomic create-only operations", async () => {
  const usersRoute = await source("app/admin/users/route.ts");
  const inviteRoute = await source("app/admin/users/invite/route.ts");
  const mutations = await source("lib/admin-user-management.ts");

  assert.match(usersRoute, /createManagedAdminUser\(/);
  assert.match(inviteRoute, /createManagedAdminInvite\(/);
  assert.match(usersRoute, /user_already_exists[^]*409/);
  assert.match(inviteRoute, /user_already_exists[^]*409/);
  assert.doesNotMatch(usersRoute, /ON CONFLICT \(email\) DO UPDATE/);
  assert.doesNotMatch(inviteRoute, /ON CONFLICT \(email\) DO UPDATE/);
  assert.doesNotMatch(usersRoute, /body\.adminStatus/);
  assert.match(mutations, /WITH existing_user AS MATERIALIZED/);
  assert.ok((mutations.match(/ON CONFLICT \(email\) DO NOTHING/g) || []).length >= 2);
  assert.match(mutations, /new_credential AS/);
  assert.match(mutations, /new_invite AS/);
  assert.match(mutations, /new_reset_token AS/);
});

test("userId mutations authorize and write in one statement, deny foreign or privileged memberships, and revoke sessions", async () => {
  const mutations = await source("lib/admin-user-management.ts");
  const permissionRoute = await source("app/admin/users/[userId]/permissions/route.ts");
  const mfaRoute = await source("app/admin/users/[userId]/mfa-reset/route.ts");
  const resetRoute = await source("app/admin/users/[userId]/reset-password/route.ts");

  assert.ok((mutations.match(/WITH target AS MATERIALIZED/g) || []).length >= 3);
  assert.ok((mutations.match(/FOR UPDATE/g) || []).length >= 5);
  assert.ok((mutations.match(/forbidden_membership\.role = 'super_admin'/g) || []).length >= 3);
  assert.ok((mutations.match(/forbidden_membership\.tenant_id IS NULL/g) || []).length >= 3);
  assert.ok((mutations.match(/revoked_sessions AS/g) || []).length >= 3);
  assert.match(permissionRoute, /replaceManagedAdminUserAccess\(/);
  assert.match(mfaRoute, /resetManagedAdminUserMfa\(/);
  assert.match(resetRoute, /createManagedAdminPasswordReset\(/);
});

test("login loads account status and session resolution uses current membership and permissions", async () => {
  const iam = await source("lib/iam.ts");
  const login = await source("app/auth/login/route.ts");

  assert.match(iam, /u\.admin_status/);
  assert.match(iam, /membership_current/);
  assert.match(iam, /current_membership\.tenant_id IS NOT DISTINCT FROM s\.tenant_id/);
  assert.match(iam, /current_permissions/);
  assert.match(iam, /permissions: parsePermissions\(session\.current_permissions\)/);
  assert.match(iam, /SET revoked_at = now\(\), last_seen_at = now\(\)/);
  assert.match(login, /userStatus !== 'active'/);
});

test("public reset consumes the token, updates credentials/status, and revokes sessions atomically", async () => {
  const reset = await source("app/auth/reset-password/route.ts");

  assert.match(reset, /WITH consumed_token AS MATERIALIZED/);
  assert.match(reset, /UPDATE password_reset_tokens token_row/);
  assert.match(reset, /ON CONFLICT \(user_id\)[^]*DO UPDATE SET password_hash/);
  assert.match(reset, /user_activation AS/);
  assert.match(reset, /revoked_sessions AS/);
  assert.doesNotMatch(reset.slice(reset.indexOf("const row = rows[0]")), /await sql`UPDATE password_credentials/);
});
