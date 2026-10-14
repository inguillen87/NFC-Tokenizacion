import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const CONSUMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = Date.parse("2026-09-08T12:00:00.000Z");
const CREATED = "2026-09-08T10:00:00.000Z";
const PRIVATE = "private-consumer-email-and-database-error";
const files = {
  model: "../src/lib/consumer-rewards-read-model.ts",
  route: "../src/app/consumer/rewards/route.ts",
};
const compiled = Object.fromEntries(Object.entries(files).map(([key, file]) => [key,
  ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText,
]));

function reward(overrides = {}) {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Visita a la bodega", description: "Visita guiada",
    tenant_slug: "bodega-prueba", tenant_name: "Bodega Prueba", program_name: "Club Bodega",
    reward_status: "active", program_status: "active", membership_status: "active",
    starts_at: "2026-09-01T00:00:00.000Z", ends_at: null,
    program_starts_at: "2026-09-01T00:00:00.000Z", program_ends_at: null,
    points_cost: 50, stock_remaining: 5, program_member_count: 1,
    program_points_balance: 80, program_member_active: true, program_identity_matches: true,
    claim_id: null, claim_status: null, claimed_at: null,
    redemption_code: null, claim_expires_at_value: null,
    ...overrides,
  };
}

function claim(overrides = {}) {
  return reward({
    claim_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", claim_status: "claimed", claimed_at: CREATED,
    redemption_code: "NEXID-OWN-ISSUED-CODE", points_spent: 20, ...overrides,
  });
}

