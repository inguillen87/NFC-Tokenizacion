import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import * as crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
import * as policy from "../src/lib/consumer-vertical-writer-policy.ts";
import { createSunFreshHandoffToken } from "../src/lib/sun-fresh-handoff.ts";
import { rateLimitBucketKey } from "../src/lib/sun-rate-limit-store.ts";
import { installEphemeralE2eSqlExecutor, DEFAULT_REQUIRED_SCHEMA_MIGRATIONS } from "../src/lib/db.ts";
import { verticalWriterFixture, verticalConsumerId, verticalTestEnv } from "./helpers/consumer-vertical-writer-fixture.mjs";
import { createDemoShareToken } from "../src/lib/demo-share.ts";

process.env.NODE_ENV = "test";
process.env.VERCEL_ENV = "test";
process.env.SUN_HANDOFF_SECRET = "synthetic-claim-context-secret";
process.env.RATE_LIMIT_KEY_PEPPER = "synthetic-claim-context-pepper-20261010";
process.env.PUBLIC_DEMO_SHARE_SECRET = "synthetic-claim-share-secret";
const pin = "Synthetic-Claim-PIN-42";
const hash = createHash("sha256").update(pin).digest("hex");
const relations = { membershipActive: true, ownershipClaimed: false, claimRecordExists: false, posValidated: true };
function claimFixture(state = "VALID_CLOSED", vertical = "wine") {
  const f = verticalWriterFixture(vertical, state);
  Object.assign(f.snapshot.batch, { active_for_claim: true, claim_pin_required: true, hash_pin: hash });
  f.snapshot.profile.claim_policy = "inside_pack_secret";
  return f;
}
function token(f) { const now = Math.floor(Date.now() / 1000); return createSunFreshHandoffToken({ bid: f.snapshot.batch.bid,
  eventId: String(f.snapshot.event.id), uidHex: f.snapshot.event.uid_hex, readCounter: Number(f.snapshot.event.sdm_read_ctr),
  diagnosticId: 900002, traceId: "synthetic-claim-context", iat: now - 1, exp: now + 299 }); }

for (const state of ["VALID_CLOSED", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY"]) test(`${state}: legitimate inside-pack proof projects only an attempt needing PIN`, () => {
  assert.deepEqual(policy.evaluateConsumerOwnershipClaimAttempt(claimFixture(state), relations), { ok: true, nextStep: "enter_pin", reviewRequired: false });
});
for (const [name, mutate, reason] of [
  ["manual opening", f => { f.snapshot.manual = { batch_id: f.snapshot.batch.id, uid_hex: f.snapshot.event.uid_hex, tamper_status: "OPENED" }; }, "event_security_blocked"],
  ["broken", f => { f.snapshot.event.result = "BROKEN"; }, "event_security_blocked"],
  ["counter absent", f => { f.snapshot.event.sdm_read_ctr = null; }, "tap_policy_indeterminate"],
  ["PIN hash malformed", f => { f.snapshot.batch.hash_pin = "malformed"; }, "pin_policy_misconfigured"],
  ["tag override cannot borrow batch", f => { f.snapshot.tag.claim_pin_required = true; f.snapshot.tag.hash_pin = null; }, "pin_policy_misconfigured"],
  ["inactive tag override", f => { f.snapshot.tag.active_for_claim = false; }, "pos_activation_pending"],
  ["issuer transfer required", f => { f.snapshot.profile.ownership_policy.requiresIssuerTransfer = true; }, "tap_action_not_allowed"],
  ["manual policy", f => { f.snapshot.profile.claim_policy = "admin_approved"; }, "ownership_manual_approval_required"],
]) test(`${name}: denies claim without issuing authorization`, () => {
  const f = claimFixture(); mutate(f); assert.deepEqual(policy.evaluateConsumerOwnershipClaimAttempt(f, relations), { ok: false, error: reason });
});
for (const empty of [{}, [], "malformed", null]) for (const required of ["requiresIssuerTransfer", "requiresPurchaseProof"]) test(`canonical fallback ${JSON.stringify(empty)} preserves batch ${required}`, () => {
  const f = claimFixture("VALID_CLOSED", "luxury"); f.snapshot.profile.ownership_policy = empty;
  f.snapshot.batch.sdm_config.sun = { passport: { ownershipPolicy: { [required]: true } } };
  const decision = policy.evaluateConsumerOwnershipClaimAttempt(f, relations);
  assert.deepEqual(decision, { ok: false, error: required === "requiresIssuerTransfer" ? "ownership_manual_approval_required" : "purchase_receipt_required" });
});
for (const [updates, reason] of [[{ membershipActive: false }, "membership_inactive"], [{ ownershipClaimed: true }, "ownership_already_claimed"], [{ posValidated: false }, "retailer_attestation_required"]]) test(`${reason}: actual attempt stays blocked`, () => {
  const f = claimFixture(); f.snapshot.batch.sdm_config.claim_requires_pos = true;
  assert.deepEqual(policy.evaluateConsumerOwnershipClaimAttempt(f, { ...relations, ...updates }), { ok: false, error: reason });
});

