import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as availability from "../src/app/sun/tenant-action-availability.ts";
import * as bounded from "../src/app/me/_components/consumer-bounded-fetch.ts";
import * as guidance from "../src/lib/sommelier-guidance.ts";
import * as guards from "../src/lib/public-api-guard.ts";

const require = createRequire(import.meta.url);
function load(path, overrides) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const m = { exports: {} }; new Function("require", "module", "exports", js)(name => name in overrides ? overrides[name] : require(name), m, m.exports); return m.exports;
}
const reader = load("../src/lib/public-tenant-configuration.ts", {
  "@product/config": { productUrls: { api: "https://api.example.invalid" } },
  "../app/me/_components/consumer-bounded-fetch": bounded,
  "../app/sun/tenant-action-availability": availability,
  "../app/api/_lib/server-api-transport": { fetchRuntimeApi: () => { throw Error("Unexpected default network"); } },
});
const configuration = { version: availability.TENANT_ACTIONS_VERSION, status: "published", allowedActions: ["sommelier"], program: null, trivia: null, catalogAvailable: false };
const next = { NextResponse: { json: (body, options = {}) => new Response(JSON.stringify(body), { ...options, headers: { "content-type": "application/json", ...options.headers } }) } };

test("public configuration only reads a canonical durable event and strips private fields", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push([url, options]); return new Response(JSON.stringify({ ok: true, configuration: { ...configuration, email: "synthetic@example.invalid" } })); };
  assert.deepEqual(await reader.readPublicTenantConfiguration("715", { fetchImpl }), configuration);
  assert.equal(calls[0][0], "https://api.example.invalid/public/passport/715/configuration");
  const options = calls[0][1]; assert.equal(options.method, "GET"); assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
  assert.deepEqual(options.headers, { accept: "application/json" });
  for (const value of ["0", "01", "../715", "715?tenant=other", "9223372036854775808", "715\n"]) assert.equal(await reader.readPublicTenantConfiguration(value, { fetchImpl }), null);
  assert.equal(calls.length, 1);
});
test("failed or incomplete configuration responses fail closed within a bounded read", async () => {
  for (const payload of [{ ok: false }, { ok: true, configuration: {} }, { configuration }]) assert.equal(await reader.readPublicTenantConfiguration("715", { fetchImpl: async () => new Response(JSON.stringify(payload)) }), null);
  assert.equal(await reader.readPublicTenantConfiguration("715", { fetchImpl: async () => new Promise(() => {}), timeoutMs: 15 }), null);
  assert.equal(await reader.readPublicTenantConfiguration("715", { fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }), timeoutMs: 15 }), null);
});
function cognitive(config) {
  const reads = [];
  const route = load("../src/app/api/cognitive-ai/route.ts", {
    "next/server": next,
    "../../../lib/public-tenant-configuration": { configurationEventId: reader.configurationEventId, readPublicTenantConfiguration: async event => { reads.push(event); return config; } },
    "../../sun/tenant-action-availability": availability,
    "../../../lib/sommelier-guidance": guidance,
    "../../../lib/public-api-guard": { ...guards, consumePublicApiRateLimit: () => 0, allowLocalServerFundedProviderCalls: () => false },
  });
  return { reads, post: payload => route.POST(new Request("https://web.example.invalid/api/cognitive-ai", { method: "POST", headers: { origin: "https://web.example.invalid", "content-type": "application/json" }, body: JSON.stringify({ text: "¿Con qué comida?", tone: "sommelier-chat", ...payload }) })) };
}
test("SUN Sommelier denies unavailable or unpublished services before provider and local guidance", async () => {
  for (const [config, expected] of [[null, 503], [{ ...configuration, status: "unpublished" }, 403], [{ ...configuration, allowedActions: [] }, 403]]) {
    const route = cognitive(config), response = await route.post({ postTapEventId: "715" });
    assert.equal(response.status, expected); const body = await response.json(); assert.equal(body.optimizedText, undefined); assert.deepEqual(route.reads, ["715"]);
  }
  const route = cognitive(configuration), response = await route.post({ postTapEventId: "../715" });
  assert.equal(response.status, 400); assert.equal(route.reads.length, 0);
});
test("published SUN and generic portal guidance stay separate without creating leads", async () => {
  const sun = cognitive(configuration), response = await sun.post({ postTapEventId: "715" });
  assert.equal(response.status, 200); assert.equal(typeof (await response.json()).optimizedText, "string"); assert.deepEqual(sun.reads, ["715"]);
  const portal = cognitive(null), general = await portal.post({}); assert.equal(general.status, 200); assert.equal(portal.reads.length, 0);
});
test("BFF only fetches configuration after a private reading has been authorized and validated", () => {
  const page = readFileSync(new URL("../src/app/me/taps/[eventId]/page.tsx", import.meta.url), "utf8");
  const sessionRead = page.indexOf("await readConsumerSession");
  const unavailableGuard = page.indexOf('if (session.status === "unavailable") return <ConsumerPortalUnavailable');
  const privateRead = page.indexOf("await fetchConsumerPath");
  const publicRead = page.indexOf("await readPublicTenantConfiguration");
  assert.ok(sessionRead >= 0 && unavailableGuard > sessionRead && privateRead > unavailableGuard && publicRead > privateRead);
  assert.match(page, /const configuration = reading \? await readPublicTenantConfiguration\(eventId\) : null/);
  assert.match(page, /reading\.tenantSlug && contextualActions\.marketplace/);
});

