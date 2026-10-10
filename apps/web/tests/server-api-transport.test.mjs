import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import ts from "typescript";
import * as tapHandoff from "../src/app/api/_lib/consumer-tap-handoff.ts";
import * as boundedFetch from "../src/app/me/_components/consumer-bounded-fetch.ts";

const API = "https://nexid-qa-exact-project.vercel.app";
const WEB = "https://nexid-web-qa-exact-project.vercel.app";
const SECRET = "synthetic-server-only-grant";
const previewEnv = (overrides = {}) => ({ VERCEL_ENV: "preview", NEXID_PREVIEW_API_ORIGIN: API,
  NEXID_PREVIEW_API_ALLOWED_HOST: new URL(API).hostname, NEXID_PREVIEW_API_AUTOMATION_BYPASS: SECRET, ...overrides });
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

// Execute the actual server modules with isolated env/fetch and explicit
// framework boundaries. An unexpected import or network request fails loudly.
function load(path, { env = {}, fetchImpl = () => { throw Error("Unexpected network"); }, modules = {} } = {}) {
  const code = ts.transpileModule(read(path), { fileName: path, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "process", "fetch", code)(name => {
    if (name === "server-only") return {};
    if (Object.hasOwn(modules, name)) return modules[name];
    throw Error(`Unexpected scoped dependency: ${name}`);
  }, loaded, loaded.exports, { env }, fetchImpl);
  return loaded.exports;
}
function transport(env, fetchImpl) { return load("app/api/_lib/server-api-transport.ts", { env, fetchImpl }).fetchRuntimeApi; }
function proxy(env, fetchImpl, api = API) {
  const fetchRuntimeApi = transport(env, fetchImpl);
  return load("app/api/_lib/runtime-proxy.ts", { modules: {
    "next/server": { NextResponse: Response }, "@product/config": { productUrls: { api } },
    "./consumer-tap-handoff": tapHandoff, "./server-api-transport": { fetchRuntimeApi },
  } }).proxyToApi;
}
function publicConfiguration(env, fetchImpl, api = API) {
  const fetchRuntimeApi = transport(env, fetchImpl);
  return load("lib/public-tenant-configuration.ts", { modules: {
    "@product/config": { productUrls: { api } },
    "../app/me/_components/consumer-bounded-fetch": boundedFetch,
    "../app/sun/tenant-action-availability": load("app/sun/tenant-action-availability.ts"),
    "../app/api/_lib/server-api-transport": { fetchRuntimeApi },
  } }).readPublicTenantConfiguration;
}
function sommelier(env, fetchImpl, api = API) {
  return load("app/api/_lib/sommelier-proxy.ts", { env, modules: {
    "@product/config": { productUrls: { api } }, "./consumer-tap-handoff": tapHandoff,
    "./server-api-transport": { fetchRuntimeApi: transport(env, fetchImpl) },
  } }).proxySommelierRequest;
}
function browserRequest(extra = {}) {
  return new Request(`${WEB}/api/consumer/auth/verify`, { method: "POST", headers: {
    origin: WEB, "sec-fetch-site": "same-origin", "content-type": "application/json",
    cookie: "consumer_session=synthetic; __Host-nexid_tap_715=one-use", ...extra,
  }, body: '{"contact":"synthetic","code":"not-a-real-code"}' });
}

test("Preview grants reach only the exact reviewed API origin, preserving request provenance and cancellation", async () => {
  const calls = [], controller = new AbortController();
  const fetchApi = transport(previewEnv(), async (url, init) => { calls.push({ url, init }); return Response.json({ ok: true }); });
  await fetchApi(`${API}/consumer/auth/verify`, { method: "POST", body: "synthetic", cache: "no-store", signal: controller.signal,
    headers: { origin: WEB, "sec-fetch-site": "same-origin", cookie: "consumer_session=synthetic", "x-vercel-protection-bypass": "injected", "x-vercel-set-bypass-cookie": "true" } });
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, `${API}/consumer/auth/verify`); assert.equal(init.method, "POST"); assert.equal(init.body, "synthetic");
  assert.equal(init.cache, "no-store"); assert.equal(init.signal, controller.signal); assert.equal(init.redirect, "error");
  assert.equal(init.headers.get("origin"), WEB); assert.equal(init.headers.get("sec-fetch-site"), "same-origin");
  assert.equal(init.headers.get("cookie"), "consumer_session=synthetic");
  assert.equal(init.headers.get("x-vercel-protection-bypass"), SECRET);
  assert.equal(init.headers.get("x-vercel-set-bypass-cookie"), null);
});