async function fixture(options = {}, verify) {
  const f = options.f || claimFixture(), statements = [], writes = [], buckets = new Map(), authority = options.authority || policy;
  const remove = installEphemeralE2eSqlExecutor(async (strings, ...values) => {
    const query = strings.reduce((q, part, i) => q + (i ? `$${i}` : "") + part, ""); statements.push({ query, values });
    if (/FROM schema_migrations/.test(query)) return DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map(id => ({ id }));
    if (/SELECT jsonb_build_object/.test(query)) return [f];
    if (/FROM events e/.test(query) && /b\.bid/.test(query)) return [{ ...f.snapshot.event, bid: f.snapshot.batch.bid,
      tenant_slug: f.snapshot.tenant.slug, batch_sdm_config: f.snapshot.batch.sdm_config,
      sun_profile_vertical: f.snapshot.profile?.vertical, sun_profile_claim_policy: f.snapshot.profile?.claim_policy,
      sun_profile_ownership_policy: f.snapshot.profile?.ownership_policy }];
    if (/SELECT sdm_config\s+FROM batches/.test(query)) return [{ sdm_config: f.snapshot.batch.sdm_config }];
    if (/AS ownership_claimed/.test(query)) return [{ membership_active: true, ownership_claimed: false, claim_record_exists: false, pos: options.pos || null, ...options.relations }];
    if (/INSERT INTO sun_rate_limit_buckets/.test(query)) {
      const scope = values[1], key = values[2], count = (buckets.get(key) || 0) + 1; buckets.set(key, count);
      if (options.rateUnavailable && scope !== "sun_fresh_capability_once") throw new Error("Synthetic unavailable");
      return [{ hits: count, limited: scope === "sun_fresh_capability_once" ? count > 1 : options.rateLocked === true, retry_after_seconds: 300, lease_window_started_at: "2030-01-01T00:00:00Z" }];
    }
    if (/UPDATE sun_rate_limit_buckets/.test(query)) return [];
    if (/WITH locked_identity/.test(query)) { writes.push({ query, values }); if (options.writeError) throw options.writeError;
      return options.noWrite ? [] : [{ ownership: Object.prototype.hasOwnProperty.call(options, "receipt") ? options.receipt : {
        id: "40000000-0000-4000-8000-000000000001", consumer_id: verticalConsumerId,
        tenant_id: f.snapshot.tenant.id, event_id: f.snapshot.event.id, status: "claimed" }, core_commit_fence: 1 }]; }
    throw new Error("Unexpected synthetic query");
  }, verticalTestEnv, { migrationManaged: true });
  try { await verify({ f, statements, writes, buckets, authority, req: new Request("https://synthetic.invalid/claim", { method: "POST" }), capability: token(f),
    precheck: () => authority.readConsumerOwnershipClaimContext(f.snapshot.event.id, verticalConsumerId, options.review === true) }); }
  finally { remove(); }
}
test("missing required PIN returns retryable403 and NEVER consumes a bucket", async () => fixture({}, async ({ req, capability, precheck, statements }) => {
  const checked = await precheck(); assert.equal(checked.ok, true);
  assert.deepEqual(await policy.consumeAndAuthorizeConsumerOwnershipClaim(req, { fresh_token: capability }, checked.context, "consumer_claim_ownership"),
    { ok: false, status: 403, error: "pin_required", freshTapRequired: false });
  assert.ok(statements.every(q => !/INSERT|UPDATE|DELETE/.test(q.query)));
}));
test("a supplied wrong PIN spends capability and retains failure budget without core writes", async () => fixture({}, async ({ req, capability, precheck, statements, writes }) => {
  const checked = await precheck(); const result = await policy.consumeAndAuthorizeConsumerOwnershipClaim(req,
    { fresh_token: capability, pin: "Incorrect-synthetic", pinValidated: true }, checked.context, "consumer_claim_ownership");
  assert.deepEqual(result, { ok: false, status: 403, error: "invalid_pin", freshTapRequired: true });
  assert.equal(statements.filter(q => /INSERT INTO sun_rate_limit_buckets/.test(q.query)).length, 3); assert.equal(writes.length, 0);
  assert.equal(statements.filter(q => /UPDATE sun_rate_limit_buckets/.test(q.query)).length, 0);
}));
test("PIN budget service failure after consume remains fresh-required with no authorization", async () => fixture({ rateUnavailable: true }, async ({ req, capability, precheck, writes }) => {
  const result = await policy.consumeAndAuthorizeConsumerOwnershipClaim(req, { fresh_token: capability, pin }, (await precheck()).context, "consumer_claim_ownership");
  assert.deepEqual(result, { ok: false, status: 503, error: "claim_pin_security_unavailable", freshTapRequired: true }); assert.equal(writes.length, 0);
}));
test("a forged proof or trustSnapshot success flag cannot cause ANY core SQL", async () => fixture({}, async ({ writes, statements }) => {
  const result = await policy.commitConsumerOwnershipClaim({ consumerId: verticalConsumerId, eventId: "900001", authorization: { kind: "consumer-ownership-claim" }, trustSnapshot: { pinValidated: true, posValidated: true } });
  assert.equal(result.error, "claim_context_required"); assert.equal(statements.length, 0); assert.equal(writes.length, 0);
}));
async function authorizeFixture({ req, capability, precheck, authority }, scope = "consumer_claim_ownership") {
  const checked = await precheck(); assert.equal(checked.ok, true);
  const result = await authority.consumeAndAuthorizeConsumerOwnershipClaim(req, { fresh_token: capability, pin }, checked.context, scope);
  assert.equal(result.ok, true); return result;
}
test("real synthetic PIN issues a consumer-bound proof; unissued/mismatched/reused calls write nothing", async () => fixture({}, async state => {
  const authorized = await authorizeFixture(state);
  const input = { consumerId: verticalConsumerId, eventId: "900001", authorization: authorized.authorization, source: "sun_passport" };
  for (const override of [{ consumerId: "20000000-0000-4000-8000-000000000099" }, { eventId: "900003" }, { bid: "foreign" }, { uidHex: "04FFFF" }, { source: "admin" }]) {
    assert.equal((await policy.commitConsumerOwnershipClaim({ ...input, ...override })).error, "claim_context_required"); assert.equal(state.writes.length, 0);
  }
  assert.equal((await policy.commitConsumerOwnershipClaim(input)).ok, true); assert.equal(state.writes.length, 1);
  assert.equal((await policy.commitConsumerOwnershipClaim(input)).error, "claim_context_required"); assert.equal(state.writes.length, 1);
}));
test("statement inspection: core CTE contains snapshot locks, expiry/conflict checks and incomplete-core fence (not PG rollback evidence)", async () => fixture({}, async state => {
  const authorized = await authorizeFixture(state);
  assert.equal((await policy.commitConsumerOwnershipClaim({ consumerId: verticalConsumerId, eventId: "900001", authorization: authorized.authorization })).ok, true);
  const q = state.writes[0].query;
  assert.match(q, /to_jsonb\(b\) = \$\d+::jsonb/); assert.match(q, /FOR SHARE OF e, b, tenant, tag/);
  assert.match(q, /locked_pos[\s\S]*to_jsonb\(activation\)[\s\S]*FOR SHARE OF activation/);
  assert.match(q, /to_timestamp\(\$\d+\) > clock_timestamp\(\)/); assert.match(q, /expires_at > clock_timestamp\(\)/);
  assert.match(q, /locked_ownership[\s\S]*FOR UPDATE OF ownership/); assert.match(q, /NOT EXISTS \(SELECT 1 FROM locked_ownership WHERE status = 'claimed'/);
  for (const table of ["consumer_product_ownerships", "tenant_consumer_memberships", "consumer_tap_history", "consumer_products"]) assert.match(q, new RegExp(`INSERT INTO ${table}`));
  assert.match(q, /1 \/ CASE WHEN EXISTS\(SELECT 1 FROM associated\)[\s\S]*THEN 1 ELSE 0 END AS core_commit_fence/);
}));
test("stale policy returns no title; statement failure is never converted into a saved title", async () => {
  await fixture({ noWrite: true }, async state => { const proof = await authorizeFixture(state);
    assert.deepEqual(await policy.commitConsumerOwnershipClaim({ consumerId: verticalConsumerId, eventId: "900001", authorization: proof.authorization }), { ok: false, status: 409, error: "claim_policy_changed" }); });
  await fixture({ writeError: Object.assign(new Error("synthetic rollback"), { code: "23514" }) }, async state => { const proof = await authorizeFixture(state);
    await assert.rejects(policy.commitConsumerOwnershipClaim({ consumerId: verticalConsumerId, eventId: "900001", authorization: proof.authorization }), /synthetic rollback/); });
});
test("public and mobile guesses consume their DISTINCT existing action scopes; no global single-guess claim", async () => fixture({}, async state => {
  for (const scope of ["consumer_claim_ownership", "public_claim_ownership"]) await authorizeFixture(state, scope);
  const consumed = state.statements.filter(q => /INSERT INTO sun_rate_limit_buckets/.test(q.query) && q.values[1] === "sun_fresh_capability_once");
  assert.equal(consumed.length, 2); assert.notEqual(consumed[0].values[2], consumed[1].values[2]);
}));
test("purchase-proof review never issues title authorization even after a valid PIN", async () => {
  const f = claimFixture(); f.snapshot.profile.ownership_policy.requiresPurchaseProof = true;
  await fixture({ f, review: true }, async state => { const checked = await state.precheck(); assert.equal(checked.context.reviewRequired, true);
    const result = await policy.consumeAndAuthorizeConsumerOwnershipClaim(state.req, { fresh_token: state.capability, pin }, checked.context, "public_claim_ownership");
    assert.equal(result.ok, true); assert.equal(result.reviewRequired, true); assert.equal(result.authorization, null); assert.equal(state.writes.length, 0); });
});

async function loadService(publish, authority = policy) {
  const source = await readFile(new URL("../src/lib/consumer-portal-service.ts", import.meta.url), "utf8");
  const exports = {}, compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const deps = { db: {}, "consumer-vertical-writer-policy": authority, "loyalty-service": {}, "commercial-runtime-schema": {},
    "canonical-event-writer": { writeCanonicalEvent: publish, CanonicalEventWriteError: class extends Error {} }, "tap-commercial-rights": {},
    "realtime-tap-projection": { publishTenantTapRealtimeProjection: async () => ({ projected: true, distributed: true }) } };
  new Function("require", "exports", compiled)(key => deps[key.split("/").pop()] || {}, exports); return exports.claimOwnershipForConsumer;
}
test("publisher failure AFTER confirmed core preserves original title/operationCommitted and never replays core", async () => fixture({}, async state => {
  const authorized = await authorizeFixture(state), publications = [];
  const service = await loadService(async input => { publications.push(input); throw new Error("Synthetic publisher failure"); });
  const input = { consumerId: verticalConsumerId, eventId: "900001", source: "sun_passport", authorization: authorized.authorization };
  const result = await service(input); assert.equal(result.ok, false); assert.equal(result.operationCommitted, true); assert.equal(result.ownership.status, "claimed");
  assert.equal(result.ownership.record_scope, "nexid_off_chain_digital_title"); assert.equal(result.ownership.nft_transfer_executed, false);
  assert.equal(publications[0].referenceEventId, "900001"); assert.equal(publications[0].batchId, state.f.snapshot.batch.id); assert.equal(publications[0].uidHex, state.f.snapshot.event.uid_hex);
  assert.equal(publications[0].operationKey, `ownership:${result.ownership.id}:activated`); assert.deepEqual(publications[0].meta, { source: "sun_passport", source_event_id: "900001" });
  assert.equal((await service(input)).error, "claim_context_required"); assert.equal(state.writes.length, 1); assert.equal(publications.length, 1);
}));

// Execute the actual TypeScript module, while replacing only the explicitly
// listed boundary dependencies. Relative imports otherwise load real source.
async function loadSource(relativePath, overrides = {}) {
  const url = new URL(relativePath, import.meta.url), source = await readFile(url, "utf8"), require = createRequire(url);
  const exports = {}, compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", compiled)(key => Object.prototype.hasOwnProperty.call(overrides, key)
    ? overrides[key] : require(key.startsWith(".") ? `${key}.ts` : key), exports);
  return exports;
}
async function failingKdfAuthority() {
  // The real PIN module parses and runs the KDF path. Only node:crypto's
  // operational callback fails; no caller success flag or fake proof is used.
  const pinSource = await loadSource("../src/lib/ownership-claim-pin.ts", {
    "node:crypto": { ...crypto, scrypt: (_secret, _salt, _length, _options, callback) => callback(new Error("Synthetic KDF unavailable")) },
  });
  return loadSource("../src/lib/consumer-vertical-writer-policy.ts", { "./ownership-claim-pin": pinSource });
}
function scryptFixture() {
  const f = claimFixture();
  f.snapshot.batch.hash_pin = ["nexid-claim-pin", "v1", "scrypt", "N=16384", "r=8", "p=1", "dk=32", "maxmem=33554432", "scope=batch",
    Buffer.alloc(16, 7).toString("base64url"), Buffer.alloc(32, 9).toString("base64url")].join("$");
  return f;
}
test("actual KDF operational exception releases only PIN leases, never restores the consumed scope or issues proof", async () => {
  const authority = await failingKdfAuthority();
  await fixture({ f: scryptFixture(), authority }, async state => {
    const checked = await state.precheck(); assert.equal(checked.ok, true);
    const result = await authority.consumeAndAuthorizeConsumerOwnershipClaim(state.req, { fresh_token: state.capability, pin }, checked.context, "consumer_claim_ownership");
    assert.deepEqual(result, { ok: false, status: 503, error: "claim_pin_security_unavailable", freshTapRequired: true });
    assert.equal("authorization" in result, false); assert.equal(state.writes.length, 0);
    const updates = state.statements.filter(q => /UPDATE sun_rate_limit_buckets/.test(q.query));
    assert.equal(updates.length, 1); const leases = JSON.parse(updates[0].values[0]);
    assert.deepEqual(leases.map(lease => lease.scope).sort(), ["claim_pin_device", "claim_pin_product"]);
    const repeated = await authority.consumeAndAuthorizeConsumerOwnershipClaim(state.req, { fresh_token: state.capability, pin }, checked.context, "consumer_claim_ownership");
    assert.equal(repeated.error, "fresh_physical_tap_required_for_ownership"); assert.equal(repeated.freshTapRequired, true);
    assert.equal(state.statements.filter(q => /UPDATE sun_rate_limit_buckets/.test(q.query)).length, 1);
  });
});

