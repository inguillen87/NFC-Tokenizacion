import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as model from "../src/app/me/brands/brands-model.ts";
import * as lists from "../src/app/me/_components/consumer-list-availability.ts";

const ready = (data = []) => ({ status: "ready", data });
const unavailable = { status: "unavailable", data: null };
const brand = (slug, more = {}) => ({ slug, name: `Marca ${slug}`, status: "active", points_balance: 0, ...more });
const input = (more = {}) => ({ brands: ready([brand("brand-a")]), products: ready(), taps: ready(), listings: ready(), ...more });

test("brand identity preserves canonical tenant separators without name, UUID or lossy normalization fallbacks", () => {
  for (const slug of ["brand-a", "brand_a", "branda", "brand.a", "a".repeat(120)]) assert.equal(model.brandTenantSlug(slug), slug);
  for (const slug of [null, 7, ["brand-a"], "", " BRAND-A ", "Brand-A", "../brand-a", "brand/a", "a".repeat(121)]) assert.equal(model.brandTenantSlug(slug), null);
  const brands = model.buildConsumerBrands(input({
    brands: ready([brand("brand-a", { name: "Mismo nombre" }), brand("branda", { name: "Mismo nombre" }), brand("brand_a", { name: "Mismo nombre" })]),
    products: ready(["brand-a", "branda", "brand_a"].map(tenant_slug => ({ tenant_slug, product_name: tenant_slug }))),
    taps: ready(["brand-a", "branda", "brand_a"].map(tenant_slug => ({ tenant_slug, tap_event_id: 8 }))),
  }));
  for (const card of brands.items) {
    assert.equal(card.products.data.length, 1); assert.equal(card.products.data[0].tenant_slug, card.slug);
    assert.equal(card.taps.data.length, 1); assert.equal(card.taps.data[0].tenant_slug, card.slug);
    assert.equal(card.links.catalog, `/me/marketplace?tenant=${card.slug}`);
    assert.equal(card.links.history, `/me/taps?tenant=${card.slug}`);
  }
  assert.equal(brands.items[2].links.rewards, "/me/rewards?tenant=brand_a", "benefits preserve the same canonical underscore identity");
});

test("balances remain individual and only explicit nonnegative safe integers are reported, including zero", () => {
  const values = [0, "0", 540, "41", null, undefined, -1, 1.2, "01", "1.2", Number.MAX_SAFE_INTEGER + 1];
  const cards = model.buildConsumerBrands(input({ brands: ready(values.map((points_balance, index) => brand(`brand-${index}`, { points_balance }))) })).items;
  assert.deepEqual(cards.map(card => card.balance), [0, 0, 540, 41, null, null, null, null, null, null, null]);
  assert.ok(cards.every(card => !Object.hasOwn(card, "totalBalance") && !Object.hasOwn(card, "canRedeem")));
});

test("each ancillary source independently distinguishes unavailable, successful empty and real scoped data", () => {
  for (const field of ["products", "taps", "listings"]) {
    const card = model.buildConsumerBrands(input({ [field]: unavailable })).items[0];
    const failed = field === "listings" ? "catalog" : field;
    assert.deepEqual(card[failed], unavailable);
    for (const other of ["products", "taps", "catalog"].filter(key => key !== failed)) assert.deepEqual(card[other], ready());
    assert.equal(card.balance, 0); assert.equal(card.links.history, "/me/taps?tenant=brand-a");
  }
  assert.deepEqual(model.buildConsumerBrands(input({ brands: unavailable })), { status: "unavailable", items: [] });
  assert.deepEqual(model.buildConsumerBrands(input({ brands: ready() })), { status: "ready", items: [] });
});

test("only explicitly active catalog rows of the exact tenant are catalog products, never promotions or notifications", () => {
  const listings = [
    { id: "active", tenant_slug: "brand-a", status: "active" }, { id: "legacy", tenant_slug: "brand-a", stock_status: "active" },
    { id: "draft", tenant_slug: "brand-a", status: "draft", stock_status: "active" }, { id: "unknown", tenant_slug: "brand-a" },
    { id: "withdrawn", tenant_slug: "brand-a", status: "withdrawn" }, { id: "foreign", tenant_slug: "branda", status: "active" },
  ];
  const card = model.buildConsumerBrands(input({ listings: ready(listings) })).items[0];
  assert.deepEqual(card.catalog.data.map(item => item.id), ["active", "legacy"]);
  for (const absent of ["activePromoCount", "unreadCount", "notifications", "tier", "progress", "nextMilestone"]) assert.equal(Object.hasOwn(card, absent), false);
});

