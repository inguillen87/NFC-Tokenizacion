import assert from "node:assert/strict";
import test from "node:test";
import { createTicketWorkflowReader, createTicketWorkflowWriter, parseWorkflowHistory, parseWorkflowOutcome, prepareWorkflowCommand } from "../src/lib/ticket-workflow.ts";
import { ticketWorkflowCopy } from "../src/lib/ticket-workflow-copy.ts";
import { readFile } from "node:fs/promises";
import ts from "typescript";

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

// Execute the actual component and actual protocol readers/writer. React
// scheduling and loopback-free HTTP responses are injected, not the decisions.
const componentSource = await readFile(new URL("../src/components/ticket-workflow.tsx", import.meta.url), "utf8");
const componentCode = ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
function workflowComponent(fetcher) {
  const slots = [], effects = []; let cursor = 0;
  const react = {
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useState(value) { const index = cursor++; const slot = slots[index] ??= { value }; return [slot.value, next => { slot.value = typeof next === "function" ? next(slot.value) : next; }]; },
    useId() { return react.useRef(`workflow-${cursor}`).current; },
    useEffect(effect, deps) { const index = cursor++, old = slots[index]; if (old && old.deps.length === deps.length && old.deps.every((value, offset) => Object.is(value, deps[offset]))) return;
      slots[index] = { deps, cleanup: null }; effects.push(() => { old?.cleanup?.(); slots[index].cleanup = effect(); }); },
  };
  const element = (type, props) => ({ type, props }), module = { exports: {} };
  const runtime = { createTicketWorkflowReader: (id, tenant) => createTicketWorkflowReader(id, tenant, fetcher), createTicketWorkflowWriter: (id, tenant) => createTicketWorkflowWriter(id, tenant, fetcher) };
  new Function("require", "module", "exports", componentCode)(name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
    if (name === "../lib/ticket-workflow") return runtime;
    if (name === "../lib/ticket-workflow-copy") return { ticketWorkflowCopy };
    throw Error(`Unexpected workflow dependency ${name}`);
  }, module, module.exports);
  const base = { ticket: { id: ID, tenant_slug: "qa-only" }, tenantScope: "qa-only", locale: "es-AR", onCurrent() {} };
  return {
    render(patch = {}) { cursor = 0; const tree = module.exports.TicketWorkflow({ ...base, ...patch }); while (effects.length) effects.shift()(); return tree; },
    unmount() { for (const slot of slots) slot.cleanup?.(); },
  };
}
function componentNodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(componentNodes);
  return [value, ...componentNodes(value.props?.children)];
}
const componentSettle = () => new Promise(resolve => setImmediate(resolve));
async function reviewComponent(h, props) {
  let tree = h.render(props);
  tree.props.onToggle({ currentTarget: { open: true } }); await componentSettle();
  tree = h.render(props);
  componentNodes(tree).find(node => node.type === "select").props.onChange({ target: { value: "pending" } });
  tree = h.render(props);
  componentNodes(tree).find(node => node.type === "textarea").props.onChange({ target: { value: item().reason } });
  tree = h.render(props);
  componentNodes(tree).find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  return h.render(props);
}
const componentConfirm = tree => componentNodes(componentNodes(tree).find(node => node.props?.["data-testid"] === "ticket-workflow-review")).find(node => node.type === "button");

test("actual component notifies the captured PATCH listener once, using replay current rather than receipt status", async () => {
  let finish; const calls = [], old = [], replacement = [], detail = [];
  const h = workflowComponent(async (url, init) => { calls.push({ url, init }); return init.method === "PATCH" ? new Promise(resolve => { finish = resolve; }) : response(history()); });
  const props = { onAuthoritativeCurrent: value => old.push(value), onCurrent: value => detail.push(value) };
  const tree = await reviewComponent(h, props); assert.equal(old.length, 1); assert.equal(detail.length, 1);
  const confirm = componentConfirm(tree); confirm.props.onClick(); confirm.props.onClick();
  assert.equal(calls.filter(call => call.init.method === "PATCH").length, 1);
  const newer = { onAuthoritativeCurrent: value => replacement.push(value), onCurrent: value => detail.push(value) };
  h.render(newer);
  const sent = JSON.parse(calls.find(call => call.init.method === "PATCH").init.body);
  finish(response(saved({ outcome: "replayed", receipt: item({ requestId: sent.request_id }), current: current({ status: "closed", revision: "c".repeat(64) }) })));
  await componentSettle(); h.render(newer);
  assert.equal(old.length, 2); assert.equal(old.at(-1).status, "closed"); assert.equal(replacement.length, 0);
  assert.equal(JSON.parse(calls.find(call => call.init.method === "PATCH").init.body).status, "pending");
  assert.equal(detail.at(-1).status, "closed"); h.unmount();
});

