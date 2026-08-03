import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  requiredPermissionForAdminResource,
  requiresSuperAdminForAdminResource,
} = await import("../src/lib/permission-policy.ts");

test("offline verifier BFF routes require the dedicated tenant permission", () => {
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.equal(
      requiredPermissionForAdminResource(method, "offline-verifier/sync"),
      "supplier:offline_verifier",
    );
    assert.equal(
      requiredPermissionForAdminResource(method, "offline-verifier/devices"),
      "supplier:offline_verifier",
    );
  }
});

test("device enrollment and bundle issuance are superadmin-only while reads and sync ingestion remain scoped", () => {
  assert.equal(requiresSuperAdminForAdminResource("GET", "offline-verifier/devices"), false);
  assert.equal(requiresSuperAdminForAdminResource("POST", "offline-verifier/devices"), true);
  assert.equal(requiresSuperAdminForAdminResource("POST", "offline-verifier/bundles"), true);
  assert.equal(requiresSuperAdminForAdminResource("POST", "offline-verifier/sync"), false);
});

test("admin BFF enforces its superadmin boundary before forwarding", async () => {
  const source = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
  const boundary = source.indexOf("requiresSuperAdminForAdminResource(req.method, normalizedPath)");
  const targetFetch = source.indexOf("response = await fetch(target");

  assert.ok(boundary >= 0, "BFF must apply the offline superadmin boundary");
  assert.ok(targetFetch > boundary, "BFF must reject unauthorized issuance before upstream forwarding");
  assert.match(source.slice(boundary, targetFetch), /super_admin_required/);
});
