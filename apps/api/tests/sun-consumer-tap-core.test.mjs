import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const ts = createRequire(import.meta.url)("typescript");
const readSource = relative => readFileSync(new URL(`../src/${relative}`, import.meta.url), "utf8");
function loadSource(relative, dependencies) {
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
const unused = () => { throw Error("Unexpected dependency outside the save core"); };
const ownership = loadSource("lib/ownership-policy.ts", { "./tap-commercial-rights": { evaluateTapCommercialRights: unused } });
const event = {
  id: "900001", tenant_id: "10000000-0000-4000-8000-000000000001", batch_id: "10000000-0000-4000-8000-000000000002",
  bid: "SYNTHETIC-BATCH", uid_hex: "04AABBCCDD0011", sdm_read_ctr: 12, result: "VALID_CLOSED",
};
const consumerId = "20000000-0000-4000-8000-000000000001";
const expected = {
  tenantId: event.tenant_id, batchId: event.batch_id, bid: event.bid, uidHex: event.uid_hex, readCounter: event.sdm_read_ctr,
  tagId: "30000000-0000-4000-8000-000000000001", tagRevision: "17000001",
};
const membership = { id: "40000000-0000-4000-8000-000000000001", status: "active", tenant_id: event.tenant_id, consumer_id: consumerId };
const goodRows = association => [{ error: null, membership, product_id: "50000000-0000-4000-8000-000000000001", association_event_id: association ? event.id : null }];
const sqlError = code => Object.assign(Error("Synthetic statement failure"), { code });

// The actual service is transpiled and executed against this explicit adapter.
// It inspects the submitted SQL and supplies rows/errors; it is NOT PostgreSQL,
// and cannot establish locks, RLS, rollback, isolation or concurrency behavior.
function fixture({ tapEvent = event, outcomes = [goodRows(true)], projectionThrows = false } = {}) {
  const calls = { schema: 0, event: [], statements: [], publications: [], order: [] };
  const service = loadSource("lib/consumer-portal-service.ts", {
    "./db": {
      sql: unused,
      sqlSerializable: async (strings, ...values) => {
        calls.order.push("statement"); calls.statements.push({ text: strings.join("?"), values });
        const outcome = outcomes[Math.min(calls.statements.length - 1, outcomes.length - 1)];
        if (outcome instanceof Error) throw outcome;
        return outcome;
      },
    },
    "./loyalty-service": { getTapEvent: async id => { calls.event.push(id); return tapEvent; }, claimTapPoints: unused },
    "./ownership-policy": ownership,
    "./commercial-runtime-schema": { ensureConsumerPortalSchema: async () => { calls.schema += 1; } },
    "./canonical-event-writer": { CanonicalEventWriteError: class extends Error {}, writeCanonicalEvent: unused },
    "./tap-commercial-rights": { evaluateTapCommercialRights: unused, readCurrentTapCommercialRights: unused },
    "./realtime-tap-projection": { publishTenantTapRealtimeProjection: async id => {
      calls.order.push("publication"); calls.publications.push(id);
      if (projectionThrows) throw Error("Synthetic projection unavailable after commit");
      return { projected: true, distributed: true };
    } },
  });
  return { calls, service, save: (snapshot = expected) => service.saveConsumerTapActionForConsumer({ consumerId, eventId: event.id, mode: { kind: "mobile", expected: snapshot } }) };
}

test("mobile core submits one membership/history/product statement with authoritative identity and guarded receipt", async () => {
  const f = fixture(), result = await f.save();
  assert.deepEqual(result, { ok: true, status: 200, event, membership, productId: goodRows()[0].product_id });
  assert.equal(f.calls.schema, 1); assert.deepEqual(f.calls.event, [event.id]); assert.equal(f.calls.statements.length, 1);
  const { text, values } = f.calls.statements[0];
  for (const name of ["locked_event", "locked_batch", "locked_tags", "locked_manual", "locked_programs", "locked_membership", "locked_history", "locked_product", "decision_clock", "current_program", "decision", "eligible", "saved_product", "write_integrity"]) {
    assert.match(text, new RegExp(`${name} AS MATERIALIZED`));
  }
  assert.match(text, /FOR SHARE OF source_event/); assert.match(text, /FOR SHARE OF batch/); assert.match(text, /ORDER BY tag\.id FOR SHARE OF tag/);
  assert.match(text, /FOR UPDATE OF membership/); assert.match(text, /FOR SHARE OF history/); assert.match(text, /FOR UPDATE OF product/);
  assert.match(text, /event\.tenant_id = \?::uuid[\s\S]*event\.batch_id = \?::uuid AND batch\.bid = \?/);
  assert.match(text, /UPPER\(event\.uid_hex\) = UPPER\(\?\)[\s\S]*event\.sdm_read_ctr::bigint = \?::bigint/);
  assert.match(text, /row_revision = \? AND status = 'active'[\s\S]*COALESCE\(lifecycle_state, status::text\) = 'active'/);
  assert.match(text, /status IS DISTINCT FROM 'active'\) THEN 'consumer_membership_inactive'/);
  assert.match(text, /history\.tenant_id IS DISTINCT FROM event\.tenant_id\) THEN 'tap_context_changed'/);
  assert.match(text, /written_history AS \([\s\S]*FROM eligible event JOIN written_membership membership/);
  assert.match(text, /updated_product AS \([\s\S]*written_membership membership/);
  assert.match(text, /inserted_product AS \([\s\S]*JOIN written_membership membership/);
  assert.match(text, /SELECT 1 \/ CASE[\s\S]*count\(\*\) FROM written_membership\) = 1[\s\S]*count\(\*\) FROM saved_product\) = 1/);
  assert.match(text, /count\(\*\) FROM written_history\) = 1 OR EXISTS \([\s\S]*history\.tenant_id = event\.tenant_id AND history\.tap_event_id = event\.id[\s\S]*history\.consumer_id = \?::uuid/);
  assert.match(text, /program\.start_at <= clock\.observed_at[\s\S]*program\.end_at >= clock\.observed_at/);
  const membershipUpdate = text.split("ON CONFLICT (tenant_id, consumer_id) DO UPDATE SET")[1].split("RETURNING *")[0];
  assert.doesNotMatch(membershipUpdate, /loyalty_program_id\s*=/, "An existing membership is never silently moved to another program");
  assert.doesNotMatch(text, /consumer_product_ownerships|points_balance|claim_points|acquired_at/);
  for (const value of [event.id, consumerId, expected.tenantId, expected.batchId, expected.bid, expected.uidHex, expected.readCounter, expected.tagId, expected.tagRevision]) assert.ok(values.includes(value));
  assert.ok(values.some(value => Array.isArray(value) && value.includes("VALID_OPENED") && value.includes("VALID_CLOSED")));
  assert.equal(values.some(value => value === false), false); assert.ok(values.filter(value => value === true).length >= 3);
  assert.deepEqual(f.calls.order, ["statement", "publication"]); assert.deepEqual(f.calls.publications, [event.id]);
});

