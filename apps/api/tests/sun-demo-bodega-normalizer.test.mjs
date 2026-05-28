import test from "node:test";
import assert from "node:assert/strict";

const { normalizeDemoBodegaSunResult } = await import("../src/lib/sun-demo-bodega-normalizer.ts");

test("normalizes the production demobodega tap with null uid and tenant setup verdict", () => {
  const normalized = normalizeDemoBodegaSunResult({
    bid: "DEMO-2026-02",
    result: {
      status: 403,
      body: {
        ok: false,
        tenant: "demobodega",
        verdict: "TENANT_SETUP_REQUIRED",
        reason: "tagtamper_unconfigured",
        event_id: 366,
        uid: null,
        tag_tamper_config_detected: true,
        tamper_risk: false,
        tamper_opened: false,
      },
    },
  });

  assert.equal(normalized.status, 200);
  assert.equal(normalized.body.ok, true);
  assert.equal(normalized.body.result, "VALID_UNKNOWN_TAMPER");
  assert.equal(normalized.body.auth_status, "VALID");
  assert.equal(normalized.body.tenant_slug, "demobodega");
  assert.equal(normalized.body.event_id, 366);
});

test("does not normalize demobodega replay or tamper risk", () => {
  const replay = normalizeDemoBodegaSunResult({
    bid: "DEMO-2026-02",
    result: {
      status: 409,
      body: {
        ok: false,
        tenant: "demobodega",
        result: "REPLAY_SUSPECT",
      },
    },
  });

  assert.equal(replay.status, 409);
  assert.equal(replay.body.result, "REPLAY_SUSPECT");

  const tamper = normalizeDemoBodegaSunResult({
    bid: "DEMO-2026-02",
    result: {
      status: 403,
      body: {
        ok: false,
        tenant: "demobodega",
        result: "TAMPER_RISK",
        tamper_risk: true,
      },
    },
  });

  assert.equal(tamper.status, 403);
  assert.equal(tamper.body.result, "TAMPER_RISK");
});
