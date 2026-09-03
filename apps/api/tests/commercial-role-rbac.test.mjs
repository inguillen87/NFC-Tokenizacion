import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  COMMERCIAL_AUTH_PRESET_PERMISSIONS,
  ensurePresetUser,
  getAuthPresets,
} = await import("../src/lib/auth-presets.ts");
const {
  enterpriseCapabilityRoles,
  roleMayUseEnterpriseCapability,
} = await import("../src/lib/enterprise-capability-policy.ts");
const {
  checkAdminWithPermission,
  getAdminTenantAccess,
} = await import("../src/lib/auth.ts");
const {
  replaceManagedAdminUserPermissionOverrides,
  replaceManagedAdminUserRole,
} = await import("../src/lib/admin-user-management.ts");

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_USER_ID = "22222222-2222-4222-8222-222222222222";
const COMMERCIAL_DEFAULTS = Object.freeze({
  tenant_owner: [
    "crm:read", "campaigns:read", "campaigns:write", "rewards:read",
    "rewards:write", "rewards:validate", "marketplace:read", "marketplace:write",
  ],
  tenant_admin: [
    "crm:read", "campaigns:read", "campaigns:write", "rewards:read",
    "rewards:write", "rewards:validate", "marketplace:read", "marketplace:write",
  ],
  operations_manager: ["rewards:validate"],
  marketing_manager: [
    "crm:read", "campaigns:read", "campaigns:write", "rewards:read", "marketplace:read",
  ],
});
const COMMERCIAL_PERMISSIONS = [
  ...new Set(Object.values(COMMERCIAL_DEFAULTS).flat()),
];

function humanSession(role, permissions, deniedPermissions = [], tenantSlug = "tenant-a") {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: `${role}@tenant-a.example`,
    label: role,
    role,
    tenantId: TENANT_A_ID,
    tenantSlug,
    permissions,
    deniedPermissions,
    mfaVerified: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rotatedCookieValue: null,
    setupCompleted: true,
  };
}

function authorizedRequest(path, role, permissions, deniedPermissions = []) {
  const request = new Request(`https://api.nexid.test/${path}`, {
    headers: { authorization: `Bearer ${role}-session` },
  });
  return {
    request,
    authorize: (permission) => checkAdminWithPermission(
      request,
      permission,
      async () => humanSession(role, permissions, deniedPermissions),
    ),
  };
}

function roleDefaultsFromMigration(source, role) {
  const match = new RegExp(
    `\\(\\s*'${role}',\\s*'(\\[[^']*\\])'::jsonb\\s*\\)`,
  ).exec(source);
  assert.ok(match, `missing commercial defaults for ${role}`);
  return JSON.parse(match[1]);
}

function roleDefaultsFromDisposableValidator(source, role) {
  const match = new RegExp(
    `profile\\.code = '${role}'[\\s\\S]*?profile\\.default_permissions =\\s*'(\\[[^']*\\])'::jsonb`,
  ).exec(source);
  assert.ok(match, `missing disposable postcheck defaults for ${role}`);
  return JSON.parse(match[1]);
}

function roleDefaultsFromEnterpriseGate(source, role) {
  const match = new RegExp(
    `\\('${role}', true, true, '(\\[[^']*\\])'::jsonb\\)`,
  ).exec(source);
  assert.ok(match, `missing enterprise gate defaults for ${role}`);
  return JSON.parse(match[1]);
}

