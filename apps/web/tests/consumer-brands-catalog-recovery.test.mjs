import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as lists from "../src/app/me/_components/consumer-list-availability.ts";
import * as engagement from "../src/app/me/_components/consumer-portal-model.ts";
import * as availability from "../src/app/sun/tenant-action-availability.ts";

const require = createRequire(import.meta.url);
const dir = new URL("../src/app/me/", import.meta.url);
const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
function compile(path, overrides) {
  const source = readFileSync(new URL(path, dir), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", js)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), loaded, loaded.exports);
  return loaded.exports;
}
const api = compile("_components/consumer-api.ts", {
  "next/headers": { headers: () => { throw new Error("Unexpected network read"); } },
  "next/navigation": { redirect: () => { throw new Error("Unexpected redirect"); } },
  "../../api/_lib/consumer-tap-handoff": {}, "./consumer-bounded-fetch": {},
});
const list = (items = []) => ({ ok: true, items });
const brand = { tenant_id: "tenant-id", slug: "brand-qa", name: "Marca sintética QA", status: "active", points_balance: 540 };
const product = { id: "product-qa", tenant_slug: "brand-qa", product_name: "Producto sintético guardado", ownership_status: "claimed" };
const tap = { tap_event_id: "715", tenant_slug: "brand-qa", verdict: "VALID", created_at: "2026-01-01T00:00:00Z" };
const item = { id: "catalog-qa", tenant_slug: "brand-qa", title: "Propuesta sintética QA", stock_status: "active", request_to_buy_enabled: true, age_gate_required: true, cash_price: 0, points_price: 0 };
const configuration = { version: availability.TENANT_ACTIONS_VERSION, status: "published", allowedActions: ["marketplace"], program: null, trivia: null, catalogAvailable: true, tenantSlug: "brand-qa" };

function setup(destination, options = {}) {
  const calls = [], grids = [];
  const Page = compile(`${destination}/page.tsx`, {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "../_components/consumer-api": {
      buildConsumerNextPath: api.buildConsumerNextPath,
      readConsumerSession: async next => { calls.push(["session", next]); if (options.denied) throw new Error("redirect-login"); return { status: options.session || "ready" }; },
      fetchConsumerPath: async path => { calls.push(["private", path]); return Object.hasOwn(options, path) ? options[path] : list(path === "brands" ? [brand] : []); },
      fetchMarketplacePath: async path => { calls.push(["catalog", path]); return Object.hasOwn(options, "catalog") ? options.catalog : list([item]); },
    },
    "../_components/consumer-list-availability": lists,
    "../_components/consumer-portal-model": engagement,
    "../_components/portal-shell": { PortalShell: ({ children }) => React.createElement("main", null, children) },
    "../_components/consumer-portal-recovery": { ConsumerPortalUnavailable: () => React.createElement("h1", { "data-testid": "consumer-portal-unavailable" }, "Sesión no disponible") },
    "../_components/me-portal-interactive-client": { ConsumerDataRetryButton: () => React.createElement("button", { type: "button" }, "Reintentar carga") },
    "../_components/consumer-list-recovery.module.css": css,
    "./brands-voting-client": { BrandsVotingClient: () => React.createElement("div", { "data-testid": "voting" }) },
    "./marketplace.module.css": css,
    "./marketplace-grid-client": { MarketplaceGridClient: props => { grids.push(props); return React.createElement("div", { "data-testid": "catalog-grid" }, props.items.map(entry => entry.title).join(", ")); } },
    "../../../lib/public-tenant-configuration": { configurationEventId: value => typeof value === "string" && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value)), readPublicTenantConfiguration: async id => { calls.push(["public-configuration", id]); return Object.hasOwn(options, "configuration") ? options.configuration : configuration; } },
    "../../sun/tenant-action-availability": availability,
  }).default;
  return { calls, grids, render: async (params = {}) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) })) };
}

