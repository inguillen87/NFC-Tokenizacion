import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { GET } from "../src/app/consumer/tap-eligibility/route.ts";
import { readConsumerFromRequestReadonly } from "../src/lib/consumer-auth.ts";
import { createSunFreshHandoffToken, readSunFreshHandoffAction, consumeSunFreshHandoff } from "../src/lib/sun-fresh-handoff.ts";
import { rateLimitBucketKey } from "../src/lib/sun-rate-limit-store.ts";
import { installEphemeralE2eSqlExecutor, DEFAULT_REQUIRED_SCHEMA_MIGRATIONS } from "../src/lib/db.ts";
import { verticalWriterFixture, verticalConsumerId, verticalTestEnv } from "./helpers/consumer-vertical-writer-fixture.mjs";

// Only synthetic signing/key material, process-local executor; no network/DB.
process.env.NODE_ENV = "test";
process.env.VERCEL_ENV = "test";
process.env.SUN_HANDOFF_SECRET = "synthetic-read-only-handoff-secret-20261010";
delete process.env.SUN_HANDOFF_SECRET_PREVIOUS;
process.env.SUN_HANDOFF_ALLOW_LEGACY_SECRET_FALLBACK = "false";
process.env.RATE_LIMIT_KEY_PEPPER = "synthetic-read-only-rate-limit-pepper-20261010";
const session = "a".repeat(48);
const allow = { allowed: true, reason: "allowed", freshTapRequired: false };
const deny = reason => ({ allowed: false, reason, freshTapRequired: reason === "fresh_tap_required" });
const claimDeny = reason => ({ ...deny(reason), nextStep: "blocked" });
const claimAttempt = { ...allow, nextStep: "enter_pin" };
function insidePackFixture() {
  const f = verticalWriterFixture();
  Object.assign(f.snapshot.batch, { active_for_claim: true, claim_pin_required: true,
    hash_pin: createHash("sha256").update("Synthetic-Eligibility-Claim-PIN").digest("hex") });
  f.snapshot.profile.claim_policy = "inside_pack_secret";
  return f;
}
function capability(f, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return createSunFreshHandoffToken({ bid: f.snapshot.batch.bid, eventId: String(f.snapshot.event.id), uidHex: f.snapshot.event.uid_hex, readCounter: f.snapshot.event.sdm_read_ctr, diagnosticId: 900002, traceId: "synthetic-eligibility", iat: now - 1, exp: now + 299, ...overrides });
}
function request(token, query = "eventId=900001", cookie = `nexid_consumer_session=${session}`) {
  return new Request(`https://local.invalid/consumer/tap-eligibility?${query}`, { headers: { cookie, "x-nexid-consumer-tap-capability": token } });
}
async function fixture(options, verify) {
  const f = options.f || verticalWriterFixture();
  const queries = [], reservations = []; let ledgerReads = 0;
  const remove = installEphemeralE2eSqlExecutor(async (strings, ...values) => {
    const query = strings.join("?"); queries.push({ query, values });
    if (/FROM schema_migrations/.test(query)) return DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map(id => ({ id }));
    if (/FROM consumer_sessions s/.test(query)) {
      if (options.authFailure) throw Object.assign(new Error("synthetic unavailable"), { code: options.authFailure });
      if (options.consumer === null) return [];
      return [{ id: verticalConsumerId, status: "registered", phone: "SYNTHETIC_PRIVATE_CONTACT", ...options.consumer }];
    }
    if (/SELECT jsonb_build_object/.test(query)) {
      if (options.policyFailure) throw new Error("synthetic policy unavailable");
      return options.snapshots || [f];
    }
    if (/WITH current_program/.test(query)) {
      if (options.membershipFailure) throw new Error("synthetic relation unavailable");
      return [{ membership_active: true, program_active: true, member_active: true, ownership_claimed: false, claim_record_exists: false, pos_validated: false, ...options.relations }];
    }
    if (/SELECT hit_count::text/.test(query)) {
      ledgerReads++;
      if (options.ledgerFailure) throw Object.assign(new Error("synthetic ledger unavailable"), { code: options.ledgerFailure });
      if (options.onLedgerRead) options.onLedgerRead(ledgerReads);
      return options.buckets?.has(values[1]) ? [{ hit_count: "1" }] : options.ledgerRows || [];
    }
    if (/INSERT INTO sun_rate_limit_buckets/.test(query) && options.allowReservation) {
      reservations.push({ query, values }); return [{ hits: 1, limited: false, retry_after_seconds: 300 }];
    }
    throw new Error("Unexpected synthetic SQL");
  }, verticalTestEnv, { migrationManaged: true });
  try { await verify({ f, queries, reservations, token: options.token ?? capability(f), ledgerReads: () => ledgerReads }); }
  finally {
    remove();
    if (!options.allowReservation) for (const { query } of queries) assert.doesNotMatch(query, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|REPAIR)\b/i, "eligibility never performs SQL mutation or repair");
  }
}
async function result(req) { const response = await GET(req); return { response, body: await response.json() }; }