test("commercial capabilities use an explicit role allowlist", () => {
  const expectedRoles = {
    "crm:read": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
    "campaigns:read": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
    "campaigns:write": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
    "campaigns:test_whatsapp": ["super-admin", "tenant-owner", "tenant-admin"],
    "rewards:read": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
    "rewards:write": ["super-admin", "tenant-owner", "tenant-admin"],
    "rewards:validate": ["super-admin", "tenant-owner", "tenant-admin", "operations-manager"],
    "marketplace:read": ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"],
    "marketplace:write": ["super-admin", "tenant-owner", "tenant-admin"],
  };

  for (const [permission, roles] of Object.entries(expectedRoles)) {
    assert.deepEqual(enterpriseCapabilityRoles(permission), roles, permission);
    for (const role of [
      "tenant-owner", "tenant-admin", "security-analyst", "operations-manager",
      "packaging-operator", "marketing-manager", "viewer", "reseller-admin",
      "super-admin", "security-operator", "reseller",
    ]) {
      assert.equal(roleMayUseEnterpriseCapability(role, permission), roles.includes(role), `${role}:${permission}`);
    }
  }

  for (const permission of ["crm:*", "campaigns:publish", "rewards:*", "marketplace:delete"]) {
    assert.deepEqual(enterpriseCapabilityRoles(permission), [], permission);
    assert.equal(roleMayUseEnterpriseCapability("tenant-admin", permission), false, permission);
    assert.equal(roleMayUseEnterpriseCapability("super-admin", permission), false, permission);
  }
});

test("commercial authorization permits intended specialists and rejects forged roles and explicit denies", async () => {
  const growth = authorizedRequest(
    "admin/loyalty/overview?tenant=tenant-b",
    "marketing-manager",
    COMMERCIAL_DEFAULTS.marketing_manager,
  );
  assert.equal(await growth.authorize("rewards:read"), null);
  assert.deepEqual(getAdminTenantAccess(growth.request, "tenant-b"), {
    scope: "tenant_operator",
    tenantSlug: "tenant-a",
    forcedTenantSlug: "tenant-a",
    tenantBound: true,
    requestedTenantSlug: "tenant-b",
    effectiveTenantSlug: "tenant-a",
  });

  assert.equal(await authorizedRequest(
    "admin/rewards/redemptions/validate",
    "operations-manager",
    COMMERCIAL_DEFAULTS.operations_manager,
  ).authorize("rewards:validate"), null);

  assert.equal((await authorizedRequest(
    "admin/loyalty/overview",
    "operations-manager",
    ["rewards:read"],
  ).authorize("rewards:read"))?.status, 403);
  assert.equal((await authorizedRequest(
    "admin/consumer-network/offers",
    "packaging-operator",
    ["marketplace:read"],
  ).authorize("marketplace:read"))?.status, 403);
  assert.equal((await authorizedRequest(
    "admin/loyalty/trivia/overview",
    "marketing-manager",
    ["campaigns:read"],
    ["campaigns:read"],
  ).authorize("campaigns:read"))?.status, 403);
});

test("commercial read endpoints authorize before schema or data access", async () => {
  const cases = [
    ["../src/app/admin/loyalty/overview/route.ts", 'checkAdminWithPermission(req, "rewards:read")', "await ensureLoyaltySchema()"],
    ["../src/app/admin/loyalty/trivia/overview/route.ts", 'checkAdminWithPermission(req, "campaigns:read")', "await ensureLoyaltySchema()"],
    ["../src/app/admin/consumer-network/offers/route.ts", 'checkAdminWithPermission(req, "marketplace:read")', "await ensureConsumerPortalSchema()"],
  ];

  for (const [path, authorization, firstDataAccess] of cases) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.ok(source.indexOf(authorization) >= 0, path);
    assert.ok(source.indexOf(authorization) < source.indexOf(firstDataAccess), path);
    assert.doesNotMatch(source, /await checkAdmin\(req\)/, path);
  }
});

