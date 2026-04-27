import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAdminAccess } from "../src/lib/admin-auth-policy.js";

test("sin auth → 401", () => {
  const result = evaluateAdminAccess({
    providedToken: "",
    expectedToken: "secret",
    requireScoped: false,
    scope: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("tenant sin scope permitido → 403", () => {
  const result = evaluateAdminAccess({
    providedToken: "",
    expectedToken: "secret",
    requireScoped: true,
    scope: "readonly_demo",
    requiredScopes: ["tenant_admin"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test("tenant con scope correcto → 200", () => {
  const result = evaluateAdminAccess({
    providedToken: "",
    expectedToken: "secret",
    requireScoped: true,
    scope: "tenant_admin",
    tenantSlug: "demobodega",
    requiredScopes: ["tenant_admin", "super_admin"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});

test("demo session readonly_demo solo datos demo rotulados (policy-level)", () => {
  const result = evaluateAdminAccess({
    providedToken: "",
    expectedToken: "secret",
    requireScoped: true,
    scope: "readonly_demo",
    requiredScopes: ["readonly_demo"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});
