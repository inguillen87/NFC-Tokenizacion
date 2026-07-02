import test from "node:test";
import assert from "node:assert/strict";

const {
  classifyTamperState,
  nextSealStatusForScan,
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
