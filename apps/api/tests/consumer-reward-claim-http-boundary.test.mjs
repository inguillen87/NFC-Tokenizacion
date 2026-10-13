import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

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
  const calls = { origin: 0, auth: 0, rate: 0, body: 0, schema: 0, claims: [], queries: [] };
  const receipt = { id: CLAIM, consumer_id: OWNER, reward_id: REWARD, status: "claimed", points_spent: 40,
    idempotency_key: options.existingKey ?? "consumer-reward-claim:" + OWNER + ":" + REWARD };
  let inserted = false;
  const deps = {
    "node:crypto": { randomUUID: () => "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
    "consumer-auth": { getConsumerFromRequest: async () => { calls.auth++; return options.unauthorized ? null : { id: OWNER }; } },
    "consumer-mutation-origin": { enforceConsumerMutationOrigin: req => { calls.origin++; return origin.enforceConsumerMutationOrigin(req); } },
    http: { json },
    db: { sql: async (strings, ...values) => {
      const statement = strings.join("?").replace(/\s+/g, " ").trim(); calls.queries.push({ statement, values });
      assert.match(statement, /^SELECT \* FROM consumer_reward_claims WHERE idempotency_key = \? AND consumer_id = \? AND reward_id = \? LIMIT 1$/);
      const requestedRewardId = calls.claims.at(-1).rewardId;
      assert.deepEqual(values, ["consumer-reward-claim:" + OWNER + ":" + requestedRewardId, OWNER, requestedRewardId]);
      return [{ ...receipt, ...options.existing }];
    } },
    "commercial-runtime-schema": { ensureConsumerPortalSchema: async () => { calls.schema++; } },
    "critical-rate-limit": { enforceCriticalRateLimit: async () => { calls.rate++; return options.limited ? json({ ok: false, error: "rate_limited" }, 429) : null; } },
    "bounded-request-body": { ...bounded, readBoundedJsonBody: async (req, limit) => { calls.body++; assert.equal(limit, 8192); return bounded.readBoundedJsonBody(req, limit); } },
    "consumer-reward-queries": { insertConsumerRewardClaim: async (_query, input) => {
      calls.claims.push(input);
      if (options.writerError) throw Error("owned writer failure");
      if (options.existingKey) assert.equal(input.idempotencyKey, options.existingKey, "Do not change the stored historical request key");
      if (options.existing || inserted) return [];
      inserted = true; receipt.idempotency_key = input.idempotencyKey; return [receipt];
    } },
  };
  const handler = load(source("app/consumer/rewards/[rewardId]/claim/route.ts"), deps).POST;
  const post = (body = {}, request = {}, rewardId = REWARD) => handler(new Request("https://nexid.lat/api/consumer/rewards/" + rewardId + "/claim", {
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
  const h = harness(), response = await h.post({ locale: "es-AR", consumerId: OTHER, tenantId: OTHER, memberId: OTHER, eventId: "forged" }, {}, REWARD.toUpperCase());
  assert.equal(response.status, 200); assert.equal((await response.json()).duplicate, false);
  assert.equal(h.calls.claims.length, 1); assert.equal(h.calls.schema, 1);
  assert.deepEqual(h.calls.claims[0], { consumerId: OWNER, rewardId: REWARD.toUpperCase(), idempotencyKey: "consumer-reward-claim:" + OWNER + ":" + REWARD.toUpperCase(), redemptionCode: "NXR-EEEEEEEE", locale: "es-AR" });
});

test("repeated request with identical UUID text recovers the same receipt and key", async () => {
  const h = harness(); const first = await h.post({}, {}, REWARD.toUpperCase()); const repeated = await h.post({}, {}, REWARD.toUpperCase());
  assert.equal(first.status, 200); assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).duplicate, true); assert.equal(h.calls.claims.length, 2);
  assert.equal(h.calls.claims[0].idempotencyKey, h.calls.claims[1].idempotencyKey); assert.equal(h.calls.queries.length, 1);
  for (const status of ["redeemed", "cancelled", "expired"]) {
    const existing = harness({ existing: { status } }), response = await existing.post();
    const body = await response.json(); assert.equal(body.duplicate, true); assert.equal(body.claim.status, status);
  }
});


test("a historical uppercase UUID key stays unchanged when its original request is repeated", async () => {
  const oldKey = "consumer-reward-claim:" + OWNER + ":" + REWARD.toUpperCase();
  const h = harness({ existingKey: oldKey, existing: { status: "claimed" } });
  const response = await h.post({}, {}, REWARD.toUpperCase());
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.duplicate, true);
  assert.equal(body.claim.id, CLAIM); assert.equal(body.claim.idempotency_key, oldKey);
  assert.equal(h.calls.claims.length, 1); assert.equal(h.calls.claims[0].idempotencyKey, oldKey);
  assert.equal(h.calls.claims[0].rewardId, REWARD.toUpperCase()); assert.equal(h.calls.queries.length, 1);
});

test("writer rejection is not retried by the handler", async () => {
  const h = harness({ writerError: true }); await assert.rejects(() => h.post(), /owned writer failure/);
  assert.equal(h.calls.claims.length, 1); assert.equal(h.calls.queries.length, 0);
});
