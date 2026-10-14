import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as tapHandoff from "../src/app/api/_lib/consumer-tap-handoff.ts";
import * as boundedFetch from "../src/app/me/_components/consumer-bounded-fetch.ts";
import { rewardNextActions } from "../src/app/me/_components/consumer-reward-next-actions.ts";

const require = createRequire(import.meta.url);
const dir = new URL("../src/app/me/", import.meta.url);
const read = (path) => readFileSync(new URL(path, dir), "utf8");
const modelSource = read("_components/consumer-rewards-model.ts");
const pageSource = read("rewards/page.tsx");
const clientSource = read("rewards/rewards-client.tsx");
const cssSource = read("rewards/rewards.module.css");

function compile(source, overrides = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name) => Object.hasOwn(overrides, name) ? overrides[name] : name === "../../api/_lib/consumer-tap-handoff" ? tapHandoff : require(name);
  new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const walletModel = compile(read("_components/consumer-wallet-points-model.ts"));
const model = compile(modelSource, { "./consumer-wallet-points-model": walletModel });
const reservation = compile(read("_components/consumer-reward-reservation.ts"), { "./consumer-rewards-model": model, "./consumer-bounded-fetch": boundedFetch });
const api = compile(read("_components/consumer-api.ts"), {
  "next/headers": { headers: () => { throw new Error("unexpected-network-read"); } },
  "next/navigation": { redirect: () => { throw new Error("unexpected-redirect"); } },
  "./consumer-bounded-fetch": boundedFetch,
  "@product/config": { productUrls: { api: "https://api.nexid.lat" } },
  "../../api/_lib/server-api-transport": { fetchRuntimeApi: () => { throw Error("Unexpected network read"); } },
});
const css = Object.fromEntries([...cssSource.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => [match[1], match[1]]));
const shared = {
  "next/link": ({ children, prefetch, ...props }) => React.createElement("a", props, children),
  "./rewards.module.css": css,
  "../_components/consumer-rewards-model": model,
  "../_components/consumer-reward-reservation": reservation,
  "../_components/consumer-reward-next-actions": { rewardNextActions },
};
const { ConsumerRewardsClient } = compile(clientSource, shared);
const NOW = "2026-09-08T12:00:00Z";
const FUTURE = "2099-09-09T12:00:00Z";
const list = (items = []) => ({ ok: true, items });
const reward = (overrides = {}) => ({ id: "reward-1", tenant_slug: "demobodega", tenant_name: "Bodega Balmec", title: "Visita a la bodega", program_name: "Club Balmec", points_cost: 100, state: "reported", ...overrides });
const claim = (overrides = {}) => reward({ claim_id: "claim-1", claim_status: "claimed", claim_expires_at: FUTURE, redemption_code: "BALMEC-1234", ...overrides });
const wallet = (overrides = {}) => ({ ok: true, tenantWallets: [{ slug: "demobodega", name: "Bodega Balmec", points_balance: 540 }], networkWallet: { enabled: false, points_balance: 0 }, ...overrides });
const readModel = (payload, now = NOW) => model.buildConsumerRewardsModel(payload, now);
const readItem = (row, now = NOW) => readModel(list([row]), now).items[0];

function loadPage(payload, options = {}) {
  const calls = [];
  const clientProps = [];
  const page = compile(pageSource, {
    ...shared,
    "../_components/consumer-api": {
      ...api,
      readConsumerSession: async (next) => { calls.push(["session", next]); if (options.authorize) await options.authorize(); return { status: "ready" }; },
      fetchConsumerPath: async (path) => {
        calls.push(["fetch", path]);
        if (options.fetch) return options.fetch(path);
        return path === "rewards" ? payload : Object.hasOwn(options, "wallet") ? options.wallet : wallet();
      },
    },
    "../_components/consumer-portal-recovery": { ConsumerPortalUnavailable: () => null },
    "../_components/consumer-wallet-points-model": walletModel,
    "../_components/me-portal-interactive-client": { ConsumerDataRetryButton: () => React.createElement("button", { type: "button" }, "Reintentar carga") },
    "../_components/portal-shell": { PortalShell: ({ children }) => React.createElement("main", null, children) },
    "./rewards-client": { ConsumerRewardsClient: (props) => { clientProps.push(props); return React.createElement(ConsumerRewardsClient, props); } },
  }).default;
  return { page, calls, clientProps };
}

async function render(payload, options = {}) {
  const setup = loadPage(payload, options);
  return { ...setup, html: renderToStaticMarkup(await setup.page({ searchParams: Promise.resolve(options.params || {}) })) };
}

const renderClient = (items, props = {}) => renderToStaticMarkup(React.createElement(ConsumerRewardsClient, { items, initialTenant: "", selectedVoucher: null, ...props }));
const pointsSection = (html) => html.match(/<section aria-labelledby="benefits-points-title"[\s\S]*?<\/section>/)?.[0] || "";

test("canonical API tenant slugs retain dots and underscores without collapsing homonymous brands or widening voucher lookup", () => {
  const slugs = ["brand-a", "branda", "brand_a", "brand.a", "a".repeat(120)];
  const source = readModel(list(slugs.map((tenant_slug, index) => claim({ id: `reward-${index}`, claim_id: `claim-${index}`, tenant_slug, tenant_name: "Mismo nombre", redemption_code: "SAME-CODE" }))));
  assert.equal(source.status, "ready");
  assert.deepEqual(source.items.map(item => item.tenant), slugs);
  for (const [index, slug] of slugs.entries()) {
    assert.equal(model.rewardTenant(slug), slug);
    assert.equal(model.findRequestedVoucher(source, "SAME-CODE", slug), `claim-claim-${index}`);
    const html = renderClient(source.items, { initialTenant: slug });
    assert.equal((html.match(/data-reward-state="claimed"/g) || []).length, 1);
  }
  for (const invalid of [null, [], ["brand-a", "branda"], "BRAND_A", "BRAND.A", "A".repeat(61), " brand-a ", "../brand-a", "brand/a", "brand-a&tenant=branda", "a".repeat(121)]) {
    assert.equal(model.rewardTenant(invalid), "");
    assert.equal(model.findRequestedVoucher(source, "SAME-CODE", invalid), null);
  }
  assert.equal(model.findRequestedVoucher(source, "SAME-CODE", undefined), null, "duplicate vouchers across tenant scopes remain ambiguous");
  const legacy = readModel(list([claim({ tenant_slug: "Balmec-AR" })]));
  assert.equal(legacy.status, "ready");assert.equal(model.rewardTenant("Balmec-AR"), "Balmec-AR");assert.equal(legacy.items[0].tenant, "Balmec-AR");
  assert.equal(model.findRequestedVoucher(legacy, "BALMEC-1234", "Balmec-AR"), "claim-claim-1");
  assert.equal(model.findRequestedVoucher(legacy, "BALMEC-1234", "balmec-ar"), null, "legacy casing remains exact without aliasing");
});

