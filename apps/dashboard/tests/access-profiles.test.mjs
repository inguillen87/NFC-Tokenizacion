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
  "RESELLER_EMAIL",
  "NEXT_PUBLIC_RESELLER_EMAIL",
  "RESELLER_PASSWORD",
  "NEXT_PUBLIC_RESELLER_PASSWORD",
  "GENERIC_DEMO_EMAIL",
  "NEXT_PUBLIC_GENERIC_DEMO_EMAIL",
  "GENERIC_DEMO_PASSWORD",
  "NEXT_PUBLIC_GENERIC_DEMO_PASSWORD",
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
