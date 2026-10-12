import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REWARD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLAIM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NOW = Date.parse("2026-10-12T03:00:00.000Z");
const DENIED = { ok: false, error: "claim_not_found_or_invalid_state" };
const routeSource = readFileSync(new URL("../src/app/consumer/rewards/[rewardId]/redeem/route.ts", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("../src/lib/consumer-rewards-read-model.ts", import.meta.url), "utf8");
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const params = { params: Promise.resolve({ rewardId: REWARD }) };

function harness(options = {}) {
  const calls = { auth: 0, rate: 0, body: 0, schema: 0, reads: 0, updateStatements: 0, mutations: 0, queries: [] };
  let clock = NOW;
  const row = { id: CLAIM, reward_id: REWARD, consumer_id: OWNER, status: "claimed",
    created_at: "2026-10-12T02:00:00.000Z", claimed_at_text: "2026-10-12 02:00:00+00", expires_at_value: "2026-10-12T04:00:00Z", ...options.row };
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return NOW; }
  }
  const json = (body, status = 200) => Response.json(body, { status });
  const sql = async (strings, ...values) => {
    const statement = strings.join("?").replace(/\s+/g, " ").trim();
    calls.queries.push({ statement, values });
    const ownClaim = () => row.id === values[0] && row.reward_id === values[1] && row.consumer_id === values[2] && row.status === "claimed";
    if (statement.startsWith("SELECT id, created_at,")) {
      calls.reads++;
      return ownClaim() ? [{ id: row.id, created_at: row.created_at, claimed_at_text: row.claimed_at_text, expires_at_value: row.expires_at_value }] : [];
    }
    assert.match(statement, /^WITH locked AS MATERIALIZED /);
    calls.updateStatements++;
    options.afterLock?.(row, value => { clock = value; });
    if (!ownClaim() || Date.parse(values[3]) <= clock || values[4] !== row.claimed_at_text
      || values[5] !== JSON.stringify(row.expires_at_value ?? null)) return [];
    row.status = "redeemed"; calls.mutations++;
    return [{ id: row.id, reward_id: row.reward_id, consumer_id: row.consumer_id, status: row.status }];
  };
  const model = { exports: {} };
  new Function("require", "module", "exports", "Date", compile(modelSource))(
    name => { assert.equal(name, "./db"); return { sql }; }, model, model.exports, FixtureDate);
  const deps = {
    "consumer-auth": { getConsumerFromRequest: async () => { calls.auth++; return options.unauthorized ? null : { id: OWNER }; } },
    "http": { json }, "db": { sql },
    "commercial-runtime-schema": { ensureConsumerPortalSchema: async () => { calls.schema++; } },
    "critical-rate-limit": { enforceCriticalRateLimit: async () => { calls.rate++; return options.limited ? json({ ok: false, error: "rate_limited" }, 429) : null; } },
    "bounded-request-body": { RequestBodyTooLargeError: class extends Error {},
      readBoundedJsonBody: async (req, cap) => { calls.body++; assert.equal(cap, 8192); return req.json(); } },
    "consumer-rewards-read-model": model.exports,
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "Date", compile(routeSource))(
    name => { const key = name.split("/").at(-1); assert(Object.hasOwn(deps, key)); return deps[key]; },
    module, module.exports, FixtureDate);
  const post = (body = { redemptionId: CLAIM }) => module.exports.POST(new Request("https://fixture.invalid/consumer/rewards/" + REWARD + "/redeem", { method: "POST", body: JSON.stringify(body) }), params);
  return { post, calls, row };
}

test("consumer redeem preserves authentication and rate refusal before body or persistence", async () => {
  for (const options of [{ unauthorized: true }, { limited: true }]) {
    const h = harness(options), response = await h.post();
    assert.equal(response.status, options.unauthorized ? 401 : 429);
    assert.equal(h.calls.body, 0); assert.equal(h.calls.schema, 0); assert.equal(h.calls.queries.length, 0);
  }
});

test("an own unexpired claim redeems once without trusting client expiry or owner", async () => {
  const h = harness(), response = await h.post({ redemptionId: CLAIM, consumerId: OTHER, expires_at: "2099-01-01T00:00:00Z" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, claim: { id: CLAIM, reward_id: REWARD, consumer_id: OWNER, status: "redeemed" } });
  assert.equal(h.calls.mutations, 1);
  for (const q of h.calls.queries) assert.deepEqual(q.values.slice(0, 3), [CLAIM, REWARD, OWNER]);
  assert.equal(h.calls.queries[1].values[3], "2026-10-12T04:00:00.000Z");
});

