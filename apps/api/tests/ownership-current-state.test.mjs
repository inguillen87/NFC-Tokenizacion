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

test("INSERT core statement inspection rechecks full identity/counter/lifecycle snapshots and locks; not PostgreSQL rollback evidence", async () => {
    const captured = await captureOwnershipMutation();
    assert.equal(captured.result.ok, false);
    assert.equal(captured.result.error, "claim_policy_changed");
    assert.equal(captured.result.ownership, null);
    assert.equal(captured.capabilityConsumed, true); assert.equal(captured.proofIssued, true);
    const query = captured.mutation.query;
    assert.match(query, /WITH locked_identity AS MATERIALIZED/);
    assert.match(query, /b\.id = e\.batch_id AND b\.tenant_id = e\.tenant_id/);
    assert.match(query, /tag\.batch_id = e\.batch_id AND UPPER\(TRIM\(tag\.uid_hex\)\) = UPPER\(TRIM\(e\.uid_hex\)\)/);
    for (const field of ["e.id", "e.tenant_id", "tag.id"]) assert.ok(query.includes(`${field} = $`));
    for (const table of ["e", "tag", "b"]) assert.match(query, new RegExp(`to_jsonb\\(${table}\\) = \\$\\d+::jsonb`));
    assert.match(query, /ambiguous_tag\.id <> tag\.id/);
    assert.match(query, /FOR SHARE OF e, b, tenant, tag/);
    for (const table of ["profile", "product", "manual"]) {
      assert.match(query, new RegExp(`FOR SHARE OF ${table}`));
      assert.match(query, new RegExp(`SELECT snapshot FROM locked_${table}\\) IS NOT DISTINCT FROM \\$\\d+::jsonb`));
    }
    assert.match(query, /FOR UPDATE OF membership/); assert.match(query, /FOR UPDATE OF ownership/);
    assert.match(query, /NOT EXISTS \(SELECT 1 FROM locked_ownership WHERE status = 'claimed' OR consumer_id = \$\d+::uuid AND event_id = e\.id\)/);
    assert.match(query, /to_timestamp\(\$\d+\) > clock_timestamp\(\)/); assert.match(query, /core_commit_fence/);
    for (const table of ["tenant_consumer_memberships", "consumer_tap_history", "consumer_products", "consumer_product_ownerships"]) assert.match(query, new RegExp(`INSERT INTO ${table}`));
    assert.equal(captured.snapshot.tag.status, "active"); assert.equal(captured.snapshot.tag.lifecycle_state, "active");
    assert.ok(CLAIMABLE_OWNERSHIP_RESULTS.has(captured.snapshot.event.result)); assert.equal(captured.snapshot.event.sdm_read_ctr, 1);
    assert.equal(captured.snapshot.event.meta.sun_tt_truth_receipt.binding_status, "BOUND");
    for (const key of ["event", "tag", "batch", "tenant", "profile", "product", "manual"]) assert.ok(captured.mutation.parameters.includes(captured.snapshot[key] == null ? null : JSON.stringify(captured.snapshot[key])));
    assert.ok(captured.mutation.parameters.includes(ownershipFixture().current_tag_id));
    assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /SELECT t\.id, t\.status/);
});

test("former UPDATE claim refuses an already claimed title of the same consumer/event before consume or reassociation", async () => {
  const captured = await captureOwnershipMutation({ update: true });
  assert.equal(captured.result.ok, false); assert.equal(captured.result.error, "ownership_already_claimed");
  assert.equal(captured.capabilityConsumed, false); assert.equal(captured.proofIssued, false); assert.equal(captured.mutation, undefined);
  assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /\b(?:INSERT|UPDATE|DELETE)\b/);
});

test("inactive and ambiguous preflight do not enroll or save during a blocked claim", async () => {
  for (const [overrides, error] of [[{ current_tag_status: "inactive", current_tag_lifecycle_state: "suspended" }, "event_security_blocked"], [{ current_tag_identity_count: 2 }, "tap_policy_indeterminate"], [{ manual_tamper_status: "OPENED" }, "event_security_blocked"]]) {
    const captured = await captureOwnershipMutation({ event: ownershipFixture(overrides) });
    assert.equal(captured.result.error, error); assert.equal(captured.capabilityConsumed, false); assert.equal(captured.proofIssued, false);
    assert.equal(captured.mutation, undefined);
    assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /\b(?:INSERT|UPDATE|DELETE)\b/);
  }
});

test("missing exact tag does not fall back to an unrelated batch", async () => {
  const captured = await captureOwnershipMutation({ event: ownershipFixture({ current_tag_id: null }) });
  assert.equal(captured.result.error, "tap_policy_indeterminate");
  assert.equal(captured.capabilityConsumed, false); assert.equal(captured.proofIssued, false);
  assert.equal(captured.mutation, undefined);
  assert.equal(captured.statements.filter(s => /SELECT jsonb_build_object/.test(s.query)).length, 1);
  assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /\b(?:INSERT|UPDATE|DELETE)\b/);
});

test("durable rights read failure blocks ownership and mutation failure cannot report a title", async () => {
  const captured = await captureOwnershipMutation({ rightsError: true });
  assert.equal(captured.result.ok, false);
  assert.equal(captured.result.error, "tap_policy_unavailable"); assert.equal(captured.result.ownership ?? null, null);
  assert.equal(captured.capabilityConsumed, false); assert.equal(captured.proofIssued, false);
  assert.doesNotMatch(captured.statements.map(s => s.query).join("\n"), /\b(?:INSERT|UPDATE|DELETE)\b/);
  await assert.rejects(captureOwnershipMutation({ mutationError: new Error("synthetic mutation failure") }), /synthetic mutation failure/);
});