test("history adapter disables strict mobile checks and returns the original event without awarding rights", async () => {
  const historic = { ...event, result: "REPLAY_SUSPECT", current_tag_status: "inactive", current_tag_lifecycle_state: "suspended" };
  const f = fixture({ tapEvent: historic, outcomes: [goodRows(false)] });
  assert.equal(await f.service.saveTapForConsumer({ consumerId, eventId: event.id }), historic);
  const { values, text } = f.calls.statements[0];
  assert.equal(values.some(value => value === true), false); assert.ok(values.filter(value => value === false).length >= 3);
  assert.match(text, /'viewed', 'wine'/); assert.doesNotMatch(text, /INSERT INTO consumer_product_ownerships|UPDATE loyalty_members/);
  assert.deepEqual(f.calls.publications, []);
});

test("missing event is 404 before SQL or any post-commit projection", async () => {
  const f = fixture({ tapEvent: null });
  assert.deepEqual(await f.save(), { ok: false, status: 404, error: "event_not_found" });
  assert.equal(f.calls.schema, 1); assert.deepEqual(f.calls.event, [event.id]); assert.deepEqual(f.calls.statements, []); assert.deepEqual(f.calls.publications, []);
});

test("malformed mobile bindings reject before SQL without repairing counter or identity values", async () => {
  const variants = [null, { ...expected, tenantId: "other" }, { ...expected, batchId: "other" }, { ...expected, tagId: "other" },
    { ...expected, bid: "" }, { ...expected, uidHex: "" }, { ...expected, tagRevision: "" }, { ...expected, tagRevision: "1.5" },
    ...[-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, "01", " 12", "1e2", "-1", null, undefined, true, {}].map(readCounter => ({ ...expected, readCounter }))];
  for (const snapshot of variants) {
    const f = fixture();
    assert.deepEqual(await f.save(snapshot), { ok: false, status: 409, error: "tap_context_changed" });
    assert.deepEqual(f.calls.event, [event.id]); assert.deepEqual(f.calls.statements, []); assert.deepEqual(f.calls.publications, []);
  }
});

