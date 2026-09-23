import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { setImmediate as turn } from "node:timers/promises";
import ts from "typescript";
import { confirmCustomerInbox, parseCustomerInboxPayload, customerRecordDate, customerRecordQuantity, customerRecordText } from "../src/lib/customer-inbox-state.ts";
import { buildAssistantLedger, assistantRecordMatches } from "../src/lib/assistant-records.ts";
import { customerInboxCopy } from "../src/lib/customer-inbox-copy.ts";
import { readTicketResponse } from "../src/lib/ticket-request-deadline.ts";
import { readDemoDataMetaFromResponse } from "../src/lib/demo-data-mode.ts";

const scope = { tenantScope: "qa-only", demoMode: false };
const ready = { availability: "ready", source: "production" };
const row = (patch = {}) => ({ id: "synthetic-reference", tenant_slug: "qa-only", source: "assistant", status: "closed", message: "Synthetic query", created_at: "2026-09-22T01:00:00.000Z", ...patch });
const ledger = (rows, state = ready, context = scope) => buildAssistantLedger(rows, state, context);

for (const kind of ["leads", "tickets", "orders"]) {
  test(`${kind}: confirmed empty stays zero; invalid entries never become a smaller successful sample`, () => {
    assert.deepEqual(confirmCustomerInbox(kind, [], ready, scope), { ...ready, rows: [] });
    for (const value of [null, [], {}, { id: "x", tenant_slug: "foreign" }, row({ company: {} }), row({ created_at: {} }), row({ status: 1 })]) {
      const result = confirmCustomerInbox(kind, [row(), value], ready, scope);
      assert.equal(result.availability, "invalid_payload"); assert.deepEqual(result.rows, []);
    }
  });
  test(`${kind}: missing BFF provenance, contradictory envelopes and inappropriate demos fail closed`, () => {
    for (const mode of [null, "", "real", "PRODUCTION"]) assert.equal(parseCustomerInboxPayload(kind, [], mode, scope).availability, "invalid_payload");
    for (const payload of [{ ok: false, items: [] }, { items: null }, { items: [], demoMode: true }, { items: [], dataSource: "demo" }]) {
      assert.equal(parseCustomerInboxPayload(kind, payload, "production", scope).availability, "invalid_payload");
    }
    assert.equal(parseCustomerInboxPayload(kind, [], "demo", scope).availability, "invalid_payload");
    assert.equal(parseCustomerInboxPayload(kind, [row()], "demo", { ...scope, demoMode: true }).source, "demo");
    assert.equal(parseCustomerInboxPayload(kind, { items: [row()] }, "production", scope).rows.length, 1);
  });
  for (const availability of ["access_denied", "upstream_error", "unreachable", "invalid_payload"]) {
    test(`${kind}: ${availability} cannot expose stale rows`, () => {
      const value = confirmCustomerInbox(kind, [row()], { availability, source: "unavailable" }, scope);
      assert.equal(value.availability, availability); assert.deepEqual(value.rows, []); assert.equal(value.source, "unavailable");
    });
  }
}

test("only the four exact persisted channels qualify; free text cannot create assistant records", () => {
  const good = ["assistant", "sales_chat_widget", "lead_capture", "realtime_ai"].map((source, i) => row({ id: String(i), source }));
  assert.equal(ledger(good).loadedCount, 4);
  for (const source of [null, undefined, "email", "assistant-sales", "not_assistant", " assistant ", "ASSISTANT"]) {
    assert.equal(ledger([row({ source, notes: "assistant_mode=web_widget; assistant responded", message: "assistant" })]).loadedCount, 0);
  }
});

test("notes, question and prospect status cannot be projected as generated/delivered answers", () => {
  const value = ledger([row({ notes: "assistant_mode=lead_capture", status: "RESPONDIDO", answer: "Untrusted answer", delivered: true })]);
  assert.equal(value.rows[0].notes, "assistant_mode=lead_capture");
  assert.equal(value.rows[0].question, "Synthetic query");
  assert.equal(value.rows[0].status, "RESPONDIDO");
  for (const key of ["answer", "delivered", "responseState", "live", "conversion", "sent"]) assert.equal(Object.hasOwn(value.rows[0], key), false);
});

test("unavailable assistant is not empty and literal unknown statuses remain unknown", () => {
  const denied = ledger([row()], { availability: "access_denied", source: "unavailable" });
  assert.equal(denied.loadedCount, null); assert.deepEqual(denied.rows, []);
  const empty = ledger([]); assert.equal(empty.loadedCount, 0);
  const missing = ledger([row({ status: null, message: null, notes: null, created_at: null, role_interest: null })]).rows[0];
  for (const key of ["status", "question", "notes", "createdAt", "interest"]) assert.equal(missing[key], null);
});

test("tenant changes and mixed/demo rows cannot reuse the previous operational sample", () => {
  assert.equal(ledger([row()], ready, { ...scope, tenantScope: "other" }).loadedCount, null);
  assert.equal(ledger([row({ demoMode: true })]).loadedCount, null);
  assert.equal(ledger([row()], { ...ready, source: "demo" }).loadedCount, null);
  assert.equal(ledger([row()], ready, { ...scope, demoMode: true }).loadedCount, null);
  assert.equal(ledger([row()], { ...ready, source: "demo" }, { ...scope, demoMode: true }).rows[0].source, "demo");
});

