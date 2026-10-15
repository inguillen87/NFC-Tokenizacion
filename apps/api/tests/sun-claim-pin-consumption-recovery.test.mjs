import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const ts = createRequire(import.meta.url)("typescript");
const sourceRoot = new URL("../src/", import.meta.url);
function loadSource(relative, dependencies = {}) {
  const source = readFileSync(new URL(relative, sourceRoot), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
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
        tag_hash_pin: storedHash, tag_active_for_claim: true, batch_sdm_config: {},
        tenant_claim_policy: "inside_pack_secret", retailer_pos_attested: false }];
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