test("failed, missing and malformed rewards sources are unavailable; only an explicit successful empty list is empty", () => {
  for (const payload of [null, undefined, [], {}, { ok: false, items: [] }, { items: [] }, { ok: "true", items: [] }, { ok: true }, { ok: true, items: null }, { ok: true, items: {} }]) {
    assert.deepEqual(readModel(payload), { status: "unavailable", items: null });
  }
  assert.deepEqual(readModel(list()), { status: "ready", items: [] });
  for (const row of [null, [], "bad", {}, reward({ id: "" }), reward({ id: "../reward" }), reward({ tenant_slug: "" }), reward({ tenant_slug: ["demobodega"] }), reward({ tenant_slug: "../brand" })]) {
    assert.deepEqual(readModel(list([reward({ id: "valid-first" }), row])), { status: "unavailable", items: null });
  }
  assert.deepEqual(readModel(list([claim(), claim()])), { status: "unavailable", items: null });
  assert.deepEqual(readModel(list([reward(), reward()])), { status: "unavailable", items: null });
});

test("published point costs accept explicit safe integers and never turn missing or invalid values into free rewards", () => {
  for (const value of [0, 100, "0", "540", Number.MAX_SAFE_INTEGER]) assert.equal(readItem(reward({ points_cost: value })).cost, Number(value));
  for (const value of [undefined, null, "", " ", false, true, -1, 0.5, NaN, Infinity, "01", "1.5", "1e2", "100 pts", Number.MAX_SAFE_INTEGER + 1, [], {}]) {
    assert.equal(readItem(reward({ points_cost: value })).cost, null, String(value));
  }
  const html = renderClient(readModel(list([reward({ points_cost: null })])).items);
  assert.match(html, /Costo publicado/);
  assert.match(html, /No informado/);
  assert.doesNotMatch(html, />0\s*<|Gratis|Sin costo/);
});

test("claimed voucher costs use only historical points spent and never substitute today's catalog price", () => {
  for (const points_spent of [0, 80, "80", Number.MAX_SAFE_INTEGER]) {
    assert.equal(readItem(claim({ points_spent, points_cost: 900 })).cost, Number(points_spent));
  }
  for (const points_spent of [undefined, null, "", false, true, -1, 0.5, "01", "80 pts", Number.MAX_SAFE_INTEGER + 1]) {
    const item = readItem(claim({ points_spent, points_cost: 900 }));
    assert.equal(item.cost, null, String(points_spent));
    const html = renderClient([item]);
    assert.match(html, /Puntos del reclamo/);
    assert.match(html, /No informado/);
    assert.doesNotMatch(html, />900\s*<|>0\s*</);
  }
  assert.equal(readItem(reward({ points_cost: 100, points_spent: 80 })).cost, 100, "a published reward still uses its explicitly published price");
});

test("unknown states fail closed and legacy availability is publication, never consumer eligibility", () => {
  for (const state of [undefined, null, "", "approved", "active", "AVAILABLE", "claimed", "redeemed"]) {
    const item = readItem(reward({ state, redemption_code: "UNOWNED-1234" }));
    assert.equal(item.state, "unknown");
    assert.equal(item.hasClaim, false);
    assert.equal(item.code, null);
  }
  for (const state of ["expired", "out_of_stock", "upcoming", "inactive", "locked", "reported"]) assert.equal(readItem(reward({ state })).state, state);
  assert.equal(readItem(reward({ state: "available" })).state, "reported");
  const html = renderClient(readModel(list([reward({ state: "available" })])).items);
  assert.match(html, /Publicado por la marca/);
  assert.match(html, /Publicado no significa reservado/);
  assert.doesNotMatch(html, /Podés canjear|Canjear ahora|Elegible|Disponible para canjear/);
});

test("only an owned, explicitly claimed voucher with a future expiry can expose a code", () => {
  const item = readItem(claim());
  assert.equal(item.hasClaim, true);
  assert.equal(item.state, "claimed");
  assert.equal(item.code, "BALMEC-1234");
  assert.equal(item.expiresAt, "2099-09-09T12:00:00.000Z");
  for (const row of [claim({ claim_id: undefined }), claim({ claim_id: "../claim" }), claim({ claim_status: "approved" }), claim({ claim_expires_at: null }), claim({ claim_expires_at: "2099-09-09" }), claim({ claim_expires_at: "tomorrow" }), claim({ claim_expires_at: NOW }), claim({ claim_expires_at: "2026-09-07T12:00:00Z" })]) {
    const blocked = readItem(row);
    assert.notEqual(blocked.state, "claimed");
    assert.equal(blocked.code, null);
  }
  assert.equal(readItem(claim(), "not-a-clock").code, null);
  for (const redemption_code of [null, undefined, "", "ABC", "WITH SPACE", "<script>", "A".repeat(65), 123456]) assert.equal(readItem(claim({ redemption_code })).code, null);
});

