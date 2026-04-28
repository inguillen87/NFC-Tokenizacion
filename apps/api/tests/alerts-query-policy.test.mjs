import test from "node:test";
import assert from "node:assert/strict";

const { normalizeAlertSeverity, normalizeAlertType, resolveAlertsTenant } = await import("../src/lib/alerts-query.ts");

test("resolveAlertsTenant prioriza forced tenant sobre query tenant", () => {
  assert.equal(resolveAlertsTenant({ forcedTenantSlug: "tenant-a", requestedTenantSlug: "tenant-b" }), "tenant-a");
  assert.equal(resolveAlertsTenant({ forcedTenantSlug: "", requestedTenantSlug: "tenant-b" }), "tenant-b");
});

test("normalizeAlertSeverity acepta solo severidades válidas", () => {
  assert.equal(normalizeAlertSeverity("HIGH"), "high");
  assert.equal(normalizeAlertSeverity(" critical "), "critical");
  assert.equal(normalizeAlertSeverity("urgent"), "");
  assert.equal(normalizeAlertSeverity(undefined), "");
});

test("normalizeAlertType sanitiza el filtro de tipo para alert center", () => {
  assert.equal(normalizeAlertType(" replay_spike "), "replay_spike");
  assert.equal(normalizeAlertType("TAMPER_RATE"), "tamper_rate");
  assert.equal(normalizeAlertType(null), "");
});
