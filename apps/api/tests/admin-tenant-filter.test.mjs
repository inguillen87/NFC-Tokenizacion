import test from "node:test";
import assert from "node:assert/strict";

const { effectiveTenantFilter, resolveTenantStatsSource } = await import("../src/lib/admin-tenant-filter.ts");

test("tenant scope forzado prevalece sobre tenant query param", () => {
  const tenant = effectiveTenantFilter({ forcedTenantSlug: "demobodega", requestedTenantSlug: "otrotenant" });
  assert.equal(tenant, "demobodega");
});

test("sin scope forzado usa tenant query param normalizado", () => {
  const tenant = effectiveTenantFilter({ forcedTenantSlug: "", requestedTenantSlug: "DemoBodega" });
  assert.equal(tenant, "demobodega");
});

test("una sesión tenant real fuerza KPIs source=real aunque el query pida demo", () => {
  assert.deepEqual(
    resolveTenantStatsSource({ forcedTenantSlug: "demobodega", requestedSource: "demo" }),
    { ok: true, source: "real" },
  );
  assert.deepEqual(
    resolveTenantStatsSource({ forcedTenantSlug: "demobodega", requestedSource: "all" }),
    { ok: true, source: "real" },
  );
});

test("stats globales aceptan una sola fuente declarada y nunca un agregado mixto", () => {
  for (const source of ["real", "demo", "imported"]) {
    assert.deepEqual(resolveTenantStatsSource({ requestedSource: source }), { ok: true, source });
  }
  assert.deepEqual(resolveTenantStatsSource({ requestedSource: "" }), { ok: true, source: "real" });
  assert.deepEqual(resolveTenantStatsSource({ requestedSource: "all" }), { ok: false, reason: "invalid_source_filter" });
  assert.deepEqual(resolveTenantStatsSource({ requestedSource: "unknown" }), { ok: false, reason: "invalid_source_filter" });
});
