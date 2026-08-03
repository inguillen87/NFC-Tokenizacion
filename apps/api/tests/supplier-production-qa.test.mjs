import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";

const {
  SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
  SUPPLIER_PRODUCTION_QA_DOMAIN,
  SUPPLIER_PRODUCTION_QA_POLICY_SCHEMA,
  buildSupplierProductionQaSelection,
  canonicalSupplierProductionQaJson,
  validateSupplierProductionQaPolicy,
} = await import("../src/lib/supplier-production-qa.ts");

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const BATCH_ID = "22222222-2222-4222-8222-222222222222";
const BID = "AGRO-PROD-2026-001";
const MANIFEST_HASH = `sha256:${"a".repeat(64)}`;

function policy(overrides = {}) {
  return {
    schema: SUPPLIER_PRODUCTION_QA_POLICY_SCHEMA,
    policyId: "quality-plan-2026-001",
    policyRevision: 3,
    tenantId: TENANT_ID,
    approvalStatus: "approved",
    approvedBy: "tenant-quality-user-42",
    approvedAt: "2026-08-01T12:00:00-03:00",
    approvalEvidenceRef: "artifact://tenant-quality/quality-plan-2026-001/revision-3",
    lotSize: 10,
    inspectionLevel: "tenant-approved-general-level-ii",
    targetAql: 1,
    sampleSize: 5,
    acceptNumber: 1,
    rejectNumber: 2,
    stratumField: "roll_id",
    ...overrides,
  };
}

function manifestRows() {
  const strata = ["ROLL-A", "ROLL-A", "ROLL-A", "ROLL-A", "ROLL-A", "ROLL-A", "ROLL-B", "ROLL-B", "ROLL-B", "ROLL-C"];
  return strata.map((rollId, index) => ({
    uidHex: `04AABBCCDDEE${index.toString(16).toUpperCase().padStart(2, "0")}`,
    batchId: BID,
    unitMetadata: { roll_id: rollId },
  }));
}

function selectionInput(overrides = {}) {
  return {
    tenantId: TENANT_ID,
    batchId: BATCH_ID,
    bid: BID,
    manifestHash: MANIFEST_HASH,
    qaSessionId: "33333333-3333-4333-8333-333333333333",
    policy: policy(),
    manifestRows: manifestRows(),
    serverSeed: Buffer.from("11".repeat(32), "hex"),
    ...overrides,
  };
}

test("keeps the production acceptance wire contract pinned to v2", () => {
  const result = buildSupplierProductionQaSelection(selectionInput());

  assert.equal(SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA, "supplier-production-acceptance/v2");
  assert.equal(result.schema, "supplier-production-acceptance/v2");
  assert.equal(result.status, "selection_committed");
});

test("builds a deterministic committed selection independent of manifest order", () => {
  const first = buildSupplierProductionQaSelection(selectionInput());
  const second = buildSupplierProductionQaSelection(selectionInput({ manifestRows: manifestRows().reverse() }));

  assert.equal(first.schema, SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA);
  assert.equal(first.status, "selection_committed");
  assert.deepEqual(first.allocation, [
    { stratumId: "ROLL-A", populationSize: 6, sampleSize: 2 },
    { stratumId: "ROLL-B", populationSize: 3, sampleSize: 2 },
    { stratumId: "ROLL-C", populationSize: 1, sampleSize: 1 },
  ]);
  assert.deepEqual(first.selectedSample, second.selectedSample);
  assert.equal(first.selectionCommitment, second.selectionCommitment);
  for (const digest of [
    first.policyDigest,
    first.populationDigest,
    first.allocationDigest,
    first.selectionDigest,
    first.seedCommitment,
    first.selectionCommitment,
  ]) {
    assert.match(digest, /^sha256:[0-9a-f]{64}$/);
  }
  assert.equal(JSON.stringify(first).includes("11".repeat(32)), false);
});

test("makes the server seed commitment independently verifiable without returning the seed", () => {
  const seed = Buffer.from("11".repeat(32), "hex");
  const result = buildSupplierProductionQaSelection(selectionInput({ serverSeed: seed }));
  const expectedSeedCommitment = `sha256:${createHash("sha256")
    .update("supplier-production-qa-selection-seed/v1", "utf8")
    .update("\0", "utf8")
    .update(seed.toString("base64url"), "utf8")
    .digest("hex")}`;
  const expectedSelectionCommitment = `sha256:${createHash("sha256")
    .update(result.commitmentCanonicalPayload, "utf8")
    .digest("hex")}`;

  assert.equal(result.seedCommitment, expectedSeedCommitment);
  assert.equal(result.selectionCommitment, expectedSelectionCommitment);
  assert.doesNotMatch(result.commitmentCanonicalPayload, new RegExp(seed.toString("hex"), "i"));
  assert.doesNotMatch(result.commitmentCanonicalPayload, new RegExp(seed.toString("base64url")));
});

test("keeps every selectionRankDigest stable and independently tied to the selected UID", () => {
  const seed = Buffer.from("11".repeat(32), "hex");
  const first = buildSupplierProductionQaSelection(selectionInput({ serverSeed: seed }));
  const reordered = buildSupplierProductionQaSelection(selectionInput({
    manifestRows: manifestRows().reverse(),
    serverSeed: seed,
  }));
  const selectionContext = {
    domain: SUPPLIER_PRODUCTION_QA_DOMAIN,
    schema: SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
    tenant_id: first.tenantId,
    batch_id: first.batchId,
    bid: first.bid,
    qa_session_id: first.qaSessionId,
    manifest_hash: first.manifestHash,
    policy_digest: first.policyDigest,
    population_digest: first.populationDigest,
    allocation_digest: first.allocationDigest,
  };

  assert.deepEqual(
    first.selectedSample.map((item) => item.selectionRankDigest),
    reordered.selectedSample.map((item) => item.selectionRankDigest),
  );
  for (const selected of first.selectedSample) {
    const expectedRankDigest = `sha256:${createHmac("sha256", seed)
      .update(canonicalSupplierProductionQaJson({
        ...selectionContext,
        seed_commitment: first.seedCommitment,
        stratum_id: selected.stratumId,
        uid_hex: selected.uidHex,
      }), "utf8")
      .digest("hex")}`;
    assert.equal(selected.selectionRankDigest, expectedRankDigest);
  }
});