test("API presets match the commercial role defaults and never grant WhatsApp sends by default", () => {
  assert.deepEqual(COMMERCIAL_AUTH_PRESET_PERMISSIONS, {
    tenant_admin: COMMERCIAL_DEFAULTS.tenant_admin,
    operations_manager: COMMERCIAL_DEFAULTS.operations_manager,
    marketing_manager: COMMERCIAL_DEFAULTS.marketing_manager,
  });

  const presets = getAuthPresets();
  const byRole = Object.fromEntries(presets.map((preset) => [preset.role, preset]));
  for (const role of ["tenant_admin", "operations_manager", "marketing_manager"]) {
    assert.ok(byRole[role], role);
    for (const permission of COMMERCIAL_DEFAULTS[role]) {
      assert.equal(byRole[role].permissions.includes(permission), true, `${role}:${permission}`);
    }
  }
  for (const role of ["reseller", "viewer"]) {
    assert.deepEqual(
      byRole[role].permissions.filter((permission) => COMMERCIAL_PERMISSIONS.includes(permission)),
      [],
      role,
    );
  }
  for (const preset of presets) {
    assert.equal(preset.permissions.includes("campaigns:test_whatsapp"), false, preset.role);
  }
});

test("preset provisioning validates legacy membership before touching credentials", async () => {
  const previousEmail = process.env.TENANT_GROWTH_EMAIL;
  const previousPassword = process.env.TENANT_GROWTH_PASSWORD;
  process.env.TENANT_GROWTH_EMAIL = "growth-membership-drift@example.test";
  process.env.TENANT_GROWTH_PASSWORD = "preset-password-do-not-install";

  const statements = [];
  const query = async (strings) => {
    const statement = strings.join("?");
    statements.push(statement);
    if (/SELECT id FROM tenants/.test(statement)) return [{ id: TENANT_A_ID }];
    if (/SELECT id FROM users/.test(statement)) return [{ id: TARGET_USER_ID }];
    if (/FROM memberships/.test(statement)) {
      return [{ id: "33333333-3333-4333-8333-333333333333", tenant_id: TENANT_A_ID, role: "tenant_admin" }];
    }
    return [];
  };

  try {
    assert.equal(await ensurePresetUser(query, process.env.TENANT_GROWTH_EMAIL), null);
    assert.equal(statements.some((statement) => /INSERT INTO password_credentials/.test(statement)), false);
    assert.equal(statements.some((statement) => /SELECT user_id FROM password_credentials/.test(statement)), false);
  } finally {
    if (previousEmail === undefined) delete process.env.TENANT_GROWTH_EMAIL;
    else process.env.TENANT_GROWTH_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.TENANT_GROWTH_PASSWORD;
    else process.env.TENANT_GROWTH_PASSWORD = previousPassword;
  }
});

test("role-default save preserves overrides while blocking cross-tenant and dormant-allow activation", async () => {
  let statement = "";
  const query = async (strings) => {
    statement = strings.join("?");
    return [{ id: TARGET_USER_ID }];
  };

  assert.equal(await replaceManagedAdminUserRole(query, {
    targetUserId: TARGET_USER_ID,
    actorIsSuperAdmin: true,
    actorTenantId: null,
    tenantId: TENANT_A_ID,
    role: "marketing_manager",
  }), TARGET_USER_ID);
  assert.match(statement, /FROM memberships existing_membership/);
  assert.match(statement, /\) <= 1/);
  assert.match(statement, /FROM resource_permissions scoped_permission/);
  assert.match(statement, /scoped_permission\.tenant_id IS DISTINCT FROM \?::uuid/);
  assert.match(statement, /FROM resource_permissions role_change_permission/);
  assert.match(statement, /role_change_permission\.effect = 'allow'/);
  assert.match(statement, /FROM memberships unchanged_membership/);
  assert.match(statement, /unchanged_membership\.role = \?::membership_role/);
  assert.doesNotMatch(statement, /(?:INSERT INTO|DELETE FROM) resource_permissions/);
  assert.match(statement, /UPDATE auth_sessions session[\s\S]*SET revoked_at = now\(\)/);
});

