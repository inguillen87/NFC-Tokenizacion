import test from "node:test";
import assert from "node:assert/strict";

const { evaluateOwnershipEligibility, matchesOwnershipTenant } = await import("../src/lib/ownership-policy.ts");

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

test("tenant mismatch devuelve false para proteger join/save/claim", () => {
  assert.equal(matchesOwnershipTenant({ eventTenantId: "tenant-a", requestedTenantId: "tenant-a" }), true);
  assert.equal(matchesOwnershipTenant({ eventTenantId: "tenant-a", requestedTenantId: "tenant-b" }), false);
  assert.equal(matchesOwnershipTenant({ eventTenantId: "tenant-a", requestedTenantId: "" }), true);
});