test("impossible calendar dates cannot be normalized into valid voucher expirations", () => {
  for (const claim_expires_at of ["2099-02-29T12:00:00Z", "2099-02-30T12:00:00Z", "2099-04-31T12:00:00Z", "2099-09-09T24:00:00Z"]) {
    const item = readItem(claim({ claim_expires_at }));
    assert.equal(item.expiresAt, null, claim_expires_at);
    assert.equal(item.state, "unknown", claim_expires_at);
    assert.equal(item.code, null, claim_expires_at);
  }
  assert.equal(readItem(claim({ claim_expires_at: "2096-02-29T12:00:00+03:00" })).expiresAt, "2096-02-29T09:00:00.000Z");
});

test("redeemed, cancelled and expired vouchers remain history and never expose actionable codes", () => {
  for (const state of ["redeemed", "cancelled", "expired"]) {
    const item = readItem(claim({ claim_status: state }));
    assert.equal(item.state, state);
    assert.equal(item.hasClaim, true);
    assert.equal(item.code, null);
    const html = renderClient([item], { selectedVoucher: item.key });
    assert.match(html, new RegExp(model.REWARD_STATE_LABELS[state]));
    assert.doesNotMatch(html, /BALMEC-1234|Código del voucher|Copiar código/);
  }
});

test("voucher links resolve only a unique active account voucher within the requested tenant", () => {
  const source = readModel(list([claim(), claim({ id: "reward-2", claim_id: "claim-2", tenant_slug: "otra-marca", redemption_code: "OTHER-1234" })]));
  assert.equal(model.findRequestedVoucher(source, "balmec-1234", "demobodega"), "claim-claim-1");
  assert.equal(model.findRequestedVoucher(source, "BALMEC-1234", ""), "claim-claim-1");
  assert.equal(model.findRequestedVoucher(source, "BALMEC-1234", undefined), "claim-claim-1");
  for (const tenant of [null, ["demobodega"], "../demobodega", {}, 123]) assert.equal(model.findRequestedVoucher(source, "BALMEC-1234", tenant), null);
  for (const voucher of [undefined, null, ["BALMEC-1234"], "UNKNOWN-1234", "BALMEC 1234", "<script>"]) assert.equal(model.findRequestedVoucher(source, voucher, "demobodega"), null);
  assert.equal(model.findRequestedVoucher(source, "BALMEC-1234", "otra-marca"), null);
  assert.equal(model.findRequestedVoucher({ status: "unavailable", items: null }, "BALMEC-1234", "demobodega"), null);
  const duplicate = readModel(list([claim(), claim({ id: "reward-2", claim_id: "claim-2" })]));
  assert.equal(model.findRequestedVoucher(duplicate, "BALMEC-1234", "demobodega"), null);
  const acrossTenants = readModel(list([claim(), claim({ id: "reward-2", claim_id: "claim-2", tenant_slug: "otra-marca" })]));
  assert.equal(model.findRequestedVoucher(acrossTenants, "BALMEC-1234", ""), null);
  assert.equal(model.findRequestedVoucher(acrossTenants, "BALMEC-1234", "demobodega"), "claim-claim-1");
});

test("reward projection excludes consumer identity, internal data and arbitrary backend fields", () => {
  const item = readItem(claim({ consumer_id: "private-consumer", email: "private@example.test", metadata: { secret: "private-secret" }, token: "private-token" }));
  assert.doesNotMatch(JSON.stringify(item), /consumer_id|private-|private@|metadata|token/);
});

test("SSR authorizes before starting precisely the rewards and wallet reads in parallel", async () => {
  let authorize;
  const session = new Promise((resolve) => { authorize = resolve; });
  const resolvers = [];
  const setup = loadPage(list(), { authorize: () => session, fetch: (path) => new Promise((resolve) => resolvers.push(() => resolve(path === "rewards" ? list() : wallet()))) });
  const pending = setup.page({ searchParams: Promise.resolve({ tenant: "demobodega", voucher: "BALMEC-1234" }) });
  await new Promise(setImmediate);
  assert.deepEqual(setup.calls, [["session", "/me/rewards?tenant=demobodega&voucher=BALMEC-1234"]]);
  authorize();
  await new Promise(setImmediate);
  assert.deepEqual(setup.calls.slice(1), [["fetch", "rewards"], ["fetch", "wallet"]]);
  assert.equal(resolvers.length, 2, "both source reads start before either resolves");
  resolvers.forEach((resolve) => resolve());
  await pending;
  const denied = loadPage(list(), { authorize: async () => { throw new Error("redirect-login"); } });
  await assert.rejects(() => denied.page({}), /redirect-login/);
  assert.deepEqual(denied.calls, [["session", "/me/rewards"]]);
});

test("SSR distinguishes unavailable rewards from empty results and keeps wallet availability independent", async () => {
  const failed = await render({ ok: false, items: [] });
  assert.match(failed.html, /No pudimos cargar tus beneficios/);
  assert.match(failed.html, /Reintentar carga/);
  assert.match(pointsSection(failed.html), /Bodega Balmec|540/);
  assert.equal(failed.clientProps.length, 0);
  assert.doesNotMatch(failed.html, /Tus próximos beneficios, acá/);
  const empty = await render(list());
  assert.match(empty.html, /Tus próximos beneficios, acá/);
  assert.doesNotMatch(empty.html, /No pudimos cargar tus beneficios/);
  const failedWallet = await render(list([claim()]), { wallet: null });
  assert.match(pointsSection(failedWallet.html), /No pudimos cargar tus puntos/);
  assert.doesNotMatch(pointsSection(failedWallet.html), /Todavía no tenés|>0\s*</);
  assert.match(failedWallet.html, /BALMEC-1234/);
  const noBrands = await render(list(), { wallet: wallet({ tenantWallets: [] }) });
  assert.match(pointsSection(noBrands.html), /Todavía no tenés puntos por marca/);
  assert.doesNotMatch(pointsSection(noBrands.html), /No pudimos cargar|>0\s*</);
});

