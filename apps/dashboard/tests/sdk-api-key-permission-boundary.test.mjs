import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { dashboardPermissionMatches, requiredPermissionForAdminResource } = await import("../src/lib/permission-policy.ts");

test("SDK API key permissions separate reads from mutations", () => {
  assert.equal(requiredPermissionForAdminResource("GET", "sdk/api-keys"), "sdk:keys:read");
  assert.equal(requiredPermissionForAdminResource("POST", "sdk/api-keys"), "sdk:keys:write");
  assert.equal(requiredPermissionForAdminResource("PATCH", "sdk/api-keys/key-1"), "sdk:keys:write");
  assert.equal(requiredPermissionForAdminResource("DELETE", "sdk/api-keys/key-1"), "sdk:keys:write");

  assert.equal(dashboardPermissionMatches(["sdk:keys:read"], "sdk:keys:read"), true);
  assert.equal(dashboardPermissionMatches(["sdk:keys:read"], "sdk:keys:write"), false);
  assert.equal(dashboardPermissionMatches(["sdk:keys:*"], "sdk:keys:write"), true);
});

test("tenant administrators keep access through the tenant permission contract", () => {
  assert.equal(dashboardPermissionMatches(["tenant:*"], "sdk:keys:read"), true);
  assert.equal(dashboardPermissionMatches(["tenant:*"], "sdk:keys:write"), true);
  assert.equal(dashboardPermissionMatches(["tenant:read"], "sdk:keys:read"), true);
  assert.equal(dashboardPermissionMatches(["tenant:read"], "sdk:keys:write"), false);
  assert.equal(dashboardPermissionMatches(["events:*"], "sdk:keys:read"), false);
});

test("SDK console submits an explicit scope selection", async () => {
  const consoleSource = await readFile(new URL("../src/components/sdk-admin-console.tsx", import.meta.url), "utf8");
  const proxySource = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");

  assert.match(consoleSource, /type="checkbox"/);
  assert.match(consoleSource, /scopes:\s*selectedScopes/);
  assert.match(proxySource, /requiredPermissionForAdminResource\(req\.method, normalizedPath\)/);
});