function harness(options = {}) {
  const events = [];
  const queries = [];
  const loaded = {};
  const executor = async (strings, ...values) => {
    events.push("read");
    queries.push({ statement: strings.join("?"), values });
    if (options.queryError) throw options.queryError;
    return options.rows || [];
  };
  const require = (name) => {
    if (name.endsWith("/db")) return { sql: executor };
    if (name.endsWith("/consumer-rewards-read-model")) return loaded.model;
    if (name.endsWith("/consumer-auth")) return { getConsumerFromRequest: async () => {
      events.push("authenticate");
      if (options.authError) throw options.authError;
      return options.unauthenticated ? null : { id: options.consumerId ?? CONSUMER };
    } };
    if (name.endsWith("/http")) return { json: (body, status = 200, headers = {}) => Response.json(body, { status, headers }) };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  for (const [name, code] of Object.entries(compiled)) {
    const module = { exports: {} };
    new Function("require", "module", "exports", code)(require, module, module.exports);
    loaded[name] = module.exports;
  }
  return { ...loaded, queries, events, get: () => loaded.route.GET(new Request("https://api.nexid.test/consumer/rewards")) };
}

async function response(h, status) {
  const result = await h.get();
  assert.equal(result.status, status);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  const body = await result.json();
  assert.equal(JSON.stringify(body).includes(PRIVATE), false);
  return body;
}

test("authentication precedes all reward reads; unauthorized and unavailable responses are private", async () => {
  const denied = harness({ unauthenticated: true });
  assert.deepEqual(await response(denied, 401), { ok: false, error: "unauthorized" });
  assert.deepEqual(denied.events, ["authenticate"]);
  for (const options of [{ authError: new Error(PRIVATE) }, { queryError: new Error(PRIVATE) }, { consumerId: "invalid" }]) {
    const h = harness(options);
    assert.deepEqual(await response(h, 503), { ok: false, error: "unavailable" });
    if (!options.queryError) assert.equal(h.queries.length, 0);
  }
});

test("the production SQL binds owner and tenant on claims, memberships and program balances", async () => {
  const h = harness();
  assert.deepEqual(await response(h, 200), { ok: true, items: [], scope: "own_brands", limit: 100 });
  assert.deepEqual(h.events, ["authenticate", "read"]);
  assert.equal(h.queries.length, 1);
  const { statement, values } = h.queries[0];
  const sql = statement.replace(/\s+/g, " ").trim();
  assert.match(sql, /^SELECT /);
  assert.match(sql, /membership\.tenant_id = reward\.tenant_id AND membership\.consumer_id = \?::uuid/);
  assert.match(sql, /claim\.reward_id = reward\.id AND claim\.tenant_id = reward\.tenant_id AND claim\.consumer_id = \?::uuid/);
  assert.match(sql, /program\.id = reward\.program_id AND program\.tenant_id = reward\.tenant_id/);
  assert.match(sql, /lm\.tenant_id = reward\.tenant_id AND lm\.program_id = reward\.program_id AND lm\.consumer_id = \?::uuid/);
  assert.match(sql, /WHERE claim\.id IS NOT NULL OR \(membership\.status IN \('active', 'paused'\) AND reward\.status = 'active'\)/);
  assert.match(sql, /ORDER BY \(claim\.id IS NOT NULL\) DESC, COALESCE\(claim\.created_at, reward\.created_at\) DESC, reward\.id DESC, claim\.id DESC LIMIT \?$/);
  assert.deepEqual(values, [CONSUMER, CONSUMER, CONSUMER, CONSUMER, CONSUMER, 100]);
  assert.doesNotMatch(sql, /\b(?:CREATE|ALTER|INSERT|UPDATE|DELETE)\b|::timestamptz|membership\.points_balance|network_visible|SELECT [a-z]+\.\*/i);
  assert.match(sql, /claim\.metadata_json->'expires_at' AS claim_expires_at_value/);
  assert.match(sql, /bool_and\(lm\.status IN \('enrolled', 'verified'\)\) AS active/);
  assert.match(sql, /claim\.points_spent/);
});

test("catalog reports conditions instead of claiming eligibility, even with enough or zero-cost points", () => {
  const { toConsumerRewardItem: item } = harness().model;
  for (const input of [reward(), reward({ points_cost: 0, program_points_balance: 0 })]) {
    const result = item(input, NOW);
    assert.equal(result.state, "reported");
    assert.equal(result.can_claim, false);
    assert.equal(result.claim_unavailable_reason, "review_required");
    assert.equal(result.redemption_code, null);
  }
  for (const overrides of [
    { program_points_balance: 49, membership_points_balance: 100000 },
    { points_cost: 0, program_member_count: 0, program_points_balance: null },
    { program_member_count: 2 }, { program_member_active: false }, { membership_status: "paused" },
    { program_points_balance: null }, { points_cost: "invalid" }, { points_cost: -1 },
  ]) assert.equal(item(reward(overrides), NOW).state, "locked");
});

test("catalog preserves real time windows, stock and inactive states", () => {
  const { toConsumerRewardItem: item } = harness().model;
  const later = "2026-09-09T00:00:00.000Z";
  const earlier = "2026-09-07T00:00:00.000Z";
  for (const [overrides, expected] of [
    [{ reward_status: "paused" }, "inactive"], [{ program_status: "draft" }, "inactive"],
    [{ starts_at: later }, "upcoming"], [{ program_starts_at: later }, "upcoming"],
    [{ ends_at: earlier }, "expired"], [{ program_ends_at: earlier }, "expired"],
    [{ stock_remaining: 0 }, "out_of_stock"], [{ stock_remaining: -1 }, "out_of_stock"],
  ]) assert.equal(item(reward(overrides), NOW).state, expected);
});

test("claim expiration follows staff's explicit expiry or created-at plus 48 hours without parsing arbitrary metadata", () => {
  const { consumerRewardClaimExpiresAt: expires, toConsumerRewardItem: item } = harness().model;
  assert.equal(expires(null, CREATED), "2026-09-10T10:00:00.000Z");
  assert.equal(expires(undefined, new Date(CREATED)), "2026-09-10T10:00:00.000Z");
  assert.equal(expires("2026-09-09T09:00:00-03:00", CREATED), "2026-09-09T12:00:00.000Z");
  assert.equal(expires("2028-02-29T12:00:00Z", CREATED), "2028-02-29T12:00:00.000Z");
  for (const invalid of ["", "not a date", "now", "infinity", "2026-02-30T12:00:00Z", "2026-02-29T12:00:00Z", "2026-09-09", "2026-09-09T12:00:00", "2026-09-09T24:00:00Z", [], {}, 0, true]) {
    assert.equal(expires(invalid, CREATED), null);
    const result = item(claim({ claim_expires_at_value: invalid }), NOW);
    assert.equal(result.state, "locked");
    assert.equal(result.claim_expires_at, null);
    assert.equal(result.redemption_code, null);
  }
  assert.equal(expires(null, "invalid"), null);
});

test("terminal claim states take priority over catalog and never display usable redemption codes", () => {
  const { toConsumerRewardItem: item } = harness().model;
  for (const status of ["redeemed", "cancelled", "expired"]) {
    const result = item(claim({ claim_status: status, reward_status: "inactive", claim_expires_at_value: "2026-09-01T00:00:00Z" }), NOW);
    assert.equal(result.state, status);
    assert.equal(result.claim_status, status);
    assert.equal(result.catalog_state, "inactive");
    assert.equal(result.redemption_code, null);
  }
  const expired = item(claim({ claimed_at: "2026-09-01T10:00:00Z" }), NOW);
  assert.equal(expired.state, "expired");
  assert.equal(expired.claim_status, "expired");
  assert.equal(expired.redemption_code, null);
  const issued = item(claim({ reward_status: "inactive" }), NOW);
  assert.equal(issued.state, "claimed");
  assert.equal(issued.catalog_state, "inactive");
  assert.equal(issued.redemption_code, "NEXID-OWN-ISSUED-CODE");
  assert.equal(issued.claimed_at, CREATED);
  for (const atNow of [
    reward({ ends_at: new Date(NOW).toISOString() }),
    reward({ program_ends_at: new Date(NOW).toISOString() }),
    claim({ claim_expires_at_value: new Date(NOW).toISOString() }),
  ]) assert.equal(item(atNow, NOW).state, "expired");
});

test("DTO keeps the real cost and only explicitly projected fields, with distinct own claim history", async () => {
  const h = harness({ rows: [
    claim({ claim_status: "redeemed", metadata_json: { phone: PRIVATE }, email: PRIVATE, consumer_id: PRIVATE }),
    claim({ claim_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", claim_status: "cancelled" }),
  ] });
  const body = await response(h, 200);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].id, body.items[1].id);
  assert.notEqual(body.items[0].claim_id, body.items[1].claim_id);
  assert.equal(body.items[0].points_cost, 50);
  assert.equal(body.items[0].points_spent, 20);
  assert.equal(body.items[0].tenant_name, "Bodega Prueba");
  assert.equal(body.items[0].program_name, "Club Bodega");
  assert.equal(body.items[0].description, "Visita guiada");
  const projection = h.model.toConsumerRewardItem(reward({ program_name: null, description: null, redemption_code: "NOT-AN-OWN-CLAIM" }), NOW);
  assert.equal(projection.program_name, null);
  assert.equal(projection.description, null);
  assert.equal(projection.redemption_code, null);
  assert.equal(projection.points_spent, null);
  assert.equal(h.model.toConsumerRewardItem(claim({ points_spent: -1 }), NOW).points_spent, null);
  assert.equal(h.model.toConsumerRewardItem(claim({ points_spent: 0 }), NOW).points_spent, 0);
  assert.deepEqual(Object.keys(projection).sort(), [
    "id", "title", "description", "tenant_slug", "tenant_name", "program_name", "program_points_balance", "points_cost", "points_spent", "stock_remaining",
    "state", "catalog_state", "claim_id", "claim_status", "claim_expires_at", "claimed_at", "redemption_code",
    "can_claim", "claim_unavailable_reason",
  ].sort());
});

test("program balances report safe exact amounts only for one own program member without opening claims", () => {
  const { toConsumerRewardItem: item } = harness().model;
  for (const value of [0, "0", 80, "80", Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)]) {
    const result = item(reward({ program_points_balance: value, membership_points_balance: 999999 }), NOW);
    assert.equal(result.program_points_balance, Number(value));
    assert.equal(result.can_claim, false);
    assert.equal(result.claim_unavailable_reason, "review_required");
  }
  for (const value of [undefined, null, "", " ", false, true, -1, 0.5, NaN, Infinity, "1.5", "1e2", "80 pts", Number.MAX_SAFE_INTEGER + 1, "9007199254740992", [], {}]) {
    assert.equal(item(reward({ program_points_balance: value, membership_points_balance: 999999 }), NOW).program_points_balance, null);
  }
  for (const count of [undefined, null, 0, 2, -1, "invalid"]) {
    assert.equal(item(reward({ program_member_count: count, program_points_balance: 80, membership_points_balance: 999999 }), NOW).program_points_balance, null);
  }
});

