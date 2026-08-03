import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hashOwnershipClaimPin,
  OWNERSHIP_CLAIM_PIN_MAX_BYTES,
  OWNERSHIP_CLAIM_PIN_SCRYPT_POLICY,
  ownershipClaimPinRateScope,
  readOwnershipClaimPinInput,
  validateNewOwnershipClaimPin,
  verifyOwnershipClaimPin,
} from "../src/lib/ownership-claim-pin.ts";
import {
  OWNERSHIP_CLAIM_PIN_DEVICE_MAX_ATTEMPTS,
  OWNERSHIP_CLAIM_PIN_PRODUCT_MAX_ATTEMPTS,
  OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS,
  ownershipClaimPinRateKeys,
  releaseSuccessfulOwnershipClaimPinAttempt,
  reserveOwnershipClaimPinAttempt,
} from "../src/lib/ownership-claim-pin-rate-limit.ts";
import {
  evaluateOwnershipClaimAuthorization,
  resolveOwnershipClaimPinCredential,
} from "../src/lib/ownership-claim-authorization.ts";

const context = {
  tenantId: "0d1506fb-94da-40fc-8f5f-a343703d4759",
  bid: "SYNGENTA-2026-PILOT",
  uidHex: "04A1B2C3D4E5F6",
};
const strongPin = "R7K9-M4Q2";

function legacyHash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("new ownership codes use salted self-describing scrypt with explicit bounded parameters", async () => {
  const first = await hashOwnershipClaimPin(strongPin, context);
  const second = await hashOwnershipClaimPin(strongPin, context);

  assert.notEqual(first, second, "a random salt must make equal codes produce different records");
  assert.match(first, /^nexid-claim-pin\$v1\$scrypt\$N=16384\$r=8\$p=1\$dk=32\$maxmem=33554432\$scope=tag\$/);
  assert.equal(first.includes(strongPin), false);
  assert.deepEqual(OWNERSHIP_CLAIM_PIN_SCRYPT_POLICY, {
    version: "v1",
    algorithm: "scrypt",
    N: 16_384,
    r: 8,
    p: 1,
    keyLength: 32,
    maxmem: 32 * 1024 * 1024,
    saltBytes: 16,
  });

  assert.deepEqual(await verifyOwnershipClaimPin({ storedHash: first, pin: strongPin, context }), {
    matches: true,
    algorithm: "scrypt-v1",
    needsRotation: false,
  });
  assert.equal((await verifyOwnershipClaimPin({ storedHash: first, pin: "R7K9-M4Q3", context })).matches, false);
});

test("tag scrypt records bind tenant, batch and UID while batch records remain deliberately batch-scoped", async () => {
  const tagHash = await hashOwnershipClaimPin(strongPin, context);
  for (const changedContext of [
    { ...context, tenantId: "another-tenant" },
    { ...context, bid: "ANOTHER-BATCH" },
    { ...context, uidHex: "04FFFFFFFFFFFF" },
  ]) {
    assert.equal((await verifyOwnershipClaimPin({ storedHash: tagHash, pin: strongPin, context: changedContext })).matches, false);
  }

  const batchHash = await hashOwnershipClaimPin(strongPin, { tenantId: context.tenantId, bid: context.bid });
  assert.match(batchHash, /\$scope=batch\$/);
  assert.equal((await verifyOwnershipClaimPin({ storedHash: batchHash, pin: strongPin, context })).matches, true);
  assert.equal((await verifyOwnershipClaimPin({ storedHash: batchHash, pin: strongPin, context: { ...context, bid: "ANOTHER-BATCH" } })).matches, false);
});

test("all three SHA-256 legacy layouts remain readable and are marked for rotation", async () => {
  const fixtures = [
    ["legacy-sha256-raw", legacyHash(strongPin)],
    ["legacy-sha256-tag-context", legacyHash(`${context.tenantId}:${context.bid}:${context.uidHex}:${strongPin}`)],
    ["legacy-sha256-batch-context", legacyHash(`${context.tenantId}:${context.bid}:${strongPin}`)],
  ];
  for (const [algorithm, storedHash] of fixtures) {
    assert.deepEqual(await verifyOwnershipClaimPin({ storedHash, pin: strongPin, context }), {
      matches: true,
      algorithm,
      needsRotation: true,
    });
  }
  assert.deepEqual(await verifyOwnershipClaimPin({ storedHash: legacyHash("wrong"), pin: strongPin, context }), {
    matches: false,
    algorithm: "unknown",
    needsRotation: false,
  });
});