test("signed closed wine returns ONLY scoped decisions and private no-store without cookie/nominal data", async () => fixture({}, async ({ token, queries }) => {
  const { response, body } = await result(request(token, "eventId=900001&tenant=synthetic-brand&bid=SYNTHETIC-VERTICAL"));
  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, schema: "nexid.consumer-tap-eligibility/v1", eventId: "900001", actions: { save: allow, join: allow, rewards: allow, claim: claimDeny("pos_activation_pending") } });
  assert.match(response.headers.get("cache-control"), /private, no-store/); assert.equal(response.headers.get("vary"), "Cookie"); assert.equal(response.headers.get("set-cookie"), null);
  assert.doesNotMatch(JSON.stringify(body), /SYNTHETIC_PRIVATE|consumer_id|tenant_id|uid_hex|sdm_read_ctr|traceId|diagnosticId|fresh_token|points|nexid_consumer_session/);
  assert.ok(!JSON.stringify(body).includes(token));
  const q = queries.find(q => /WITH current_program/.test(q.query));
  assert.match(q.query, /membership\.consumer_id = \?::uuid AND membership\.tenant_id = \?::uuid/);
  assert.match(q.query, /status = 'active'[\s\S]*start_at <= now\(\)[\s\S]*end_at >= now\(\)/);
  assert.match(q.query, /member\.member_key = \?/); assert.ok(q.values.includes(`consumer:${verticalConsumerId}`));
}));
for (const cookie of ["", "nexid_consumer_session=wrong", "nexid_consumer_session=%broken"]) test(`missing/malformed session ${cookie ? "present" : "absent"} is401 without SQL`, async () => fixture({}, async ({ token, queries }) => {
  const { response, body } = await result(request(token, undefined, cookie)); assert.equal(response.status, 401); assert.deepEqual(body, { ok: false, error: "unauthorized", freshTapRequired: false }); assert.equal(queries.length, 0);
}));
for (const consumer of [null, { status: "deleted" }, { status: "disabled" }, { session_revoked_at: "2030-01-01" }]) test(`inactive/revoked current consumer ${JSON.stringify(consumer)} denies before policy`, async () => fixture({ consumer }, async ({ token, queries }) => {
  assert.equal((await result(request(token))).response.status, 401); assert.equal(queries.filter(q => /SELECT jsonb_build_object/.test(q.query)).length, 0);
}));
test("auth schema absent is service unavailable, not logout or schema repair", async () => fixture({ authFailure: "42P01" }, async ({ token }) => {
  const { response, body } = await result(request(token)); assert.equal(response.status, 503); assert.equal(body.error, "eligibility_unavailable");
}));
for (const query of ["eventId=01", "eventId=9007199254740992", "eventId=900001&eventId=900001", "eventId=900001&fresh=forbidden", "eventId=900001&tenant=", `eventId=900001&bid=${"x".repeat(129)}`, "eventId=900001&tenant=%0A"]) test(`invalid query is rejected BEFORE DB (${query.slice(0, 52)})`, async () => fixture({}, async ({ token, queries }) => {
  assert.equal((await result(request(token, query))).response.status, 400); assert.equal(queries.length, 0);
}));
for (const kind of ["missing", "malformed", "signature", "wrong-event", "expired"]) test(`${kind} handoff fails before ANY DB read`, async () => fixture({}, async ({ token, queries }) => {
  let candidate = kind === "missing" ? "" : kind === "malformed" ? "not-a-token" : kind === "signature" ? `${token.slice(0, -1)}!` : token;
  let query = kind === "wrong-event" ? "eventId=900003" : "eventId=900001";
  const oldNow = Date.now;
  if (kind === "expired") Date.now = () => oldNow() + 301_000;
  try { const { response, body } = await result(request(candidate, query)); assert.equal(response.status, 403); assert.deepEqual(body, { ok: false, error: "fresh_tap_required", freshTapRequired: true }); assert.equal(queries.length, 0); }
  finally { Date.now = oldNow; }
}));
test("missing signing configuration is503 without DB or disclosure", async () => fixture({}, async ({ token, queries }) => {
  const old = process.env.SUN_HANDOFF_SECRET; delete process.env.SUN_HANDOFF_SECRET;
  try { const { response, body } = await result(request(token)); assert.equal(response.status, 503); assert.equal(body.error, "eligibility_unavailable"); assert.equal(queries.length, 0); }
  finally { process.env.SUN_HANDOFF_SECRET = old; }
}));
for (const [label, mutate] of [["tag", f => { f.snapshot.event.uid_hex = "04FFEEDDCC0011"; f.snapshot.tag.uid_hex = f.snapshot.event.uid_hex; }], ["counter", f => { f.snapshot.event.sdm_read_ctr = 2; }], ["bid", f => { f.snapshot.batch.bid = "OTHER-SYNTHETIC-BATCH"; }]]) test(`${label} changed after handoff denies before relation/ledger reads`, async () => {
  const f = verticalWriterFixture(), token = capability(f); mutate(f);
  await fixture({ f, token }, async ({ queries }) => { assert.equal((await result(request(token))).response.status, 403); assert.equal(queries.filter(q => /WITH current_program|hit_count::text/.test(q.query)).length, 0); });
});
test("tenant query cannot select another brand", async () => fixture({}, async ({ token, queries }) => {
  assert.equal((await result(request(token, "eventId=900001&tenant=other-brand"))).response.status, 403); assert.equal(queries.filter(q => /WITH current_program/.test(q.query)).length, 0);
}));
for (const counter of [null, undefined, "", true, false, 1.5, -1, 9007199254740992, "9007199254740992", "01", "1.0", "1e0", " "]) test(`missing/indeterminate persisted counter ${JSON.stringify(counter)} cannot skip exact binding`, async () => {
  const f = verticalWriterFixture(), token = capability(f); f.snapshot.event.sdm_read_ctr = counter;
  await fixture({ f, token }, async ({ queries }) => {
    const { response, body } = await result(request(token)); assert.equal(response.status, 403); assert.deepEqual(body, { ok: false, error: "fresh_tap_required", freshTapRequired: true });
    assert.equal(queries.filter(q => /WITH current_program|hit_count::text/.test(q.query)).length, 0);
  });
});
for (const counter of [0, "0", "1"]) test(`exact persisted counter ${JSON.stringify(counter)} matches the independently signed handoff`, async () => {
  const f = verticalWriterFixture(), token = capability(f, { readCounter: Number(counter) }); f.snapshot.event.sdm_read_ctr = counter;
  await fixture({ f, token }, async () => { const { response, body } = await result(request(token)); assert.equal(response.status, 200); assert.deepEqual(body.actions.save, allow); });
});
test("canonical decimal persisted counter mismatch still denies before relations/ledger", async () => {
  const f = verticalWriterFixture(), token = capability(f); f.snapshot.event.sdm_read_ctr = "2";
  await fixture({ f, token }, async ({ queries }) => { assert.equal((await result(request(token))).response.status, 403); assert.equal(queries.filter(q => /WITH current_program|hit_count::text/.test(q.query)).length, 0); });
});
for (const [vertical, state, reason] of [["wine", "VALID_OPENED", "allowed"], ["agro", "VALID_CLOSED", "allowed"], ["pharma", "VALID_OPENED", "tap_action_not_allowed"], ["art", "VALID_CLOSED", "tap_action_not_allowed"], ["wine", "BROKEN", "event_security_blocked"], ["wine", "REPLAY_SUSPECT", "event_security_blocked"]]) test(`${vertical}/${state} reuses actual P1 safety/composite policy`, async () => fixture({ f: verticalWriterFixture(vertical, state) }, async ({ token }) => {
  const { response, body } = await result(request(token)); assert.equal(response.status, 200);
  assert.deepEqual(body.actions.save, reason === "allowed" ? allow : deny(reason)); assert.deepEqual(body.actions.join, body.actions.save);
}));
for (const mutate of [f => { f.snapshot.manual = { batch_id: f.snapshot.batch.id, uid_hex: f.snapshot.event.uid_hex, tamper_status: "OPENED" }; }, f => { f.snapshot.profile.tenant_id = "unrelated"; }, f => { f.snapshot.event.meta = {}; }]) test("manual/foreign profile/missing TT receipt never offers a write", async () => {
  const f = verticalWriterFixture(); mutate(f);
  await fixture({ f }, async ({ token }) => { const { body } = await result(request(token)); assert.equal(body.ok, true); assert.ok(Object.values(body.actions).every(action => !action.allowed)); });
});
test("membership withdrawal and programme withdrawal withdraw projected action without reserving anything", async () => {
  for (const [relations, expected] of [[{ membership_active: false }, { save: deny("membership_inactive"), join: deny("membership_inactive"), rewards: deny("membership_inactive"), claim: claimDeny("membership_inactive") }], [{ program_active: false }, { save: allow, join: allow, rewards: deny("program_unavailable"), claim: claimAttempt }], [{ member_active: false }, { save: allow, join: allow, rewards: deny("member_inactive"), claim: claimAttempt }]]) await fixture({ f: insidePackFixture(), relations }, async ({ token }) => {
    const { body } = await result(request(token)); assert.deepEqual(body.actions, expected);
  });
});
test("published inside-pack configuration offers only a PIN attempt, never title confirmation or a reservation", async () => fixture({ f: insidePackFixture() }, async ({ token, queries, ledgerReads }) => {
  const { response, body } = await result(request(token)); assert.equal(response.status, 200);
  assert.deepEqual(body.actions, { save: allow, join: allow, rewards: allow, claim: claimAttempt });
  assert.equal(ledgerReads(), 4); assert.doesNotMatch(JSON.stringify(body), /ownership_created|ownership_confirmed|pinValidated|posValidated/);
  assert.doesNotMatch(queries.map(q => q.query).join("\n"), /\b(?:INSERT|UPDATE|DELETE)\b/);
}));
test("active purchase-proof configuration remains blocked for claim while save/join/rewards retain their own decisions", async () => {
  const f = verticalWriterFixture(); f.snapshot.batch.active_for_claim = true;
  await fixture({ f }, async ({ token }) => { const { body } = await result(request(token));
    assert.deepEqual(body.actions, { save: allow, join: allow, rewards: allow, claim: claimDeny("purchase_receipt_required") });
  });
});
for (const owner of ["same-consumer", "another-consumer"]) test(`persisted claimed title (${owner}) blocks another claim before any reservation`, async () => fixture({ f: insidePackFixture(), relations: { ownership_claimed: true } }, async ({ token, queries }) => {
  const { body } = await result(request(token)); assert.deepEqual(body.actions.claim, claimDeny("ownership_already_claimed"));
  // The authoritative SELECT deliberately asks whether ANY claimed owner exists.
  const relation = queries.find(q => /AS ownership_claimed/.test(q.query));
  const ownership = relation.query.slice(relation.query.indexOf("FROM consumer_product_ownerships"), relation.query.indexOf("AS ownership_claimed"));
  assert.match(ownership, /ownership\.tenant_id = \?::uuid/); assert.match(ownership, /ownership\.status = 'claimed'/);
  assert.doesNotMatch(ownership, /consumer_id/); assert.deepEqual(body.actions.save, allow); assert.deepEqual(body.actions.join, allow);
}));
test("withdrawn PIN credential hides claim without borrowing permission from save/join", async () => {
  const f = insidePackFixture(); f.snapshot.batch.hash_pin = "malformed";
  await fixture({ f }, async ({ token }) => { const { body } = await result(request(token));
    assert.deepEqual(body.actions.claim, claimDeny("pin_policy_misconfigured")); assert.deepEqual(body.actions.save, allow); assert.deepEqual(body.actions.join, allow);
  });
});
test("successive reads withdraw the PIN attempt after published activation is disabled", async () => fixture({ f: insidePackFixture() }, async ({ f, token }) => {
  assert.deepEqual((await result(request(token))).body.actions.claim, claimAttempt);
  f.snapshot.batch.active_for_claim = false;
  assert.deepEqual((await result(request(token))).body.actions.claim, claimDeny("pos_activation_pending"));
}));
test("successive reads withdraw required POS attestation without consuming or inferring PIN success", async () => {
  const f = insidePackFixture(), relations = { pos_validated: true }; f.snapshot.batch.sdm_config.claim_requires_pos = true;
  await fixture({ f, relations }, async ({ token }) => {
    assert.deepEqual((await result(request(token))).body.actions.claim, claimAttempt); relations.pos_validated = false;
    assert.deepEqual((await result(request(token))).body.actions.claim, claimDeny("retailer_attestation_required"));
  });
});
test("spent claim bucket blocks only the claim attempt and never renews its capability", async () => {
  const f = insidePackFixture(), token = capability(f), key = rateLimitBucketKey("sun_fresh_capability_once", `consumer_claim_ownership:${createHash("sha256").update(token).digest("hex")}`);
  await fixture({ f, token, buckets: new Set([key.scopeKeyHash]) }, async () => { const { body } = await result(request(token));
    assert.deepEqual(body.actions, { save: allow, join: allow, rewards: allow, claim: claimDeny("fresh_tap_required") });
  });
});
for (const field of ["membership_active", "program_active", "member_active", "ownership_claimed", "claim_record_exists", "pos_validated"]) test(`indeterminate ${field} never projects a permission`, async () => fixture({ relations: { [field]: null } }, async ({ token, ledgerReads }) => {
  const { response, body } = await result(request(token)); assert.equal(response.status, 503); assert.equal(body.error, "eligibility_unavailable"); assert.equal(ledgerReads(), 0);
}));
test("successive reads observe publication withdrawal; eligibility is not a cached permission", async () => {
  const relations = { program_active: true };
  await fixture({ relations }, async ({ token }) => { assert.equal((await result(request(token))).body.actions.rewards.allowed, true); relations.program_active = false; });
  await fixture({ relations }, async ({ token }) => { assert.equal((await result(request(token))).body.actions.rewards.reason, "program_unavailable"); });
});
test("exact spent bucket remains spent late in TTL; other named actions are independently available", async () => {
  const f = insidePackFixture(), token = capability(f), key = rateLimitBucketKey("sun_fresh_capability_once", `consumer_save_product:${createHash("sha256").update(token).digest("hex")}`);
  const oldNow = Date.now; Date.now = () => oldNow() + 200_000;
  try { await fixture({ f, token, buckets: new Set([key.scopeKeyHash]) }, async () => {
    const { body } = await result(request(token)); assert.deepEqual(body.actions, { save: deny("fresh_tap_required"), join: allow, rewards: allow, claim: claimAttempt });
  }); } finally { Date.now = oldNow; }
});
for (const ledgerFailure of ["42P01", "42501"]) test(`ledger ${ledgerFailure} is503, never repaired`, async () => fixture({ ledgerFailure }, async ({ token }) => {
  const { response, body } = await result(request(token)); assert.equal(response.status, 503); assert.equal(body.error, "eligibility_unavailable");
}));
for (const ledgerRows of [[{ hit_count: "-1" }], [{ hit_count: null }], [{ hit_count: "1" }, { hit_count: "0" }]]) test("malformed/ambiguous ledger read fails closed", async () => fixture({ ledgerRows }, async ({ token }) => {
  assert.equal((await result(request(token))).response.status, 503);
}));
test("expiry crossing the ledger read never returns allowed", async () => {
  const oldNow = Date.now, base = oldNow();
  await fixture({ onLedgerRead: () => { Date.now = () => base + 301_000; } }, async ({ token }) => {
    try { assert.equal((await result(request(token))).response.status, 403); } finally { Date.now = oldNow; }
  });
});
test("consume and observe share action normalization and EXACT bucket hash", async () => fixture({ allowReservation: true }, async ({ f, token, queries, reservations }) => {
  const expected = { eventId: f.snapshot.event.id, bid: f.snapshot.batch.bid, uidHex: f.snapshot.event.uid_hex, readCounter: 1 };
  assert.equal((await readSunFreshHandoffAction(token, expected, " CONSUMER_SAVE_PRODUCT ")).ok, true);
  assert.equal((await consumeSunFreshHandoff(request(token), { fresh_token: token }, expected, " Consumer_Save_Product ")).ok, true);
  const read = queries.find(q => /SELECT hit_count::text/.test(q.query)); assert.equal(reservations.length, 1);
  assert.ok(reservations[0].values.includes(read.values[0])); assert.ok(reservations[0].values.includes(read.values[1]));
  assert.notEqual(read.values[1], token); assert.equal(read.values[1].length, 64);
}));
test("read-only auth shares session hash and active/revocation checks without initializer", async () => fixture({}, async ({ queries }) => {
  const consumer = await readConsumerFromRequestReadonly(request("")); assert.equal(consumer.id, verticalConsumerId);
  const auth = queries.find(q => /FROM consumer_sessions s/.test(q.query)); assert.deepEqual(auth.values, [createHash("sha256").update(session).digest("hex")]);
  assert.match(auth.query, /s\.expires_at >= now\(\)/); assert.match(auth.query, /s\.revoked_at IS NULL/); assert.match(auth.query, /c\.status IN \('anonymous', 'registered', 'verified'\)/);
}));
test("route exposes only GET and no initializer/mutation service; no extension of public four-action enum", async () => {
  const source = await readFile(new URL("../src/app/consumer/tap-eligibility/route.ts", import.meta.url), "utf8");
  assert.match(source, /export async function GET/); assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)|\b(?:ensure|consume|renew|release)\w*\(/);
  const publicContract = await readFile(new URL("../src/lib/tenant-loyalty-configuration.ts", import.meta.url), "utf8");
  assert.match(publicContract, /CUSTOMER_ACTIONS = \["lead", "feedback", "sommelier", "marketplace"\]/);
});
test("new security cases are executed once by existing build regression entrypoint", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["test:consumer-eligibility"], "node --import tsx --test tests/consumer-tap-eligibility.test.mjs");
  assert.equal(pkg.scripts["build:regressions"].split("npm run test:consumer-eligibility").length - 1, 1);
});

