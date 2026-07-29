import assert from "node:assert/strict";
import test from "node:test";

const {
  normalizeSupplierPackagingSpec,
  recommendIndustrialConstruction,
  validateSupplierPackagingSpec,
} = await import("../src/lib/supplier-packaging-spec.ts");

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

test("finished smart-label spec can become production ready", () => {
  const result = validateSupplierPackagingSpec(productionSpec(), { carrierProfileCode: "ntag424_dna" });
  assert.equal(result.ok, true);
  assert.equal(result.productionReady, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.readinessGaps, []);
});

test("automatic line cannot be approved from a generic material description", () => {
  const result = validateSupplierPackagingSpec({
    inlayForm: "converted_smart_label",
    applicationSurface: "flexible_bag",
    placement: "body",
    applicationMode: "automatic_labeler",
    substrateMaterial: "woven seed bag",
  }, { requireProductionApproval: true });
  assert.equal(result.ok, false);
  assert.equal(result.productionReady, false);
  assert.ok(result.readinessGaps.some((item) => item.code === "automatic_line_spec_required"));
  assert.ok(result.errors.some((item) => item.code === "packaging_spec_not_production_ready"));
});

test("raw dry inlay is rejected as a direct finished label", () => {
  const result = validateSupplierPackagingSpec({
    ...productionSpec(),
    inlayForm: "dry_inlay",
    applicationMode: "automatic_labeler",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === "dry_inlay_requires_conversion"));
});

test("TagTamper requires a tail across the real opening and physical placement approval", () => {
  const result = validateSupplierPackagingSpec(productionSpec({
    tagTamper: { required: true, bridgesOpening: false, tailLengthMm: null, placementApproved: false },
  }), { carrierProfileCode: "ntag424_dna_tt" });
  assert.equal(result.productionReady, false);
  assert.ok(result.readinessGaps.some((item) => item.code === "tagtamper_must_bridge_opening"));
  assert.ok(result.readinessGaps.some((item) => item.code === "tagtamper_tail_geometry_required"));
  assert.ok(result.readinessGaps.some((item) => item.code === "tagtamper_placement_trial_required"));
});

test("metal/liquid risk remains a measured RF gate rather than a software claim", () => {
  const result = validateSupplierPackagingSpec(productionSpec({
    applicationSurface: "metal",
    inlayForm: "wet_inlay",
    environment: {
      ...productionSpec().environment,
      metalProximity: true,
      liquidProximity: true,
    },
    qa: { ...productionSpec().qa, rfSampleApproved: false },
  }));
  assert.equal(result.productionReady, false);
  assert.ok(result.readinessGaps.some((item) => item.code === "rf_sample_required"));
  assert.ok(result.warnings.some((item) => item.code === "on_metal_construction_review"));
});

test("construction recommendation favors a converted roll for an existing label line", () => {
  assert.equal(recommendIndustrialConstruction({ existingPressureSensitiveLabelLine: true }).inlayForm, "converted_smart_label");
  assert.equal(recommendIndustrialConstruction({ converterWillIntegrate: true }).inlayForm, "dry_inlay");
  assert.equal(recommendIndustrialConstruction({ directManualApplication: true }).inlayForm, "wet_inlay");
});

test("normalizer bounds unknown and malformed fields without accepting invalid measurements", () => {
  const normalized = normalizeSupplierPackagingSpec({
    inlay_form: "UNKNOWN",
    geometry: { label_width_mm: -10, pitch_mm: "33" },
    roll: { unwind_direction: 9 },
    environment: { chemical_exposure: "water; water; solvent" },
  });
  assert.equal(normalized.inlayForm, "undecided");
  assert.equal(normalized.geometry.labelWidthMm, null);
  assert.equal(normalized.geometry.pitchMm, 33);
  assert.equal(normalized.roll.unwindDirection, null);
  assert.deepEqual(normalized.environment.chemicalExposure, ["water", "solvent"]);
});
