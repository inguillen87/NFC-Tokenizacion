import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const ts = createRequire(import.meta.url)("typescript");
const sourceRoot = new URL("../src/", import.meta.url);
const readSource = relative => readFileSync(new URL(relative, sourceRoot), "utf8");

// Execute the actual handlers and policy helpers, with an explicit dependency
// boundary. No session, signed NFC payload, provider, real SQL or fetch is used.
function loadSource(relative, dependencies = {}) {
  const code = ts.transpileModule(readSource(relative), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

const { json } = loadSource("lib/http.ts");
const descriptors = [
  { action: "save", path: "app/mobile/passport/[eventId]/consumer/save-product/route.ts", consumeAction: "consumer_save_product", reasonKey: "error" },
  { action: "join", path: "app/mobile/passport/[eventId]/consumer/join-tenant/route.ts", consumeAction: "consumer_join_tenant", reasonKey: "error" },
  { action: "enroll", path: "app/mobile/passport/[eventId]/loyalty/enroll/route.ts", consumeAction: "loyalty_enroll", reasonKey: "reason" },
];

function fixture(descriptor, configuration = {}) {
  const calls = [];
  const event = {
    id: "900001", tenant_id: "10000000-0000-4000-8000-000000000001",
    batch_id: "10000000-0000-4000-8000-000000000002", tenant_slug: "synthetic-brand",
    bid: "SYNTHETIC-BATCH", uid_hex: "04AABBCCDD0011", sdm_read_ctr: 12,
    result: configuration.result || "VALID_CLOSED",
    current_tag_id: "30000000-0000-4000-8000-000000000001",
    current_tag_tenant_id: "10000000-0000-4000-8000-000000000001",
    current_tag_batch_id: "10000000-0000-4000-8000-000000000002",
    current_tag_uid_hex: "04AABBCCDD0011", current_tag_identity_count: 1,
    current_tag_status: "active", current_tag_lifecycle_state: "active", current_tag_revision: "17000001",
  };
  const consumer = { id: "20000000-0000-4000-8000-000000000001", preferred_locale: "es-AR" };
  const rights = loadSource("lib/tap-commercial-rights.ts", {
    "./db": { sql: async (strings, ...values) => {
      calls.push("rights");
      assert.equal(values[0], event.id);
      assert.match(strings.join("?"), /LEFT JOIN tag_manual_tamper_overrides/);
      if (configuration.rights === "unavailable") throw Error("synthetic_rights_read_unavailable");
      if (configuration.rights === "missing") return [];
      return [{ result: event.result, ...(configuration.rights === "manual" ? { manual_tamper_status: "MANUAL_OPENED" } : {}) }];
    } },
  });
  const ownership = loadSource("lib/ownership-policy.ts", { "./tap-commercial-rights": rights });
  const loyaltyPolicy = loadSource("lib/loyalty-tap-policy.ts", { "./tap-commercial-rights": rights });
  class RequestBodyTooLargeError extends Error {}
  const namespace = "../../../../../../lib/";
  const dependencies = {
    [namespace + "http"]: { json },
    [namespace + "consumer-auth"]: { getConsumerFromRequest: async () => configuration.unauthorized ? null : consumer },
    [namespace + "consumer-portal-service"]: {
      saveConsumerTapActionForConsumer: async input => {
        calls.push("save");
        assert.deepEqual(input, { consumerId: consumer.id, eventId: event.id, mode: { kind: "mobile", expected: {
          tenantId: event.tenant_id, batchId: event.batch_id, bid: event.bid, uidHex: event.uid_hex,
          readCounter: event.sdm_read_ctr, tagId: event.current_tag_id, tagRevision: event.current_tag_revision,
        } } });
        if (configuration.writerThrows) throw Error("synthetic_writer_result_indeterminate");
        if (configuration.savedEventMissing) return { ok: false, status: 404, error: "event_not_found" };
        if (configuration.coreError) return { ok: false, status: 409, error: configuration.coreError };
        return { ok: true, status: 200, event, membership: { id: "synthetic-membership", status: "active" }, productId: "synthetic-product" };
      },
      saveTapForConsumer: async () => { throw Error("Mobile handlers must not use the historical adapter"); },
      ensureTenantMembership: async () => { calls.push("membership"); throw Error("Mobile handlers must not write membership separately"); },
    },
    [namespace + "loyalty-service"]: {
      getTapEvent: async () => configuration.eventMissing ? null : event,
      getActiveProgram: async () => { calls.push("program"); return configuration.programMissing ? null : { id: "synthetic-program" }; },
      getOrCreateMember: async () => {
        calls.push("member");
        if (configuration.writerThrows) throw Error("synthetic_writer_result_indeterminate");
        return configuration.memberMissing ? null : { id: "synthetic-member", points_balance: 0, status: "enrolled", operationCommitted: true };
      },
    },
    [namespace + "ownership-policy"]: ownership,
    [namespace + "loyalty-tap-policy"]: loyaltyPolicy,
    [namespace + "commercial-runtime-schema"]: { ensureConsumerPortalSchema: async () => { calls.push("schema"); } },
    [namespace + "critical-rate-limit"]: {
      enforceCriticalRateLimit: async () => configuration.preConsume503 ? json({ ok: false, reason: "synthetic_rate_store_unavailable" }, 503) : null,
    },
    [namespace + "bounded-request-body"]: { RequestBodyTooLargeError, readBoundedJsonBody: req => req.json() },
    [namespace + "sun-fresh-handoff"]: {
      consumeSunFreshHandoff: async (_req, _body, expected, action) => {
        calls.push("consume");
        assert.equal(action, descriptor.consumeAction);
        assert.deepEqual(expected, { eventId: event.id, bid: event.bid, uidHex: event.uid_hex, readCounter: event.sdm_read_ctr });
        return configuration.consumeUnavailable ? { ok: false, reason: "fresh_token_consume_unavailable" } : { ok: true };
      },
    },
    [namespace + "tap-commercial-rights"]: rights,
  };
  const { POST } = loadSource(descriptor.path, dependencies);
  return {
    calls,
    async request() {
      const body = configuration.body || { bid: event.bid, tenantSlug: event.tenant_slug };
      return POST(new Request("http://127.0.0.1/mobile/passport/900001/" + descriptor.action, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      }), { params: Promise.resolve({ eventId: event.id }) });
    },
  };
}

async function responseData(f) {
  const response = await f.request();
  return { response, body: await response.json() };
}

for (const descriptor of descriptors) {
  const label = descriptor.action;
  test(`${label}: a pre-consumption 503 has no consumed-action marker`, async () => {
    const f = fixture(descriptor, { preConsume503: true });
    const { response, body } = await responseData(f);
    assert.equal(response.status, 503);
    assert.equal(Object.hasOwn(body, "fresh_tap_required"), false);
    assert.deepEqual(f.calls, []);
  });
  test(`${label}: unauthorized and absent-event failures never consume or mark the action`, async () => {
    for (const [configuration, status] of [[{ unauthorized: true }, 401], [{ eventMissing: true }, 404]]) {
      const f = fixture(descriptor, configuration), { response, body } = await responseData(f);
      assert.equal(response.status, status);
      assert.equal(Object.hasOwn(body, "fresh_tap_required"), false);
      assert.equal(f.calls.includes("consume"), false);
    }
  });
  test(`${label}: replay is rejected by the real policy before consumption without the marker`, async () => {
    const f = fixture(descriptor, { result: "REPLAY_SUSPECT" }), { response, body } = await responseData(f);
    assert.equal(response.status, label === "enroll" ? 403 : 409);
    assert.equal(Object.hasOwn(body, "fresh_tap_required"), false);
    assert.equal(f.calls.includes("consume"), false);
  });
  test(`${label}: a refused capability has no post-consumption marker and no rights read`, async () => {
    const f = fixture(descriptor, { consumeUnavailable: true }), { response, body } = await responseData(f);
    assert.equal(response.status, 403);
    assert.equal(body.fresh_token_status, "fresh_token_consume_unavailable");
    assert.equal(Object.hasOwn(body, "fresh_tap_required"), false);
    assert.equal(f.calls.filter(call => call === "consume").length, 1);
    assert.equal(f.calls.includes("rights"), false);
  });
  for (const [rights, reason, status] of [
    ["unavailable", "rights_evidence_unavailable", 503],
    ["missing", "event_not_found", 503],
    ["manual", "manual_opening_declared", 409],
  ]) {
    test(`${label}: post-consumption ${reason} preserves status and marks only this consumed action`, async () => {
      const f = fixture(descriptor, { rights }), { response, body } = await responseData(f);
      assert.equal(response.status, status);
      assert.deepEqual(body, { ok: false, [descriptor.reasonKey]: reason, fresh_tap_required: true });
      assert.equal(f.calls.filter(call => call === "consume").length, 1);
      assert.ok(f.calls.indexOf("rights") > f.calls.indexOf("consume"));
      assert.equal(f.calls.some(call => ["save", "membership", "program", "member"].includes(call)), false);
    });
  }
  test(`${label}: closed and legitimate opened success never request another TAP`, async () => {
    for (const result of ["VALID_CLOSED", "VALID_OPENED"]) {
      const f = fixture(descriptor, { result }), { response, body } = await responseData(f);
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(Object.hasOwn(body, "fresh_tap_required"), false);
      assert.equal(f.calls.filter(call => call === "consume").length, 1);
      assert.ok(f.calls.indexOf("rights") > f.calls.indexOf("consume"));
      assert.equal(f.calls.includes(label === "enroll" ? "member" : "save"), true);
    }
  });
  test(`${label}: an indeterminate writer result never fabricates a committed receipt or retries consumption`, async () => {
    const f = fixture(descriptor, { writerThrows: true });
    if (label !== "enroll") {
      // The strict save/join core has an explicit uncertain-result response. It does
      // not certify rollback or operation_committed and never sends another POST.
      const { response, body } = await responseData(f);
      assert.equal(response.status, 503);
      assert.deepEqual(body, { ok: false, error: "consumer_tap_save_unavailable", fresh_tap_required: true });
      assert.equal(Object.hasOwn(body, "operation_committed"), false);
    } else {
      await assert.rejects(f.request(), /synthetic_writer_result_indeterminate/);
    }
    assert.equal(f.calls.filter(call => call === "consume").length, 1);
    assert.equal(f.calls.filter(call => call === "rights").length, 1);
    assert.equal(f.calls.filter(call => call === (label === "enroll" ? "member" : "save")).length, 1);
  });
}

test("strict save/join post-consumption 404 gains its marker while unchanged enrollment 404/403 payloads remain unmarked", async () => {
  for (const [descriptor, configuration, status, reason] of [
    [descriptors[0], { savedEventMissing: true }, 404, "event_not_found"],
    [descriptors[1], { savedEventMissing: true }, 404, "event_not_found"],
    [descriptors[2], { programMissing: true }, 404, "no_active_program"],
    [descriptors[2], { memberMissing: true }, 403, "event_security_blocked"],
  ]) {
    const f = fixture(descriptor, configuration), { response, body } = await responseData(f);
    assert.equal(response.status, status);
    assert.equal(body[descriptor.reasonKey], reason);
    assert.equal(Object.hasOwn(body, "fresh_tap_required"), descriptor.action !== "enroll");
    if (descriptor.action !== "enroll") assert.equal(body.fresh_tap_required, true);
    assert.equal(f.calls.filter(call => call === "consume").length, 1);
  }
});

for (const descriptor of descriptors.slice(0, 2)) {
  for (const error of ["tap_context_changed", "manual_opening_declared", "consumer_membership_inactive"]) {
    test(`${descriptor.action}: explicit core ${error} is a 409 for the consumed action without false success`, async () => {
      const f = fixture(descriptor, { coreError: error }), { response, body } = await responseData(f);
      assert.equal(response.status, 409);
      assert.deepEqual(body, { ok: false, error, fresh_tap_required: true });
      for (const call of ["consume", "rights", "save"]) assert.equal(f.calls.filter(value => value === call).length, 1);
      assert.equal(f.calls.includes("membership"), false, "The route never makes a separate membership write");
    });
  }

  test(`${descriptor.action}: mobile expected binding comes from the authenticated event, never forged body fields`, async () => {
    const f = fixture(descriptor, { body: {
      bid: "SYNTHETIC-BATCH", tenantSlug: "synthetic-brand", consumerId: "forged-consumer",
      expected: { tenantId: "forged-tenant", tagRevision: "999", readCounter: 999 },
      tagId: "forged-tag", tagRevision: "999", readCounter: 999,
    } }), { response, body } = await responseData(f);
    assert.equal(response.status, 200);
    assert.deepEqual(body, descriptor.action === "save" ? { ok: true, saved: true, eventId: "900001" }
      : { ok: true, membership: { id: "synthetic-membership", status: "active" } });
    assert.equal(f.calls.filter(call => call === "consume").length, 1);
    assert.equal(f.calls.filter(call => call === "save").length, 1);
    assert.equal(f.calls.includes("membership"), false);
  });

  test(`${descriptor.action}: tenant and batch mismatches are rejected before capability consumption or the core`, async () => {
    for (const [body, error] of [
      [{ bid: "SYNTHETIC-BATCH", tenantSlug: "another-tenant" }, "tenant_mismatch"],
      [{ bid: "ANOTHER-BATCH", tenantSlug: "synthetic-brand" }, "tenant_batch_mismatch"],
    ]) {
      const f = fixture(descriptor, { body }), result = await responseData(f);
      assert.equal(result.response.status, 403); assert.equal(result.body.error, error);
      assert.equal(Object.hasOwn(result.body, "fresh_tap_required"), false);
      assert.equal(f.calls.some(call => ["consume", "rights", "save", "membership"].includes(call)), false);
    }
  });
}
