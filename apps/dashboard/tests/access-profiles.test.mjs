import test from "node:test";
import assert from "node:assert/strict";

const PROFILE_ENV_KEYS = [
  "SUPER_ADMIN_EMAIL",
  "NEXT_PUBLIC_SUPER_ADMIN_EMAIL",
  "SUPER_ADMIN_PASSWORD",
  "NEXT_PUBLIC_SUPER_ADMIN_PASSWORD",
  "TENANT_ADMIN_EMAIL",
  "BODEGA_ADMIN_EMAIL",
  "NEXT_PUBLIC_TENANT_ADMIN_EMAIL",
  "TENANT_ADMIN_PASSWORD",
  "BODEGA_ADMIN_PASSWORD",
  "NEXT_PUBLIC_TENANT_ADMIN_PASSWORD",
  "TENANT_OPS_EMAIL",
  "NEXT_PUBLIC_TENANT_OPS_EMAIL",
  "TENANT_OPS_PASSWORD",
  "NEXT_PUBLIC_TENANT_OPS_PASSWORD",
  "TENANT_GROWTH_EMAIL",
  "NEXT_PUBLIC_TENANT_GROWTH_EMAIL",
  "TENANT_GROWTH_PASSWORD",
  "NEXT_PUBLIC_TENANT_GROWTH_PASSWORD",
];

test("access profiles no exponen fallbacks de credenciales", async () => {
  const backup = new Map(PROFILE_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of PROFILE_ENV_KEYS) delete process.env[key];

  const { getAccessProfiles } = await import(`../src/lib/access-profiles.ts?ts=${Date.now()}`);
  const profiles = getAccessProfiles();

  assert.ok(profiles.length >= 3);
  for (const profile of profiles) {
    assert.equal(profile.available, false);
    assert.equal(profile.email, "");
    assert.equal(profile.password, "");
  }

  for (const [key, value] of backup.entries()) {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  }
});

test("access profiles ignoran passwords publicas y exponen payload publico sin secretos", async () => {
  const backup = new Map(PROFILE_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of PROFILE_ENV_KEYS) delete process.env[key];

  process.env.TENANT_ADMIN_EMAIL = "tenant@example.com";
  process.env.NEXT_PUBLIC_TENANT_ADMIN_PASSWORD = "public-password-should-not-work";

  const { getAccessProfiles, getPublicAccessProfiles } = await import(`../src/lib/access-profiles.ts?ts=${Date.now()}-public`);
  const tenantProfile = getAccessProfiles().find((profile) => profile.key === "tenant-admin");
  assert.ok(tenantProfile);
  assert.equal(tenantProfile.email, "tenant@example.com");
  assert.equal(tenantProfile.password, "");
  assert.equal(tenantProfile.available, false);

  process.env.TENANT_ADMIN_PASSWORD = "server-only-password";
  const { getPublicAccessProfiles: getPublicAccessProfilesWithServerPassword } = await import(`../src/lib/access-profiles.ts?ts=${Date.now()}-server`);
  const publicProfile = getPublicAccessProfilesWithServerPassword().find((profile) => profile.key === "tenant-admin");
  assert.ok(publicProfile);
  assert.equal(publicProfile.available, true);
  assert.equal(Object.hasOwn(publicProfile, "password"), false);

  for (const [key, value] of backup.entries()) {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  }
});

test("perfiles operativos y growth usan roles especializados y conservan scope tenant", async () => {
  const backup = new Map(PROFILE_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of PROFILE_ENV_KEYS) delete process.env[key];
  process.env.TENANT_OPS_EMAIL = "ops@tenant.example";
  process.env.TENANT_OPS_PASSWORD = "ops-secret";
  process.env.TENANT_GROWTH_EMAIL = "growth@tenant.example";
  process.env.TENANT_GROWTH_PASSWORD = "growth-secret";

  const { getAccessProfiles } = await import(`../src/lib/access-profiles.ts?ts=${Date.now()}-specialized`);
  const profiles = Object.fromEntries(getAccessProfiles().map((profile) => [profile.key, profile]));

  assert.equal(profiles["tenant-ops"].role, "operations-manager");
  assert.deepEqual(
    profiles["tenant-ops"].permissions.filter((permission) => permission.startsWith("rewards:")),
    ["rewards:validate"],
  );
  assert.equal(profiles["tenant-growth"].role, "marketing-manager");
  for (const permission of ["crm:read", "campaigns:read", "campaigns:write", "rewards:read", "marketplace:read"]) {
    assert.equal(profiles["tenant-growth"].permissions.includes(permission), true, permission);
  }
  assert.equal(profiles["tenant-growth"].permissions.includes("campaigns:test_whatsapp"), false);

  const loginRoute = await import("node:fs/promises").then(({ readFile }) => readFile(
    new URL("../src/lib/session-login-route.ts", import.meta.url),
    "utf8",
  ));
  assert.match(loginRoute, /return role === "super-admin"[\s\S]*tenantId: "demo-tenant-demobodega"/);

  for (const [key, value] of backup.entries()) {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  }
});