async function loadRoute(kind, state, options = {}) {
  const publications = [], calls = [], middleware = { authReads: 0, schemaInitializations: 0 };
  const publish = async input => { publications.push(input); if (options.publisherFails) throw new Error("Synthetic canonical publisher failure");
    return { eventId: "synthetic-canonical", webhookOutbox: { queued: true } }; };
  const realService = await loadService(publish, state.authority);
  const service = async input => { calls.push(input); return realService(input); };
  const prefix = kind === "mobile" ? "../../../../../../lib/" : "../../../../lib/";
  const overrides = {
    [`${prefix}consumer-auth`]: { getConsumerFromRequest: async () => { middleware.authReads++; return options.unauthenticated ? null : { id: verticalConsumerId }; } },
    [`${prefix}critical-rate-limit`]: { enforceCriticalRateLimit: async () => null },
    [`${prefix}consumer-vertical-writer-policy`]: state.authority,
    [`${prefix}consumer-portal-service`]: { claimOwnershipForConsumer: service },
    [`${prefix}commercial-runtime-schema`]: { ensureConsumerPortalSchema: async () => { middleware.schemaInitializations++; }, ensureSdkSchema: async () => { throw new Error("Unexpected review initializer"); } },
    [`${prefix}alert-engine`]: { createAlert: async () => { throw new Error("Unexpected synthetic alert"); } },
    [`${prefix}ocr-service`]: { performReceiptOcr: async () => { throw new Error("Unexpected OCR provider"); } },
  };
  const route = await loadSource(kind === "mobile" ? "../src/app/mobile/passport/[eventId]/consumer/claim/route.ts" : "../src/app/public/cta/claim-ownership/route.ts", overrides);
  const request = (extra = {}) => {
    const body = { event_id: String(state.f.snapshot.event.id), bid: state.f.snapshot.batch.bid, uid: state.f.snapshot.event.uid_hex,
      fresh_token: state.capability, pin, ...extra };
    const share = createDemoShareToken({ bid: body.bid, uid: `EVENT-${state.f.snapshot.event.id}`, exp: Math.floor(Date.now() / 1000) + 300 });
    return new Request("https://synthetic.invalid/claim", { method: "POST", headers: { "content-type": "application/json", "user-agent": "Synthetic Android", "x-demo-share-token": share }, body: JSON.stringify(body) });
  };
  return { calls, publications, middleware, request, run: extra => route.POST(request(extra), { params: Promise.resolve({ eventId: String(state.f.snapshot.event.id) }) }) };
}
for (const kind of ["mobile", "public"]) {
  test(`${kind} real route forwards the issued proof into the real service and records the authoritative core`, async () => fixture({}, async state => {
    const route = await loadRoute(kind, state), response = await route.run(); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.ok, true); assert.equal(body.ownership.status, "claimed");
    assert.equal(route.calls.length, 1); assert.equal(route.calls[0].consumerId, verticalConsumerId); assert.equal(route.calls[0].eventId, "900001");
    assert.ok(route.calls[0].authorization); assert.equal(route.calls[0].authorization.kind, "consumer-ownership-claim");
    assert.equal(state.writes.length, 1); assert.equal(route.publications.length, 1);
    assert.equal(body.nft_transfer_executed, false); assert.equal(body.on_chain_owner_verified, false);
  }));
  test(`${kind} real route missing PIN stays retryable without consumption; the same capability can then authorize with PIN`, async () => fixture({}, async state => {
    const route = await loadRoute(kind, state), first = await route.run({ pin: undefined }), body = await first.json();
    assert.equal(first.status, 403); assert.equal(body.error, "pin_required"); assert.equal(body.fresh_tap_required, false);
    assert.equal(route.calls.length, 0); assert.equal(state.statements.filter(q => /INSERT INTO sun_rate_limit_buckets/.test(q.query)).length, 0);
    const next = await route.run(); assert.equal(next.status, 200); assert.equal(state.writes.length, 1);
  }));
  test(`${kind} real route rejects an incorrect PIN and a second POST cannot bypass the spent scope`, async () => fixture({}, async state => {
    const route = await loadRoute(kind, state), first = await route.run({ pin: "Incorrect-synthetic", pinValidated: true, posValidated: true });
    const body = await first.json(); assert.equal(first.status, 403); assert.equal(body.error, "invalid_pin"); assert.equal(body.fresh_tap_required, true);
    assert.equal(route.calls.length, 0); assert.equal(state.writes.length, 0);
    assert.equal(state.statements.filter(q => /UPDATE sun_rate_limit_buckets/.test(q.query)).length, 0);
    const repeated = await route.run(); assert.equal(repeated.status, 403); assert.equal((await repeated.json()).fresh_tap_required, true);
    assert.equal(state.writes.length, 0);
  }));
  test(`${kind} real route durable PIN lock preserves retry body/header while the same TAP remains spent`, async () => fixture({ rateLocked: true }, async state => {
    const route = await loadRoute(kind, state), first = await route.run(), body = await first.json();
    assert.equal(first.status, 429); assert.equal(body.reason, "claim_pin_locked");
    assert.equal(body.error, kind === "public" ? "Demasiados intentos. Espera 15 minutos o solicita asistencia al emisor." : "claim_pin_locked");
    assert.equal(body.retry_after_seconds, 900); assert.equal(first.headers.get("retry-after"), "900");
    assert.equal(first.headers.get("cache-control"), "no-store"); assert.equal(body.fresh_tap_required, true);
    assert.equal(route.calls.length, 0); assert.equal(state.writes.length, 0); assert.equal(route.publications.length, 0);
    const reservations = () => state.statements.filter(q => /INSERT INTO sun_rate_limit_buckets/.test(q.query));
    assert.deepEqual(reservations().map(q => q.values[1]).sort(), ["claim_pin_device", "claim_pin_product", "sun_fresh_capability_once"]);
    const capabilityReservation = reservations().find(q => q.values[1] === "sun_fresh_capability_once");
    const expectedAction = kind === "public" ? "public_claim_ownership" : "consumer_claim_ownership";
    const exactBucket = rateLimitBucketKey("sun_fresh_capability_once", `${expectedAction}:${createHash("sha256").update(state.capability).digest("hex")}`);
    assert.equal(capabilityReservation.values[2], exactBucket.scopeKeyHash);
    assert.equal(state.statements.filter(q => /UPDATE sun_rate_limit_buckets/.test(q.query)).length, 0);
    const repeated = await route.run(), repeatedBody = await repeated.json();
    assert.equal(repeated.status, 403); assert.equal(repeatedBody.fresh_tap_required, true);
    assert.equal(repeated.headers.get("retry-after"), null); assert.equal(Object.hasOwn(repeatedBody, "retry_after_seconds"), false);
    assert.equal(reservations().filter(q => q.values[1] !== "sun_fresh_capability_once").length, 2);
    assert.equal(route.calls.length, 0); assert.equal(state.writes.length, 0); assert.equal(route.publications.length, 0);
  }));
  test(`${kind} real route KDF exception stays503/fresh-required and releases only failure-budget leases`, async () => {
    const authority = await failingKdfAuthority();
    await fixture({ f: scryptFixture(), authority }, async state => {
      const route = await loadRoute(kind, state), response = await route.run(), body = await response.json();
      assert.equal(response.status, 503); assert.equal(body.error, "claim_pin_security_unavailable"); assert.equal(body.fresh_tap_required, true);
      assert.equal(route.calls.length, 0); assert.equal(state.writes.length, 0);
      const update = state.statements.find(q => /UPDATE sun_rate_limit_buckets/.test(q.query));
      assert.deepEqual(JSON.parse(update.values[0]).map(lease => lease.scope).sort(), ["claim_pin_device", "claim_pin_product"]);
    });
  });
  for (const receipt of [null, [], { status: "pending" }]) test(`${kind} real route malformed single core receipt (${JSON.stringify(receipt)}) keeps operation_committed and blocks another POST`, async () => fixture({ receipt }, async state => {
    const route = await loadRoute(kind, state), response = await route.run(), body = await response.json();
    assert.equal(response.status, 503); assert.equal(body.error || body.reason, "ownership_receipt_unavailable");
    assert.equal(body.operation_committed, true); assert.equal(body.fresh_tap_required, false); assert.equal(body.ownership, null);
    assert.equal(state.writes.length, 1); assert.equal(route.publications.length, 0);
    const repeated = await route.run(); assert.equal(repeated.status, 403); assert.equal(state.writes.length, 1);
  }));
  test(`${kind} real route canonical publication failure preserves the committed title and never repeats core`, async () => fixture({}, async state => {
    const route = await loadRoute(kind, state, { publisherFails: true }), response = await route.run(), body = await response.json();
    assert.equal(response.status, 503); assert.equal(body.operation_committed, true); assert.equal(body.fresh_tap_required, false);
    assert.equal(body.ownership.status, "claimed"); assert.equal(body.ownership.nft_transfer_executed, false);
    assert.equal(route.publications[0].referenceEventId, "900001"); assert.equal(route.publications[0].batchId, state.f.snapshot.batch.id);
    assert.deepEqual(route.publications[0].meta, { source: "sun_passport", source_event_id: "900001" });
    const repeated = await route.run(); assert.equal(repeated.status, 403); assert.equal(state.writes.length, 1); assert.equal(route.publications.length, 1);
  }));
  test(`${kind} real route normal consumer authentication failure performs no capability consumption or core write`, async () => fixture({}, async state => {
    const route = await loadRoute(kind, state, { unauthenticated: true }), response = await route.run();
    assert.equal(response.status, 401); assert.equal(state.writes.length, 0); assert.equal(route.calls.length, 0);
    assert.equal(state.statements.filter(q => /INSERT INTO sun_rate_limit_buckets/.test(q.query)).length, 0);
  }));
}
for (const [key, value] of [["tenantId", {}], ["tenant_id", []], ["tenantSlug", false], ["tenant_slug", 42], ["tenant", null], ["bid", {}]]) {
  test(`mobile real route rejects non-string ${key} even with a valid alias before any context read or consume`, async () => fixture({}, async state => {
    const route = await loadRoute("mobile", state), response = await route.run({ tenantId: state.f.snapshot.tenant.id, [key]: value }), body = await response.json();
    assert.equal(response.status, 400); assert.equal(body.error, "invalid_context"); assert.equal(body.fresh_tap_required, false);
    assert.equal(state.statements.length, 0); assert.equal(state.writes.length, 0); assert.equal(route.calls.length, 0);
  }));
}