const canonicalEventIds = ["1", "42", "715", "9007199254740991", "9007199254740992", "9007199254740993", "9223372036854775806", "9223372036854775807"];
const invalidEventIds = ["", "0", "00", "01", "+1", "-1", "1.0", "1e3", "0x1", " 1", "1 ", "1\n", "1\r\n", "1\t", "\n1", "1\u2028", "١", "１２", "1/2", "1?tenant=other", "1#private", "9223372036854775808", "9999999999999999999", "10000000000000000000", null, undefined, 1, 9007199254740992, true, false, [], ["1"], {}, { toString() { throw Error("Must not coerce an event id"); } }];

test("configuration IDs use independent literal bigint boundaries and never coerce non-strings", () => {
  for (const id of canonicalEventIds) assert.equal(reader.configurationEventId(id), true, id);
  for (const [index, id] of invalidEventIds.entries()) assert.equal(reader.configurationEventId(id), false, `negative ${index}`);
});

test("public reader preserves adjacent large ids and max boundary in exact fixed-origin GET paths", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ ok: true, configuration })); };
  for (const id of canonicalEventIds) assert.deepEqual(await reader.readPublicTenantConfiguration(id, { fetchImpl }), configuration);
  assert.deepEqual(calls.map(call => call.url), canonicalEventIds.map(id => `https://api.example.invalid/public/passport/${id}/configuration`));
  for (const { options } of calls) {
    assert.equal(options.method, "GET"); assert.equal(options.cache, "no-store"); assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "error");
    assert.deepEqual(options.headers, { accept: "application/json" }); assert.equal(options.body, undefined);
  }
  for (const id of invalidEventIds) assert.equal(await reader.readPublicTenantConfiguration(id, { fetchImpl }), null);
  assert.equal(calls.length, canonicalEventIds.length, "invalid values perform zero upstream reads");
});

test("same-origin configuration BFF preserves bigint strings and rejects invalid ids before its reader", async () => {
  const calls = [], route = load("../src/app/api/public/passport/[eventId]/configuration/route.ts", {
    "next/server": next,
    "../../../../../../lib/public-tenant-configuration": { configurationEventId: reader.configurationEventId, readPublicTenantConfiguration: async id => { calls.push(id); return configuration; } },
  });
  for (const id of canonicalEventIds) {
    const response = await route.GET(new Request("https://web.example.invalid/api/public/passport/fixture/configuration"), { params: Promise.resolve({ eventId: id }) });
    assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /private.*no-store/); assert.deepEqual((await response.json()).configuration, configuration);
  }
  assert.deepEqual(calls, canonicalEventIds); assert(calls.every(id => typeof id === "string"));
  for (const id of invalidEventIds) {
    const response = await route.GET(new Request("https://web.example.invalid/api/public/passport/fixture/configuration"), { params: Promise.resolve({ eventId: id }) });
    assert.equal(response.status, 400);
  }
  assert.equal(calls.length, canonicalEventIds.length);
});

test("bigint cognitive context stays scoped and publication-gated without a provider call", async t => {
  let network = 0; t.mock.method(globalThis, "fetch", async () => { network++; throw Error("Unexpected network/provider request"); });
  for (const id of ["9007199254740992", "9007199254740993", "9223372036854775806", "9223372036854775807"]) {
    const allowed = cognitive(configuration), response = await allowed.post({ postTapEventId: id });
    assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.reason, "provider_requires_distributed_authorization"); assert.equal(body.fallback, true);
    assert.deepEqual(allowed.reads, [id]); assert.equal(typeof allowed.reads[0], "string");
    for (const [config, status] of [[null, 503], [{ ...configuration, status: "unpublished" }, 403], [{ ...configuration, allowedActions: [] }, 403]]) {
      const denied = cognitive(config), deniedResponse = await denied.post({ postTapEventId: id });
      assert.equal(deniedResponse.status, status); assert.equal((await deniedResponse.json()).optimizedText, undefined); assert.deepEqual(denied.reads, [id]);
    }
  }
  for (const id of invalidEventIds.filter(id => id !== undefined)) {
    const denied = cognitive(configuration), response = await denied.post({ postTapEventId: id }); assert.equal(response.status, 400); assert.deepEqual(denied.reads, []);
  }
  assert.equal(network, 0, "all transports and provider paths stay controlled");
});