test("Production, development and unset Vercel environments never read or forward the grant", async () => {
  for (const VERCEL_ENV of ["production", "development", undefined, "Preview"]) {
    const env = { VERCEL_ENV };
    for (const name of ["NEXID_PREVIEW_API_ORIGIN", "NEXID_PREVIEW_API_ALLOWED_HOST", "NEXID_PREVIEW_API_AUTOMATION_BYPASS"]) {
      Object.defineProperty(env, name, { get() { throw Error("Credential must not be read"); } });
    }
    let headers;
    await transport(env, async (_url, init) => { headers = init.headers; return Response.json({}); })(`${API}/consumer/session`, {
      headers: { "X-Vercel-Protection-Bypass": "injected", "X-Vercel-Set-Bypass-Cookie": "true", origin: WEB },
    });
    assert.equal(headers.get("x-vercel-protection-bypass"), null); assert.equal(headers.get("x-vercel-set-bypass-cookie"), null);
    assert.equal(headers.get("origin"), WEB);
  }
});

test("Incomplete, unsafe or mismatched Preview configuration fails before any upstream request", async () => {
  const cases = [
    { NEXID_PREVIEW_API_ORIGIN: undefined }, { NEXID_PREVIEW_API_ALLOWED_HOST: undefined }, { NEXID_PREVIEW_API_AUTOMATION_BYPASS: undefined },
    { NEXID_PREVIEW_API_ALLOWED_HOST: "*.vercel.app" }, { NEXID_PREVIEW_API_ALLOWED_HOST: "other.vercel.app" },
    { NEXID_PREVIEW_API_ORIGIN: API + "/" }, { NEXID_PREVIEW_API_ORIGIN: API + "/route" },
    { NEXID_PREVIEW_API_ORIGIN: API + "?credential=value" }, { NEXID_PREVIEW_API_ORIGIN: API + "#fragment" },
    { NEXID_PREVIEW_API_ORIGIN: API.replace("https:", "http:") }, { NEXID_PREVIEW_API_ORIGIN: API + ":8443" },
    { NEXID_PREVIEW_API_ORIGIN: API.replace("https://", "https://user:password@") },
    { NEXID_PREVIEW_API_AUTOMATION_BYPASS: SECRET + "\r\n" },
  ];
  let calls = 0;
  for (const override of cases) await assert.rejects(transport(previewEnv(override), async () => { calls++; return Response.json({}); })(`${API}/consumer/session`), { message: "api_unavailable" });
  assert.equal(calls, 0);
});

test("A different host, same suffix, downgrade or credential-bearing target cannot receive the Preview grant", async () => {
  let calls = 0;
  const fetchApi = transport(previewEnv(), async () => { calls++; return Response.json({}); });
  for (const target of ["https://other.vercel.app/consumer/session", `${API}.attacker.example/consumer/session`,
    `${API}:8443/consumer/session`, API.replace("https:", "http:") + "/consumer/session",
    API.replace("https://", "https://user:password@") + "/consumer/session"]) {
    await assert.rejects(fetchApi(target), { message: "api_unavailable" });
  }
  assert.equal(calls, 0);
});

test("Unconfigured Preview uses normal API transport without granting caller-injected protection headers", async () => {
  let init;
  await transport({ VERCEL_ENV: "preview" }, async (_url, options) => { init = options; return Response.json({}); })(`${API}/consumer/session`, {
    headers: { "x-vercel-protection-bypass": SECRET, "x-vercel-set-bypass-cookie": "true" },
  });
  assert.equal(init.headers.get("x-vercel-protection-bypass"), null); assert.equal(init.redirect, "error");
});

