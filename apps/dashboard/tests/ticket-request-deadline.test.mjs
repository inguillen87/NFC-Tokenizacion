import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { createTicketLookupRunner } from "../src/lib/ticket-reference-lookup.ts";
import { createTicketWorkflowReader, createTicketWorkflowWriter } from "../src/lib/ticket-workflow.ts";

// All records and transports below are synthetic; these are not production writes.
const ID = "81000000-0000-8000-8000-000000000009";
const REQUEST = "81000000-0000-4000-8000-000000000050";
const OP = "81000000-0000-8000-8000-000000000051";
const ACTOR = "81000000-0000-4000-8000-000000000052";
const TENANT = "10000000-0000-4000-8000-000000000001";
const current = () => ({ ticketId: ID, tenantId: TENANT, tenantSlug: "qa-only", status: "open", revision: "a".repeat(64), updatedAt: "2026-09-22T02:00:00.000Z", canUpdate: true, blockedReason: null });
const receipt = () => ({ operationId: OP, requestId: REQUEST, sequence: "2", fromStatus: "open", toStatus: "pending", reason: "Synthetic QA reason", actor: { id: ACTOR, label: "Synthetic operator" }, createdAt: "2026-09-22T03:00:00.000Z", revision: "b".repeat(64) });
const envelope = () => ({ ok: true, protocol: "nexid.support-ticket-workflow.v1", scope: { mode: "tenant", tenantId: TENANT, tenantSlug: "qa-only" }, current: current() });
const bodies = {
  lookup: () => ({ ok: true, protocol: "nexid.support-ticket-lookup.v1", scope: envelope().scope, ticket: { id: ID, title: "Synthetic ticket", detail: "Synthetic detail", detail_state: "available", status: "open", contact: null, created_at: current().updatedAt, bid: null, tap_event_id: null, tenant_id: TENANT, tenant_slug: "qa-only", tenant_name: "Synthetic tenant" } }),
  reader: () => ({ ...envelope(), items: [], page: { hasMore: false, nextCursor: null } }),
  writer: () => ({ ...envelope(), current: { ...current(), status: "pending", revision: "b".repeat(64) }, receipt: receipt(), outcome: "updated" }),
};
const response = (body, status = 200) => Response.json(body, { status, headers: { "x-nexid-data-mode": "production" } });
const success = { lookup: "found", reader: "ready", writer: "saved" };
const expired = { lookup: "unconfirmed", reader: "unavailable", writer: "uncertain" };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function track(promise) {
  const state = { settled: false, value: undefined, error: undefined };
  promise.then(value => { state.settled = true; state.value = value; }, error => { state.settled = true; state.error = error; });
  return state;
}
function create(kind, fetcher) {
  if (kind === "lookup") {
    const runner = createTicketLookupRunner(fetcher);
    return { run: () => runner.search(ID, "qa-only"), cancel: runner.cancel };
  }
  if (kind === "reader") {
    const reader = createTicketWorkflowReader(ID, "qa-only", fetcher);
    return { run: () => reader.read(), cancel: reader.cancel };
  }
  const writer = createTicketWorkflowWriter(ID, "qa-only", fetcher);
  assert.ok(writer.prepare(current(), "pending", receipt().reason, REQUEST));
  return { run: writer.submit, cancel: writer.dispose, writer };
}