test("uses the server seed through HMAC so a different seed changes the committed sample", () => {
  const first = buildSupplierProductionQaSelection(selectionInput());
  const second = buildSupplierProductionQaSelection(selectionInput({
    serverSeed: Buffer.from("22".repeat(32), "hex"),
  }));
  assert.notDeepEqual(first.selectedSample, second.selectedSample);
  assert.notEqual(first.seedCommitment, second.seedCommitment);
  assert.notEqual(first.selectionCommitment, second.selectionCommitment);
});

test("supports roll, case and pallet strata and requires the selected metadata on every row", () => {
  for (const stratumField of ["roll_id", "case_id", "pallet_id"]) {
    const rows = manifestRows().map((row, index) => ({
      uid_hex: row.uidHex,
      bid: BID,
      [stratumField]: `${stratumField}-${index < 5 ? "A" : "B"}`,
    }));
    const result = buildSupplierProductionQaSelection(selectionInput({
      policy: policy({ stratumField }),
      manifestRows: rows,
    }));
    assert.equal(result.stratumField, stratumField);
    assert.deepEqual(result.allocation.map((entry) => entry.sampleSize), [3, 2]);
  }

  const incomplete = manifestRows();
  delete incomplete[4].unitMetadata.roll_id;
  assert.throws(
    () => buildSupplierProductionQaSelection(selectionInput({ manifestRows: incomplete })),
    /supplier_production_qa_manifest_roll_id_row_5_required/,
  );
});

test("requires an explicit tenant-approved policy and never supplies AQL defaults", () => {
  assert.throws(
    () => validateSupplierProductionQaPolicy(policy({ approvalStatus: "submitted" }), TENANT_ID),
    /supplier_production_qa_policy_not_approved/,
  );
  assert.throws(
    () => validateSupplierProductionQaPolicy(policy({ tenantId: "another-tenant" }), TENANT_ID),
    /supplier_production_qa_policy_tenant_mismatch/,
  );
  assert.throws(
    () => validateSupplierProductionQaPolicy(policy({ targetAql: undefined }), TENANT_ID),
    /supplier_production_qa_target_aql_invalid/,
  );
  assert.throws(
    () => validateSupplierProductionQaPolicy(policy({ approvalEvidenceRef: "" }), TENANT_ID),
    /supplier_production_qa_policy_approval_evidence_ref_required/,
  );
});

test("validates lot, sample and Ac/Re limits fail closed", () => {
  const invalidCases = [
    [{ lotSize: 0 }, /supplier_production_qa_lot_size_invalid/],
    [{ sampleSize: 0 }, /supplier_production_qa_sample_size_invalid/],
    [{ sampleSize: 11 }, /supplier_production_qa_sample_exceeds_lot/],
    [{ acceptNumber: -1 }, /supplier_production_qa_accept_number_invalid/],
    [{ acceptNumber: 6 }, /supplier_production_qa_accept_exceeds_sample/],
    [{ rejectNumber: 6 }, /supplier_production_qa_reject_exceeds_sample/],
    [{ acceptNumber: 2, rejectNumber: 2 }, /supplier_production_qa_reject_must_exceed_accept/],
    [{ acceptNumber: 1, rejectNumber: 3 }, /supplier_production_qa_accept_reject_gap_not_supported/],
  ];
  for (const [overrides, expected] of invalidCases) {
    assert.throws(() => validateSupplierProductionQaPolicy(policy(overrides), TENANT_ID), expected);
  }
});

test("rejects samples that cannot include every stratum", () => {
  assert.throws(
    () => buildSupplierProductionQaSelection(selectionInput({
      policy: policy({ sampleSize: 2, acceptNumber: 0, rejectNumber: 1 }),
    })),
    /supplier_production_qa_sample_smaller_than_strata/,
  );
});

test("rejects manifest count, UID, BID and seed integrity failures", () => {
  assert.throws(
    () => buildSupplierProductionQaSelection(selectionInput({
      manifestRows: manifestRows().slice(0, 9),
    })),
    /supplier_production_qa_manifest_lot_size_mismatch/,
  );

  const duplicate = manifestRows();
  duplicate[9].uidHex = duplicate[0].uidHex;
  assert.throws(
    () => buildSupplierProductionQaSelection(selectionInput({ manifestRows: duplicate })),
    /supplier_production_qa_manifest_duplicate_uid/,
  );

  const wrongBid = manifestRows();
  wrongBid[3].batchId = "OTHER-BATCH";
  assert.throws(
    () => buildSupplierProductionQaSelection(selectionInput({ manifestRows: wrongBid })),
    /supplier_production_qa_manifest_bid_mismatch:row_4/,
  );

  assert.throws(
    () => buildSupplierProductionQaSelection(selectionInput({ serverSeed: Buffer.alloc(31) })),
    /supplier_production_qa_server_seed_invalid/,
  );
});

test("canonical JSON is stable for differently ordered object keys", () => {
  assert.equal(
    canonicalSupplierProductionQaJson({ z: 1, a: { y: 2, b: 3 } }),
    canonicalSupplierProductionQaJson({ a: { b: 3, y: 2 }, z: 1 }),
  );
});
