import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { allowRuntimeDemoSeed } from "../src/lib/runtime-demo-seed-policy.ts";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
function load(source, dependencies) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("require", "module", "exports", output)(key => {
    assert(Object.hasOwn(dependencies, key), "unexpected_fixture_dependency");
    return dependencies[key];
  }, module, module.exports);
  return module.exports;
}
const ddl = /^\s*(?:CREATE|ALTER|DROP|TRUNCATE|COMMENT|GRANT|REVOKE|DO|CALL|VACUUM|REINDEX|CLUSTER|ANALYZE|REFRESH\s+MATERIALIZED\s+VIEW)\b/i;
const isCatalogWrite = query => /\b(?:INSERT INTO|UPDATE) (?:marketplace_brand_profiles|marketplace_products|marketplace_offers|loyalty_programs|rewards)\b/.test(query);

function fixture({ env = {}, managed = true, consumer = { id: "11111111-1111-4111-8111-111111111111" }, readFails = false } = {}) {
  const business = [], order = [];
  // Explicit synthetic adapter: no actual database, SQL semantics or records.
  const sql = async parts => {
    const query = parts.join("?").replace(/\s+/g, " ").trim();
    if (managed && ddl.test(query)) return [];
    if (ddl.test(query)) return [];
    business.push(query); order.push("business");
    if (query.startsWith("SELECT") && query.includes("AS products")) {
      if (readFails) throw Error("fixture_read_unavailable");
      return [{ products: 3, taps: 7, memberships: 2, unread: 0 }];
    }
    return [];
  };
  const db = { sql, runtimeSchemaIsMigrationManaged: () => managed };
  const loyalty = load(read("../src/lib/loyalty-schema.ts"), { "./db": db });
  const schema = load(read("../src/lib/commercial-runtime-schema.ts"), {
    "./db": db, "./loyalty-schema": loyalty,
    "./runtime-reference-catalog": { requireRuntimeCarrierCatalog: async () => {} },
    "./carrier-profiles": { CARRIER_PROFILES: [] },
    "./runtime-demo-seed-policy": { allowRuntimeDemoSeed: () => allowRuntimeDemoSeed(env) },
  });
  const route = load(read("../src/app/consumer/me/route.ts"), {
    "../../../lib/consumer-auth": { getConsumerFromRequest: async () => { order.push("auth"); return consumer; } },
    "../../../lib/http": { json: (body, status = 200) => Response.json(body, { status }) },
    "../../../lib/db": db, "../../../lib/commercial-runtime-schema": schema,
    "../../../lib/critical-rate-limit": { enforceCriticalRateLimit: async () => null },
    "../../../lib/bounded-request-body": { RequestBodyTooLargeError: class extends Error {}, readBoundedJsonBody: async () => { throw Error("GET does not read a body"); } },
  });
  const request = () => route.GET(new Request("https://fixture.invalid/consumer/me"));
  return { business, order, request, loyalty, schema };
}

test("demo runtime catalog resets require an exact local opt-in and never run in Production or Preview", () => {
  for (const env of [{}, { NODE_ENV: "development" }, { NODE_ENV: "test" }, { NODE_ENV: "test", DEMO_MODE: "true" }, { NODE_ENV: "test", NEXID_RUNTIME_DEMO_SEED: "1" }, { NODE_ENV: "test", NEXID_RUNTIME_DEMO_SEED: "TRUE" }]) assert.equal(allowRuntimeDemoSeed(env), false);
  for (const NODE_ENV of ["production", "", "staging"]) assert.equal(allowRuntimeDemoSeed({ NODE_ENV, NEXID_RUNTIME_DEMO_SEED: "true" }), false);
  for (const NODE_ENV of ["development", "test", "production"]) {
    for (const VERCEL_ENV of ["production", "preview", "unknown"]) assert.equal(allowRuntimeDemoSeed({ NODE_ENV, VERCEL_ENV, NEXID_RUNTIME_DEMO_SEED: "true" }), false);
    assert.equal(allowRuntimeDemoSeed({ NODE_ENV, VERCEL: "1", NEXID_RUNTIME_DEMO_SEED: "true" }), false);
  }
  for (const NODE_ENV of ["development", "test"]) for (const VERCEL_ENV of ["", "test"]) assert.equal(allowRuntimeDemoSeed({ NODE_ENV, VERCEL_ENV, NEXID_RUNTIME_DEMO_SEED: "true" }), true);
});

