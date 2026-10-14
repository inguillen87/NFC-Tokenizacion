import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REWARD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLAIM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const source = rel => readFileSync(new URL("../src/" + rel, import.meta.url), "utf8");
const compile = value => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers });
function load(value, dependencies, environment = {}) {
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", compile(value))(
    name => { const key = name.split("/").at(-1); assert.ok(Object.hasOwn(dependencies, key), "Unexpected import " + name); return dependencies[key]; },
    module, module.exports, { env: environment });
  return module.exports;
}
const bounded = load(source("lib/bounded-request-body.ts"), {});
const origin = load(source("lib/consumer-mutation-origin.ts"), { http: { json } }, { NODE_ENV: "production", VERCEL_ENV: "production" });

function harness(options = {}) {
  const calls = { origin: 0, auth: 0, rate: 0, body: 0, schema: 0, claims: [], queries: [], readbacks: [] };
  const receipt = { id: CLAIM, consumer_id: OWNER, reward_id: REWARD, status: "claimed", points_spent: 40,
    idempotency_key: options.existingKey ?? "consumer-reward-claim:" + OWNER + ":" + REWARD };
  let inserted = false;
  const deps = {
    "node:crypto": { randomUUID: () => "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
    "consumer-auth": { getConsumerFromRequest: async () => { calls.auth++; return options.unauthorized ? null : { id: OWNER }; } },
    "consumer-mutation-origin": { enforceConsumerMutationOrigin: req => { calls.origin++; return origin.enforceConsumerMutationOrigin(req); } },
    http: { json },
    db: {
      sql: async (strings, ...values) => { calls.queries.push({ statement: strings.join("?"), values }); return [{ id: REWARD, points_cost: options.currentCost ?? 40, points_balance: 100, stock_remaining: 2 }]; },
      sqlSerializable: async () => { throw Error("Synthetic writer boundary must not execute SQL"); },
    },
    "commercial-runtime-schema": { ensureConsumerPortalSchema: async () => { calls.schema++; } },
    "critical-rate-limit": { enforceCriticalRateLimit: async () => { calls.rate++; return options.limited ? json({ ok: false, error: "rate_limited" }, 429) : null; } },
    "bounded-request-body": { ...bounded, readBoundedJsonBody: async (req, limit) => { calls.body++; assert.equal(limit, 8192); return bounded.readBoundedJsonBody(req, limit); } },
    "consumer-reward-queries": { insertConsumerRewardClaim: async (_query, input) => {
      calls.claims.push(input);
      assert.equal(_query, deps.db.sqlSerializable);
      if (options.writerError) throw Object.assign(Error("owned writer failure"), { code: options.serializationConflict ? "40001" : "XX000" });
      if (options.denied || options.existing || inserted) return [];
      inserted = true; receipt.idempotency_key = input.idempotencyKey; return [receipt];
    }, readOwnPortalRewardClaimUnderLock: async (_query, input) => {
      assert.equal(_query, deps.db.sqlSerializable); calls.readbacks.push(input);
      if (options.ambiguous) return { state: "ambiguous" };
      return options.existing || inserted || (options.existingAfterWriter && calls.claims.length > 0) ? { state: "single", claim: { ...receipt, ...options.existing } } : { state: "absent" };
    } },
  };
  const handler = load(source("app/consumer/rewards/[rewardId]/claim/route.ts"), deps).POST;
  const post = (body = { claimIntent: "portal-first-reservation.v1", expectedPointsCost: 40 }, request = {}, rewardId = REWARD) => handler(new Request("https://nexid.lat/api/consumer/rewards/" + rewardId + "/claim", {
    method: "POST", body: typeof body === "string" && request.raw ? body : JSON.stringify(body),
    headers: { origin: "https://nexid.lat", "sec-fetch-site": "same-origin", "content-type": "application/json", ...request.headers },
  }), { params: Promise.resolve({ rewardId }) });
  return { calls, post };
}
function noPersistence(calls) { assert.equal(calls.schema, 0); assert.equal(calls.claims.length, 0); assert.equal(calls.queries.length, 0); }

test("claim uses the actual exact-origin guard before authentication, body or persistence", async () => {
  for (const headers of [{ origin: "" }, { origin: "https://hostile.invalid" }, { origin: "https://evil.nexid.lat" }, { "sec-fetch-site": "cross-site" }]) {
    const h = harness(), response = await h.post({}, { headers });
    assert.equal(response.status, 403); assert.deepEqual(await response.json(), { ok: false, error: "cross_site_request_blocked" });
    assert.equal(h.calls.origin, 1); assert.equal(h.calls.auth, 0); assert.equal(h.calls.rate, 0); assert.equal(h.calls.body, 0); noPersistence(h.calls);
  }
});

test("claim authentication and rate refusal occur before body parsing or writes", async () => {
  for (const options of [{ unauthorized: true }, { limited: true }]) {
    const h = harness(options), response = await h.post();
    assert.equal(response.status, options.unauthorized ? 401 : 429); assert.equal(h.calls.body, 0); noPersistence(h.calls);
  }
});

test("malformed reward UUID refuses before body and the portal initializer", async () => {
  for (const rewardId of ["not-a-reward", "", REWARD + " ", "../../other", "cccccccc-cccc-4ccc-8ccc-ccccccccccc"]) {
    const h = harness(), response = await h.post({}, {}, rewardId);
    assert.equal(response.status, 400); assert.deepEqual(await response.json(), { ok: false, error: "invalid_reward_id" });
    assert.equal(h.calls.body, 0); noPersistence(h.calls);
  }
});

test("bounded claim body rejects primitives, arrays, null and malformed JSON before persistence", async () => {
  for (const body of [null, [], false, 0, 1, "not-an-object"]) {
    const h = harness(), response = await h.post(body);
    assert.equal(response.status, 400); assert.deepEqual(await response.json(), { ok: false, error: "invalid_body" }); noPersistence(h.calls);
  }
  const h = harness(), response = await h.post("{broken", { raw: true });
  assert.equal(response.status, 400); assert.deepEqual(await response.json(), { ok: false, error: "invalid_json" }); noPersistence(h.calls);
});

test("actual bounded reader rejects streamed and declared bodies larger than 8KiB", async () => {
  for (const request of [{}, { headers: { "content-length": "8193" } }]) {
    const h = harness(), response = await h.post({ payload: "x".repeat(8193) }, request);
    assert.equal(response.status, 413); assert.deepEqual(await response.json(), { ok: false, error: "request_body_too_large" }); noPersistence(h.calls);
  }
});

test("valid claim binds authenticated owner and validated UUID text, ignoring supplied authority and TAP", async () => {
  const h = harness(), response = await h.post({ claimIntent: "portal-first-reservation.v1", expectedPointsCost: 40, locale: "es-AR", consumerId: OTHER, tenantId: OTHER, memberId: OTHER, eventId: "forged" }, {}, REWARD.toUpperCase());
  assert.equal(response.status, 200); assert.equal((await response.json()).duplicate, false);
  assert.equal(h.calls.claims.length, 1); assert.equal(h.calls.schema, 1);
  assert.deepEqual(h.calls.claims[0], { consumerId: OWNER, rewardId: REWARD.toUpperCase(), idempotencyKey: "consumer-reward-claim:" + OWNER + ":" + REWARD.toUpperCase(), redemptionCode: "NXR-EEEEEEEE", locale: "es-AR", consumerHttpClaim: true, portalFirstClaim: { expectedPointsCost: 40 } });
});

test("repeated request with identical UUID text recovers the same receipt and key", async () => {
  const h = harness(); const first = await h.post({ claimIntent: "portal-first-reservation.v1", expectedPointsCost: 40 }, {}, REWARD.toUpperCase()); const repeated = await h.post({ claimIntent: "portal-first-reservation.v1", expectedPointsCost: 40 }, {}, REWARD.toUpperCase());
  assert.equal(first.status, 200); assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).duplicate, true); assert.equal(h.calls.claims.length, 1);
  assert.equal(h.calls.claims[0].idempotencyKey, "consumer-reward-claim:" + OWNER + ":" + REWARD.toUpperCase()); assert.equal(h.calls.readbacks.length, 2);
  for (const status of ["redeemed", "cancelled", "expired"]) {
    const existing = harness({ existing: { status } }), response = await existing.post();
    const body = await response.json(); assert.equal(body.duplicate, true); assert.equal(body.claim.status, status);
  }
});


