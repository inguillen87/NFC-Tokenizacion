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
const modelSource = readFileSync(new URL("_components/consumer-wallet-points-model.ts", dir), "utf8");
const pageSource = readFileSync(new URL("wallet/page.tsx", dir), "utf8");

function compile(source, overrides = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name) => Object.hasOwn(overrides, name) ? overrides[name] : name === "../../api/_lib/consumer-tap-handoff" ? tapHandoff : require(name);
  new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const model = compile(modelSource);
const api = compile(readFileSync(new URL("_components/consumer-api.ts", dir), "utf8"), {
  "next/headers": { headers: () => { throw new Error("unexpected-network-read"); } },
  "next/navigation": { redirect: () => { throw new Error("unexpected-redirect"); } },
  "./consumer-portal-model": { shouldRedirectToConsumerAuth: () => false },
});
const list = (items = []) => ({ ok: true, items });
const wallet = (overrides = {}) => ({
  ok: true,
  tenantWallets: [{ slug: "demobodega", name: "Bodega Balmec", points_balance: 540, lifetime_points: 540 }],
  networkWallet: { points_balance: 0, lifetime_points: 0, enabled: false },
  ...overrides,
});
const readModel = (payload) => model.buildConsumerWalletPointsModel(payload);

function loadPage(payload, options = {}) {
  const calls = [];
  const clientProps = {};
  const page = compile(pageSource, {
    "../_components/consumer-api": {
      ...api,
      requireConsumerSession: async (next) => { calls.push(["session", next]); if (options.authorize) await options.authorize(); },
      fetchConsumerPath: async (path) => { calls.push(["fetch", path]); if (options.fetch) return options.fetch(path); return path === "wallet" ? payload : options.products || list(); },
    },
    "../_components/consumer-wallet-points-model": model,
    "../_components/me-portal-interactive-client": { ConsumerDataRetryButton: () => React.createElement("button", { type: "button" }, "Reintentar carga") },
    "../_components/portal-shell": { PortalShell: ({ children }) => React.createElement("main", null, children) },
    "./metamask-sandbox-card": { MetamaskSandboxCard: (props) => { clientProps.metamask = props; return React.createElement("div", { "data-client": "metamask" }); } },
    "../_components/wallet-interactive-client": { WalletInteractiveClient: (props) => { clientProps.wallet = props; return React.createElement("div", { "data-client": "wallet" }); } },
  }).default;
  return { page, calls, clientProps };
}

async function render(payload, options = {}) {
  const setup = loadPage(payload, options);
  return { ...setup, html: renderToStaticMarkup(await setup.page({ searchParams: Promise.resolve(options.params || {}) })) };
}

function pointsSections(html) {
  return {
    brands: html.match(/<section aria-labelledby="wallet-brand-points-title"[\s\S]*?<\/section>/)?.[0] || "",
    network: html.match(/<section data-wallet-scope="network"[\s\S]*?<\/section>/)?.[0] || "",
  };
}

test("reported points accept explicit safe nonnegative integers, never null or malformed values as zero", () => {
  for (const value of [0, 540, Number.MAX_SAFE_INTEGER, "0", "540", "9007199254740991"]) assert.equal(model.reportedWalletPoints(value), Number(value));
  for (const value of [null, undefined, "", " ", true, false, NaN, Infinity, -1, 1.5, "-1", "1.5", "01", "540points", "5e2", Number.MAX_SAFE_INTEGER + 1, "9007199254740992", {}, []]) assert.equal(model.reportedWalletPoints(value), null, String(value));
});

test("invalid or failed envelopes cannot masquerade as an empty collection or a network zero balance", () => {
  for (const value of [null, undefined, {}, [], { ok: false }, { tenantWallets: [], networkWallet: { points_balance: 0 } }]) {
    assert.deepEqual(readModel(value), { brands: { status: "unavailable", data: null }, network: { status: "unavailable" } });
  }
  assert.deepEqual(readModel(wallet({ tenantWallets: [] })).brands, { status: "ready", data: [] });
  for (const tenantWallets of [null, {}, [null], ["bad"], [[]]]) assert.deepEqual(readModel(wallet({ tenantWallets })).brands, { status: "unavailable", data: null });
});

