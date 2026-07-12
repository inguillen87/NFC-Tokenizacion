import assert from "node:assert/strict";
import test from "node:test";

const { dashboardPermissionMatches, requiredPermissionForAdminResource } = await import("../src/lib/permission-policy.ts");

test("tokenization surfaces require explicit read and write permissions", () => {
  assert.equal(requiredPermissionForAdminResource("GET", "tokenization/requests"), "tokenization:read");
  assert.equal(requiredPermissionForAdminResource("POST", "tokenization/requests"), "tokenization:write");
  assert.equal(requiredPermissionForAdminResource("GET", "polygon/wallet"), "tokenization:read");
  assert.equal(requiredPermissionForAdminResource("GET", "product-assets"), "tokenization:read");
  assert.equal(requiredPermissionForAdminResource("POST", "product-assets"), "tokenization:write");
  assert.equal(dashboardPermissionMatches(["tokenization:read"], "tokenization:write"), false);
  assert.equal(dashboardPermissionMatches(["tokenization:*"], "tokenization:write"), true);
});