test("SSR preserves independent brand balances and never combines points or borrows network balances", async () => {
  const { html } = await render(list(), { wallet: wallet({ tenantWallets: [{ slug: "brand-a", name: "Marca A", points_balance: 540 }, { slug: "brand-b", name: "Marca B", points_balance: 270 }, { slug: "brand-c", name: "Marca C", points_balance: null }], networkWallet: { enabled: true, points_balance: 999 } }) });
  const section = pointsSection(html);
  assert.equal((section.match(/data-benefit-points="brand"/g) || []).length, 3);
  assert.match(section, /Marca A[\s\S]*?>540</);
  assert.match(section, /Marca B[\s\S]*?>270</);
  assert.match(section, /Marca C[\s\S]*?No informado/);
  assert.doesNotMatch(section, />810<|>999<|Saldo total|Saldo de red/);
});

test("SSR voucher links cannot announce confirmation for unmatched, cross-tenant, duplicate or unavailable sources", async () => {
  for (const [payload, params] of [[list([claim()]), { voucher: "UNKNOWN-1234" }], [list([claim()]), { voucher: "BALMEC-1234", tenant: "otra-marca" }], [list([claim(), claim({ id: "reward-2", claim_id: "claim-2" })]), { voucher: "BALMEC-1234" }], [list([claim({ claim_status: "redeemed" })]), { voucher: "BALMEC-1234" }], [{ ok: false }, { voucher: "BALMEC-1234" }]]) {
    const { html, clientProps } = await render(payload, { params });
    assert.doesNotMatch(html, /Encontramos el voucher en tu cuenta/);
    for (const props of clientProps) assert.equal(props.selectedVoucher, null);
  }
  const valid = await render(list([claim()]), { params: { voucher: "BALMEC-1234", tenant: "demobodega" } });
  assert.match(valid.html, /Encontramos el voucher en tu cuenta/);
  assert.match(valid.html, /data-selected="true"/);
  assert.match(valid.html, /<details[^>]*open=""/);
  assert.equal(valid.clientProps[0].selectedVoucher, "claim-claim-1");
});

test("SSR invalid tenant parameters cannot widen a voucher link to all account brands", async () => {
  for (const tenant of ["../demobodega", "demobodega other", ["demobodega", "otra-marca"]]) {
    const { html, clientProps } = await render(list([claim()]), { params: { voucher: "BALMEC-1234", tenant } });
    assert.doesNotMatch(html, /Encontramos el voucher en tu cuenta/);
    assert.equal(clientProps[0].selectedVoucher, null);
  }
});

test("SSR client starts with all kinds, an empty search and only the requested brand filter", () => {
  const items = readModel(list([claim(), reward({ id: "reward-2", title: "Beneficio de otra marca", tenant_slug: "otra-marca", tenant_name: "Otra marca" })])).items;
  const html = renderClient(items);
  assert.match(html, /aria-pressed="true">Todos</);
  assert.match(html, /aria-pressed="false">Mis vouchers</);
  assert.match(html, /aria-pressed="false">Publicados</);
  assert.match(html, /type="search"[^>]*value=""/);
  assert.match(html, /<option value="" selected="">Todas las marcas/);
  assert.match(html, /2 registros/);
  assert.doesNotMatch(html, /Limpiar filtros/);
  const filtered = renderClient(items, { initialTenant: "demobodega" });
  assert.match(filtered, /<option value="demobodega" selected="">/);
  assert.match(filtered, /1 registro con estos filtros/);
  assert.match(filtered, /Limpiar filtros/);
  assert.doesNotMatch(filtered, /<h3>Beneficio de otra marca<\/h3>/);
  const unknownBrand = renderClient(items, { initialTenant: "absent-brand" });
  assert.match(unknownBrand, /<option value="absent-brand" selected="">Marca del enlace/);
  assert.match(unknownBrand, /No hay coincidencias/);
  assert.match(unknownBrand, /Mostrar todos/);
  assert.doesNotMatch(unknownBrand, /data-reward-state=/);
});

test("SSR codes remain copyable as text and date labels explicitly identify the Argentina timezone", () => {
  const item = readItem(claim());
  const html = renderClient([item]);
  assert.match(html, /<code>BALMEC-1234<\/code>/);
  assert.match(html, /Copiar código/);
  assert.match(html, /\(Argentina\)/);
  assert.match(html, /La empresa confirma el canje y sus condiciones/);
  assert.equal(model.rewardDateLabel(null), "No informado");
  assert.match(clientSource, /navigator\.clipboard\.writeText\(code\)/);
  assert.match(clientSource, /No se pudo copiar/);
});

test("voucher dates use stable numeric Argentina labels across UTC day boundaries", () => {
  assert.equal(model.rewardDateLabel("2099-09-09T12:00:00Z"), "09/09/2099 · 09:00 (Argentina)");
  assert.equal(model.rewardDateLabel("2026-01-01T00:30:00Z"), "31/12/2025 · 21:30 (Argentina)");
  assert.equal(model.rewardDateLabel("2026-01-01T03:00:00Z"), "01/01/2026 · 00:00 (Argentina)");
  assert.equal(model.rewardDateLabel("2026-01-01T03:00:00+03:00"), "31/12/2025 · 21:00 (Argentina)");
  assert.equal(model.rewardDateLabel("invalid-date"), "No informado");
  assert.equal(model.rewardDateLabel(null), "No informado");
});

