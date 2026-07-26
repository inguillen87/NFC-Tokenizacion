import test from "node:test";
import assert from "node:assert/strict";

const { normalizeDemoBodegaSunResult } = await import("../src/lib/sun-demo-bodega-normalizer.ts");

for (const failure of [
  { status: 403, result: "TENANT_SETUP_REQUIRED", reason: "tagtamper_unconfigured" },
  { status: 403, result: "INVALID", reason: "cmac mismatch" },
  { status: 404, result: "NOT_REGISTERED", reason: "tag not registered" },
  { status: 409, result: "NOT_ACTIVE", reason: "tag not active" },
]) {
  test(`demo result preserves ${failure.result} instead of manufacturing validation`, () => {
    const original = {
      status: failure.status,
      body: {
        ok: false,
        tenant: "demobodega",
        result: failure.result,
        reason: failure.reason,
        supplier_payload_match: true,
      },
    };
    const normalized = normalizeDemoBodegaSunResult({ bid: "DEMO-2026-02", result: original });
    assert.equal(normalized, original);
    assert.equal(normalized.status, failure.status);
    assert.equal(normalized.body.ok, false);
    assert.equal(normalized.body.result, failure.result);
    assert.notEqual(normalized.body.auth_status, "VALID");
  });
}

test("valid results remain unchanged and are not relabeled by demo presentation logic", () => {
  const original = { status: 200, body: { ok: true, tenant: "demobodega", result: "VALID", auth_status: "VALID" } };
  assert.equal(normalizeDemoBodegaSunResult({ bid: "DEMO-2026-02", result: original }), original);
});
