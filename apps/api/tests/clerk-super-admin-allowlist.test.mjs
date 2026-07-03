import test from "node:test";
import assert from "node:assert/strict";

const moduleUrl = `../src/lib/clerk-super-admin-allowlist.ts?ts=${Date.now()}`;

test("clerk super admin allowlist defaults to founder email only", async () => {
  const { getClerkSuperAdminEmailAllowlist, isClerkSuperAdminEmailAllowed } = await import(moduleUrl);
  const env = {};

  assert.deepEqual(getClerkSuperAdminEmailAllowlist(env), ["guillen.marce@gmail.com"]);
  assert.equal(isClerkSuperAdminEmailAllowed("guillen.marce@gmail.com", env), true);
  assert.equal(isClerkSuperAdminEmailAllowed("random@example.com", env), false);
});

test("clerk super admin allowlist accepts explicit comma or whitespace separated emails", async () => {
  const { getClerkSuperAdminEmailAllowlist, isClerkSuperAdminEmailAllowed } = await import(moduleUrl);
  const env = {
    DASHBOARD_CLERK_SUPERADMIN_EMAIL_ALLOWLIST: " founder@nexid.lat, ops@nexid.lat\nfounder@nexid.lat ",
  };

  assert.deepEqual(getClerkSuperAdminEmailAllowlist(env), ["founder@nexid.lat", "ops@nexid.lat"]);
  assert.equal(isClerkSuperAdminEmailAllowed("OPS@NEXID.LAT", env), true);
  assert.equal(isClerkSuperAdminEmailAllowed("visitor@nexid.lat", env), false);
});

test("clerk super admin allowlist ignores placeholder emails and supports SUPER_ADMIN_EMAIL", async () => {
  const { getClerkSuperAdminEmailAllowlist, isClerkSuperAdminEmailAllowed } = await import(moduleUrl);
  const env = {
    DASHBOARD_CLERK_SUPERADMIN_EMAIL_ALLOWLIST: "super-admin@example.com",
    SUPER_ADMIN_EMAIL: "real-owner@nexid.lat",
  };

  assert.deepEqual(getClerkSuperAdminEmailAllowlist(env), ["real-owner@nexid.lat"]);
  assert.equal(isClerkSuperAdminEmailAllowed("super-admin@example.com", env), false);
  assert.equal(isClerkSuperAdminEmailAllowed("real-owner@nexid.lat", env), true);
});