test("a cold unauthenticated account GET rejects before any portal initialization or business statement", async () => {
  for (const env of [{ NODE_ENV: "production", NEXID_RUNTIME_DEMO_SEED: "true" }, { NODE_ENV: "development", NEXID_RUNTIME_DEMO_SEED: "true" }]) {
    const f = fixture({ env, consumer: null });
    const response = await f.request(); assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: "unauthorized" });
    assert.deepEqual(f.order, ["auth"]); assert.equal(f.business.length, 0);
  }
});

test("cold authenticated Production and Preview reads retain account counts and never reset admin catalog", async () => {
  for (const VERCEL_ENV of ["production", "preview"]) {
    for (let processInstance = 0; processInstance < 2; processInstance++) {
      const f = fixture({ env: { NODE_ENV: "production", VERCEL_ENV, NEXID_RUNTIME_DEMO_SEED: "true" } });
      const response = await f.request(); assert.equal(response.status, 200);
      const result = await response.json(); assert.deepEqual(result.stats, { products: 3, taps: 7, memberships: 2, unread: 0 });
      assert.equal(f.order[0], "auth"); assert.equal(f.business.length, 2);
      assert(!f.business.some(isCatalogWrite));
      assert.equal(f.business.filter(q => q.startsWith("UPDATE loyalty_members")).length, 1, "legacy member-key backfill stays unchanged");
      assert(f.business[1].startsWith("SELECT"));
      await f.request(); assert.equal(f.business.length, 3, "warm process only adds the account read");
    }
  }
  const hosted = fixture({ env: { NODE_ENV: "test", VERCEL: "1", NEXID_RUNTIME_DEMO_SEED: "true" } });
  await hosted.request(); assert(!hosted.business.some(isCatalogWrite));
});

test("a local initializer does not seed brand, reward, stock or offers by default", async () => {
  const f = fixture({ managed: false, env: { NODE_ENV: "development", DEMO_MODE: "true" } });
  await f.schema.ensureConsumerPortalSchema();
  assert(!f.business.some(isCatalogWrite));
  assert(f.business.some(q => q.startsWith("UPDATE loyalty_members")), "legacy local schema backfill stays local");
});

test("the deliberate local fixture opt-in preserves the existing demo corpus and process cache", async () => {
  const f = fixture({ managed: false, env: { NODE_ENV: "test", VERCEL_ENV: "test", NEXID_RUNTIME_DEMO_SEED: "true" } });
  await f.schema.ensureConsumerPortalSchema();
  assert(f.business.some(q => q.includes("INSERT INTO marketplace_brand_profiles")));
  assert(f.business.some(q => q.includes("stock_remaining = GREATEST")));
  assert(f.business.some(q => q.includes("WITH curated") && q.includes("SET status = 'draft'")));
  const count = f.business.length; await f.schema.ensureConsumerPortalSchema(); assert.equal(f.business.length, count);
});

test("the legacy idempotent loyalty member-key backfill is preserved without catalog writes", async () => {
  const f = fixture(); await f.loyalty.ensureLoyaltySchema(); assert.equal(f.business.length, 1);
  assert.match(f.business[0], /^UPDATE loyalty_members SET member_key = COALESCE/);
  assert.match(f.business[0], /WHERE member_key IS NULL$/); assert(!f.business.some(isCatalogWrite));
});

test("a failed authenticated data read does not fall back to resetting demo catalog", async () => {
  const f = fixture({ env: { NODE_ENV: "production", VERCEL_ENV: "production", NEXID_RUNTIME_DEMO_SEED: "true" }, readFails: true });
  await assert.rejects(f.request(), /fixture_read_unavailable/);
  assert.equal(f.business.length, 2); assert(f.business[1].startsWith("SELECT")); assert(!f.business.some(isCatalogWrite));
});
