import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as receipts from "../src/app/api/_lib/consumer-reward-receipt.ts";
import * as tapHandoff from "../src/app/api/_lib/consumer-tap-handoff.ts";
import * as walletPoints from "../src/app/me/_components/consumer-wallet-points-model.ts";

const api = "https://api.fixture.invalid";
const web = "https://web.fixture.invalid";
const rewardId = "a83e19ae-2cc0-4440-a1ab-258f4e81c654";
const claimId = "f9ba0390-3809-41e3-b706-4f4c99ca0e7f";
const cookieName = receipts.CONSUMER_REWARD_RECEIPT_COOKIE;
const relayPath = "/consumer/rewards/" + rewardId + "/claim";

function load(path, modules) {
  const source = readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { fileName: path, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(Object.hasOwn(modules, name), "Unexpected dependency: " + name);
    return modules[name];
  }, module, module.exports);
  return module.exports;
}

const model = load("app/me/_components/consumer-rewards-model.ts", { "./consumer-wallet-points-model": walletPoints });
const intent = model.CONSUMER_REWARD_RESERVATION_INTENT;
const submission = { claimIntent: intent, expectedPointsCost: 40, locale: "es-AR" };
const acknowledged = { ok: true, duplicate: false, claim: { id: claimId, reward_id: rewardId, redemption_code: "SYNTHETIC-VOUCHER" } };

function fixture(makeResponse) {
  const calls = [];
  const { proxyToApi } = load("app/api/_lib/runtime-proxy.ts", {
    "next/server": { NextResponse: Response },
    "@product/config": { productUrls: { api } },
    "./consumer-tap-handoff": tapHandoff,
    "./server-api-transport": { fetchRuntimeApi: async (url, init) => {
      calls.push({ url, init });
      return makeResponse();
    } },
  });
  const route = load("app/api/consumer/rewards/[rewardId]/claim/route.ts", {
    "../../../../../me/_components/consumer-rewards-model": model,
    "../../../../_lib/consumer-reward-receipt": receipts,
    "../../../../_lib/runtime-proxy": { proxyToApi },
  });
  return { route, calls };
}

function request({ origin = web, method = "POST", body = JSON.stringify(submission), host = new URL(origin).host } = {}) {
  return new Request(origin + "/api" + relayPath, { method,
    headers: { host, origin, "sec-fetch-site": "same-origin", "content-type": "application/json",
      "x-correlation-id": "fixture-correlation", cookie: "consumer_session=synthetic; __Host-nexid_tap_715=discard" },
    ...(method !== "GET" ? { body } : {}),
  });
}

function context(id = rewardId) { return { params: Promise.resolve({ rewardId: id }) }; }
function selectorCookies(response) { return response.headers.getSetCookie().filter(cookie => cookie.startsWith(cookieName + "=")); }

test("the exact portal ACK appends one private selector and preserves the existing relay", async () => {
  const payload = JSON.stringify({ ...acknowledged, duplicate: true, claim: { ...acknowledged.claim, id: claimId.toUpperCase() } }, null, 2);
  const upstreamCookies = ["session_aux=one; Domain=fixture.invalid; Path=/; Secure", "flow_aux=two; Path=/"];
  const f = fixture(() => {
    const response = new Response(payload, { status: 200, headers: { "content-type": "application/json" } });
    for (const cookie of upstreamCookies) response.headers.append("set-cookie", cookie);
    return response;
  });
  const raw = JSON.stringify(submission, null, 2);
  const response = await f.route.POST(request({ body: raw }), context());
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0], { url: api + relayPath, init: { method: "POST", body: raw, cache: "no-store", headers: {
    "content-type": "application/json", "x-correlation-id": "fixture-correlation",
    cookie: "consumer_session=synthetic", origin: web, "sec-fetch-site": "same-origin",
  } } });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), payload);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-correlation-id"), "fixture-correlation");
  assert.deepEqual(response.headers.getSetCookie(), [
    "session_aux=one; Path=/; Secure", "flow_aux=two; Path=/",
    cookieName + "=" + claimId + "; Path=/me/rewards; Max-Age=7200; HttpOnly; SameSite=Lax; Secure",
  ]);
});

test("errors and inexact or oversized receipts keep the relay body and never write a selector", async () => {
  const cases = [
    ...[401, 403, 409, 503].map(status => ({ status, response: JSON.stringify(acknowledged) })),
    { response: "{not-json" },
    { response: JSON.stringify({ ...acknowledged, duplicate: undefined }) },
    { response: JSON.stringify({ ...acknowledged, claim: { ...acknowledged.claim, reward_id: claimId } }) },
    { response: JSON.stringify({ ...acknowledged, claim: { ...acknowledged.claim, id: "bad-claim" } }) },
    { response: JSON.stringify({ ...acknowledged, claim: { ...acknowledged.claim, id: claimId + "\n" } }) },
    { response: JSON.stringify({ ...acknowledged, padding: "x".repeat(64 * 1024) }) },
    { body: JSON.stringify({ locale: "es-AR" }) },
    { body: JSON.stringify({ ...submission, expectedPointsCost: -1 }) },
    { body: JSON.stringify({ ...submission, padding: "x".repeat(8 * 1024) }) },
    { body: "{not-json" },
  ];
  for (const { status = 200, response = JSON.stringify(acknowledged), body } of cases) {
    const f = fixture(() => new Response(response, { status }));
    const result = await f.route.POST(request({ body }), context());
    assert.equal(f.calls.length, 1);
    assert.equal(result.status, status);
    assert.equal(await result.text(), response);
    assert.deepEqual(selectorCookies(result), []);
  }
});

test("only explicit local HTTP omits Secure and non-POST relays never attach receipts", async () => {
  const f = fixture(() => Response.json(acknowledged));
  const local = await f.route.POST(request({ origin: "http://127.0.0.1:3337" }), context());
  assert.equal(selectorCookies(local).length, 1);
  assert.doesNotMatch(selectorCookies(local)[0], /; Secure/);
  const publicHttp = await f.route.POST(request({ origin: "http://web.fixture.invalid", host: "localhost" }), context());
  assert.match(selectorCookies(publicHttp)[0], /; Secure$/);
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const result = await f.route[method](request({ method }), context());
    assert.deepEqual(selectorCookies(result), []);
    assert.equal(f.calls.at(-1).init.method, method);
  }
  assert.equal(receipts.parseConsumerRewardReceipt(claimId.toUpperCase()), claimId);
  assert.equal(receipts.parseConsumerRewardReceipt(" " + claimId), null);
  assert.equal(receipts.parseConsumerRewardReceipt(claimId + "\n"), null);
});
