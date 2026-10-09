import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

// Execute the real application modules. Framework/SDK boundaries are replaced;
// an unrecognized import or attempted network call fails instead of loading it.
function load(path, mocks = {}, fetchImpl = () => { throw Error("Unexpected test network"); }) {
  const compiled = ts.transpileModule(read(path), { fileName: path, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  const dependency = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "react" || name === "react/jsx-runtime") return require(name);
    if (name.endsWith(".css")) return {};
    throw Error(`Unexpected module in scoped test: ${name}`);
  };
  new Function("require", "module", "exports", "fetch", "process", compiled)(dependency, module, module.exports, fetchImpl, { env: { NODE_ENV: "production" } });
  return module.exports;
}

const { requiresClerkMiddleware } = load("lib/clerk-route-scope.ts");
const response = {
  next: () => ({ kind: "next" }),
  redirect: (url, status) => ({ kind: "redirect", location: url.href, status }),
  json: (value, { status }) => Response.json(value, { status }),
};

function request(path, host = "nexid.lat", method = "GET") {
  const nextUrl = new URL(path, `https://${host}`);
  nextUrl.clone = () => new URL(nextUrl.href);
  return { nextUrl, method, headers: new Headers({ host }) };
}

function loadProxy({ configured = true, guardResponse, guardError } = {}) {
  const calls = [], factories = [];
  const { proxy, config } = load("proxy.ts", {
    "next/server": { NextResponse: response },
    "./lib/clerk-env": { isClerkConfiguredForRuntime: () => configured },
    "./lib/clerk-route-scope": { requiresClerkMiddleware },
    "@clerk/nextjs/server": { clerkMiddleware: (handler) => {
      factories.push(handler);
      return (req, event) => {
        calls.push({ req, event });
        if (guardError) throw guardError;
        return guardResponse || handler(null, req);
      };
    } },
  });
  return { proxy, config, calls, factories };
}

test("Clerk scope matches only Web3, its exact bridge and reserved SDK path segments", () => {
  for (const path of ["/web3", "/web3/", "/web3/sign-in", "/web3/sign-in/factor-one", "/web3/sign-up", "/web3/complete", "/api/consumer/auth/web3", "/__clerk", "/__clerk/", "/__clerk/handshake"]) assert.equal(requiresClerkMiddleware(path), true, path);
  for (const path of ["/", "/sun", "/login", "/me", "/me/wallet", "/web3evil", "/Web3", "/web30/sign-in", "/api/consumer/auth/web3/extra", "/api/consumer/auth/web3/", "/api/consumer/auth/web30", "/api/consumer/auth/start", "/api/consumer/auth/session", "/__clerkevil", "/__Clerk", "/api/__clerk"]) assert.equal(requiresClerkMiddleware(path), false, path);
});

test("configured Clerk capable of redirecting is never invoked for public or own consumer requests", () => {
  const blocked = { kind: "sdk-handshake" }, loaded = loadProxy({ guardResponse: blocked });
  const paths = ["/", "/sun?v=QA_PUBLIC&cmac=QA_ONE&cmac=QA_TWO&fresh_token=QA_NOT_A_TOKEN", "/sun?demo=1", "/login?consumer=1&next=%2Fme", "/me", "/me/wallet", "/me/marketplace?tenant=qa-brand", "/api/consumer/auth/start", "/api/consumer/auth/verify", "/api/consumer/auth/session", "/api/mobile/passport/900001/consumer/join-tenant", "/api/tenant-loyalty", "/web3evil", "/__clerkevil"];
  for (const path of paths) for (const method of ["GET", "POST"]) {
    const req = request(path, "nexid.lat", method), before = req.nextUrl.href;
    assert.deepEqual(loaded.proxy(req, {}), { kind: "next" });
    assert.equal(req.nextUrl.href, before);
  }
  assert.equal(loaded.calls.length, 0);
});

