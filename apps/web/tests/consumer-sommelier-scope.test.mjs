import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { consumerSommelierAvailability, consumerSommelierEventId, consumerSommelierScope } from "../src/app/me/sommelier/consumer-sommelier-scope.ts";
import { requestManagedSommelierAnswer, sommelierHistory } from "../src/lib/managed-sommelier.ts";

const reading = { ok: true, item: { tap_event_id: "715", tenant_slug: "brand-a", tenant_name: "Marca A", product_name: "Vino de mi cuenta", brand_name: "Marca A", verdict: "OPENED", risk_level: "low" } };
const configuration = { version: "nexid.tenant-actions.v1", status: "published", tenantSlug: "brand-a", allowedActions: ["sommelier"], catalogAvailable: false, program: null, trivia: null };
const live = { ok: true, version: "nexid.sommelier.v1", answer: "Respuesta sintética sin datos de producto", source: "live", fallback: false, provider: "synthetic", model: "fixture", demo: false, contextSource: "published_editorial", sources: [{ id: "product", label: "Producto publicado", url: null }], suggestedQuestions: ["¿Para qué ocasión lo elegís?"] };

test("the portal opens general guidance without manufacturing a product identity", () => {
  assert.deepEqual(consumerSommelierScope(false, null, null, null), { state: "ready", productName: "", brandName: "" });
  for (const id of ["0", "01", "-1", "715.0", "9007199254740992", "9223372036854775807", ["715"], 715, null]) {
    assert.equal(consumerSommelierEventId(id), null);
    assert.deepEqual(consumerSommelierScope(true, consumerSommelierEventId(id), reading, configuration), { state: "unavailable" });
  }
});

test("a product action uses only the exact brand's current published assistant permission", () => {
  assert.equal(consumerSommelierAvailability(configuration, "brand-a"), "available");
  for (const changed of [{ ...configuration, allowedActions: ["feedback"] }, { ...configuration, status: "unpublished" }]) assert.equal(consumerSommelierAvailability(changed, "brand-a"), "unpublished");
  for (const changed of [null, { ...configuration, tenantSlug: "brand-b" }, { ...configuration, status: "unavailable" }, { ...configuration, allowedActions: ["invented"] }]) assert.equal(consumerSommelierAvailability(changed, "brand-a"), "unavailable");
  assert.equal(consumerSommelierAvailability(configuration, "injected/tenant"), "unavailable");
});

test("context requires this account's exact reading and that brand's published opt-in", () => {
  assert.equal(consumerSommelierEventId("715"), "715");
  assert.deepEqual(consumerSommelierScope(true, "715", reading, configuration), { state: "ready", eventId: "715", productName: "Vino de mi cuenta", brandName: "Marca A" });
  for (const payload of [null, { ok: false, item: reading.item }, { ok: true, item: { ...reading.item, tap_event_id: "716" } }, { ok: true, item: { ...reading.item, tenant_slug: null } }]) {
    assert.deepEqual(consumerSommelierScope(true, "715", payload, configuration), { state: "unavailable" });
  }
  for (const settings of [null, { ...configuration, tenantSlug: "brand-b" }, { ...configuration, status: "unavailable" }, { ...configuration, allowedActions: ["invented"] }, { ...configuration, version: "future-version" }]) {
    assert.deepEqual(consumerSommelierScope(true, "715", reading, settings), { state: "unavailable" });
  }
  for (const settings of [{ ...configuration, status: "unpublished" }, { ...configuration, allowedActions: [] }]) {
    assert.deepEqual(consumerSommelierScope(true, "715", reading, settings), { state: "unpublished" });
  }
});