test("Balmec's 540 brand points stay separate from the disabled network fallback, with no computed sum", () => {
  const result = readModel(wallet());
  assert.deepEqual(result.brands.data, [{ slug: "demobodega", name: "Bodega Balmec", balance: 540, lifetime: 540 }]);
  assert.deepEqual(result.network, { status: "disabled" });
  const multiple = readModel(wallet({ tenantWallets: [{ name: "Marca A", points_balance: 540, lifetime_points: 640 }, { name: "Marca B", points_balance: 270, lifetime_points: 300 }] }));
  assert.equal(multiple.brands.data.length, 2);
  assert.deepEqual(multiple.brands.data.map((brand) => brand.balance), [540, 270]);
  assert.deepEqual(Object.keys(multiple), ["brands", "network"]);
  assert.doesNotMatch(modelSource, /\.reduce\(|totalPoints|combinedBalance/);
});

test("disabled, missing, unknown and real zero network balances are distinct states", () => {
  assert.deepEqual(readModel(wallet({ networkWallet: { enabled: false, points_balance: 0, lifetime_points: 0 } })).network, { status: "disabled" });
  for (const networkWallet of [null, undefined, [], {}, { enabled: "false", points_balance: 0 }, { enabled: null, points_balance: 0 }]) assert.deepEqual(readModel(wallet({ networkWallet })).network, { status: "unavailable" });
  assert.deepEqual(readModel(wallet({ networkWallet: { enabled: true, points_balance: null } })).network, { status: "ready", balance: null, lifetime: null });
  assert.deepEqual(readModel(wallet({ networkWallet: { points_balance: 0, lifetime_points: "0" } })).network, { status: "ready", balance: 0, lifetime: 0 });
  assert.deepEqual(readModel(wallet({ networkWallet: { points_balance: 40, lifetime_points: 70 } })).network, { status: "ready", balance: 40, lifetime: 70 });
});

test("partial source failures preserve independent reported balances and omit private fields", () => {
  const partial = readModel(wallet({ networkWallet: null, tenantWallets: [{ slug: "company", points_balance: "540", lifetime_points: null, consumer_id: "private-id", email: "private@example.test", consents: { secret: true } }] }));
  assert.deepEqual(partial.network, { status: "unavailable" });
  assert.deepEqual(partial.brands.data[0], { slug: "company", name: null, balance: 540, lifetime: null });
  assert.doesNotMatch(JSON.stringify(partial), /private-|private@|consumer_id|consents/);
  const networkOnly = readModel(wallet({ tenantWallets: null, networkWallet: { points_balance: 10, lifetime_points: 40 } }));
  assert.equal(networkOnly.brands.status, "unavailable");
  assert.deepEqual(networkOnly.network, { status: "ready", balance: 10, lifetime: 40 });
});

test("SSR prioritizes real brand points and never presents a disabled network fallback as zero points", async () => {
  const { html } = await render(wallet());
  const sections = pointsSections(html);
  assert.match(sections.brands, /Bodega Balmec/);
  assert.match(sections.brands, /Saldo de esta marca/);
  assert.match(sections.brands, /Acumulados en esta marca/);
  assert.equal((sections.brands.match(/>540</g) || []).length, 2);
  assert.match(sections.network, /La red nexID no está habilitada/);
  assert.doesNotMatch(sections.network, /<dd|>0</);
  assert.ok(html.indexOf("wallet-brand-points-title") < html.indexOf('data-client="metamask"'));
  assert.doesNotMatch(html, /Puntos Disponibles|Puntos Históricos|Canjeables en bodega|Acumulado total|Saldos activos canjeables/);
});

test("SSR distinguishes unavailable sources, empty memberships and unreported brand amounts", async () => {
  const failed = pointsSections((await render(null)).html);
  assert.match(failed.brands, /No pudimos cargar tus saldos por marca/);
  assert.match(failed.brands, /Reintentar carga/);
  assert.doesNotMatch(failed.brands, />0<|Todavía no hay saldos/);
  assert.match(failed.network, /Saldo de red no disponible/);
  assert.doesNotMatch(failed.network, />0<|La red nexID no está habilitada/);
  const empty = pointsSections((await render(wallet({ tenantWallets: [] }))).html);
  assert.match(empty.brands, /Todavía no hay saldos por marca asociados/);
  assert.doesNotMatch(empty.brands, /No pudimos cargar|>0<|Reintentar carga/);
  const missing = pointsSections((await render(wallet({ tenantWallets: [{}] }))).html);
  assert.match(missing.brands, /Marca no informada/);
  assert.equal((missing.brands.match(/No informado/g) || []).length, 2);
  assert.doesNotMatch(missing.brands, /Bodega|>0</);
});

test("SSR keeps all brand balances independent and gives network balances their own labels", async () => {
  const { html } = await render(wallet({ tenantWallets: [{ name: "Marca A", points_balance: 540, lifetime_points: 640 }, { name: "Marca B", points_balance: 270, lifetime_points: 300 }], networkWallet: { points_balance: 0, lifetime_points: 40 } }));
  const sections = pointsSections(html);
  assert.equal((sections.brands.match(/data-wallet-scope="brand"/g) || []).length, 2);
  assert.match(sections.brands, />540</);
  assert.match(sections.brands, />270</);
  assert.doesNotMatch(sections.brands, />810<|>940</);
  assert.match(sections.network, /Saldo reportado de la red/);
  assert.match(sections.network, /Acumulados en la red nexID/);
  assert.match(sections.network, />0</);
  assert.match(sections.network, />40</);
  assert.doesNotMatch(sections.network, />540<|>270</);
});

test("the points presentation does not alter wallet connection, product ownership or transaction props", async () => {
  const blockchainWallet = { address: "0x123", controlVerified: true, verificationMethod: "signed_wallet_identity" };
  const products = [{ product_name: "Producto A", ownership_record_status: "claimed", latest_tap_event_id: "703", tokenization_status: "none" }];
  const { clientProps } = await render(wallet({ blockchainWallet }), { products: list(products), params: { tenant: "demobodega", connect: "metamask" } });
  assert.deepEqual(clientProps.metamask, { initialWallet: blockchainWallet, autoConnect: true });
  assert.deepEqual(clientProps.wallet, { initialProducts: products, selectedTenant: "demobodega" });
  assert.match(pageSource, /receipt|ownership/);
});

test("wallet preserves authentication before parallel reads and continuation parameters", async () => {
  let authorize;
  const session = new Promise((resolve) => { authorize = resolve; });
  const resolvers = [];
  const setup = loadPage(wallet(), { authorize: () => session, fetch: (path) => new Promise((resolve) => resolvers.push(() => resolve(path === "wallet" ? wallet() : list()))) });
  const pending = setup.page({ searchParams: Promise.resolve({ tenant: "demobodega", connect: "metamask" }) });
  await new Promise(setImmediate);
  assert.deepEqual(setup.calls, [["session", "/me/wallet?tenant=demobodega&connect=metamask"]]);
  authorize();
  await new Promise(setImmediate);
  assert.deepEqual(setup.calls.slice(1), [["fetch", "wallet"], ["fetch", "products"]]);
  resolvers.forEach((resolve) => resolve());
  await pending;
  const denied = loadPage(wallet(), { authorize: async () => { throw new Error("redirect-login"); } });
  await assert.rejects(() => denied.page({}), /redirect-login/);
  assert.deepEqual(denied.calls, [["session", "/me/wallet"]]);
});

test("new point cards use inherited light/dark tokens and do not add polling or mutable money actions", () => {
  assert.match(pageSource, /var\(--portal-text\)/);
  assert.match(pageSource, /var\(--portal-surface\)/);
  assert.match(pageSource, /var\(--portal-muted\)/);
  assert.ok(pageSource.includes("sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]"), "brand cards fill available columns without empty reserved slots");
  assert.doesNotMatch(modelSource, /fetch\(|Date\.now|Math\.random|setInterval/);
  assert.doesNotMatch(pageSource, /toNumber|setInterval|setTimeout|method="post"/);
});
