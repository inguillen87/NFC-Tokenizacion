import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dir = new URL("../src/app/me/_components/", import.meta.url);
const modelSource = readFileSync(new URL("consumer-home-model.ts", dir), "utf8");
const clientSource = readFileSync(new URL("me-portal-interactive-client.tsx", dir), "utf8");
const pageSource = readFileSync(new URL("../page.tsx", dir), "utf8");
const css = readFileSync(new URL("consumer-home.module.css", dir), "utf8");

function compile(source, overrides = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
const model = compile(modelSource);
const styles = new Proxy({}, { get: (_, name) => String(name) });
const client = compile(clientSource, {
  "./consumer-home-model": model,
  "./consumer-home.module.css": { __esModule: true, default: styles },
  "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
  "next/image": { __esModule: true, default: ({ unoptimized, sizes, onError, ...props }) => React.createElement("img", props) },
  "next/navigation": { useRouter: () => ({ refresh: () => {} }) },
});
const { MePortalInteractiveClient } = client;
const list = (items = []) => ({ ok: true, items });
const empty = () => ({ account: { ok: true, consumer: {}, stats: {} }, products: list(), taps: list(), brands: list() });
const render = (payloads) => renderToStaticMarkup(React.createElement(MePortalInteractiveClient, { model: model.buildConsumerHomeModel(payloads) }));
const renderedText = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

test("each source requires a successful envelope, not null, malformed or failed data disguised as an empty list", () => {
  for (const field of ["products", "taps", "brands"]) {
    for (const invalid of [null, undefined, [], {}, { ok: false, items: [] }, { items: [] }, { ok: true, items: null }, { ok: true, items: [null] }, { ok: true, items: ["invalid"] }]) {
      assert.deepEqual(model.buildConsumerHomeModel({ ...empty(), [field]: invalid })[field], { status: "unavailable", data: null });
    }
    assert.deepEqual(model.buildConsumerHomeModel(empty())[field], { status: "ready", data: [] });
  }
  for (const invalid of [null, {}, { ok: false, consumer: {} }, { ok: true }, { ok: true, consumer: [] }]) {
    assert.equal(model.buildConsumerHomeModel({ ...empty(), account: invalid }).account.status, "unavailable");
  }
});

test("account counts require explicit nonnegative safe integers and never derive totals from the tap sample", () => {
  for (const value of [null, undefined, "0", -1, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(model.reportedHomeCount(value), null);
  for (const value of [0, 8, 200]) assert.equal(model.reportedHomeCount(value), value);
  const data = model.buildConsumerHomeModel({ ...empty(), taps: list(Array.from({ length: 200 }, (_, n) => ({ tap_event_id: n + 1 }))) });
  assert.equal(data.account.data.taps, null);
  assert.equal(data.taps.data.length, 200);
  const counts = model.buildConsumerHomeModel({ ...empty(), account: { ok: true, consumer: {}, stats: { products: 0, taps: 982 } } });
  assert.equal(counts.account.data.products, 0);
  assert.equal(counts.account.data.taps, 982);
});

test("the client model only contains required display fields, no raw consumer record or brand consents", () => {
  const data = model.buildConsumerHomeModel({ ...empty(), account: { ok: true, consumer: { id: "private-id", display_name: "Alex", email: "alex@example.test", status: "active", password_hash: "private-hash", provider_id: "private-provider" }, stats: { taps: 5 } }, brands: list([{ name: "Acme", consents: { phone: "private-phone" } }]) });
  assert.deepEqual(data.account.data, { name: "Alex", email: "alex@example.test", status: "active", products: null, taps: 5 });
  assert.doesNotMatch(JSON.stringify(data), /private-|password_hash|provider_id|consents/);
});

test("links only use persisted event IDs and encode them as a single URL segment", () => {
  for (const value of [null, undefined, "", " ", 0, "0", -1, "-1", 1.1, "1.1", {}, "bad\nvalue"]) assert.equal(model.homeReadingHref(value), null);
  assert.equal(model.homeReadingHref(703), "/certificado/703");
  assert.equal(model.homeReadingHref("tag/a?next=x"), "/certificado/tag%2Fa%3Fnext%3Dx");
  const data = model.buildConsumerHomeModel({ ...empty(), products: list([{ latest_tap_event_id: null, first_tap_event_id: 22 }, {}]), taps: list([{}]) });
  assert.equal(data.products.data[0].readingHref, "/certificado/22");
  assert.equal(data.products.data[1].readingHref, null);
  assert.equal(data.taps.data[0].href, null);
});

test("images must be a reported safe relative or HTTPS URL; missing images never become a stock wine", () => {
  for (const value of [null, "", "javascript:alert(1)", "data:image/svg+xml,test", "http://example.test/a.jpg", "//example.test/a.jpg", "/\\example.test/a.jpg", "https://user:secret@example.test/a.jpg"]) assert.equal(model.homeImageUrl(value), null);
  assert.equal(model.homeImageUrl("/images/real-product.jpg"), "/images/real-product.jpg");
  assert.equal(model.homeImageUrl("https://example.test/actual.jpg"), "https://example.test/actual.jpg");
  const html = render({ ...empty(), products: list([{ product_name: "Producto A" }]) });
  assert.doesNotMatch(html, /<img|premium_magnum|wine_crate|Gran Reserva/);
});

test("dates are prepared in UTC with an explicit source offset and malformed/unzoned timestamps stay unknown", () => {
  const dates = ["2026-09-05T22:22:29-03:00", "2026-09-06T01:22:29Z", "2026-09-06 01:22:29.000000+00", "2026-09-05 22:22:29-0300", "not-a-date", "2026-09-05T22:22:29", null];
  const data = model.buildConsumerHomeModel({ ...empty(), taps: list(dates.map((created_at) => ({ created_at }))) });
  assert.equal(data.taps.data[0].dateTime, "2026-09-06T01:22:29.000Z");
  for (const tap of data.taps.data.slice(0, 4)) assert.equal(data.taps.data[0].date, tap.date);
  assert.match(data.taps.data[0].date, /01:22/);
  for (const tap of data.taps.data.slice(4)) assert.deepEqual({ date: tap.date, dateTime: tap.dateTime }, { date: "Fecha no informada", dateTime: null });
});

test("verdict and membership states do not infer verification or an active club from missing evidence", () => {
  assert.equal(model.homeVerdictLabel(null), "Estado no informado");
  assert.equal(model.homeVerdictLabel("VALID_OPENED"), "Sello abierto reportado");
  assert.equal(model.homeVerdictLabel("UNRECOGNIZED_NEW_RESULT"), "UNRECOGNIZED_NEW_RESULT");
  assert.equal(model.homeMembershipLabel(null), "Estado no informado");
  assert.equal(model.homeMembershipLabel("pending"), "Membresía pendiente");
  assert.equal(model.homeMembershipLabel("active"), "Membresía activa");
  const data = model.buildConsumerHomeModel({ ...empty(), brands: list([{ slug: "tenant/a", points_balance: null }, { points_balance: 0 }]) });
  assert.equal(data.brands.data[0].href, "/me/marketplace?tenant=tenant%2Fa");
  assert.equal(data.brands.data[0].points, null);
  assert.equal(data.brands.data[1].points, 0);
});

test("a real empty account shows actionable empty states, not an error, invented collection or default brand", () => {
  const text = renderedText(render(empty()));
  assert.match(text, /Tu próximo producto empieza con un tap/);
  assert.match(text, /Aún no hay lecturas vinculadas/);
  assert.match(text, /Elegí con qué marcas conectar/);
  assert.match(text, /Tu cuenta/);
  assert.doesNotMatch(text, /No pudimos cargar|Reintentar carga|0 en tu cuenta|0 registradas|Balmec|Bodega|Premium|%/);
});

test("unavailable sources show retry and do not claim the account is empty or invent zero metrics", () => {
  const text = renderedText(render({ account: null, products: null, taps: null, brands: null }));
  assert.match(text, /No pudimos cargar algunos datos/);
  assert.match(text, /Reintentar carga/);
  assert.match(text, /No se pudo cargar el historial/);
  assert.doesNotMatch(text, /Tu próximo producto|Aún no hay lecturas|Elegí con qué marcas|0 en tu cuenta|0 registradas/);
});

test("partial failures preserve real products and links; email is rendered once in the account card", () => {
  const html = render({ ...empty(), account: { ok: true, consumer: { display_name: "Alex", email: "alex@example.test", status: "verified" }, stats: { products: 1, taps: 250 } }, products: list([{ product_name: "Filtro durable", brand_name: "Acme", bid: "LOTE-A", latest_tap_event_id: 88, image_url: "/images/real-filter.jpg" }]), taps: null });
  assert.match(html, /Filtro durable/);
  assert.match(html, /href="\/certificado\/88"/);
  assert.match(html, /src="\/images\/real-filter.jpg"/);
  assert.match(html, /No se pudo cargar el historial/);
  assert.equal((html.match(/alex@example\.test/g) || []).length, 1);
  assert.match(html, /250 registradas en tu cuenta/);
  assert.match(html, /Hola, Alex/);
});

test("a display name equal to the account email is not duplicated as the welcome heading", () => {
  const html = render({ ...empty(), account: { ok: true, consumer: { display_name: "alex@example.test", email: "alex@example.test" } } });
  assert.equal((html.match(/alex@example\.test/g) || []).length, 1);
  assert.match(html, /id="home-welcome-title">Tu cuenta/);
});

test("home shows only five recent real readings and three memberships without sum-of-points or a synthetic total", () => {
  const html = render({ ...empty(), taps: list(Array.from({ length: 12 }, (_, index) => ({ tap_event_id: index + 1, verdict: index === 0 ? "VALID_OPENED" : null, city: "Mendoza", created_at: "2026-09-06T01:22:29Z" }))), brands: list([{ name: "Marca A", points_balance: 100 }, { name: "Marca B", points_balance: 90, status: "pending" }, { name: "Marca C", points_balance: null }, { name: "Marca D", points_balance: 20 }]) });
  assert.equal((html.match(/aria-label="Abrir lectura /g) || []).length, 5);
  assert.match(html, /Hasta 5 lecturas recientes/);
  assert.match(html, /Horarios en UTC/);
  assert.match(html, /Membresía pendiente/);
  assert.match(html, /Puntos no informados/);
  assert.doesNotMatch(html, /Marca D|210|12 registradas en tu cuenta|Autenticación verificada/);
});

test("home destinations exist, wallet/catalog stay accessible, and no demo/checkout control is promoted to a real action", () => {
  const html = render(empty());
  const hrefs = [...html.matchAll(/href="(\/me(?:\/[^"?]+)?)"/g)].map((match) => match[1]);
  for (const href of hrefs) assert.ok(existsSync(new URL(`../src/app${href}/page.tsx`, import.meta.url)), href);
  assert.ok(hrefs.includes("/me/marketplace"));
  assert.ok(hrefs.includes("/me/wallet"));
  assert.doesNotMatch(clientSource, /window\.ethereum|NEXT_PUBLIC_ME_PORTAL_COMMERCE_DEMO_ENABLED|setTrades|passportReadiness|Math\.random|setInterval|setTimeout|checkout|NFTs|P2P/);
});

test("server authenticates before starting its four parallel reads and preserves the continuation query", async () => {
  let authorize;
  const session = new Promise((resolve) => { authorize = resolve; });
  const calls = [];
  const release = [];
  const fetch = (name) => { calls.push(name); return new Promise((resolve) => release.push(() => resolve(name === "account" ? empty().account : list()))); };
  let nextParams;
  const page = compile(pageSource, {
    "./_components/consumer-api": {
      buildConsumerNextPath: (path, params) => { nextParams = { path, params }; return "preserved-next"; },
      requireConsumerSession: async (next) => { assert.equal(next, "preserved-next"); await session; },
      fetchConsumerMe: () => fetch("account"), fetchConsumerPath: fetch,
    },
    "./_components/consumer-home-model": model,
    "./_components/portal-shell": { PortalShell: () => null },
    "./_components/me-portal-interactive-client": { MePortalInteractiveClient: () => null },
  }).default;
  const pending = page({ searchParams: Promise.resolve({ fromTap: "1", tenant: "actual-tenant", eventId: "702" }) });
  await new Promise(setImmediate);
  assert.deepEqual(calls, []);
  authorize();
  await new Promise(setImmediate);
  assert.deepEqual(calls, ["account", "products", "taps", "brands"]);
  release.forEach((resolve) => resolve());
  const element = await pending;
  assert.deepEqual(nextParams, { path: "/me", params: { fromTap: "1", tenant: "actual-tenant", eventId: "702" } });
  assert.equal(element.props.children.props.model.products.status, "ready");
});

test("a denied session prevents all consumer home source reads", async () => {
  let fetches = 0;
  const page = compile(pageSource, {
    "./_components/consumer-api": { buildConsumerNextPath: () => "/me", requireConsumerSession: async () => { throw new Error("redirect-login"); }, fetchConsumerMe: () => { fetches++; }, fetchConsumerPath: () => { fetches++; } },
    "./_components/consumer-home-model": model,
    "./_components/portal-shell": { PortalShell: () => null },
    "./_components/me-portal-interactive-client": { MePortalInteractiveClient: () => null },
  }).default;
  await assert.rejects(() => page({}), /redirect-login/);
  assert.equal(fetches, 0);
});

function contrast(a, b) {
  const lum = (hex) => {
    const c = hex.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

test("home themes have readable text pairs, visible focus, touch targets and reduced-motion treatment", () => {
  const themes = [...css.matchAll(/--home-ink: (#[\da-f]+);[\s\S]*?--home-warn-ink: (#[\da-f]+);/g)].map((match) => Object.fromEntries([...match[0].matchAll(/--home-([\w-]+): (#[\da-f]+);/g)].map((v) => [v[1], v[2]])));
  assert.equal(themes.length, 2);
  for (const theme of themes) {
    for (const text of ["ink", "muted", "accent"]) for (const background of ["card", "soft", "mint"]) assert.ok(contrast(theme[text], theme[background]) >= 4.5, `${text}/${background}`);
    assert.ok(contrast(theme["warn-ink"], theme["warn-bg"]) >= 4.5);
  }
  assert.ok(contrast("#ffffff", "#106b54") >= 4.5);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

const productsSource = readFileSync(new URL("../products/page.tsx", dir), "utf8");
const productsCss = readFileSync(new URL("../products/products.module.css", dir), "utf8");
function loadProductsPage(payload, denied = false) {
  const calls = [];
  const page = compile(productsSource, {
    "../_components/consumer-api": {
      buildConsumerNextPath: (path) => path,
      requireConsumerSession: async () => { calls.push("session"); if (denied) throw new Error("redirect-login"); },
      fetchConsumerPath: async (path) => { calls.push(path); return payload; },
    },
    "../_components/consumer-home-model": model,
    "../_components/me-portal-interactive-client": client,
    "../_components/portal-shell": { PortalShell: ({ title, subtitle, children }) => React.createElement("main", null, React.createElement("h1", null, title), React.createElement("p", null, subtitle), children) },
    "./products.module.css": { __esModule: true, default: styles },
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
  }).default;
  return { page, calls };
}

test("products page preserves auth-first and reads only the source it actually renders", async () => {
  const { page, calls } = loadProductsPage(list());
  await page({ searchParams: Promise.resolve({ fromTap: "1" }) });
  assert.deepEqual(calls, ["session", "products"]);
  const denied = loadProductsPage(list(), true);
  await assert.rejects(() => denied.page({}), /redirect-login/);
  assert.deepEqual(denied.calls, ["session"]);
});

test("products unavailable is not an empty collection and supports a manual retry", async () => {
  for (const payload of [null, { ok: false, items: [] }, { items: [] }, { ok: true, items: [null] }]) {
    const html = renderToStaticMarkup(await loadProductsPage(payload).page({}));
    assert.match(html, /No pudimos cargar tus productos/);
    assert.match(html, /Reintentar carga/);
    assert.doesNotMatch(html, /Todavía no hay productos|0 productos|En tu cuenta/);
  }
  const emptyHtml = renderToStaticMarkup(await loadProductsPage(list()).page({}));
  assert.match(emptyHtml, /Todavía no hay productos guardados/);
  assert.match(emptyHtml, /Revisar mis lecturas/);
  assert.doesNotMatch(emptyHtml, /No pudimos cargar|Reintentar carga|0 productos/);
});

test("products show actual metadata and real certificate/experience destinations without inferred product type or blockchain status", async () => {
  const payload = list([{ product_name: "Filtro industrial", brand_name: "Empresa Agua", tenant_slug: "agua", bid: "B-200", image_url: "/images/filter.jpg", latest_tap_event_id: 88, latest_verdict: "VALID_OPENED", latest_city: "Mendoza", latest_country: "AR", ownership_record_status: "pending", created_at: "2026-09-06 01:22:29+00", latest_tap_at: "2026-09-06T02:22:29Z" }]);
  const html = renderToStaticMarkup(await loadProductsPage(payload).page({}));
  assert.match(html, /Filtro industrial/);
  assert.match(html, /Empresa Agua/);
  assert.match(html, /href="\/certificado\/88"/);
  assert.match(html, /href="\/me\/experiences\?tenant=agua&amp;eventId=88&amp;product=Filtro\+industrial"/);
  assert.match(html, /href="\/me\/marketplace\?tenant=agua"/);
  assert.match(html, /Solicitud pendiente/);
  assert.match(html, /Sello abierto reportado/);
  assert.match(html, /01:22 UTC/);
  assert.match(html, /1 producto en esta lista/);
  assert.match(html, /<details[^>]*><summary>Datos del registro/);
  assert.doesNotMatch(html, /active: true|assetScore|Sommelier|Acuñado|Polygon|Autenticación verificada|Total|Canjear Beneficios/);
});

test("products missing metadata stay neutral and lack certificate/experience links if the source ID or tenant is missing", async () => {
  const html = renderToStaticMarkup(await loadProductsPage(list([{}])).page({}));
  assert.match(html, /Producto sin nombre reportado/);
  assert.match(html, /Marca no informada/);
  assert.match(html, /Estado no informado/);
  assert.match(html, /Fecha no informada/);
  assert.match(html, /Consultar historial/);
  assert.doesNotMatch(html, /href="\/certificado|href="\/me\/experiences|<img|Gran Reserva|nexID Partner|premium_magnum|wine_crate|Titularidad digital registrada/);
  const withoutTenant = model.buildHomeProductsSource(list([{ latest_tap_event_id: 40 }])).data[0];
  assert.equal(model.homeProductExperienceHref(withoutTenant), null);
  const withoutEvent = model.buildHomeProductsSource(list([{ tenant_slug: "agua" }])).data[0];
  assert.equal(model.homeProductExperienceHref(withoutEvent), null);
});

test("product colors, mobile layout, touch targets and reduced motion match the home", () => {
  assert.match(productsCss, /html\[data-theme="dark"\]/);
  assert.match(productsCss, /@media \(max-width: 520px\)/);
  assert.match(productsCss, /min-height: 46px/);
  assert.match(productsCss, /:focus-visible/);
  assert.match(productsCss, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(productsSource, /assetScore|premium_magnum|productVisualKind|asArray|Math\.random|isClaimed/);
});
