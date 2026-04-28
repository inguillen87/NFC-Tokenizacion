import test from "node:test";
import assert from "node:assert/strict";

const { canReadonlyDemoAccess, shouldAllowDemoFallback } = await import("../src/lib/admin-proxy-policy.ts");

test("readonly_demo sin scope permitido en write endpoint -> false", () => {
  assert.equal(canReadonlyDemoAccess("POST", "tenants"), false);
  assert.equal(canReadonlyDemoAccess("PATCH", "tags/123"), false);
});

test("readonly_demo con scope permitido en endpoints demo-safe GET -> true", () => {
  assert.equal(canReadonlyDemoAccess("GET", "analytics"), true);
  assert.equal(canReadonlyDemoAccess("GET", "events/stream"), true);
  assert.equal(canReadonlyDemoAccess("GET", "tags/04A1"), true);
});

test("demo fallback bloqueado en producción sin DEMO_MODE explícito", () => {
  assert.equal(shouldAllowDemoFallback({ allowDemoFallback: true, isProduction: true, demoModeExplicit: false }), false);
  assert.equal(shouldAllowDemoFallback({ allowDemoFallback: true, isProduction: true, demoModeExplicit: true }), true);
});
