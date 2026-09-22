import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as tapHandoff from "../src/app/api/_lib/consumer-tap-handoff.ts";

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
const api = compile(read("_components/consumer-api.ts"), {
  "next/headers": { headers: () => { throw new Error("unexpected-network-read"); } },
  "next/navigation": { redirect: () => { throw new Error("unexpected-redirect"); } },
  "./consumer-portal-model": { shouldRedirectToConsumerAuth: () => false },
});
const css = Object.fromEntries([...cssSource.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => [match[1], match[1]]));
const shared = {
  "next/link": ({ children, ...props }) => React.createElement("a", props, children),
  "./rewards.module.css": css,
  "../_components/consumer-rewards-model": model,
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
      requireConsumerSession: async (next) => { calls.push(["session", next]); if (options.authorize) await options.authorize(); },
      fetchConsumerPath: async (path) => {
        calls.push(["fetch", path]);
        if (options.fetch) return options.fetch(path);
        return path === "rewards" ? payload : Object.hasOwn(options, "wallet") ? options.wallet : wallet();
      },
    },
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

test("reward views inherit accessible light and dark tokens without polling or reward mutations", () => {
  for (const token of ["text", "muted", "surface", "subtle", "border", "accent", "active", "danger", "danger-bg"]) assert.ok(cssSource.includes(`var(--portal-${token})`), token);
  assert.match(cssSource, /:focus-visible/);
  assert.match(cssSource, /prefers-reduced-motion/);
  assert.match(cssSource, /@media \(max-width:/);
  assert.match(cssSource, /overflow-wrap: anywhere/);
  assert.doesNotMatch(cssSource, /background:\s*(?:white|black|#[0-9a-f]+)\s*[;}]/i);
  assert.doesNotMatch(modelSource + clientSource, /\bfetch\s*\(|setInterval|setTimeout|Math\.random|Date\.now|router\.refresh|useEffect|dangerouslySetInnerHTML/);
  assert.doesNotMatch(pageSource + clientSource, /method\s*[:=]\s*["'](?:post|put|patch|delete)|claimReward|redeemReward|redemption\/confirm/i);
  assert.doesNotMatch(pageSource, /fetchConsumerPath\(["'](?:products|taps|catalog|brands|marketplace)/);
});
