import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as lookupRuntime from "../src/lib/ticket-reference-lookup.ts";
import { ticketEntryReference, ticketEntryCopy } from "../src/lib/ticket-entry.ts";
import { confirmCustomerInbox } from "../src/lib/customer-inbox-state.ts";

const ID = "81000000-0000-8000-8000-000000000009", OTHER = "81000000-0000-8000-8000-000000000010";
const tenantId = "10000000-0000-4000-8000-000000000001";
const row = (id = ID, tenant_slug = "qa-only") => ({ id, tenant_slug, status: "open", created_at: "2026-09-23T12:00:00Z" });
const inbox = (rows = [row()]) => confirmCustomerInbox("tickets", rows, { availability: "ready", source: "production" }, { tenantScope: "qa-only", demoMode: false });
const response = (id = ID, tenant = "qa-only") => new Response(JSON.stringify({ ok: true, protocol: "nexid.support-ticket-lookup.v1",
  scope: { mode: "tenant", tenantId, tenantSlug: tenant }, ticket: { ...row(id, tenant), title: "QA report", detail: null,
    detail_state: "not_recorded", contact: null, bid: null, tap_event_id: null, tenant_id: tenantId, tenant_name: "QA only" },
}), { headers: { "x-nexid-data-mode": "production" } });

test("entry uses the unique persisted row reference and current company, never detail identity", () => {
  const rows = inbox([{ ...row(), detail: JSON.stringify({ id: OTHER, tenant_slug: "other" }) }]);
  assert.equal(ticketEntryReference(ID.toUpperCase(), rows, "qa-only", false, true), ID);
  assert.equal(ticketEntryReference(OTHER, rows, "qa-only", false, true), null);
  assert.equal(ticketEntryReference(ID, rows, "other", false, true), null);
  assert.equal(ticketEntryReference(ID, rows, "", false, true), ID);
  assert.equal(ticketEntryReference(ID, { ...rows, rows: [row(), row(ID, "other")] }, "", false, true), null);
});

test("entry fails closed for demo, permission, unavailable collection and malformed references", () => {
  const ready = inbox();
  for (const [demo, permission] of [[true, true], [false, false]]) assert.equal(ticketEntryReference(ID, ready, "qa-only", demo, permission), null);
  for (const source of ["demo", "unavailable"]) assert.equal(ticketEntryReference(ID, { ...ready, source }, "qa-only", false, true), null);
  for (const availability of ["upstream_error", "unreachable", "invalid_payload", "access_denied"]) assert.equal(ticketEntryReference(ID, { ...ready, availability }, "qa-only", false, true), null);
  for (const value of [null, "legacy-reference", `${ID}?tenant=other`, `${ID}/history`, ""]) assert.equal(ticketEntryReference(value, ready, "qa-only", false, true), null);
  assert.equal(ticketEntryReference(ID, inbox([row(ID, "other")]), "qa-only", false, true), null);
});

test("entry copy includes the same actions and unresolved guidance in every supported locale", () => {
  for (const copy of Object.values(ticketEntryCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), ["actions", "locked", "open"]);
    assert.ok(Object.values(copy).every(value => typeof value === "string" && value.length > 3));
  }
  assert.equal(ticketEntryCopy.en.open, "Open ticket");
});

// Execute the actual hook and actual scoped request runner. Only React scheduling
// and the HTTP transport are injected; browser acceptance covers real React/DOM.
const source = await readFile(new URL("../src/lib/use-ticket-reference-lookup.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function hookHarness(fetcher) {
  const slots = [], effects = [];
  let cursor = 0, args = ["qa-only", false, true], result;
  const same = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const react = {
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useState(value) { const index = cursor++; const slot = slots[index] ??= { value: typeof value === "function" ? value() : value };
      return [slot.value, next => { slot.value = typeof next === "function" ? next(slot.value) : next; }]; },
    useMemo(factory, deps) { const index = cursor++; if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, value: factory() }; return slots[index].value; },
    useEffect(effect, deps) { const index = cursor++; const prior = slots[index]; if (prior && same(prior.deps, deps)) return;
      const slot = slots[index] = { deps, cleanup: null }; effects.push(() => { prior?.cleanup?.(); slot.cleanup = effect(); }); },
  };
  const module = { exports: {} };
  const dependencies = { react, "./ticket-reference-lookup": { ...lookupRuntime, createTicketLookupRunner: () => lookupRuntime.createTicketLookupRunner(fetcher) } };
  new Function("require", "module", "exports", compiled)(name => { assert.ok(Object.hasOwn(dependencies, name)); return dependencies[name]; }, module, module.exports);
  return {
    render(...next) { if (next.length) args = next; cursor = 0; result = module.exports.useTicketReferenceLookup(...args); while (effects.length) effects.shift()(); return result; },
    unmount() { for (const slot of slots) slot.cleanup?.(); },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test("mount and rerender read nothing; one explicit entry canonicalizes scope and double clicks reuse the request", async () => {
  const calls = [], h = hookHarness(async (url, options) => { calls.push({ url, options }); return response(); });
  let hook = h.render(); h.render(); assert.equal(calls.length, 0);
  assert.equal(hook.open(ID.toUpperCase(), true), true);
  assert.equal(hook.open(ID, true), true); assert.equal(calls.length, 1);
  await settle(); hook = h.render(); assert.equal(hook.state.status, "found");
  assert.equal(hook.open(ID, true), true); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `/api/admin/tickets/${ID}?tenant=qa-only`);
  assert.equal(calls[0].options.method, "GET"); assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.body, undefined);
  hook.open(ID); assert.equal(calls.length, 2); // The explicit search form can reread a found ticket.
  await settle(); h.unmount();
});

