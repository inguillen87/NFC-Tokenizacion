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
import * as consumerLoginContinuation from "../src/app/login/consumer-login-continuation.ts";

const require = createRequire(import.meta.url);
const dir = new URL("../src/app/me/", import.meta.url);
const read = (path) => readFileSync(new URL(path, dir), "utf8");
const modelSource = read("_components/consumer-rewards-model.ts");
const pageSource = read("rewards/page.tsx");
const clientSource = read("rewards/rewards-client.tsx");
const presentationClockSource = read("_components/consumer-reward-presentation-clock.ts");
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
const presentationClock = compile(presentationClockSource);
const reservation = compile(read("_components/consumer-reward-reservation.ts"), { "./consumer-rewards-model": model, "./consumer-bounded-fetch": boundedFetch });
const api = compile(read("_components/consumer-api.ts"), {
  "next/headers": { headers: () => { throw new Error("unexpected-network-read"); } },
  "next/navigation": { redirect: () => { throw new Error("unexpected-redirect"); } },
  "./consumer-bounded-fetch": boundedFetch,
  "@product/config": { productUrls: { api: "https://api.nexid.lat" } },
  "../../api/_lib/server-api-transport": { fetchRuntimeApi: () => { throw Error("Unexpected network read"); } },
});
const css = Object.fromEntries([...cssSource.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => [match[1], match[1]]));
const brandPointsRead = compile(read("_components/consumer-wallet-brand-read.ts"), {
  "./consumer-bounded-fetch": boundedFetch, "./consumer-wallet-points-model": walletModel,
});
const { ConsumerRewardBrandPoints } = compile(read("_components/consumer-reward-brand-points-client.tsx"), {
  "next/link": ({ children, prefetch, ...props }) => React.createElement("a", props, children),
  "../rewards/rewards.module.css": css, "./consumer-rewards-model": model,
  "../../login/consumer-login-continuation": consumerLoginContinuation,
  "./consumer-wallet-brand-read": brandPointsRead,
});
const shared = {
  "next/link": ({ children, prefetch, ...props }) => React.createElement("a", props, children),
  "./rewards.module.css": css,
  "../_components/consumer-rewards-model": model,
  "../_components/consumer-reward-brand-points-client": { ConsumerRewardBrandPoints },
  "../_components/consumer-reward-presentation-clock": presentationClock,
  "../_components/consumer-reward-reservation": reservation,
  "../_components/consumer-reward-next-actions": { rewardNextActions },
  "../../login/consumer-login-continuation": consumerLoginContinuation,
};
const { ConsumerRewardsClient } = compile(clientSource, shared);
const NOW = "2026-09-08T12:00:00Z";
const FUTURE = "2099-09-09T12:00:00Z";
const list = (items = []) => ({ ok: true, items, scope: "own_brands", limit: 100, checkedAt: new Date(NOW).toISOString() });
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

const renderClient = (items, props = {}) => renderToStaticMarkup(React.createElement(ConsumerRewardsClient, { items, checkedAt: new Date(NOW).toISOString(), initialTenant: "", selectedVoucher: null, ...props }));
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
  assert.match(failedWallet.html, /Preparando el código de tu voucher/);
  assert.doesNotMatch(failedWallet.html, /BALMEC-1234|Copiar código/);
  assert.match(failedWallet.html, /Visita a la bodega|Estado registrado/);
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

