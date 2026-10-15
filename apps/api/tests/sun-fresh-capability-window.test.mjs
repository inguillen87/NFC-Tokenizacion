import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runSunFreshCapabilityWindowPostgresQa } from "./helpers/sun-fresh-capability-window-postgres-harness.mjs";

const ts = createRequire(import.meta.url)("typescript");
const source = readFileSync(new URL("../src/lib/sun-fresh-handoff.ts", import.meta.url), "utf8");
function loadFresh(reserve) {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const dependencies = { "node:crypto": crypto, "./sun-rate-limit-store": { hitSunRateLimit: reserve } };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

// Unit assertions inspect the reservation parameters and pre-reservation denies.
// They do not fake PostgreSQL or claim to validate the SQL reset predicate. The
// separately registered enterprise harness executes consume + real limiter SQL.
async function fixture(callback) {
  const previousNow = Date.now, previousSecret = process.env.SUN_HANDOFF_SECRET;
  process.env.SUN_HANDOFF_SECRET = "sun-fresh-window-unit-explicit-synthetic-secret-v1";
  const issuedAt = 2_000_000_000, calls = [];
  let current = issuedAt;
  Date.now = () => current * 1000;
  const fresh = loadFresh(async (...args) => { calls.push(args); return { hits: 1, limited: false, retryAfterSeconds: 1 }; });
  const expected = { eventId: "synthetic-fresh-window-unit", bid: "SYNTHETIC-FRESH-WINDOW", uidHex: "04AABBCCDDEE11", readCounter: 17 };
  function token(overrides = {}) { return fresh.createSunFreshHandoffToken({ ...expected, diagnosticId: 88001, traceId: "synthetic-fresh-window-unit", exp: issuedAt + 300, ...overrides }); }
  function consume(raw, action = "consumer_save_product", binding = expected) {
    return fresh.consumeSunFreshHandoff(new Request("http://127.0.0.1/mobile/passport/synthetic/consumer/save-product", { method: "POST" }), { fresh_token: raw }, binding, action);
  }
  try { await callback({ issuedAt, calls, token, consume, advance: seconds => { current = issuedAt + seconds; } }); }
  finally { Date.now = previousNow; if (previousSecret === undefined) delete process.env.SUN_HANDOFF_SECRET; else process.env.SUN_HANDOFF_SECRET = previousSecret; }
}

test("fresh capability retention is stable through every valid point of its signed lifetime", { concurrency: false }, async () => {
  await fixture(async ({ calls, token, consume, advance }) => {
    const raw = token();
    for (const elapsed of [0, 1, 149, 200, 299]) { advance(elapsed); assert.equal((await consume(raw)).ok, true); }
    assert.equal(calls.length, 5);
    assert.ok(calls.every(([scope, key, window, maximum]) => scope === "sun_fresh_capability_once" && /^consumer_save_product:[a-f0-9]{64}$/.test(key) && window === 365 && maximum === 1));
    assert.ok(calls.every(args => !args.includes(raw)), "The signed token is never forwarded as a durable key");
  });
});

test("accepted future iat, shorter life and late first use never shorten replay retention", { concurrency: false }, async () => {
  await fixture(async ({ issuedAt, calls, token, consume, advance }) => {
    const future = token({ iat: issuedAt + 60, exp: issuedAt + 360 });
    advance(359); assert.equal((await consume(future)).ok, true);
    advance(0); const short = token({ exp: issuedAt + 30 });
    advance(29); assert.equal((await consume(short)).ok, true);
    advance(0); const late = token();
    advance(200); assert.equal((await consume(late)).ok, true);
    assert.deepEqual(calls.map(args => args[2]), [365, 365, 365]);
  });
});

test("expiry at the exact boundary and later fails before any reservation", { concurrency: false }, async () => {
  await fixture(async ({ calls, token, consume, advance }) => {
    const raw = token();
    for (const elapsed of [300, 301]) { advance(elapsed); assert.deepEqual(await consume(raw), { ok: false, reason: "fresh_token_expired" }); }
    assert.equal(calls.length, 0);
  });
});

test("invalid binding, malformed capability and invalid action cannot reach reservation", { concurrency: false }, async () => {
  await fixture(async ({ calls, token, consume }) => {
    const raw = token();
    assert.deepEqual(await consume(raw, "consumer_save_product", { eventId: "other-synthetic-event" }), { ok: false, reason: "fresh_token_event_mismatch" });
    assert.deepEqual(await consume("malformed"), { ok: false, reason: "fresh_token_malformed" });
    assert.deepEqual(await consume(raw, "invalid action"), { ok: false, reason: "fresh_token_action_invalid" });
    assert.equal(calls.length, 0);
  });
});

test("real PostgreSQL regression is wired into the existing guarded enterprise matrix", async () => {
  const entry = readFileSync(new URL("../scripts/enterprise-ephemeral-e2e.mjs", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../../../.github/workflows/enterprise-ephemeral-e2e.yml", import.meta.url), "utf8");
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(entry, /import \{ runSunFreshCapabilityWindowPostgresQa \} from "\.\.\/tests\/helpers\/sun-fresh-capability-window-postgres-harness\.mjs"/);
  assert.match(entry, /await runSunFreshCapabilityWindowPostgresQa\(\{ connect: connectCurrentTagQa, dockerAttestation \}\)/);
  assert.match(entry, /freshCapabilityWindow\.checks\.length, 10/);
  assert.match(entry, /tenantMarketplaceCatalog, freshCapabilityWindow \}/);
  assert.match(workflow, /version: "16\.4"/); assert.match(workflow, /version: "18\.4"/);
  assert.match(workflow, /run: npm run test:e2e:ephemeral/);
  assert.match(packageJson.scripts["test:sun"], /tests\/sun-\*\.test\.mjs/);
  assert.match(packageJson.scripts["build:regressions"], /test:sun/);
  await assert.rejects(runSunFreshCapabilityWindowPostgresQa(), /explicit disposable QA connection factory/);
});