test("new-code policy rejects short, trivial, repeated, contextual and oversized values", () => {
  for (const pin of ["1234", "12345678", "abcdefgh", "ABABABAB", "password1", context.bid]) {
    assert.equal(validateNewOwnershipClaimPin(pin, context).ok, false, pin);
  }
  assert.deepEqual(validateNewOwnershipClaimPin(strongPin, context), { ok: true, pin: strongPin });
  assert.deepEqual(readOwnershipClaimPinInput("x".repeat(OWNERSHIP_CLAIM_PIN_MAX_BYTES + 1)), { ok: false, reason: "pin_too_long" });
  assert.deepEqual(readOwnershipClaimPinInput({ secret: strongPin }), { ok: false, reason: "pin_invalid_type" });
});

test("the hashing boundary itself refuses weak new codes", async () => {
  await assert.rejects(hashOwnershipClaimPin("12345678", context), /pin_trivial/);
  await assert.rejects(hashOwnershipClaimPin("short", context), /pin_too_short/);
});

test("verification exposes only a fixed audit result and uses timingSafeEqual", async () => {
  const source = await readFile(new URL("../src/lib/ownership-claim-pin.ts", import.meta.url), "utf8");
  const storedHash = await hashOwnershipClaimPin(strongPin, context);
  const result = await verifyOwnershipClaimPin({ storedHash, pin: strongPin, context });
  assert.deepEqual(Object.keys(result).sort(), ["algorithm", "matches", "needsRotation"]);
  assert.match(source, /timingSafeEqual\(/);
  assert.doesNotMatch(source, /candidates\.includes\(stored/);
  assert.equal(JSON.stringify(result).includes(strongPin), false);
  assert.equal(JSON.stringify(result).includes(storedHash), false);
});

test("tag PIN rate-limit keys share the product bucket but isolate source/device", () => {
  const firstRequest = new Request("https://api.nexid.test/api/v1/sdk/claim", {
    headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "device-a" },
  });
  const secondRequest = new Request("https://api.nexid.test/public/cta/claim-ownership", {
    headers: { "x-forwarded-for": "203.0.113.11", "user-agent": "device-b" },
  });
  const first = ownershipClaimPinRateKeys(firstRequest, { ...context, sourceId: "sdk-key:key-a", credentialScope: "tag" });
  const second = ownershipClaimPinRateKeys(secondRequest, { ...context, sourceId: "public-claim", credentialScope: "tag" });
  assert.equal(first.product, second.product);
  assert.notEqual(first.device, second.device);
  assert.notEqual(first.product, ownershipClaimPinRateKeys(firstRequest, { ...context, uidHex: "04FFFFFFFFFFFF", credentialScope: "tag" }).product);
});

test("batch and legacy PINs share one failure budget across every UID", async () => {
  const request = new Request("https://api.nexid.test/api/v1/sdk/claim", {
    headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "device-a" },
  });
  const otherTag = { ...context, uidHex: "04FFFFFFFFFFFF" };
  const batchHash = await hashOwnershipClaimPin(strongPin, { tenantId: context.tenantId, bid: context.bid });
  assert.equal(ownershipClaimPinRateScope(batchHash), "batch");
  assert.equal(ownershipClaimPinRateScope(legacyHash(strongPin)), "batch");
  assert.equal(ownershipClaimPinRateScope(await hashOwnershipClaimPin(strongPin, context)), "tag");

  const first = ownershipClaimPinRateKeys(request, { ...context, sourceId: "same-source", credentialScope: ownershipClaimPinRateScope(batchHash) });
  const second = ownershipClaimPinRateKeys(request, { ...otherTag, sourceId: "same-source", credentialScope: ownershipClaimPinRateScope(batchHash) });
  assert.equal(first.product, second.product);
  assert.equal(first.device, second.device);
});