test("SSR retains voucher history and prepares its local anchor before presenting a code", () => {
  const item = readItem(claim());
  const html = renderClient([item]);
  assert.doesNotMatch(html, /<code>|BALMEC-1234|Copiar código/);
  assert.match(html, /Preparando el código de tu voucher/);
  assert.match(html, /Preparando tus vouchers/);
  assert.match(html, /Última consulta/);
  assert.match(html, /Estado registrado/);
  assert.match(html, /\(Argentina\)/);
  assert.equal(item.code, "BALMEC-1234", "presentation does not erase the owned server receipt");
  assert.equal(model.rewardDateLabel(null), "No informado");
  assert.match(clientSource, /const currentCode = getCode\(item\)/);
  assert.match(clientSource, /navigator\.clipboard\.writeText\(currentCode\)/);
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

// Post-runtime protocol regressions; no future helper is imported by these tests.
test("SSR rejects an unattested private clock instead of publishing an empty or partial collection", async () => {
  const valid = list([claim({ claim_status: "claimed", redemption_code: "PRIVATE-SSR-CLOCK" })]);
  const cases = [
    ["old API without checkedAt", { ...valid, checkedAt: undefined }],
    ["noncanonical UTC", { ...valid, checkedAt: NOW }],
    ["impossible date", { ...valid, checkedAt: "2027-02-29T12:00:00.000Z" }],
    ["different scope", { ...valid, scope: "network" }],
    ["different limit", { ...valid, limit: 250 }],
    ["invalid row after own history", { ...valid, items: [...valid.items, null] }],
  ];
  for (const [label, body] of cases) {
    const { html, calls, clientProps } = await render(body);
    assert.match(html, /No pudimos cargar tus beneficios/, label);
    assert.doesNotMatch(html, /PRIVATE-SSR-CLOCK|Tus próximos beneficios|data-reward-state=/, label);
    assert.deepEqual(clientProps, [], label);
    assert.match(pointsSection(html), /540/, "independent wallet data is preserved: " + label);
    assert.deepEqual(calls.filter(call => call[0] === "fetch").map(call => call[1]).sort(), ["rewards", "wallet"], label);
  }
});

test("SSR accepts an attested empty collection and passes its exact canonical server clock", async () => {
  const checkedAt = "2028-02-29T12:34:56.789Z";
  const { html, clientProps } = await render({ ...list([]), checkedAt });
  assert.doesNotMatch(html, /No pudimos cargar tus beneficios/);
  assert.match(html, /Tus próximos beneficios, acá/);
  assert.equal(clientProps.length, 1);
  assert.equal(clientProps[0].checkedAt, checkedAt); assert.deepEqual(clientProps[0].items, []);
});

test("SSR uses the server projection boundary for voucher codes while retaining historical spend", async () => {
  const checkedAt = "2028-02-29T12:34:56.789Z";
  const { html, clientProps } = await render({ ...list([
    claim({ claim_id: "claim-clock-expired", claim_status: "claimed", claim_expires_at: checkedAt, redemption_code: "SSR-SERVER-EXPIRED", points_spent: 20 }),
    claim({ claim_id: "claim-clock-live", claim_status: "claimed", claim_expires_at: "2028-02-29T12:34:56.790Z", redemption_code: "SSR-SERVER-LIVE", points_spent: 40 }),
  ]), checkedAt });
  assert.equal(clientProps.length, 1); assert.equal(clientProps[0].checkedAt, checkedAt);
  assert.deepEqual(clientProps[0].items.map(item => [item.state, item.code, item.cost]), [
    ["expired", null, 20], ["claimed", "SSR-SERVER-LIVE", 40],
  ]);
  assert.doesNotMatch(html, /SSR-SERVER-EXPIRED|SSR-SERVER-LIVE|<code>|Copiar código/);
  assert.match(html, /Preparando el código de tu voucher/);
  assert.match(html, /Puntos del reclamo|Estado registrado/);
});


test("mounted voucher presentation permits only one local expiry timeout and no automatic network", () => {
  // The original model/client no-polling fence remains unchanged above.
  assert.doesNotMatch(presentationClockSource, /\bfetch\s*\(|readConsumer|reserveConsumer|setInterval|requestAnimationFrame|Math\.random|Date\.now|router\.refresh|dangerouslySetInnerHTML/);
  assert.equal([...presentationClockSource.matchAll(/\bsetTimeout\s*\(/g)].length, 1);
  assert.match(presentationClockSource, /Math\.min\(MAX_REWARD_PRESENTATION_DELAY_MS/);
  assert.match(presentationClockSource, /clearTimeout\(timer\)/);
  assert.match(presentationClockSource, /removeEventListener\("visibilitychange", visibility\)/);
  assert.match(presentationClockSource, /removeEventListener\("pageshow", pageShow\)/);
  assert.doesNotMatch(presentationClockSource, /addEventListener\(\s*["'](?:blur|focus)["']/);
  const effects = clientSource.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g)?.join("\n") ?? "";
  assert.doesNotMatch(effects, /readConsumerRewardsSnapshot|readConsumerReservation|reserveConsumerReward/);
});

// Source-only proposal authored by benefits_source_followups; Root/another reviewer must review it.
// Pure presentation and local hook lifecycle tests do not certify HTTP ownership or React hydration.
const mountedCheckedAt = "2026-10-29T10:00:00.000Z";
function mountedReceipt(offset = 2_000, extra = {}) {
  return { key: "claim-mounted-a", id: "reward-mounted-a", tenant: "bodega-a", brand: "Bodega A",
    title: "Visita", program: "Club A", programBalance: 100, description: null, cost: 40,
    hasClaim: true, state: "claimed", code: "MOUNTED-OWNED", expiresAt: new Date(Date.parse(mountedCheckedAt) + offset).toISOString(), ...extra };
}

test("mounted presentation blocks a voucher at equality and preserves its historical receipt", () => {
  const item = mountedReceipt(), items = [item], before = JSON.stringify(items);
  const clock = presentationClock.createRewardClock(items, mountedCheckedAt, 10);
  assert.equal(presentationClock.rewardPresentation(clock, item, 2_009, true).code, "MOUNTED-OWNED");
  const atDeadline = presentationClock.rewardPresentation(clock, item, 2_010, true);
  assert.equal(atDeadline.code, null); assert.equal(atDeadline.expired, true); assert.equal(atDeadline.status, "fresh");
  assert.equal(presentationClock.rewardPresentation(clock, item, 2_011, true).code, null);
  assert.equal(JSON.stringify(items), before, "presentation never rewrites spend, status, owner or receipt");
});

test("invalid server clocks and monotonic samples cannot gain validity or heal silently", () => {
  const item = mountedReceipt();
  for (const checkedAt of ["", "not-a-clock", "2026-10-29T10:00:00Z", "2026-02-30T10:00:00.000Z"]) {
    const clock = presentationClock.createRewardClock([item], checkedAt, 0);
    assert.equal(presentationClock.rewardPresentation(clock, item, 1, true).code, null, checkedAt);
  }
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const clock = presentationClock.createRewardClock([item], mountedCheckedAt, invalid);
    assert.equal(presentationClock.rewardClockNow(clock, 1, true), null);
  }
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, 99, Number.MAX_SAFE_INTEGER]) {
    const clock = presentationClock.createRewardClock([item], mountedCheckedAt, 100);
    assert.equal(presentationClock.rewardClockNow(clock, invalid, true), null);
    assert.equal(presentationClock.rewardPresentation(clock, item, 101, true).code, null, "a later good sample needs an explicit new snapshot");
  }
});

test("nearest expiry recomputes remaining time and caps the platform timer delay", () => {
  const first = mountedReceipt(), second = mountedReceipt(5_000, { key: "claim-mounted-b", code: "MOUNTED-SECOND" });
  const clock = presentationClock.createRewardClock([second, first], mountedCheckedAt, 0);
  assert.equal(presentationClock.nextRewardExpiryDelay(clock, 0, true), 2_000);
  assert.equal(presentationClock.nextRewardExpiryDelay(clock, 2_000, true), 3_000);
  assert.equal(presentationClock.nextRewardExpiryDelay(clock, 6_000, true), null, "late wake-up must not add nominal timer delays");
  const cap = 2_147_483_647, far = mountedReceipt(cap + 5_000);
  const farClock = presentationClock.createRewardClock([far], mountedCheckedAt, 0);
  assert.equal(presentationClock.nextRewardExpiryDelay(farClock, 0, true), cap);
  assert.equal(presentationClock.nextRewardExpiryDelay(farClock, cap, true), 5_000);
  assert.equal(presentationClock.rewardPresentation(farClock, far, cap, true).code, "MOUNTED-OWNED");
});

test("presentation never invents a code for terminal, foreign or non-voucher rows", () => {
  for (const extra of [{ state: "redeemed" }, { state: "cancelled" }, { state: "expired" }, { hasClaim: false, state: "reported" }, { code: null }, { expiresAt: null }]) {
    const item = mountedReceipt(2_000, extra), clock = presentationClock.createRewardClock([item], mountedCheckedAt, 0);
    assert.equal(presentationClock.rewardPresentation(clock, item, 1, true).code, null);
  }
  const item = mountedReceipt(), clock = presentationClock.createRewardClock([item], mountedCheckedAt, 0);
  assert.equal(presentationClock.rewardPresentation(clock, { ...item }, 1, true).code, null, "another source's equal-looking row is not the adopted receipt");
});

test("a bounded refresh must retain every old claim identity without mixing tenants or rewards", () => {
  const a = mountedReceipt(), b = mountedReceipt(4_000, { key: "claim-mounted-b", id: "reward-mounted-b", tenant: "bodega-b" });
  assert.equal(presentationClock.retainsRewardClaims([a, b], [{ ...b, state: "redeemed", code: null }, { ...a, code: "NEW-OWN-CODE" }]), true);
  for (const replacement of [[], [b], [b, { ...a, tenant: "foreign" }], [b, { ...a, id: "foreign-reward" }], [b, { ...a, key: "claim-foreign" }], [b, { ...a, hasClaim: false }]]) {
    assert.equal(presentationClock.retainsRewardClaims([a, b], replacement), false);
  }
  assert.equal(presentationClock.retainsRewardClaims([mountedReceipt(2_000, { hasClaim: false })], []), true, "a published catalog row is not an issued receipt");
});

function mountedClockHarness(initialItems, initialCheckedAt = mountedCheckedAt) {
  // Dependencies are module-local bindings; no browser or Node global is overwritten.
  class LocalTarget {
    listeners = new Map();
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    dispatch(type, event = {}) { for (const listener of [...(this.listeners.get(type) || [])]) listener(event); }
    count(type) { return this.listeners.get(type)?.size || 0; }
  }
  const localDocument = new LocalTarget(), localWindow = new LocalTarget(); localDocument.visibilityState = "visible";
  const slots = [], effects = new Map(), timers = new Map(), created = [];
  let cursor = 0, sample = 0, nextTimer = 0, items = initialItems, checkedAt = initialCheckedAt, networkCalls = 0, wall = Date.parse("2100-01-01T00:00:00.000Z");
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const localReact = {
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, update => { slots[index].value = typeof update === "function" ? update(slots[index].value) : update; }]; },
    useEffect(effect, deps) { const index = cursor++; if (!slots[index]) slots[index] = { kind: "effect", deps: null, cleanup: null };
      const slot = slots[index]; if (!equal(slot.nextDeps || slot.deps, deps)) { slot.nextDeps = deps; effects.set(index, { slot, effect, deps }); } },
  };
  const localSetTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: sample + delay, delay }); created.push(delay); return id; };
  const localClearTimeout = id => { timers.delete(id); };
  class UntrustedDeviceDate extends Date { constructor(...args) { super(...(args.length ? args : [wall])); } static now() { return wall; } }
  const noNetwork = () => { networkCalls++; throw Error("Presentation clock attempted a network request"); };
  const forbidRecurring = () => { throw Error("Presentation clock attempted recurring polling"); };
  const output = ts.transpileModule(read("_components/consumer-reward-presentation-clock.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "performance", "document", "window", "setTimeout", "clearTimeout", "Date", "fetch", "setInterval", "requestAnimationFrame", output)(
    name => { if (name === "react") return localReact; throw Error("Unexpected presentation clock dependency: " + name); },
    loaded, loaded.exports, { now: () => sample }, localDocument, localWindow, localSetTimeout, localClearTimeout, UntrustedDeviceDate, noNetwork, forbidRecurring, forbidRecurring,
  );
  function render(nextItems = items, nextCheckedAt = checkedAt) { items = nextItems; checkedAt = nextCheckedAt; cursor = 0; return loaded.exports.useRewardPresentationClock(items, checkedAt); }
  function flushEffects() { const pending = [...effects.values()]; effects.clear(); for (const { slot, effect, deps } of pending) {
    slot.cleanup?.(); slot.deps = deps; slot.nextDeps = null; slot.cleanup = effect() || null;
  } }
  function runDue() { let iterations = 0; while (true) { const entry = [...timers].filter(([, timer]) => timer.at <= sample).sort((a, b) => a[1].at - b[1].at)[0];
    if (!entry) return; assert.ok(++iterations <= 100, "local timer must not spin"); timers.delete(entry[0]); entry[1].callback();
  } }
  return { render, flushEffects, document: localDocument, window: localWindow, timers, created,
    setSample(value, run = false) { sample = value; if (run) runDue(); }, setWall(value) { wall = Date.parse(value); }, runDue,
    networkCalls: () => networkCalls,
    unmount() { effects.clear(); for (const slot of slots) if (slot?.kind === "effect") { slot.cleanup?.(); slot.cleanup = null; } },
  };
}

