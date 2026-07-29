import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  buildSupplierPackagingGovernanceDecision,
  evaluateSupplierPackagingExportGate,
  normalizeSupplierPackagingEvidenceRefs,
} = await import("../src/lib/supplier-packaging-governance.ts");

const migrationPath = new URL(
  "../db/migrations/20260728143000_0063_supplier_packaging_governance.sql",
  import.meta.url,
);

function productionSpec(overrides = {}) {
  return {
    inlayForm: "converted_smart_label",
    applicationSurface: "plastic_hdpe",
    placement: "cap",
    applicationMode: "automatic_labeler",
    substrateMaterial: "HDPE cap with induction liner",
    faceStock: "chemical-resistant synthetic film",
    adhesive: "permanent acrylic qualified for HDPE",
    liner: "glassine compatible with applicator",
    geometry: {
      labelWidthMm: 45,
      labelHeightMm: 30,
      antennaWidthMm: 40,
      antennaHeightMm: 24,
      pitchMm: 33,
      webWidthMm: 50,
    },
    roll: {
      coreDiameterMm: 76,
      maxOuterDiameterMm: 300,
      winding: "face_out",
      unwindDirection: 3,
      quantityPerRoll: 1000,
    },
    line: { unitsPerMinute: 120, printerEncoderModel: "converter-qualified encoder" },
    environment: {
      minTemperatureC: -5,
      maxTemperatureC: 55,
      liquidProximity: true,
      metalProximity: false,
      outdoorUv: true,
      chemicalExposure: ["agrochemical splash", "water"],
    },
    tagTamper: { required: false, bridgesOpening: null, tailLengthMm: null, placementApproved: false },
    qa: {
      rfSampleApproved: true,
      lineTrialApproved: true,
      adhesiveApproved: true,
      artworkApproved: true,
      encodingTrialApproved: true,
    },
    ...overrides,
  };
}

function evidenceRefs(overrides = {}) {
  return {
    rf_sample: ["artifact://rf/sample-01"],
    line_trial: ["artifact://line/trial-01"],
    adhesive: ["artifact://adhesive/report-01"],
    artwork_dieline: ["artifact://artwork/dieline-01"],
    encoding_readback: ["artifact://encoding/readback-01"],
    tagtamper_placement: [],
    ...overrides,
  };
}

function decisionInput(overrides = {}) {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    supplierOrderId: "22222222-2222-4222-8222-222222222222",
    previousStatus: "submitted",
    status: "approved",
    previousRevision: 2,
    specRevision: 3,
    carrierProfileCode: "ntag424_dna",
    spec: productionSpec(),
    evidenceRefs: evidenceRefs(),
    decidedBy: "user_approver",
    ...overrides,
  };
}

