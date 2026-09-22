import assert from "node:assert/strict";
import test from "node:test";
import { createTicketWorkflowReader, createTicketWorkflowWriter, parseWorkflowHistory, parseWorkflowOutcome, prepareWorkflowCommand } from "../src/lib/ticket-workflow.ts";
import { ticketWorkflowCopy } from "../src/lib/ticket-workflow-copy.ts";

const ID = "81000000-0000-8000-8000-000000000009", REQUEST = "81000000-0000-4000-8000-000000000050", OP = "81000000-0000-8000-8000-000000000051", ACTOR = "81000000-0000-4000-8000-000000000052", TENANT = "10000000-0000-4000-8000-000000000001";
const current = (patch = {}) => ({ ticketId: ID, tenantId: TENANT, tenantSlug: "qa-only", status: "open", revision: "a".repeat(64), updatedAt: "2026-09-22T02:00:00.000Z", canUpdate: true, blockedReason: null, ...patch });
const item = (patch = {}) => ({ operationId: OP, requestId: REQUEST, sequence: "2", fromStatus: "open", toStatus: "pending", reason: "Revisión interna iniciada <script>", actor: { id: ACTOR, label: "Operadora QA" }, createdAt: "2026-09-22T03:00:00.000Z", revision: "b".repeat(64), ...patch });
const envelope = (patch = {}) => ({ ok: true, protocol: "nexid.support-ticket-workflow.v1", scope: { mode: "tenant", tenantId: TENANT, tenantSlug: "qa-only" }, current: current(), ...patch });
const history = (patch = {}) => envelope({ items: [], page: { hasMore: false, nextCursor: null }, ...patch });
const command = () => prepareWorkflowCommand(current(), "pending", item().reason, REQUEST);
const saved = (patch = {}) => envelope({ current: current({ status: "pending", revision: "b".repeat(64) }), receipt: item(), outcome: "updated", ...patch });
const response = (payload, status = 200, mode = "production") => Response.json(payload, { status, headers: { "x-nexid-data-mode": mode } });

test("history requires current ticket and selected tenant; unavailable is never confirmed empty", () => {
  assert.equal(parseWorkflowHistory(history(), ID, "qa-only").items.length, 0);
  for (const mutate of [value => { value.current.ticketId = REQUEST; }, value => { value.scope.tenantSlug = "other"; }, value => { value.current.tenantId = ACTOR; }, value => { value.current.revision = "2026-date"; }, value => { value.items = null; }, value => { value.demoMode = true; }]) {
    const value = history(); mutate(value); assert.equal(parseWorkflowHistory(value, ID, "qa-only"), null);
  }
});

test("history carries authenticated actor, literal reason and ordered cursor pages with bounded 50 rows", () => {
  const first = item(), second = item({ operationId: REQUEST, sequence: "1" });
  const parsed = parseWorkflowHistory(history({ items: [first, second], page: { hasMore: true, nextCursor: "1" } }), ID, "qa-only");
  assert.deepEqual(parsed.items[0].actor, { id: ACTOR, label: "Operadora QA" }); assert.equal(parsed.items[0].reason, first.reason);
  assert.equal(parsed.page.nextCursor, "1");
  for (const items of [[second, first], [first, first], [item({ actor: { id: "forged", label: "Fake" } })], Array(51).fill(first)]) assert.equal(parseWorkflowHistory(history({ items }), ID, "qa-only"), null);
  assert.equal(parseWorkflowHistory(history({ items: [first], page: { hasMore: true, nextCursor: "3" } }), ID, "qa-only"), null);
});

test("blocked incident, legacy and unassigned tickets remain readable without creating commands", () => {
  for (const blockedReason of ["incident_managed", "legacy_status", "tenant_unassigned"]) {
    const snapshot = current({ canUpdate: false, blockedReason });
    assert.ok(parseWorkflowHistory(history({ current: snapshot }), ID, "qa-only"));
    assert.equal(prepareWorkflowCommand(snapshot, "pending", "Reason", REQUEST), null);
  }
  assert.equal(parseWorkflowHistory(history({ current: current({ canUpdate: true, blockedReason: "incident_managed" }) }), ID, "qa-only"), null);
});

