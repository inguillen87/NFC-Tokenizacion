import test from "node:test";
import assert from "node:assert/strict";

function validateBatchStateTransition(currentState, nextState, hasKeys, hasProfile) {
  const validStates = ['draft', 'production_registered', 'active_in_market', 'deprecating', 'archived'];
  if (!validStates.includes(nextState)) {
    return { ok: false, reason: "invalid_state" };
  }
  if (nextState === 'production_registered') {
    if (!hasKeys || !hasProfile) {
      return { ok: false, reason: "missing_requirements" };
    }
  }
  return { ok: true };
}

function validateTagStateTransition(currentStatus, nextStatus, batchStatus) {
  const validStatuses = ['inactive', 'active', 'suspended', 'revoked'];
  if (!validStatuses.includes(nextStatus)) {
    return { ok: false, reason: "invalid_status" };
  }
  if (currentStatus === 'revoked') {
    return { ok: false, reason: "tag_already_revoked" };
  }
  if (currentStatus === 'inactive' && nextStatus !== 'active') {
    return { ok: false, reason: "invalid_transition" };
  }
  if (currentStatus === 'active' && !['suspended', 'revoked'].includes(nextStatus)) {
    return { ok: false, reason: "invalid_transition" };
  }
  if (currentStatus === 'suspended' && nextStatus !== 'active' && nextStatus !== 'revoked') {
    return { ok: false, reason: "invalid_transition" };
  }
  if (nextStatus === 'active') {
    const allowedStatuses = ['production_registered', 'active_in_market', 'active'];
    if (!allowedStatuses.includes(batchStatus)) {
      return { ok: false, reason: "invalid_batch_state" };
    }
  }
  return { ok: true };
}

test("batch transition from draft to production_registered requires keys and profile", () => {
  const fail = validateBatchStateTransition("draft", "production_registered", false, false);
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, "missing_requirements");

  const success = validateBatchStateTransition("draft", "production_registered", true, true);
  assert.equal(success.ok, true);
});

test("tag transition from revoked is blocked", () => {
  const res = validateTagStateTransition("revoked", "active", "active_in_market");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "tag_already_revoked");
});

test("inactive tag can only transition to active", () => {
  const fail = validateTagStateTransition("inactive", "suspended", "active_in_market");
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, "invalid_transition");

  const success = validateTagStateTransition("inactive", "active", "active_in_market");
  assert.equal(success.ok, true);
});

test("tag activation blocked if batch status is draft", () => {
  const res = validateTagStateTransition("inactive", "active", "draft");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid_batch_state");
});
