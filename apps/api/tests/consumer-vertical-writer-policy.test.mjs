import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { evaluateConsumerVerticalContext, normalizeConsumerTapReadCounter, readConsumerVerticalContext, associateConsumerVerticalTap, enrollConsumerVerticalTap } from "../src/lib/consumer-vertical-writer-policy.ts";
import { installEphemeralE2eSqlExecutor, DEFAULT_REQUIRED_SCHEMA_MIGRATIONS } from "../src/lib/db.ts";
import { verticalWriterFixture, verticalConsumerId, verticalProgramId, verticalTestEnv } from "./helpers/consumer-vertical-writer-fixture.mjs";

for (const [vertical, state, action, allowed] of [
  ["wine", "VALID_CLOSED", "save", true], ["wine", "VALID_OPENED", "save", true], ["wine", "VALID_OPENED", "join", true], ["wine", "VALID_OPENED", "rewards", true],
  ["wine", "VALID_OPENED_PREVIOUSLY", "rewards", true], ["wine", "OPENED", "rewards", false],
  ["pharma", "VALID_OPENED", "save", false], ["pharma", "VALID_OPENED", "rewards", false], ["pharma", "VALID_CLOSED", "save", false],
  ["art", "VALID_CLOSED", "join", false], ["art", "VALID_CLOSED", "rewards", false], ["art", "VALID_CLOSED", "save", false],
  ["documents", "VALID_CLOSED", "join", false], ["documents", "VALID_CLOSED", "rewards", false], ["agro", "VALID_CLOSED", "save", true],
]) test(`${vertical} ${state} ${action} follows existing SUN capabilities and composition`, () => {
  assert.equal(evaluateConsumerVerticalContext(verticalWriterFixture(vertical, state), action).ok, allowed);
});
for (const [label, mutate] of [
  ["manual opened", f => { f.snapshot.event.result = "MANUAL_OPENED"; }],
  ["manual override", f => { f.snapshot.manual = { tamper_status: "OPENED" }; }],
  ["replay", f => { f.snapshot.event.result = "REPLAY_SUSPECT"; }],
  ["broken", f => { f.snapshot.event.result = "BROKEN"; }],
  ["current tag revoked", f => { f.snapshot.tag.lifecycle_state = "revoked"; }],
  ["cross tenant batch", f => { f.snapshot.batch.tenant_id = "unrelated"; }],
  ["cross tenant profile", f => { f.snapshot.profile.tenant_id = "unrelated"; }],
  ["duplicate tags", f => { f.identity_count = 2; }], ["duplicate event partitions", f => { f.event_count = 2; }],
  ["missing vertical", f => { f.snapshot.profile.vertical = null; }],
  ["unregistered carrier", f => { f.snapshot.batch.carrier_profile_code = "unknown"; }],
  ["demo event", f => { f.snapshot.event.source = "demo"; }],
  ["unverified CMAC", f => { f.snapshot.event.cmac_ok = false; }],
  ["TT state contradicted", f => { f.snapshot.event.meta.sun_tt_truth_receipt.tt_raw = "4F4F"; }],
  ["TT receipt missing", f => { f.snapshot.event.meta = {}; }],
  ["TT risk high", f => { f.snapshot.event.risk_level = "high"; }],
  ["tag carrier mismatch", f => { f.snapshot.tag.carrier_profile_code = "ntag424_dna"; }],
  ["product carrier mismatch", f => { f.snapshot.product.carrier_profile_code = "ntag424_dna"; }],
]) test(`${label} fails closed before any writer`, () => {
  const f = verticalWriterFixture(); mutate(f);
  for (const action of ["save", "join", "rewards"]) assert.equal(evaluateConsumerVerticalContext(f, action).ok, false);
});

for (const counter of [null, undefined, "", true, false, 1.5, -1, 9007199254740992, "9007199254740992", "01", "1.0", "1e0", " "]) test(`persisted counter ${JSON.stringify(counter)} denies every writer precheck`, () => {
  const f = verticalWriterFixture(); f.snapshot.event.sdm_read_ctr = counter;
  assert.equal(normalizeConsumerTapReadCounter(counter), null);
  for (const action of ["save", "join", "rewards"]) assert.deepEqual(evaluateConsumerVerticalContext(f, action), { ok: false, error: "tap_policy_indeterminate" });
});
for (const counter of [0, "0", 1, "1", Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)]) test(`persisted exact counter ${JSON.stringify(counter)} stays required and canonical in the issued context`, async () => {
  const f = verticalWriterFixture(); f.snapshot.event.sdm_read_ctr = counter;
  for (const action of ["save", "join", "rewards"]) {
    const decision = evaluateConsumerVerticalContext(f, action);
    assert.equal(decision.ok, true); assert.equal(decision.context.event.sdm_read_ctr, Number(counter));
    // Preserve the DB snapshot for the existing whole-row CTE equality fence.
    assert.equal(f.snapshot.event.sdm_read_ctr, counter);
  }
});