test("reviewed command is immutable, uses exact opaque revision and requires a changed status and bounded reason", () => {
  const prepared = command(); assert.ok(Object.isFrozen(prepared)); assert.equal(prepared.expected_revision, "a".repeat(64));
  assert.equal(prepareWorkflowCommand(current(), "pending", "  motivo  ", REQUEST).reason, "motivo");
  assert.equal(prepareWorkflowCommand(current(), "pending", "Primera línea\r\nSegunda\tlínea", REQUEST).reason, "Primera línea Segunda línea");
  assert.equal(prepareWorkflowCommand(current(), "pending", "Motivo\u0000oculto", REQUEST), null);
  assert.equal(prepareWorkflowCommand(current(), "pending", "Motivo\u0085oculto", REQUEST), null);
  for (const [status, reason] of [["open", "Reason"], ["anything", "Reason"], ["closed", " "], ["closed", "x".repeat(1001)]]) assert.equal(prepareWorkflowCommand(current(), status, reason, REQUEST), null);
  assert.equal(prepareWorkflowCommand(current(), "closed", "Reason", "not-an-id"), null);
});

test("receipt proves the reviewed operation while replay current status can already be different", () => {
  const replay = saved({ outcome: "replayed", current: current({ status: "closed", revision: "c".repeat(64) }) });
  const parsed = parseWorkflowOutcome(200, replay, ID, "qa-only", command(), "open", "production");
  assert.equal(parsed.status, "saved"); assert.equal(parsed.receipt.toStatus, "pending"); assert.equal(parsed.current.status, "closed");
  for (const change of [{ requestId: OP }, { toStatus: "closed" }, { fromStatus: "closed" }, { reason: "Other reason" }]) {
    assert.equal(parseWorkflowOutcome(200, saved({ receipt: item(change) }), ID, "qa-only", command(), "open", "production").status, "uncertain");
  }
});

test("writer sends nothing before confirm and locks overlapping double confirmation", async () => {
  let complete;
  const calls = [];
  const writer = createTicketWorkflowWriter(ID, "qa-only", (url, init) => { calls.push({ url, init }); return new Promise(resolve => { complete = resolve; }); });
  writer.prepare(current(), "pending", item().reason, REQUEST); assert.equal(calls.length, 0);
  const first = writer.submit(); assert.equal(await writer.submit(), null); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `/api/admin/tickets/${ID}?tenant=qa-only`); assert.equal(calls[0].init.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[0].init.body), command()); assert.equal(calls[0].init.headers["Idempotency-Key"], REQUEST);
  complete(response(saved())); assert.equal((await first).status, "saved"); assert.equal(writer.isUnresolved(), false);
});

test("uncertain then forbidden keeps exact command and request id for retries and blocks edits", async () => {
  const sent = []; let count = 0;
  const writer = createTicketWorkflowWriter(ID, "qa-only", async (url, init) => { sent.push(init.body); count++; if (count === 1) throw Error("response lost after possible commit"); return count === 2 ? response({ ok: false }, 403) : response(saved({ outcome: "replayed" })); });
  writer.prepare(current(), "pending", item().reason, REQUEST);
  assert.equal((await writer.submit()).status, "uncertain"); assert.equal(writer.canEdit(), false);
  assert.equal(writer.prepare(current(), "closed", "Changed draft", OP), null);
  assert.equal((await writer.submit()).status, "forbidden"); assert.equal(writer.isUnresolved(), true);
  writer.clear(); assert.equal(writer.getAttempt().command.request_id, REQUEST);
  assert.equal((await writer.submit()).status, "saved"); assert.equal(writer.isUnresolved(), false);
  assert.equal(new Set(sent).size, 1);
});

