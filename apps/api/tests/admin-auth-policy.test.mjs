import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAdminAccess } from "../src/lib/admin-auth-policy.js";

test("sin auth -> 401", () => {
  const result = evaluateAdminAccess({
    providedToken: "",
    expectedToken: "secret",
    requireScoped: false,
    scope: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("scope spoof sin token -> 401", () => {
  const result = evaluateAdminAccess({
    providedToken: "",
    expectedToken: "secret",
    requireScoped: true,
    scope: "tenant_admin",
    tenantSlug: "bodega-balmec",
    requiredScopes: ["tenant_admin"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("scope no permitido con token valido -> 403", () => {
  const result = evaluateAdminAccess({
    providedToken: "secret",
    expectedToken: "secret",
    requireScoped: true,
    scope: "readonly_demo",
    requiredScopes: ["tenant_admin"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test("tenant con token y scope correcto -> 200", () => {
  const result = evaluateAdminAccess({
    providedToken: "secret",
    expectedToken: "secret",
    requireScoped: true,
    scope: "tenant_admin",
    tenantSlug: "bodega-balmec",
    requiredScopes: ["tenant_admin", "super_admin"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});

test("readonly_demo con token y scope correcto -> 200", () => {
  const result = evaluateAdminAccess({
    providedToken: "secret",
    expectedToken: "secret",
    requireScoped: true,
    scope: "readonly_demo",
    requiredScopes: ["readonly_demo"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});

test("token valido sin scope pasa cuando scope no es obligatorio", () => {
  const result = evaluateAdminAccess({
    providedToken: "secret",
    expectedToken: "secret",
    requireScoped: false,
    scope: null,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});

test("token valido sin scope falla cuando scope es obligatorio", () => {
  const result = evaluateAdminAccess({
    providedToken: "secret",
    expectedToken: "secret",
    requireScoped: true,
    scope: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});