test("missing and duplicate tenant identities preserve reported membership and points while refusing scoped activity and links", () => {
  const cards = model.buildConsumerBrands(input({ brands: ready([
    brand(null, { tenant_id: "uuid-does-not-replace-slug", name: "brand-a", points_balance: 17 }), brand("brand-a"), brand("brand-a"),
  ]), products: ready([{ tenant_slug: "brand-a", product_name: "Do not borrow" }]) })).items;
  assert.equal(cards[0].name, "brand-a"); assert.equal(cards[0].balance, 17);
  assert.ok(cards.every(card => card.slug === null && card.links === null && card.products.status === "unavailable" && card.catalog.status === "unavailable"));
});

test("all and selected membership views are explicit; malformed, repeated and unknown filters never widen silently", () => {
  const cards = model.buildConsumerBrands(input({ brands: ready([brand("brand-a"), brand("brand-b")]) })).items;
  assert.equal(model.filterConsumerBrands(cards, undefined).items, cards);
  assert.deepEqual(model.filterConsumerBrands(cards, "brand-b").items.map(card => card.slug), ["brand-b"]);
  assert.deepEqual(model.filterConsumerBrands(cards, "foreign"), { state: "missing", slug: "foreign", items: [] });
  for (const value of [["brand-a", "brand-b"], "brand-a&tenant=brand-b", "../brand-a", "BRAND-A"]) assert.deepEqual(model.filterConsumerBrands(cards, value), { state: "invalid", slug: null, items: [] });
});

test("membership labels and dates report supplied state without promoting pending, paused or unknown states", () => {
  for (const [status, expected] of [["active", "Membresía activa"], ["pending", "Membresía pendiente"], ["paused", "Membresía pausada"], ["inactive", "Membresía inactiva"], ["suspended", "Membresía suspendida"], ["blocked", "Membresía bloqueada"], ["withdrawn", "Membresía retirada"], ["cancelled", "Membresía cancelada"]]) assert.equal(model.membershipLabel(status), expected);
  for (const status of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
    const label = model.membershipLabel(status); assert.equal(typeof label, "string"); assert.equal(label, `Estado reportado: ${status}`);
  }
  assert.equal(model.membershipLabel("tenant_review"), "Estado reportado: tenant_review"); assert.equal(model.membershipLabel(null), "Estado de membresía no informado");
  assert.ok(model.brandDateLabel("2026-10-01T12:00:00.123456Z"));
  for (const value of ["", "not-a-date", "2026-02-30T12:00:00Z", "2026-13-01T12:00:00Z", "2026-10-01T25:00:00Z", null]) assert.equal(model.brandDateLabel(value), null);
});

test("reading copy reuses the existing exact-code projection, including unconfirmed unfamiliar codes", () => {
  for (const [verdict, expected] of [["VALID_CLOSED", "Sello cerrado reportado"], ["VALID_OPENED", "Sello abierto reportado"], ["REPLAY", "Lectura repetida por revisar"], ["UNEXPECTED_VALID", "Resultado no confirmado"], ["QR_VIEW", "Resultado no confirmado"]]) {
    assert.equal(model.brandTapStatus({ verdict }), expected);
  }
  assert.equal(model.brandTapStatus(null), "Resultado no confirmado");
});

const require = createRequire(import.meta.url);
function page(options = {}) {
  const calls = [], shells = [], css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  const source = readFileSync(new URL("../src/app/me/brands/page.tsx", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const overrides = {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "../_components/consumer-api": {
      buildConsumerNextPath: (path, params) => { const query = new URLSearchParams(); for (const [key, value] of Object.entries(params)) for (const entry of Array.isArray(value) ? value : [value]) if (entry) query.append(key, entry); return query.size ? `${path}?${query}` : path; },
      readConsumerSession: async next => { calls.push(["session", next]); return { status: options.session || "ready" }; },
      fetchConsumerPath: async path => { calls.push(["private", path]); return Object.hasOwn(options, path) ? options[path] : { ok: true, items: path === "brands" ? [brand("brand-a"), brand("brand-b", { status: "paused", points_balance: 41 })] : [] }; },
      fetchMarketplacePath: async path => { calls.push(["catalog", path]); return Object.hasOwn(options, "catalog") ? options.catalog : { ok: true, items: [] }; },
    },
    "../_components/consumer-list-availability": lists,
    "../_components/consumer-portal-recovery": { ConsumerPortalUnavailable: () => React.createElement("p", null, "Session unavailable") },
    "../_components/me-portal-interactive-client": { ConsumerDataRetryButton: () => React.createElement("button", { type: "button" }, "Reintentar carga") },
    "../_components/portal-shell": { PortalShell: props => { shells.push(props); return React.createElement("main", null, props.children); } },
    "./brands-model": model, "./brands.module.css": css, "../_components/consumer-list-recovery.module.css": css,
  };
  const loaded = { exports: {} }; new Function("require", "module", "exports", js)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), loaded, loaded.exports);
  return { calls, shells, render: async (params = {}) => renderToStaticMarkup(await loaded.exports.default({ searchParams: Promise.resolve(params) })) };
}

