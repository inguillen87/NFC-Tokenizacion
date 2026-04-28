import test from "node:test";
import assert from "node:assert/strict";

const { resolveAdminTenantScope } = await import("../src/lib/admin-auth-policy.ts");

test("tenant_admin fuerza tenant_slug del header", () => {
  const scope = resolveAdminTenantScope("tenant_admin", null, "DemoBodega");
  assert.equal(scope.scope, "tenant_admin");
  assert.equal(scope.tenantSlug, "demobodega");
  assert.equal(scope.forcedTenantSlug, "demobodega");
});

test("super_admin no fuerza tenant_slug", () => {
  const scope = resolveAdminTenantScope("super_admin", null, "demobodega");
  assert.equal(scope.scope, "super_admin");
  assert.equal(scope.forcedTenantSlug, "");
});