test("the lock blocks selection, edit, reset and submit synchronously before React rerenders", async () => {
  const calls = [], locks = [];
  const h = hookHarness(async url => { calls.push(url); return response(); });
  let hook = h.render("qa-only", false, true, value => locks.push(value));
  hook.open(ID); await settle(); hook = h.render();
  hook.setLocked(true);
  assert.equal(hook.isLocked(), true); assert.equal(hook.open(OTHER), false); assert.equal(hook.reset(), false);
  hook.edit(OTHER); assert.equal(calls.length, 1);
  hook = h.render(); assert.equal(hook.reference, ID); assert.equal(hook.state.ticket.id, ID); assert.equal(hook.locked, true);
  hook.setLocked(true); assert.equal(hook.open(ID), false); // A later forbidden result must keep the sticky lock.
  hook.setLocked(false); assert.equal(hook.isLocked(), false);
  hook.open(ID); assert.equal(calls.length, 2);
  assert.deepEqual(locks, [true, true, false]); await settle(); h.unmount();
});

test("company A to B to A invalidates old responses and callbacks even if the scope string repeats", async () => {
  const pending = [], h = hookHarness((url, options) => new Promise(resolve => pending.push({ url, options, resolve })));
  const first = h.render(); first.open(ID);
  let current = h.render("other", false, true); assert.equal(current.state.status, "idle"); assert.equal(current.reference, "");
  assert.equal(pending[0].options.signal.aborted, true);
  current = h.render("qa-only", false, true);
  first.setLocked(true); assert.equal(current.isLocked(), false); assert.equal(first.open(OTHER), false);
  pending[0].resolve(response()); await settle(); current = h.render();
  assert.equal(current.state.status, "idle"); assert.equal(current.reference, ""); assert.equal(current.locked, false);
  current.open(OTHER); pending[1].resolve(response(OTHER)); await settle(); current = h.render();
  assert.equal(current.state.ticket.id, OTHER); h.unmount();
});

test("demo or permission loss clears visible state and prevents requests even through retained handlers", async () => {
  for (const [demo, permission] of [[true, true], [false, false]]) {
    let calls = 0; const h = hookHarness(async () => { calls++; return response(); });
    const original = h.render(); original.open(ID); await settle(); assert.equal(h.render().state.status, "found");
    const denied = h.render("qa-only", demo, permission);
    assert.equal(denied.state.status, "idle"); assert.equal(denied.reference, "");
    assert.equal(original.open(ID), false); assert.equal(denied.open(ID), false); assert.equal(calls, 1); h.unmount();
  }
});

test("failed lookup stays explicitly unconfirmed and retry uses the same reference without writes", async () => {
  let calls = 0; const h = hookHarness(async () => { calls++; if (calls === 1) throw new Error("synthetic failure"); return response(); });
  let hook = h.render(); hook.open(ID); await settle(); hook = h.render();
  assert.equal(hook.state.status, "unconfirmed"); assert.equal(hook.reference, ID);
  hook.open(ID, true); await settle(); assert.equal(h.render().state.status, "found"); assert.equal(calls, 2); h.unmount();
});

test("fresh status updates only the matching loaded ticket, while unrelated callbacks cannot alter it", async () => {
  const h = hookHarness(async () => response()); let hook = h.render(); hook.open(ID); await settle(); hook = h.render();
  hook.updateStatus(OTHER, "closed"); assert.equal(h.render().state.ticket.status, "open");
  hook.updateStatus(ID, "pending"); assert.equal(h.render().state.ticket.status, "pending"); h.unmount();
});