test("a historical uppercase UUID key stays unchanged when its original request is repeated", async () => {
  const oldKey = "consumer-reward-claim:" + OWNER + ":" + REWARD.toUpperCase();
  const h = harness({ existingKey: oldKey, existing: { status: "claimed" } });
  const response = await h.post({ claimIntent: "portal-first-reservation.v1", expectedPointsCost: 40 }, {}, REWARD.toUpperCase());
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.duplicate, true);
  assert.equal(body.claim.id, CLAIM); assert.equal(body.claim.idempotency_key, oldKey);
  assert.equal(h.calls.claims.length, 0); assert.equal(h.calls.readbacks.length, 1);
  assert.deepEqual(h.calls.readbacks[0], { consumerId: OWNER, rewardId: REWARD.toUpperCase() });
});

test("writer rejection is not retried by the handler", async () => {
  const h = harness({ writerError: true }); const response = await h.post();
  assert.equal(response.status, 503); assert.equal((await response.json()).refresh_required, true);
  assert.equal(h.calls.claims.length, 1); assert.equal(h.calls.queries.length, 0);
});

test("confirmed portal cost is mandatory and validated before every initializer or write", async () => {
  for (const value of [undefined, null, "40", -1, 0.5, 2_147_483_648, {}, []]) {
    const h = harness(), response = await h.post({ claimIntent: "portal-first-reservation.v1", expectedPointsCost: value });
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "invalid_expected_points_cost");
    noPersistence(h.calls); assert.equal(h.calls.readbacks.length, 0);
  }
});
test("semantic UUID readback preserves one historical key across uppercase and lowercase requests", async () => {
  const key = "consumer-reward-claim:" + OWNER + ":" + REWARD.toUpperCase();
  const h = harness({ existingKey: key, existing: { status: "expired" } });
  const response = await h.post({ claimIntent: "portal-first-reservation.v1", expectedPointsCost: 40 }, {}, REWARD.toLowerCase()), body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.duplicate, true); assert.equal(body.claim.idempotency_key, key);
  assert.equal(body.claim.status, "expired"); assert.equal(h.calls.claims.length, 0); assert.equal(h.calls.readbacks.length, 1);
});
test("ambiguous history refuses instead of selecting or replacing a receipt", async () => {
  const h = harness({ ambiguous: true, existing: {} }), response = await h.post();
  assert.equal(response.status, 409); assert.equal((await response.json()).error, "reward_claim_history_ambiguous");
  assert.equal(h.calls.claims.length, 0); assert.equal(h.calls.readbacks.length, 1);
});
test("serialization conflict performs scoped readbacks and never retries the mutation", async () => {
  const h = harness({ writerError: true, serializationConflict: true, existingAfterWriter: true }), response = await h.post();
  assert.equal(response.status, 200); assert.equal((await response.json()).duplicate, true);
  assert.equal(h.calls.claims.length, 1); assert.equal(h.calls.readbacks.length, 2);
});

