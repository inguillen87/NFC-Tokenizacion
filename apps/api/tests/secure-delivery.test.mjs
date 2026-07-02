import test from "node:test";
import assert from "node:assert/strict";

const {
  classifyTamperState,
  nextSealStatusForScan,
  recipientVerificationStatusForSealStatus,
  resolveSealStatusForScan,
  shouldCreateDeliveryClaimForStatus,
} = await import("../src/lib/secure-delivery-policy.ts");

test("secure delivery classifies TagTamper states conservatively", () => {
  assert.equal(classifyTamperState("4343"), "closed");
  assert.equal(classifyTamperState("4f4f"), "opened");
  assert.equal(classifyTamperState("4F43"), "opened");
  assert.equal(classifyTamperState("4949"), "opened");
  assert.equal(classifyTamperState(""), "unknown");
  assert.equal(classifyTamperState(null), "unknown");
});

test("secure delivery scan transitions never treat unknown TTSTATUS as intact", () => {
  assert.equal(nextSealStatusForScan("APPLY", "4343"), "SEALED");
  assert.equal(nextSealStatusForScan("HANDOFF", "4343"), "IN_TRANSIT");
  assert.equal(nextSealStatusForScan("VERIFY", "4343"), "DELIVERED_CLOSED");

  assert.equal(nextSealStatusForScan("APPLY", null), "QUARANTINED");
  assert.equal(nextSealStatusForScan("HANDOFF", "BAD"), "QUARANTINED");
  assert.equal(nextSealStatusForScan("VERIFY", "4F4F"), "DELIVERED_OPENED");
  assert.equal(nextSealStatusForScan("VERIFY", "BAD"), "QUARANTINED");
});

test("secure delivery status resolution never downgrades terminal evidence", () => {
  assert.equal(resolveSealStatusForScan("IN_TRANSIT", "APPLY", "4343"), "IN_TRANSIT");
  assert.equal(resolveSealStatusForScan("DELIVERED_CLOSED", "HANDOFF", "4343"), "DELIVERED_CLOSED");
  assert.equal(resolveSealStatusForScan("DELIVERED_CLOSED", "VERIFY", "4F4F"), "DELIVERED_OPENED");
  assert.equal(resolveSealStatusForScan("DELIVERED_OPENED", "VERIFY", "4343"), "DELIVERED_OPENED");
  assert.equal(resolveSealStatusForScan("QUARANTINED", "VERIFY", "4343"), "QUARANTINED");
  assert.equal(resolveSealStatusForScan("VOIDED", "VERIFY", "4343"), "VOIDED");
});

test("recipient verification status follows seal state and opens claims only for delivery risk", () => {
  assert.equal(recipientVerificationStatusForSealStatus("DELIVERED_CLOSED"), "verified");
  assert.equal(recipientVerificationStatusForSealStatus("DELIVERED_OPENED"), "tampered");
  assert.equal(recipientVerificationStatusForSealStatus("QUARANTINED"), "review_required");

  assert.equal(shouldCreateDeliveryClaimForStatus("DELIVERED_CLOSED"), false);
  assert.equal(shouldCreateDeliveryClaimForStatus("DELIVERED_OPENED"), true);
  assert.equal(shouldCreateDeliveryClaimForStatus("QUARANTINED"), true);
});