test("Web3 UI, verified bridge and reserved routes retain the real guard seam and request identity", () => {
  const guarded = { kind: "sdk-result" }, loaded = loadProxy({ guardResponse: guarded });
  for (const path of ["/web3", "/web3/sign-in?next=%2Fme%2Fwallet", "/web3/sign-up", "/web3/complete?next=%2Fme", "/api/consumer/auth/web3", "/__clerk", "/__clerk/handshake"]) {
    const req = request(path, "nexid.lat", path.startsWith("/api/") ? "POST" : "GET"), event = {};
    assert.equal(loaded.proxy(req, event), guarded);
    assert.equal(loaded.calls.at(-1).req, req);
    assert.equal(loaded.calls.at(-1).event, event);
  }
  assert.equal(loaded.calls.length, 7);
  assert(loaded.config.matcher.includes("/__clerk/:path*"));
});

test("canonical redirects preserve all query entries and bypass Clerk on public hosts and localhost alike", () => {
  const loaded = loadProxy();
  for (const [path, host, expectedPath] of [["/sun?cmac=QA_ONE&cmac=QA_TWO&tenant=qa-brand", "www.nexid.lat", "/sun"], ["/landing?x=1&x=2", "nexid.lat", "/"], ["/landing/?locale=pt-BR", "www.nexid.lat", "/"]]) for (const method of ["GET", "POST"]) {
    const req = request(path, host, method), expectedEntries = [...req.nextUrl.searchParams];
    const result = loaded.proxy(req, {}), target = new URL(result.location);
    assert.equal(result.kind, "redirect"); assert.equal(result.status, 308);
    assert.equal(target.origin, "https://nexid.lat"); assert.equal(target.pathname, expectedPath);
    assert.deepEqual([...target.searchParams], expectedEntries);
  }
  for (const host of ["nexid.lat", "localhost:3000", "127.0.0.1:3000", "[::1]:3000"]) assert.deepEqual(loaded.proxy(request("/", host), {}), { kind: "next" });
  assert.equal(loaded.calls.length, 0);
  const web3 = loaded.proxy(request("/web3/sign-in?next=%2Fme%2Fwallet", "www.nexid.lat"), {});
  assert.equal(web3.status, 308); assert.equal(web3.location, "https://nexid.lat/web3/sign-in?next=%2Fme%2Fwallet");
  assert.equal(loaded.calls.length, 1);
});

test("Argentine public domains open the canonical consumer portal without altering NFC query bytes or trusting forwarded hosts", () => {
  const loaded = loadProxy();
  for (const host of ["nexid.com.ar", "www.nexid.com.ar", "NEXID.COM.AR"]) {
    for (const path of ["/login?consumer=1&next=%2Fme", "/me/products", "/sun?cmac=QA%2fone&cmac=QA%2FTWO&tenant=qa-brand&empty=&locale=pt-BR", "/api/consumer/auth/logout"]) {
      for (const method of ["GET", "POST"]) {
        const req = request(path, host, method), original = req.nextUrl.href;
        const result = loaded.proxy(req, {}), target = new URL(result.location);
        assert.equal(result.status, 308);
        assert.equal(target.origin, "https://nexid.lat");
        assert.equal(target.pathname, req.nextUrl.pathname);
        assert.equal(target.search, req.nextUrl.search);
        assert.equal(req.nextUrl.href, original);
        assert.equal(req.method, method);
      }
    }
  }
  for (const host of ["localhost:3337", "nexid-consumer-otp-qa-marcelos-projects-c26aa499.vercel.app", "nexid.com.ar.evil.test", "evil-nexid.com.ar", "nexid.lat"]) {
    const req = request("/login?consumer=1&next=%2Fme", host);
    req.headers.set("x-forwarded-host", "nexid.com.ar");
    assert.deepEqual(loaded.proxy(req, {}), { kind: "next" });
  }
  assert.equal(loaded.calls.length, 0);
});

