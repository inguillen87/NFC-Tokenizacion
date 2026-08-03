import assert from "node:assert/strict";
import test from "node:test";

const {
  buildPackagingCarrierSpecFromApprovedSnapshot,
  buildPackagingLabCsvReport,
  buildPackagingLabPdfReport,
  normalizePackagingEvidenceUrls,
  packagingLabPresetFor,
  packagingLabPresetsForCarrier,
  packagingLabTemplateFor,
  packagingLabTemplateTests,
} = await import("../src/lib/packaging-lab.ts");
const { enterpriseCarrierContract, normalizeCarrierProfileCode } = await import("../src/lib/carrier-profiles.ts");

test("carrier contracts keep security semantics explicit and fail-closed", () => {
  assert.equal(normalizeCarrierProfileCode("gs1_qr"), "gs1_digital_link");
  const gs1 = enterpriseCarrierContract("gs1_qr");
  assert.equal(gs1.canonicalCode, "gs1_digital_link");
  assert.equal(gs1.assuranceModel, "declared_identity");
  assert.equal(gs1.requiresBatchKeys, false);

  const nonTt = enterpriseCarrierContract("ntag424_dna");
  assert.equal(nonTt.supportsTamper, false);
  assert.equal(nonTt.tamperEvidenceMode, "none");
  assert.deepEqual(nonTt.allowedProductStates, ["VALID_AUTHENTIC", "REPLAY_SUSPECT", "INVALID"]);
  assert.ok(!nonTt.allowedProductStates.includes("VALID_UNKNOWN_TAMPER"));

  const tt = enterpriseCarrierContract("ntag424_dna_tt");
  assert.equal(tt.supportsTamper, true);
  assert.equal(tt.tamperEvidenceMode, "ttstatus_2byte_or_explicit_manual_evidence");

  const uhf = enterpriseCarrierContract("uhf_rfid");
  assert.equal(uhf.assuranceModel, "declared_logistics");
  assert.equal(uhf.requiresBatchKeys, false);
  assert.equal(uhf.supportsBulkRead, true);
});

test("lab templates cover industrial packaging, secure samples and TT opening evidence", () => {
  assert.equal(packagingLabTemplateFor("seed_bag"), "seed_bag");
  assert.equal(packagingLabTemplateFor("jerry_can"), "jerry_can");
  assert.equal(packagingLabTemplateFor("pallet"), "roll_line");
  assert.equal(packagingLabTemplateFor("other"), "custom");

  const nonTtCodes = packagingLabTemplateTests("seed_bag", "ntag424_dna").map((item) => item.code);
  assert.ok(nonTtCodes.includes("secure_sample_validates"));
  assert.ok(nonTtCodes.includes("replay_rejected"));
  assert.ok(!nonTtCodes.includes("tt_closed"));
  assert.ok(!nonTtCodes.includes("tt_opened"));

  const ttCodes = packagingLabTemplateTests("jerry_can", "ntag424_dna_tt").map((item) => item.code);
  assert.ok(ttCodes.includes("tt_closed"));
  assert.ok(ttCodes.includes("tt_opened"));

  const uhfCodes = packagingLabTemplateTests("roll_line", "uhf_rfid").map((item) => item.code);
  assert.ok(!uhfCodes.includes("secure_sample_validates"));
  assert.ok(uhfCodes.includes("application_speed"));
});

test("AGRO_SECURE_PACKAGING_PILOT is reusable, carrier-aware and never self-approves", () => {
  const nfc = packagingLabPresetFor("AGRO_SECURE_PACKAGING_PILOT", "ntag424_dna");
  assert.equal(nfc.packaging_type, "seed_bag");
  assert.equal(nfc.delivery_format, "transparent_pet");
  assert.equal(nfc.crosses_opening, false);
  assert.equal(nfc.requires_tail_break, false);
  assert.equal(nfc.physical_validation_required, true);
  assert.equal(nfc.raw_key_material_allowed, false);
  assert.match(nfc.placement_zone, /fuera de costuras/i);
  assert.ok(nfc.forbidden_conditions.some((value) => /sin TagTamper/i.test(value)));

  const tt = packagingLabPresetFor("AGRO_SECURE_PACKAGING_PILOT", "ntag424_dna_tt");
  assert.equal(tt.packaging_type, "cap");
  assert.equal(tt.crosses_opening, true);
  assert.equal(tt.requires_tail_break, true);
  assert.match(tt.objective, /TTStatus canonico/i);
  assert.ok(tt.security_truth.some((value) => /solo la prueba fisica/i.test(value)));

  const uhf = packagingLabPresetFor("AGRO_SECURE_PACKAGING_PILOT", "uhf_rfid");
  assert.equal(uhf.packaging_type, "pallet");
  assert.ok(uhf.forbidden_conditions.some((value) => /K_META\/K_FILE/i.test(value)));
  assert.match(uhf.objective, /eventos logisticos declarados/i);

  assert.equal(packagingLabPresetsForCarrier("gs1_qr")[0].carrier_profile_code, "gs1_digital_link");
  assert.throws(() => packagingLabPresetFor("UNREVIEWED_PRESET", "ntag424_dna"), /preset_invalid/);
});

