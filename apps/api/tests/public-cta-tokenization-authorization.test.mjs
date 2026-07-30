import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  eventShareUid,
  resolveExplicitSunAutoTokenizationAuthorization,
  resolvePublicCtaTarget,
  resolvePublicCtaTokenizationConfig,
} = await import("../src/lib/public-cta-target.ts");
const {
  createSunFreshHandoffToken,
  requireSunFreshHandoff,
  verifySunFreshHandoffToken,
} = await import("../src/lib/sun-fresh-handoff.ts");

const tokenizeRouteUrl = new URL("../src/app/public/cta/tokenize-request/route.ts", import.meta.url);
const claimRouteUrl = new URL("../src/app/public/cta/claim-ownership/route.ts", import.meta.url);
const warrantyRouteUrl = new URL("../src/app/public/cta/register-warranty/route.ts", import.meta.url);
const webProxyUrl = new URL("../../web/src/app/api/public-cta/[action]/route.ts", import.meta.url);
const originalSecret = process.env.SUN_HANDOFF_SECRET;
const TEST_SECRET = "public-cta-tokenization-authorization-secret";

test.before(() => {
  process.env.SUN_HANDOFF_SECRET = TEST_SECRET;
});

test.after(() => {
  if (originalSecret === undefined) delete process.env.SUN_HANDOFF_SECRET;
  else process.env.SUN_HANDOFF_SECRET = originalSecret;
});

function eventIdentity(overrides = {}) {
  return {
    id: 42,
    bid: "BID-PUBLIC-001",
    uid_hex: "04AABBCCDDEE77",
    batch_id: "11111111-1111-1111-1111-111111111111",
    tenant_id: "22222222-2222-2222-2222-222222222222",
    batch_sdm_config: {},
    sun_profile_vertical: "wine",
    sun_profile_tokenization_mode: "valid_and_opened",
    sun_profile_ownership_policy: {},
    sun_profile_metadata: {},
    ...overrides,
  };
}

