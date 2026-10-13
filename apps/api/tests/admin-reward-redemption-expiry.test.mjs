import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REWARD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLAIM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NOW = Date.parse("2026-10-12T03:00:00.000Z");
const source = rel => readFileSync(new URL("../src/" + rel, import.meta.url), "utf8");
const compile = value => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const json = (body, status = 200) => Response.json(body, { status });
class FixtureDate extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return NOW; } static [Symbol.hasInstance](value) { return value instanceof Date; } }
function load(value, dependencies) {
  const module = { exports: {} };
  new Function("require", "module", "exports", "Date", compile(value))(
    name => { const key = name.split("/").at(-1); assert.ok(Object.hasOwn(dependencies, key), "Unexpected import " + name); return dependencies[key]; }, module, module.exports, FixtureDate);
  return module.exports;
}
function harness(options = {}) {
  const calls = { auth: 0, schema: 0, reads: [], updates: [], mutations: 0 };
  const row = { id: CLAIM, tenant_id: TENANT, consumer_id: OWNER, reward_id: REWARD, redemption_code: "NXR-ABCDEFGH", status: "claimed",
    created_at: "2026-10-12T02:00:00.000Z", claimed_at_text: "2026-10-12 02:00:00+00", expires_at_value: "2026-10-12T04:00:00Z",
    metadata_json: { verification_seal: "SEAL123", staff_instruction: "Confirmar con la marca" }, tenant_slug: "brand-a",
    phone: "+5491100001234", display_name: "Fixture consumer", ...options.row };
  row.metadata_json = { ...row.metadata_json, expires_at: row.expires_at_value };
  const sql = async (strings, ...values) => {
    const statement = strings.join("?").replace(/\s+/g, " ").trim();
    if (statement.startsWith("SELECT c.*,")) {
      calls.reads.push({ statement, values });
      assert.doesNotMatch(statement, /expires_at.*::timestamptz/);
      assert.deepEqual(values, ["NXR-ABCDEFGH", options.forcedTenant ?? "brand-a", options.forcedTenant ?? "brand-a"]);
      return options.notFound || (options.forcedTenant && options.forcedTenant !== row.tenant_slug) ? [] : [{ ...row }];
    }
    assert.match(statement, /^WITH locked AS MATERIALIZED /);
    calls.updates.push({ statement, values });
    if (options.noEligibleRow) return [];
    row.status = "redeemed"; calls.mutations++;
    const { expires_at_value, claimed_at_text, ...persistedRow } = row; return [persistedRow];
  };
  const model = load(source("lib/consumer-rewards-read-model.ts"), { db: { sql } });
  const handler = load(source("app/admin/rewards/redemptions/validate/route.ts"), {
    auth: { checkAdmin: async () => { calls.auth++; return options.unauthorized ? json({ ok: false }, 401) : null; }, getAdminTenantAccess: () => ({ forcedTenantSlug: options.forcedTenant ?? "brand-a" }) },
    db: { sql }, "commercial-runtime-schema": { ensureConsumerPortalSchema: async () => { calls.schema++; } }, http: { json }, "consumer-rewards-read-model": model,
  }).POST;
  const post = body => handler(new Request("https://nexid.lat/admin/rewards/redemptions/validate", { method: "POST", body: JSON.stringify({ code: "nxr-abcdefgh", ...body }) }));
  return { post, calls, row };
}

test("admin authentication refuses before schema and claim queries", async () => {
  const h = harness({ unauthorized: true }); assert.equal((await h.post({ action: "redeem" })).status, 401);
  assert.equal(h.calls.schema, 0); assert.equal(h.calls.reads.length, 0); assert.equal(h.calls.updates.length, 0);
});

test("own-tenant lookup uses the shared strict expiry parser without a mutation", async () => {
  const h = harness(), response = await h.post({}); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.action, "lookup"); assert.equal(body.redemption.expires_at, "2026-10-12T04:00:00.000Z");
  assert.equal(body.redemption.consumer.phone_masked, "+5491***234"); assert.equal(h.calls.updates.length, 0);
});