// R7 proposal: actual route/issuer dependencies, synthetic relation SELECT only.
for (const kind of ["mobile", "public"]) for (const recordedStatus of ["revoked", "disputed", "blocked_replay"]) test(`${kind}: same consumer/TAP ${recordedStatus} record denies before consume, PIN budget, proof or core`, async () => fixture({ relations: { claim_record_exists: true } }, async state => {
  const route = await loadRoute(kind, state), response = await route.run(), body = await response.json();
  assert.equal(response.status, 403); assert.equal(body.error || body.reason, "tap_action_not_allowed"); assert.equal(body.fresh_tap_required, false);
  assert.equal(route.calls.length, 0); assert.equal(route.publications.length, 0); assert.equal(state.writes.length, 0);
  assert.ok(state.statements.every(q => !/\b(?:INSERT|UPDATE|DELETE)\b/.test(q.query)));
  const relation = state.statements.find(q => /AS claim_record_exists/.test(q.query));
  const match = relation.query.match(/recorded\.tenant_id = \$(\d+)::uuid[\s\S]*?recorded\.consumer_id = \$(\d+)::uuid AND recorded\.event_id = \$(\d+)::bigint/);
  assert.ok(match);
  assert.deepEqual(match.slice(1).map(index => relation.values[Number(index) - 1]), [state.f.snapshot.event.tenant_id, verticalConsumerId, "900001"]);
  assert.doesNotMatch(match[0], /recorded\.status|recorded\.uid_hex/);
}));
for (const value of [undefined, null, "false", "true", 0, 1]) test(`context claim_record_exists ${JSON.stringify(value)} is unavailable before issuer/consume`, async () => fixture({ relations: { claim_record_exists: value } }, async state => {
  assert.deepEqual(await state.precheck(), { ok: false, error: "tap_policy_unavailable" });
  assert.equal(state.writes.length, 0); assert.ok(state.statements.every(q => !/\b(?:INSERT|UPDATE|DELETE)\b/.test(q.query)));
}));
test("shared resolver preserves claimed reason priority and distinct recorded-attempt denial", () => {
  assert.deepEqual(policy.evaluateConsumerOwnershipClaimAttempt(claimFixture(), { ...relations, ownershipClaimed: true, claimRecordExists: true }), { ok: false, error: "ownership_already_claimed" });
  assert.deepEqual(policy.evaluateConsumerOwnershipClaimAttempt(claimFixture(), { ...relations, claimRecordExists: true }), { ok: false, error: "tap_action_not_allowed" });
});