test("a portal question reuses the authenticated consumer API without demo or client facts", async () => {
  const calls = [];
  const history = sommelierHistory([{ sender: "user", text: "Para un regalo" }, { sender: "sommelier", text: "¿Qué le gusta?", provenance: { mode: "live" } }]);
  const result = await requestManagedSommelierAnswer("Algo suave", { locale: "es-AR", history, eventId: "715", fetchImpl: async (path, init) => {
    calls.push({ path, init, body: JSON.parse(init.body) }); return Response.json(live);
  } });
  assert.equal(result.status, "received");
  assert.equal(result.data.fallback, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/sommelier/chat");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.equal(calls[0].init.cache, "no-store");
  assert.deepEqual(calls[0].body, { mode: "consumer", question: "Algo suave", locale: "es-AR", history, eventId: "715" });
});

test("withdrawn brand permission or an expired session never retries as general or demo", async () => {
  for (const status of [401, 403, 429, 503]) {
    const calls = [];
    const result = await requestManagedSommelierAnswer("Consulta que se conserva", { locale: "es-AR", eventId: "715", fetchImpl: async (path, init) => {
      calls.push({ path, body: JSON.parse(init.body) }); return Response.json({ ok: false, reason: "sommelier_event_not_authorized" }, { status });
    } });
    assert.deepEqual(result, { status: "unavailable", reason: "http-error", httpStatus: status, serviceReason: "sommelier_event_not_authorized" });
    assert.deepEqual(calls, [{ path: "/api/sommelier/chat", body: { mode: "consumer", question: "Consulta que se conserva", locale: "es-AR", history: [], eventId: "715" } }]);
  }
});

function loadPage({ session = "ready", payload = reading, settings = configuration } = {}) {
  const calls = [], props = [], require = createRequire(import.meta.url);
  const source = readFileSync(new URL("../src/app/me/sommelier/page.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const overrides = {
    "../_components/consumer-api": {
      buildConsumerNextPath: (path, params) => { const query = new URLSearchParams(); for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) query.append(key, item); return query.size ? path + "?" + query : path; },
      readConsumerSession: async next => { calls.push(["session", next]); if (session === "denied") throw Error("synthetic_login_redirect"); return { status: session }; },
      fetchConsumerPath: async path => { calls.push(["private", path]); return payload; },
    },
    "../_components/consumer-portal-recovery": { ConsumerPortalUnavailable: () => React.createElement("p", null, "Sesión no confirmada") },
    "../_components/portal-shell": { PortalShell: ({ children }) => React.createElement("main", null, children) },
    "./sommelier-client": { __esModule: true, default: value => { props.push(value); return React.createElement("div", { "data-event": value.eventId || "general" }, value.productName); } },
    "../../../lib/public-tenant-configuration": { readPublicTenantConfiguration: async event => { calls.push(["configuration", event]); return settings; } },
    "./consumer-sommelier-scope": { consumerSommelierEventId, consumerSommelierScope },
    "./sommelier.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) },
    "next/link": { __esModule: true, default: ({ children, prefetch, ...attributes }) => React.createElement("a", attributes, children) },
  };
  const loaded = { exports: {} }; new Function("require", "module", "exports", compiled)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), loaded, loaded.exports);
  return { page: loaded.exports.default, calls, props };
}

test("the actual page authenticates before reading any private product or company configuration", async () => {
  const unavailable = loadPage({ session: "unavailable" });
  const html = renderToStaticMarkup(await unavailable.page({ searchParams: Promise.resolve({ eventId: "715" }) }));
  assert.match(html, /Sesión no confirmada/); assert.deepEqual(unavailable.calls, [["session", "/me/sommelier?eventId=715"]]); assert.equal(unavailable.props.length, 0);
  const denied = loadPage({ session: "denied" }); await assert.rejects(() => denied.page({ searchParams: Promise.resolve({ eventId: "715" }) }), /synthetic_login_redirect/); assert.equal(denied.calls.length, 1);
});

test("the actual general page ignores caller product/brand facts and never looks up a company", async () => {
  const fixture = loadPage(); renderToStaticMarkup(await fixture.page({ searchParams: Promise.resolve({ product: "Injected wine", brand: "Injected brand" }) }));
  assert.equal(fixture.calls.length, 1); assert.deepEqual(fixture.props, [{ productName: "", brandName: "", eventId: undefined }]);
});

test("the actual contextual page passes only the current account's privately read identity", async () => {
  const fixture = loadPage(); const html = renderToStaticMarkup(await fixture.page({ searchParams: Promise.resolve({ eventId: "715", product: "Injected wine", brand: "Injected brand" }) }));
  assert.deepEqual(fixture.calls.slice(1), [["private", "taps/715"], ["configuration", "715"]]);
  assert.deepEqual(fixture.props, [{ productName: "Vino de mi cuenta", brandName: "Marca A", eventId: "715" }]);
  assert.doesNotMatch(html, /Injected/);
});

test("invalid, foreign, unpublished or unavailable context does not mount a generic assistant", async () => {
  for (const values of [{ eventId: "01" }, { eventId: ["715", "716"] }, { eventId: "715", payload: null }, { eventId: "715", settings: { ...configuration, tenantSlug: "brand-b" } }, { eventId: "715", settings: { ...configuration, allowedActions: [] } }]) {
    const fixture = loadPage(values); const html = renderToStaticMarkup(await fixture.page({ searchParams: Promise.resolve({ eventId: values.eventId }) }));
    assert.equal(fixture.props.length, 0); assert.match(html, /El asistente de este producto no está disponible/);
    assert.match(html, /Volver a mis productos/);
    if (!consumerSommelierEventId(values.eventId)) assert.equal(fixture.calls.length, 1);
  }
});