test("past, exact-boundary and malformed explicit expiry deny confirmation before UPDATE", async () => {
  for (const expires_at_value of [new Date(NOW - 1).toISOString(), new Date(NOW).toISOString(), "", "not-a-date", "infinity", "2026-02-30T12:00:00Z", {}, [], false, 0]) {
    const h = harness({ row: { expires_at_value } }), response = await h.post({ action: "redeem", expires_at: "2099-01-01T00:00:00Z" });
    assert.equal(response.status, 409); assert.equal((await response.json()).reason, "redemption_expired");
    assert.equal(h.calls.updates.length, 0); assert.equal(h.calls.mutations, 0); assert.equal(h.row.status, "claimed");
  }
});

test("missing/null expiry retains the 48-hour rule without renewing an expired voucher", async () => {
  for (const expires_at_value of [undefined, null]) {
    const active = harness({ row: { expires_at_value } }), response = await active.post({});
    assert.equal(response.status, 200); assert.equal((await response.json()).redemption.expires_at, "2026-10-14T02:00:00.000Z");
    const expired = harness({ row: { expires_at_value, created_at: new Date(NOW - 48 * 3600000).toISOString() } });
    assert.equal((await expired.post({ action: "redeem" })).status, 409); assert.equal(expired.calls.updates.length, 0);
  }
});


test("native Date or string creation time retains 48h expiry and the exact raw snapshot", async () => {
  for (const created_at of [new Date("2026-10-12T02:00:00.123Z"), "2026-10-12T02:00:00.123456Z"]) {
    const raw = "2026-10-12 02:00:00.123456+00";
    const h = harness({ row: { created_at, claimed_at_text: raw, expires_at_value: null } });
    const response = await h.post({ action: "redeem" });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).redemption.expires_at, "2026-10-14T02:00:00.123Z");
    assert.equal(h.calls.updates[0].values[8], raw);
    assert.equal(h.calls.updates.length, 1);
  }
});

test("foreign tenant, terminal receipt, seal and phone mismatch do not submit UPDATE", async () => {
  const foreign = harness({ forcedTenant: "brand-b" }); assert.equal((await foreign.post({ action: "redeem" })).status, 404); assert.equal(foreign.calls.updates.length, 0);
  for (const status of ["redeemed", "cancelled", "expired"]) {
    const h = harness({ row: { status } }); assert.equal((await h.post({ action: "redeem" })).status, 409); assert.equal(h.calls.updates.length, 0);
  }
  for (const body of [{ seal: "WRONG" }, { phoneLast4: "9999" }]) {
    const h = harness(); assert.equal((await h.post({ action: "redeem", ...body })).status, 409); assert.equal(h.calls.updates.length, 0);
  }
});

test("confirmation submits the scoped locked statement with server expiry and snapshot bindings", async () => {
  const h = harness(), response = await h.post({ action: "fulfill", expires_at: "2099-01-01T00:00:00Z", consumerId: TENANT });
  assert.equal(response.status, 200); assert.equal((await response.json()).action, "redeemed"); assert.equal(h.calls.updates.length, 1);
  const { statement, values } = h.calls.updates[0];
  assert.match(statement, /tenant_id = \? AND consumer_id = \? AND reward_id = \? AND redemption_code = \? AND status = 'claimed'/);
  assert.match(statement, /FOR UPDATE \), eligible AS MATERIALIZED \( SELECT id FROM locked WHERE \?::timestamptz > clock_timestamp\(\)/);
  assert.match(statement, /claimed_at_text = \? AND COALESCE\(expires_at_value, 'null'::jsonb\) = \?::jsonb/);
  assert.match(statement, /FROM eligible WHERE consumer_reward_claims.id = eligible.id AND consumer_reward_claims.status = 'claimed'/);
  assert.deepEqual(values.slice(0, 10), [CLAIM, TENANT, OWNER, REWARD, "NXR-ABCDEFGH", "brand-a", "brand-a", "2026-10-12T04:00:00.000Z", h.row.claimed_at_text, JSON.stringify(h.row.expires_at_value)]);
  assert.equal(h.calls.mutations, 1);
});

test("no eligible row after lock maps to the existing conflict and does not retry UPDATE", async () => {
  const h = harness({ noEligibleRow: true }), response = await h.post({ action: "canjear" });
  assert.equal(response.status, 409); assert.equal((await response.json()).reason, "redemption_already_processed");
  assert.equal(h.calls.updates.length, 1); assert.equal(h.calls.mutations, 0); assert.equal(h.row.status, "claimed");
});
