import test from "node:test";
import assert from "node:assert/strict";
import { edgeOriginAllowed } from "../src/lib/edge-origin-guard.ts";

test("edge origin guard is backwards compatible until explicitly enforced", () => {
  assert.equal(edgeOriginAllowed({ path: "/api/foo", provided: null, expected: null }).allowed, true);
});

test("enforced origin guard fails closed without a secret", () => {
  assert.equal(edgeOriginAllowed({ path: "/api/foo", provided: null, expected: null, enforced: true }).reason, "origin_secret_missing");
  assert.equal(edgeOriginAllowed({ path: "/api/foo", provided: "bad", expected: "good", enforced: true }).allowed, false);
});

test("enforced origin guard accepts only exact Cloudflare secret", () => {
  assert.equal(edgeOriginAllowed({ path: "/api/foo", provided: "good", expected: "good", enforced: true }).allowed, true);
  assert.equal(edgeOriginAllowed({ path: "/health", provided: null, expected: null, enforced: true }).reason, "public_health");
});