for (const status of [403, 409, 503]) {
  test(`actual component keeps PATCH ${status} out of the collection callback and preserves the reviewed body`, async () => {
    const commits = [], calls = [], reason = status === 409 ? "ticket_workflow_conflict" : "unavailable";
    const h = workflowComponent(async (url, init) => { calls.push({ url, init }); return init.method === "PATCH" ? response({ ok: false, reason }, status) : response(history()); });
    const props = { onAuthoritativeCurrent: value => commits.push(value) };
    const tree = await reviewComponent(h, props); componentConfirm(tree).props.onClick(); await componentSettle();
    const next = h.render(props), patch = calls.filter(call => call.init.method === "PATCH");
    assert.equal(commits.length, 1); assert.equal(commits[0].status, "open"); assert.equal(patch.length, 1);
    assert.equal(JSON.parse(patch[0].init.body).reason, item().reason); assert.equal(JSON.parse(patch[0].init.body).expected_revision, "a".repeat(64));
    assert.equal(componentNodes(next).find(node => node.type === "textarea").props.value, item().reason);
    h.unmount();
  });
}

test("an explicit history check confirms an uncertain operation only with its exact receipt, without another PATCH", async () => {
  const calls = [], confirmed = [], replacement = []; let sent, finishHistory, recovering = false;
  const h = workflowComponent(async (url, init) => {
    calls.push({ url, init });
    if (init.method === "PATCH") { sent = JSON.parse(init.body); return response({ ok: false }, 503); }
    return recovering ? new Promise(resolve => { finishHistory = resolve; }) : response(history());
  });
  const props = { onAuthoritativeCurrent: value => confirmed.push(value) };
  let tree = await reviewComponent(h, props); componentConfirm(tree).props.onClick(); await componentSettle();
  tree = h.render(props); assert.equal(confirmed.length, 1);
  assert.equal(componentNodes(tree).find(node => node.type === "textarea").props.value, item().reason);
  recovering = true;
  componentNodes(tree).find(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].reload).props.onClick();
  h.render({ onAuthoritativeCurrent: value => replacement.push(value) });
  finishHistory(response(history({ current: current({ status: "closed", revision: "c".repeat(64) }), items: [item({ requestId: sent.request_id })] })));
  await componentSettle(); tree = h.render(props);
  assert.equal(confirmed.length, 2); assert.equal(confirmed.at(-1).status, "closed"); assert.equal(replacement.length, 0);
  assert.equal(calls.filter(call => call.init.method === "PATCH").length, 1);
  assert.equal(calls.filter(call => call.init.method === "GET").length, 2);
  assert.equal(componentNodes(tree).find(node => node.type === "textarea").props.value, item().reason);
  h.unmount();
});

test("an uncertain operation remains unconfirmed when history has only matching status or a different receipt", async () => {
  for (const items of [[], [item({ requestId: OP })]]) {
    const commits = [], calls = []; let recovering = false;
    const h = workflowComponent(async (url, init) => {
      calls.push(init.method);
      return init.method === "PATCH" ? response({ ok: false }, 503) : response(recovering ? history({ current: current({ status: "pending" }), items }) : history());
    });
    const props = { onAuthoritativeCurrent: value => commits.push(value) };
    let tree = await reviewComponent(h, props); componentConfirm(tree).props.onClick(); await componentSettle(); tree = h.render(props);
    recovering = true;
    componentNodes(tree).find(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].reload).props.onClick();
    await componentSettle(); tree = h.render(props);
    assert.equal(commits.length, 2); assert.equal(commits.at(-1).status, "pending"); assert.equal(calls.filter(method => method === "PATCH").length, 1);
    assert.equal(componentNodes(tree).find(node => node.props?.["data-workflow-state"] === "uncertain")?.props["data-workflow-state"], "uncertain");
    assert.equal(componentNodes(tree).find(node => node.type === "textarea").props.disabled, true);
    assert.equal(componentNodes(tree).find(node => node.type === "textarea").props.value, item().reason);
    h.unmount();
  }
});