test("Runtime BFF rejects browser bypass injection, keeps Origin, strips NFC cookies and relays only session cookies", async () => {
  const calls = [];
  const forward = proxy(previewEnv(), async (url, init) => {
    calls.push({ url, init }); return Response.json({ ok: true }, { headers: {
      "set-cookie": "consumer_session=issued; Path=/; Secure; HttpOnly; Domain=api.nexid.lat",
      "x-vercel-protection-bypass": SECRET, "x-provider-secret": SECRET,
    } });
  });
  const response = await forward(browserRequest({ "x-vercel-protection-bypass": "browser-injected", "x-vercel-set-bypass-cookie": "true" }), "/consumer/auth/verify");
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 1); const headers = calls[0].init.headers;
  assert.equal(headers.get("origin"), WEB); assert.equal(headers.get("sec-fetch-site"), "same-origin");
  assert.equal(headers.get("cookie"), "consumer_session=synthetic"); assert.equal(headers.get("x-vercel-protection-bypass"), SECRET);
  assert.equal(headers.get("x-vercel-set-bypass-cookie"), null);
  assert.equal(response.headers.get("x-vercel-protection-bypass"), null); assert.equal(response.headers.get("x-provider-secret"), null);
  assert.equal(response.headers.get("set-cookie"), "consumer_session=issued; Path=/; Secure; HttpOnly");
  assert.equal(response.headers.get("x-correlation-id"), headers.get("x-correlation-id"));
});

test("Foreign or absent browser Origin remains foreign or absent; BFF never substitutes the API or public origin", async () => {
  for (const origin of ["https://hostile.nexid.lat", ""]) {
    let seen;
    await proxy(previewEnv(), async (_url, init) => { seen = init.headers.get("origin"); return Response.json({ ok: false }, { status: 403 }); })(browserRequest({ origin }), "/consumer/auth/logout");
    assert.equal(seen, origin || null);
  }
});

test("Transport/configuration failures expose neither grant nor private diagnostics and produce no logs", async (t) => {
  const logs = []; for (const name of ["log", "warn", "error"]) t.mock.method(console, name, (...args) => logs.push(args));
  for (const forward of [proxy(previewEnv(), async () => { throw Error(`Private URL and ${SECRET}`); }),
    proxy(previewEnv({ NEXID_PREVIEW_API_ALLOWED_HOST: "wrong.vercel.app" }), async () => { throw Error("Must not fetch"); })]) {
    const response = await forward(browserRequest(), "/consumer/auth/start");
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { ok: false, error: "api_unavailable" });
  }
  assert.deepEqual(logs, []);
});

test("Redirect responses are stopped without following, relaying Location or returning a provider cookie", async () => {
  let calls = 0;
  const forward = proxy(previewEnv(), async (_url, init) => {
    calls++; assert.equal(init.redirect, "error");
    return new Response("redirect", { status: 307, headers: { location: "https://attacker.example/collect", "set-cookie": `unsafe=${SECRET}; Path=/` } });
  });
  const response = await forward(browserRequest(), "/consumer/auth/verify");
  assert.equal(calls, 1); assert.equal(response.status, 503);
  assert.equal(response.headers.get("location"), null); assert.equal(response.headers.get("set-cookie"), null);
  assert.doesNotMatch(await response.text(), new RegExp(SECRET));
});

test("Native fetch does not contact a redirect destination even if the redirect would change host", async () => {
  let destinationCalls = 0;
  const destination = createServer((_req, res) => { destinationCalls++; res.end("must not arrive"); });
  destination.listen(0, "127.0.0.1"); await once(destination, "listening");
  const redirector = createServer((_req, res) => { res.writeHead(307, { location: `http://127.0.0.1:${destination.address().port}/collect` }); res.end(); });
  redirector.listen(0, "127.0.0.1"); await once(redirector, "listening");
  try {
    const fetchApi = transport({ VERCEL_ENV: "development" }, fetch);
    await assert.rejects(fetchApi(`http://127.0.0.1:${redirector.address().port}/consumer/session`), { message: "api_unavailable" });
    assert.equal(destinationCalls, 0);
  } finally { await Promise.all([new Promise(resolve => redirector.close(resolve)), new Promise(resolve => destination.close(resolve))]); }
});

