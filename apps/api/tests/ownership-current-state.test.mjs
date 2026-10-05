import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOwnershipEligibility, isCurrentOwnershipTagEligible, CLAIMABLE_OWNERSHIP_RESULTS } from "../src/lib/ownership-policy.ts";
import { captureOwnershipMutation, ownershipFixture } from "./helpers/ownership-current-state-fixture.mjs";

for (const result of CLAIMABLE_OWNERSHIP_RESULTS) {
  test(`ownership preserves its existing hardware result ${result} with an exact active tag`, () => {
    assert.deepEqual(evaluateOwnershipEligibility(ownershipFixture({ result })), { isBlocked: false, nextStatus: "claimed" });
  });
}

for (const state of ["inactive", "suspended", "quarantined", "lost", "expired", "broken", "tampered", "revoked", "unknown", ""]) {
  test(`ownership blocks historical VALID_CLOSED with current lifecycle ${state || "empty"}`, () => {
    assert.equal(evaluateOwnershipEligibility(ownershipFixture({ current_tag_lifecycle_state: state })).isBlocked, true);
  });
}

for (const field of ["tenant_id", "batch_id", "uid_hex", "current_tag_id", "current_tag_tenant_id", "current_tag_batch_id", "current_tag_uid_hex", "current_tag_status", "current_tag_identity_count"]) {
  test(`ownership fails closed without ${field}`, () => {
    assert.equal(isCurrentOwnershipTagEligible(ownershipFixture({ [field]: undefined })), false);
  });
}

for (const mismatch of [
  { current_tag_tenant_id: "00000000-0000-0000-0000-000000000999" },
  { current_tag_batch_id: "00000000-0000-0000-0000-000000000999" },
  { current_tag_uid_hex: "04AABBCCDDEE99" }, { current_tag_identity_count: 2 },
  { current_tag_identity_count: 0 }, { current_tag_status: "inactive" },
]) {
  test(`ownership rejects mismatched current evidence ${JSON.stringify(mismatch)}`, () => {
    assert.equal(evaluateOwnershipEligibility(ownershipFixture(mismatch)).isBlocked, true);
  });
}

test("legacy null lifecycle uses active status; manual opening remains distinct from hardware opening", () => {
  assert.equal(evaluateOwnershipEligibility(ownershipFixture({ current_tag_lifecycle_state: null, result: "VALID_OPENED" })).isBlocked, false);
  assert.equal(evaluateOwnershipEligibility(ownershipFixture({ result: "VALID_OPENED", manual_tamper_status: "OPENED" })).isBlocked, true);
  assert.equal(evaluateOwnershipEligibility(ownershipFixture({ reason: "operator declared open" })).isBlocked, true);
});

for (const update of [false, true]) {
  test(`${update ? "UPDATE" : "INSERT"} claim repeats exact identity, active lifecycle and result eligibility while holding tag/batch/event locks`, async () => {
    const captured = await captureOwnershipMutation({ update });
    assert.equal(captured.result.ok, false);
    assert.equal(captured.result.error, "revoked");
    const query = captured.mutation.query;
    assert.match(query, /WITH current_tag AS MATERIALIZED/);
    assert.match(query, /bound_batch\.tenant_id = source_event\.tenant_id/);
    assert.match(query, /tag\.batch_id = source_event\.batch_id AND UPPER\(tag\.uid_hex\) = UPPER\(source_event\.uid_hex\)/);
    for (const field of ["source_event.tenant_id", "source_event.batch_id", "tag.id"]) assert.ok(query.includes(`${field} = $`));
    assert.match(query, /tag\.status = 'active'/);
    assert.match(query, /COALESCE\(tag\.lifecycle_state, tag\.status::text\) = 'active'/);
    assert.match(query, /ambiguous_tag\.id <> tag\.id/);
    assert.match(query, /FOR SHARE OF tag, bound_batch, source_event/);
    assert.match(query, /WHEN NOT EXISTS \(SELECT 1 FROM current_tag\)/);
    assert.match(query, /OPERATOR_DECLARED_OPEN/);
    assert.ok(captured.mutation.parameters.includes(ownershipFixture().current_tag_id));
    assert.ok(captured.mutation.parameters.includes(ownershipFixture().batch_id));
    assert.ok(captured.mutation.parameters.some(p => Array.isArray(p) && p.length === CLAIMABLE_OWNERSHIP_RESULTS.size));
    assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /SELECT t\.id, t\.status/);
  });
}

test("inactive and ambiguous preflight do not enroll or save during a blocked claim", async () => {
  for (const overrides of [{ current_tag_status: "inactive", current_tag_lifecycle_state: "suspended" }, { current_tag_identity_count: 2 }]) {
    const captured = await captureOwnershipMutation({ event: ownershipFixture(overrides) });
    assert.equal(captured.result.error, "revoked");
    assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /INSERT INTO tenant_consumer_memberships|INSERT INTO consumer_tap_history|INSERT INTO consumer_products/);
  }
});

test("missing exact tag does not fall back to an unrelated batch", async () => {
  const captured = await captureOwnershipMutation({ event: ownershipFixture({ current_tag_id: null }) });
  assert.equal(captured.result.error, "tag_not_found");
  assert.equal(captured.mutation, undefined);
});

test("durable rights read failure blocks ownership and mutation failure cannot report a title", async () => {
  const captured = await captureOwnershipMutation({ rightsError: true });
  assert.equal(captured.result.ok, false);
  assert.equal(captured.result.ownership.status, "revoked");
  assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /INSERT INTO tenant_consumer_memberships|INSERT INTO consumer_tap_history/);
  await assert.rejects(captureOwnershipMutation({ mutationError: new Error("synthetic mutation failure") }), /synthetic mutation failure/);
});
