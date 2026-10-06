import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { CONSUMER_READ_TIMEOUT_MS, consumerSessionState, fetchConsumerJson } from "../src/app/me/_components/consumer-bounded-fetch.ts";
import { homeReadingHref } from "../src/app/me/_components/consumer-home-model.ts";
import { rewardTenant } from "../src/app/me/_components/consumer-rewards-model.ts";

test("consumer reads time out stalled headers, even when the transport ignores abort", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal;
  const pending = fetchConsumerJson("https://api.example.test/consumer/session", { cache: "no-store" }, {
    fetchImpl: async (_url, init) => { signal = init.signal; return new Promise(() => {}); },
  });
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(CONSUMER_READ_TIMEOUT_MS - 1);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  assert.deepEqual(await pending, { status: "unavailable", reason: "timeout" });
  assert.equal(signal.aborted, true);
});

test("the same deadline covers JSON body stalls and cancels the response body", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let cancelled = 0;
  let signal;
  const pending = fetchConsumerJson("https://api.example.test/consumer/products", {}, {
    fetchImpl: async (_url, init) => {
      signal = init.signal;
      return { ok: true, body: { cancel: async () => { cancelled += 1; } }, json: () => new Promise(() => {}) };
    },
  });
  await Promise.resolve();
  t.mock.timers.tick(CONSUMER_READ_TIMEOUT_MS);
  assert.deepEqual(await pending, { status: "unavailable", reason: "timeout" });
  assert.equal(signal.aborted, true);
  assert.equal(cancelled, 1);
});

test("a response arriving after timeout is discarded without parsing private JSON", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let respond;
  let parsed = 0;
  let cancelled = 0;
  const pending = fetchConsumerJson("https://api.example.test/consumer/me", {}, {
    fetchImpl: () => new Promise((resolve) => { respond = resolve; }),
  });
  t.mock.timers.tick(CONSUMER_READ_TIMEOUT_MS);
  assert.equal((await pending).reason, "timeout");
  respond({ ok: true, body: { cancel: async () => { cancelled += 1; } }, json: async () => { parsed += 1; return { private: "not exposed" }; } });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(parsed, 0);
  assert.equal(cancelled, 1);
});

test("successful reads clear the deadline, retain cache policy and never abort afterward", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let init;
  const data = { ok: true, items: [] };
  const result = await fetchConsumerJson("https://api.example.test/consumer/products", { cache: "no-store", headers: { cookie: "session=private" } }, {
    fetchImpl: async (_url, passedInit) => { init = passedInit; return new Response(JSON.stringify(data)); },
  });
  assert.deepEqual(result, { status: "ready", data });
  assert.equal(init.cache, "no-store");
  assert.equal(init.headers.cookie, "session=private");
  t.mock.timers.tick(CONSUMER_READ_TIMEOUT_MS * 2);
  assert.equal(init.signal.aborted, false);
});

test("failed HTTP reads cancel the body without treating provider content as a session", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let cancelled = 0;
  let parsed = 0;
  let signal;
  const result = await fetchConsumerJson("https://api.example.test/consumer/session", {}, {
    fetchImpl: async (_url, init) => {
      signal = init.signal;
      return { ok: false, status: 503, body: { cancel: async () => { cancelled += 1; } }, json: async () => { parsed += 1; return { ok: true, authenticated: true }; } };
    },
  });
  assert.deepEqual(result, { status: "http-error", httpStatus: 503 });
  assert.equal(cancelled, 1);
  assert.equal(parsed, 0);
  t.mock.timers.tick(CONSUMER_READ_TIMEOUT_MS);
  assert.equal(signal.aborted, false);
});

test("network rejection and invalid JSON stay unavailable, without leaking raw errors", async () => {
  const network = await fetchConsumerJson("https://api.example.test/consumer/session", {}, {
    fetchImpl: async () => { throw new Error("secret diagnostic"); },
  });
  assert.deepEqual(network, { status: "unavailable", reason: "network" });
  const malformed = await fetchConsumerJson("https://api.example.test/consumer/session", {}, {
    fetchImpl: async () => new Response("{broken"),
  });
  assert.deepEqual(malformed, { status: "unavailable", reason: "invalid-json" });
});