test("the local hook prepares before its browser anchor, then uses monotonic time and a single nearest alarm", () => {
  const a = mountedReceipt(), b = mountedReceipt(5_000, { key: "claim-mounted-b", code: "MOUNTED-SECOND" }), h = mountedClockHarness([a, b]);
  let view = h.render(); assert.equal(view.status, "preparing"); assert.equal(view.inspect(a).code, null); assert.equal(view.getCode(a), null);
  assert.equal(h.timers.size, 0); assert.equal(h.document.count("visibilitychange"), 0);
  h.flushEffects(); view = h.render(); assert.equal(view.status, "fresh"); assert.equal(view.getCode(a), "MOUNTED-OWNED");
  assert.equal(h.timers.size, 1); assert.equal(h.created[0], 2_000);
  h.document.dispatch("focus"); h.window.dispatch("focus"); h.window.dispatch("blur");
  h.setWall("1900-01-01T00:00:00.000Z"); h.setSample(1_999); view = h.render(); assert.equal(view.inspect(a).code, "MOUNTED-OWNED");
  h.setSample(2_000); assert.equal(view.getCode(a), null, "a retained click is blocked even before a delayed timer callback runs");
  h.runDue(); view = h.render(); assert.equal(view.inspect(a).expired, true); assert.equal(view.getCode(b), "MOUNTED-SECOND");
  assert.equal(h.timers.size, 1); assert.equal(h.created.at(-1), 3_000); assert.equal(h.networkCalls(), 0);
  h.unmount(); assert.equal(h.timers.size, 0);
});