for (const failure of ["503", "network"]) {
  test(`an uncertain operation keeps its frozen recovery visible through a pending and failed ${failure} history read`, async () => {
    const calls = [], commits = [], locks = []; let reads = 0, patches = 0, finishRead;
    const h = workflowComponent(async (url, init) => {
      calls.push({ url, init });
      if (init.method === "PATCH") {
        patches++;
        return patches === 1 ? response({ ok: false }, 503) : response(saved({ outcome: "replayed", receipt: item({ requestId: JSON.parse(init.body).request_id }) }));
      }
      if (++reads === 1) return response(history());
      return new Promise((resolve, reject) => { finishRead = () => failure === "network" ? reject(Error("history connection lost")) : resolve(response({ ok: false }, 503)); });
    });
    const props = { onAuthoritativeCurrent: value => commits.push(value), onNavigationLockChange: value => locks.push(value) };
    let tree = await reviewComponent(h, props); componentConfirm(tree).props.onClick(); await componentSettle(); tree = h.render(props);
    const original = calls.find(call => call.init.method === "PATCH").init;
    componentNodes(tree).find(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].reload).props.onClick();
    tree = h.render(props);
    const assertRecovery = () => {
      const nodes = componentNodes(tree);
      assert.equal(nodes.find(node => node.type === "textarea").props.value, item().reason);
      assert.equal(nodes.find(node => node.type === "textarea").props.disabled, true);
      assert.equal(nodes.find(node => node.type === "select").props.value, "pending");
      assert.equal(nodes.find(node => node.type === "select").props.disabled, true);
      assert.ok(nodes.find(node => node.props?.["data-workflow-state"] === "uncertain"));
      assert.ok(nodes.find(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].retry));
      assert.equal(nodes.some(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].review), false);
      assert.equal(nodes.some(node => node.props?.["data-testid"] === "ticket-workflow-history"), false);
      assert.equal(patches, 1); assert.equal(commits.length, 1); assert.equal(locks.at(-1), true);
    };
    assert.ok(componentNodes(tree).find(node => node.props?.["data-history-state"] === "loading")); assertRecovery();
    finishRead(); await componentSettle(); tree = h.render(props);
    assert.ok(componentNodes(tree).find(node => node.props?.["data-history-state"] === "unavailable")); assertRecovery();
    componentNodes(tree).find(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].retry).props.onClick();
    await componentSettle(); tree = h.render(props);
    const attempts = calls.filter(call => call.init.method === "PATCH");
    assert.equal(attempts.length, 2); assert.equal(attempts[1].init.body, original.body);
    assert.equal(attempts[1].init.headers["Idempotency-Key"], original.headers["Idempotency-Key"]);
    assert.equal(reads, 2); assert.equal(commits.at(-1).status, "pending"); assert.equal(locks.at(-1), false);
    assert.ok(componentNodes(tree).find(node => node.props?.["data-workflow-state"] === "saved"));
    h.unmount();
  });
}

for (const deniedStatus of [401, 403]) {
  test(`history ${deniedStatus} keeps frozen recovery hidden until an explicit authorized read succeeds`, async () => {
    const calls = [], locks = []; let readMode = "initial", finishRead;
    const h = workflowComponent(async (url, init) => {
      calls.push({ url, init });
      if (init.method === "PATCH") return response({ ok: false }, 503);
      if (readMode === "initial" || readMode === "restored") return response(history());
      if (readMode === "denied") return response({ ok: false }, deniedStatus);
      return new Promise(resolve => { finishRead = () => resolve(response({ ok: false }, 503)); });
    });
    const props = { onNavigationLockChange: value => locks.push(value) };
    let tree = await reviewComponent(h, props); componentConfirm(tree).props.onClick(); await componentSettle(); tree = h.render(props);
    readMode = "denied";
    componentNodes(tree).find(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].reload).props.onClick();
    await componentSettle(); tree = h.render(props);
    const assertRestricted = () => {
      const nodes = componentNodes(tree);
      assert.equal(nodes.some(node => node.type === "form" || node.type === "textarea" || node.type === "select"), false);
      assert.equal(nodes.some(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].retry), false);
      assert.equal(nodes.some(node => node.props?.["data-workflow-state"] || node.props?.["data-testid"] === "ticket-workflow-history"), false);
      assert.equal(calls.filter(call => call.init.method === "PATCH").length, 1); assert.equal(locks.at(-1), true);
    };
    assert.ok(componentNodes(tree).find(node => node.props?.["data-history-state"] === "forbidden")); assertRestricted();
    readMode = "pending";
    componentNodes(tree).find(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].refresh).props.onClick();
    tree = h.render(props); assertRestricted();
    finishRead(); await componentSettle(); tree = h.render(props); assertRestricted();
    readMode = "restored";
    componentNodes(tree).find(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].refresh).props.onClick();
    await componentSettle(); tree = h.render(props);
    assert.equal(componentNodes(tree).find(node => node.type === "textarea").props.value, item().reason);
    assert.equal(componentNodes(tree).find(node => node.type === "textarea").props.disabled, true);
    assert.ok(componentNodes(tree).find(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].retry));
    assert.equal(calls.filter(call => call.init.method === "PATCH").length, 1); assert.equal(locks.at(-1), true);
    h.unmount();
  });
}

test("an unavailable initial history never exposes an editable or retryable operation", async () => {
  const calls = [];
  const h = workflowComponent(async (url, init) => { calls.push(init.method); return response({ ok: false }, 503); });
  let tree = h.render(); tree.props.onToggle({ currentTarget: { open: true } }); await componentSettle(); tree = h.render();
  const nodes = componentNodes(tree);
  assert.ok(nodes.find(node => node.props?.["data-history-state"] === "unavailable"));
  assert.equal(nodes.some(node => node.type === "form" || node.type === "textarea" || node.type === "select"), false);
  assert.equal(nodes.some(node => node.type === "button" && node.props.children === ticketWorkflowCopy["es-AR"].retry), false);
  assert.deepEqual(calls, ["GET"]); h.unmount();
});