test("Consumer SSR session reader uses the protected server transport, preserves session and adds no synthesized Origin", async () => {
  const calls = [], fetchRuntimeApi = transport(previewEnv(), async (url, init) => {
    calls.push({ url, init }); return Response.json({ ok: true, authenticated: true });
  });
  const api = load("app/me/_components/consumer-api.ts", { modules: {
    "next/headers": { headers: async () => new Headers({ cookie: "consumer_session=synthetic; nexid_tap_715=one-use", "user-agent": "Synthetic SSR" }) },
    "next/navigation": { redirect: () => { throw Error("Must remain authenticated"); } },
    "@product/config": { productUrls: { api: API } }, "../../api/_lib/consumer-tap-handoff": tapHandoff,
    "./consumer-bounded-fetch": boundedFetch, "../../api/_lib/server-api-transport": { fetchRuntimeApi },
  } });
  assert.deepEqual(await api.readConsumerSession(), { status: "ready" });
  assert.equal(calls[0].url, `${API}/consumer/session`); assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.headers.get("cookie"), "consumer_session=synthetic");
  assert.equal(calls[0].init.headers.get("origin"), null); assert.equal(calls[0].init.headers.get("x-vercel-protection-bypass"), SECRET);
  assert.equal(calls[0].init.headers.get("user-agent"), "Synthetic SSR");
});

const publishedConfiguration = { version: "nexid.tenant-actions.v1", status: "published", allowedActions: ["sommelier", "marketplace"],
  program: null, trivia: null, catalogAvailable: true, tenantSlug: "synthetic-tenant" };

test("Public tenant settings reach a protected Preview API without forwarding consumer context or exposing the grant", async () => {
  const calls = [];
  const readConfiguration = publicConfiguration(previewEnv(), async (url, init) => {
    calls.push({ url, init });
    if (init.headers.get("x-vercel-protection-bypass") !== SECRET) return Response.json({ ok: false }, { status: 401 });
    return Response.json({ ok: true, configuration: { ...publishedConfiguration, providerSecret: SECRET, email: "synthetic@example.invalid" } });
  });
  const result = await readConfiguration("715");
  assert.deepEqual(result, publishedConfiguration);
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, `${API}/public/passport/715/configuration`);
  assert.equal(init.method, "GET"); assert.equal(init.credentials, "omit"); assert.equal(init.cache, "no-store"); assert.equal(init.redirect, "error");
  assert.equal(init.headers.get("x-vercel-protection-bypass"), SECRET);
  assert.equal(init.headers.get("accept"), "application/json");
  for (const name of ["cookie", "origin", "authorization", "x-vercel-set-bypass-cookie"]) assert.equal(init.headers.get(name), null);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-server-only-grant|synthetic@example\.invalid|providerSecret/);
});

test("Public configuration grants stay scoped to Preview; Production never reads them and mismatched origins fail closed", async () => {
  const env = { VERCEL_ENV: "production" };
  for (const name of ["NEXID_PREVIEW_API_ORIGIN", "NEXID_PREVIEW_API_ALLOWED_HOST", "NEXID_PREVIEW_API_AUTOMATION_BYPASS"]) {
    Object.defineProperty(env, name, { get() { throw Error("Credential must not be read"); } });
  }
  let requests = 0;
  const readProduction = publicConfiguration(env, async (url, init) => {
    requests++;
    assert.equal(url, "https://api.nexid.lat/public/passport/715/configuration");
    assert.equal(init.headers.get("x-vercel-protection-bypass"), null);
    return Response.json({ ok: true, configuration: publishedConfiguration });
  }, "https://api.nexid.lat");
  assert.deepEqual(await readProduction("715"), publishedConfiguration);
  assert.equal(requests, 1);
  const readWrongOrigin = publicConfiguration(previewEnv(), async () => { requests++; throw Error("Must not fetch"); }, "https://other.vercel.app");
  assert.equal(await readWrongOrigin("715"), null);
  assert.equal(requests, 1);
});