test("hidden and bfcache invalidate one anchor without healing or requesting on visible or focus", () => {
  for (const event of ["hidden", "bfcache"]) {
    const item = mountedReceipt(), h = mountedClockHarness([item]); h.render(); h.flushEffects(); let view = h.render();
    if (event === "hidden") { h.document.visibilityState = "hidden"; h.document.dispatch("visibilitychange"); }
    else { h.window.dispatch("pageshow", { persisted: false }); assert.equal(view.getCode(item), "MOUNTED-OWNED"); h.window.dispatch("pageshow", { persisted: true }); }
    view = h.render(); assert.equal(view.status, "stale"); assert.equal(view.getCode(item), null); assert.equal(h.timers.size, 0);
    h.document.visibilityState = "visible"; h.document.dispatch("visibilitychange"); h.window.dispatch("focus");
    view = h.render(); assert.equal(view.status, "stale"); assert.equal(view.inspect(item).expired, false, "lifecycle does not invent a terminal server receipt");
    assert.equal(h.timers.size, 0); assert.equal(h.networkCalls(), 0); h.unmount();
    assert.equal(h.document.count("visibilitychange"), 0); assert.equal(h.window.count("pageshow"), 0);
  }
});

test("source replacement blocks stale closures before effects and cleans the old owner timer and listeners", () => {
  const oldItem = mountedReceipt(), h = mountedClockHarness([oldItem]); h.render(); h.flushEffects(); const oldView = h.render(), retained = oldView.getCode;
  const nextItem = mountedReceipt(6_000, { key: "claim-mounted-next", tenant: "bodega-b", code: "MOUNTED-NEXT" });
  let next = h.render([nextItem]); assert.equal(next.status, "preparing"); assert.equal(next.inspect(nextItem).code, null); assert.equal(retained(oldItem), null);
  h.setSample(2_000, true); assert.equal(h.timers.size, 0, "the old callback may not schedule another owner alarm");
  h.flushEffects(); next = h.render(); assert.equal(next.getCode(nextItem), "MOUNTED-NEXT"); assert.equal(retained(oldItem), null);
  assert.equal(h.timers.size, 1); assert.equal(h.document.count("visibilitychange"), 1); assert.equal(h.window.count("pageshow"), 1);
  h.unmount(); assert.equal(next.getCode(nextItem), null); assert.equal(h.timers.size, 0);
  assert.equal(h.document.count("visibilitychange"), 0); assert.equal(h.window.count("pageshow"), 0); assert.equal(h.networkCalls(), 0);
});

test("invalid new sources and regressive live samples block codes and retire their alarms", () => {
  const item = mountedReceipt(), h = mountedClockHarness([item]); h.setSample(100); h.render(); h.flushEffects(); let view = h.render();
  assert.equal(view.getCode(item), "MOUNTED-OWNED"); h.setSample(99); assert.equal(view.getCode(item), null); assert.equal(h.timers.size, 0);
  h.setSample(101); view = h.render(); assert.equal(view.status, "stale"); assert.equal(view.getCode(item), null);
  const next = { ...item }; view = h.render([next], "not-a-server-clock"); assert.equal(view.status, "preparing"); assert.equal(view.getCode(next), null);
  h.flushEffects(); view = h.render(); assert.equal(view.status, "stale"); assert.equal(view.getCode(next), null); assert.equal(h.timers.size, 0);
  assert.equal(h.networkCalls(), 0); h.unmount(); assert.equal(h.document.count("visibilitychange"), 0); assert.equal(h.window.count("pageshow"), 0);
});

test("far-future hook deadlines use the platform cap and recompute instead of expiring early", () => {
  const cap = 2_147_483_647, item = mountedReceipt(cap + 5_000), h = mountedClockHarness([item]);
  h.render(); h.flushEffects(); let view = h.render(); assert.equal(h.created[0], cap); assert.equal(h.timers.size, 1);
  h.setSample(cap, true); view = h.render(); assert.equal(view.getCode(item), "MOUNTED-OWNED");
  assert.equal(h.created.at(-1), 5_000); assert.equal(h.timers.size, 1);
  h.setSample(cap + 5_000, true); view = h.render(); assert.equal(view.getCode(item), null); assert.equal(view.inspect(item).expired, true);
  assert.equal(h.timers.size, 0); assert.equal(h.networkCalls(), 0); h.unmount();
});

