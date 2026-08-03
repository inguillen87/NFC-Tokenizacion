import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  isProductionSecretExposureAllowed,
  isProductionRuntime,
  parsePermissionGrant,
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

test("hierarchical permissions preserve the complete action tail", () => {
  const permission = "supplier:production_qa_plan:approve";
  const parsed = parsePermissionGrant(permission);

  assert.deepEqual(parsed, {
    permission,
    resource: "supplier",
    action: "production_qa_plan:approve",
  });
  assert.equal(`${parsed.resource}:${parsed.action}`, permission);
  assert.deepEqual(parsePermissionGrant(" BATCHES:WRITE "), {
    permission: "batches:write",
    resource: "batches",
    action: "write",
  });
  assert.deepEqual(parsePermissionGrant("batches:*"), {
    permission: "batches:*",
    resource: "batches",
    action: "*",
  });
  assert.deepEqual(parsePermissionGrant("*"), {
    permission: "*",
    resource: "*",
    action: "*",
  });
});

test("hierarchical permission grammar rejects malformed grants and intermediate wildcards", () => {
  for (const permission of [
    "supplier:*:approve",
    "supplier::approve",
    "supplier:approve:",
    ":supplier:approve",
    "supplier",
    "supplier:production qa:approve",
  ]) {
    assert.equal(parsePermissionGrant(permission), null, permission);
    assert.equal(resolveAdminUserDelegation(
      { role: "super-admin", tenantId: null, permissions: [] },
      "tenant_admin",
      [permission],
    ).ok, false, permission);
  }

  assert.notEqual(parsePermissionGrant("supplier:production_qa_plan:*"), null);
});

test("delegation remains compatible with existing grants and accepts hierarchical grants", () => {
  const superSession = { role: "super-admin", tenantId: null, permissions: [] };
  assert.deepEqual(
    resolveAdminUserDelegation(superSession, "tenant_admin", [
      "users:manage",
      "batches:*",
      "supplier:production_qa_plan:approve",
    ]),
    {
      ok: true,
      role: "tenant_admin",
      permissions: ["users:manage", "batches:*", "supplier:production_qa_plan:approve"],
    },
  );
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
  const binding = {
    role: "tenant_admin",
    tenant_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    membership_scope_unambiguous: true,
  };
  assert.equal(isSessionPrincipalCurrent({ ...binding, admin_status: "active", membership_current: true }), true);
  assert.equal(isSessionPrincipalCurrent({ ...binding, admin_status: "disabled", membership_current: true }), false);
  assert.equal(isSessionPrincipalCurrent({ ...binding, admin_status: "invited", membership_current: true }), false);
  assert.equal(isSessionPrincipalCurrent({ ...binding, admin_status: "active", membership_current: false }), false);
  assert.equal(isSessionPrincipalCurrent({
    ...binding,
    admin_status: "active",
    membership_current: true,
    membership_scope_unambiguous: false,
  }), false);
});

test("pre-deny session adapters remain compatible while live deny state is authoritative", async () => {
  const { checkAdmin, getAdminPrincipal } = await import("../src/lib/auth.ts");
  const request = new Request("https://api.nexid.test/admin", {
    headers: { authorization: "Bearer legacy-session-shape" },
  });
  const response = await checkAdmin(request, ["tenant_admin"], async () => ({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "admin@example.com",
    label: "Admin",
    role: "tenant-admin",
    tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    tenantSlug: "tenant-a",
    permissions: ["events:read"],
    mfaVerified: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rotatedCookieValue: null,
    setupCompleted: true,
  }));
  assert.equal(response, null);
  assert.deepEqual(getAdminPrincipal(request).deniedPermissions, []);
});

test("specialized tenant roles ignore forged scope and tenant headers and honor deny precedence", async () => {
  const { checkAdmin, checkAdminPermission, getAdminPrincipal } = await import("../src/lib/auth.ts");
  const request = new Request("https://api.nexid.test/admin/webhooks?tenant=tenant-b", {
    headers: {
      authorization: "Bearer specialized-session",
      "x-nexid-admin-scope": "super_admin",
      "x-nexid-tenant-slug": "tenant-b",
      "x-nexid-permissions": "*",
    },
  });
  const session = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "security@example.com",
    label: "Security",
    role: "security-operator",
    tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    tenantSlug: "tenant-a",
    permissions: ["webhooks.manage"],
    deniedPermissions: ["webhooks:write"],
    mfaVerified: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rotatedCookieValue: null,
    setupCompleted: true,
  };
  assert.equal(await checkAdmin(request, ["tenant_operator"], async () => session), null);
  const principal = getAdminPrincipal(request);
  assert.equal(principal.scope, "tenant_operator");
  assert.equal(principal.tenantSlug, "tenant-a");
  assert.equal(checkAdminPermission(request, "webhooks:read"), null);
  assert.equal(checkAdminPermission(request, "webhooks:write")?.status, 403);

  const legacyRouteRequest = new Request("https://api.nexid.test/admin/legacy", {
    headers: { authorization: "Bearer specialized-session" },
  });
  assert.equal((await checkAdmin(legacyRouteRequest, undefined, async () => session))?.status, 403);
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
  assert.equal((mutations.match(/INSERT INTO resource_permissions \(user_id, tenant_id, resource, action\)/g) || []).length, 3);
  assert.ok((mutations.match(/\$\{input\.tenantId\}::uuid/g) || []).length >= 6);
  assert.match(mutations, /permission\.tenant_id IS NOT DISTINCT FROM \$\{input\.tenantId\}::uuid/);
  assert.doesNotMatch(mutations, /ON CONFLICT \(user_id, resource, action, effect\)/);
  assert.equal((mutations.match(/substr\(value, strpos\(value, ':'\) \+ 1\)/g) || []).length, 3);
  assert.doesNotMatch(mutations, /split_part\(value, ':', 2\)/);
});

test("preset provisioning uses the shared hierarchical parser without auto-granting production QA approval", async () => {
  const presets = await source("lib/auth-presets.ts");

  assert.match(presets, /parsePermissionGrant\(entry\)/);
  assert.match(presets, /grant\.resource/);
  assert.match(presets, /grant\.action/);
  assert.doesNotMatch(presets, /supplier:production_qa_plan:approve/);
});

test("userId mutations authorize and write in one statement, deny foreign or privileged memberships, and revoke sessions", async () => {
  const mutations = await source("lib/admin-user-management.ts");
  const permissionRoute = await source("app/admin/users/[userId]/permissions/route.ts");
  const mfaRoute = await source("app/admin/users/[userId]/mfa-reset/route.ts");
  const resetRoute = await source("app/admin/users/[userId]/reset-password/route.ts");

  assert.ok((mutations.match(/WITH target AS MATERIALIZED/g) || []).length >= 3);
  assert.ok((mutations.match(/FOR UPDATE/g) || []).length >= 5);
  assert.ok((mutations.match(/forbidden_membership\.role::text IN \('super_admin', 'tenant_owner'\)/g) || []).length >= 3);
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
  assert.match(iam, /current_denied_permissions/);
  assert.match(iam, /deniedPermissions: parsePermissions\(session\.current_denied_permissions\)/);
  assert.match(iam, /permissionMatches\(session\.permissions, permission, session\.deniedPermissions\)/);
  assert.match(iam, /SELECT to_regclass\('public\.enterprise_role_profiles'\) IS NOT NULL AS ready/);
  assert.match(iam, /roleProfilesReady \? await sql/);
  assert.match(iam, /'\[\]'::jsonb AS role_default_permissions/);
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
