import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  listDelegableEnterpriseRoleProfiles,
  resolveManagedAdminDelegationRequest,
} = await import("../src/lib/admin-role-catalog.ts");

const viewer = {
  code: "viewer",
  display_name: "Viewer",
  tenant_bound: true,
  human_session_allowed: true,
  default_permissions: [],
  updated_at: "2026-08-02T12:00:00.000Z",
};
const securityOperator = {
  code: "security_operator",
  display_name: "Security Operator",
  tenant_bound: true,
  human_session_allowed: true,
  default_permissions: ["risk_rules.write", "webhooks.manage"],
  updated_at: "2026-08-02T12:00:00.000Z",
};
const apiIntegration = {
  code: "api_integration",
  display_name: "API Integration",
  tenant_bound: true,
  human_session_allowed: false,
  default_permissions: ["events:write"],
  updated_at: "2026-08-02T12:00:00.000Z",
};

function queryReturning(rows) {
  return async () => rows;
}

test("role-default delegation ignores no server preset and rejects client-invented grants", async () => {
  const session = {
    role: "tenant-admin",
    tenantId: "11111111-1111-4111-8111-111111111111",
    permissions: ["users:manage", "events:*"],
  };
  assert.deepEqual(await resolveManagedAdminDelegationRequest(queryReturning([viewer]), session, {
    role: "viewer",
    permissions: [],
    permissionMode: "role_default",
  }), { ok: true, role: "viewer", permissions: [] });
  assert.deepEqual(await resolveManagedAdminDelegationRequest(queryReturning([viewer]), session, {
    role: "viewer",
    permissions: ["events:read"],
    permissionMode: "role_default",
  }), { ok: false, status: 400, reason: "role_default_client_permissions_forbidden" });
  assert.deepEqual(await resolveManagedAdminDelegationRequest(queryReturning([viewer]), session, {
    role: "viewer",
    permissions: null,
    permissionMode: "role_default",
  }), { ok: false, status: 400, reason: "role_default_client_permissions_forbidden" });
  assert.deepEqual(await resolveManagedAdminDelegationRequest(queryReturning([viewer]), session, {
    role: "viewer",
    permissions: [],
  }), { ok: false, status: 400, reason: "role_default_permission_mode_required" });
  assert.deepEqual(await resolveManagedAdminDelegationRequest(queryReturning([viewer]), session, {
    role: "viewer",
    permissions: [],
    permissionMode: "custom",
  }), { ok: false, status: 400, reason: "role_default_permission_mode_required" });
});

test("catalog exposes only human profiles whose full presets the actor may delegate", async () => {
  const tenantSession = {
    role: "tenant-admin",
    tenantId: "11111111-1111-4111-8111-111111111111",
    permissions: ["users:manage", "events:*", "risk_rules:write"],
  };
  const roles = await listDelegableEnterpriseRoleProfiles(
    queryReturning([viewer, securityOperator, apiIntegration]),
    tenantSession,
  );
  assert.deepEqual(roles.map((role) => role.code), ["viewer"]);
  assert.deepEqual(roles[0].default_permissions, []);

  const deniedSession = { ...tenantSession, deniedPermissions: ["webhooks:write"] };
  assert.deepEqual(await listDelegableEnterpriseRoleProfiles(queryReturning([securityOperator]), deniedSession), []);
});

test("super admin may receive every active human profile but never a machine-only API profile", async () => {
  const roles = await listDelegableEnterpriseRoleProfiles(
    queryReturning([viewer, securityOperator, apiIntegration]),
    { role: "super-admin", tenantId: null, permissions: [] },
  );
  assert.deepEqual(roles.map((role) => role.code), ["viewer", "security_operator"]);
  assert.deepEqual(await listDelegableEnterpriseRoleProfiles(
    queryReturning([{ ...viewer, tenant_bound: false }]),
    { role: "super-admin", tenantId: null, permissions: [] },
  ), []);
});

test("admin routes share the authoritative resolver and role endpoint is permission gated", async () => {
  const root = new URL("../src/", import.meta.url);
  const roleRoute = await readFile(new URL("app/admin/rbac/roles/route.ts", root), "utf8");
  const createRoute = await readFile(new URL("app/admin/users/route.ts", root), "utf8");
  const inviteRoute = await readFile(new URL("app/admin/users/invite/route.ts", root), "utf8");
  const updateRoute = await readFile(new URL("app/admin/users/[userId]/permissions/route.ts", root), "utf8");

  assert.match(roleRoute, /checkAdminWithPermission\(req,\s*"users:manage"\)/);
  assert.match(roleRoute, /listDelegableEnterpriseRoleProfiles/);
  for (const route of [createRoute, inviteRoute]) {
    assert.match(route, /resolveManagedAdminDelegationRequest/);
    assert.match(route, /permissionMode:\s*body\.permissionMode/);
  }
  assert.match(updateRoute, /resolveManagedAdminDelegationRequest/);
  assert.match(updateRoute, /permissionMode === 'explicit_overrides'/);
  assert.match(updateRoute, /resolveAdminUserPermissionOverrides/);
  assert.doesNotMatch(inviteRoute, /events:read[\s\S]*analytics:read/);
});