test("canonical nonnegative safe counters are passed numerically without inventing another counter ceiling", async () => {
  for (const readCounter of [0, "0", 12, "12", Number.MAX_SAFE_INTEGER]) {
    const f = fixture({ outcomes: [goodRows(false)] });
    assert.equal((await f.save({ ...expected, readCounter })).ok, true);
    assert.ok(f.calls.statements[0].values.includes(Number(readCounter)));
    if (typeof readCounter === "string") assert.equal(f.calls.statements[0].values.includes(readCounter), false);
  }
});

for (const [error, status] of [["event_not_found", 404], ["tap_context_changed", 409], ["manual_opening_declared", 409], ["consumer_membership_inactive", 409]]) {
  test(`locked SQL decision ${error} remains ${status} without a product receipt or projection`, async () => {
    const f = fixture({ outcomes: [[{ error, membership: null, product_id: null, association_event_id: null }]] });
    assert.deepEqual(await f.save(), { ok: false, status, error });
    assert.equal(f.calls.statements.length, 1); assert.deepEqual(f.calls.publications, []);
  });
}

for (const [label, rows] of [
  ["missing membership", [{ ...goodRows()[0], membership: null }]],
  ["membership without identity", [{ ...goodRows()[0], membership: {} }]],
  ["missing product", [{ ...goodRows()[0], product_id: null }]],
  ["no final row", []],
  ["unknown decision", [{ ...goodRows()[0], error: "unknown_decision" }]],
]) {
  test(`${label} can never be reported as a successful save or invoke projection`, async () => {
    const f = fixture({ outcomes: [rows] });
    await assert.rejects(f.save(), /consumer_tap_core_result_unavailable/);
    assert.equal(f.calls.statements.length, 1); assert.deepEqual(f.calls.publications, []);
  });
}

test("a valid receipt without a new history event ID does not request realtime publication", async () => {
  const f = fixture({ outcomes: [goodRows(false)] });
  assert.equal((await f.save()).ok, true); assert.equal(f.calls.statements.length, 1); assert.deepEqual(f.calls.publications, []);
});

test("40001 retries only the identical compound statement and publishes once after its successful receipt", async () => {
  const f = fixture({ outcomes: [sqlError("40001"), sqlError("40001"), goodRows(true)] });
  assert.equal((await f.save()).ok, true);
  assert.equal(f.calls.schema, 1); assert.deepEqual(f.calls.event, [event.id]); assert.equal(f.calls.statements.length, 3);
  assert.deepEqual(f.calls.statements[0], f.calls.statements[1]); assert.deepEqual(f.calls.statements[0], f.calls.statements[2]);
  assert.deepEqual(f.calls.order, ["statement", "statement", "statement", "publication"]); assert.deepEqual(f.calls.publications, [event.id]);
});

test("40001 exhaustion stops after three attempts with the original error and no external publication", async () => {
  const error = sqlError("40001"), f = fixture({ outcomes: [error] });
  await assert.rejects(f.save(), value => value === error);
  assert.equal(f.calls.schema, 1); assert.deepEqual(f.calls.event, [event.id]); assert.equal(f.calls.statements.length, 3); assert.deepEqual(f.calls.publications, []);
});

for (const code of ["23505", "08006", "40P01"]) {
  test(`${code} is propagated after one compound attempt without a receipt or external projection`, async () => {
    const error = sqlError(code), f = fixture({ outcomes: [error] });
    await assert.rejects(f.save(), value => value === error);
    assert.equal(f.calls.statements.length, 1); assert.deepEqual(f.calls.publications, []);
  });
}

