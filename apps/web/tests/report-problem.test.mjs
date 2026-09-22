import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url), styles = new Proxy({}, { get: (_, key) => key });
function load(file, bindings = {}) {
  const source = readFileSync(new URL(`../src/app/sun/${file}`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", js)(name => name in bindings ? bindings[name] : require(name), module, module.exports);
  return module.exports;
}
const model = load("report-problem-model.ts"), copy = load("report-problem-copy.ts");
const { reportContextAvailable, validateReportDraft, reportProblemOutcome, createReportProblemRunner, readReportProblemResponse } = model;
const context = { bid: "LOT-API", eventId: "9007199254740993", supportToken: "support.fixture.secret" };
const draft = { category: "tap_review", description: "La lectura mostró un aviso.\nEl envase sigue cerrado.", contact: "" };
const requestId = "13123123-1234-4234-8234-123456789012", nextId = "23123123-1234-4234-8234-123456789012";
const ticketId = "43123123-1234-4234-8234-123456789012";
const receipt = { ok: true, ticket_created: true, outcome: "ticket_created", eventId: context.eventId, bid: context.bid,
  ticket: { id: ticketId, status: "open", tenant_assigned: true, created_at: "2026-09-21T18:00:00Z" } };
const expected = { bid: context.bid, event_id: context.eventId };

test("report context requires a real event, batch and support credential and excludes demo", () => {
  assert.equal(reportContextAvailable(context), true);
  for (const patch of [{ bid: "" }, { bid: "x\nforeign" }, { bid: "x".repeat(201) }, { eventId: "0" }, { eventId: "0715" },
    { eventId: "9223372036854775808" }, { eventId: "private-uid" }, { supportToken: "" }, { supportToken: "with spaces" },
    { supportToken: "x".repeat(4097) }, { isDemoPreview: true }]) assert.equal(reportContextAvailable({ ...context, ...patch }), false);
});

test("draft validation preserves meaningful multiline details and bounds optional contact", () => {
  assert.deepEqual(validateReportDraft({ ...draft, description: "  detalle\r\nsegunda línea  ", contact: " mail@example.test " }), {
    fields: { category: "tap_review", description: "detalle\nsegunda línea", contact: "mail@example.test" }, errors: {},
  });
  for (const category of model.REPORT_CATEGORIES) assert.ok(validateReportDraft({ ...draft, category }).fields);
  assert.equal(validateReportDraft({ ...draft, description: "x".repeat(1500), contact: "x".repeat(320) }).fields.description.length, 1500);
  for (const [patch, field, error] of [[{ description: "  " }, "description", "required"], [{ description: "x".repeat(1501) }, "description", "too_long"],
    [{ description: "bad\u0000text" }, "description", "invalid"], [{ contact: "x".repeat(321) }, "contact", "too_long"],
    [{ contact: "mail\nother" }, "contact", "invalid"], [{ category: "claim" }, "category", "invalid"]]) {
    const result = validateReportDraft({ ...draft, ...patch });
    assert.equal(result.fields, null);
    assert.equal(result.errors[field], error);
  }
});

test("only a scoped persisted ticket receipt confirms success", () => {
  const result = reportProblemOutcome(201, receipt, expected);
  assert.deepEqual(result, { kind: "received", ticket: { id: ticketId, status: "open", createdAt: "2026-09-21T18:00:00.000Z" }, existing: false });
  for (const patch of [{ ok: false }, { ticket_created: false }, { outcome: "sent" }, { eventId: "715" }, { bid: "OTHER" },
    { ticket: { ...receipt.ticket, id: "not-uuid" } }, { ticket: { ...receipt.ticket, id: "00000000-0000-0000-0000-000000000000" } },
    { ticket: { ...receipt.ticket, tenant_assigned: "true" } }, { ticket: { ...receipt.ticket, status: "assigned_to_person" } },
    { ticket: { ...receipt.ticket, created_at: "2026-02-30T12:00:00Z" } }, { ticket: { ...receipt.ticket, created_at: null } }]) {
    assert.equal(reportProblemOutcome(200, { ...receipt, ...patch }, expected).kind, "uncertain");
  }
  assert.equal(reportProblemOutcome(503, receipt, expected).kind, "unavailable");
  assert.equal(reportProblemOutcome(200, { ok: true }, expected).kind, "uncertain");
});

test("an existing ticket may remain open, pending or closed without being reopened", () => {
  for (const status of ["open", "pending", "closed"]) {
    const result = reportProblemOutcome(200, { ...receipt, outcome: "ticket_existing", ticket: { ...receipt.ticket, status } }, expected);
    assert.equal(result.kind, "received");
    assert.equal(result.ticket.status, status);
    assert.equal(result.existing, true);
  }
});

test("HTTP error classes remain distinct and do not turn generic delivery into a receipt", () => {
  for (const [status, kind] of [[403, "expired"], [429, "rate_limited"], [503, "unavailable"], [409, "conflict"], [400, "invalid"], [422, "invalid"], [500, "uncertain"], [200, "uncertain"]]) {
    assert.equal(reportProblemOutcome(status, { ok: true, delivered: true }, expected).kind, kind);
  }
});

test("prepare is side-effect free and an explicit confirmation sends only the reviewed payload", async () => {
  const requests = [];
  const runner = createReportProblemRunner(async body => { requests.push(body); return { status: 201, payload: receipt }; }, () => requestId);
  assert.equal(await runner.submit(context), null);
  assert.equal(requests.length, 0);
  assert.equal(runner.prepare(context, draft, "es-AR").ok, true);
  assert.equal(requests.length, 0);
  assert.equal((await runner.submit(context)).kind, "received");
  assert.deepEqual(requests[0], { ...draft, bid: context.bid, event_id: context.eventId, support_token: context.supportToken, request_id: requestId, locale: "es-AR" });
  assert.equal(await runner.submit(context), null);
  assert.equal(requests.length, 1);
  assert.equal(runner.prepare(context, { ...draft, description: "different" }, "es-AR").ok, false);
});

test("a double confirmation cannot create parallel requests", async () => {
  let resolve, count = 0;
  const runner = createReportProblemRunner(() => { count++; return new Promise(done => { resolve = done; }); }, () => requestId);
  runner.prepare(context, draft, "es-AR");
  const first = runner.submit(context);
  assert.equal(await runner.submit(context), null);
  assert.equal(count, 1);
  assert.equal(runner.prepare(context, draft, "es-AR").reason, "resolve_attempt");
  resolve({ status: 201, payload: receipt });
  assert.equal((await first).kind, "received");
});

test("an uncertain retry preserves its request id and every detail including the original locale", async () => {
  const requests = [];
  const runner = createReportProblemRunner(async body => {
    requests.push(body);
    if (requests.length === 1) throw new Error("network timeout");
    return { status: 200, payload: { ...receipt, outcome: "ticket_existing" } };
  }, () => requestId);
  runner.prepare(context, draft, "pt-BR");
  assert.equal((await runner.submit(context)).kind, "uncertain");
  assert.equal(runner.prepare(context, { ...draft, description: "changed" }, "pt-BR").reason, "resolve_attempt");
  assert.equal(runner.prepare(context, draft, "en").reason, "resolve_attempt");
  assert.equal((await runner.submit(context)).kind, "received");
  assert.deepEqual(requests[1], requests[0]);
  assert.equal(runner.current().unresolved, false);
});

test("later expiry cannot erase an earlier uncertain result or permit a second attempt id", async () => {
  const requests = [];
  let ids = 0;
  const runner = createReportProblemRunner(async body => {
    requests.push(body);
    if (requests.length === 1) throw new Error("lost response");
    return requests.length === 2 ? { status: 403, payload: {} } : { status: 200, payload: { ...receipt, outcome: "ticket_existing" } };
  }, () => { ids++; return requestId; });
  runner.prepare(context, draft, "es-AR");
  await runner.submit(context);
  assert.equal((await runner.submit(context)).kind, "expired");
  assert.equal(runner.current().unresolved, true);
  assert.equal(runner.prepare(context, { ...draft, contact: "other@example.test" }, "es-AR").reason, "resolve_attempt");
  assert.equal((await runner.submit({ ...context, supportToken: "renewed.support.token" })).kind, "received");
  assert.equal(ids, 1);
  assert.equal(requests[2].request_id, requestId);
  assert.equal(requests[2].contact, draft.contact);
  assert.equal(requests[2].support_token, "renewed.support.token");
});

test("a conflict requires a new explicit review before issuing a new request id", async () => {
  const requests = [];
  let ids = 0;
  const runner = createReportProblemRunner(async body => { requests.push(body); return { status: 409, payload: { reason: "report_request_conflict" } }; }, () => ids++ ? nextId : requestId);
  runner.prepare(context, draft, "es-AR");
  assert.equal((await runner.submit(context)).kind, "conflict");
  assert.equal(await runner.submit(context), null);
  assert.equal(requests.length, 1);
  assert.equal(runner.prepare(context, draft, "es-AR").attempt.request_id, nextId);
  assert.equal(requests.length, 1);
});

test("rate limits and unavailable service keep the exact pending report instead of clearing details", async () => {
  for (const status of [429, 503]) {
    const runner = createReportProblemRunner(async () => ({ status, payload: {} }), () => requestId);
    runner.prepare(context, { ...draft, contact: "mail@example.test" }, "en");
    await runner.submit(context);
    assert.equal(runner.current().attempt.contact, "mail@example.test");
    assert.equal(runner.current().attempt.description, draft.description);
    assert.equal(runner.prepare(context, { ...draft, description: "other" }, "en").reason, "resolve_attempt");
  }
});

test("invalid scope, failed UUID generation and a different event never invoke transport", async () => {
  const runner = createReportProblemRunner(() => assert.fail("no request"), () => requestId);
  assert.equal(runner.prepare({ ...context, isDemoPreview: true }, draft, "es-AR").reason, "context_unavailable");
  assert.equal(runner.prepare({ ...context, supportToken: "" }, draft, "es-AR").ok, false);
  runner.prepare(context, draft, "es-AR");
  assert.equal((await runner.submit({ ...context, eventId: "716" })).kind, "context_unavailable");
  assert.equal((await runner.submit({ ...context, bid: "foreign" })).kind, "context_unavailable");
  for (const factory of [() => { throw Error("unavailable"); }, () => "unsafe-id"]) {
    assert.equal(createReportProblemRunner(() => assert.fail("no request"), factory).prepare(context, draft, "es-AR").reason, "request_id_unavailable");
  }
});

test("receipt JSON is bounded by bytes and rejects malformed responses", async () => {
  assert.deepEqual(await readReportProblemResponse(Response.json(receipt)), receipt);
  await assert.rejects(readReportProblemResponse(new Response("{")));
  await assert.rejects(readReportProblemResponse(new Response(JSON.stringify({ padding: "é".repeat(9000) }))), /report_response_too_large/);
});

function markup(props = {}, locale = "es-AR") {
  const component = load("report-problem-form.tsx", {
    "./report-problem-model": model, "./report-problem-copy": copy,
    "./sun-locale-provider": { useSunLocale: () => ({ locale }) },
    "./report-problem-form.module.css": { __esModule: true, default: styles },
  }).ReportProblemForm;
  return renderToStaticMarkup(React.createElement(component, { ...context, productName: "Producto API", locale, ...props }));
}

test("form starts collapsed with accessible labels and no capability in its DOM", () => {
  const html = markup();
  assert.match(html, /id="report-problem"/);
  assert.match(html, /data-report-step="description"/);
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:\s|=|>)/);
  assert.match(html, /data-report-ready="false"/);
  assert.match(html, /for="report-description"/);
  assert.match(html, /id="report-description"[^>]*maxLength="1500"[^>]*required=""/i);
  assert.match(html, /id="report-contact"[^>]*maxLength="320"/i);
  assert.match(html, /No se solicita tu ubicación/);
  assert.doesNotMatch(html, /support\.fixture\.secret|name="support_token"|request_id/);
});