test("only a verified session opens private content; only explicit unauthentication requests login", () => {
  assert.equal(consumerSessionState({ status: "ready", data: { ok: true, authenticated: true } }), "authenticated");
  assert.equal(consumerSessionState({ status: "ready", data: { ok: true, authenticated: false } }), "unauthenticated");
  assert.equal(consumerSessionState({ status: "http-error", httpStatus: 401 }), "unauthenticated");
  for (const httpStatus of [403, 429, 500, 502, 503, 504]) {
    assert.equal(consumerSessionState({ status: "http-error", httpStatus }), "unavailable");
  }
  for (const data of [null, [], {}, { ok: false, authenticated: false }, { ok: true }, { authenticated: true }, { ok: true, authenticated: "true" }, { ok: 1, authenticated: true }]) {
    assert.equal(consumerSessionState({ status: "ready", data }), "unavailable");
  }
  for (const reason of ["network", "timeout", "invalid-json"]) assert.equal(consumerSessionState({ status: "unavailable", reason }), "unavailable");
});

const require = createRequire(import.meta.url);
const components = new URL("../src/app/me/_components/", import.meta.url);
const root = new URL("../src/app/me/", import.meta.url);
function compile(source, overrides = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

function loadApi(result) {
  const calls = [];
  const api = compile(readFileSync(new URL("consumer-api.ts", components), "utf8"), {
    "next/headers": { headers: async () => {
      if (result instanceof Error) throw result;
      return new Headers({ cookie: "session=private; capability=one-use", "user-agent": "test" });
    } },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "../../api/_lib/consumer-tap-handoff": { stripConsumerTapCapabilityCookies: () => "session=private" },
    "./consumer-bounded-fetch": {
      consumerSessionState,
      fetchConsumerJson: async (url, init) => { calls.push({ url, init }); return result; },
    },
  });
  return { api, calls };
}

test("session lookup preserves next and strips single-use capabilities from private reads", async () => {
  const next = "/me?fromTap=1&tapEventId=732";
  const denied = loadApi({ status: "http-error", httpStatus: 401 });
  await assert.rejects(() => denied.api.requireConsumerSession(next), (error) => error.message === `redirect:/login?consumer=1&next=${encodeURIComponent(next)}`);
  const accepted = loadApi({ status: "ready", data: { ok: true, authenticated: true } });
  await accepted.api.requireConsumerSession(next);
  assert.equal(accepted.calls[0].init.cache, "no-store");
  assert.equal(accepted.calls[0].init.headers.cookie, "session=private");
});

test("home session reads preserve genuine 401 login and authenticate only a verified envelope", async () => {
  const next = "/me?fromTap=1&tapEventId=732&action=rewards";
  for (const result of [{ status: "http-error", httpStatus: 401 }, { status: "ready", data: { ok: true, authenticated: false } }]) {
    const loaded = loadApi(result);
    await assert.rejects(() => loaded.api.readConsumerHomeSession(next), (error) => error.message === `redirect:/login?consumer=1&next=${encodeURIComponent(next)}`);
    assert.equal(loaded.calls.length, 1);
  }
  const accepted = loadApi({ status: "ready", data: { ok: true, authenticated: true } });
  assert.deepEqual(await accepted.api.readConsumerHomeSession(next), { status: "ready" });
  assert.equal(accepted.calls[0].init.cache, "no-store");
  assert.equal(accepted.calls[0].init.headers.cookie, "session=private");
});

test("generic and compatible home session readers return typed unavailability; legacy strict gates stay fail closed", async () => {
  for (const result of [{ status: "unavailable", reason: "network" }, { status: "unavailable", reason: "timeout" }, { status: "unavailable", reason: "invalid-json" }, { status: "http-error", httpStatus: 500 }, { status: "http-error", httpStatus: 503 }, { status: "ready", data: {} }, { status: "ready", data: { ok: true, authenticated: "true" } }]) {
    const loaded = loadApi(result);
    assert.deepEqual(await loaded.api.readConsumerSession(), { status: "unavailable" });
    assert.deepEqual(await loaded.api.readConsumerHomeSession(), { status: "unavailable" });
    await assert.rejects(() => loaded.api.requireConsumerSession(), /consumer_session_unavailable/);
  }
});

const consumerDestinations = [
  { file: "page.tsx", next: "/me?fromTap=1&eventId=732&tenant=balmec&action=save", query: { fromTap: "1", eventId: "732", tenant: "balmec", action: "save" } },
  { file: "products/page.tsx", next: "/me/products?focus=9007199254740993&tenant=balmec", query: { focus: "9007199254740993", tenant: "balmec" } },
  { file: "rewards/page.tsx", next: "/me/rewards?fromTap=1&eventId=732&tenant=balmec&action=rewards&voucher=claim-8", query: { fromTap: "1", eventId: "732", tenant: "balmec", action: "rewards", voucher: "claim-8" } },
  { file: "marketplace/page.tsx", next: "/me/marketplace?fromTap=1&eventId=732&tenant=balmec&action=marketplace", query: { fromTap: "1", eventId: "732", tenant: "balmec", action: "marketplace" } },
  { file: "wallet/page.tsx", next: "/me/wallet?tenant=balmec&connect=metamask", query: { tenant: "balmec", connect: "metamask" } },
  { file: "passport/page.tsx", next: "/me/passport?tenant=balmec&eventId=732", query: { tenant: "balmec", eventId: "732" } },
  { file: "brands/page.tsx", next: "/me/brands?tenant=balmec&fromTap=1&action=join", query: { tenant: "balmec", fromTap: "1", action: "join" } },
  { file: "experiences/page.tsx", next: "/me/experiences?tenant=balmec&eventId=732&product=Vino+de+reserva", query: { tenant: "balmec", eventId: "732", product: "Vino de reserva" } },
  { file: "sommelier/page.tsx", next: "/me/sommelier?tenant=balmec&product=Vino+de+reserva", query: { tenant: "balmec", product: "Vino de reserva" } },
  { file: "cork-analyzer/page.tsx", next: "/me/cork-analyzer?tenant=balmec&eventId=732", query: { tenant: "balmec", eventId: "732" } },
  { file: "privacy/page.tsx", next: "/me/privacy?tenant=balmec&scope=brand_updates&scope=marketing", query: { tenant: "balmec", scope: ["brand_updates", "marketing"] } },
  { file: "security/page.tsx", next: "/me/security?fromTap=1&eventId=732", query: { fromTap: "1", eventId: "732" } },
  { file: "taps/page.tsx", next: "/me/taps?tenant=balmec&from=2026-09-01&to=2026-10-06&event=VALID_CLOSED", query: { tenant: "balmec", from: "2026-09-01", to: "2026-10-06", event: "VALID_CLOSED" } },
  { file: "taps/[eventId]/page.tsx", next: "/me/taps/9007199254740993?tenant=balmec&fromTap=1", query: { tenant: "balmec", fromTap: "1" }, params: { eventId: "9007199254740993" } },
  { file: "taps/[eventId]/page.tsx", next: "/me/taps?tenant=balmec", query: { tenant: "balmec" }, params: { eventId: "invalid-reference" } },
];

/** Execute each real server page with the real session reader. Other imports
 * fail loudly if a private model or action is reached before confirmation.
 */
function loadSessionOnlyPage(destination, loaded) {
  const source = readFileSync(new URL(destination.file, root), "utf8");
  const ConsumerPortalUnavailable = () => null;
  const forbidden = (name) => () => { throw new Error(`Reached private page dependency before session confirmation: ${name}`); };
  const overrides = Object.fromEntries(ts.preProcessFile(source).importedFiles.map(({ fileName }) => {
    if (fileName.endsWith("/consumer-api")) return [fileName, loaded.api];
    if (fileName.endsWith("/consumer-portal-recovery")) return [fileName, { ConsumerPortalUnavailable }];
    return [fileName, new Proxy({}, { get: (_, name) => {
      if (fileName.endsWith("/consumer-home-model") && name === "homeReadingHref") return homeReadingHref;
      if (fileName.endsWith("/consumer-rewards-model") && name === "rewardTenant") return rewardTenant;
      if (name === "__esModule") return true;
      return forbidden(`${fileName}/${String(name)}`);
    } })];
  }));
  return { page: compile(source, overrides).default, ConsumerPortalUnavailable };
}

function destinationInput(destination) {
  return { searchParams: Promise.resolve(destination.query), ...(destination.params ? { params: Promise.resolve(destination.params) } : {}) };
}

test("every customer destination renders recoverable session unavailability before private reads or actions", async (t) => {
  for (const destination of consumerDestinations) await t.test(destination.file, async () => {
    for (const result of [
      { status: "unavailable", reason: "timeout" }, { status: "unavailable", reason: "network" }, { status: "unavailable", reason: "invalid-json" },
      { status: "http-error", httpStatus: 403 }, { status: "http-error", httpStatus: 429 }, { status: "http-error", httpStatus: 500 },
      { status: "ready", data: {} }, { status: "ready", data: { ok: true, authenticated: "true" } },
    ]) {
      const loaded = loadApi(result);
      const { page, ConsumerPortalUnavailable } = loadSessionOnlyPage(destination, loaded);
      assert.equal((await page(destinationInput(destination))).type, ConsumerPortalUnavailable);
      assert.deepEqual(loaded.calls.map(call => new URL(call.url).pathname), ["/consumer/session"]);
      assert.equal(loaded.calls[0].init.headers.cookie, "session=private");
    }
  });
});

test("every customer destination preserves its exact return context on confirmed unauthentication", async (t) => {
  for (const destination of consumerDestinations) await t.test(destination.file, async () => {
    for (const result of [{ status: "http-error", httpStatus: 401 }, { status: "ready", data: { ok: true, authenticated: false } }]) {
      const loaded = loadApi(result);
      const { page } = loadSessionOnlyPage(destination, loaded);
      await assert.rejects(() => page(destinationInput(destination)), (error) => error.message === `redirect:/login?consumer=1&next=${encodeURIComponent(destination.next)}`);
      assert.deepEqual(loaded.calls.map(call => new URL(call.url).pathname), ["/consumer/session"]);
    }
  });
});

test("every customer destination leaves unexpected exceptions to the genuine route error boundary", async (t) => {
  for (const destination of consumerDestinations) await t.test(destination.file, async () => {
    const failure = new Error("unexpected request context failure");
    const loaded = loadApi(failure);
    const { page } = loadSessionOnlyPage(destination, loaded);
    await assert.rejects(() => page(destinationInput(destination)), (error) => error === failure);
    assert.equal(loaded.calls.length, 0);
  });
});

test("an unknown session stops the page before any private account, collection or brand lookup", async () => {
  const pageSource = readFileSync(new URL("page.tsx", root), "utf8");
  const ConsumerPortalUnavailable = () => null;
  for (const result of [{ status: "unavailable", reason: "timeout" }, { status: "http-error", httpStatus: 503 }, { status: "ready", data: {} }]) {
    const loaded = loadApi(result);
    const page = compile(pageSource, {
      "./_components/consumer-api": loaded.api,
      "./_components/portal-shell": { PortalShell: () => null },
      "./_components/consumer-home-model": { buildConsumerHomeModel: () => { throw new Error("private model must not render"); } },
      "./_components/me-portal-interactive-client": { MePortalInteractiveClient: () => null },
      "./_components/consumer-portal-recovery": { ConsumerPortalUnavailable },
    }).default;
    assert.equal((await page({ searchParams: Promise.resolve({ fromTap: "1", tapEventId: "732" }) })).type, ConsumerPortalUnavailable);
    assert.equal(loaded.calls.length, 1);
    assert.ok(loaded.calls[0].url.endsWith("/consumer/session"));
  }
});

test("home page reads all four private sources only after its session is confirmed", async () => {
  const loaded = loadApi({ status: "ready", data: { ok: true, authenticated: true, consumer: { id: "qa-only" }, stats: {}, items: [] } });
  const models = [];
  const MePortalInteractiveClient = () => null;
  const page = compile(readFileSync(new URL("page.tsx", root), "utf8"), {
    "./_components/consumer-api": loaded.api,
    "./_components/portal-shell": { PortalShell: () => null },
    "./_components/consumer-home-model": { buildConsumerHomeModel: (sources) => { models.push(sources); return "model-qa"; } },
    "./_components/me-portal-interactive-client": { MePortalInteractiveClient },
    "./_components/consumer-portal-recovery": { ConsumerPortalUnavailable: () => { throw new Error("unavailable must not render"); } },
  }).default;
  const element = await page({});
  assert.deepEqual(loaded.calls.map((call) => new URL(call.url).pathname), ["/consumer/session", "/consumer/me", "/consumer/products", "/consumer/taps", "/consumer/brands"]);
  assert.equal(models.length, 1);
  assert.equal(models[0].account.consumer.id, "qa-only");
  assert.equal(element.props.children.type, MePortalInteractiveClient);
  assert.equal(element.props.children.props.model, "model-qa");
});

test("unexpected session read exceptions still propagate to the real route error boundary", async () => {
  const failure = new Error("unexpected request context failure");
  const loaded = loadApi(failure);
  await assert.rejects(() => loaded.api.readConsumerHomeSession(), (error) => error === failure);
  await assert.rejects(() => loaded.api.readConsumerSession(), (error) => error === failure);
  await assert.rejects(() => loaded.api.requireConsumerSession(), (error) => error === failure);
  assert.equal(loaded.calls.length, 0);
});

test("portal reads reject non-object JSON and validate nested contact and detail records", async () => {
  for (const data of [null, [], "unexpected", 1]) {
    const { api } = loadApi({ status: "ready", data });
    assert.equal(await api.fetchConsumerMe(), null);
    assert.equal(await api.fetchConsumerPath("products"), null);
  }
  for (const item of [null, [], "wrong", 1]) {
    const { api } = loadApi({ status: "ready", data: { ok: true, item } });
    assert.deepEqual(await api.fetchConsumerPath("taps/1"), { ok: true, item: null });
  }
  const { api } = loadApi({ status: "ready", data: { ok: true, consumer: { id: "synthetic", email: [], phone: 123, status: null, display_name: "Cuenta QA" }, stats: [] } });
  assert.deepEqual(await api.fetchConsumerMe(), { ok: true, consumer: { id: "synthetic", email: null, phone: null, status: undefined, display_name: "Cuenta QA" }, stats: null });
  const invalidContact = loadApi({ status: "ready", data: { ok: true, consumer: { id: null }, stats: { products: 0 } } });
  assert.deepEqual(await invalidContact.api.fetchConsumerMe(), { ok: true, consumer: null, stats: { products: 0 } });
});

const styles = new Proxy({}, { get: (_, name) => String(name) });
const brand = compile(readFileSync(new URL("../../components/brand-home-link-static.tsx", root), "utf8"), {
  "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => React.createElement("a", props, children) },
  "./brand-home-link-types": { homeLabel: () => "Inicio" },
  "./brand-home-link.module.css": { __esModule: true, default: styles },
});
const loading = compile(readFileSync(new URL("loading.tsx", root), "utf8"), {
  "../../components/brand-home-link-static": brand,
  "./portal-state.module.css": { __esModule: true, default: styles },
}).default;

test("portal loading reserves a static identity and skeleton with one meaningful live status", () => {
  const html = renderToStaticMarkup(React.createElement(loading));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /role="status"/);
  assert.match(html, /Abriendo tu espacio/);
  assert.match(html, /Estamos consultando tu cuenta y tus productos/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /<animate|<img|<video|repeatCount|authenticated|guardado|Titularidad/);
  const css = readFileSync(new URL("portal-state.module.css", root), "utf8");
  assert.doesNotMatch(css, /animation:|@keyframes|transition:/);
});

