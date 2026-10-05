import test from "node:test";
import assert from "node:assert/strict";

const { evaluateOwnershipEligibility, isClaimableOwnershipResult, matchesOwnershipBatch, matchesOwnershipTenant } = await import("../src/lib/ownership-policy.ts");

const eligible = (overrides = {}) => ({
  result: "VALID", tenant_id: "tenant-a", batch_id: "batch-a", uid_hex: "04AABBCCDDEE11",
  current_tag_id: "tag-a", current_tag_tenant_id: "tenant-a", current_tag_batch_id: "batch-a",
  current_tag_uid_hex: "04AABBCCDDEE11", current_tag_status: "active",
  current_tag_lifecycle_state: "active", current_tag_identity_count: 1, ...overrides,
});

test("tap válido produce estado claimed", () => {
  const verdict = evaluateOwnershipEligibility(eligible());
  assert.equal(verdict.isBlocked, false);
  assert.equal(verdict.nextStatus, "claimed");
});

test("resultados canónicos positivos son claimables pero estados desconocidos fallan cerrados", () => {
  for (const result of ["VALID_AUTHENTIC", "OPENED", "OPENED_PREVIOUSLY", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "VALID_UNKNOWN_TAMPER"]) {
    assert.equal(isClaimableOwnershipResult(result), true);
    assert.deepEqual(
      evaluateOwnershipEligibility(eligible({ result })),
      { isBlocked: false, nextStatus: "claimed" },
    );
  }

  for (const result of ["VALID_FUTURE", "AUTHENTIC", "", " VALID_AUTHENTIC_UNKNOWN "]) {
    assert.equal(isClaimableOwnershipResult(result), false);
    assert.deepEqual(
      evaluateOwnershipEligibility(eligible({ result })),
      { isBlocked: true, nextStatus: "revoked" },
    );
  }
});

test("replay bloquea claim ownership", () => {
  const verdict = evaluateOwnershipEligibility(eligible({ result: "REPLAY_SUSPECT" }));
  assert.equal(verdict.isBlocked, true);
  assert.equal(verdict.nextStatus, "blocked_replay");
});

test("tag revocado bloquea ownership", () => {
  const verdict = evaluateOwnershipEligibility(eligible({ current_tag_status: "revoked", current_tag_lifecycle_state: "revoked" }));
  assert.equal(verdict.isBlocked, true);
  assert.equal(verdict.nextStatus, "revoked");
});

test("tampered/revoked/broken no son claimables", () => {
  assert.equal(isClaimableOwnershipResult("TAMPERED"), false);
  assert.equal(isClaimableOwnershipResult("REVOKED"), false);
  assert.equal(isClaimableOwnershipResult("BROKEN"), false);
  const tampered = evaluateOwnershipEligibility(eligible({ result: "TAMPERED" }));
  assert.equal(tampered.isBlocked, true);
  assert.equal(tampered.nextStatus, "revoked");
});

test("una apertura declarada por operador no habilita ownership ni engagement protegido", () => {
  for (const result of ["MANUAL_OPENED", "VALID_MANUAL_OPENED"]) {
    assert.equal(isClaimableOwnershipResult(result), false);
    const verdict = evaluateOwnershipEligibility(eligible({ result }));
    assert.equal(verdict.isBlocked, true);
    assert.notEqual(verdict.nextStatus, "claimed");
  }
});

test("tenant mismatch devuelve false para proteger join/save/claim", () => {
  assert.equal(matchesOwnershipTenant({ eventTenantId: "tenant-a", requestedTenantId: "tenant-a" }), true);
  assert.equal(matchesOwnershipTenant({ eventTenantId: "tenant-a", requestedTenantId: "tenant-b" }), false);
  assert.equal(matchesOwnershipTenant({ eventTenantId: "tenant-a", requestedTenantId: "" }), true);
  assert.equal(matchesOwnershipTenant({ eventTenantId: "149de2f9-c477-46db-ac2d-8870dbbe3968", eventTenantSlug: "demobodega", requestedTenantSlug: "demobodega" }), true);
  assert.equal(matchesOwnershipTenant({ eventTenantId: "149de2f9-c477-46db-ac2d-8870dbbe3968", eventTenantSlug: "demobodega", requestedTenantId: "demobodega" }), true);
  assert.equal(matchesOwnershipTenant({ eventTenantId: "149de2f9-c477-46db-ac2d-8870dbbe3968", eventTenantSlug: "demobodega", requestedTenantId: "wrong", requestedTenantSlug: "demobodega" }), false);
});

test("batch mismatch devuelve false para proteger join/save/claim", () => {
  assert.equal(matchesOwnershipBatch({ eventBid: "BID-001", requestedBid: "BID-001" }), true);
  assert.equal(matchesOwnershipBatch({ eventBid: "BID-001", requestedBid: "BID-999" }), false);
  assert.equal(matchesOwnershipBatch({ eventBid: "BID-001", requestedBid: "" }), true);
});