test("unconfigured Web3 keeps its existing fallback; configured guard errors never downgrade identity", () => {
  const unconfigured = loadProxy({ configured: false });
  for (const path of ["/", "/sun", "/web3/sign-in", "/api/consumer/auth/web3", "/__clerk"]) assert.deepEqual(unconfigured.proxy(request(path), {}), { kind: "next" });
  assert.equal(unconfigured.factories.length, 0); assert.equal(unconfigured.calls.length, 0);
  const failure = Error("synthetic SDK failure"), configured = loadProxy({ guardError: failure });
  assert.throws(() => configured.proxy(request("/api/consumer/auth/web3"), {}), error => error === failure);
  for (const path of ["/", "/sun?cmac=QA_ONE&cmac=QA_TWO", "/login?consumer=1&next=%2Fme", "/me", "/api/consumer/auth/start", "/api/consumer/auth/session"]) for (const method of ["GET", "POST"]) {
    const req = request(path, "nexid.lat", method), before = req.nextUrl.href;
    assert.deepEqual(configured.proxy(req, {}), { kind: "next" });
    assert.equal(req.nextUrl.href, before);
  }
  assert.equal(configured.calls.length, 1);
});

test("root layout renders public/consumer content and theme without importing or instantiating Clerk", async () => {
  const Empty = () => null;
  const mocks = {
    "next/headers": { cookies: async () => ({ get: name => ({ value: name === "theme" ? "light" : "white-first-v2" }) }) },
    "@product/config": { siteConfig: {} },
    "../lib/locale": { getWebI18n: async () => ({ locale: "es-AR" }) },
    "@product/ui/theme-preference": { resolveThemePreference: theme => theme, THEME_PREFERENCE_VERSION_COOKIE: "nexid_theme_version" },
  };
  for (const [name, exported] of [["contextual-helpbot", "ContextualHelpBot"], ["pwa-install-prompt", "PwaInstallPrompt"], ["pwa-setup", "PwaSetup"], ["misconfiguration-banner", "MisconfigurationBanner"], ["wallet-extension-guard", "WalletExtensionGuard"], ["structured-data", "StructuredData"]]) mocks[`../components/${name}`] = { [exported]: Empty };
  const Root = load("app/layout.tsx", mocks).default;
  const html = renderToStaticMarkup(await Root({ children: React.createElement("main", { id: "own-session-content" }, "Mi cuenta") }));
  assert.match(html, /data-theme="light"/); assert.match(html, /id="own-session-content"/);
  assert.doesNotMatch(html, /clerk|Clerk/);
});

test("Web3 layout alone provides Clerk when configured and retains children when no publishable key exists", () => {
  for (const key of ["", "pk_test_QA_SYNTHETIC"]) {
    let providers = 0;
    const Provider = ({ publishableKey, children }) => { providers++; assert.equal(publishableKey, key); return React.createElement("section", { "data-web3-provider": "true" }, children); };
    const { default: Web3Layout, metadata } = load("app/web3/layout.tsx", {
      "@clerk/nextjs": { ClerkProvider: Provider },
      "../../lib/clerk-env": { getClerkPublishableKey: () => key },
      "../../lib/private-surface-metadata": { privateSurfaceMetadata: { robots: { index: false } } },
    });
    const html = renderToStaticMarkup(Web3Layout({ children: React.createElement("main", null, "Web3 opcional") }));
    assert.match(html, /Web3 opcional/); assert.equal(providers, key ? 1 : 0);
    assert.equal(html.includes('data-web3-provider="true"'), Boolean(key));
    assert.deepEqual(metadata, { robots: { index: false } });
  }
});