test("writer denial has one generic response without querying private reward price, stock, existence or balance", async () => {
  const expectedBody = { ok: false, error: "reward_claim_conflict", refresh_required: true };
  for (const rewardId of [REWARD, OTHER]) for (const currentCost of [0, 40, 70]) for (const expectedPointsCost of [0, 40, 70]) {
    const h = harness({ denied: true, currentCost }), response = await h.post({ claimIntent: "portal-first-reservation.v1", expectedPointsCost }, {}, rewardId);
    assert.equal(response.status, 409); assert.deepEqual(await response.json(), expectedBody);
    assert.equal(h.calls.claims.length, 1); assert.equal(h.calls.readbacks.length, 2);
    assert.deepEqual(h.calls.readbacks[0], { consumerId: OWNER, rewardId });
    assert.equal(h.calls.queries.length, 0, "No post-denial eligibility SELECT may disclose an unowned reward");
  }
});

test("legacy empty or locale-only objects preserve E1 writer mode and cannot override HTTP identity", async () => {
  for (const body of [{}, { locale: "en-US" }, { locale: "abcdefghijklmnop", expectedPointsCost: "not-new-intent", consumerHttpClaim: false, portalFirstClaim: { expectedPointsCost: 0 } }]) {
    const h = harness(), response = await h.post(body), result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.duplicate, false); assert.equal(h.calls.claims.length, 1);
    const input = h.calls.claims[0]; assert.equal(input.consumerHttpClaim, true); assert.equal(Object.hasOwn(input, "portalFirstClaim"), false);
    assert.equal(input.locale, typeof body.locale === "string" ? body.locale.slice(0, 12) : "es-AR");
    assert.equal(h.calls.readbacks.length, 1); assert.equal(h.calls.queries.length, 0);
  }
});
test("legacy body replays historical uppercase or terminal receipts before any writer", async () => {
  for (const status of ["claimed", "redeemed", "cancelled", "expired"]) for (const body of [{}, { locale: "es-AR" }]) {
    const key = "consumer-reward-claim:" + OWNER + ":" + REWARD.toUpperCase(), h = harness({ existingKey: key, existing: { status } });
    const response = await h.post(body, {}, REWARD.toLowerCase()), result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.duplicate, true); assert.equal(result.claim.idempotency_key, key);
    assert.equal(result.claim.status, status); assert.equal(h.calls.claims.length, 0); assert.equal(h.calls.queries.length, 0); assert.equal(h.calls.readbacks.length, 1);
  }
});
test("selected unsupported intent never falls back to legacy writer", async () => {
  for (const claimIntent of [null, false, 0, {}, [], "", "portal-first-reservation.v2", "portal-first-reservation.v1 "]) {
    const h = harness(), response = await h.post({ claimIntent, expectedPointsCost: 40 });
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "unsupported_claim_intent");
    noPersistence(h.calls); assert.equal(h.calls.readbacks.length, 0);
  }
});

