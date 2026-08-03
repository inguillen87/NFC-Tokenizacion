import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  dashboardHighImpactPermissionMatches,
  dashboardPermissionMatches,
  requiredPermissionForAdminResource,
  requiresMfaForAdminResource,
} = await import("../src/lib/permission-policy.ts");

test("SDK API key permissions separate reads from mutations", () => {
  assert.equal(requiredPermissionForAdminResource("GET", "sdk/api-keys"), "api_keys.read");
  assert.equal(requiredPermissionForAdminResource("POST", "sdk/api-keys"), "api_keys.manage");
  assert.equal(requiredPermissionForAdminResource("PATCH", "sdk/api-keys/key-1"), "api_keys.manage");
  assert.equal(requiredPermissionForAdminResource("DELETE", "sdk/api-keys/key-1"), "api_keys.manage");

  assert.equal(dashboardPermissionMatches(["sdk:keys:read"], "api_keys.read"), true);
  assert.equal(dashboardPermissionMatches(["sdk:keys:read"], "api_keys.manage"), false);
  assert.equal(dashboardPermissionMatches(["sdk:keys:write"], "api_keys.manage"), true);
  assert.equal(dashboardHighImpactPermissionMatches("tenant-admin", ["api_keys.manage"], "api_keys.manage"), true);
  assert.equal(dashboardHighImpactPermissionMatches("viewer", ["*"], "api_keys.manage"), false);
});

test("legacy tenant fallbacks are scoped only to the canonical API-key surface", () => {
  assert.equal(dashboardPermissionMatches(["tenant:*"], "api_keys.read"), true);
  assert.equal(dashboardPermissionMatches(["tenant:*"], "api_keys.manage"), true);
  assert.equal(dashboardPermissionMatches(["tenant:read"], "api_keys.read"), true);
  assert.equal(dashboardPermissionMatches(["tenant:read"], "api_keys.manage"), false);
  assert.equal(dashboardPermissionMatches(["tenant:*"], "sdk:keys:read"), false);
  assert.equal(dashboardPermissionMatches(["tenant:*"], "sdk:keys:write"), false);
  assert.equal(dashboardPermissionMatches(["events:*"], "api_keys.read"), false);

  assert.equal(dashboardPermissionMatches(["api_keys.read"], "api_keys.read", ["sdk:keys:read"]), false);
  assert.equal(dashboardPermissionMatches(["api_keys.manage"], "api_keys.manage", ["tenant:write"]), false);
  assert.equal(dashboardPermissionMatches(["tenant:*"], "api_keys.read", ["api_keys.read"]), false);
});

test("API-key mutations require MFA while reads remain available", () => {
  assert.equal(requiresMfaForAdminResource("GET", "sdk/api-keys"), false);
  assert.equal(requiresMfaForAdminResource("HEAD", "sdk/api-keys"), false);
  assert.equal(requiresMfaForAdminResource("POST", "sdk/api-keys"), true);
  assert.equal(requiresMfaForAdminResource("PATCH", "sdk/api-keys/key-1"), true);
  assert.equal(requiresMfaForAdminResource("DELETE", "sdk/api-keys/key-1"), true);
  assert.equal(requiresMfaForAdminResource("POST", "sdk/claim-policy"), true);
});

test("SDK page, console and BFF share canonical role, deny and MFA gates", async () => {
  const consoleSource = await readFile(new URL("../src/components/sdk-admin-console.tsx", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../src/app/(app)/api-keys/page.tsx", import.meta.url), "utf8");
  const proxySource = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");

  assert.match(consoleSource, /type="checkbox"/);
  assert.match(consoleSource, /scopes:\s*selectedScopes/);
  assert.match(consoleSource, /ensureApiKeyMutationAllowed/);
  assert.match(consoleSource, /canManageApiKeys && mfaVerified/);
  assert.match(consoleSource, /claimPolicyMutationsAllowed = mutationsAllowed && canManageClaimPolicy && mfaVerified/);
  assert.match(consoleSource, /Cambiar la política de ownership o su PIN requiere MFA/);
  assert.match(pageSource, /dashboardHighImpactPermissionMatches\([\s\S]*"api_keys\.read"/);
  assert.match(pageSource, /dashboardHighImpactPermissionMatches\([\s\S]*"api_keys\.manage"/);
  assert.match(pageSource, /session\.deniedPermissions/);
  assert.match(pageSource, /mfaVerified=\{session\.mfaVerified\}/);
  assert.match(proxySource, /requiredPermissionForAdminResource\(req\.method, normalizedPath\)/);
  assert.match(proxySource, /requiresMfaForAdminResource\(req\.method, normalizedPath\)/);
  assert.match(proxySource, /reason: "mfa_required"/);
});