test("only an explicit successful items envelope establishes an empty source", () => {
  assert.deepEqual(lists.readConsumerListSource(list()), { status: "ready", data: [] });
  for (const value of [null, undefined, {}, [], { ok: false, items: [] }, { items: [] }, { ok: true }, { ok: true, other: [] }, { ok: true, items: null }, list([null]), list([[]]), list(["bad"])]) {
    assert.deepEqual(lists.readConsumerListSource(value), { status: "unavailable", data: null });
  }
});
test("endpoint identities reject malformed rows while preserving raw identities, zeroes and inquiry flags", () => {
  for (const [guard, valid, invalid] of [
    [lists.hasConsumerBrandIdentity, brand, [{}]],
    [lists.hasConsumerProductIdentity, product, [{ tenant_slug: "brand-qa" }, { id: "product-qa" }]],
    [lists.hasConsumerTapIdentity, tap, [{ tenant_slug: "brand-qa" }, { ...tap, tap_event_id: "01" }, { ...tap, tap_event_id: "9223372036854775808" }]],
    [lists.hasMarketplaceListingIdentity, item, [{ ...item, id: null }, { ...item, id: " " }]],
  ]) {
    assert.equal(lists.readConsumerListSource(list([valid]), guard).data[0], valid);
    for (const row of invalid) assert.equal(lists.readConsumerListSource(list([row]), guard).status, "unavailable");
  }
  assert.equal(lists.hasConsumerTapIdentity({ ...tap, tap_event_id: "9223372036854775807" }), true);
  assert.equal(lists.hasConsumerTapIdentity({ ...tap, tap_event_id: 715 }), true);
  assert.equal(lists.readConsumerListSource(list([item]), lists.hasMarketplaceListingIdentity).data[0], item);
});
for (const destination of ["brands", "marketplace"]) {
  test(`${destination} recovers session uncertainty before all private and public context reads, preserving the full query`, async () => {
    const subject = setup(destination, { session: "unavailable" });
    const params = { fromTap: "1", action: "marketplace", eventId: "715", tenant: "brand-qa", filter: ["one", "two"] };
    const html = await subject.render(params);
    assert.match(html, /consumer-portal-unavailable/);
    assert.deepEqual(subject.calls, [["session", api.buildConsumerNextPath(`/me/${destination}`, params)]]);
    assert.equal(subject.grids.length, 0);
  });
  test(`${destination} keeps the login redirect before any data reads`, async () => {
    const subject = setup(destination, { denied: true });
    await assert.rejects(() => subject.render(), /redirect-login/);
    assert.deepEqual(subject.calls, [["session", `/me/${destination}`]]);
  });
}
test("failed and malformed memberships show recovery rather than claiming no clubs or displaying points", async () => {
  for (const brands of [null, { ok: false, items: [] }, { ok: true, other: [] }, list([{}])]) {
    const subject = setup("brands", { brands }), html = await subject.render();
    assert.match(html, /consumer-brands-unavailable/); assert.match(html, /Reintentar carga/);
    assert.doesNotMatch(html, /No perteneces a ningún club|Puntos reportados|Membresías Conectadas/);
  }
});
test("validated empty memberships retain the true empty state", async () => {
  const html = await setup("brands", { brands: list() }).render();
  assert.match(html, /No perteneces a ningún club/); assert.doesNotMatch(html, /consumer-brands-unavailable/);
});
test("partial brand reads keep reported membership points and available products without false empty feeds or failed-source zeroes", async () => {
  const html = await setup("brands", { products: list([product]), taps: null, catalog: null }).render();
  assert.match(html, /Marca sintética QA/); assert.match(html, />540<\/p>/);
  assert.match(html, /Producto sintético guardado/); assert.match(html, /consumer-brands-partial/);
  assert.match(html, /Lecturas no disponibles para consulta/); assert.match(html, /Consulta incompleta/); assert.match(html, />N\/D<\/p>/);
  assert.doesNotMatch(html, /No hay notificaciones ni actualizaciones pendientes|Sin mensajes de fidelización|0 Novedades|0 Nuevos/);
});
test("malformed ancillary brand rows stay unavailable independently of successful empty sources", async () => {
  const html = await setup("brands", { products: list([{}]), taps: list([{}]), catalog: list() }).render();
  assert.match(html, /consumer-brands-partial/); assert.match(html, /Productos no disponibles para consulta/); assert.match(html, /Lecturas no disponibles para consulta/);
  assert.match(html, /Marca sintética QA/); assert.match(html, /Puntos reportados/); assert.doesNotMatch(html, /Ninguno todavía/);
});
test("failed and malformed catalogs recover without claiming no products are published, keeping wallet navigation", async () => {
  for (const catalog of [null, { ok: false, items: [] }, { ok: true, other: [] }, list([{}])]) {
    const subject = setup("marketplace", { catalog }), html = await subject.render({ tenant: "brand-qa" });
    assert.match(html, /consumer-catalog-unavailable/); assert.match(html, /Reintentar carga/); assert.match(html, /Ver mi wallet/);
    assert.doesNotMatch(html, /Todavía no hay productos publicados/); assert.equal(subject.grids.length, 0);
  }
});
test("successful empty catalog is distinct from unavailable catalog", async () => {
  const html = await setup("marketplace", { catalog: list() }).render({ tenant: "brand-qa" });
  assert.match(html, /Todavía no hay productos publicados/); assert.doesNotMatch(html, /consumer-catalog-unavailable/);
});
test("available catalog retains raw item fields and explicit tenant when the independent product read fails", async () => {
  const subject = setup("marketplace", { products: null }), html = await subject.render({ tenant: "brand-qa" });
  assert.deepEqual(subject.calls, [["session", "/me/marketplace?tenant=brand-qa"], ["private", "products"], ["catalog", "products?tenant=brand-qa"]]);
  assert.equal(subject.grids[0].items[0], item); assert.equal(Object.hasOwn(subject.grids[0], "postTapEventId"), false);
  assert.doesNotMatch(html, /consumer-catalog-partial|consumer-catalog-unavailable/);
});
test("failed automatic brand selection explicitly labels general browsing and keeps an available catalog", async () => {
  const subject = setup("marketplace", { products: null }), html = await subject.render();
  assert.deepEqual(subject.calls, [["session", "/me/marketplace"], ["private", "products"], ["catalog", "products"]]);
  assert.match(html, /consumer-catalog-partial/); assert.match(html, /catálogo general/); assert.match(html, /Propuesta sintética QA/); assert.equal(subject.grids[0].items[0], item);
});
test("available products retain owned-brand preference and do not add a recovery notice", async () => {
  const subject = setup("marketplace", { products: list([{ ...product, tenant_slug: "other-brand", ownership_status: "viewed" }, product]) });
  const html = await subject.render(); assert.deepEqual(subject.calls.at(-1), ["catalog", "products?tenant=brand-qa"]);
  assert.doesNotMatch(html, /consumer-catalog-partial/);
});
test("contextual catalog remains bound to server tenant and original event through failed-catalog recovery", async () => {
  const params = { fromTap: "1", action: "marketplace", eventId: "715", tenant: "untrusted-url-brand" };
  const failed = setup("marketplace", { catalog: null }), html = await failed.render(params);
  assert.deepEqual(failed.calls, [["session", api.buildConsumerNextPath("/me/marketplace", params)], ["public-configuration", "715"], ["catalog", "products?tenant=brand-qa"]]);
  assert.match(html, /consumer-catalog-unavailable/); assert.doesNotMatch(html, /Consultar el catálogo general|Todavía no hay productos publicados/);
  const ready = setup("marketplace"); await ready.render(params);
  assert.equal(ready.grids[0].postTapEventId, "715"); assert.equal(ready.grids[0].items[0], item);
});