test("a mismatched program reports no balance while retaining own voucher history", async () => {
  const mismatch = { program_identity_matches: false, program_name: null, program_status: null, program_points_balance: 900 };
  const h = harness({ rows: [reward(mismatch), claim({ ...mismatch, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", claim_expires_at_value: "2099-09-09T12:00:00Z" })] });
  const body = await response(h, 200);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].catalog_state, "inactive");
  assert.equal(body.items[0].program_name, null);
  assert.equal(body.items[0].program_points_balance, null);
  assert.equal(body.items[1].state, "claimed");
  assert.equal(body.items[1].program_points_balance, null);
  assert.equal(body.items[1].points_spent, 20);
  assert.equal(body.items[1].redemption_code, "NEXID-OWN-ISSUED-CODE");
  for (const row of body.items) {
    assert.equal(row.can_claim, false);
    assert.equal(row.claim_unavailable_reason, "review_required");
    assert.equal(Object.hasOwn(row, "program_identity_matches"), false);
  }
  const { toConsumerRewardItem: item } = h.model;
  for (const value of [undefined, null, false, 1, "true", {}, []]) {
    assert.equal(item(reward({ program_identity_matches: value, program_points_balance: 0 }), NOW).program_points_balance, null);
  }
  assert.equal(item(reward({ program_identity_matches: true, program_points_balance: 0 }), NOW).program_points_balance, 0);
  assert.match(h.queries[0].statement, /\(program\.id IS NOT NULL\) AS program_identity_matches/);
});

test("own enrolled-program catalog DTO without CRM stays locked and never implies a claim", async () => {
  // Real SQL selection is covered by the registered PostgreSQL harness; this
  // unit exercises the actual authenticated route and closed public DTO.
  const h = harness({ rows: [reward({
    membership_status: null, points_cost: 0, program_points_balance: 0,
    consumer_id: PRIVATE, metadata_json: { phone: PRIVATE },
  })] });
  const body = await response(h, 200);
  assert.equal(body.scope, "own_brands");
  assert.equal(body.items.length, 1);
  const item = body.items[0];
  assert.equal(item.state, "locked");
  assert.equal(item.catalog_state, "locked");
  assert.equal(item.program_points_balance, 0);
  assert.equal(item.points_cost, 0);
  assert.equal(item.points_spent, null);
  assert.equal(item.claim_id, null);
  assert.equal(item.redemption_code, null);
  assert.equal(item.can_claim, false);
  assert.equal(item.claim_unavailable_reason, "review_required");
  assert.deepEqual(h.events, ["authenticate", "read"]);
  assert.equal(h.queries.length, 1);
});

test("own enrolled evergreen catalog preserves nullable ends and inclusive starts without claim permission", () => {
  const { toConsumerRewardItem: item } = harness().model;
  const evergreen = reward({ membership_status: null, points_cost: 0, program_points_balance: 0,
    starts_at: new Date(NOW).toISOString(), program_starts_at: new Date(NOW).toISOString(),
    ends_at: null, program_ends_at: null });
  assert.equal(item(evergreen, NOW).catalog_state, "locked");
  assert.equal(item({ ...evergreen, ends_at: new Date(NOW).toISOString() }, NOW).catalog_state, "expired");
  assert.equal(item({ ...evergreen, program_ends_at: new Date(NOW).toISOString() }, NOW).catalog_state, "expired");
  assert.equal(item({ ...evergreen, starts_at: new Date(NOW + 1).toISOString() }, NOW).catalog_state, "upcoming");
  const current = item(evergreen, NOW);
  assert.equal(current.can_claim, false);
  assert.equal(current.claim_unavailable_reason, "review_required");
  assert.equal(current.claim_id, null);
  assert.equal(current.redemption_code, null);
});

test("only an explicit SQL advisory boolean allows the first portal reservation", () => {
  const { model } = harness();
  const allowed = model.toConsumerRewardItem(reward({ portal_claim_eligible: true }), NOW);
  assert.equal(allowed.can_claim, true); assert.equal(allowed.claim_unavailable_reason, null);
  for (const value of [undefined, null, false, "true", 1, {}]) {
    const row = model.toConsumerRewardItem(reward({ portal_claim_eligible: value }), NOW);
    assert.equal(row.can_claim, false); assert.equal(row.claim_unavailable_reason, "review_required");
  }
});
test("advisory true never overrides own claim history or a locked display condition", () => {
  const { model } = harness();
  for (const row of [claim({ portal_claim_eligible: true }), claim({ portal_claim_eligible: true, claim_status: "expired" }), reward({ portal_claim_eligible: true, membership_status: null }), reward({ portal_claim_eligible: true, program_points_balance: 0 })]) {
    assert.equal(model.toConsumerRewardItem(row, NOW).can_claim, false);
  }
});

test("claim intent is additive and advertised only with the persisted supported claim capability", () => {
  const { toConsumerRewardItem: item, CONSUMER_PORTAL_CLAIM_INTENT } = harness().model;
  const ready = item(reward({ portal_claim_eligible: true }), NOW);
  assert.equal(ready.can_claim, true); assert.equal(ready.claimIntent, CONSUMER_PORTAL_CLAIM_INTENT);
  assert.equal(ready.claimIntent, "portal-first-reservation.v1"); assert.equal(ready.points_cost, 50);
  for (const row of [reward(), reward({ portal_claim_eligible: false }), reward({ portal_claim_eligible: "true" }), reward({ portal_claim_eligible: true, membership_status: "paused" }), claim({ portal_claim_eligible: true })]) {
    const result = item(row, NOW); assert.equal(result.can_claim, false); assert.equal(Object.hasOwn(result, "claimIntent"), false);
  }
});