test("past and exact-boundary explicit expiry refuse before any update", async () => {
  for (const expires_at_value of [new Date(NOW - 1).toISOString(), new Date(NOW).toISOString()]) {
    const h = harness({ row: { expires_at_value } }), response = await h.post();
    assert.equal(response.status, 404); assert.deepEqual(await response.json(), DENIED);
    assert.equal(h.calls.updateStatements, 0); assert.equal(h.calls.mutations, 0); assert.equal(h.row.status, "claimed");
  }
});

test("missing or null expiry uses the existing 48-hour rule, never an invalid-value fallback", async () => {
  for (const expires_at_value of [undefined, null]) {
    const expired = harness({ row: { expires_at_value, created_at: new Date(NOW - 48 * 3600000).toISOString(), claimed_at_text: new Date(NOW - 48 * 3600000).toISOString() } });
    assert.equal((await expired.post()).status, 404); assert.equal(expired.calls.mutations, 0);
    const active = harness({ row: { expires_at_value } });
    assert.equal((await active.post()).status, 200);
    assert.equal(active.calls.queries[1].values[3], "2026-10-14T02:00:00.000Z");
  }
});

test("invalid explicit metadata locks the claim without trying SQL timestamp casts", async () => {
  for (const expires_at_value of ["", "not a date", "now", "infinity", "2026-02-30T12:00:00Z", "2026-10-12", [], {}, false, 0]) {
    const h = harness({ row: { expires_at_value } });
    assert.equal((await h.post()).status, 404); assert.equal(h.calls.updateStatements, 0);
    assert.equal(h.calls.mutations, 0); assert.equal(h.row.status, "claimed");
  }
});

test("foreign claim, reward or consumer and terminal status cannot mutate", async () => {
  for (const row of [{ id: OTHER }, { reward_id: OTHER }, { consumer_id: OTHER }, { status: "redeemed" }, { status: "cancelled" }, { status: "expired" }]) {
    const h = harness({ row }); assert.equal((await h.post()).status, 404);
    assert.equal(h.calls.updateStatements, 0); assert.equal(h.calls.mutations, 0);
  }
});

test("a duplicate request cannot create another redemption or mutate a terminal claim", async () => {
  const h = harness(); assert.equal((await h.post()).status, 200); assert.equal((await h.post()).status, 404);
  assert.equal(h.calls.mutations, 1); assert.equal(h.calls.updateStatements, 1); assert.equal(h.row.status, "redeemed");
});

test("expiry reached while waiting for the lock is refused by the wall-clock gate", async () => {
  const h = harness({ row: { expires_at_value: new Date(NOW + 1).toISOString() }, afterLock: (_row, setClock) => setClock(NOW + 1) });
  assert.equal((await h.post()).status, 404); assert.equal(h.calls.updateStatements, 1);
  assert.equal(h.calls.mutations, 0); assert.equal(h.row.status, "claimed");
});

test("a concurrent expiry, creation date, owner or status change cannot use the earlier read", async () => {
  for (const change of [{ expires_at_value: new Date(NOW - 1).toISOString() }, { claimed_at_text: "2026-10-11 02:00:00+00" }, { consumer_id: OTHER }, { status: "cancelled" }]) {
    const h = harness({ afterLock: row => Object.assign(row, change) });
    assert.equal((await h.post()).status, 404); assert.equal(h.calls.mutations, 0);
  }
});

test("the actual writer locks scoped claims before strict wall-clock and snapshot checks", () => {
  assert.match(routeSource, /import \{ consumerRewardClaimExpiresAt \} from/);
  assert.match(routeSource, /WITH locked AS MATERIALIZED[\s\S]*?consumer_id = \$\{consumer\.id\}[\s\S]*?status = 'claimed'[\s\S]*?FOR UPDATE[\s\S]*?eligible AS MATERIALIZED/);
  assert.match(routeSource, /\$\{expiresAt\}::timestamptz > clock_timestamp\(\)/);
  assert.match(routeSource, /claimed_at_text = \$\{claim\.claimed_at_text\}/);
  assert.match(routeSource, /COALESCE\(expires_at_value, 'null'::jsonb\) = \$\{JSON\.stringify\(claim\.expires_at_value \?\? null\)\}::jsonb/);
  assert.match(routeSource, /FROM eligible[\s\S]*RETURNING consumer_reward_claims\.\*/);
  assert.doesNotMatch(routeSource, /expires_at_value::timestamptz|SET status = 'expired'|UPDATE (?:loyalty_members|rewards)|sqlSerializable/);
});
