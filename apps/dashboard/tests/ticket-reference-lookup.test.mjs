import assert from "node:assert/strict";
import test from "node:test";
import { canonicalTicketReference, parseTicketLookupResponse, createTicketLookupRunner } from "../src/lib/ticket-reference-lookup.ts";
import { ticketLookupCopy } from "../src/lib/ticket-reference-lookup-copy.ts";
import { requiredPermissionForAdminResource, dashboardHighImpactPermissionMatches } from "../src/lib/permission-policy.ts";
import { canReadonlyDemoAccess } from "../src/lib/admin-proxy-policy.ts";

const ID = "81000000-0000-8000-8000-000000000009", OTHER = "81000000-0000-8000-8000-000000000010";
const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const payload = (id = ID) => ({
  ok: true, protocol: "nexid.support-ticket-lookup.v1",
  scope: { mode: "tenant", tenantId: TENANT_ID, tenantSlug: "qa-only" },
  ticket: { id, title: "Reporte antiguo", detail: "Texto literal <script>", detail_state: "available", status: "pending", contact: null,
    created_at: "2026-01-01T12:00:00.000Z", bid: "HISTORIC-LOT", tap_event_id: "715", source: "sun_public_report", category: "other", locale: "es-AR",
    tenant_id: TENANT_ID, tenant_slug: "qa-only", tenant_name: "Organización de prueba", uid_hex: "must-not-project" },
});
const parsed = (value = payload(), status = 200, tenant = "qa-only", mode = "production") => parseTicketLookupResponse(status, value, ID, tenant, mode);
const response = (body = payload(), status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-nexid-data-mode": "production" } });

test("canonical UUID v1 to v8 accepts case and padding, rejects partial/path/query payloads", () => {
  assert.equal(canonicalTicketReference(` ${ID.toUpperCase()} `), ID);
  for (const version of "12345678") assert.ok(canonicalTicketReference(ID.slice(0, 14) + version + ID.slice(15)));
  for (const value of [null, {}, "", ID.slice(1), ID + "/", ID + "?tenant=evil", ID.replace("-8000-8000", "-9000-8000")]) assert.equal(canonicalTicketReference(value), null);
});

test("found requires exact protocol, UUID and selected tenant from authoritative scope and row", () => {
  const found = parsed();
  assert.equal(found.status, "found");
  assert.equal(found.ticket.id, ID);
  assert.equal(found.ticket.uid_hex, undefined);
  for (const mutate of [
    value => { value.protocol = "unknown"; }, value => { value.ticket.id = OTHER; },
    value => { value.scope.tenantSlug = "other-tenant"; }, value => { value.scope.tenantId = "other-tenant-id"; },
    value => { value.ticket.tenant_slug = "other-tenant"; }, value => { value.ticket.tenant_id = "other-id"; },
    value => { value.scope = { mode: "global", tenantId: null, tenantSlug: null }; },
  ]) { const value = payload(); mutate(value); assert.equal(parsed(value).status, "unconfirmed"); }
});

test("global results require explicitly global scope; historical missing assignments remain missing", () => {
  const value = payload(); value.scope = { mode: "global", tenantId: null, tenantSlug: null };
  value.ticket.tenant_id = null; value.ticket.tenant_slug = null; value.ticket.tenant_name = null;
  assert.equal(parsed(value, 200, "").status, "found");
  assert.equal(parsed(payload(), 200, "").status, "unconfirmed");
});

test("authorization, authoritative absence and unconfirmed failures are distinct and preserve reference", () => {
  for (const status of [401, 403]) assert.deepEqual(parsed(null, status), { status: "forbidden", reference: ID });
  assert.equal(parsed({ ok: false, reason: "ticket_not_found" }, 404).status, "not_found");
  for (const [status, body] of [[404, null], [200, {}], [503, { ok: false }], [500, payload()]]) {
    assert.deepEqual(parsed(body, status), { status: "unconfirmed", reference: ID });
  }
  for (const mode of [null, "demo", "unavailable"]) assert.equal(parsed(payload(), 200, "qa-only", mode).status, "unconfirmed");
  assert.equal(parsed({ ...payload(), demoMode: true }).status, "unconfirmed");
});

test("legacy status and blank title are preserved without promoting them to open", () => {
  const value = payload(); value.ticket.status = "awaiting_supplier"; value.ticket.title = "  ";
  const result = parsed(value);
  assert.equal(result.status, "found"); assert.equal(result.ticket.status, "awaiting_supplier"); assert.equal(result.ticket.title, "  ");
});

test("known unavailable detail differs from not recorded and contradictory contracts fail closed", () => {
  for (const state of ["unavailable", "not_recorded"]) {
    const value = payload(); value.ticket.detail = null; value.ticket.detail_state = state;
    assert.equal(parsed(value).status, "found");
    value.ticket.detail = "Cannot conceal conflicting details"; assert.equal(parsed(value).status, "unconfirmed");
  }
  for (const mutate of [value => { value.ticket.detail_state = "other"; }, value => { value.ticket.detail = ""; }, value => { value.ticket.status = 1; }, value => { value.ticket.created_at = "bad"; }, value => { value.ticket.tap_event_id = 9007199254740992; }]) {
    const value = payload(); mutate(value); assert.equal(parsed(value).status, "unconfirmed");
  }
});

test("runner makes only an explicit credentialed no-store GET with canonical reference and selected tenant", async () => {
  const calls = [];
  const runner = createTicketLookupRunner(async (url, options) => { calls.push({ url, options }); return response(); });
  assert.equal(calls.length, 0);
  assert.equal((await runner.search("bad", "qa-only")).status, "invalid"); assert.equal(calls.length, 0);
  assert.equal((await runner.search(ID.toUpperCase(), "qa-only")).status, "found");
  assert.equal(calls[0].url, `/api/admin/tickets/${ID}?tenant=qa-only`);
  assert.equal(calls[0].options.method, "GET"); assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.cache, "no-store"); assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.body, undefined);
});

