import test from "node:test";
import assert from "node:assert/strict";

const { evaluateOwnershipEligibility, isClaimableOwnershipResult, matchesOwnershipBatch, matchesOwnershipTenant } = await import("../src/lib/ownership-policy.ts");

test("tap válido produce estado claimed", () => {
  const verdict = evaluateOwnershipEligibility({ result: "VALID", tagStatus: "active" });
  assert.equal(verdict.isBlocked, false);
  assert.equal(verdict.nextStatus, "claimed");
});

test("replay bloquea claim ownership", () => {
  const verdict = evaluateOwnershipEligibility({ result: "REPLAY_SUSPECT", tagStatus: "active" });
  assert.equal(verdict.isBlocked, true);
  assert.equal(verdict.nextStatus, "blocked_replay");
});

test("tag revocado bloquea ownership", () => {
  const verdict = evaluateOwnershipEligibility({ result: "VALID", tagStatus: "revoked" });
  assert.equal(verdict.isBlocked, true);
  assert.equal(verdict.nextStatus, "revoked");
});

test("tampered/revoked/broken no son claimables", () => {
  assert.equal(isClaimableOwnershipResult("TAMPERED"), false);
  assert.equal(isClaimableOwnershipResult("REVOKED"), false);
  assert.equal(isClaimableOwnershipResult("BROKEN"), false);
  const tampered = evaluateOwnershipEligibility({ result: "TAMPERED", tagStatus: "active" });
  assert.equal(tampered.isBlocked, true);
  assert.equal(tampered.nextStatus, "revoked");
});

test("tenant mismatch devuelve false para proteger join/save/claim", () => {
  assert.equal(matchesOwnershipTenant({ eventTenantId: "tenant-a", requestedTenantId: "tenant-a" }), true);
  assert.equal(matchesOwnershipTenant({ eventTenantId: "tenant-a", requestedTenantId: "tenant-b" }), false);
  assert.equal(matchesOwnershipTenant({ eventTenantId: "tenant-a", requestedTenantId: "" }), true);
});

test("batch mismatch devuelve false para proteger join/save/claim", () => {
  assert.equal(matchesOwnershipBatch({ eventBid: "BID-001", requestedBid: "BID-001" }), true);
  assert.equal(matchesOwnershipBatch({ eventBid: "BID-001", requestedBid: "BID-999" }), false);
  assert.equal(matchesOwnershipBatch({ eventBid: "BID-001", requestedBid: "" }), true);
});