test("explicit override mode writes allow and deny rows, remains tenant-scoped, and produces an atomic audit", async () => {
  let statement = "";
  const query = async (strings) => {
    statement = strings.join("?");
    return [{ id: TARGET_USER_ID }];
  };

  assert.equal(await replaceManagedAdminUserPermissionOverrides(query, {
    targetUserId: TARGET_USER_ID,
    actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    actorIsSuperAdmin: false,
    actorTenantId: TENANT_A_ID,
    tenantId: TENANT_A_ID,
    role: "marketing_manager",
    allowPermissions: ["crm:read", "marketplace:read"],
    deniedPermissions: ["campaigns:read"],
    roleDefaultPermissions: COMMERCIAL_DEFAULTS.marketing_manager,
    ipAddress: "127.0.0.1",
    requestId: "rbac-test-request",
    userAgent: "node-test",
  }), TARGET_USER_ID);

  assert.match(statement, /target_membership\.tenant_id IS NOT DISTINCT FROM \?::uuid/);
  assert.match(statement, /target_membership\.role = \?::membership_role/);
  assert.match(statement, /role_profile\.default_permissions = \?::jsonb/);
  assert.match(statement, /forbidden_permission\.tenant_id IS DISTINCT FROM \?::uuid/);
  assert.match(statement, /DELETE FROM resource_permissions permission/);
  assert.match(statement, /INSERT INTO resource_permissions \(user_id, tenant_id, resource, action, effect\)/);
  assert.match(statement, /SELECT 'allow'::text AS effect/);
  assert.match(statement, /SELECT 'deny'::text AS effect/);
  assert.match(statement, /UPDATE auth_sessions session[\s\S]*SET revoked_at = now\(\)/);
  assert.match(statement, /INSERT INTO audit_logs/);
  assert.match(statement, /admin_user_permission_overrides_replaced/);
  assert.doesNotMatch(statement, /(?:INSERT INTO|DELETE FROM) memberships/);

  const permissionRoute = await readFile(
    new URL("../src/app/admin/users/[userId]/permissions/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(permissionRoute, /permissionMode === 'explicit_overrides'/);
  assert.match(permissionRoute, /explicit_override_contract_required/);
  assert.match(permissionRoute, /resolveAdminUserPermissionOverrides/);
  assert.match(permissionRoute, /replaceManagedAdminUserPermissionOverrides/);
  assert.doesNotMatch(permissionRoute, /ensureAuditLogsSchema/);
});

test("forward-only migration reconciles commercial defaults before 0100 without rewriting users or sessions", async () => {
  const migrationId = "20260903110000_0099_commercial_role_defaults.sql";
  const migration = await readFile(new URL(`../db/migrations/${migrationId}`, import.meta.url), "utf8");
  assert.ok(migrationId < "20260903120000_0100_event_incident_optimistic_concurrency.sql");

  for (const [role, defaults] of Object.entries(COMMERCIAL_DEFAULTS)) {
    assert.deepEqual(roleDefaultsFromMigration(migration, role), defaults, role);
  }
  for (const role of [
    "security_analyst", "packaging_operator", "viewer", "reseller_admin",
    "api_integration", "super_admin", "security_operator", "reseller",
  ]) assert.deepEqual(roleDefaultsFromMigration(migration, role), [], role);

  assert.match(migration, /campaigns:test_whatsapp/);
  assert.match(migration, /split_part\(lower\(regexp_replace\([\s\S]*existing_permission\.permission,[\s\S]*'\^\[\[:space:\]\]\+\|\[\[:space:\]\]\+\$', '', 'g'[\s\S]*\)\), ':', 1\) NOT IN/);
  assert.match(migration, /split_part\(lower\(regexp_replace\([\s\S]*commercial\.permission,[\s\S]*'\^\[\[:space:\]\]\+\|\[\[:space:\]\]\+\$', '', 'g'[\s\S]*\)\), ':', 1\) IN/);
  assert.match(migration, /commercial\.permission NOT IN/);
  assert.doesNotMatch(migration, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(?:resource_permissions|memberships|auth_sessions)\b/i);
  assert.doesNotMatch(migration, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im);

  const [iam, db, preflight, dryRun] = await Promise.all([
    "../src/lib/iam.ts",
    "../src/lib/db.ts",
    "../scripts/db-enterprise-release-preflight.mjs",
    "../scripts/db-enterprise-release-dry-run.mjs",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const registry of [db, preflight, dryRun]) assert.match(registry, new RegExp(migrationId.replaceAll(".", "\\.")));

  const liveSession = iam.slice(iam.indexOf("export async function resolveSession"));
  assert.match(liveSession, /COALESCE\(role_profile\.default_permissions, '\[\]'::jsonb\) AS role_default_permissions/);
  assert.match(liveSession, /\.\.\.parsePermissions\(session\.role_default_permissions\)/);
  assert.match(liveSession, /\.\.\.parsePermissions\(session\.current_permissions\)/);
  assert.match(liveSession, /deniedPermissions: parsePermissions\(session\.current_denied_permissions\)/);
});

test("all PostgreSQL release gates expect the complete current role catalog", async () => {
  const [validator, preflight, dryRun] = await Promise.all([
    "../scripts/db-validate-disposable-neon-branch.mjs",
    "../scripts/db-enterprise-release-preflight.mjs",
    "../scripts/db-enterprise-release-dry-run.mjs",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const expected = {
    tenant_owner: [
      "users:manage", "supplier_order.create", "batch.keys.generate", "supplier_pack.export",
      "manifest.import", "packaging_lab.manage", "qa.approve", "qa.plan.approve",
      "batch.activate", "batch.lifecycle", "batch.revoke", "batch.tamper.configure",
      "tag.tamper.override", "batch.product.configure", "ownership.claim_policy.manage",
      "risk_rules.write", "alerts.ack", "webhooks.manage", "api_keys.read", "api_keys.manage",
      "proofs.read", "proofs.anchor", "audit.read", "events.read_sensitive",
      "consumer_experiences.read_pii", "consumer_experiences.moderate", "consumers.read_pii",
      "leads.manage", "reports.export", ...COMMERCIAL_DEFAULTS.tenant_owner,
    ],
    tenant_admin: [
      "users:manage", "supplier_order.create", "manifest.import", "packaging_lab.manage",
      "qa.approve", "qa.plan.approve", "batch.activate", "batch.lifecycle", "batch.revoke",
      "batch.tamper.configure", "tag.tamper.override", "batch.product.configure",
      "ownership.claim_policy.manage", "alerts.ack", "webhooks.manage", "api_keys.read",
      "api_keys.manage", "proofs.read", "audit.read", "events.read_sensitive",
      "consumer_experiences.read_pii", "consumer_experiences.moderate", "consumers.read_pii",
      "leads.manage", "reports.export", ...COMMERCIAL_DEFAULTS.tenant_admin,
    ],
    operations_manager: [
      "supplier_order.create", "manifest.import", "packaging_lab.manage", "qa.approve",
      "batch.activate", "batch.lifecycle", "alerts.ack", "events.read_sensitive",
      "reports.export", ...COMMERCIAL_DEFAULTS.operations_manager,
    ],
    marketing_manager: [
      "batch.product.configure", "consumer_experiences.read_pii",
      "consumer_experiences.moderate", "consumers.read_pii", "leads.manage",
      "reports.export", ...COMMERCIAL_DEFAULTS.marketing_manager,
    ],
    reseller_admin: ["supplier_order.create", "manifest.import", "leads.manage", "reports.export"],
  };

  for (const [role, defaults] of Object.entries(expected)) {
    assert.deepEqual(roleDefaultsFromDisposableValidator(validator, role), defaults, role);
    assert.deepEqual(roleDefaultsFromEnterpriseGate(preflight, role), defaults, `preflight:${role}`);
    assert.deepEqual(roleDefaultsFromEnterpriseGate(dryRun, role), defaults, `dry-run:${role}`);
  }
});