test("reward views inherit accessible light and dark tokens without polling or automatic requests", () => {
  for (const token of ["text", "muted", "surface", "subtle", "border", "accent", "active", "danger", "danger-bg"]) assert.ok(cssSource.includes(`var(--portal-${token})`), token);
  assert.match(cssSource, /:focus-visible/);
  assert.match(cssSource, /prefers-reduced-motion/);
  assert.match(cssSource, /@media \(max-width:/);
  assert.match(cssSource, /overflow-wrap: anywhere/);
  assert.doesNotMatch(cssSource, /background:\s*(?:white|black|#[0-9a-f]+)\s*[;}]/i);
  assert.doesNotMatch(modelSource + clientSource, /\bfetch\s*\(|setInterval|setTimeout|Math\.random|Date\.now|router\.refresh|dangerouslySetInnerHTML/);
  assert.doesNotMatch(pageSource + clientSource, /method\s*[:=]\s*["'](?:post|put|patch|delete)|claimReward|redeemReward|redemption\/confirm/i);
  assert.doesNotMatch(pageSource, /fetchConsumerPath\(["'](?:products|taps|catalog|brands|marketplace)/);
});

function marketplaceLinkHref(html) {
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(match => match[1])
    .filter(href => href === "/me/marketplace" || href.startsWith("/me/marketplace?"));
  assert.equal(links.length, 1, "one marketplace destination in the benefits client");
  return links[0];
}

test("benefits catalog destination retains the selected tenant instead of another own brand", () => {
  const items = readModel(list([
    reward({ id: "reward-a", tenant_slug: "brand-a", tenant_name: "Misma marca", title: "Beneficio A" }),
    reward({ id: "reward-b", tenant_slug: "brand-b", tenant_name: "Misma marca", title: "Beneficio B" }),
  ])).items;
  for (const [tenant, ownTitle, otherTitle] of [["brand-a", "Beneficio A", "Beneficio B"], ["brand-b", "Beneficio B", "Beneficio A"]]) {
    const html = renderClient(items, { initialTenant: tenant });
    assert.equal(marketplaceLinkHref(html), `/me/marketplace?tenant=${encodeURIComponent(tenant)}`);
    assert.ok(html.includes(ownTitle));
    assert.ok(!html.includes(otherTitle));
    assert.match(html, /Catálogo de esta marca/);
  }
});

test("catalog tenant encoding preserves the existing canonical and legacy slug contract", () => {
  for (const tenant of ["brand_a", "brand.a", "Balmec-AR", "a".repeat(120)]) {
    assert.equal(model.rewardTenant(tenant), tenant);
    const items = readModel(list([reward({ tenant_slug: tenant })])).items;
    const href = marketplaceLinkHref(renderClient(items, { initialTenant: tenant }));
    assert.equal(href, `/me/marketplace?tenant=${encodeURIComponent(tenant)}`);
    const url = new URL(href, "https://portal.invalid");
    assert.equal(url.pathname, "/me/marketplace");
    assert.deepEqual([...url.searchParams.entries()], [["tenant", tenant]]);
    assert.equal(url.hash, "");
  }
});

test("missing, empty and invalid tenant scopes keep the existing unscoped catalog fallback", async () => {
  const payload = list([reward({ tenant_slug: "brand-a" }), reward({ id: "reward-b", tenant_slug: "brand-b" })]);
  for (const params of [{}, { tenant: "" }, { tenant: null }, { tenant: ["brand-a", "brand-b"] },
    ...["../brand-a", "brand/a", " brand-a ", "brand-a&tenant=brand-b", "brand-a%26tenant=brand-b", "brand-a#other", "BRAND_A", "BRAND.A", "A".repeat(61), "a".repeat(121)].map(tenant => ({ tenant }))]) {
    const { html, clientProps, calls } = await render(payload, { params });
    assert.equal(clientProps[0].initialTenant, "");
    assert.equal(marketplaceLinkHref(html), "/me/marketplace");
    assert.match(html, /Explorar catálogo/);
    assert.deepEqual(calls.slice(1), [["fetch", "rewards"], ["fetch", "wallet"]]);
  }
});

test("a valid explicit tenant with no matching benefits does not fall back to another brand", () => {
  const items = readModel(list([reward({ tenant_slug: "brand-b" })])).items;
  const html = renderClient(items, { initialTenant: "absent-brand" });
  assert.match(html, /No hay coincidencias/);
  assert.equal(marketplaceLinkHref(html), "/me/marketplace?tenant=absent-brand");
  assert.doesNotMatch(html, /data-reward-state=/);
});

test("optional program balances preserve zero and safe amounts without borrowing brand or network fields", () => {
  for (const value of [0, "0", 80, "80", Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)]) {
    assert.equal(readItem(reward({ program_points_balance: value })).programBalance, Number(value));
  }
  for (const value of [undefined, null, "", " ", false, true, -1, 0.5, NaN, Infinity, "01", "1.5", "1e2", "80 pts", Number.MAX_SAFE_INTEGER + 1, "9007199254740992", [], {}]) {
    const item = readItem(reward({ program_points_balance: value, points_balance: 540, membership_points_balance: 540, network_points_balance: 999 }));
    assert.equal(item.programBalance, null);
    assert.equal(item.cost, 100);
    const html = renderClient([item]);
    assert.match(html, /data-benefit-points="program"><span>Saldo actual del programa<\/span><strong>No informado<\/strong>/);
    assert.doesNotMatch(html, /Podés canjear|Canjear ahora|Solicitar voucher/);
  }
});

test("SSR keeps each selected brand program balance separate from its wallet and other programs", async () => {
  const payload = list([
    reward({ id: "reward-a", tenant_slug: "brand-a", tenant_name: "Misma marca", title: "Beneficio A", program_name: "Club A", program_points_balance: 0 }),
    reward({ id: "reward-b", tenant_slug: "brand-b", tenant_name: "Misma marca", title: "Beneficio B", program_name: "Club B", program_points_balance: 77 }),
    reward({ id: "reward-unknown", tenant_slug: "brand-a", tenant_name: "Misma marca", title: "Beneficio sin saldo", program_name: "Otro programa A" }),
  ]);
  const wallets = wallet({ tenantWallets: [{ slug: "brand-a", name: "Misma marca", points_balance: 540 }, { slug: "brand-b", name: "Misma marca", points_balance: 270 }], networkWallet: { enabled: true, points_balance: 999 } });
  for (const [tenant, ownTitle, otherTitle, balance] of [["brand-a", "Beneficio A", "Beneficio B", 0], ["brand-b", "Beneficio B", "Beneficio A", 77]]) {
    const { html, calls } = await render(payload, { params: { tenant }, wallet: wallets });
    const cards = [...html.matchAll(/<article\b[^>]*data-reward-state=[\s\S]*?<\/article>/g)].map(match => match[0]);
    const own = cards.find(card => card.includes(ownTitle));
    assert.ok(own);
    assert.ok(cards.every(card => !card.includes(otherTitle)));
    assert.match(own, new RegExp('data-benefit-points="program"><span>Saldo actual del programa<\\/span><strong>' + balance + ' <small>pts<\\/small>'));
    assert.doesNotMatch(own, /<strong>(?:540|270|999) /);
    assert.match(own, /Todavía no se puede reservar/);
    assert.equal(marketplaceLinkHref(html), "/me/marketplace?tenant=" + tenant);
    assert.deepEqual(calls.slice(1), [["fetch", "rewards"], ["fetch", "wallet"]]);
    if (tenant === "brand-a") {
      const unknown = cards.find(card => card.includes("Beneficio sin saldo"));
      assert.match(unknown, /data-benefit-points="program"><span>Saldo actual del programa<\/span><strong>No informado<\/strong>/);
    }
  }
  const mismatch = await render(payload, { params: { tenant: "brand-c" }, wallet: wallets });
  assert.doesNotMatch(mismatch.html, /data-reward-state=|data-benefit-points="program"/);
});

const reservableReward = (overrides = {}) => reward({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", program_points_balance: 120,
  catalog_state: "reported", claim_id: null, claim_status: null, claim_expires_at: null,
  redemption_code: null, points_spent: null, can_claim: true,
  claimIntent: "portal-first-reservation.v1", ...overrides,
});

test("relationship guidance opens the exact canonical brand without widening scope or inferring legacy identifiers", () => {
  for (const tenant of ["brand-a", "brand_a", "brand.a", "a".repeat(120)]) {
    const item = readItem(reward({ tenant_slug: tenant, claim_unavailable_reasons: ["brand_connection_required"] }));
    const action = rewardNextActions(item, { busy: false, hasQuote: false });
    assert.ok(action);
    const url = new URL(action.href, "https://portal.invalid");
    assert.equal(url.origin, "https://portal.invalid");
    assert.equal(url.pathname, "/me/brands");
    assert.deepEqual([...url.searchParams.entries()], [["tenant", tenant]]);
    assert.equal(url.hash, "");
  }
  const item = readItem(reward({ claim_unavailable_reasons: ["brand_connection_required"] }));
  for (const tenant of ["Balmec-AR", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", " Brand-A ", "brand/a", "brand?tenant=other", "brand#other", "a".repeat(121), null]) {
    assert.equal(rewardNextActions({ ...item, tenant }, { busy: false, hasQuote: false }), null);
  }
});

test("connection and program participation have distinct advice but share a single consultation action", () => {
  const reasons = Object.freeze(["program_participation_required", "brand_connection_required", "brand_connection_required"]);
  const item = readItem(reward({ claim_unavailable_reasons: reasons }));
  const action = rewardNextActions(item, { busy: false, hasQuote: false });
  assert.equal(action.guidance.length, 2);
  assert.match(action.guidance[0], /vínculo pausado o bloqueado puede necesitar revisión/);
  assert.match(action.guidance[1], /Inscribirme en beneficios.*sólo si la marca habilita esa opción/);
  assert.deepEqual(reasons, ["program_participation_required", "brand_connection_required", "brand_connection_required"]);
  const html = renderClient([item]);
  const detail = html.match(/<details\b[\s\S]*?<\/details>/)?.[0];
  assert.ok(detail);
  assert.equal((detail.match(/href="\/me\/brands\?tenant=demobodega"/g) || []).length, 1);
  assert.match(detail, /Ver mi relación con Bodega Balmec/);
  assert.doesNotMatch(html.slice(0, html.indexOf("<details")), /Cómo continuar|Ver mi relación/);
  assert.doesNotMatch(html, /href="[^"]*(?:fromTap|eventId|freshToken)|Reservar beneficio/);
});

test("every reservation priority suppresses navigation to a new relationship step", () => {
  const item = readItem(reward({ claim_unavailable_reasons: ["brand_connection_required", "program_participation_required"] }));
  assert.equal(rewardNextActions(item, { busy: true, hasQuote: false }), null);
  assert.equal(rewardNextActions(item, { busy: false, hasQuote: true }), null);
  for (const state of ["expired", "out_of_stock", "inactive", "upcoming", "unknown"]) {
    const unavailable = { ...item, state };
    assert.equal(rewardNextActions(unavailable, { busy: false, hasQuote: false }), null);
    assert.doesNotMatch(renderClient([unavailable]), /reward-next-steps|Ver mi relación/);
  }
  for (const overrides of [{ hasClaim: true }, { reservationNeedsRefresh: true }, { reservation: { claimIntent: "portal-first-reservation.v1", pointsCost: 100 } }]) {
    assert.equal(rewardNextActions({ ...item, ...overrides }, { busy: false, hasQuote: false }), null);
  }
});

test("legacy, unsupported and malformed requirements never create an enrollment or age-verification shortcut", () => {
  const item = readItem(reward());
  for (const reasons of [undefined, [], ["age_verification_required"], ["brand_conditions_review"], ["account_review"], ["brand_connection_required", "unknown_requirement"], new Array(2), [null], new Array(8).fill("brand_connection_required")]) {
    const candidate = { ...item, claimUnavailableReasons: reasons };
    assert.equal(rewardNextActions(candidate, { busy: false, hasQuote: false }), null);
    const parsed = readItem(reward({ claim_unavailable_reasons: reasons }));
    assert.doesNotMatch(renderClient([parsed]), /reward-next-steps|Ver mi relación|Verificar edad ahora|Inscribirme ahora/);
  }
});

test("authoritative quotes, incomplete quote recovery and terminal voucher history retain their existing paths", () => {
  const reasons = ["brand_connection_required", "program_participation_required"];
  const complete = readItem(reservableReward({ claim_unavailable_reasons: reasons }));
  const quotedHtml = renderClient([complete]);
  assert.match(quotedHtml, /Reservar beneficio/);
  assert.doesNotMatch(quotedHtml, /reward-next-steps|Ver mi relación/);
  const incomplete = readItem(reservableReward({ program_name: null, claim_unavailable_reasons: reasons }));
  const incompleteHtml = renderClient([incomplete]);
  assert.match(incompleteHtml, /Volver a cargar la información/);
  assert.doesNotMatch(incompleteHtml, /reward-next-steps|Ver mi relación/);
  for (const claim_status of ["claimed", "redeemed", "cancelled", "expired"]) {
    const voucher = readItem(claim({ claim_status, claim_unavailable_reasons: reasons }));
    assert.doesNotMatch(renderClient([voucher]), /reward-next-steps|Ver mi relación/);
  }
});

test("relationship navigation uses the tenant and safely renders a brand name independently of its URL", () => {
  const item = readItem(reward({ tenant_name: 'Marca <script> & "otra"', claim_unavailable_reasons: ["program_participation_required"] }));
  const html = renderClient([item]);
  assert.match(html, /href="\/me\/brands\?tenant=demobodega"/);
  assert.match(html, /Ver mi relación con Marca &lt;script&gt; &amp; &quot;otra&quot;/);
  assert.doesNotMatch(html, /<script>|href="[^"]*(?:script|otra)/);
});

test("private availability reasons explain all reported requirements without adding reservation authority", () => {
  const reasons = ["age_verification_required", "insufficient_program_points", "brand_connection_required",
    "program_participation_required", "brand_conditions_review", "availability_review", "account_review"];
  const item = readItem(reservableReward({ can_claim: false, claimIntent: undefined,
    program_points_balance: 40, claim_unavailable_reasons: reasons }));
  assert.deepEqual(item.claimUnavailableReasons, reasons);
  assert.equal(reservation.rewardReservationQuote(item), null);
  const html = renderClient([item]);
  assert.match(html, /Antes de reservar/);
  assert.match(html, /requiere verificación de edad/);
  assert.match(html, /Te faltan 60 puntos en este programa/);
  assert.match(html, /vínculo activo con la marca/);
  assert.match(html, /requiere participar en el programa/);
  assert.match(html, /confirmar las condiciones/);
  assert.match(html, /confirmar la vigencia y los cupos/);
  assert.match(html, /Necesitamos revisar los datos de tu cuenta/);
  assert.equal((html.match(/<li>/g) || []).length, 7);
  assert.match(html, /Consultá los 7 requisitos en el detalle/);
  assert.doesNotMatch(html, /Reservar beneficio|Verificar edad ahora|Confirmar reserva por|age_verification_required|can_claim/);
});

test("duplicate known requirements remain a single bounded explanation", () => {
  const item = readItem(reward({ claim_unavailable_reasons: ["brand_connection_required", "brand_connection_required"] }));
  assert.deepEqual(item.claimUnavailableReasons, ["brand_connection_required"]);
  const html = renderClient([item]);
  assert.equal((html.match(/<li>/g) || []).length, 1);
  assert.doesNotMatch(html, /requisitos en el detalle|Reservar beneficio/);
});

test("unknown or malformed optional notices fall back without hiding a valid legacy collection", () => {
  const malformed = [null, "age_verification_required", {}, true,
    ["unknown_requirement"], ["age_verification_required", "unknown_requirement"],
    ["AGE_VERIFICATION_REQUIRED"], [" age_verification_required"], ["account_review", null],
    ["account_review", {}], ["account_review", 1], new Array(1),
    new Array(8).fill("account_review"), ["<script>claim-now</script>"]];
  for (const claim_unavailable_reasons of malformed) {
    const source = readModel(list([reward({ claim_unavailable_reasons }), reward({ id: "reward-2" })]));
    assert.equal(source.status, "ready");
    assert.equal(source.items.length, 2);
    assert.equal(source.items[0].claimUnavailableReasons, undefined);
    assert.equal(reservation.rewardReservationQuote(source.items[0]), null);
    const html = renderClient(source.items);
    assert.match(html, /Todavía no se puede reservar/);
    assert.match(html, /Publicado no significa reservado/);
    assert.doesNotMatch(html, /verificación de edad|unknown_requirement|claim-now|Reservar beneficio/);
  }
});

test("absent and empty notice arrays preserve legacy information and never imply eligibility", () => {
  for (const claim_unavailable_reasons of [undefined, []]) {
    const item = readItem(reward({ claim_unavailable_reasons }));
    assert.equal(item.reservation, undefined);
    assert.equal(item.reservationNeedsRefresh, undefined);
    const html = renderClient([item]);
    assert.match(html, /La marca tiene que confirmar los requisitos y la disponibilidad/);
    assert.doesNotMatch(html, /Reservar beneficio|Volver a cargar la información/);
  }
});

test("notices cannot bypass a false, missing or malformed capability", () => {
  for (const can_claim of [undefined, false, "true", 1]) {
    for (const claim_unavailable_reasons of [[], ["account_review"], ["unknown_requirement"]]) {
      const item = readItem(reservableReward({ can_claim, claim_unavailable_reasons }));
      assert.equal(item.reservation, undefined);
      assert.equal(reservation.rewardReservationQuote(item), null);
      assert.doesNotMatch(renderClient([item]), /Reservar beneficio|Confirmar reserva por/);
    }
  }
});

test("a complete authoritative quote retains the existing confirmation path regardless of advisory notices", () => {
  for (const claim_unavailable_reasons of [undefined, [], ["account_review"], ["unknown_requirement"], null]) {
    const item = readItem(reservableReward({ claim_unavailable_reasons }));
    const quote = reservation.rewardReservationQuote(item);
    assert.equal(quote.pointsCost, 100);
    assert.equal(quote.programBalance, 120);
    assert.equal(item.reservationNeedsRefresh, undefined);
    const html = renderClient([item]);
    assert.match(html, /Reservar beneficio/);
    assert.match(html, /Revisá el costo y confirmá antes de continuar/);
    assert.doesNotMatch(html, /Antes de reservar|Todavía no se puede reservar|Volver a cargar la información/);
  }
});

test("an incomplete advertised quote asks for fresh information rather than blaming a brand requirement", () => {
  for (const extra of [{ program_name: null }, { program_points_balance: null }, { points_cost: "100" },
    { claimIntent: undefined }, { claim_id: undefined }, { redemption_code: "UNOWNED-1234" }]) {
    const item = readItem(reservableReward({ ...extra, claim_unavailable_reasons: ["age_verification_required"] }));
    assert.equal(item.reservationNeedsRefresh, true);
    assert.equal(reservation.rewardReservationQuote(item), null);
    const html = renderClient([item]);
    assert.match(html, /Necesitamos actualizar los datos/);
    assert.match(html, /No pudimos confirmar todos los datos para reservar/);
    assert.match(html, /href="\/me\/rewards\?tenant=demobodega">Volver a cargar la información/);
    assert.doesNotMatch(html, /Reservar beneficio|verificación de edad|UNOWNED-1234|Confirmar reserva por/);
  }
});

test("refresh navigation retains a sanitized benefit tenant and cannot inject parameters or a fragment", () => {
  for (const tenant of ["brand_a", "brand.a", "Balmec-AR", "a".repeat(120)]) {
    const item = readItem(reservableReward({ tenant_slug: tenant, program_name: null }));
    const html = renderClient([item]);
    const match = html.match(/<a\b[^>]*href="([^"]+)"[^>]*>Volver a cargar la información<\/a>/);
    assert.ok(match);
    const url = new URL(match[1], "https://portal.invalid");
    assert.equal(url.pathname, "/me/rewards");
    assert.deepEqual([...url.searchParams.entries()], [["tenant", tenant]]);
    assert.equal(url.hash, "");
  }
});

test("insufficient points explanations never borrow wallet balances or fabricate a negative shortfall", () => {
  for (const program_points_balance of [null, 100, 120]) {
    const item = readItem(reward({ program_points_balance, points_balance: 1_000, network_points_balance: 10_000,
      claim_unavailable_reasons: ["insufficient_program_points"] }));
    const html = renderClient([item]);
    assert.match(html, /El programa necesita confirmar un saldo suficiente/);
    assert.doesNotMatch(html, /Te faltan|1,?000|10,?000|Reservar beneficio/);
  }
});

test("owned terminal vouchers retain history without new requirements, refresh links or active codes", () => {
  for (const state of ["redeemed", "cancelled", "expired"]) {
    const item = readItem(claim({ claim_status: state,
      claim_unavailable_reasons: ["age_verification_required", "account_review"], can_claim: true }));
    assert.equal(item.code, null);
    assert.equal(item.reservationNeedsRefresh, undefined);
    const html = renderClient([item]);
    assert.match(html, new RegExp(model.REWARD_STATE_LABELS[state]));
    assert.doesNotMatch(html, /Antes de reservar|verificación de edad|actualizar los datos|Volver a cargar la información|Código del voucher|BALMEC-1234|Reservar beneficio/);
  }
});

test("known catalog lifecycle remains the primary explanation while other reported requirements stay in detail", () => {
  for (const [state, headline, explanation] of [
    ["expired", "Este beneficio ya venció", "El beneficio figura como vencido"],
    ["out_of_stock", "Este beneficio no tiene cupos", "El beneficio figura sin cupos"],
    ["inactive", "Este beneficio no está habilitado", "La marca no tiene habilitada la reserva de este beneficio"],
    ["upcoming", "Todavía no se puede reservar", "Este beneficio todavía no está habilitado"],
  ]) {
    const item = readItem(reward({ state, claim_unavailable_reasons: ["age_verification_required", "availability_review", "account_review"] }));
    const html = renderClient([item]);
    const primary = html.match(/<div class="availabilityNotice">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(primary);
    assert.match(primary, new RegExp(headline));
    assert.match(primary, new RegExp(explanation));
    assert.doesNotMatch(primary, /verificación de edad|confirmar la vigencia y los cupos/);
    const detail = html.match(/<ul class="requirements">([\s\S]*?)<\/ul>/)?.[1];
    assert.ok(detail);
    assert.match(detail, new RegExp("^<li>" + explanation));
    assert.match(detail, /requiere verificación de edad/);
    assert.match(detail, /Necesitamos revisar los datos de tu cuenta/);
    assert.equal((detail.match(/<li>/g) || []).length, 3);
    assert.doesNotMatch(html, /Reservar beneficio|Confirmar reserva por/);
  }
});

test("a known expired catalog state cannot hide or add to the seven reported requirements", () => {
  const reasons = ["age_verification_required", "insufficient_program_points", "brand_connection_required",
    "program_participation_required", "brand_conditions_review", "availability_review", "account_review"];
  const item = readItem(reward({ state: "expired", program_points_balance: 40, claim_unavailable_reasons: reasons }));
  const html = renderClient([item]);
  assert.match(html, /Este beneficio ya venció/);
  const detail = html.match(/<ul class="requirements">([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(detail);
  assert.equal((detail.match(/<li>/g) || []).length, 7);
  assert.match(detail, /Te faltan 60 puntos/);
  assert.match(detail, /requiere verificación de edad/);
  assert.match(detail, /vínculo activo con la marca/);
  assert.match(detail, /requiere participar en el programa/);
  assert.match(detail, /confirmar las condiciones/);
  assert.match(detail, /figura como vencido/);
  assert.match(detail, /Necesitamos revisar los datos de tu cuenta/);
  assert.doesNotMatch(detail, /confirmar la vigencia y los cupos/);
  assert.deepEqual(item.claimUnavailableReasons, reasons, "display ordering must not mutate the private read model");
});