test("a regressive sample first seen during render marks the view stale and retires its alarm after commit", () => {
  const item = mountedReceipt(), h = mountedClockHarness([item]);
  h.setSample(100); h.render(); h.flushEffects(); let view = h.render(); h.flushEffects();
  assert.equal(view.status, "fresh"); assert.equal(h.timers.size, 1);
  h.setSample(99); view = h.render();
  assert.equal(view.status, "stale", "the banner and receipt use the same invalid observation without a prior getCode call");
  assert.equal(view.inspect(item).status, "stale"); assert.equal(view.inspect(item).code, null);
  assert.equal(h.timers.size, 1, "render leaves alarm retirement to the committed effect");
  h.flushEffects(); assert.equal(h.timers.size, 0, "the committed invalid observation retires its own alarm");
  h.setSample(101); view = h.render();
  assert.equal(view.status, "stale"); assert.equal(view.getCode(item), null, "a later good sample cannot heal the retired snapshot");
  assert.equal(h.networkCalls(), 0); h.unmount();
  assert.equal(h.document.count("visibilitychange"), 0); assert.equal(h.window.count("pageshow"), 0);
});

// Exact test preimage: f0ef3fa252f7d656a9e8a3cb4a164cfb12b51944eaf021ba9df3c38dd8e55ba2.
// Successor of immutable ABA unit R1; writer-only local driver, not clock/SSR/hydration proof.
function mountedWriterActionFixture() {
  const own = claim({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", claim_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
  const originalItems = readModel(list([own, reservableReward({ points_cost: 40 })])).items;
  const refreshedPayload = list([own, reservableReward({ points_cost: 80 })]);
  const slots = [], queuedEffects = new Map(), postRequests = [];
  let cursor = 0, getRequests = 0, finishGet;
  const localReact = {
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, update => { slots[index].value = typeof update === "function" ? update(slots[index].value) : update; }]; },
    useEffect(effect, deps) { const index = cursor++; if (!slots[index]) slots[index] = { kind: "effect", deps: null, cleanup: null };
      const slot = slots[index], before = slot.nextDeps || slot.deps;
      if (!before || before.length !== deps.length || before.some((value, position) => !Object.is(value, deps[position]))) {
        slot.nextDeps = deps; queuedEffects.set(index, { slot, effect, deps });
      }
    },
  };
  const fetchImpl = async (url, init) => {
    if (init.method === "GET") {
      getRequests++; assert.equal(url, "/api/consumer/rewards"); assert.equal(init.body, undefined);
      return new Promise(resolve => { finishGet = () => resolve(new Response(JSON.stringify(refreshedPayload), { headers: { "content-type": "application/json" } })); });
    }
    assert.equal(init.method, "POST"); postRequests.push({ url, body: JSON.parse(init.body) });
    return new Response("{}", { status: 503, headers: { "content-type": "application/json" } });
  };
  const client = compile(clientSource, {
    ...shared, react: localReact,
    "../_components/consumer-reward-presentation-clock": {
      ...presentationClock,
      useRewardPresentationClock: () => ({ status: "fresh", inspect: item => ({ status: "fresh", code: item.code, expired: false }),
        getCode: item => item.code, invalidate: () => {} }),
    },
    "../_components/consumer-reward-reservation": {
      ...reservation,
      reserveConsumerReward: (quote, options) => reservation.reserveConsumerReward(quote, { ...options, fetchImpl }),
      readConsumerRewardsSnapshot: options => reservation.readConsumerRewardsSnapshot({ ...options, fetchImpl }),
      readConsumerReservation: (quote, claimId, options) => reservation.readConsumerReservation(quote, claimId, { ...options, fetchImpl }),
    },
  }).ConsumerRewardsClient;
  const props = { items: originalItems, checkedAt: new Date(NOW).toISOString(), initialTenant: "", selectedVoucher: null };
  const render = () => { cursor = 0; return client(props); };
  const flushEffects = () => { const pendingEffects = [...queuedEffects.values()]; queuedEffects.clear();
    for (const { slot, effect, deps } of pendingEffects) { slot.cleanup?.(); slot.deps = deps; slot.nextDeps = null; slot.cleanup = effect() || null; } };
  const nodes = node => Array.isArray(node) ? node.flatMap(nodes)
    : node && typeof node === "object" && node.props ? [node, ...nodes(node.props.children)] : [];
  const textOf = node => (Array.isArray(node) ? node.map(textOf).join(" ")
    : typeof node === "string" || typeof node === "number" ? String(node)
      : node && typeof node === "object" && node.props ? textOf(node.props.children) : "").replace(/\s+/g, " ").trim();
  const button = (tree, text) => { const found = nodes(tree).filter(node => node.type === "button" && textOf(node) === text);
    assert.equal(found.length, 1, "one actual client action: " + text); return found[0]; };
  return { render, flushEffects, button, textOf, postRequests, event: { currentTarget: { focus() {} } },
    getRequests: () => getRequests,
    finishGet() { assert.equal(typeof finishGet, "function", "explicit synthetic GET is pending"); finishGet(); },
    cleanup() { queuedEffects.clear(); for (const slot of slots) if (slot?.kind === "effect") { slot.cleanup?.(); slot.cleanup = null; } },
  };
}

