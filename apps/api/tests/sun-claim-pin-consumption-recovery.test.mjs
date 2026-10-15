import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const ts = createRequire(import.meta.url)("typescript");
const sourceRoot = new URL("../src/", import.meta.url);
function loadSource(relative, dependencies = {}, runtimeProcess = process) {
  const source = readFileSync(new URL(relative, sourceRoot), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", code)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports, runtimeProcess);
  return module.exports;
}

// The real mobile handler, PIN input parser, tenant matcher and authorization
// helper execute. Authentication, fresh-capability reservation, SQL and PIN
// infrastructure are explicit synthetic dependencies, never real DB, NFC or
// provider evidence. The one policy normalizer fixture admits only the policy
// named below; these tests do not establish other tenant policies or custody.
const { json } = loadSource("lib/http.ts");
const pinModule = loadSource("lib/ownership-claim-pin.ts", { "node:crypto": crypto });
const ownershipPolicy = loadSource("lib/ownership-policy.ts", {
  "./tap-commercial-rights": { evaluateTapCommercialRights: () => assert.fail("Not used by the tenant matcher") },
});
const authorization = loadSource("lib/ownership-claim-authorization.ts", {
  "./sun-tenant-profile": { normalizeClaimPolicy(value) {
    assert.equal(value, "inside_pack_secret");
    return value;
  } },
});

const event = Object.freeze({
  id: "900001", tenant_id: "10000000-0000-4000-8000-000000000001",
  batch_id: "10000000-0000-4000-8000-000000000002", tenant_slug: "synthetic-brand",
  bid: "SYNTHETIC-BATCH", uid_hex: "04AABBCCDD0011", sdm_read_ctr: 12,
  result: "VALID_CLOSED",
  current_tag_id: "30000000-0000-4000-8000-000000000001",
  current_tag_revision: "721",
});
const consumer = Object.freeze({ id: "20000000-0000-4000-8000-000000000001" });
const syntheticPin = "Synthetic-Claim-Code!2026";
const storedHash = "a".repeat(64);
const lockWindowSeconds = 900;
const routePath = "app/mobile/passport/[eventId]/consumer/claim/route.ts";

function fixture(configuration = {}) {
  const calls = [];
  const attempt = Object.freeze({ key: "synthetic-pin-attempt" });
  const title = Object.freeze({ status: "claimed", record_scope: "nexid_off_chain_digital_title" });
  const namespace = "../../../../../../lib/";
  class RequestBodyTooLargeError extends Error {}
  const dependencies = {
    [namespace + "http"]: { json },
    [namespace + "consumer-auth"]: { getConsumerFromRequest: async () => configuration.unauthorized ? null : consumer },
    [namespace + "critical-rate-limit"]: { enforceCriticalRateLimit: async () => configuration.rateUnavailable
      ? json({ ok: false, error: "synthetic_preconsume_rate_unavailable" }, 503) : null },
    [namespace + "bounded-request-body"]: { RequestBodyTooLargeError, readBoundedJsonBody: req => req.json() },
    [namespace + "loyalty-service"]: { getTapEvent: async () => configuration.eventMissing ? null : event },
    [namespace + "ownership-policy"]: ownershipPolicy,
    [namespace + "commercial-runtime-schema"]: { ensureConsumerPortalSchema: async () => {}, ensureSdkSchema: async () => {} },
    [namespace + "sun-fresh-handoff"]: { consumeSunFreshHandoff: async (_req, body, expected, action) => {
      calls.push("consume");
      assert.equal(action, "consumer_claim_ownership");
      assert.deepEqual(expected, { eventId: event.id, bid: event.bid, uidHex: event.uid_hex, readCounter: event.sdm_read_ctr });
      assert.equal(body.bid, event.bid);
      return configuration.consumeDenied ? { ok: false, reason: "fresh_token_consume_unavailable" }
        : { ok: true, payload: { exp: 2_000_000_000 } };
    } },
    [namespace + "db"]: { sql: async (strings, ...values) => {
      calls.push("policy");
      assert.match(strings.join("?"), /SELECT[\s\S]*FROM tags t[\s\S]*JOIN batches b/);
      assert.deepEqual(values, [event.batch_id, event.tenant_id, event.uid_hex]);
      return [{ tag_id: "30000000-0000-4000-8000-000000000001", tag_claim_pin_required: true,
        tag_hash_pin: storedHash, tag_active_for_claim: true,
        tag_row_revision: "721", batch_row_revision: "722",
        tenant_policy_revision: configuration.profileMissing ? null : "723",
        batch_sdm_config: configuration.posRequired ? { pos_required: true } : {},
        tenant_claim_policy: "inside_pack_secret", retailer_pos_attested: configuration.posRequired === true }];
    } },
    [namespace + "ownership-claim-authorization"]: authorization,
    [namespace + "ownership-claim-pin"]: { ...pinModule, verifyOwnershipClaimPin: async input => {
      calls.push("verify");
      assert.deepEqual(input, { storedHash, pin: syntheticPin,
        context: { tenantId: event.tenant_id, bid: event.bid, uidHex: event.uid_hex } });
      if (configuration.verifyThrows) throw Error("synthetic_pin_verification_unavailable");
      return { matches: configuration.invalidPin !== true, algorithm: "legacy-sha256-raw", needsRotation: true };
    } },
    [namespace + "ownership-claim-pin-rate-limit"]: {
      OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS: lockWindowSeconds,
      reserveOwnershipClaimPinAttempt: async (_req, scope) => {
        calls.push("reserve");
        assert.deepEqual(scope, { tenantId: event.tenant_id, bid: event.bid, uidHex: event.uid_hex,
          sourceId: `consumer:${consumer.id}`, credentialScope: pinModule.ownershipClaimPinRateScope(storedHash) });
        return configuration.reserveUnavailable ? { status: "unavailable" }
          : configuration.locked ? { status: "locked" } : { status: "reserved", attempt };
      },
      releaseSuccessfulOwnershipClaimPinAttempt: async received => {
        calls.push("release");
        assert.equal(received, attempt);
        return { status: configuration.releaseUnavailable ? "unavailable" : "released" };
      },
    },
    [namespace + "consumer-portal-service"]: { claimOwnershipForConsumer: async input => {
      calls.push("claim");
      assert.equal(input.consumerId, consumer.id);
      assert.equal(input.eventId, event.id);
      assert.deepEqual(input.expected, {
        tenantId: event.tenant_id, batchId: event.batch_id, bid: event.bid,
        uidHex: event.uid_hex, readCounter: event.sdm_read_ctr,
        tagId: event.current_tag_id, tagRevision: event.current_tag_revision,
      });
      assert.deepEqual(input.authorization, {
        tagRevision: "721", batchRevision: "722",
        tenantPolicyRevision: configuration.profileMissing ? null : "723",
        posRequired: configuration.posRequired === true,
      });
      assert.equal(Object.hasOwn(input.authorization, "pin"), false);
      if (configuration.claimThrows) throw Error("synthetic_writer_response_lost");
      if (configuration.committed) return { ok: false, status: 503, error: "canonical_event_write_unavailable",
        operationCommitted: true, ownership: title };
      return { ok: true, ownership: title, canonicalEvent: { webhookOutbox: { status: "queued" } } };
    } },
  };
  const { POST } = loadSource(routePath, dependencies);
  return {
    calls,
    async request() {
      const body = configuration.body || { bid: event.bid, tenantSlug: event.tenant_slug, pin: syntheticPin };
      const request = new Request("http://127.0.0.1/mobile/passport/900001/consumer/claim", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const response = await POST(request, { params: Promise.resolve({ eventId: event.id }) });
      return { response, body: await response.json() };
    },
  };
}

for (const [label, configuration, expectedCalls] of [
  ["reservation unavailable", { reserveUnavailable: true }, ["consume", "policy", "reserve"]],
  ["verification throws", { verifyThrows: true }, ["consume", "policy", "reserve", "verify", "release"]],
  ["successful-attempt release unavailable", { releaseUnavailable: true }, ["consume", "policy", "reserve", "verify", "release"]],
]) {
  test(`claim PIN ${label}: known consumed action requests another TAP and never calls the writer`, async () => {
    const f = fixture(configuration), { response, body } = await f.request();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(body, { ok: false, error: "claim_pin_security_unavailable",
      reason: "claim_pin_security_unavailable", fresh_tap_required: true });
    assert.equal(Object.hasOwn(body, "fresh_tap_required"), true);
    assert.equal(Object.hasOwn(body, "operation_committed"), false);
    assert.deepEqual(f.calls, expectedCalls, "one explicit handler request has exactly one consume and no hidden retries");
  });
}

test("pre-consumption claim failures do not invent a consumed marker or invoke PIN infrastructure", async () => {
  for (const [configuration, status] of [
    [{ unauthorized: true }, 401], [{ rateUnavailable: true }, 503], [{ eventMissing: true }, 404],
    [{ body: { bid: event.bid, tenantSlug: event.tenant_slug, pin: "BAD CODE" } }, 400],
    [{ body: { bid: event.bid, tenantSlug: "different-brand", pin: syntheticPin } }, 403],
  ]) {
    const f = fixture(configuration), { response, body } = await f.request();
    assert.equal(response.status, status);
    assert.equal(Object.hasOwn(body, "fresh_tap_required"), false);
    assert.equal(Object.hasOwn(body, "operation_committed"), false);
    assert.deepEqual(f.calls, []);
  }
});

test("refused capability preserves its existing response without PIN work or a post-consumption marker", async () => {
  const f = fixture({ consumeDenied: true }), { response, body } = await f.request();
  assert.equal(response.status, 403);
  assert.deepEqual(body, { ok: false, error: "fresh_physical_tap_required_for_ownership",
    reason: "fresh_physical_tap_required_for_ownership", fresh_token_status: "fresh_token_consume_unavailable" });
  assert.deepEqual(f.calls, ["consume"]);
});

test("required, invalid and locked PIN outcomes keep their existing payloads and lock window", async () => {
  for (const [configuration, status, error, expectedCalls] of [
    [{ body: { bid: event.bid, tenantSlug: event.tenant_slug } }, 400, "pin_required", ["consume", "policy"]],
    [{ invalidPin: true }, 403, "invalid_pin", ["consume", "policy", "reserve", "verify"]],
    [{ locked: true }, 429, "claim_pin_locked", ["consume", "policy", "reserve"]],
  ]) {
    const f = fixture(configuration), { response, body } = await f.request();
    assert.equal(response.status, status);
    assert.deepEqual(body, { ok: false, error, reason: error,
      ...(configuration.locked ? { retry_after_seconds: lockWindowSeconds } : {}) });
    assert.equal(response.headers.get("cache-control"), "no-store");
    if (configuration.locked) assert.equal(response.headers.get("retry-after"), String(lockWindowSeconds));
    assert.deepEqual(f.calls, expectedCalls);
  }
});

test("a committed ownership failure retains its positive committed signal without a fresh-action marker", async () => {
  const f = fixture({ committed: true }), { response, body } = await f.request();
  assert.equal(response.status, 503);
  assert.deepEqual(body, { ok: false, error: "canonical_event_write_unavailable",
    ownership: { status: "claimed", record_scope: "nexid_off_chain_digital_title" }, operation_committed: true });
  assert.equal(Object.hasOwn(body, "fresh_tap_required"), false);
  assert.deepEqual(f.calls, ["consume", "policy", "reserve", "verify", "release", "claim"]);
});

test("a complete positive ownership receipt does not request another TAP or grant chain transfer", async () => {
  const f = fixture(), { response, body } = await f.request();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.eventId, event.id);
  assert.equal(body.ownership_scope, "nexid_off_chain_digital_title");
  assert.equal(body.nft_transfer_executed, false);
  assert.equal(body.on_chain_owner_verified, false);
  assert.equal(Object.hasOwn(body, "fresh_tap_required"), false);
  assert.equal(Object.hasOwn(body, "operation_committed"), false);
  assert.deepEqual(f.calls, ["consume", "policy", "reserve", "verify", "release", "claim"]);
});


test("mobile claim binds the core to server event and policy revisions, ignoring body authority", async () => {
  for (const configuration of [{}, { profileMissing: true, posRequired: true }]) {
    const f = fixture({ ...configuration, body: {
      bid: event.bid, tenantSlug: event.tenant_slug, pin: syntheticPin,
      expected: { tenantId: "caller-tenant", tagRevision: "999", readCounter: 999 },
      authorization: { tagRevision: "999", batchRevision: "999", tenantPolicyRevision: "999", posRequired: false },
    } });
    const { response, body } = await f.request();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(f.calls, ["consume", "policy", "reserve", "verify", "release", "claim"]);
  }
});

test("mobile claim core uncertainty requests a fresh action without inventing a commit outcome", async () => {
  const f = fixture({ claimThrows: true }), { response, body } = await f.request();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(body, { ok: false, error: "consumer_ownership_claim_unavailable",
    reason: "consumer_ownership_claim_unavailable", fresh_tap_required: true });
  assert.equal(Object.hasOwn(body, "operation_committed"), false);
  assert.deepEqual(f.calls, ["consume", "policy", "reserve", "verify", "release", "claim"]);
});

// Public handler and the real HMAC verifier run with a local synthetic secret.
// Its rate store is a ledger-only dependency; no real DB, secrets, NFC or provider.
function publicFixture(configuration = {}) {
  const calls = [], counts = { consume: 0, freshReservations: 0, core: 0 };
  const namespace = "../../../../lib/";
  const serverEvent = { ...event, sdm_read_ctr: Object.hasOwn(configuration, "persistedCounter")
    ? configuration.persistedCounter : event.sdm_read_ctr };
  const freshModule = loadSource("lib/sun-fresh-handoff.ts", {
    "node:crypto": crypto,
    "./sun-rate-limit-store": { hitSunRateLimit: async () => {
      counts.freshReservations += 1;
      return { limited: false, unavailable: false };
    } },
  }, { env: { SUN_HANDOFF_SECRET: "synthetic-public-claim-binding-only-secret" } });
  const token = freshModule.createSunFreshHandoffToken({
    bid: event.bid, eventId: event.id, diagnosticId: 7, traceId: "synthetic-public-claim",
    exp: Math.floor(Date.now() / 1000) + 60,
    uidHex: Object.hasOwn(configuration, "signedUid") ? configuration.signedUid : event.uid_hex,
    readCounter: Object.hasOwn(configuration, "signedCounter") ? configuration.signedCounter : event.sdm_read_ctr,
  });
  class RequestBodyTooLargeError extends Error {}
  const title = { status: "claimed", record_scope: "nexid_off_chain_digital_title" };
  const dependencies = {
    "node:crypto": crypto,
    [namespace + "http"]: { json },
    [namespace + "critical-rate-limit"]: { enforceCriticalRateLimit: async () => null },
    [namespace + "bounded-request-body"]: { RequestBodyTooLargeError, readBoundedJsonBody: req => req.json() },
    [namespace + "public-cta-target"]: { resolvePublicCtaTarget: async () => {
      calls.push("target");
      return { ok: true, bid: event.bid, uid: event.uid_hex, eventId: event.id, shareUid: "EVENT-" + event.id };
    } },
    [namespace + "public-cta-auth"]: { requireShareToken: () => {
      calls.push("share");
      return configuration.shareDenied ? { ok: false, reason: "synthetic_share_denied", share_token_status: "denied" }
        : { ok: true, share_token_status: "accepted" };
    } },
    [namespace + "sun-fresh-handoff"]: {
      consumeSunFreshHandoff: async (req, body, expected, action) => {
        calls.push("consume"); counts.consume += 1;
        assert.deepEqual(expected, { bid: event.bid, eventId: event.id });
        assert.equal(action, "public_claim_ownership");
        return freshModule.consumeSunFreshHandoff(req, body, expected, action);
      },
      requireSunFreshHandoff: (req, body, expected) => {
        calls.push("bind");
        return freshModule.requireSunFreshHandoff(req, body, expected);
      },
    },
    [namespace + "loyalty-service"]: { getTapEvent: async () => {
      calls.push("event"); return configuration.eventMissing ? null : serverEvent;
    } },
    [namespace + "tap-commercial-rights"]: {
      evaluateTapCommercialRights: () => ({ allowed: true }),
      readCurrentTapCommercialRights: async () => ({ allowed: true }),
    },
    [namespace + "db"]: { sql: async (strings) => {
      const query = strings.join("?");
      if (/FROM tags t/.test(query)) {
        calls.push("policy");
        for (const projection of ["t.xmin::text AS tag_row_revision", "b.xmin::text AS batch_row_revision", "tsp.xmin::text AS tenant_policy_revision"])assert.ok(query.includes(projection));
        return [{ tag_id: event.current_tag_id, tag_claim_pin_required: true, tag_hash_pin: storedHash,
          tag_active_for_claim: true, tag_row_revision: "721", batch_row_revision: "722",
          tenant_policy_revision: configuration.profileMissing ? null : "723",
          batch_sdm_config: configuration.posRequired ? { pos_required: true } : {},
          tenant_claim_policy: "inside_pack_secret", retailer_pos_attested: configuration.posRequired === true }];
      }
      assert.match(query, /SELECT sdm_config[\s\S]*FROM batches/);
      calls.push("batch"); return [{ sdm_config: {} }];
    } },
    [namespace + "sun-tenant-profile"]: { normalizeClaimPolicy: value => value === "inside_pack_secret" ? value : null },
    [namespace + "ownership-claim-authorization"]: authorization,
    [namespace + "ownership-claim-pin"]: { ...pinModule, verifyOwnershipClaimPin: async input => {
      calls.push("verify"); assert.equal(input.pin, syntheticPin);
      return { matches: configuration.invalidPin !== true, algorithm: "legacy-sha256-raw", needsRotation: false };
    } },
    [namespace + "ownership-claim-pin-rate-limit"]: {
      OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS: lockWindowSeconds,
      reserveOwnershipClaimPinAttempt: async () => {
        calls.push("reserve"); return configuration.locked ? { status: "locked" } : { status: "allowed", attempt: {} };
      },
      releaseSuccessfulOwnershipClaimPinAttempt: async () => { calls.push("release"); return { status: "released" }; },
    },
    [namespace + "commercial-runtime-schema"]: { ensureConsumerPortalSchema: async () => {}, ensureSdkSchema: async () => {} },
    [namespace + "consumer-auth"]: { getConsumerFromRequest: async () => {
      calls.push("auth"); return configuration.unauthorized ? null : consumer;
    } },
    [namespace + "approximate-location"]: { normalizeConsentedApproximateLocation: () => ({ lat: null, lng: null, accuracy: null, accepted: false, reason: "not_consented" }) },
    [namespace + "alert-engine"]: { createAlert: async () => assert.fail("No risk alert is expected in this synthetic mobile-UA flow") },
    [namespace + "ocr-service"]: {
      evaluateReceiptOcrForOwnership: () => assert.fail("No receipt submitted"),
      performReceiptOcr: async () => assert.fail("No receipt submitted"),
      validateReceiptImageDataUrl: () => assert.fail("No receipt submitted"),
    },
    [namespace + "consumer-portal-service"]: { claimOwnershipForConsumer: async input => {
      calls.push("claim"); counts.core += 1;
      assert.deepEqual(input.expected, { tenantId: event.tenant_id, batchId: event.batch_id, bid: event.bid,
        uidHex: event.uid_hex, readCounter: Number(serverEvent.sdm_read_ctr), tagId: event.current_tag_id, tagRevision: event.current_tag_revision });
      assert.deepEqual(input.authorization, { tagRevision: "721", batchRevision: "722",
        tenantPolicyRevision: configuration.profileMissing ? null : "723", posRequired: configuration.posRequired === true });
      assert.equal(Object.hasOwn(input.authorization, "pin"), false);
      if (configuration.claimThrows) throw Error("synthetic_public_writer_response_lost");
      if (configuration.committed) return { ok: false, status: 503, error: "canonical_event_write_unavailable", operationCommitted: true, ownership: title };
      return { ok: true, ownership: title, canonicalEvent: { webhookOutbox: { status: "queued" } } };
    } },
  };
  const { POST } = loadSource("app/public/cta/claim-ownership/route.ts", dependencies);
  return { calls, counts, async request() {
    const body = { bid: event.bid, event_id: event.id, pin: syntheticPin, fresh_token: token, ...configuration.body };
    const response = await POST(new Request("http://127.0.0.1/public/cta/claim-ownership", {
      method: "POST", headers: { "content-type": "application/json", "user-agent": "Synthetic Android",
        "x-nexid-trace-id": "synthetic-public-claim" }, body: JSON.stringify(body),
    }));
    return { response, body: await response.json() };
  } };
}

test("public claim preserves consume-before-event and binds its core to the signed server identity and revisions", async () => {
  for (const configuration of [{}, { persistedCounter: "12", profileMissing: true, posRequired: true },
    { persistedCounter: 0, signedCounter: 0 }, { persistedCounter: "0", signedCounter: 0 }]) {
    const f = publicFixture({ ...configuration, body: {
      expected: { tenantId: "caller-tenant", readCounter: 999, tagRevision: "999" },
      authorization: { tagRevision: "999", batchRevision: "999", tenantPolicyRevision: "999", posRequired: false },
    } });
    const { response, body } = await f.request();
    assert.equal(response.status, 200);assert.equal(body.ok, true);
    assert.deepEqual(f.counts, { consume: 1, freshReservations: 1, core: 1 });
    assert.deepEqual(f.calls, ["target", "share", "consume", "event", "bind", "policy", "reserve", "verify", "release", "auth", "batch", "claim"]);
  }
});

test("public consumed UID and counter binding failures never reach PIN or the ownership writer", async () => {
  for (const configuration of [
    { signedUid: null }, { signedUid: "04FFFFFFFFFFFF" },
    { signedCounter: null }, { signedCounter: 13 },
    { persistedCounter: null }, { persistedCounter: "" }, { persistedCounter: "012" }, { persistedCounter: true },
    { persistedCounter: "9007199254740992" },
  ]) {
    const f = publicFixture(configuration), { response, body } = await f.request();
    assert.equal(response.status, 403);assert.equal(body.reason, "fresh_nfc_evidence_required_for_ownership");
    assert.ok(["fresh_token_tag_binding_mismatch", "fresh_token_counter_mismatch"].includes(body.fresh_token_status));
    assert.deepEqual(f.counts, { consume: 1, freshReservations: 1, core: 0 });
    assert.equal(f.calls.includes("policy"), false);assert.equal(f.calls.includes("reserve"), false);assert.equal(f.calls.includes("claim"), false);
  }
});

test("public share, missing event, authentication and PIN failures preserve their precedence and lock window", async () => {
  for (const [configuration, status, reason, freshReservations] of [
    [{ shareDenied: true }, 401, "synthetic_share_denied", 0],
    [{ eventMissing: true, body: { fresh_token: "synthetic.invalid-token" } }, 403, "fresh_nfc_evidence_required_for_ownership", 0],
    [{ eventMissing: true }, 404, "event_not_found", 1],
    [{ unauthorized: true }, 401, "consumer_auth_required", 1],
    [{ body: { pin: "" } }, 400, "pin_required", 1],
    [{ invalidPin: true }, 403, "invalid_pin", 1],
    [{ locked: true }, 429, "claim_pin_locked", 1],
  ]) {
    const f = publicFixture(configuration), { response, body } = await f.request();
    assert.equal(response.status, status);assert.equal(body.reason, reason);assert.equal(f.counts.core, 0);
    assert.equal(f.counts.consume, configuration.shareDenied ? 0 : 1);
    assert.equal(f.counts.freshReservations, freshReservations);
    if (freshReservations === 0) assert.equal(f.calls.includes("event"), false);
    if (configuration.locked) { assert.equal(response.headers.get("retry-after"), "900");assert.equal(body.retry_after_seconds, 900); }
  }
});

test("public core uncertainty never invents a commit outcome, while explicit committed results retain their priority", async () => {
  for (const configuration of [{ claimThrows: true }, { committed: true }]) {
    const f = publicFixture(configuration), { response, body } = await f.request();
    assert.equal(response.status, 503);assert.equal(f.counts.consume, 1);assert.equal(f.counts.freshReservations, 1);assert.equal(f.counts.core, 1);
    if (configuration.claimThrows) {
      assert.equal(body.reason, "consumer_ownership_claim_unavailable");assert.equal(body.fresh_tap_required, true);
      assert.equal(Object.hasOwn(body, "operation_committed"), false);assert.equal(response.headers.get("cache-control"), "no-store");
    } else {
      assert.equal(body.reason, "canonical_event_write_unavailable");assert.equal(body.operation_committed, true);
      assert.equal(Object.hasOwn(body, "fresh_tap_required"), false);
    }
  }
});