test("PIN attempt leases enforce 5 source/device and 20 product failures before verification", async () => {
  const request = new Request("https://api.nexid.test/api/v1/sdk/claim");
  const reserves = [];
  const reserve = async (...args) => {
    reserves.push(args);
    return {
      hits: 1,
      limited: false,
      retryAfterSeconds: OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS,
      lease: {
        scope: args[0],
        scopeKeyHash: "a".repeat(64),
        windowStartedAt: "2026-08-02 12:00:00+00",
      },
    };
  };
  const allowed = await reserveOwnershipClaimPinAttempt(request, { ...context, credentialScope: "tag" }, { reserve });
  assert.equal(allowed.status, "allowed");
  assert.deepEqual(reserves.map(([scope, , window, max]) => [scope, window, max]), [
    ["claim_pin_device", OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS, OWNERSHIP_CLAIM_PIN_DEVICE_MAX_ATTEMPTS],
    ["claim_pin_product", OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS, OWNERSHIP_CLAIM_PIN_PRODUCT_MAX_ATTEMPTS],
  ]);
  assert.deepEqual(await reserveOwnershipClaimPinAttempt(request, { ...context, credentialScope: "tag" }, {
    reserve: async () => { throw new Error("db unavailable"); },
  }), { status: "unavailable" });
});

test("a correct PIN releases both leases while a failed PIN keeps the reserved failure budget", async () => {
  const request = new Request("https://api.nexid.test/api/v1/sdk/claim");
  const reserve = async (scope) => ({
    hits: 1,
    limited: false,
    retryAfterSeconds: OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS,
    lease: { scope, scopeKeyHash: "b".repeat(64), windowStartedAt: "2026-08-02 12:00:00+00" },
  });
  const allowed = await reserveOwnershipClaimPinAttempt(request, { ...context, credentialScope: "tag" }, { reserve });
  assert.equal(allowed.status, "allowed");
  const releaseCalls = [];
  assert.deepEqual(await releaseSuccessfulOwnershipClaimPinAttempt(allowed.attempt, {
    release: async (leases) => {
      releaseCalls.push(leases);
      return { released: true };
    },
  }), { status: "released" });
  assert.equal(releaseCalls[0].length, 2);
  // Failure settlement is intentionally the absence of a release call: the
  // pre-verification reservation itself is the durable failure count.
  assert.equal(releaseCalls.length, 1);
});

test("tag PIN policy and credential are atomic and never inherit a batch secret", () => {
  const batchHash = legacyHash(`${context.tenantId}:${context.bid}:${strongPin}`);
  assert.deepEqual(resolveOwnershipClaimPinCredential({
    claimPolicy: "inside_pack_secret",
    tagPinRequired: true,
    tagPinHash: null,
    batchPinRequired: true,
    batchPinHash: batchHash,
  }), {
    required: true,
    storedHash: "",
    source: "tag",
    misconfigured: true,
  });
  assert.equal(resolveOwnershipClaimPinCredential({
    claimPolicy: "inside_pack_secret",
    tagPinRequired: null,
    tagPinHash: null,
    batchPinRequired: true,
    batchPinHash: batchHash,
  }).storedHash, batchHash);
});

test("one authorization matrix rejects fresh-SUN-only claims across tenant policies", () => {
  const base = { activeForClaim: true, configuredPinRequired: false, pinPresented: false, pinValidated: false, configuredPosRequired: false, posValidated: false, purchaseProofPresented: false };
  assert.equal(evaluateOwnershipClaimAuthorization({ ...base, claimPolicy: "inside_pack_secret" }).reason, "pin_required");
  assert.equal(evaluateOwnershipClaimAuthorization({ ...base, claimPolicy: "retailer_attested" }).reason, "retailer_attestation_required");
  assert.equal(evaluateOwnershipClaimAuthorization({ ...base, claimPolicy: "admin_approved" }).reason, "ownership_manual_approval_required");
  assert.equal(evaluateOwnershipClaimAuthorization({ ...base, claimPolicy: "purchase_proof_required" }).reason, "purchase_receipt_required");
  assert.equal(evaluateOwnershipClaimAuthorization({ ...base, claimPolicy: null }).reason, "claim_policy_configuration_required");
});