// Real imported APIclient/BFF/handler functions, synthetic cookie/auth/rate/SQL boundaries.
// This is a local transport contract, not a real browser session or upstream delivery.
async function throughExistingTransport(payload, options = {}) {
  const h = harness(options), calls = [], priorFetch = globalThis.fetch;
  class LocalNextResponse extends Response {}
  const proxy = load(readFileSync(new URL("../../web/src/app/api/_lib/runtime-proxy.ts", import.meta.url), "utf8"), {
    server: { NextResponse: LocalNextResponse }, config: { productUrls: { api: "https://qa-api.example.invalid" } },
  });
  const bff = load(readFileSync(new URL("../../web/src/app/api/consumer/[...path]/route.ts", import.meta.url), "utf8"), { "runtime-proxy": proxy });
  const client = load(readFileSync(new URL("../../../packages/api-client/src/index.ts", import.meta.url), "utf8"), { zod: { z } }).createApiClient({ baseURL: "https://nexid.lat/api" });
  globalThis.fetch = async (url, init) => {
    const wire = String(url); assert.equal(init.method, "POST"); calls.push({ url: wire, body: init.body, headers: init.headers });
    if (wire === "https://nexid.lat/api/consumer/rewards/" + REWARD + "/claim") {
      const request = new Request(wire, { ...init, headers: { ...init.headers, cookie: "nexid_consumer=qa-synthetic", origin: "https://nexid.lat", "sec-fetch-site": "same-origin" } });
      return bff.POST(request, { params: Promise.resolve({ path: ["rewards", REWARD, "claim"] }) });
    }
    assert.equal(wire, "https://qa-api.example.invalid/consumer/rewards/" + REWARD + "/claim");
    assert.equal(init.headers.cookie, "nexid_consumer=qa-synthetic"); assert.equal(init.headers.origin, "https://nexid.lat");
    assert.equal(init.headers["sec-fetch-site"], "same-origin");
    return h.post(init.body, { raw: true, headers: init.headers });
  };
  try { const result = await client.postJson("/consumer/rewards/" + REWARD + "/claim", payload); return { result, calls, handler: h.calls }; }
  finally { globalThis.fetch = priorFetch; assert.equal(calls.length, 2, "One client POST and one BFF upstream POST, without retry"); }
}
test("existing APIclient and consumer BFF carry both legacy and advertised intent payloads exactly", async () => {
  const model = load(source("lib/consumer-rewards-read-model.ts"), { db: { sql: async () => { throw Error("No SQL at the synthetic read projection boundary"); } } });
  const advertised = model.toConsumerRewardItem({ id: REWARD, reward_status: "active", program_status: "active", membership_status: "active", program_member_count: 1, program_member_active: true, program_identity_matches: true, program_points_balance: 100, points_cost: 40, stock_remaining: 2, portal_claim_eligible: true });
  assert.equal(advertised.can_claim, true); assert.equal(advertised.claimIntent, "portal-first-reservation.v1");
  for (const payload of [{}, { locale: "es-AR" }, { claimIntent: advertised.claimIntent, expectedPointsCost: advertised.points_cost, locale: "en-US" }]) {
    const r = await throughExistingTransport(payload); assert.equal(r.result.ok, true); assert.equal(r.calls.length, 2);
    assert.equal(r.calls.filter(x => x.url.startsWith("https://nexid.lat/")).length, 1); assert.equal(r.calls.filter(x => x.url.startsWith("https://qa-api.")).length, 1);
    assert.ok(r.calls.every(x => x.body === JSON.stringify(payload))); assert.equal(r.handler.claims.length, 1);
    assert.equal(Object.hasOwn(r.handler.claims[0], "portalFirstClaim"), Object.hasOwn(payload, "claimIntent"));
  }
});
test("existing transport does not retry a rejected new-intent mutation", async () => {
  await assert.rejects(throughExistingTransport({ claimIntent: "portal-first-reservation.v1", expectedPointsCost: 40 }, { writerError: true }), /reward_claim_unavailable/);
});