test("a retained old confirmation cannot write after refresh and a new deliberate confirmation", async () => {
  const h = mountedWriterActionFixture();
  try {
    h.render(); h.flushEffects(); let tree = h.render();
    assert.equal(h.getRequests(), 0); assert.deepEqual(h.postRequests, [], "mount does not reserve or refresh");
    h.button(tree, "Reservar beneficio").props.onClick(h.event);
    tree = h.render(); h.flushEffects();
    const oldConfirm40 = h.button(tree, "Confirmar reserva por 40 puntos").props.onClick;
    const refresh = h.button(tree, "Actualizar mis vouchers").props.onClick();
    assert.equal(h.getRequests(), 1); h.finishGet(); await refresh;
    tree = h.render();
    const quoteChangeExplained = h.textOf(tree).includes("La información de este beneficio cambió. Revisá el costo y volvé a preparar la reserva.");
    h.button(tree, "Reservar beneficio").props.onClick(h.event);
    await oldConfirm40(); // Immediately after opening80, before the next paint.
    assert.deepEqual(h.postRequests, [], "an old40 handler cannot write merely because a different flow returned to phase confirm");
    assert.equal(quoteChangeExplained, true, "the refreshed price requires an explanation and a new deliberate preparation");
    tree = h.render(); await h.button(tree, "Confirmar reserva por 80 puntos").props.onClick();
    assert.deepEqual(h.postRequests, [{ url: "/api/consumer/rewards/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/claim",
      body: { claimIntent: "portal-first-reservation.v1", expectedPointsCost: 80, locale: "es-AR" } }]);
    assert.equal(h.getRequests(), 1, "the uncertain result never rePOSTs or starts an automatic lookup");
    tree = h.render(); assert.ok(h.textOf(tree).includes("Comprobar mi reserva"));
  } finally { h.cleanup(); }
});

test("unmount retires a never-attempted confirmation and its retained refresh action", async () => {
  // A separate live fixture proves the40 callback is actionable while mounted.
  const control = mountedWriterActionFixture();
  try {
    control.render(); control.flushEffects(); let tree = control.render();
    control.button(tree, "Reservar beneficio").props.onClick(control.event); tree = control.render(); control.flushEffects();
    const confirm = control.button(tree, "Confirmar reserva por 40 puntos"); assert.notEqual(confirm.props.disabled, true);
    await confirm.props.onClick();
    assert.deepEqual(control.postRequests, [{ url: "/api/consumer/rewards/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/claim",
      body: { claimIntent: "portal-first-reservation.v1", expectedPointsCost: 40, locale: "es-AR" } }]);
    assert.equal(control.getRequests(), 0);
  } finally { control.cleanup(); }
  // This fresh fixture has no previous mutation, so attempted cannot mask an unmount bug.
  const h = mountedWriterActionFixture();
  try {
    h.render(); h.flushEffects(); let tree = h.render();
    h.button(tree, "Reservar beneficio").props.onClick(h.event); tree = h.render(); h.flushEffects();
    const confirm = h.button(tree, "Confirmar reserva por 40 puntos"); assert.notEqual(confirm.props.disabled, true);
    const retainedConfirm40 = confirm.props.onClick, retainedRefresh = h.button(tree, "Actualizar mis vouchers").props.onClick;
    assert.deepEqual(h.postRequests, []); assert.equal(h.getRequests(), 0);
    h.cleanup(); // Actual effect cleanups only; the harness adds no mounted authority of its own.
    await retainedConfirm40();
    assert.deepEqual(h.postRequests, [], "a real previously enabled handler cannot start a mutation after unmount");
    assert.equal(h.getRequests(), 0);
    const lateRead = retainedRefresh();
    // If a broken guard starts a synthetic read, settle it before the assertion rather than leaving a six-second hang.
    if (h.getRequests() > 0) h.finishGet();
    await lateRead; assert.equal(h.getRequests(), 0, "a retained refresh callback cannot start a read after unmount");
    assert.deepEqual(h.postRequests, []);
  } finally { h.cleanup(); }
});

// Post-runtime only: these modules must exist before this acceptance candidate is admitted.
function brandPointsFixture({ initialPoints = { status: "unavailable", data: null }, tenant = "", sourceEpoch = "server-render-A" } = {}) {
  const slots = [], effects = new Map(), requests = [];
  let cursor = 0, props = { initialPoints, tenant, sourceEpoch };
  const fakeReact = {
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, update => { slots[index].value = typeof update === "function" ? update(slots[index].value) : update; }]; },
    useEffect(effect, deps) { const index = cursor++; if (!slots[index]) slots[index] = { kind: "effect", deps: null, cleanup: null };
      const slot = slots[index], old = slot.nextDeps || slot.deps;
      if (!old || old.length !== deps.length || old.some((value, position) => !Object.is(value, deps[position]))) {
        slot.nextDeps = deps; effects.set(index, { slot, effect, deps });
      }
    },
  };
  const fetchImpl = (url, init) => new Promise(resolve => requests.push({ url, init, release: body => resolve(new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })),
    fail: status => resolve(new Response("{}", { status, headers: { "content-type": "application/json" } })) }));
  const component = compile(read("_components/consumer-reward-brand-points-client.tsx"), {
    react: fakeReact, "next/link": shared["next/link"], "../rewards/rewards.module.css": css,
    "./consumer-rewards-model": model, "../../login/consumer-login-continuation": consumerLoginContinuation,
    "./consumer-wallet-brand-read": { readConsumerBrandPoints: options => brandPointsRead.readConsumerBrandPoints({ ...options, fetchImpl }) },
  }).ConsumerRewardBrandPoints;
  const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" && node.props ? [node, ...nodes(node.props.children)] : [];
  const text = node => (Array.isArray(node) ? node.map(text).join(" ") : typeof node === "string" || typeof node === "number" ? String(node) : node?.props ? text(node.props.children) : "").replace(/\s+/g, " ").trim();
  return { requests, nodes, text,
    render(next = props) { props = next; cursor = 0; return component(props); },
    flush() { const queued = [...effects.values()]; effects.clear(); for (const { slot, effect, deps } of queued) { slot.cleanup?.(); slot.deps = deps; slot.nextDeps = null; slot.cleanup = effect() || null; } },
    action(tree) { const buttons = nodes(tree).filter(node => node.type === "button"); assert.equal(buttons.length, 1); return buttons[0].props.onClick; },
    props: () => props,
    cleanup() { effects.clear(); for (const slot of slots) if (slot?.kind === "effect") { slot.cleanup?.(); slot.cleanup = null; } },
  };
}

