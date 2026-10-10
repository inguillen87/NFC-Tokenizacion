import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as tapHandoff from "../src/app/api/_lib/consumer-tap-handoff.ts";
// Execute the actual BFF with explicit server-only boundaries. Individual
// contract tests inject transport; default protected transport is exercised in
// server-api-transport.test.mjs with isolated environment and synthetic fetch.
const code = ts.transpileModule(readFileSync(new URL("../src/app/api/_lib/sommelier-proxy.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", code)(name => {
  if (name === "@product/config") return { productUrls: { api: "https://api.nexid.lat" } };
  if (name === "./consumer-tap-handoff") return tapHandoff;
  if (name === "./server-api-transport") return { fetchRuntimeApi: () => { throw Error("Unexpected default network"); } };
  throw Error(`Unexpected dependency: ${name}`);
}, loaded, loaded.exports);
const { proxySommelierRequest } = loaded.exports;
const request = (headers = {}, body = "{}") => new Request("https://nexid.lat/api/sommelier/chat", { method: "POST", headers: { origin: "https://nexid.lat", "sec-fetch-site": "same-origin", "content-type": "application/json", ...headers }, body });
test("BFF denies foreign/missing origins, hostile fetch sites and non-JSON before contacting API", async () => {
  for (const headers of [{ origin: "https://hostile.nexid.lat" }, { origin: "" }, { "sec-fetch-site": "same-site" }, { "content-type": "text/plain" }]) {
    const result = await proxySommelierRequest(request(headers), "/sommelier/chat", { fetchImpl: () => { throw Error("Must not forward"); } });
    assert.ok([403, 415].includes(result.status));
  }
});
test("BFF preserves caller provenance, keeps NFC capabilities away, and does not echo provider credentials/errors", async () => {
  const calls = [];
  const result = await proxySommelierRequest(request({ cookie: "__Host-nexid_tap_715=private; consumer=session; __Host-nexid_sommelier_demo=grant", "user-agent": "QA mobile", "x-forwarded-for": "192.0.2.1" }, '{"mode":"consumer"}'), "/sommelier/chat", { fetchImpl: async (url, init) => {
    calls.push({ url, ...init });
    return Response.json({ ok: true, answer: "QA" });
  } });
  assert.equal(result.status, 200);
  assert.equal(calls[0].url, "https://api.nexid.lat/sommelier/chat");
  assert.equal(calls[0].headers.origin, "https://nexid.lat");
  assert.equal(calls[0].headers.cookie, "consumer=session; __Host-nexid_sommelier_demo=grant");
  assert.equal(calls[0].headers["x-forwarded-for"], "192.0.2.1");
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.equal(result.headers.get("vary"), "Cookie");
  const failed = await proxySommelierRequest(request(), "/sommelier/chat", { fetchImpl: async () => { throw Error("Sensitive diagnostic"); } });
  assert.doesNotMatch(await failed.text(), /Sensitive/);
});
test("only the dedicated HttpOnly Secure cookie crosses the demo BFF", async () => {
  const upstream = new Response('{"ok":true}', { headers: { "set-cookie": "__Host-nexid_sommelier_demo=grant; Path=/; HttpOnly; SameSite=Lax; Secure; Domain=api.nexid.lat" } });
  const result = await proxySommelierRequest(request(), "/public/sommelier/demo/session", { fetchImpl: async () => upstream });
  assert.match(result.headers.get("set-cookie"), /^__Host-nexid_sommelier_demo=grant/);
  assert.doesNotMatch(result.headers.get("set-cookie"), /Domain=/);
  for (const cookie of ["other=unsafe; Path=/; HttpOnly; Secure", "__Host-nexid_sommelier_demo=grant; Path=/; Secure", "__Host-nexid_sommelier_demo=grant; Path=/; HttpOnly"]) {
    const res = await proxySommelierRequest(request(), "/public/sommelier/demo/session", { fetchImpl: async () => new Response("{}", { headers: { "set-cookie": cookie } }) });
    assert.equal(res.headers.get("set-cookie"), null);
  }
});
test("BFF bounds streaming payloads/responses and cannot hang on a provider body", async () => {
  let calls = 0;
  const tooLarge = await proxySommelierRequest(request({}, "x".repeat(12_289)), "/sommelier/chat", { fetchImpl: async () => { calls++; return Response.json({}); } });
  assert.equal(tooLarge.status, 413);
  assert.equal(calls, 0);
  const responseLarge = await proxySommelierRequest(request(), "/sommelier/chat", { fetchImpl: async () => new Response("x".repeat(24_577)) });
  assert.equal(responseLarge.status, 503);
  const result = await proxySommelierRequest(request(), "/sommelier/chat", { timeoutMs: 20, fetchImpl: async () => new Response(new ReadableStream({ start() {} })) });
  assert.equal(result.status, 503);
});
test("an unfinished browser upload is stopped before an upstream API call", async () => {
  let calls = 0;
  const slow = new Request("https://nexid.lat/api/sommelier/chat", { method: "POST", headers: { origin: "https://nexid.lat", "content-type": "application/json" }, body: new ReadableStream({ start() {} }), duplex: "half" });
  const result = await proxySommelierRequest(slow, "/sommelier/chat", { timeoutMs: 20, fetchImpl: async () => { calls++; return Response.json({}); } });
  assert.equal(result.status, 408);
  assert.equal(calls, 0);
});

test("the public Syngenta grant preserves its DTO and caller context while stripping both NFC capability cookie formats", async () => {
  const calls = [], body = JSON.stringify({ profile: "syngenta", locale: "es-AR" });
  const result = await proxySommelierRequest(request({
    cookie: "__Host-nexid_tap_715=physical; nexid_tap_716=development; consumer=session; __Host-nexid_sommelier_demo=wine; __Host-nexid_syngenta_demo=agro",
    authorization: "Bearer synthetic-consumer-token", "user-agent": "Synthetic mobile QA", "x-forwarded-for": "192.0.2.15", "x-real-ip": "192.0.2.16",
    "x-api-key": "must-not-forward", "x-tenant-id": "must-not-forward", "x-fresh-token": "must-not-forward",
  }, body), "/public/sommelier/demo/session", {
    apiBase: "https://api.nexid.lat/", fetchImpl: async (url, init) => {
      calls.push({ url, ...init }); return Response.json({ ok: true, profile: "syngenta" });
    },
  });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.nexid.lat/public/sommelier/demo/session");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].cache, "no-store");
  assert.equal(calls[0].body, body);
  assert.deepEqual(calls[0].headers, {
    "content-type": "application/json", origin: "https://nexid.lat", "sec-fetch-site": "same-origin",
    cookie: "consumer=session; __Host-nexid_sommelier_demo=wine; __Host-nexid_syngenta_demo=agro",
    authorization: "Bearer synthetic-consumer-token", "user-agent": "Synthetic mobile QA", "x-forwarded-for": "192.0.2.15", "x-real-ip": "192.0.2.16",
  });
});

test("agro and wine grants keep distinct cookie names and attributes; unrelated and NFC cookies cannot be set by BFF", async () => {
  const headers = new Headers();
  for (const cookie of [
    "__Host-nexid_syngenta_demo=agro; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900; Domain=api.nexid.lat",
    "__Host-nexid_sommelier_demo=wine; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900; Domain=api.nexid.lat",
    "__Host-nexid_tap_715=physical; Path=/; HttpOnly; Secure; SameSite=Strict",
    "consumer=upstream-session; Path=/; HttpOnly; Secure",
  ]) headers.append("set-cookie", cookie);
  const result = await proxySommelierRequest(request(), "/public/sommelier/demo/session", {
    apiBase: "https://api.nexid.lat/", fetchImpl: async () => new Response("{}", { headers }),
  });
  assert.deepEqual(result.headers.getSetCookie(), [
    "__Host-nexid_syngenta_demo=agro; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900",
    "__Host-nexid_sommelier_demo=wine; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900",
  ]);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.equal(result.headers.get("vary"), "Cookie");
  assert.equal(result.headers.get("referrer-policy"), "no-referrer");
});

test("Syngenta cookie relay rejects missing safety attributes, non-root paths and lookalike names", async () => {
  for (const cookie of [
    "__Host-nexid_syngenta_demo=grant; Path=/; Secure",
    "__Host-nexid_syngenta_demo=grant; Path=/; HttpOnly",
    "__Host-nexid_syngenta_demo=grant; Path=/api; HttpOnly; Secure",
    "__Host-nexid_syngenta_demo=grant; HttpOnly; Secure",
    "__Host-nexid_syngenta_demo_attacker=grant; Path=/; HttpOnly; Secure",
    "other=grant; Path=/; HttpOnly; Secure",
  ]) {
    const result = await proxySommelierRequest(request(), "/public/sommelier/demo/session", {
      apiBase: "https://api.nexid.lat/", fetchImpl: async () => new Response("{}", { headers: { "set-cookie": cookie } }),
    });
    assert.equal(result.headers.get("set-cookie"), null, cookie);
  }
});

test("same-site subdomains and non-POST requests cannot obtain public Syngenta grants", async () => {
  let calls = 0;
  const headersCases = [
    { origin: "https://dashboard.nexid.lat", "sec-fetch-site": "same-site" },
    { "sec-fetch-site": "same-site" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "none" }, { origin: "null" },
  ];
  for (const headers of headersCases) {
    const result = await proxySommelierRequest(request(headers), "/public/sommelier/demo/session", {
      fetchImpl: async () => { calls++; return Response.json({}); },
    });
    assert.equal(result.status, 403);
    assert.deepEqual(await result.json(), { ok: false, error: "forbidden" });
  }
  const get = new Request("https://nexid.lat/api/sommelier/demo/session", { headers: { origin: "https://nexid.lat", "content-type": "application/json" } });
  assert.equal((await proxySommelierRequest(get, "/public/sommelier/demo/session", { fetchImpl: async () => { calls++; return Response.json({}); } })).status, 403);
  assert.equal(calls, 0);
});

test("an API base carrying credentials, query, fragment or route cannot receive a demo request", async () => {
  let calls = 0;
  for (const apiBase of [
    "https://user:secret@api.nexid.lat/", "https://api.nexid.lat/?key=secret", "https://api.nexid.lat/#secret",
    "https://api.nexid.lat/custom-route", "http://api.nexid.lat/", "not-a-url",
  ]) {
    const result = await proxySommelierRequest(request(), "/public/sommelier/demo/session", {
      apiBase, fetchImpl: async () => { calls++; return Response.json({}); },
    });
    assert.equal(result.status, 503, apiBase);
    assert.deepEqual(await result.json(), { ok: false, error: "service_unavailable" });
  }
  assert.equal(calls, 0);
});

test("upstream statuses and bounded retry delays survive without provider headers or public caching", async () => {
  const result = await proxySommelierRequest(request({}, '{"mode":"demo","demoProfile":"syngenta"}'), "/sommelier/chat", {
    apiBase: "https://api.nexid.lat/", fetchImpl: async () => Response.json({ ok: false, error: "quota_exceeded" }, {
      status: 429, headers: { "retry-after": "30", "cache-control": "public, max-age=86400", "x-provider-key": "private", location: "https://provider.invalid/" },
    }),
  });
  assert.equal(result.status, 429);
  assert.deepEqual(await result.json(), { ok: false, error: "quota_exceeded" });
  assert.equal(result.headers.get("retry-after"), "30");
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.equal(result.headers.get("x-provider-key"), null);
  assert.equal(result.headers.get("location"), null);
  for (const retry of ["Wed, 21 Oct 2026 07:28:00 GMT", "9999999", "-1", "30; private"]) {
    const invalid = await proxySommelierRequest(request(), "/sommelier/chat", {
      apiBase: "https://api.nexid.lat/", fetchImpl: async () => Response.json({}, { headers: { "retry-after": retry } }),
    });
    assert.equal(invalid.headers.get("retry-after"), null);
  }
});

test("a deadline aborts an uncooperative Syngenta upstream and never releases its late response", async () => {
  let release, signal;
  const result = await proxySommelierRequest(request({}, '{"mode":"demo","demoProfile":"syngenta"}'), "/sommelier/chat", {
    apiBase: "https://api.nexid.lat/", timeoutMs: 20,
    fetchImpl: (_url, init) => { signal = init.signal; return new Promise(resolve => { release = resolve; }); },
  });
  assert.equal(result.status, 503);
  assert.equal(signal.aborted, true);
  assert.deepEqual(await result.json(), { ok: false, error: "service_unavailable" });
  release(Response.json({ ok: true, answer: "Late answer", demoProfile: "syngenta" }));
  await new Promise(resolve => setImmediate(resolve));
});

test("browser cancellation aborts upstream transport and cancels a pending response body", async () => {
  const controller = new AbortController();
  let signal, announceStarted, announceCancelled;
  const started = new Promise(resolve => { announceStarted = resolve; });
  const cancelled = new Promise(resolve => { announceCancelled = resolve; });
  const req = new Request("https://nexid.lat/api/sommelier/chat", {
    method: "POST", headers: { origin: "https://nexid.lat", "content-type": "application/json" },
    body: '{"mode":"demo","demoProfile":"syngenta"}', signal: controller.signal,
  });
  const pending = proxySommelierRequest(req, "/sommelier/chat", {
    apiBase: "https://api.nexid.lat/", fetchImpl: async (_url, init) => {
      signal = init.signal;
      return new Response(new ReadableStream({ start() { announceStarted(); }, cancel() { announceCancelled(); } }));
    },
  });
  await started;
  controller.abort();
  const result = await pending;
  assert.equal(result.status, 503);
  assert.equal(signal.aborted, true);
  assert.equal(await Promise.race([cancelled.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 100))]), true,
    "an abort must cancel the stream reader, not leave its response body locked and pending");
});

test("an upstream body arriving after deadline is cancelled without being read indefinitely", async () => {
  let release, announceCancelled;
  const cancelled = new Promise(resolve => { announceCancelled = resolve; });
  const result = await proxySommelierRequest(request(), "/sommelier/chat", {
    apiBase: "https://api.nexid.lat/", timeoutMs: 20,
    fetchImpl: () => new Promise(resolve => { release = resolve; }),
  });
  assert.equal(result.status, 503);
  release(new Response(new ReadableStream({ start() {}, cancel() { announceCancelled(); } })));
  assert.equal(await Promise.race([cancelled.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 100))]), true,
    "a late transport response must release its body after the shared deadline");
});