test("approved packaging snapshot projects to a client-safe carrier construction", () => {
  const spec = buildPackagingCarrierSpecFromApprovedSnapshot({
    carrierProfileCode: "ntag424_dna",
    deliveryFormat: "white_label",
    name: "Syngenta pilot construction",
    targetSubstrates: ["woven seed bag"],
    forbiddenConditions: ["metal contact"],
    specSnapshot: {
      inlayForm: "converted_smart_label",
      applicationSurface: "flexible_bag",
      placement: "body",
      applicationMode: "automatic_labeler",
      substrateMaterial: "woven seed bag",
      faceStock: "chemical-resistant synthetic film",
      adhesive: "permanent acrylic qualified for bag substrate",
      liner: "glassine compatible with applicator",
      geometry: { labelWidthMm: 45, labelHeightMm: 30, antennaWidthMm: 40, antennaHeightMm: 24, pitchMm: 33, webWidthMm: 50 },
      roll: { coreDiameterMm: 76, maxOuterDiameterMm: 300, winding: "face_out", unwindDirection: 3, quantityPerRoll: 1000 },
      line: { unitsPerMinute: 120, printerEncoderModel: "qualified encoder" },
      environment: { minTemperatureC: -5, maxTemperatureC: 55, liquidProximity: false, metalProximity: false, outdoorUv: true, chemicalExposure: ["agrochemical splash"] },
      tagTamper: { required: false, bridgesOpening: null, tailLengthMm: null, placementApproved: false },
      qa: { rfSampleApproved: true, lineTrialApproved: true, adhesiveApproved: true, artworkApproved: true, encodingTrialApproved: true },
    },
  });
  assert.equal(spec.carrier_profile_code, "ntag424_dna");
  assert.equal(spec.assurance_model, "sun_sdm");
  assert.equal(spec.tamper_evidence_mode, "none");
  assert.equal(spec.key_material_policy, "batch_sun");
  assert.ok(spec.target_substrates.includes("woven seed bag"));
});

test("evidence references reject raw SUN material and unsafe URLs", () => {
  assert.deepEqual(normalizePackagingEvidenceUrls(["evidence:sha256:abc", "https://evidence.example/report.pdf"]), [
    "evidence:sha256:abc",
    "https://evidence.example/report.pdf",
  ]);
  assert.throws(() => normalizePackagingEvidenceUrls(["https://nexid.example/sun?picc_data=secret"]), /raw_secret|client_safe/);
  assert.throws(() => normalizePackagingEvidenceUrls(["https://user:pass@example.com/report"]), /client_safe/);
  assert.throws(() => normalizePackagingEvidenceUrls(["file:///tmp/kfile.txt"]), /reference_invalid/);
});

test("client reports are real PDF/CSV projections without NFC key material", () => {
  const report = {
    orderName: "Syngenta pilot",
    tenantLabel: "Syngenta",
    carrierProfileCode: "ntag424_dna",
    project: { status: "APPROVED", packaging_type: "seed_bag", sku: "SYN-001", recommendation: "Proceed" },
    carrierSpec: { name: "white label", delivery_format: "white_label", target_substrates: ["woven bag"] },
    placement: { placement_zone: "flat rear zone", crosses_opening: false },
    tests: [{ code: "secure_sample_validates", category: "CRYPTO", name: "Secure sample", target: "valid", result: "pass", status: "PASS", evidence_urls: ["evidence:sha256:abc"] }],
    approval: { receipt_digest: `sha256:${"a".repeat(64)}` },
  };
  const csv = buildPackagingLabCsvReport(report).toString("utf8");
  const pdf = buildPackagingLabPdfReport(report).toString("utf8");
  assert.match(csv, /^"order","project_status","carrier"/);
  assert.match(csv, /secure_sample_validates/);
  assert.match(pdf, /^%PDF-1\.4/);
  for (const output of [csv, pdf]) {
    assert.doesNotMatch(output, /K_META_BATCH|K_FILE_BATCH|PRIVATE_KEY|picc_data=/i);
  }
});