test("wallet offers the same optional Web3 destination only on explicit navigation without prefetch", () => {
  const links = [], Icon = () => React.createElement("svg");
  const Link = ({ href, prefetch, children, ...props }) => { links.push({ href, prefetch }); return React.createElement("a", { href, ...props }, children); };
  const { MetamaskSandboxCard } = load("app/me/wallet/metamask-sandbox-card.tsx", {
    "next/link": { __esModule: true, default: Link },
    "lucide-react": new Proxy({}, { get: (_, name) => name === "__esModule" ? true : Icon }),
  });
  renderToStaticMarkup(React.createElement(MetamaskSandboxCard, { initialWallet: null, autoConnect: false }));
  const web3 = links.filter(row => row.href === "/web3/sign-in?next=/me/wallet");
  assert.deepEqual(web3, [{ href: "/web3/sign-in?next=/me/wallet", prefetch: false }]);
});

function loadBridge(authImpl, configured = true) {
  const calls = [];
  const { POST } = load("app/api/consumer/auth/web3/route.ts", {
    "@clerk/nextjs/server": { auth: authImpl }, "next/server": { NextResponse: class extends Response {
      static json = response.json;
    } },
    "@product/config": { productUrls: { api: "https://qa-api.invalid" } },
    "../../../../../lib/clerk-env": { isClerkConfiguredForRuntime: () => configured },
  }, async (url, init) => { calls.push({ url, init }); return Response.json({ ok: true }, { headers: { "set-cookie": "consumer_session=QA_ONLY; Domain=qa-api.invalid; Secure; HttpOnly" } }); });
  return { POST, calls };
}

const bridgeRequest = (payload = {}) => new Request("https://nexid.lat/api/consumer/auth/web3", {
  method: "POST", headers: { "content-type": "application/json", host: "nexid.lat" }, body: JSON.stringify(payload),
});

test("the preserved Web3 bridge rejects absent or failed server identity before any upstream call", async () => {
  for (const authImpl of [async () => null, async () => { throw Error("synthetic auth failure"); }, async () => ({ userId: "QA_USER", getToken: async () => null }), async () => ({ userId: null, getToken: async () => "QA_TOKEN" }), async () => ({ userId: "QA_USER", getToken: async () => { throw Error("synthetic token failure"); } })]) {
    const loaded = loadBridge(authImpl), res = await loaded.POST(bridgeRequest({ externalUserId: "QA_SPOOF", token: "QA_SPOOF" }));
    assert.equal(res.status, 401); assert.deepEqual(await res.json(), { ok: false, error: "clerk_session_required" }); assert.equal(loaded.calls.length, 0);
  }
  const unconfigured = loadBridge(async () => { throw Error("Auth must not be reached"); }, false);
  assert.equal((await unconfigured.POST(bridgeRequest())).status, 503); assert.equal(unconfigured.calls.length, 0);
});

test("the preserved Web3 bridge sends only the server-verified token and receives own consumer cookies", async () => {
  const loaded = loadBridge(async () => ({ userId: "QA_SERVER_USER", getToken: async () => "QA_SERVER_VERIFIED_TOKEN" }));
  const res = await loaded.POST(bridgeRequest({ chainId: "0x89", token: "QA_CLIENT_TOKEN", externalUserId: "QA_CLIENT_USER", walletAddress: "QA_CLIENT_ADDRESS" }));
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { ok: true }); assert.equal(loaded.calls.length, 1);
  assert.equal(loaded.calls[0].url, "https://qa-api.invalid/consumer/auth/web3");
  assert.equal(loaded.calls[0].init.headers.authorization, "Bearer QA_SERVER_VERIFIED_TOKEN");
  assert.deepEqual(JSON.parse(loaded.calls[0].init.body), { chainId: "0x89" });
  assert.equal(loaded.calls[0].init.cache, "no-store");
  assert(!Object.hasOwn(loaded.calls[0].init.headers, "cookie"));
  const cookie = res.headers.get("set-cookie"); assert.match(cookie, /consumer_session=QA_ONLY/); assert.match(cookie, /Secure/); assert.doesNotMatch(cookie, /Domain=/);
});