test("public, SDK and mobile claims share policy, PIN credential and lockout gates", async () => {
  const routeUrls = [
    new URL("../src/app/public/cta/claim-ownership/route.ts", import.meta.url),
    new URL("../src/app/api/v1/sdk/claim/route.ts", import.meta.url),
    new URL("../src/app/mobile/passport/[eventId]/consumer/claim/route.ts", import.meta.url),
  ];
  for (const routeUrl of routeUrls) {
    const source = await readFile(routeUrl, "utf8");
    assert.match(source, /resolveOwnershipClaimPinCredential/);
    assert.match(source, /evaluateOwnershipClaimAuthorization/);
    assert.match(source, /reserveOwnershipClaimPinAttempt/);
    assert.match(source, /verifyOwnershipClaimPin/);
    assert.match(source, /releaseSuccessfulOwnershipClaimPinAttempt/);
    assert.ok(source.indexOf("reserveOwnershipClaimPinAttempt") < source.lastIndexOf("verifyOwnershipClaimPin"));
  }
});

test("POS activation is mandatory UID-scoped and cannot write batch policy", async () => {
  const source = await readFile(new URL("../src/app/api/v1/sdk/pos/activate/route.ts", import.meta.url), "utf8");
  assert.match(source, /uid_required_for_pos_activation/);
  assert.match(source, /UPDATE tags/);
  assert.match(source, /AND batch_id = \$\{clean\(target\.batch_id\)\}/);
  assert.doesNotMatch(source, /UPDATE batches/);
  assert.doesNotMatch(source, /batchPinHash/);
  assert.match(source, /CASE WHEN \$\{Boolean\(pin\)\} THEN true ELSE claim_pin_required END/);
  assert.doesNotMatch(source, /COALESCE\(claim_pin_required, false\)/);
  assert.match(source, /validateNewOwnershipClaimPin/);
  assert.match(source, /hashOwnershipClaimPin/);
});

test("claim routes ignore legacy batch-wide, used and sibling POS attestations", async () => {
  const publicSource = await readFile(new URL("../src/app/public/cta/claim-ownership/route.ts", import.meta.url), "utf8");
  const mobileSource = await readFile(new URL("../src/app/mobile/passport/[eventId]/consumer/claim/route.ts", import.meta.url), "utf8");
  const sdkSource = await readFile(new URL("../src/app/api/v1/sdk/claim/route.ts", import.meta.url), "utf8");
  for (const source of [publicSource, mobileSource]) {
    assert.match(source, /activation\.activation_status = 'active'/);
    assert.match(source, /activation\.tag_id = t\.id/);
    assert.match(source, /UPPER\(activation\.uid_hex\) = UPPER\(t\.uid_hex\)/);
    assert.doesNotMatch(source, /activation\.tag_id IS NULL/);
    assert.doesNotMatch(source, /activation\.activation_status IN \('active', 'used'\)/);
  }
  assert.match(sdkSource, /AND tag_id = \$\{clean\(row\.tag_id\)\}/);
  assert.match(sdkSource, /AND UPPER\(uid_hex\) = UPPER\(\$\{uidHex\}\)/);
  assert.match(sdkSource, /AND activation\.tag_id = \$\{clean\(row\.tag_id\) \|\| null\}/);
  assert.doesNotMatch(sdkSource, /uid_hex IS NULL OR/);
});

test("ownership sink has no demo-email takeover and conflict responses expose no prior owner PII", async () => {
  const source = await readFile(new URL("../src/lib/consumer-portal-service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /demo\.consumer@nexid\.local/);
  assert.doesNotMatch(source, /canSupersedeDemoClaim/);
  assert.doesNotMatch(source, /consumer_email/);
  assert.doesNotMatch(source, /SELECT o\.\*, c\.email/);
  assert.match(source, /error: "ownership_already_claimed" as const,[\s\S]*?ownership: null/);
  const conflictBranches = source.match(/error: "ownership_already_claimed" as const/g) || [];
  assert.equal(conflictBranches.length, 2);
});
