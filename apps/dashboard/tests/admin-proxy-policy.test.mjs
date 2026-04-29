import test from "node:test";
import assert from "node:assert/strict";

const { canReadonlyDemoAccess, shouldAllowDemoFallback, resolveAdminProxyPolicy } = await import("../src/lib/admin-proxy-policy.ts");

test("readonly_demo sin scope permitido en write endpoint -> false", () => {
  assert.equal(canReadonlyDemoAccess("POST", "tenants"), false);
  assert.equal(canReadonlyDemoAccess("PATCH", "tags/123"), false);
});

test("readonly_demo con scope permitido en endpoints demo-safe GET -> true", () => {
  assert.equal(canReadonlyDemoAccess("GET", "analytics"), true);
  assert.equal(canReadonlyDemoAccess("GET", "events/stream"), true);
  assert.equal(canReadonlyDemoAccess("GET", "tags/04A1"), true);
});

test("demo fallback explícitamente habilitado permanece permitido", () => {
  assert.equal(shouldAllowDemoFallback({ allowDemoFallback: true, isProduction: true, demoModeExplicit: false }), true);
  assert.equal(shouldAllowDemoFallback({ allowDemoFallback: true, isProduction: true, demoModeExplicit: true }), true);
});

test("demo fallback deshabilitado requiere DEMO_MODE explícito para habilitarse", () => {
  assert.equal(shouldAllowDemoFallback({ allowDemoFallback: false, isProduction: true, demoModeExplicit: false }), false);
  assert.equal(shouldAllowDemoFallback({ allowDemoFallback: false, isProduction: true, demoModeExplicit: true }), false);
});

test("política unificada: prod sin env demo falla cerrado", () => {
  const policy = resolveAdminProxyPolicy({
    isProduction: true,
    demoMode: false,
    demoFallbackAllowed: false,
    requireScopedAdminAuth: true,
  });
  assert.equal(policy.allowDemoFallback, false);
  assert.equal(policy.requireScopedAdminAuth, true);
});

test("política unificada: demo explícito + fallback permitido habilita fallback", () => {
  const policy = resolveAdminProxyPolicy({
    isProduction: true,
    demoMode: true,
    demoFallbackAllowed: true,
    requireScopedAdminAuth: true,
  });
  assert.equal(policy.allowDemoFallback, true);
});