test("demo and missing credential explain availability without showing an active form", () => {
  assert.match(markup({ isDemoPreview: true }), /ficha es de muestra/);
  assert.match(markup({ supportToken: "" }), /No hay un acceso válido/);
  for (const props of [{ isDemoPreview: true }, { supportToken: "" }, { eventId: "invalid" }]) assert.doesNotMatch(markup(props), /<form|<textarea|type="submit"/);
});

test("all interface locales supply real copy while user content is excluded from global translation", () => {
  for (const [locale, title, confirm] of [["es-AR", "Reportar un problema", "Confirmar reporte"], ["en", "Report a problem", "Confirm report"], ["pt-BR", "Relatar um problema", "Confirmar relato"]]) {
    assert.ok(markup({}, locale).includes(title));
    assert.equal(copy.reportProblemCopy[locale].confirm, confirm);
    assert.notEqual(copy.reportProblemCopy[locale].open, copy.reportProblemCopy[locale].closed);
    assert.match(markup({}, locale), /data-sun-server-evidence="true"/);
  }
});

test("expired access warns that text only remains on this screen and earlier receipt can be uncertain", () => {
  assert.match(copy.reportProblemCopy["es-AR"].errors.expired, /copialo antes de volver a abrir/);
  assert.match(copy.reportProblemCopy.en.errors.expired, /copy it before reopening/);
  assert.match(copy.reportProblemCopy["pt-BR"].errors.expired, /copie-o antes de reabrir/);
  for (const locale of ["es-AR", "en", "pt-BR"]) assert.ok(copy.reportProblemCopy[locale].earlierUncertain);
});

test("form only reveals on the hash and does not store data, request geolocation or submit in effects", () => {
  const source = readFileSync(new URL("../src/app/sun/report-problem-form.tsx", import.meta.url), "utf8");
  assert.match(source, /window\.location\.hash !== "#report-problem"/);
  assert.match(source, /reveal\(\);[\s\S]*addEventListener\("hashchange", reveal\)/);
  assert.match(source, /const requestLock = useRef\(false\)/);
  assert.match(source, /requestLock\.current = true/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|geolocation|URLSearchParams|sendBeacon|dangerouslySetInnerHTML/);
  const effects = source.slice(source.indexOf("useEffect(() =>"), source.indexOf("const errorText"));
  assert.doesNotMatch(effects, /fetch\(|submit\(|confirm\(/);
});