test("brand-points reads use one existing private GET and retain unknown balances without borrowing network points", async () => {
  let calls = 0;
  const result = await brandPointsRead.readConsumerBrandPoints({ fetchImpl: async (url, init) => {
    calls++; assert.equal(url, "/api/consumer/wallet"); assert.equal(init.method, "GET"); assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store"); assert.equal(init.body, undefined);
    return new Response(JSON.stringify(wallet({ tenantWallets: [{ slug: "brand-a", name: "Marca A", points_balance: null }], networkWallet: { enabled: true, points_balance: 999 } })));
  } });
  assert.equal(calls, 1); assert.deepEqual(result, { status: "ready", points: { status: "ready", data: [{ slug: "brand-a", name: "Marca A", balance: null, lifetime: null }] } });
  for (const [status, expected] of [[401, "authentication-required"], [403, "denied"], [503, "unavailable"]]) {
    assert.deepEqual(await brandPointsRead.readConsumerBrandPoints({ fetchImpl: async () => new Response("private diagnostic", { status }) }), { status: expected });
  }
  assert.deepEqual(await brandPointsRead.readConsumerBrandPoints({ fetchImpl: async () => new Response('{"ok":true,"tenantWallets":[null]}') }), { status: "unavailable" });
  const owner = new AbortController(); owner.abort(); calls = 0;
  assert.deepEqual(await brandPointsRead.readConsumerBrandPoints({ signal: owner.signal, fetchImpl: async () => { calls++; throw Error("must not run"); } }), { status: "unavailable" });
  assert.equal(calls, 0);
});

test("a deliberate points retry is single-flight and a failed refresh preserves its last known values", async () => {
  const h = brandPointsFixture();
  try {
    h.render(); h.flush(); let tree = h.render(); assert.equal(h.requests.length, 0);
    const retry = h.action(tree), first = retry(), duplicate = retry();
    assert.equal(h.requests.length, 1); h.requests[0].release(wallet()); await Promise.all([first, duplicate]);
    tree = h.render(); assert.ok(h.text(tree).includes("540"));
    const second = h.action(tree)(); assert.equal(h.requests.length, 2); h.requests[1].fail(503); await second;
    tree = h.render(); assert.ok(h.text(tree).includes("540")); assert.ok(h.text(tree).includes("Conservamos la información anterior"));
    assert.equal(h.requests.length, 2); assert.ok(h.requests.every(request => request.init.method === "GET"));
  } finally { h.cleanup(); }
});

test("an opaque wallet render epoch rejects old data even when both sources are unavailable and tenant is empty", async () => {
  const unavailable = { status: "unavailable", data: null }, h = brandPointsFixture({ initialPoints: unavailable, tenant: "", sourceEpoch: "opaque-A" });
  try {
    h.render(); h.flush(); let tree = h.render(); const oldAction = h.action(tree), oldRead = oldAction();
    const nextProps = { initialPoints: unavailable, tenant: "", sourceEpoch: "opaque-B" };
    tree = h.render(nextProps); h.requests[0].release(wallet()); await oldRead;
    tree = h.render(); assert.ok(!h.text(tree).includes("540"), "A response is discarded before B's passive cleanup");
    h.flush(); await oldAction(); assert.equal(h.requests.length, 1);
    tree = h.render(); const currentRead = h.action(tree)(); h.requests[1].release(wallet({ tenantWallets: [] })); await currentRead;
    tree = h.render(); assert.ok(h.text(tree).includes("Todavía no tenés puntos")); assert.ok(!h.text(tree).includes("540"));
  } finally { h.cleanup(); }
});

test("points retries stop after unmount and 401 reentry preserves only a validated tenant", async () => {
  for (const tenant of ["bodega-a", "../bodega", "SYNTHETIC_CODE?token=secret"]) {
    const h = brandPointsFixture({ tenant });
    try {
      h.render(); h.flush(); let tree = h.render(); const retained = h.action(tree), pending = retained();
      h.requests[0].fail(401); await pending; tree = h.render();
      const links = h.nodes(tree).filter(node => node.props?.href?.startsWith("/login?")); assert.equal(links.length, 1);
      const login = new URL(links[0].props.href, "https://portal.invalid"), next = new URL(login.searchParams.get("next"), login.origin);
      assert.equal(next.pathname, "/me/rewards"); assert.deepEqual([...next.searchParams], tenant === "bodega-a" ? [["tenant", "bodega-a"]] : []);
      assert.ok(!links[0].props.href.includes("SYNTHETIC")); h.cleanup(); await retained(); assert.equal(h.requests.length, 1);
    } finally { h.cleanup(); }
  }
  const h = brandPointsFixture();
  try {
    h.render(); h.flush(); const retained = h.action(h.render()), pending = retained();
    h.cleanup(); assert.equal(h.requests[0].init.signal.aborted, true); await pending;
    h.requests[0].release(wallet()); await retained(); assert.equal(h.requests.length, 1);
  } finally { h.cleanup(); }
});

test("points refresh keeps the reward writer's original attempt and readback context untouched", async () => {
  const writer = mountedWriterActionFixture(), panel = brandPointsFixture();
  try {
    writer.render(); writer.flushEffects(); let tree = writer.render(); writer.button(tree, "Reservar beneficio").props.onClick(writer.event);
    tree = writer.render(); writer.flushEffects(); const confirm = writer.button(tree, "Confirmar reserva por 40 puntos").props.onClick;
    const pendingWrite = confirm(); panel.render(); panel.flush(); const pointsRead = panel.action(panel.render())();
    panel.requests[0].release(wallet()); await Promise.all([pendingWrite, pointsRead]);
    tree = writer.render(); assert.ok(writer.textOf(tree).includes("Comprobar mi reserva"));
    assert.equal(writer.postRequests.length, 1); assert.equal(writer.postRequests[0].body.expectedPointsCost, 40);
    await confirm(); assert.equal(writer.postRequests.length, 1, "a stale confirmation is not revived by the independent points update");
    assert.equal(writer.getRequests(), 0); assert.equal(panel.requests.length, 1);
  } finally { writer.cleanup(); panel.cleanup(); }
});