test("authorized global view keeps the same reference in different companies distinct", () => {
  const value = ledger([row(), row({ tenant_slug: "other" })], ready, { ...scope, tenantScope: "" });
  assert.equal(value.loadedCount, 2); assert.notEqual(value.rows[0].key, value.rows[1].key);
  assert.equal(ledger([row(), row()]).loadedCount, null);
});

test("bounds, quantities and unknown dates do not fabricate values", () => {
  assert.equal(ledger([row({ notes: "x".repeat(200_001) })]).loadedCount, null);
  assert.equal(ledger([row({ source: "x".repeat(129) })]).loadedCount, null);
  for (const value of [-1, 1.2, Infinity, "0", {}, null, undefined]) assert.equal(customerRecordQuantity(value, "unknown"), "unknown");
  assert.equal(customerRecordQuantity(0, "unknown"), "0");
  for (const value of [null, {}, "not-a-date"]) assert.equal(customerRecordDate(value, "unknown"), "unknown");
  assert.equal(customerRecordDate(row().created_at, "unknown"), "2026-09-22");
  assert.equal(customerRecordText(null, "unknown"), "unknown"); assert.equal(customerRecordText("Closed ", "unknown"), "Closed ");
});

test("query searches only the projected record without mutating the loaded sample", () => {
  const supplied = Object.freeze(row({ contact: "synthetic@example.invalid", notes: "NOTE", role_interest: "raw_interest" }));
  const before = structuredClone(supplied), value = ledger([supplied]);
  for (const query of ["SYNTHETIC", "note", "raw_interest", "@example", "   "]) assert.equal(assistantRecordMatches(value.rows[0], query), true);
  assert.equal(assistantRecordMatches(value.rows[0], "not-recorded"), false);
  assert.deepEqual(supplied, before); assert.equal(value.loadedCount, 1);
});

test("copy is complete and correctly encoded in all three locales", () => {
  for (const copy of Object.values(customerInboxCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(customerInboxCopy.en).sort());
    assert.ok(Object.values(copy).every(text => typeof text === "string" && text.trim()));
    assert.doesNotMatch(JSON.stringify(copy), /Ã|Â|â€|\uFFFD/);
    assert.notEqual(copy.noRecords, copy.access_denied);
  }
  assert.match(customerInboxCopy["es-AR"].search, /señales/);
});

// Execute the actual server loader body with only its external page fetch injected.
const page = await readFile(new URL('../src/app/(app)/leads-tickets/page.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'adminGet');
assert.ok(node);
const compiled = ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const createLoader = fetchAdminPage => new Function('fetchAdminPage','readTicketResponse','readDemoDataMetaFromResponse','parseCustomerInboxPayload','accessDeniedCollection', compiled + ';return adminGet;')(
  fetchAdminPage, readTicketResponse, readDemoDataMetaFromResponse, parseCustomerInboxPayload,
  () => ({ rows: [], availability: 'access_denied', source: 'unavailable' }));
const response = (payload, mode = 'production', status = 200) => Response.json(payload, { status, headers: mode ? { 'x-nexid-data-mode': mode } : {} });

test("actual server loader preserves scope and private/no-redirect fetch policy", async () => {
  let called;
  const load = createLoader(async (...args) => { called = args; return response([row()]); });
  const context = { tenantSlug: 'qa-only' };
  assert.equal((await load(context, '/admin/leads', false)).rows.length, 1);
  assert.equal(called[0], context); assert.equal(called[1], '/admin/leads');
  assert.equal(called[2].cache, 'no-store'); assert.equal(called[2].redirect, 'error');
  assert.ok(called[2].signal instanceof AbortSignal);
});

test("actual server loader rejects foreign or malformed lists before they reach client props", async () => {
  for (const rows of [[row({ tenant_slug: 'foreign' })], [row(), null], [row({ created_at: {} })]]) {
    const load = createLoader(async () => response(rows));
    assert.equal((await load({ tenantSlug: 'qa-only' }, '/admin/leads', false)).availability, 'invalid_payload');
  }
  const load = createLoader(async () => response([], null));
  assert.equal((await load({ tenantSlug: 'qa-only' }, '/admin/tickets', false)).availability, 'invalid_payload');
});

for (const [http, availability] of [[401, 'access_denied'], [403, 'access_denied'], [500, 'upstream_error']]) {
  test(`actual server loader classifies HTTP ${http} without leaking or inferring empty data`, async () => {
    const load = createLoader(async () => response({ private: 'not-a-record' }, 'production', http));
    assert.deepEqual(await load({ tenantSlug: 'qa-only' }, '/admin/leads', false), { rows: [], availability, source: 'unavailable' });
  });
}

for (const stall of ['headers', 'body']) {
  test(`actual server loader settles a stalled ${stall} independently of transport cooperation`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const never = new Promise(() => {});
    const value = response([row()]); value.json = () => never;
    const load = createLoader(() => stall === 'headers' ? never : Promise.resolve(value));
    let result; const pending = load({ tenantSlug: 'qa-only' }, '/admin/leads', false).then(value => { result = value; });
    await turn(); t.mock.timers.tick(15_000); await turn();
    assert.equal(result?.availability, 'unreachable'); assert.deepEqual(result?.rows, []); await pending;
  });
}