test("Public settings retain an explicit injected transport and its bounded-read timeout", async () => {
  const readConfiguration = publicConfiguration(previewEnv(), () => assert.fail("Default transport must not run"));
  let injected = 0;
  assert.deepEqual(await readConfiguration("715", { fetchImpl: async (url, init) => {
    injected++;
    assert.equal(url, `${API}/public/passport/715/configuration`);
    assert.deepEqual(init.headers, { accept: "application/json" });
    assert.equal(init.credentials, "omit");
    return Response.json({ ok: true, configuration: publishedConfiguration });
  } }), publishedConfiguration);
  let signal;
  assert.equal(await readConfiguration("715", { timeoutMs: 10, fetchImpl: async (_url, init) => {
    signal = init.signal;
    return new Promise(() => {});
  } }), null);
  assert.equal(signal.aborted, true);
  assert.equal(injected, 1);
});

test("History BFF retains query/status contracts while using the same protected server transport", async () => {
  const calls = [], fetchRuntimeApi = transport(previewEnv(), async (url, init) => { calls.push({ url, init }); return Response.json({ ok: false }, { status: 401 }); });
  const { GET } = load("app/api/consumer/taps/history/route.ts", { modules: {
    "@product/config": { productUrls: { api: API } }, "../../../../me/taps/history-model": { boundedHistoryJson: () => { throw Error("Must not read denied data"); } },
    "../../../_lib/consumer-tap-handoff": tapHandoff, "../../../_lib/server-api-transport": { fetchRuntimeApi },
  } });
  const req = new Request(`${WEB}/api/consumer/taps/history?tenant=qa`, { headers: { cookie: "consumer_session=synthetic; __Host-nexid_tap_715=one-use" } });
  const response = await GET(req);
  assert.equal(response.status, 401); assert.deepEqual(await response.json(), { ok: false, error: "unauthorized" });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(calls[0].url, `${API}/consumer/taps/history?tenant=qa`);
  assert.equal(calls[0].init.headers.get("cookie"), "consumer_session=synthetic");
  assert.equal(calls[0].init.headers.get("x-vercel-protection-bypass"), SECRET);
  const invalid = await GET(new Request(`${WEB}/api/consumer/taps/history?tenant=one&tenant=two`));
  assert.equal(invalid.status, 400); assert.equal(calls.length, 1);
});

test("Initial SSR history authenticates before its protected transport and preserves the bounded parsing contract", async () => {
  const order = [], fetchRuntimeApi = transport(previewEnv(), async (url, init) => {
    order.push("fetch"); assert.equal(url, `${API}/consumer/taps/history?tenant=qa`);
    assert.equal(init.headers.get("cookie"), "consumer_session=synthetic");
    assert.equal(init.headers.get("x-vercel-protection-bypass"), SECRET); assert.equal(init.cache, "no-store");
    return Response.json({ items: [] });
  });
  const { default: Page } = load("app/me/taps/page.tsx", { modules: {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "next/headers": { headers: async () => new Headers({ cookie: "consumer_session=synthetic; __Host-nexid_tap_715=one-use" }) },
    "@product/config": { productUrls: { api: API } }, "../../api/_lib/consumer-tap-handoff": tapHandoff,
    "../../api/_lib/server-api-transport": { fetchRuntimeApi },
    "../_components/consumer-api": { readConsumerSession: async () => { order.push("auth"); return { status: "ready" }; }, buildConsumerNextPath: p => p },
    "../_components/consumer-portal-recovery": { ConsumerPortalUnavailable: "Unavailable" },
    "../_components/portal-shell": { PortalShell: "Shell" }, "./consumer-history": { ConsumerHistory: "History" },
    "./history-model": { EMPTY_HISTORY_FILTERS: { tenant: "", from: "", to: "", event: "" }, historyParams: () => "tenant=qa",
      boundedHistoryJson: r => { order.push("parse"); return r.json(); }, parseHistory: p => p },
  } });
  const result = await Page({ searchParams: Promise.resolve({ tenant: "qa" }) });
  assert.deepEqual(order, ["auth", "fetch", "parse"]); assert.deepEqual(result.props.children.props.initial, { items: [] });
});