async function runWriterFixture({ action = "save", outcomes = [[]], rows = [verticalWriterFixture()] } = {}, verify) {
  const statements = []; let writes = 0;
  const remove = installEphemeralE2eSqlExecutor(async (strings, ...parameters) => {
    const query = strings.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
    if (/FROM schema_migrations/.test(query)) return DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map(id => ({ id }));
    if (/WITH locked_identity/.test(query)) { statements.push({ query, parameters }); const outcome = outcomes[Math.min(writes++, outcomes.length - 1)]; if (outcome instanceof Error) throw outcome; return outcome; }
    if (/SELECT jsonb_build_object/.test(query)) return rows;
    throw new Error("Unexpected synthetic query");
  }, verticalTestEnv, { migrationManaged: true });
  try {
    const decision = await readConsumerVerticalContext("900001", action);
    const write = () => action === "rewards" ? enrollConsumerVerticalTap({ consumerId: verticalConsumerId, context: decision.context, programId: verticalProgramId, locale: "es-AR" }) : associateConsumerVerticalTap({ consumerId: verticalConsumerId, context: decision.context });
    await verify({ decision, write, statements });
  } finally { remove(); }
}
test("association writes membership, history and product in ONE SERIALIZABLE statement gated by snapshot", async () => {
  await runWriterFixture({}, async ({ decision, write, statements }) => {
    assert.equal(decision.ok, true); assert.equal(await write(), null); assert.equal(statements.length, 1);
    const q = statements[0].query;
    assert.match(q, /FOR SHARE OF e, b, tenant, tag/); assert.match(q, /locked_profile[\s\S]*FOR SHARE OF profile/);
    assert.match(q, /eligible_context[\s\S]*IS NOT DISTINCT FROM/);
    for (const table of ["tenant_consumer_memberships", "consumer_tap_history", "consumer_products"]) assert.match(q, new RegExp(`INSERT INTO ${table}`));
    assert.match(q, /associated AS MATERIALIZED[\s\S]*EXISTS \(SELECT 1 FROM membership_write\)/);
    assert.doesNotMatch(q, /points_ledger|UPDATE loyalty_members/);
  });
});
test("serialization retries the entire rolled-back write with the SAME fixed policy snapshot", async () => {
  const conflict = Object.assign(new Error("synthetic serialization"), { code: "40001" });
  await runWriterFixture({ outcomes: [conflict, conflict, [{ id: "900001" }]] }, async ({ write, statements }) => {
    assert.equal((await write()).id, "900001"); assert.equal(statements.length, 3);
    assert.deepEqual(statements[0], statements[1]); assert.deepEqual(statements[1], statements[2]);
  });
});
test("retry budget is bounded and non-serialization failures are never retried", async () => {
  for (const code of ["40001", "23514"]) await runWriterFixture({ outcomes: [Object.assign(new Error("synthetic"), { code })] }, async ({ write, statements }) => {
    await assert.rejects(write()); assert.equal(statements.length, code === "40001" ? 3 : 1);
  });
});
test("enrollment keeps programme dates, tenant, member and brand revocation guards in the same writer", async () => {
  await runWriterFixture({ action: "rewards" }, async ({ write, statements }) => {
    assert.equal(await write(), null); assert.equal(statements.length, 1);
    assert.match(statements[0].query, /program\.tenant_id = e\.tenant_id/);
    assert.match(statements[0].query, /FOR SHARE OF program/); assert.match(statements[0].query, /FOR UPDATE OF member/);
    assert.match(statements[0].query, /start_at <= clock_timestamp\(\).*end_at >= clock_timestamp\(\)/);
    assert.match(statements[0].query, /status IS DISTINCT FROM 'active'/);
    assert.doesNotMatch(statements[0].query, /points_ledger|INSERT INTO consumer_products/);
  });
});
test("unissued client-like policy objects cannot invoke the writer", async () => {
  const decision = evaluateConsumerVerticalContext(verticalWriterFixture(), "save");
  await assert.rejects(associateConsumerVerticalTap({ consumerId: verticalConsumerId, context: decision.context }), /unissued/);
});
test("ambiguous persisted result produces no issued write context", async () => {
  await runWriterFixture({ rows: [verticalWriterFixture(), verticalWriterFixture()] }, async ({ decision, statements }) => {
    assert.equal(decision.ok, false); assert.equal(statements.length, 0);
  });
});
test("unsafe bigint and non-canonical event IDs are rejected BEFORE SQL or capability", async () => {
  let reads = 0;
  const remove = installEphemeralE2eSqlExecutor(async () => { reads++; throw new Error("No SQL allowed for invalid event IDs"); }, verticalTestEnv, { migrationManaged: true });
  try {
    for (const id of ["9007199254740992","9007199254740993","9223372036854775807","0","01","-1","1e3","Infinity"]) {
      assert.deepEqual(await readConsumerVerticalContext(id,"save"),{ok:false,error:"invalid_event_id"});
    }
    assert.equal(reads,0);
  } finally { remove(); }
});
test("largest exact JS event ID stays exact and a returned different ID cannot authorize", async () => {
  const f=verticalWriterFixture(); f.snapshot.event.id=9007199254740991;
  const remove=installEphemeralE2eSqlExecutor(async strings=>/FROM schema_migrations/.test(strings.join("?"))
    ? DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map(id=>({id})) : [f],verticalTestEnv,{migrationManaged:true});
  try {
    const decision=await readConsumerVerticalContext("9007199254740991","save");
    assert.equal(decision.ok,true); assert.equal(String(decision.context.event.id),"9007199254740991");
    assert.deepEqual(await readConsumerVerticalContext("9007199254740990","save"),{ok:false,error:"tap_policy_indeterminate"});
  } finally { remove(); }
});

