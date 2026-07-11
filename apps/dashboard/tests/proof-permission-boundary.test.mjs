import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { dashboardPermissionMatches, requiredPermissionForAdminResource } = await import("../src/lib/permission-policy.ts");

test("proof permission policy separates reads from mutations", () => {
  assert.equal(dashboardPermissionMatches(["proof:read"], "proof:read"), true);
  assert.equal(dashboardPermissionMatches(["proof:read"], "proof:write"), false);
  assert.equal(dashboardPermissionMatches(["proof:*"], "proof:write"), true);
  assert.equal(requiredPermissionForAdminResource("GET", "proof/anchors"), "proof:read");
  assert.equal(requiredPermissionForAdminResource("POST", "proof/events"), "proof:write");
  assert.equal(requiredPermissionForAdminResource("GET", "analytics"), null);
});

test("dashboard navigation and BFF enforce the same Proof contract", async () => {
  const profiles = await readFile(new URL("../src/lib/access-profiles.ts", import.meta.url), "utf8");
  const shell = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");

  assert.match(profiles, /"proof:\*"/);
  assert.match(profiles, /"proof:read"/);
  assert.match(shell, /const canReadProof =/);
  assert.match(shell, /item\.href !== "\/proof" \|\| canReadProof/);
  assert.match(proxy, /requiredPermissionForAdminResource\(req\.method, normalizedPath\)/);
  assert.match(proxy, /dashboardPermissionMatches\(dashboardSession\.permissions, requiredPermission\)/);
  assert.match(proxy, /permission_required/);
});

test("demo proof provider payload uses the production readiness contract", async () => {
  const proxy = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
  assert.match(proxy, /normalized === "proof\/providers"/);
  assert.match(proxy, /runtime_status: "ready"/);
  assert.match(proxy, /runtime_status: "policy_disabled"/);
  assert.match(proxy, /write_enabled: false/);
  assert.doesNotMatch(proxy, /capability: "hash_only_integrity", status:/);
});