// Run the actual parent render with its real projections. Child components are
// represented as elements here; the browser suite renders them with real React.
const parentSource = await readFile(new URL("../src/app/(app)/leads-tickets/leads-tickets-client.tsx", import.meta.url), "utf8");
const parentCompiled = ts.transpileModule(parentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const parentLibraries = {};
for (const [, specifier] of parentCompiled.matchAll(/require\("([^"]+)"\)/g)) {
  if (specifier.includes("/lib/")) parentLibraries[specifier] = await import(new URL(`../src/lib/${specifier.split("/").at(-1)}.ts`, import.meta.url));
}
function parentHarness() {
  const slots = []; let cursor = 0;
  const react = {
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useState(value) { const index = cursor++; const slot = slots[index] ??= { value }; return [slot.value, next => { slot.value = typeof next === "function" ? next(slot.value) : next; }]; },
    useMemo(factory, deps) { const index = cursor++; const previous = slots[index]; if (!previous || previous.deps.length !== deps.length || previous.deps.some((value, offset) => !Object.is(value, deps[offset]))) slots[index] = { value: factory(), deps }; return slots[index].value; },
    useId() { return react.useRef(`qa-${cursor}`).current; }, useTransition() { return [false, callback => callback()]; },
  };
  const element = (type, props) => ({ type, props });
  const children = new Proxy({}, { get: (_, key) => key });
  const module = { exports: {} };
  new Function("require", "module", "exports", parentCompiled)(name => {
    if (Object.hasOwn(parentLibraries, name)) return parentLibraries[name];
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
    if (name === "next/navigation") return { useRouter: () => ({ refresh() { throw new Error("Unexpected refresh"); } }) };
    if (name.endsWith(".module.css")) return { default: {} };
    if (name.includes("/components/") || name === "lucide-react") return children;
    throw new Error(`Unexpected parent dependency ${name}`);
  }, module, module.exports);
  const collection = { availability: "ready", source: "production" };
  const base = { initialLeads: [], initialTickets: [row()], initialOrders: [], filteredOpportunities: [],
    tenantScope: "qa-only", sessionFilter: "", tenantFilter: "qa-only", locale: "es-AR", canLookupTickets: true,
    copy: { shell: { loading: "Loading", all: "All", refresh: "Refresh" }, statuses: {} }, labels: {}, demoMode: false, leadsSource: "production",
    signalCollections: { leads: collection, tickets: collection, orders: collection }, members: [], memberDirectory: collection,
    selectedMemberId: "", memberTimeline: { availability: "not_selected", items: [], partial: false, sourceErrors: [], hasMore: false, nextCursor: null } };
  return patch => { cursor = 0; return module.exports.default({ ...base, ...patch }); };
}
function nodes(root) {
  if (!root || typeof root !== "object") return [];
  if (Array.isArray(root)) return root.flatMap(nodes);
  return [root, ...nodes(root.props?.children)];
}
const parentLookup = tree => nodes(tree).find(node => node.type === "TicketReferenceLookup");
const parentLocked = tree => nodes(tree).some(node => node.props?.["data-testid"] === "ticket-entry-lock-notice");

for (const [name, intermediate] of [["permission", { canLookupTickets: false }], ["tenant", { tenantScope: "another-company" }], ["demo", { demoMode: true }]]) {
  test(`actual parent does not revive an uncertain lock after ${name} context A to B to A`, () => {
    const render = parentHarness(); let tree = render(); const firstLookup = parentLookup(tree);
    firstLookup.props.onNavigationLockChange(true); tree = render(); assert.equal(parentLocked(tree), true);
    assert.equal(nodes(tree).find(node => node.type === "CustomerActivitySummary").props.disabled, true);
    tree = render(intermediate); assert.equal(parentLocked(tree), false);
    tree = render(); assert.equal(parentLocked(tree), false);
    assert.equal(nodes(tree).find(node => node.type === "CustomerActivitySummary").props.disabled, false);
    assert.ok(nodes(tree).filter(node => node.props?.role === "tab").every(node => !node.props.disabled));
    // An old workflow notification must not become authority in the new visit.
    firstLookup.props.onNavigationLockChange(true); tree = render(); assert.equal(parentLocked(tree), false);
    parentLookup(tree).props.onNavigationLockChange(true); assert.equal(parentLocked(render()), true);
  });
}