const routes = ["consumer/save-product", "consumer/join-tenant", "loyalty/enroll"];
for (const route of routes) for (const scenario of ["anonymous", "policy_denied", "persisted_counter_missing", "tenant_mismatch", "capability_denied", "stale_policy", "writer_failure", "allowed"]) test(`${route}: ${scenario} retains auth and one-use ordering`, async () => {
  const f = verticalWriterFixture(); const event = { ...f.snapshot.event, bid: f.snapshot.batch.bid, tenant_slug: f.snapshot.tenant.slug };
  if (scenario === "persisted_counter_missing") f.snapshot.event.sdm_read_ctr = null;
  const calls = []; const exports = {};
  const file = await readFile(new URL(`../src/app/mobile/passport/[eventId]/${route}/route.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(file, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const write = async () => { calls.push("write"); if (scenario === "writer_failure") throw new Error("synthetic"); return scenario === "stale_policy" ? null : { id: "900001", membership: { id: "membership" }, history_inserted: false, status: "enrolled", points_balance: 0 }; };
  const deps = {
    "consumer-auth": { getConsumerFromRequest: async () => scenario === "anonymous" ? null : { id: verticalConsumerId } },
    "critical-rate-limit": { enforceCriticalRateLimit: async () => null },
    "bounded-request-body": { RequestBodyTooLargeError: class extends Error {}, readBoundedJsonBody: async () => scenario === "tenant_mismatch" ? { tenant: "another-brand" } : {} },
    "commercial-runtime-schema": { ensureConsumerPortalSchema: async () => {} },
    "consumer-vertical-writer-policy": { readConsumerVerticalContext: async (...args) => { calls.push("precheck"); return scenario === "persisted_counter_missing" ? readConsumerVerticalContext(...args) : scenario === "policy_denied" ? { ok: false, error: "tap_action_not_allowed" } : { ok: true, context: { event } }; }, associateConsumerVerticalTap: write, enrollConsumerVerticalTap: write },
    "ownership-policy": await import("../src/lib/ownership-policy.ts"),
    "loyalty-service": { getActiveProgram: async () => ({ id: verticalProgramId }) },
    "sun-fresh-handoff": { consumeSunFreshHandoff: async () => { calls.push("consume"); return scenario === "capability_denied" ? { ok: false, reason: "fresh_token_already_used" } : { ok: true }; } },
    "consumer-portal-service": { publishActorAssociationProjection: async () => { calls.push("projection"); } },
    "http": { json: (body, status = 200) => Response.json(body, { status }) },
  };
  new Function("require", "exports", compiled)(key => { const value = deps[key.split("/").pop()]; if (!value) throw new Error("Unexpected route dependency"); return value; }, exports);
  const sqlCalls = [];
  const remove = scenario === "persisted_counter_missing" ? installEphemeralE2eSqlExecutor(async strings => {
    const query = strings.join("?"); sqlCalls.push(query);
    if (/FROM schema_migrations/.test(query)) return DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map(id => ({ id }));
    if (/SELECT jsonb_build_object/.test(query)) return [f];
    throw new Error("Counter denial cannot reach a writer or capability ledger");
  }, verticalTestEnv, { migrationManaged: true }) : null;
  let response;
  try { response = await exports.POST(new Request("https://example.invalid/post", { method: "POST" }), { params: Promise.resolve({ eventId: "900001" }) }); }
  finally { remove?.(); }
  const payload = await response.json();
  if (["anonymous", "policy_denied", "persisted_counter_missing", "tenant_mismatch"].includes(scenario)) { assert.ok(response.status >= 400); assert.ok(!calls.includes("consume") && !calls.includes("write"));
    if (scenario === "persisted_counter_missing") { assert.equal(response.status, 403); assert.equal(payload.error ?? payload.reason, "tap_policy_indeterminate"); assert.deepEqual(calls, ["precheck"]); assert.equal(sqlCalls.filter(q => /SELECT jsonb_build_object/.test(q)).length, 1); assert.ok(sqlCalls.every(q => !/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER)\b/.test(q))); }
  }
  else if (scenario === "capability_denied") { assert.deepEqual(calls,["precheck","consume"]); assert.equal(response.status,403); assert.equal(payload.fresh_token_status,"fresh_token_already_used"); }
  else { assert.deepEqual(calls, ["precheck", "consume", "write"]); assert.equal(response.status, scenario === "allowed" ? 200 : scenario === "stale_policy" ? 409 : 503); if (scenario !== "allowed") assert.equal(payload.fresh_tap_required, true); }
});