test("Managed assistant defaults to the existing exact-origin Preview transport without browser bypass injection", async () => {
  const calls = [], forward = sommelier(previewEnv(), async (url, init) => { calls.push({ url, init }); return Response.json({ ok: true }); });
  const req = new Request(`${WEB}/api/sommelier/chat`, { method: "POST", headers: {
    origin: WEB, "content-type": "application/json", "sec-fetch-site": "same-origin",
    cookie: "consumer_session=synthetic; __Host-nexid_tap_715=one-use",
    "x-vercel-protection-bypass": "browser-injected", "x-vercel-set-bypass-cookie": "true",
  }, body: '{"mode":"consumer","question":"Synthetic","eventId":"715"}' });
  const res = await forward(req, "/sommelier/chat");
  assert.equal(res.status, 200); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${API}/sommelier/chat`); assert.equal(calls[0].init.redirect, "error");
  assert.equal(calls[0].init.headers.get("x-vercel-protection-bypass"), SECRET);
  assert.equal(calls[0].init.headers.get("x-vercel-set-bypass-cookie"), null);
  assert.equal(calls[0].init.headers.get("origin"), WEB);
  assert.equal(calls[0].init.headers.get("cookie"), "consumer_session=synthetic");
  assert.equal(res.headers.get("x-vercel-protection-bypass"), null);
});

test("Assistant Production never reads the Preview grant; a foreign Preview API is denied before transport", async () => {
  const env = { VERCEL_ENV: "production" };
  for (const key of ["NEXID_PREVIEW_API_ORIGIN", "NEXID_PREVIEW_API_ALLOWED_HOST", "NEXID_PREVIEW_API_AUTOMATION_BYPASS"]) Object.defineProperty(env, key, { get() { throw Error("Must not read Preview configuration"); } });
  let calls = 0;
  const production = sommelier(env, async (url, init) => {
    calls++; assert.equal(url, "https://api.nexid.lat/sommelier/chat"); assert.equal(init.headers.get("x-vercel-protection-bypass"), null); return Response.json({ ok: true });
  }, "https://api.nexid.lat");
  const req = () => new Request(`${WEB}/api/sommelier/chat`, { method: "POST", headers: { origin: WEB, "content-type": "application/json" }, body: "{}" });
  assert.equal((await production(req(), "/sommelier/chat")).status, 200);
  const hostile = sommelier(previewEnv(), async () => { calls++; throw Error("Must not fetch"); }, "https://other.vercel.app");
  const denied = await hostile(req(), "/sommelier/chat");
  assert.equal(denied.status, 503); assert.equal(calls, 1); assert.doesNotMatch(await denied.text(), new RegExp(SECRET));
});

test("Assistant explicit injected transport remains intact and retains cancellation/deadline", async () => {
  const forward = sommelier(previewEnv(), () => assert.fail("Default transport must not run"));
  let calls = 0, signal;
  const req = new Request(`${WEB}/api/sommelier/chat`, { method: "POST", headers: { origin: WEB, "content-type": "application/json" }, body: "{}" });
  const res = await forward(req, "/sommelier/chat", { timeoutMs: 10, fetchImpl: async (url, init) => {
    calls++; signal = init.signal; assert.equal(url, `${API}/sommelier/chat`); assert.equal(init.headers["x-vercel-protection-bypass"], undefined); return new Promise(() => {});
  } });
  assert.equal(res.status, 503); assert.equal(calls, 1); assert.equal(signal.aborted, true);
});
