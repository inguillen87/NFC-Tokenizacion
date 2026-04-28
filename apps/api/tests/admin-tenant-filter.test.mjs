import test from "node:test";
import assert from "node:assert/strict";

const { effectiveTenantFilter } = await import("../src/lib/admin-tenant-filter.ts");

test("tenant scope forzado prevalece sobre tenant query param", () => {
  const tenant = effectiveTenantFilter({ forcedTenantSlug: "demobodega", requestedTenantSlug: "otrotenant" });
  assert.equal(tenant, "demobodega");
});

test("sin scope forzado usa tenant query param normalizado", () => {
  const tenant = effectiveTenantFilter({ forcedTenantSlug: "", requestedTenantSlug: "DemoBodega" });
  assert.equal(tenant, "demobodega");
});
