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

test("positive ownership submits the current strict four-write core without executing SQL in this capture", async () => {
  const captured = await captureOwnershipMutation();
  assert.equal(captured.sqlExecuted, false);
  assert.equal(captured.result.ok, false); assert.equal(captured.result.error, "revoked");
  const query = captured.mutation.query;
  assert.match(query, /WITH locked_event AS MATERIALIZED/);
  for (const source of ["locked_batch", "locked_tags", "locked_manual", "locked_tenant_policy", "locked_pos", "locked_ownerships", "decision_clock", "saved_title"]) {
    assert.ok(query.includes(source + " AS MATERIALIZED"), source);
  }
  assert.match(query, /batch\.id = event\.batch_id AND batch\.tenant_id = event\.tenant_id/);
  assert.match(query, /UPPER\(BTRIM\(tag\.uid_hex\)\) = UPPER\(BTRIM\(event\.uid_hex\)\)/);
  assert.match(query, /event\.sdm_read_ctr::bigint = \$[0-9]+::bigint/);
  assert.match(query, /row_revision = \$[0-9]+ AND status = 'active'/);
  assert.match(query, /COALESCE\(lifecycle_state, status::text\) = 'active'/);
  assert.match(query, /FOR SHARE OF source_event/); assert.match(query, /FOR SHARE OF batch/); assert.match(query, /FOR SHARE OF tag/);
  assert.match(query, /FOR UPDATE OF ownership/); assert.match(query, /OPERATOR_DECLARED_OPEN/);
  for (const target of ["consumer_product_ownerships", "tenant_consumer_memberships", "consumer_tap_history", "consumer_products"]) {
    assert.ok(query.includes("INSERT INTO " + target), target);
  }
  assert.match(query, /FROM write_integrity WHERE valid = 1/);
  assert.ok(captured.mutation.parameters.includes(ownershipFixture().current_tag_id));
  assert.ok(captured.mutation.parameters.includes(ownershipFixture().batch_id));
  assert.ok(captured.mutation.parameters.includes(true));
  assert.ok(captured.mutation.parameters.some(p => Array.isArray(p) && p.length === CLAIMABLE_OWNERSHIP_RESULTS.size));
  assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /WITH current_tag AS MATERIALIZED/);
});

test("inactive and ambiguous preflight do not enroll or save during a blocked claim", async () => {
  for (const overrides of [{ current_tag_status: "inactive", current_tag_lifecycle_state: "suspended" }, { current_tag_identity_count: 2 }]) {
    const captured = await captureOwnershipMutation({ event: ownershipFixture(overrides) });
    assert.equal(captured.result.error, "revoked");
    assert.match(captured.mutation.query, /WITH current_tag AS MATERIALIZED/);
    assert.match(captured.mutation.query, /INSERT INTO consumer_product_ownerships/);
    assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /WITH locked_event AS MATERIALIZED|INSERT INTO tenant_consumer_memberships|INSERT INTO consumer_tap_history|INSERT INTO consumer_products/);
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