for (const kind of ["lookup", "reader", "writer"]) {
  test(`${kind}: a non-cooperative transport settles at the deadline, not when it eventually replies`, async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = deferred(); let signal;
    const client = create(kind, (_, options) => { signal = options.signal; return pending.promise; });
    const state = track(client.run());
    t.mock.timers.tick(14_999); await nextTurn();
    assert.equal(state.settled, false);
    t.mock.timers.tick(1); await nextTurn();
    assert.equal(signal.aborted, true);
    assert.equal(state.settled, true, "deadline must settle independently of the transport");
    assert.equal(state.error, undefined);
    assert.equal(state.value.status, expired[kind]);
    pending.resolve(response(bodies[kind]())); await nextTurn();
    assert.equal(state.value.status, expired[kind]);
    if (client.writer) { assert.equal(client.writer.isBusy(), false); assert.equal(client.writer.isUnresolved(), true); }
  });

  test(`${kind}: cancellation settles immediately and discards late network completion`, async () => {
    const pending = deferred();
    const client = create(kind, () => pending.promise);
    const state = track(client.run()); client.cancel(); await nextTurn();
    assert.equal(state.settled, true);
    assert.equal(state.value, null);
    pending.resolve(response(bodies[kind]())); await nextTurn();
    assert.equal(state.value, null);
  });

  test(`${kind}: the same deadline covers a body that never finishes`, async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = deferred(); const value = response(bodies[kind]());
    let bodyStarted = false;
    value.json = () => { bodyStarted = true; return pending.promise; };
    const client = create(kind, async () => value);
    const state = track(client.run()); await nextTurn(); assert.equal(bodyStarted, true);
    t.mock.timers.tick(15_000); await nextTurn();
    assert.equal(state.settled, true);
    assert.equal(state.value.status, expired[kind]);
    pending.resolve(bodies[kind]()); await nextTurn();
    assert.equal(state.value.status, expired[kind]);
  });

  test(`${kind}: normal success keeps request policy and removes its timeout`, async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const calls = [];
    const client = create(kind, async (url, options) => { calls.push({ url, options }); return response(bodies[kind]()); });
    assert.equal((await client.run()).status, success[kind]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, kind === "writer" ? "PATCH" : "GET");
    for (const [key, value] of Object.entries({ cache: "no-store", credentials: "same-origin", redirect: "error" })) assert.equal(calls[0].options[key], value);
    assert.ok(calls[0].url.endsWith("?tenant=qa-only"));
    t.mock.timers.tick(30_000); await nextTurn();
    assert.equal(calls[0].options.signal.aborted, false, "a settled request must have no live deadline");
  });

  test(`${kind}: late rejection after a deadline is consumed without reviving the result`, async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = deferred(); const client = create(kind, () => pending.promise);
    const state = track(client.run()); t.mock.timers.tick(15_000); await nextTurn();
    assert.equal(state.settled, true); assert.equal(state.value.status, expired[kind]);
    pending.reject(Error("Synthetic late transport failure")); await nextTurn();
    assert.equal(state.error, undefined); assert.equal(state.value.status, expired[kind]);
  });

  test(`${kind}: malformed JSON and transport errors preserve the unconfirmed outcome`, async () => {
    let calls = 0;
    const client = create(kind, () => {
      if (++calls === 1) return Promise.resolve(new Response("<html>synthetic failure</html>"));
      throw Error("Synthetic synchronous transport error");
    });
    assert.equal((await client.run()).status, expired[kind]);
    assert.equal((await client.run()).status, expired[kind]);
  });

  test(`${kind}: expiry before headers does not parse a late response body`, async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = deferred(); let parsed = false;
    const value = response(bodies[kind]()); value.json = async () => { parsed = true; return bodies[kind](); };
    const client = create(kind, () => pending.promise);
    const state = track(client.run()); t.mock.timers.tick(15_000); await nextTurn();
    pending.resolve(value); await nextTurn();
    assert.equal(state.value?.status, expired[kind]); assert.equal(parsed, false);
  });
}

test("writer: timeout retains the reviewed idempotency key and prevents a late success from resolving a new attempt", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = [deferred(), deferred()]; const sent = [];
  const { writer, run } = create("writer", (_, options) => { sent.push(options); return pending[sent.length - 1].promise; });
  const first = track(run()); t.mock.timers.tick(15_000); await nextTurn();
  assert.equal(first.settled, true); assert.equal(first.value.status, "uncertain");
  assert.equal(writer.isBusy(), false); assert.equal(writer.canEdit(), false);
  writer.clear(); assert.equal(writer.getAttempt().command.request_id, REQUEST);
  assert.equal(writer.prepare(current(), "closed", "Different command", OP), null);
  const retry = track(run()); assert.equal(sent.length, 2); assert.equal(writer.isBusy(), true);
  assert.equal(await run(), null, "overlapping confirmations remain locked");
  assert.equal(sent[1].body, sent[0].body);
  assert.equal(sent[1].headers["Idempotency-Key"], REQUEST);
  pending[0].resolve(response(bodies.writer())); await nextTurn();
  assert.equal(retry.settled, false); assert.equal(writer.isBusy(), true); assert.equal(writer.isUnresolved(), true);
  pending[1].resolve(response({ ...bodies.writer(), outcome: "replayed" })); await nextTurn();
  assert.equal(retry.value.status, "saved"); assert.equal(writer.isBusy(), false); assert.equal(writer.isUnresolved(), false);
});

test("writer: forbidden retry cannot erase a preceding timeout or unlock its command", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = deferred(); let count = 0;
  const { writer, run } = create("writer", () => ++count === 1 ? pending.promise : Promise.resolve(response({ ok: false }, 403)));
  const state = track(run()); t.mock.timers.tick(15_000); await nextTurn();
  assert.equal(state.settled, true); assert.equal(state.value.status, "uncertain");
  assert.equal((await run()).status, "forbidden");
  assert.equal(writer.isUnresolved(), true); assert.equal(writer.canEdit(), false);
  assert.equal(writer.getAttempt().command.request_id, REQUEST);
});

test("lookup: a new context settles its old read without accepting a late ticket", async () => {
  const old = deferred(); let count = 0;
  const runner = createTicketLookupRunner(() => ++count === 1 ? old.promise : Promise.resolve(response(bodies.lookup())));
  const first = track(runner.search(ID, "old-tenant"));
  assert.equal((await runner.search(ID, "qa-only")).status, "found"); await nextTurn();
  assert.equal(first.settled, true); assert.equal(first.value, null);
  old.resolve(response(bodies.lookup())); await nextTurn(); assert.equal(first.value, null);
});