test("conflict and same final status cannot resolve a prior uncertain operation without matching receipt", async () => {
  let count = 0;
  const writer = createTicketWorkflowWriter(ID, "qa-only", async () => ++count === 1 ? response({ ok: false }, 503) : response({ ok: false, reason: "ticket_workflow_conflict" }, 409));
  writer.prepare(current(), "pending", item().reason, REQUEST);
  assert.equal((await writer.submit()).status, "uncertain"); assert.equal((await writer.submit()).status, "conflict");
  assert.equal(writer.reconcile(parseWorkflowHistory(history({ current: current({ status: "pending" }) }), ID, "qa-only")), null);
  assert.equal(writer.isUnresolved(), true);
  assert.ok(writer.reconcile(parseWorkflowHistory(history({ current: current({ status: "pending" }), items: [item()] }), ID, "qa-only")));
  assert.equal(writer.isUnresolved(), false);
});

test("read confirmed conflicts permit a new reviewed command, never silently overwrite a changed revision", async () => {
  const writer = createTicketWorkflowWriter(ID, "qa-only", async () => response({ ok: false, reason: "ticket_workflow_conflict" }, 409));
  writer.prepare(current(), "pending", item().reason, REQUEST);
  assert.equal((await writer.submit()).status, "conflict"); assert.equal(writer.isUnresolved(), false);
  const next = writer.prepare(current({ status: "pending", revision: "b".repeat(64) }), "closed", "Reason preserved", OP);
  assert.equal(next.expected_revision, "b".repeat(64)); assert.equal(next.request_id, OP);
});

test("changing context disposes writes and cancels reads without accepting a late result", async () => {
  let finishWrite, finishRead;
  const writer = createTicketWorkflowWriter(ID, "qa-only", () => new Promise(resolve => { finishWrite = resolve; }));
  writer.prepare(current(), "pending", item().reason, REQUEST); const pending = writer.submit(); writer.dispose(); finishWrite(response(saved())); assert.equal(await pending, null);
  const reader = createTicketWorkflowReader(ID, "qa-only", () => new Promise(resolve => { finishRead = resolve; }));
  const reading = reader.read(); reader.cancel(); finishRead(response(history())); assert.equal(await reading, null);
});

test("a history read from before confirmation is invalidated and cannot overwrite the saved current status", async () => {
  let finishRead;
  const reader = createTicketWorkflowReader(ID, "qa-only", () => new Promise(resolve => { finishRead = resolve; }));
  const writer = createTicketWorkflowWriter(ID, "qa-only", async () => response(saved()));
  const stale = reader.read();
  writer.prepare(current(), "pending", item().reason, REQUEST);
  // The component cancels the reader before submitting and refuses new reads while busy.
  reader.cancel();
  const saving = writer.submit(); assert.equal(writer.isBusy(), true);
  const result = await saving; assert.equal(result.current.status, "pending");
  finishRead(response(history())); assert.equal(await stale, null);
});

test("history reader distinguishes empty, unauthorized, failure and cursor requests without writes", async () => {
  let responseValue = response(history()); const calls = [];
  const reader = createTicketWorkflowReader(ID, "qa-only", async (url, init) => { calls.push({ url, init }); return responseValue; });
  assert.equal((await reader.read()).history.items.length, 0);
  responseValue = response({ ok: false }, 503); assert.equal((await reader.read()).status, "unavailable");
  responseValue = response({ ok: false }, 403); assert.equal((await reader.read()).status, "forbidden");
  responseValue = response(history()); await reader.read("50");
  assert.equal(calls.at(-1).url, `/api/admin/tickets/${ID}/history?tenant=qa-only&cursor=50`);
  assert.ok(calls.every(call => call.init.method === "GET" && call.init.cache === "no-store"));
});

test("workflow copy covers identical states in Spanish, English and Portuguese", () => {
  for (const copy of Object.values(ticketWorkflowCopy)) { assert.deepEqual(Object.keys(copy).sort(), Object.keys(ticketWorkflowCopy["es-AR"]).sort()); assert.notEqual(copy.empty, copy.unavailable); assert.notEqual(copy.saved, copy.uncertain); }
});
