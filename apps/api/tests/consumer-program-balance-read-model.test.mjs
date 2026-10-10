import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Source and route tests use captured SQL plus synthetic read responses only.
// They do not execute Postgres, schema setup, a provider or a consumer mutation.
const CONSUMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PROGRAM = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TENANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PRIVATE = "private-database-error-or-contact";
function load(file, dependencies = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(Object.hasOwn(dependencies, name), "unexpected runtime dependency: " + name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
function row(overrides = {}) {
  return {
    tenant_id: TENANT, slug: "synthetic-brand", name: "Synthetic Brand", status: "active", joined_at: "2026-10-01T00:00:00.000Z",
    owner_consumer_id: CONSUMER, consents: { brand_updates: false },
    current_program_count: 1, current_program_id: PROGRAM, program_member_count: 1, program_member_active: true,
    program_points_balance: 60, program_lifetime_points: 100,
    // This historical projection must never replace the current member balance.
    points_balance: 100, lifetime_points: 100,
    ...overrides,
  };
}
function harness(options = {}) {
  const events = [], queries = [];
  const executor = async (strings, ...values) => {
    const statement = strings.join("?");
    queries.push({ statement, values }); events.push("read");
    if (options.queryError) throw options.queryError;
    return statement.includes("FROM consumer_reward_wallets") ? options.networkRows || [] : options.rows || [row()];
  };
  const model = load("../src/lib/consumer-program-balance-read-model.ts", { "./db": { sql: executor } });
  const dependencies = {
    "../../../lib/consumer-auth": { getConsumerFromRequest: async () => { events.push("auth"); if (options.authError) throw options.authError; return options.unauthorized ? null : { id: options.consumerId || CONSUMER, ...options.consumer }; } },
    "../../../lib/http": { json: (body, status = 200, headers = {}) => Response.json(body, { status, headers }) },
    "../../../lib/commercial-runtime-schema": { ensureConsumerPortalSchema: async () => { events.push("schema"); } },
    "../../../lib/consumer-program-balance-read-model": model,
    "../../../lib/db": { sql: executor },
  };
  const wallet = load("../src/app/consumer/wallet/route.ts", dependencies);
  const brands = load("../src/app/consumer/brands/route.ts", dependencies);
  return { events, queries, model, wallet, brands };
}
async function get(route, status = 200) {
  const response = await route.GET(new Request("https://local-only.invalid/consumer/read"));
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(JSON.stringify(body).includes(PRIVATE), false);
  return body;
}

test("authentication precedes schema and reads for both private balance routes", async () => {
  for (const route of ["wallet", "brands"]) {
    const denied = harness({ unauthorized: true });
    assert.deepEqual(await get(denied[route], 401), { ok: false, error: "unauthorized" });
    assert.deepEqual(denied.events, ["auth"]);
    assert.deepEqual(denied.queries, []);
    const failed = harness({ authError: new Error(PRIVATE) });
    assert.deepEqual(await get(failed[route], 503), { ok: false, error: "unavailable" });
    assert.deepEqual(failed.events, ["auth"]);
  }
});

test("both routes read the authoritative program/member balance, never the membership projection", async () => {
  for (const route of ["wallet", "brands"]) {
    const h = harness();
    const payload = await get(h[route]);
    const items = payload.items || payload.tenantWallets;
    assert.equal(items[0].points_balance, 60);
    assert.equal(items[0].lifetime_points, 100);
    assert.equal(items[0].balance_status, "ready");
    assert.equal(items[0].points_source, "loyalty_members");
    assert.equal(items[0].points_program_id, PROGRAM);
    assert.deepEqual(items[0].consents, { brand_updates: false });
    assert.equal(Object.hasOwn(items[0], "owner_consumer_id"), false);
    assert.deepEqual(h.events.slice(0, 3), ["auth", "schema", "read"]);
  }
});

test("successful claim and refund read fixtures report changed member balance while projection stays old", async () => {
  const writer = load("../src/lib/consumer-reward-queries.ts");
  const emitted = [];
  const capture = async strings => { emitted.push(strings.join("?")); return []; };
  await writer.insertConsumerRewardClaim(capture, { consumerId: CONSUMER, rewardId: TENANT, idempotencyKey: "synthetic-claim", redemptionCode: "synthetic-receipt", locale: "es-AR" });
  await writer.refundConsumerRewardClaim(capture, { consumerId: CONSUMER, claimId: TENANT, idempotencyKey: "synthetic-refund" });
  assert.match(emitted[0], /UPDATE loyalty_members[\s\S]*balance_before - locked\.points_cost/);
  assert.match(emitted[1], /UPDATE loyalty_members[\s\S]*balance_before \+ locked\.points_spent/);
  for (const [operation, balance] of [["after claim", 60], ["after refund", 100]]) {
    for (const route of ["wallet", "brands"]) {
      const h = harness({ rows: [row({ program_points_balance: balance, points_balance: 100 })] });
      const payload = await get(h[route]);
      assert.equal((payload.items || payload.tenantWallets)[0].points_balance, balance, operation + " uses current member balance");
    }
  }
});

for (const [name, overrides, reason] of [
  ["paused membership", { status: "paused" }, "membership_inactive"],
  ["blocked membership", { status: "blocked" }, "membership_inactive"],
  ["no current program (paused, future or expired)", { current_program_count: 0, current_program_id: null }, "no_current_program"],
  ["overlapping active programs", { current_program_count: 2 }, "ambiguous_current_program"],
  ["program identity absent", { current_program_id: null }, "ambiguous_current_program"],
  ["no own member", { program_member_count: 0 }, "program_member_unavailable"],
  ["duplicate own members", { program_member_count: 2 }, "ambiguous_program_member"],
  ["member paused", { program_member_active: false }, "program_member_inactive"],
  ["member status unknown", { program_member_active: null }, "program_member_inactive"],
  ["negative balance", { program_points_balance: -1 }, "invalid_balance"],
  ["fractional balance", { program_points_balance: 1.5 }, "invalid_balance"],
  ["unsafe balance", { program_points_balance: Number.MAX_SAFE_INTEGER + 1 }, "invalid_balance"],
  ["missing balance", { program_points_balance: null }, "invalid_balance"],
  ["negative lifetime", { program_lifetime_points: -1 }, "invalid_balance"],
  ["balance above lifetime", { program_points_balance: 110 }, "invalid_balance"],
]) test(name + " is unavailable rather than zero or a stale projection", async () => {
  const h = harness({ rows: [row(overrides)] });
  const item = (await get(h.brands)).items[0];
  assert.equal(item.balance_status, "unavailable");
  assert.equal(item.balance_reason, reason);
  assert.equal(item.points_balance, null);
  assert.equal(item.lifetime_points, null);
});

test("a real authorized zero is retained; strings are strict and do not parse invalid prefixes", () => {
  const h = harness();
  for (const value of [0, "0"]) {
    const result = h.model.consumerProgramBalance(row({ program_points_balance: value, program_lifetime_points: 0 }));
    assert.equal(result.balance_status, "ready"); assert.equal(result.points_balance, 0);
  }
  for (const value of ["60points", " 60", "-0", Infinity, NaN, true]) assert.equal(h.model.consumerProgramBalance(row({ program_points_balance: value })).points_balance, null);
});

test("read SQL binds owner, tenant and one program; paused/future/expired programs cannot supply balances", async () => {
  const h = harness();
  await h.model.getPrivateConsumerProgramBalances(CONSUMER);
  const query = h.queries[0];
  assert.ok(query.values.every(value => value === CONSUMER));
  assert.equal(query.values.length, 3);
  for (const predicate of ["program.tenant_id = m.tenant_id", "program.status = 'active'", "program.start_at <= statement_timestamp()", "program.end_at > statement_timestamp()", "current_program.program_count = 1", "lm.tenant_id = m.tenant_id", "lm.program_id = current_program.program_id", "lm.consumer_id = ?::uuid", "WHERE m.consumer_id = ?::uuid"]) assert.ok(query.statement.includes(predicate), predicate);
  assert.doesNotMatch(query.statement, /SUM\(|ORDER BY .*LIMIT 1|(?:UPDATE|INSERT INTO|DELETE|CREATE|ALTER)\s/);
  assert.doesNotMatch(query.statement, /\bm\.points_balance|\bm\.lifetime_points/);
});

test("invalid consumer identity or mismatched owner projection cannot disclose balances", async () => {
  const malformed = harness();
  await assert.rejects(() => malformed.model.getPrivateConsumerProgramBalances("not-a-consumer"), /invalid_consumer_id/);
  assert.equal(malformed.queries.length, 0);
  for (const route of ["wallet", "brands"]) {
    const wrong = harness({ rows: [row({ owner_consumer_id: OTHER })] });
    assert.deepEqual(await get(wrong[route], 503), { ok: false, error: "unavailable" });
  }
});

test("separate brand/program balances and the network wallet are never summed or substituted", async () => {
  const h = harness({ rows: [row(), row({ tenant_id: OTHER, slug: "other-brand", current_program_id: OTHER, program_points_balance: 20, program_lifetime_points: 20 })], networkRows: [{ points_balance: 7, lifetime_points: 9 }] });
  const payload = await get(h.wallet);
  assert.deepEqual(payload.tenantWallets.map(item => item.points_balance), [60, 20]);
  assert.deepEqual(payload.tenantWallets.map(item => item.points_program_id), [PROGRAM, OTHER]);
  assert.deepEqual(payload.networkWallet, { points_balance: 7, lifetime_points: 9 });
  assert.equal(Object.hasOwn(payload, "total_points"), false);
  assert.match(h.queries[1].statement, /tenant_id IS NULL AND network_scope = 'nexid_network'/);
});

test("absent brand or network accounts do not invent balances and blockchain control remains independent", async () => {
  const h = harness({ rows: [], consumer: { wallet_address: "synthetic-address", wallet_control_verified: false } });
  const payload = await get(h.wallet);
  assert.deepEqual(payload.tenantWallets, []);
  assert.deepEqual(payload.networkWallet, { points_balance: 0, lifetime_points: 0, enabled: false });
  assert.equal(payload.blockchainWallet.address, "synthetic-address");
  assert.equal(payload.blockchainWallet.controlVerified, false);
  assert.equal(payload.blockchainWallet.verificationMethod, null);
});

test("read failures expose only private unavailable state and never fake a zero account", async () => {
  for (const route of ["wallet", "brands"]) {
    const h = harness({ queryError: new Error(PRIVATE) });
    assert.deepEqual(await get(h[route], 503), { ok: false, error: "unavailable" });
  }
});