test("SSR shows separate balances, real state and exact existing destination scopes without fabricated feeds", async () => {
  const subject = page(), html = await subject.render();
  assert.match(html, /Membresía activa/); assert.match(html, /Membresía pausada/); assert.match(html, />0<\/p>/); assert.match(html, />41<\/p>/);
  for (const slug of ["brand-a", "brand-b"]) for (const path of ["marketplace", "rewards", "taps"]) assert.match(html, new RegExp(`href="/me/${path}\\?tenant=${slug}"`));
  assert.doesNotMatch(html, /Drops|Promos|Mensajes del Viñedo|unread|Nivel|Progreso|checkout|Votar|Emisor verificado/);
  assert.equal(Object.hasOwn(subject.shells[0], "notificationCount"), false);
  assert.deepEqual(subject.calls, [["session", "/me/brands"], ["private", "brands"], ["private", "products"], ["private", "taps"], ["catalog", "products"]]);
  for (const status of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
    const unknown = await page({ brands: { ok: true, items: [brand("brand-a", { status })] } }).render();
    assert.ok(unknown.includes(`Estado reportado: ${status}`)); assert.doesNotMatch(unknown, /Membresía activa|\[object Object\]/);
  }
});

test("SSR selection hides other brand cards and gives an explicit complete-view recovery for unknown or repeated tenant filters", async () => {
  const selected = await page().render({ tenant: "brand-b" });
  assert.match(selected, /data-brand-tenant="brand-b"/); assert.doesNotMatch(selected, /data-brand-tenant="brand-a"/);
  for (const tenant of ["foreign", ["brand-a", "brand-b"], "../brand-a"]) {
    const html = await page().render({ tenant }); assert.match(html, /consumer-brands-filter-unavailable/); assert.doesNotMatch(html, /data-testid="consumer-brand-card"/);
    assert.match(html, /href="\/me\/brands">Ver todas mis marcas/);
  }
});

test("SSR preserves source-specific recovery and reported products rather than failed-source zeros or a false empty membership", async () => {
  const html = await page({ taps: null, catalog: null, products: { ok: true, items: [{ id: "own", tenant_slug: "brand-a", product_name: "Producto <literal>" }] } }).render();
  assert.match(html, /consumer-brands-partial/); assert.match(html, /Producto &lt;literal&gt;/); assert.match(html, /Lecturas no disponibles para consulta/);
  assert.match(html, /Catálogo no disponible para consulta/); assert.match(html, />N\/D<\/dd>/); assert.doesNotMatch(html, /No hay lecturas guardadas|No hay productos publicados|consumer-brands-empty/);
  const failed = await page({ brands: null }).render(); assert.match(failed, /consumer-brands-unavailable/); assert.doesNotMatch(failed, /Puntos reportados|consumer-brands-empty/);
  const empty = await page({ brands: { ok: true, items: [] } }).render(); assert.match(empty, /consumer-brands-empty/); assert.doesNotMatch(empty, /consumer-brands-unavailable/);
});

test("SSR session uncertainty preserves the full return query and stops every account/catalog read", async () => {
  const subject = page({ session: "unavailable" }); await subject.render({ tenant: ["brand-a", "brand-b"], fromTap: "1", eventId: "900001" });
  assert.deepEqual(subject.calls, [["session", "/me/brands?tenant=brand-a&tenant=brand-b&fromTap=1&eventId=900001"]]);
});

test("SSR gives a bounded consultation label and readable reading outcomes without rendering technical codes or malformed fields", async () => {
  const html = await page({
    taps: { ok: true, items: [{ tap_event_id: "9", tenant_slug: "brand-a", verdict: "VALID_CLOSED" }, { tap_event_id: "10", tenant_slug: "brand-a", verdict: "UNEXPECTED_VALID" }] },
    products: { ok: true, items: [{ id: "product", tenant_slug: "brand-a", product_name: {}, bid: {} }] },
  }).render();
  assert.match(html, /En esta consulta/);assert.match(html, /Sello cerrado reportado/);assert.match(html, /Resultado no confirmado/);
  assert.match(html, /Producto sin nombre informado/);assert.doesNotMatch(html, /VALID_CLOSED|UNEXPECTED_VALID|\[object Object\]/);
});