test("authenticated SSR gives the wallet panel its own opaque render lifetime without changing rewards identity", async () => {
  const setup = loadPage(list([claim()]), { wallet: null });
  const first = await setup.page({ searchParams: Promise.resolve({}) }), second = await setup.page({ searchParams: Promise.resolve({}) });
  const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
  const panels = [first, second].map(tree => nodes(tree).find(node => node.type === ConsumerRewardBrandPoints));
  assert.ok(panels.every(Boolean));
  for (const panel of panels) { assert.match(panel.props.sourceEpoch, /^[0-9a-f-]{36}$/i); assert.equal(panel.key, panel.props.sourceEpoch); assert.equal(panel.props.tenant, ""); }
  assert.notEqual(panels[0].props.sourceEpoch, panels[1].props.sourceEpoch);
  assert.ok(!clientSource.includes("sourceEpoch"), "wallet lifetime metadata never becomes reward writer identity");
  const rewardsElement = nodes(first).find(node => Array.isArray(node.props?.items) && typeof node.props.checkedAt === "string");
  assert.equal(rewardsElement.props.checkedAt, new Date(NOW).toISOString());
});

test("the points reader retains the bounded deadline and never retries stalled headers", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0, signal;
  const pending = brandPointsRead.readConsumerBrandPoints({ fetchImpl: async (_url, init) => { calls++; signal = init.signal; return new Promise(() => {}); } });
  t.mock.timers.tick(boundedFetch.CONSUMER_READ_TIMEOUT_MS);
  assert.deepEqual(await pending, { status: "unavailable" }); assert.equal(signal.aborted, true); assert.equal(calls, 1);
});

test("a first failed points retry never claims to retain data that was unavailable", async () => {
  for (const status of [403, 503]) {
    const h = brandPointsFixture();
    try {
      h.render(); h.flush(); const pending = h.action(h.render())();
      h.requests[0].fail(status); await pending; const tree = h.render(), text = h.text(tree);
      assert.ok(text.includes("Tus saldos no se muestran como cero"));
      assert.ok(!text.includes("Conservamos la información anterior"));
      assert.equal(h.nodes(tree).filter(node => node.props?.["data-benefit-points"] === "brand").length, 0);
      assert.equal(h.requests.length, 1);
    } finally { h.cleanup(); }
  }
});

test("failed or pending points refresh labels retained positive and unknown balances as the previous query", async () => {
  const initialPoints = { status: "ready", data: [
    { slug: "brand-a", name: "Marca A", balance: 540, lifetime: null },
    { slug: "brand-b", name: "Marca B", balance: null, lifetime: null },
  ] };
  for (const status of [401, 403, 503]) {
    const h = brandPointsFixture({ initialPoints });
    try {
      h.render(); h.flush(); let tree = h.render();
      assert.equal(h.nodes(tree).filter(node => node.type === "span" && h.text(node) === "Saldo reportado").length, 2);
      const pending = h.action(tree)(); tree = h.render();
      assert.equal(h.nodes(tree).filter(node => node.type === "span" && h.text(node) === "Última consulta").length, 2);
      h.requests[0].fail(status); await pending; tree = h.render();
      assert.equal(h.nodes(tree).filter(node => node.type === "span" && h.text(node) === "Última consulta").length, 2);
      assert.ok(h.text(tree).includes("540") && h.text(tree).includes("No informado"));
      assert.equal(h.nodes(tree).filter(node => node.type === "span" && h.text(node) === "Saldo reportado").length, 0);
      if (status === 401) assert.ok(h.text(tree).includes("Tu sesión venció"));
      assert.equal(h.requests.length, 1);
    } finally { h.cleanup(); }
  }
});

test("an empty retained points query is historical rather than a newly confirmed empty balance", async () => {
  const h = brandPointsFixture({ initialPoints: { status: "ready", data: [] } });
  try {
    h.render(); h.flush(); const pending = h.action(h.render())();
    h.requests[0].fail(503); await pending; const text = h.text(h.render());
    assert.ok(text.includes("En la última consulta no había puntos por marca registrados en esta cuenta."));
    assert.ok(!text.includes("Todavía no tenés puntos por marca registrados en esta cuenta."));
  } finally { h.cleanup(); }
});

test("the points status region exists while empty and is populated without replacing its JSX position", async () => {
  const h = brandPointsFixture({ initialPoints: { status: "ready", data: [] } });
  const status = tree => h.nodes(tree).filter(node => node.props?.role === "status");
  try {
    h.render(); h.flush(); let tree = h.render();
    assert.equal(status(tree).length, 1); assert.equal(h.text(status(tree)[0]), "");
    assert.equal(status(tree)[0].type, "p"); assert.equal(status(tree)[0].props.className, css.srOnly);
    const initialChildren = tree.props.children, initialIndex = initialChildren.indexOf(status(tree)[0]);
    assert.ok(initialIndex >= 0);
    const pending = h.action(tree)(); tree = h.render();
    assert.equal(status(tree).length, 1); assert.equal(tree.props.children.indexOf(status(tree)[0]), initialIndex);
    assert.ok(h.text(status(tree)[0]).includes("Consultando tus puntos"));
    h.requests[0].release(wallet({ tenantWallets: [] })); await pending; tree = h.render();
    assert.equal(status(tree).length, 1); assert.equal(tree.props.children.indexOf(status(tree)[0]), initialIndex);
    assert.equal(status(tree)[0].props["aria-atomic"], "true");
    assert.ok(h.text(status(tree)[0]).includes("Actualizamos la consulta"));
  } finally { h.cleanup(); }
});