// R7 proposal: no SQL execution is inferred from these synthetic query-contract cases.
for (const recordedStatus of ["revoked", "disputed", "blocked_replay"]) test(`same consumer/TAP ${recordedStatus} record blocks only claim before any claim bucket read`, async () => fixture({ f: insidePackFixture(), relations: { claim_record_exists: true } }, async ({ token, queries, ledgerReads }) => {
  const { response, body } = await result(request(token)); assert.equal(response.status, 200);
  assert.deepEqual(body.actions, { save: allow, join: allow, rewards: allow, claim: claimDeny("tap_action_not_allowed") });
  assert.equal(ledgerReads(), 3);
  const relation = queries.find(q => /AS claim_record_exists/.test(q.query));
  const predicate = relation.query.match(/recorded\.tenant_id = \?::uuid[\s\S]*?recorded\.consumer_id = \?::uuid AND recorded\.event_id = \?::bigint/);
  assert.ok(predicate);
  const offset = (relation.query.slice(0, predicate.index).match(/\?/g) || []).length;
  assert.deepEqual(relation.values.slice(offset, offset + 3), [verticalWriterFixture().snapshot.event.tenant_id, verticalConsumerId, "900001"]);
  assert.doesNotMatch(predicate[0], /recorded\.status|recorded\.uid_hex/);
  assert.doesNotMatch(JSON.stringify(body), /ownership_created|ownership_confirmed|ownership_status|claim_record_exists/);
}));
test("claimed ownership reason retains priority over the same-consumer/TAP record precondition", async () => fixture({ f: insidePackFixture(), relations: { ownership_claimed: true, claim_record_exists: true } }, async ({ token }) => {
  assert.deepEqual((await result(request(token))).body.actions.claim, claimDeny("ownership_already_claimed"));
}));
for (const value of [undefined, null, "false", "true", 0, 1]) test(`indeterminate claim_record_exists ${JSON.stringify(value)} fails closed before bucket reads`, async () => fixture({ f: insidePackFixture(), relations: { claim_record_exists: value } }, async ({ token, ledgerReads }) => {
  const { response, body } = await result(request(token)); assert.equal(response.status, 503); assert.equal(body.error, "eligibility_unavailable"); assert.equal(ledgerReads(), 0);
}));