test("approval is derived from the packaging validator and independent evidence", () => {
  const decision = buildSupplierPackagingGovernanceDecision(decisionInput());
  assert.equal(decision.status, "approved");
  assert.equal(decision.validation.validator, "validateSupplierPackagingSpec");
  assert.equal(decision.validation.ok, true);
  assert.equal(decision.validation.productionReady, true);
  assert.match(decision.specHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(decision.singleOperatorOverride, false);
});

test("self-asserted QA booleans cannot approve without every physical evidence reference", () => {
  assert.throws(
    () => buildSupplierPackagingGovernanceDecision(decisionInput({
      evidenceRefs: evidenceRefs({ encoding_readback: [] }),
    })),
    /packaging_approval_evidence_required:encoding_readback/,
  );
});

test("TagTamper approval additionally requires TT placement evidence and a valid physical spec", () => {
  const ttSpec = productionSpec({
    tagTamper: { required: true, bridgesOpening: true, tailLengthMm: 42, placementApproved: true },
  });
  assert.throws(
    () => buildSupplierPackagingGovernanceDecision(decisionInput({
      carrierProfileCode: "NTAG424_DNA_TT",
      spec: ttSpec,
    })),
    /packaging_approval_evidence_required:tagtamper_placement/,
  );
  const decision = buildSupplierPackagingGovernanceDecision(decisionInput({
    carrierProfileCode: "NTAG424_DNA_TT",
    spec: ttSpec,
    evidenceRefs: evidenceRefs({ tagtamper_placement: ["artifact://tt/open-close-trial-01"] }),
  }));
  assert.equal(decision.validation.productionReady, true);
  assert.deepEqual(decision.evidenceRefs.tagtamper_placement, ["artifact://tt/open-close-trial-01"]);
});

test("an override is audited but cannot bypass evidence or validator gates", () => {
  const decision = buildSupplierPackagingGovernanceDecision(decisionInput({
    overrideReason: "Pilot has one authorized packaging officer; customer accepted the temporary duty overlap.",
  }));
  assert.equal(decision.singleOperatorOverride, true);
  assert.match(decision.overrideReason, /temporary duty overlap/);

  assert.throws(
    () => buildSupplierPackagingGovernanceDecision(decisionInput({
      overrideReason: "Same operator during pilot.",
      evidenceRefs: evidenceRefs({ rf_sample: [] }),
    })),
    /packaging_approval_evidence_required:rf_sample/,
  );
});

test("revisions are strictly monotonic and rejection requires a reason", () => {
  assert.throws(
    () => buildSupplierPackagingGovernanceDecision(decisionInput({ specRevision: 4 })),
    /packaging_spec_revision_not_monotonic/,
  );
  assert.throws(
    () => buildSupplierPackagingGovernanceDecision(decisionInput({ status: "rejected" })),
    /packaging_rejection_reason_required/,
  );
});

test("canonical hashes and evidence ordering are stable", () => {
  const left = buildSupplierPackagingGovernanceDecision(decisionInput({
    evidenceRefs: evidenceRefs({ rf_sample: ["artifact://rf/z", "artifact://rf/a", "artifact://rf/a"] }),
  }));
  const right = buildSupplierPackagingGovernanceDecision(decisionInput({
    spec: { ...productionSpec(), qa: { ...productionSpec().qa } },
    evidenceRefs: evidenceRefs({ rf_sample: ["artifact://rf/a", "artifact://rf/z"] }),
  }));
  assert.equal(left.specHash, right.specHash);
  assert.deepEqual(left.evidenceRefs.rf_sample, ["artifact://rf/a", "artifact://rf/z"]);
  assert.deepEqual(left.evidenceRefs, right.evidenceRefs);
  assert.deepEqual(normalizeSupplierPackagingEvidenceRefs({ rf_sample: "artifact://rf/a" }).rf_sample, ["artifact://rf/a"]);
});

test("factory export fails closed with an exact gap for legacy orders", () => {
  const gate = evaluateSupplierPackagingExportGate({
    status: "legacy_unverified",
    specRevision: 0,
    carrierProfileCode: "ntag424_dna",
    specSnapshot: null,
    specHash: null,
    evidenceRefs: {},
    validationSnapshot: null,
    approvalHistoryReceiptConsistent: false,
  });
  assert.equal(gate.ok, false);
  assert.deepEqual(gate.gaps, [{
    code: "packaging_governance_legacy_unverified",
    field: "packaging_governance_status",
    message: "Create, submit and approve an industrial packaging specification before exporting factory keys.",
  }]);
});

test("factory export revalidates canonical hash, production receipt and immutable history", () => {
  const decision = buildSupplierPackagingGovernanceDecision(decisionInput());
  const validGate = evaluateSupplierPackagingExportGate({
    status: decision.status,
    specRevision: decision.specRevision,
    carrierProfileCode: decision.carrierProfileCode,
    specSnapshot: decision.specSnapshot,
    specHash: decision.specHash,
    evidenceRefs: decision.evidenceRefs,
    validationSnapshot: decision.validation,
    approvalHistoryReceiptConsistent: true,
  });
  assert.equal(validGate.ok, true);
  assert.equal(validGate.specHash, decision.specHash);

  const forgedHash = evaluateSupplierPackagingExportGate({
    status: decision.status,
    specRevision: decision.specRevision,
    carrierProfileCode: decision.carrierProfileCode,
    specSnapshot: { ...decision.specSnapshot, notes: "changed after approval" },
    specHash: decision.specHash,
    evidenceRefs: decision.evidenceRefs,
    validationSnapshot: decision.validation,
    approvalHistoryReceiptConsistent: true,
  });
  assert.equal(forgedHash.ok, false);
  assert.ok(forgedHash.gaps.some((gap) => gap.code === "packaging_spec_hash_mismatch"));

  const missingHistory = evaluateSupplierPackagingExportGate({
    status: decision.status,
    specRevision: decision.specRevision,
    carrierProfileCode: decision.carrierProfileCode,
    specSnapshot: decision.specSnapshot,
    specHash: decision.specHash,
    evidenceRefs: decision.evidenceRefs,
    validationSnapshot: decision.validation,
    approvalHistoryReceiptConsistent: false,
  });
  assert.equal(missingHistory.ok, false);
  assert.ok(missingHistory.gaps.some((gap) => gap.code === "packaging_approval_history_receipt_missing"));
});

test("migration preserves operational status and enforces immutable, tenant-scoped workflow", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /packaging_governance_status text NOT NULL DEFAULT 'legacy_unverified'/);
  assert.doesNotMatch(migration, /ALTER COLUMN status/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /packaging_supplier_order_tenant_scope_mismatch/);
  assert.match(migration, /packaging_governance_revision_conflict/);
  assert.match(migration, /packaging_approval_separation_required/);
  assert.match(migration, /supplier_packaging_governance_history_is_immutable/);
  assert.match(migration, /packaging_governance_current_state_without_history/);
  assert.match(migration, /validation_snapshot->>'validator' = 'validateSupplierPackagingSpec'/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON supplier_packaging_governance_decisions/);
  assert.match(migration, /nexid_packaging_evidence_ref_present\(evidence_refs, 'tagtamper_placement'\)/);
  assert.match(migration, /nexid_record_supplier_packaging_decision_v1/);
});