function freshToken(eventId = "42") {
  return createSunFreshHandoffToken({
    bid: "BID-PUBLIC-001",
    eventId,
    diagnosticId: 7,
    traceId: "trace-public-cta-001",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
}

test("eventId is authoritative even when caller supplies a syntactically valid UID", async () => {
  let loads = 0;
  const target = await resolvePublicCtaTarget({
    bid: "BID-PUBLIC-001",
    uid: "04FFFFFFFFFFFF",
    event_id: "42",
  }, {
    loadEventIdentity: async () => {
      loads += 1;
      return eventIdentity();
    },
  });

  assert.equal(loads, 1);
  assert.deepEqual(target, { ok: false, reason: "event uid mismatch", status: 409 });
});

test("eventId rejects a caller BID mismatch before share authorization", async () => {
  const target = await resolvePublicCtaTarget({
    bid: "BID-ATTACKER-999",
    uid: "04AABBCCDDEE77",
    event_id: "42",
  }, { loadEventIdentity: async () => eventIdentity() });

  assert.deepEqual(target, { ok: false, reason: "event bid mismatch", status: 409 });
});

test("event target derives UID, BID, share alias, tenant, batch and safe policy from the row", async () => {
  const target = await resolvePublicCtaTarget({ eventId: "42" }, {
    loadEventIdentity: async (eventId) => {
      assert.equal(eventId, "42");
      return eventIdentity();
    },
  });

  assert.equal(target.ok, true);
  assert.equal(target.bid, "BID-PUBLIC-001");
  assert.equal(target.uid, "04AABBCCDDEE77");
  assert.equal(target.shareUid, "EVENT-42");
  assert.equal(target.batchId, "11111111-1111-1111-1111-111111111111");
  assert.equal(target.tenantId, "22222222-2222-2222-2222-222222222222");
  assert.equal(target.tokenizationPolicy, "ownership_required");
  assert.equal(target.tokenizationPolicySource, "safe_default");
});

test("malformed eventId never falls back to a caller UID", async () => {
  let loaded = false;
  const target = await resolvePublicCtaTarget({
    bid: "BID-PUBLIC-001",
    uid: "04AABBCCDDEE77",
    event_id: "42-or-43",
  }, {
    loadEventIdentity: async () => {
      loaded = true;
      return eventIdentity();
    },
  });

  assert.equal(loaded, false);
  assert.deepEqual(target, { ok: false, reason: "invalid event_id", status: 400 });
});

test("server policy supports configured lot anchors and otherwise fails closed", () => {
  const configuredLot = resolvePublicCtaTokenizationConfig(eventIdentity({
    batch_sdm_config: { tokenization: { policy: "lot_anchor", recipientWallet: "0x1111111111111111111111111111111111111111" } },
  }));
  const agroLot = resolvePublicCtaTokenizationConfig(eventIdentity({
    sun_profile_vertical: "agro",
    sun_profile_tokenization_mode: "valid_only",
  }));
  const manual = resolvePublicCtaTokenizationConfig(eventIdentity({
    sun_profile_tokenization_mode: "manual",
  }));
  const fallback = resolvePublicCtaTokenizationConfig(eventIdentity({
    sun_profile_vertical: null,
    sun_profile_tokenization_mode: null,
  }));

  assert.equal(configuredLot.policy, "lot_anchor");
  assert.equal(configuredLot.configuredRecipient, "0x1111111111111111111111111111111111111111");
  assert.equal(agroLot.policy, "lot_anchor");
  assert.equal(manual.policy, "disabled");
  assert.equal(fallback.policy, "ownership_required");
});

test("SUN auto tokenization requires an explicit policy and explicit tenant or batch opt-in", () => {
  const inferredAgro = resolveExplicitSunAutoTokenizationAuthorization(eventIdentity({
    sun_profile_vertical: "agro",
    sun_profile_tokenization_mode: "valid_only",
  }));
  const policyOnly = resolveExplicitSunAutoTokenizationAuthorization(eventIdentity({
    batch_sdm_config: { tokenization: { policy: "lot_anchor" } },
  }));
  const explicitlyAuthorized = resolveExplicitSunAutoTokenizationAuthorization(eventIdentity({
    batch_sdm_config: {
      tokenization: {
        policy: "lot_anchor",
        auto_tokenize_on_valid_tap: true,
        recipientWallet: "0x1111111111111111111111111111111111111111",
      },
    },
  }));
  const invalidBatchCannotFallThroughToTenant = resolveExplicitSunAutoTokenizationAuthorization(eventIdentity({
    batch_sdm_config: { tokenization: { policy: "caller-invented", auto_tokenize_on_valid_tap: "invalid" } },
    sun_profile_ownership_policy: { tokenizationPolicy: "lot_anchor", autoTokenizeOnValidTap: true },
  }));

  assert.equal(inferredAgro.enabled, false);
  assert.equal(inferredAgro.policy, null);
  assert.equal(policyOnly.enabled, false);
  assert.equal(policyOnly.policy, "lot_anchor");
  assert.equal(explicitlyAuthorized.enabled, true);
  assert.equal(explicitlyAuthorized.policy, "lot_anchor");
  assert.equal(explicitlyAuthorized.policySource, "batch.sdm_config.tokenization.policy");
  assert.equal(explicitlyAuthorized.autoSource, "batch.sdm_config.tokenization.auto_tokenize_on_valid_tap");
  assert.equal(invalidBatchCannotFallThroughToTenant.policy, null);
  assert.equal(invalidBatchCannotFallThroughToTenant.enabled, false);
  assert.equal(invalidBatchCannotFallThroughToTenant.policySource, "batch.sdm_config.tokenization.policy");
  assert.equal(invalidBatchCannotFallThroughToTenant.autoSource, "batch.sdm_config.tokenization.auto_tokenize_on_valid_tap");
});

test("fresh handoff signs an event-derived UID alias and enforces it for tokenization", () => {
  const token = freshToken();
  const accepted = requireSunFreshHandoff(
    new Request("https://api.nexid.test/public/cta/tokenize-request"),
    { fresh_token: token },
    { bid: "BID-PUBLIC-001", eventId: "42", uid: eventShareUid(42) },
  );
  const wrongUid = requireSunFreshHandoff(
    new Request("https://api.nexid.test/public/cta/tokenize-request"),
    { fresh_token: token },
    { bid: "BID-PUBLIC-001", eventId: "42", uid: "04FFFFFFFFFFFF" },
  );

  assert.equal(accepted.ok, true);
  assert.equal(accepted.payload.uid, "EVENT-42");
  assert.deepEqual(wrongUid, { ok: false, reason: "fresh_token_uid_mismatch" });
});

test("even a valid signature cannot turn the handoff UID into caller-controlled data", () => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    purpose: "sun_fresh_handoff",
    bid: "BID-PUBLIC-001",
    eventId: "42",
    uid: "04FFFFFFFFFFFF",
    diagnosticId: 7,
    traceId: "trace-public-cta-001",
    iat: now,
    exp: now + 60,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", TEST_SECRET).update(body).digest("base64url");

  assert.deepEqual(
    verifySunFreshHandoffToken(`${body}.${signature}`),
    { ok: false, reason: "fresh_token_uid_not_event_bound" },
  );
});

test("tokenization route uses only resolved policy, exact ownership and trusted recipient", async () => {
  const source = await readFile(tokenizeRouteUrl, "utf8");

  assert.match(source, /consumeSunFreshHandoff\([\s\S]*?req,[\s\S]*?body,[\s\S]*?\{ bid, eventId, uid: target\.shareUid \},[\s\S]*?"public_tokenize_request"/);
  assert.match(source, /const serverPolicy = target\.tokenizationPolicy/);
  assert.match(source, /caller_tokenization_policy_not_authorized/);
  assert.match(source, /caller_tokenization_recipient_not_authorized/);
  assert.match(source, /verifiedConsumerWallet\(consumer\)/);
  assert.match(source, /issuer_wallet: trustedRecipient/);
  assert.doesNotMatch(source, /POLYGON_DEFAULT_RECIPIENT/);
  assert.doesNotMatch(source, /issuer_wallet:\s*sanitizeText\(body\.issuer_wallet/);
  assert.match(source, /o\.tenant_id = \$\{input\.tenantId\}/);
  assert.match(source, /o\.batch_id = \$\{input\.batchId\}/);
  assert.match(source, /o\.uid_hex = \$\{input\.uid\}/);
  assert.match(source, /o\.event_id::text = \$\{input\.eventId\}/);
  assert.doesNotMatch(source, /o\.uid_hex = \$\{input\.uid\}\s+OR/);
});

test("web proxy signs the event alias before considering caller UID", async () => {
  const source = await readFile(webProxyUrl, "utf8");
  const eventBranch = source.indexOf("if (normalizedEventId)");
  const uidNormalization = source.indexOf("const normalizedUid", eventBranch);

  assert.ok(eventBranch >= 0);
  assert.ok(uidNormalization > eventBranch);
  assert.match(source, /return \/\^\[1-9\]\\d\*\$\/\.test\(normalizedEventId\) \? `EVENT-\$\{normalizedEventId\}` : ""/);
});

test("claim and warranty keep their public event and one-time fresh-tap gates", async () => {
  for (const [routeUrl, action] of [
    [claimRouteUrl, "public_claim_ownership"],
    [warrantyRouteUrl, "public_register_warranty"],
  ]) {
    const source = await readFile(routeUrl, "utf8");
    assert.match(source, /resolvePublicCtaTarget\(body\)/);
    assert.match(source, /requireShareToken\(req, bid, target\.shareUid\)/);
    assert.match(source, new RegExp(`consumeSunFreshHandoff\\(req, body, \\{ bid, eventId \\}, "${action}"\\)`));
    assert.match(source, /if \(!eventId\)/);
    assert.match(source, /if \(!fresh\.ok\)/);
  }
});