test("a required-write SQL integrity error is propagated without turning it into a partial success", async () => {
  // The adapter supplies the error expected from the statement's division guard;
  // this tests JS error propagation only. Trigger/RLS rollback needs real PG QA.
  const error = sqlError("22012"), f = fixture({ outcomes: [error] });
  await assert.rejects(f.save(), value => value === error);
  assert.equal(f.calls.statements.length, 1); assert.deepEqual(f.calls.publications, []);
});

test("best-effort projection failure after a valid committed receipt does not repeat core writes", async () => {
  const f = fixture({ projectionThrows: true }), warnings = [], previous = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const result = await f.save();
    assert.equal(result.ok, true); assert.equal(result.productId, goodRows()[0].product_id);
    assert.equal(f.calls.statements.length, 1); assert.deepEqual(f.calls.publications, [event.id]);
    assert.equal(warnings.length, 1); assert.equal(warnings[0][0], "[consumer_actor_realtime_projection_failed]");
  } finally { console.warn = previous; }
});

test("inactive membership makes the historical event/null adapter return null instead of a partial receipt", async () => {
  const f = fixture({ outcomes: [[{ error: "consumer_membership_inactive", membership: null, product_id: null, association_event_id: null }]] });
  assert.equal(await f.service.saveTapForConsumer({ consumerId, eventId: event.id }), null);
  assert.equal(f.calls.statements.length, 1); assert.deepEqual(f.calls.publications, []);
});

for (const action of ["save-product", "join-tenant"]) {
  test(`${action}: real handler plus real core cannot emit 200 without a membership receipt`, async () => {
    const tapEvent = { ...event, current_tag_id: expected.tagId, current_tag_revision: expected.tagRevision };
    const f = fixture({ tapEvent, outcomes: [[{ ...goodRows()[0], membership: null }]] });
    const routeCalls = { auth: 0, event: 0, consume: 0, rights: 0 };
    const rights = loadSource("lib/tap-commercial-rights.ts", { "./db": { sql: async () => {
      routeCalls.rights += 1; return [{ result: event.result }];
    } } });
    const policy = loadSource("lib/ownership-policy.ts", { "./tap-commercial-rights": rights });
    const namespace = "../../../../../../lib/";
    const { POST } = loadSource(`app/mobile/passport/[eventId]/consumer/${action}/route.ts`, {
      [namespace + "http"]: loadSource("lib/http.ts", {}),
      [namespace + "consumer-auth"]: { getConsumerFromRequest: async () => { routeCalls.auth += 1; return { id: consumerId }; } },
      [namespace + "consumer-portal-service"]: f.service,
      [namespace + "loyalty-service"]: { getTapEvent: async () => { routeCalls.event += 1; return tapEvent; } },
      [namespace + "ownership-policy"]: policy,
      [namespace + "commercial-runtime-schema"]: { ensureConsumerPortalSchema: async () => {} },
      [namespace + "critical-rate-limit"]: { enforceCriticalRateLimit: async () => null },
      [namespace + "bounded-request-body"]: { RequestBodyTooLargeError: class extends Error {}, readBoundedJsonBody: req => req.json() },
      [namespace + "sun-fresh-handoff"]: { consumeSunFreshHandoff: async (_req, _body, binding, requestedAction) => {
        routeCalls.consume += 1;
        assert.deepEqual(binding, { eventId: event.id, bid: event.bid, uidHex: event.uid_hex, readCounter: event.sdm_read_ctr });
        assert.equal(requestedAction, action === "save-product" ? "consumer_save_product" : "consumer_join_tenant");
        return { ok: true };
      } },
      [namespace + "tap-commercial-rights"]: rights,
    });
    const response = await POST(new Request(`http://127.0.0.1/mobile/passport/${event.id}/consumer/${action}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bid: event.bid, tenantId: event.tenant_id }),
    }), { params: Promise.resolve({ eventId: event.id }) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: "consumer_tap_save_unavailable", fresh_tap_required: true });
    assert.deepEqual(routeCalls, { auth: 1, event: 1, consume: 1, rights: 1 });
    assert.equal(f.calls.statements.length, 1); assert.deepEqual(f.calls.event, [event.id]); assert.deepEqual(f.calls.publications, []);
  });
}
