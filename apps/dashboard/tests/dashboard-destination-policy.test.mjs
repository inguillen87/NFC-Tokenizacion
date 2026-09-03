import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { DASHBOARD_DESTINATIONS, dashboardCanOpenDestination } = await import(
  "../src/lib/dashboard-destination-policy.ts"
);
const { getAccessProfiles } = await import("../src/lib/access-profiles.ts");

const profiles = Object.fromEntries(getAccessProfiles().map((profile) => [profile.key, profile]));

function can(profileKey, destination, overrides = {}) {
  const profile = profiles[profileKey];
  return dashboardCanOpenDestination(destination, {
    role: profile.role,
    permissions: profile.permissions,
    deniedPermissions: [],
    isDemo: false,
    ...overrides,
  });
}

test("tenant operations sees only its exact operational destinations", () => {
  for (const destination of ["overview", "onboarding", "batches", "tags", "proof", "tokenization", "analytics", "serviceLevels", "demoLab"]) {
    assert.equal(can("tenant-ops", destination), true, destination);
  }
  for (const destination of ["logistics", "events", "riskAnalytics", "leadsTickets", "loyaltyOverview", "rewards", "users", "subscriptions", "orderRequests"]) {
    assert.equal(can("tenant-ops", destination), false, destination);
  }
});

test("tenant growth sees CRM destinations but not operational or PII destinations", () => {
  for (const destination of ["overview", "demoLab", "analytics", "serviceLevels", "loyaltyOverview", "rewards", "campaigns", "marketplace", "offers"]) {
    assert.equal(can("tenant-growth", destination), true, destination);
  }
  for (const destination of ["batches", "tags", "proof", "tokenization", "events", "consumerOverview", "experiences", "orderRequests", "users", "subscriptions"]) {
    assert.equal(can("tenant-growth", destination), false, destination);
  }
});

test("tenant admin no longer inherits IAM or consumer PII access from unrelated wildcards", () => {
  for (const destination of ["batches", "tags", "proof", "tokenization", "analytics", "loyaltyOverview", "rewards", "marketplace"]) {
    assert.equal(can("tenant-admin", destination), true, destination);
  }
  for (const destination of ["events", "riskAnalytics", "campaigns", "users", "subscriptions", "consumerOverview", "experiences", "orderRequests"]) {
    assert.equal(can("tenant-admin", destination), false, destination);
  }
});

test("super admin can open the catalog while demo encoder still requires a trusted demo session", () => {
  for (const destination of Object.keys(DASHBOARD_DESTINATIONS)) {
    if (destination === "demoEncoder") continue;
    assert.equal(can("super-admin", destination), true, destination);
  }
  assert.equal(can("super-admin", "demoEncoder"), false);
  assert.equal(can("super-admin", "demoEncoder", { isDemo: true }), true);
});

test("explicit denies override wildcard and compound destination grants", () => {
  assert.equal(can("super-admin", "tokenization", { deniedPermissions: ["tokenization:*"] }), false);
  assert.equal(can("super-admin", "users", { deniedPermissions: ["users:manage"] }), false);
  assert.equal(can("super-admin", "orderRequests", { deniedPermissions: ["consumers.read_pii"] }), false);
  assert.equal(can("super-admin", "orderRequests", { deniedPermissions: ["marketplace:read"] }), false);
});

test("production shell and account menu consume the same registry without label or email demo inference", async () => {
  const [shell, accountMenu] = await Promise.all([
    readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/tenant-account-menu.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(shell, /dashboardCanOpenDestination\(destination, destinationAccess\)/);
  assert.match(shell, /\.filter\(\(item\) => canOpenDestination\(item\.destination\)\)/);
  assert.match(shell, /mobileQuickLinks[\s\S]*filter\(\(item\) => canOpenDestination\(item\.destination\)\)/);
  assert.match(shell, /searchableLinks[\s\S]*filter\(\(entry\) => canOpenDestination\(entry\.destination\)\)/);
  assert.doesNotMatch(shell, /currentLabel\.toLowerCase\(\)\.includes\("demo"\)|currentEmail\.includes\("demo"\)/);
  assert.match(accountMenu, /dashboardCanOpenDestination\(destination, destinationAccess\)/);
  assert.doesNotMatch(accountMenu, /permissions\.includes\("employees:\*"\)/);
  assert.match(accountMenu, /destination: "subscriptions"/);
});