function contrast(a, b) {
  const lum = (hex) => {
    const c = hex.slice(1).match(/.{2}/g).map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

test("portal loading and recovery use readable themes and focusable 44-pixel actions", () => {
  const css = readFileSync(new URL("portal-state.module.css", root), "utf8");
  const themes = [...css.matchAll(/--state-text: (#[\da-f]+);[\s\S]*?--state-accent: (#[\da-f]+);/g)].map((match) => Object.fromEntries([...match[0].matchAll(/--state-([\w-]+): (#[\da-f]+);/g)].map((v) => [v[1], v[2]])));
  assert.equal(themes.length, 2);
  for (const theme of themes) {
    for (const ink of ["text", "muted", "accent"]) for (const surface of ["surface", "base", "subtle"]) {
      assert.ok(contrast(theme[ink], theme[surface]) >= 4.5, `${ink}/${surface}`);
    }
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height: 2\.75rem/);
  assert.match(css, /safe-area-inset-bottom/);
  const recovery = readFileSync(new URL("consumer-portal-recovery.tsx", components), "utf8");
  assert.match(recovery, /heading\.current\?\.focus\(\)/);
  assert.match(recovery, /no confirma si el último producto quedó guardado/);
  assert.doesNotMatch(recovery, /error\.message|error\.stack|error\.digest|setInterval|fetch\(/);
});

function loadRecovery(pending) {
  let refreshes = 0;
  let transitions = 0;
  const recovery = compile(readFileSync(new URL("consumer-portal-recovery.tsx", components), "utf8"), {
    react: { ...React, useTransition: () => [pending, (callback) => { transitions += 1; callback(); }] },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshes += 1; } }) },
    "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => React.createElement("a", props, children) },
    "../../../components/brand-home-link-static": brand,
    "../portal-state.module.css": { __esModule: true, default: styles },
  });
  return { recovery, counts: () => ({ refreshes, transitions }) };
}

test("session-unavailable retry only refreshes the router and disables itself with visible pending feedback", () => {
  const idle = loadRecovery(false);
  const state = idle.recovery.ConsumerPortalUnavailable();
  const html = renderToStaticMarkup(state);
  assert.match(html, /data-testid="consumer-portal-unavailable"/);
  assert.match(html, /id="consumer-session-unavailable-title"/);
  assert.match(html, /aria-busy="false"/);
  assert.match(html, />Reintentar<\/button>/);
  state.props.retry();
  assert.deepEqual(idle.counts(), { refreshes: 1, transitions: 1 });

  const active = loadRecovery(true);
  const pending = active.recovery.ConsumerPortalUnavailable();
  const pendingHtml = renderToStaticMarkup(pending);
  assert.match(pendingHtml, /disabled="" aria-busy="true"/);
  assert.match(pendingHtml, />Consultando…<\/button>/);
  pending.props.retry();
  assert.deepEqual(active.counts(), { refreshes: 0, transitions: 0 });
});

test("the genuine route error boundary retains its reset or supplied retry contract", () => {
  const { recovery } = loadRecovery(false);
  const boundary = compile(readFileSync(new URL("error.tsx", root), "utf8"), {
    "./_components/consumer-portal-recovery": recovery,
  }).default;
  const reset = () => {};
  const retry = () => {};
  assert.equal(boundary({ error: new Error("unexpected"), reset }).props.retry, reset);
  const element = boundary({ error: new Error("unexpected"), reset, retry });
  assert.equal(element.props.retry, retry);
  const html = renderToStaticMarkup(element);
  assert.match(html, /data-testid="consumer-portal-error"/);
  assert.match(html, /id="consumer-error-title"/);
  assert.doesNotMatch(html, /consumer-portal-unavailable|unexpected/);
});
