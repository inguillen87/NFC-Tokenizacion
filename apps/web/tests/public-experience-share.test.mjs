import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import * as crypto from "node:crypto";
import ts from "typescript";

const key = "synthetic-web-experience-signing-key-20261004-only";
const bid = "BID-WEB-EXPERIENCE", eventId = "900001";
const loadSource = path => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
function compile(source, dependencies = {}, env = {}, fetchImpl = () => { throw new Error("Real network forbidden"); }) {
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "fetch", js)(name => {
    if (name === "node:crypto") return crypto;
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports, { env }, fetchImpl);
  return module.exports;
}
async function harness(env = {}) {
  const signer = compile(await loadSource("lib/public-experience-share.ts"), {}, env);
  const demoSigner = compile(await loadSource("lib/demo-share.ts"), {}, env);
  const guard = compile(await loadSource("lib/public-api-guard.ts"), {}, env);
  class NextResponse extends Response { static json(body, options = {}) { return new NextResponse(JSON.stringify(body), { ...options, headers: { "content-type": "application/json", ...options.headers } }); } }
  const requests = [];
  const api = compile(await loadSource("app/api/public-cta/[action]/route.ts"), {
    "next/server": { NextResponse }, "@product/config": { productUrls: { api: "https://api.fixture.invalid" } },
    "../../_lib/consumer-tap-handoff": { stripConsumerTapCapabilityCookies: () => "" },
    "../../../../lib/demo-share": demoSigner,
    "../../../../lib/public-experience-share": signer,
    "../../../../lib/public-api-guard": guard,
  }, env, async (url, options) => { requests.push({ url: new URL(url), options }); return new Response(JSON.stringify({ ok: true, fixture: true }), { status: 201, headers: { "content-type": "application/json" } }); });
  return { api, signer, requests };
}
function request(action = "experience-event", body = {}, origin = "https://fixture.invalid") {
  return new Request(`https://fixture.invalid/api/public-cta/${action}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ bid, event_id: eventId, fresh_token: "synthetic-independent-fresh-capability", event_type: "PRODUCT_VIEWED", ...body }) });
}
const params = action => ({ params: Promise.resolve({ action }) });

test("experience signer emits exact dedicated audience/purpose and domain signature", async () => {
  const { signer } = await harness({ PUBLIC_EXPERIENCE_SHARE_SECRET: key });
  const exp = Math.floor(Date.now() / 1000) + 60;
  const token = signer.createPublicExperienceShareToken({ bid, uid: `EVENT-${eventId}`, exp });
  const [body, signature] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(body, "base64url").toString("utf8")), { aud: "nexid:experience-event:v1", purpose: "public_experience_event_share", bid, uid: `EVENT-${eventId}`, exp });
  assert.equal(signature, crypto.createHmac("sha256", key).update(`nexid:experience-event:v1\0${body}`).digest("base64url"));
  assert.notEqual(signature, crypto.createHmac("sha256", key).update(body).digest("base64url"));
});

test("experience signer requires its own strong key and never borrows general/fresh key", async () => {
  for (const env of [{}, { PUBLIC_DEMO_SHARE_SECRET: key, SUN_HANDOFF_SECRET: key }, { PUBLIC_EXPERIENCE_SHARE_SECRET: "short" }]) {
    const { api, signer, requests } = await harness(env);
    assert.equal(signer.createPublicExperienceShareToken({ bid, uid: `EVENT-${eventId}`, exp: Math.floor(Date.now() / 1000) + 60 }), "");
    const response = await api.POST(request(), params("experience-event"));
    assert.equal(response.status, 503); assert.equal((await response.json()).reason, "share_token_unavailable"); assert.equal(requests.length, 0);
  }
});

test("BFF signs only activity with dedicated key and preserves independent fresh/client contract", async () => {
  const { api, requests } = await harness({ PUBLIC_EXPERIENCE_SHARE_SECRET: key });
  const response = await api.POST(request(), params("experience-event"));
  assert.equal(response.status, 201); assert.equal(requests.length, 1);
  const forwarded = requests[0], token = forwarded.url.searchParams.get("share");
  assert.equal(forwarded.url.pathname, "/public/cta/experience-event");
  const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
  assert.equal(payload.aud, "nexid:experience-event:v1"); assert.equal(payload.purpose, "public_experience_event_share"); assert.equal(payload.uid, `EVENT-${eventId}`);
  const outbound = JSON.parse(forwarded.options.body);
  assert.equal(outbound.fresh_token, "synthetic-independent-fresh-capability"); assert.equal(outbound.event_id, eventId); assert.equal(outbound.bid, bid);
  assert.equal(forwarded.options.method, "POST"); assert.equal(forwarded.options.cache, "no-store");
});

test("enabling only activity key cannot activate claim/warranty/tokenize/receipt/provenance", async () => {
  const { api, requests } = await harness({ PUBLIC_EXPERIENCE_SHARE_SECRET: key });
  for (const action of ["claim-ownership", "register-warranty", "tokenize-request", "receipt-ocr", "provenance"]) {
    assert.equal((await api.POST(request(action), params(action))).status, 503);
  }
  assert.equal((await api.POST(request("report-problem"), params("report-problem"))).status, 403);
  assert.equal(requests.length, 0);
});

test("activity BFF still rejects absent fresh, foreign origin and invalid JSON before forwarding", async () => {
  const { api, requests } = await harness({ PUBLIC_EXPERIENCE_SHARE_SECRET: key });
  assert.equal((await api.POST(request("experience-event", { fresh_token: "" }), params("experience-event"))).status, 403);
  assert.equal((await api.POST(request("experience-event", {}, "https://other.fixture.invalid"), params("experience-event"))).status, 403);
  const malformed = new Request("https://fixture.invalid/api/public-cta/experience-event", { method: "POST", headers: { origin: "https://fixture.invalid", "content-type": "application/json" }, body: "{invalid" });
  assert.equal((await api.POST(malformed, params("experience-event"))).status, 400);
  assert.equal(requests.length, 0);
});