test("new lookup rejects late old responses even when transport ignores abort", async () => {
  const pending = [];
  const runner = createTicketLookupRunner((url, options) => new Promise(resolve => pending.push({ resolve, options })));
  const first = runner.search(ID, "qa-only"), second = runner.search(OTHER, "qa-only");
  assert.equal(pending[0].options.signal.aborted, true);
  pending[1].resolve(response(payload(OTHER))); assert.equal((await second).reference, OTHER);
  pending[0].resolve(response()); assert.equal(await first, null);
});

test("cancel and tenant-context reset discard an in-flight result; network and malformed JSON allow retry", async () => {
  let complete;
  const runner = createTicketLookupRunner(() => new Promise(resolve => { complete = resolve; }));
  const attempt = runner.search(ID, "qa-only"); runner.cancel(); complete(response()); assert.equal(await attempt, null);
  let count = 0;
  const retry = createTicketLookupRunner(async () => { count += 1; if (count === 1) throw Error("synthetic network failure"); return count === 2 ? new Response("<html>bad</html>") : response(); });
  assert.deepEqual(await retry.search(ID, "qa-only"), { status: "unconfirmed", reference: ID });
  assert.equal((await retry.search(ID, "qa-only")).status, "unconfirmed");
  assert.equal((await retry.search(ID, "qa-only")).status, "found");
});

test("lookup preserves existing high-impact permission denies and cannot read real tickets in demo", () => {
  assert.equal(requiredPermissionForAdminResource("GET", `tickets/${ID}`), "leads.manage");
  assert.equal(dashboardHighImpactPermissionMatches("tenant-admin", ["leads.manage"], "leads.manage", []), true);
  assert.equal(dashboardHighImpactPermissionMatches("tenant-admin", ["leads.manage"], "leads.manage", ["leads.manage"]), false);
  assert.equal(dashboardHighImpactPermissionMatches("viewer", ["leads.manage"], "leads.manage", []), false);
  assert.equal(canReadonlyDemoAccess("GET", `tickets/${ID}`), false);
});

test("Spanish, English and Portuguese carry all lookup states and do not translate customer data", () => {
  const keys = Object.keys(ticketLookupCopy["es-AR"]).sort();
  for (const copy of Object.values(ticketLookupCopy)) { assert.deepEqual(Object.keys(copy).sort(), keys); assert.ok(Object.values(copy).every(text => text.trim())); assert.notEqual(copy.detailUnavailable, copy.detailMissing); }
  assert.equal(ticketLookupCopy.en.search, "Find ticket"); assert.equal(ticketLookupCopy["pt-BR"].label, "Referência completa do ticket");
});
