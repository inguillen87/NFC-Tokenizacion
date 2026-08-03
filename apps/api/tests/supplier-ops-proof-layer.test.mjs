import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const {
  buildSupplierSubBatchPlan,
  generateSupplierBatchKeys,
  buildSupplierEncodingPack,
  buildSupplierManifestTemplate,
  buildSupplierPackPdfSummary,
  buildZipArchive,
  encryptSupplierZipArchive,
  decryptSupplierEncryptedZipForTest,
  validateSupplierManifestQuantity,
  canExportSupplierPack,
  canImportSupplierManifest,
  canActivateSupplierSubBatch,
  resolveSupplierActivationScope,
  canRotateSupplierSubBatchKeys,
} = await import("../src/lib/supplier-ops.ts");
const {
  parseSupplierQaSnapshotReferences,
  validateSupplierQaSunEvidence,
} = await import("../src/lib/supplier-qa-evidence.ts");
const {
  buildSupplierQaVerificationContext,
  canonicalSupplierQaJson,
  SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN,
  SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION,
} = await import("../src/lib/supplier-qa-verification-context.ts");
const { normalizeCarrierProfileCode } = await import("../src/lib/carrier-profiles.ts");
const {
  buildMerkleRoot,
  findForbiddenProofPayloadKey,
  hashEvidencePayload,
  isSha256Hash,
  verifyHashInAnchor,
  verifyHashInMerkleAnchor,
} = await import("../src/lib/proof-layer.ts");
const { parseTagManifest } = await import("../src/lib/tag-manifest.ts");

test("supplier order creates five isolated sub-batches for a 5,000 tag pilot", () => {
  const plan = buildSupplierSubBatchPlan({
    customerSlug: "syngenta",
    orderName: "SYN-AR-2026-001",
    totalQuantity: 5000,
    subBatchSize: 1000,
  });
  assert.deepEqual(plan.map((item) => item.bid), [
    "SYN-AR-2026-001-A",
    "SYN-AR-2026-001-B",
    "SYN-AR-2026-001-C",
    "SYN-AR-2026-001-D",
    "SYN-AR-2026-001-E",
  ]);
  assert.equal(plan.reduce((sum, item) => sum + item.expectedQuantity, 0), 5000);
});

test("supplier keys are random 16-byte hex pairs and pack includes TagTamper config", () => {
  const first = generateSupplierBatchKeys();
  const second = generateSupplierBatchKeys();
  assert.match(first.kMetaHex, /^[0-9A-F]{32}$/);
  assert.match(first.kFileHex, /^[0-9A-F]{32}$/);
  assert.notEqual(first.kMetaHex, second.kMetaHex);
  assert.notEqual(first.kFileHex, second.kFileHex);

  const pack = buildSupplierEncodingPack({
    clientSlug: "syngenta",
    batchId: "SYN-AR-2026-001-A",
    packPurpose: "trial_integration",
    quantity: 1000,
    chipModel: "NTAG 424 DNA TagTamper",
    carrierProfile: "ntag424_dna_tt",
    kMetaHex: first.kMetaHex,
    kFileHex: first.kFileHex,
    urlTemplate: "https://api.nexid.lat/sun?v=1&bid=SYN-AR-2026-001-A&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  });
  assert.match(pack.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(pack.json.TTSTATUS.closed, "4343");
  assert.deepEqual(pack.json.QA_INTEGRATION_GATE, {
    acceptance_scope: "trial_integration_only",
    sample_count: 10,
    selection_authority: "operator_supplied_distinct_manifest_uids_validated_by_server",
    must_pass: ["uid_decode", "cmac_valid", "replay_blocked", "ttstatus_closed_when_supported"],
    physical_ceremony_required: true,
    physical_ceremony_verified: false,
  });
  assert.equal(pack.json.PACK_PURPOSE, "trial_integration");
  assert.equal(pack.json.COMMERCIAL_RELEASE, "NON_SELLABLE_TRIAL");
  assert.equal(pack.json.SALEABLE, false);
  assert.equal(pack.json.PRODUCTION_LOT_ACCEPTANCE.status, "not_applicable_non_sellable_trial");
  assert.equal(pack.json.PRODUCTION_LOT_ACCEPTANCE.integration_gate_is_acceptance, false);
  assert.match(pack.text, /MANIFEST_FORMAT=batch_id,uid_hex/);
  assert.match(pack.text, /QA_INTEGRATION_GATE:/);
  assert.match(pack.text, /PRODUCTION_LOT_ACCEPTANCE:/);

  const smallPack = buildSupplierEncodingPack({
    clientSlug: "trial",
    batchId: "TRIAL-004",
    packPurpose: "trial_integration",
    quantity: 4,
    chipModel: "NTAG 424 DNA",
    carrierProfile: "ntag424_dna",
    kMetaHex: first.kMetaHex,
    kFileHex: first.kFileHex,
    urlTemplate: "https://api.nexid.lat/sun?v=1&bid=TRIAL-004&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  });
  assert.equal(smallPack.json.QA_INTEGRATION_GATE.sample_count, 4);

  const productionPack = buildSupplierEncodingPack({
    clientSlug: "syngenta",
    batchId: "SYN-PROD-001",
    packPurpose: "production",
    quantity: 10000,
    chipModel: "NTAG 424 DNA",
    carrierProfile: "ntag424_dna",
    kMetaHex: first.kMetaHex,
    kFileHex: first.kFileHex,
    urlTemplate: "https://api.nexid.lat/sun?v=1&bid=SYN-PROD-001&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  });
  assert.equal(productionPack.json.QA_INTEGRATION_GATE, null);
  assert.equal(productionPack.json.COMMERCIAL_RELEASE, "BLOCKED_PENDING_PRODUCTION_QA");
  assert.equal(productionPack.json.PRODUCTION_LOT_ACCEPTANCE.status, "blocked_pending_tenant_qa_plan");
  assert.equal(productionPack.json.SALEABLE, false);
  const approvedProductionPack = buildSupplierEncodingPack({
    clientSlug: "syngenta",
    batchId: "SYN-PROD-001",
    packPurpose: "production",
    productionQaPlanApproved: true,
    quantity: 10000,
    chipModel: "NTAG 424 DNA",
    carrierProfile: "ntag424_dna",
    kMetaHex: first.kMetaHex,
    kFileHex: first.kFileHex,
    urlTemplate: "https://api.nexid.lat/sun?v=1&bid=SYN-PROD-001&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  });
  assert.equal(approvedProductionPack.json.COMMERCIAL_RELEASE, "BLOCKED_PENDING_RECEIVING_QA");
  assert.equal(approvedProductionPack.json.PRODUCTION_LOT_ACCEPTANCE.status, "pending_receiving_qa");
  assert.equal(approvedProductionPack.json.PRODUCTION_LOT_ACCEPTANCE.qa_plan_approved, true);
  assert.equal(approvedProductionPack.json.SALEABLE, false);
  assert.throws(
    () => buildSupplierEncodingPack({ ...productionPack.json, packPurpose: "" }),
    /supplier_pack_purpose_invalid/,
  );
});

test("non-cryptographic supplier profiles never expose 424 batch keys", () => {
  const ntagPack = buildSupplierEncodingPack({
    clientSlug: "balmec",
    batchId: "BALMEC-EVENT-A",
    packPurpose: "trial_integration",
    quantity: 500,
    chipModel: "NTAG215 wristband",
    carrierProfile: "event_wristband",
    urlTemplate: "https://nexid.lat/t/BALMEC-EVENT-A/<UID_HEX>",
  });
  assert.doesNotMatch(ntagPack.text, /K_META_BATCH=/);
  assert.doesNotMatch(ntagPack.text, /K_FILE_BATCH=/);
  assert.equal(ntagPack.json.QA_INTEGRATION_GATE, null);
  assert.doesNotMatch(ntagPack.text, /QA_INTEGRATION_GATE/);
  assert.match(ntagPack.text, /KEY_MATERIAL=NO_BATCH_KEYS_REQUIRED_FOR_THIS_PROFILE/);
  assert.match(ntagPack.text, /MANIFEST_FORMAT=batch_id,uid_hex,carrier_profile_code,attendee_ref,zone,valid_from,valid_until/);
  assert.equal("K_META_BATCH" in ntagPack.json, false);
  assert.equal("K_FILE_BATCH" in ntagPack.json, false);

  const gs1Pack = buildSupplierEncodingPack({
    clientSlug: "syngenta",
    batchId: "SYN-GS1-A",
    packPurpose: "trial_integration",
    quantity: 1000,
    chipModel: "GS1 Digital Link label",
    carrierProfile: "gs1_digital_link",
    urlTemplate: "https://nexid.lat/01/<GTIN>/10/<LOT>/21/<SERIAL>",
  });
  assert.doesNotMatch(gs1Pack.text, /K_META_BATCH=/);
  assert.doesNotMatch(gs1Pack.text, /K_FILE_BATCH=/);
  assert.match(gs1Pack.text, /GTIN, lot and serial in manifest/);
  assert.equal(gs1Pack.json.KEY_MATERIAL, "NO_BATCH_KEYS_REQUIRED_FOR_THIS_PROFILE");
  assert.equal("K_META_BATCH" in gs1Pack.json, false);
  assert.equal("K_FILE_BATCH" in gs1Pack.json, false);
});

test("supplier manifest templates are deterministic and carrier-specific", () => {
  const secure = buildSupplierManifestTemplate({
    carrierProfile: "ntag424_dna_tt",
    batchId: "syn-tt-a",
  });
  assert.equal(secure.filename, "manifest-template.csv");
  assert.equal(secure.batchId, "SYN-TT-A");
  assert.deepEqual(secure.headers.slice(0, 7), [
    "batch_id", "uid_hex", "carrier_profile_code", "sun_url", "picc_data", "enc", "cmac",
  ]);
  assert.ok(secure.headers.includes("tt_status_hex"));
  assert.equal(secure.csv, `${secure.headers.join(",")}\n`);
  assert.match(secure.contentHash, /^sha256:[0-9a-f]{64}$/);

  const gs1 = buildSupplierManifestTemplate({
    carrierProfile: "gs1_digital_link",
    batchId: "syn-gs1-a",
  });
  assert.ok(gs1.headers.includes("gtin"));
  assert.ok(gs1.headers.includes("lot"));
  assert.ok(gs1.headers.includes("serial"));
  assert.equal(gs1.headers.includes("picc_data"), false);

  const uhf = buildSupplierManifestTemplate({
    carrierProfile: "uhf_rfid",
    batchId: "syn-uhf-a",
  });
  assert.ok(uhf.headers.includes("epc"));
  assert.ok(uhf.headers.includes("pallet_id"));
  assert.notEqual(uhf.contentHash, gs1.contentHash);
});

test("carrier profile normalization supports logistics, events and IoT profiles", () => {
  assert.equal(normalizeCarrierProfileCode("UHF EPC RFID"), "uhf_rfid");
  assert.equal(normalizeCarrierProfileCode("Pulsera festival NFC"), "event_wristband");
  assert.equal(normalizeCarrierProfileCode("hotel keycard"), "hotel_keycard");
  assert.equal(normalizeCarrierProfileCode("temperature sensor logger"), "iot_tracker_placeholder");
});

test("supplier pack export can be delivered as encrypted ZIP without plaintext keys in the envelope", () => {
  const keys = generateSupplierBatchKeys();
  const pack = buildSupplierEncodingPack({
    clientSlug: "syngenta",
    batchId: "SYN-AR-2026-001-A",
    packPurpose: "trial_integration",
    quantity: 1000,
    chipModel: "NTAG 424 DNA",
    carrierProfile: "ntag424_dna",
    kMetaHex: keys.kMetaHex,
    kFileHex: keys.kFileHex,
    urlTemplate: "https://api.nexid.lat/sun?v=1&bid=SYN-AR-2026-001-A&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  });
  const jsonBody = JSON.stringify(pack.json, null, 2);
  const pdf = buildSupplierPackPdfSummary({
    clientSlug: "syngenta",
    batchId: "SYN-AR-2026-001-A",
    packPurpose: "trial_integration",
    commercialDisposition: "NON_SELLABLE",
    activationAllowed: false,
    quantity: 1000,
    chipModel: "NTAG 424 DNA",
    carrierProfile: "ntag424_dna",
    keyFingerprint: keys.fingerprint,
    contentHash: pack.contentHash,
    jsonHash: "sha256:" + "a".repeat(64),
    urlTemplate: "https://api.nexid.lat/sun?v=1&bid=SYN-AR-2026-001-A&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  });
  assert.equal(pdf.subarray(0, 8).toString("utf8"), "%PDF-1.4");
  assert.match(pdf.toString("utf8"), /NON_SELLABLE - TRIAL INTEGRATION ONLY/);
  assert.match(pdf.toString("utf8"), /Activation allowed: false/);

  const manifestTemplate = buildSupplierManifestTemplate({
    carrierProfile: "ntag424_dna",
    batchId: "SYN-AR-2026-001-A",
  });
  const zip = buildZipArchive([
    { path: "README_FIRST.txt", data: "nexID supplier pack\n" },
    { path: "SYN-AR-2026-001-A/SYN-AR-2026-001-A_supplier_encoding_pack.txt", data: pack.text },
    { path: "SYN-AR-2026-001-A/SYN-AR-2026-001-A_supplier_encoding_pack.json", data: jsonBody },
    { path: "SYN-AR-2026-001-A/SYN-AR-2026-001-A_supplier_encoding_summary.pdf", data: pdf },
    { path: `SYN-AR-2026-001-A/${manifestTemplate.filename}`, data: manifestTemplate.csv },
  ]);
  assert.equal(zip.subarray(0, 2).toString("utf8"), "PK");
  assert.match(zip.toString("utf8"), /README_FIRST\.txt/);
  assert.match(zip.toString("utf8"), /manifest-template\.csv/);
  assert.match(zip.toString("utf8"), /picc_data,enc,cmac/);
  assert.match(zip.toString("utf8"), new RegExp(keys.kMetaHex));

  const encrypted = encryptSupplierZipArchive(zip, "nexID-SYN-AR-2026-001-A-TEST", { bid: "SYN-AR-2026-001-A" });
  const envelope = encrypted.envelopeBuffer.toString("utf8");
  assert.doesNotMatch(envelope, new RegExp(keys.kMetaHex));
  assert.doesNotMatch(envelope, new RegExp(keys.kFileHex));
  assert.match(encrypted.envelopeHash, /^sha256:[0-9a-f]{64}$/);

  const decrypted = decryptSupplierEncryptedZipForTest(encrypted.envelopeBuffer, "nexID-SYN-AR-2026-001-A-TEST");
  assert.equal(decrypted.subarray(0, 2).toString("utf8"), "PK");
  assert.equal(decrypted.equals(zip), true);
});

test("production supplier PDF carries the QA plan approval and remains pending receiving QA", () => {
  const pdf = buildSupplierPackPdfSummary({
    clientSlug: "syngenta",
    batchId: "SYN-PROD-2026-001",
    packPurpose: "production",
    commercialDisposition: "PENDING_RECEIVING_QA",
    activationAllowed: false,
    quantity: 10000,
    chipModel: "NTAG 424 DNA TT",
    carrierProfile: "ntag424_dna_tt",
    keyFingerprint: "sha256:" + "1".repeat(64),
    contentHash: "sha256:" + "2".repeat(64),
    jsonHash: "sha256:" + "3".repeat(64),
    urlTemplate: "https://api.nexid.lat/sun?v=1&bid=SYN-PROD-2026-001&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
    productionQaPlanApproval: {
      plan_id: "11111111-1111-4111-8111-111111111111",
      plan_revision: 2,
      plan_digest: "sha256:" + "4".repeat(64),
      decision_id: "22222222-2222-4222-8222-222222222222",
      decision_schema: "supplier-production-qa-plan-decision/v1",
      approved_by: "quality@syngenta.example",
      approved_at: "2026-08-01T15:00:00.000Z",
      approval_evidence_ref: "artifact://syngenta/qa-plan/2",
      approval_evidence_sha256: "sha256:" + "5".repeat(64),
      lot_size: 10000,
      inspection_level: "II",
      target_aql: "1.000",
      sample_size: 200,
      accept_number: 5,
      reject_number: 6,
      policy_reference: "SYNGENTA-QA-2026-R2",
      policy_document_sha256: "sha256:" + "6".repeat(64),
      stratification_dimension: "roll_id",
      cryptographic_sample_size: 10,
    },
    productionQaPlanApprovalReceiptHash: "sha256:" + "7".repeat(64),
  });

  const body = pdf.toString("utf8");
  assert.match(body, /PENDING_RECEIVING_QA - PRODUCTION ENCODING ONLY/);
  assert.match(body, /Activation allowed: false/);
  assert.match(body, /Production QA plan: 11111111-1111-4111-8111-111111111111 rev 2/);
  assert.match(body, /Plan approval decision: 22222222-2222-4222-8222-222222222222/);
  assert.match(body, new RegExp("Approval receipt hash: sha256:" + "7".repeat(64)));
  assert.match(body, /Receiving QA: lot 10000; sample 200; Ac 5; Re 6/);
});

test("supplier manifest gate rejects quantity mismatch before activation", () => {
  const manifest = parseTagManifest("batch_id,uid_hex\nSYN-AR-2026-001-A,04AABBCCDD1090\n", "SYN-AR-2026-001-A");
  const gate = validateSupplierManifestQuantity(manifest, 1000);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, "quantity_mismatch");
  assert.equal(gate.expected, 1000);
  assert.equal(gate.received, 1);
});

const FUTURE_PRODUCTION_ACCEPTANCE_V2 = Object.freeze({
  schemaVersion: "supplier-production-acceptance/v2",
  status: "passed",
  receiptId: "77777777-7777-4777-8777-777777777777",
});

test("supplier activation gate requires imported manifest, QA and matching count", () => {
  const commercialScope = {
    effectivePackPurpose: "production",
    productionAcceptanceV2: FUTURE_PRODUCTION_ACCEPTANCE_V2,
  };
  assert.equal(canActivateSupplierSubBatch({ ...commercialScope, manifestStatus: "pending", qaStatus: "passed", expectedQuantity: 1000, manifestCount: 1000 }).reason, "manifest_not_imported");
  assert.equal(canActivateSupplierSubBatch({ ...commercialScope, manifestStatus: "imported", qaStatus: "pending", expectedQuantity: 1000, manifestCount: 1000 }).reason, "qa_not_passed");
  assert.equal(canActivateSupplierSubBatch({ ...commercialScope, manifestStatus: "imported", qaStatus: "passed", expectedQuantity: 1000, manifestCount: 999 }).reason, "manifest_quantity_mismatch");
  assert.equal(canActivateSupplierSubBatch({ ...commercialScope, manifestStatus: "imported", qaStatus: "passed", expectedQuantity: 1000, manifestCount: 1000 }).ok, true);
});

test("supplier purpose and production acceptance are hard gates that no override can bypass", () => {
  const overrideAttempt = {
    manifestStatus: "imported",
    qaStatus: "passed",
    expectedQuantity: 1000,
    manifestCount: 1000,
    overrideReason: "customer-approved corrective activation",
    overrideBy: "security-operator@nexid",
  };
  const legacy = canActivateSupplierSubBatch({
    ...overrideAttempt,
    effectivePackPurpose: "legacy_unclassified",
  });
  assert.equal(legacy.ok, false);
  assert.equal(legacy.reason, "supplier_pack_purpose_unclassified");
  assert.equal(legacy.hardGate, true);
  assert.equal(legacy.override, false);

  const trial = canActivateSupplierSubBatch({
    ...overrideAttempt,
    effectivePackPurpose: "trial_integration",
  });
  assert.equal(trial.ok, false);
  assert.equal(trial.reason, "supplier_trial_integration_non_sellable");
  assert.equal(trial.hardGate, true);
  assert.equal(trial.override, false);

  const productionWithoutV2 = canActivateSupplierSubBatch({
    ...overrideAttempt,
    effectivePackPurpose: "production",
    productionAcceptanceV2: null,
  });
  assert.equal(productionWithoutV2.ok, false);
  assert.equal(productionWithoutV2.reason, "supplier_production_acceptance_v2_required");
  assert.equal(productionWithoutV2.hardGate, true);
  assert.equal(productionWithoutV2.override, false);
});

test("supplier activation scope requires one coherent tenant, order, sub-batch, batch and BID link", () => {
  const batch = {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    bid: "SYN-AR-2026-001-A",
    supplierOrderId: "33333333-3333-4333-8333-333333333333",
    supplierSubBatchId: "44444444-4444-4444-8444-444444444444",
  };
  const candidate = {
    id: batch.supplierSubBatchId,
    tenantId: batch.tenantId,
    supplierOrderId: batch.supplierOrderId,
    batchId: batch.id,
    bid: batch.bid.toLowerCase(),
    declaredPackPurpose: "legacy_unclassified",
    orderPackPurpose: "legacy_unclassified",
    effectivePackPurpose: "trial_integration",
    classificationDecisionId: "55555555-5555-4555-8555-555555555555",
  };

  const exact = resolveSupplierActivationScope({ batch, candidates: [candidate] });
  assert.equal(exact.ok, true);
  assert.equal(exact.supplierSubBatch?.effectivePackPurpose, "trial_integration");

  const reverseOnly = resolveSupplierActivationScope({
    batch: { ...batch, supplierOrderId: null, supplierSubBatchId: null },
    candidates: [candidate],
  });
  assert.equal(reverseOnly.ok, false);
  assert.equal(reverseOnly.reason, "supplier_commercial_scope_invalid");

  const tenantMismatch = resolveSupplierActivationScope({
    batch,
    candidates: [{ ...candidate, tenantId: "66666666-6666-4666-8666-666666666666" }],
  });
  assert.equal(tenantMismatch.ok, false);
  assert.equal(tenantMismatch.reason, "supplier_commercial_scope_invalid");

  const duplicateBidScope = resolveSupplierActivationScope({ batch, candidates: [candidate, candidate] });
  assert.equal(duplicateBidScope.ok, false);
  assert.equal(duplicateBidScope.candidateCount, 2);
});

test("supplier pack and manifest gates are one-time production controls", () => {
  assert.equal(canExportSupplierPack({ exportCount: 0, keyExportCount: 0, bid: "SYN-AR-2026-001-A" }).ok, true);
  const exportedByBatchKeys = canExportSupplierPack({ exportCount: 1, keyExportCount: 0, bid: "SYN-AR-2026-001-A" });
  assert.equal(exportedByBatchKeys.ok, false);
  assert.equal(exportedByBatchKeys.reason, "supplier_pack_already_exported");
  assert.equal(exportedByBatchKeys.bid, "SYN-AR-2026-001-A");

  const exportedBySubBatch = canExportSupplierPack({ exportCount: 0, keyExportCount: 1, bid: "SYN-AR-2026-001-B" });
  assert.equal(exportedBySubBatch.ok, false);
  assert.equal(exportedBySubBatch.reason, "supplier_pack_already_exported");

  assert.equal(canImportSupplierManifest({ manifestStatus: "pending" }).ok, true);
  assert.equal(canImportSupplierManifest({ manifestStatus: "imported" }).reason, "supplier_manifest_already_imported");
});

test("supplier key rotation is allowed only before export, manifest, QA and activation", () => {
  assert.equal(canRotateSupplierSubBatchKeys({
    keyExportCount: 0,
    batchKeyExportCount: 0,
    manifestStatus: "pending",
    manifestCount: 0,
    qaStatus: "pending",
    subBatchStatus: "pack_ready",
    batchStatus: "production_registered",
  }).ok, true);
  assert.equal(canRotateSupplierSubBatchKeys({ keyExportCount: 1 }).reason, "supplier_keys_already_exported");
  assert.equal(canRotateSupplierSubBatchKeys({ batchKeyExportCount: 1 }).reason, "supplier_keys_already_exported");
  assert.equal(canRotateSupplierSubBatchKeys({ manifestStatus: "imported" }).reason, "supplier_manifest_already_imported");
  assert.equal(canRotateSupplierSubBatchKeys({ manifestCount: 1 }).reason, "supplier_manifest_already_imported");
  assert.equal(canRotateSupplierSubBatchKeys({ qaStatus: "passed" }).reason, "supplier_qa_already_passed");
  assert.equal(canRotateSupplierSubBatchKeys({ subBatchStatus: "activated" }).reason, "supplier_batch_already_activated");
  assert.equal(canRotateSupplierSubBatchKeys({ batchStatus: "active_in_market" }).reason, "supplier_batch_already_activated");
});

test("supplier activation override requires explicit audit fields", () => {
  const blocked = canActivateSupplierSubBatch({
    effectivePackPurpose: "production",
    productionAcceptanceV2: FUTURE_PRODUCTION_ACCEPTANCE_V2,
    manifestStatus: "pending",
    qaStatus: "pending",
    expectedQuantity: 1000,
    manifestCount: 0,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "manifest_not_imported");

  const unaudited = canActivateSupplierSubBatch({
    effectivePackPurpose: "production",
    productionAcceptanceV2: FUTURE_PRODUCTION_ACCEPTANCE_V2,
    manifestStatus: "pending",
    qaStatus: "pending",
    expectedQuantity: 1000,
    manifestCount: 0,
    overrideReason: "urgent",
  });
  assert.equal(unaudited.ok, false);
  assert.equal(unaudited.reason, "supplier_activation_override_audit_required");

  const override = canActivateSupplierSubBatch({
    effectivePackPurpose: "production",
    productionAcceptanceV2: FUTURE_PRODUCTION_ACCEPTANCE_V2,
    manifestStatus: "pending",
    qaStatus: "pending",
    expectedQuantity: 1000,
    manifestCount: 0,
    overrideReason: "customer-approved corrective activation",
    overrideBy: "security-operator@nexid",
  });
  assert.equal(override.ok, true);
  assert.equal(override.override, true);
  assert.deepEqual(override.blockedReasons.map((item) => item.reason), [
    "manifest_not_imported",
    "qa_not_passed",
    "manifest_quantity_mismatch",
  ]);
});

const QA_BID = "SYN-AR-2026-001-A";
const QA_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const QA_BATCH_ID = "22222222-2222-4222-8222-222222222222";
const QA_MANIFEST_IMPORTED_AT = "2026-07-29T09:59:00.000Z";
const QA_EVALUATED_AT = "2026-07-29T11:00:00.000Z";
const QA_MANIFEST_HASH = `sha256:${"a".repeat(64)}`;
const QA_KEY_FINGERPRINT = "B".repeat(16);
const QA_CONTEXT_INPUT = {
  tenantId: QA_TENANT_ID,
  batchId: QA_BATCH_ID,
  bid: QA_BID,
  manifestHash: QA_MANIFEST_HASH,
  carrierProfileCode: "ntag424_dna_tt",
  keyFingerprint: QA_KEY_FINGERPRINT,
  sdmConfig: { mac_input: "picc_enc" },
  supplierOrderId: "33333333-3333-4333-8333-333333333333",
  supplierSubBatchId: "44444444-4444-4444-8444-444444444444",
  supplierSubBatchStatus: "manifest_received",
  batchStatus: "planned",
  keyExportCount: 1,
  keyExportedAt: "2026-07-29T09:00:00.000000Z",
  batchKeyExportCount: 1,
  batchKeyExportedAt: "2026-07-29T09:00:00.000000Z",
  packagingGovernanceStatus: "approved",
  packagingSpecRevision: 1,
  packagingSpecHash: `sha256:${"d".repeat(64)}`,
  packPurpose: "trial_integration",
};
const QA_VERIFICATION_CONTEXT = buildSupplierQaVerificationContext(QA_CONTEXT_INPUT);
assert.ok(QA_VERIFICATION_CONTEXT);
const QA_CARRIER_CONFIG_DIGEST = QA_VERIFICATION_CONTEXT.carrierConfigDigest;
const QA_VERIFICATION_CONTEXT_DIGEST = QA_VERIFICATION_CONTEXT.verificationContextDigest;

test("supplier QA verification context is canonical, domain-separated and purpose-bound", () => {
  const normalizedReplay = buildSupplierQaVerificationContext({
    ...QA_CONTEXT_INPUT,
    bid: QA_BID.toLowerCase(),
    manifestHash: QA_MANIFEST_HASH.toUpperCase(),
    carrierProfileCode: "NTAG424_DNA_TT",
    keyFingerprint: QA_KEY_FINGERPRINT.toLowerCase(),
    packPurpose: "TRIAL_INTEGRATION",
  });
  const production = buildSupplierQaVerificationContext({
    ...QA_CONTEXT_INPUT,
    packPurpose: "production",
  });

  assert.equal(QA_VERIFICATION_CONTEXT.domain, SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN);
  assert.equal(QA_VERIFICATION_CONTEXT.schemaVersion, SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION);
  assert.equal(normalizedReplay?.verificationContextDigest, QA_VERIFICATION_CONTEXT_DIGEST);
  assert.notEqual(production?.verificationContextDigest, QA_VERIFICATION_CONTEXT_DIGEST);
  assert.equal(production?.acceptanceScope, "production_lot");
  assert.equal(buildSupplierQaVerificationContext({ ...QA_CONTEXT_INPUT, packPurpose: null }), null);
});

test("supplier QA verification context v2 canonicalizes nested JSON and binds every mutable prerequisite", () => {
  assert.equal(
    canonicalSupplierQaJson({ z: 1, a: { "β": 2, a: 3 }, list: [{ b: true, a: null }] }),
    '{"a":{"a":3,"β":2},"list":[{"a":null,"b":true}],"z":1}',
  );

  const reorderedConfig = buildSupplierQaVerificationContext({
    ...QA_CONTEXT_INPUT,
    sdmConfig: { nested: { z: 2, a: 1 }, mac_input: "picc_enc" },
  });
  const sameConfigDifferentInsertionOrder = buildSupplierQaVerificationContext({
    ...QA_CONTEXT_INPUT,
    sdmConfig: { mac_input: "picc_enc", nested: { a: 1, z: 2 } },
  });
  assert.equal(
    reorderedConfig?.verificationContextDigest,
    sameConfigDifferentInsertionOrder?.verificationContextDigest,
  );

  const mutations = [
    { tenantId: "99999999-9999-4999-8999-999999999999" },
    { batchId: "99999999-9999-4999-8999-999999999999" },
    { bid: "SYN-AR-2026-001-B" },
    { manifestHash: `sha256:${"f".repeat(64)}` },
    { carrierProfileCode: "ntag424_dna" },
    { keyFingerprint: "C".repeat(16) },
    { sdmConfig: { mac_input: "different" } },
    { supplierOrderId: "99999999-9999-4999-8999-999999999999" },
    { supplierSubBatchId: "99999999-9999-4999-8999-999999999999" },
    { supplierSubBatchStatus: "qa_pending" },
    { batchStatus: "production_registered" },
    { keyExportCount: 2 },
    { keyExportedAt: "2026-07-29T09:00:01.000000Z" },
    { batchKeyExportCount: 2 },
    { batchKeyExportedAt: "2026-07-29T09:00:01.000000Z" },
    { packagingGovernanceStatus: "pending" },
    { packagingSpecRevision: 2 },
    { packagingSpecHash: `sha256:${"e".repeat(64)}` },
    { packPurpose: "production" },
  ];
  for (const mutation of mutations) {
    const changed = buildSupplierQaVerificationContext({ ...QA_CONTEXT_INPUT, ...mutation });
    assert.notEqual(
      changed?.verificationContextDigest,
      QA_VERIFICATION_CONTEXT_DIGEST,
      `mutation must change digest: ${Object.keys(mutation)[0]}`,
    );
  }
});

function qaUid(index) {
  return index.toString(16).toUpperCase().padStart(14, "0");
}

function qaDiagnostic({
  id,
  uid,
  counter,
  eventId,
  second,
  replayOriginalEventId = null,
  state = "VALID_CLOSED",
  tamperStatus = "CLOSED",
  tamperOpened = false,
  source = "enc_decrypted",
  crypto = true,
  tenantId = QA_TENANT_ID,
  batchId = QA_BATCH_ID,
  bid = QA_BID,
  lifecycleState = "inactive",
}) {
  const replay = replayOriginalEventId != null;
  const result = replay ? "REPLAY_SUSPECT" : state;
  const eventCreatedAt = new Date(Date.parse("2026-07-29T10:00:00.000Z") + second * 1000).toISOString();
  const diagnosticCreatedAt = new Date(Date.parse(eventCreatedAt) + 250).toISOString();
  return {
    id,
    trace_id: `trace-${id}`,
    created_at: diagnosticCreatedAt,
    bid,
    uid_hex: uid,
    read_counter: counter,
    auth_status: replay ? "REPLAY_SUSPECT" : "VALID",
    replay_status: replay ? "REPLAY_SUSPECT" : "NO_REPLAY",
    product_state: replay ? "REPLAY_SUSPECT" : state,
    tamper_status: tamperStatus,
    tamper_opened: tamperOpened,
    tagtamper_config_detected: true,
    evidence_source: "public_sun_route",
    manifest_uid_match: true,
    manifest_tag_lifecycle_state: lifecycleState,
    event_id: eventId,
    event_created_at: eventCreatedAt,
    event_tenant_id: tenantId,
    event_batch_id: batchId,
    event_bid: bid,
    event_uid_hex: uid,
    event_counter: counter,
    event_cmac_ok: crypto,
    event_source: "real",
    event_result: result,
    replay_original_event_id: replayOriginalEventId == null ? null : String(replayOriginalEventId),
    result_json: {
      raw_result: {
        ok: !replay,
        tenant_id: tenantId,
        bid,
        uid,
        ctr: counter,
        result,
        auth_status: replay ? "REPLAY_SUSPECT" : "VALID",
        tag_status: "inactive",
        product_state: replay ? "REPLAY_SUSPECT" : state,
        tamper_status: tamperStatus,
        tamper_opened: tamperOpened,
        tag_tamper_config_detected: true,
        event_id: eventId,
        side_effect_mode: "persist",
        cryptographic_verification: crypto,
        tag_tamper: {
          verified: crypto,
          source,
          raw: tamperStatus === "OPENED" ? "0101" : "0000",
        },
        sun_diagnostics: {
          side_effect_mode: "persist",
          verification_method: "sun_crypto",
          cmac_valid: crypto,
          sdm_decryption_ok: crypto,
          uid_decoded: crypto,
          uid_hex: uid,
          read_counter: counter,
          verification_context_domain: SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN,
          verification_context_version: SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION,
          verification_context_digest: QA_VERIFICATION_CONTEXT_DIGEST,
        },
      },
    },
  };
}

function buildQaFixture({ count = 10, includeOpened = true } = {}) {
  const diagnostics = [];
  const urls = [];
  for (let index = 1; index <= count; index += 1) {
    const uid = qaUid(index);
    const acceptedEventId = 1000 + index;
    const acceptedId = 100 + index;
    const replayId = 200 + index;
    diagnostics.push(qaDiagnostic({ id: acceptedId, uid, counter: index, eventId: acceptedEventId, second: index * 3 }));
    diagnostics.push(qaDiagnostic({
      id: replayId,
      uid,
      counter: index,
      eventId: 2000 + index,
      second: index * 3 + 1,
      replayOriginalEventId: acceptedEventId,
      state: "REPLAY_SUSPECT",
      tamperStatus: "CLOSED",
    }));
    urls.push(`https://nexid.lat/sun?snapshot=${acceptedId}&trace=trace-${acceptedId}`);
    urls.push(`https://nexid.lat/sun?snapshot=${replayId}&trace=trace-${replayId}`);
  }
  if (includeOpened && count > 0) {
    const openedId = 301;
    diagnostics.push(qaDiagnostic({
      id: openedId,
      uid: qaUid(1),
      counter: 2,
      eventId: 3001,
      second: 40,
      state: "VALID_OPENED",
      tamperStatus: "OPENED",
      tamperOpened: true,
      lifecycleState: "revoked",
    }));
    urls.push(`https://nexid.lat/sun?snapshot=${openedId}&trace=trace-${openedId}`);
  }
  const parsed = parseSupplierQaSnapshotReferences(urls);
  assert.equal(parsed.ok, true);
  return { diagnostics, references: parsed.references };
}

function validateQaFixture(fixture, overrides = {}) {
  return validateSupplierQaSunEvidence({
    references: fixture.references,
    diagnostics: fixture.diagnostics,
    expectedBid: QA_BID,
    expectedTenantId: QA_TENANT_ID,
    expectedBatchId: QA_BATCH_ID,
    expectedQuantity: 1000,
    manifestHash: QA_MANIFEST_HASH,
    carrierProfileCode: "ntag424_dna_tt",
    keyFingerprint: QA_KEY_FINGERPRINT,
    carrierConfigDigest: QA_CARRIER_CONFIG_DIGEST,
    verificationContextDigest: QA_VERIFICATION_CONTEXT_DIGEST,
    manifestImportedAt: QA_MANIFEST_IMPORTED_AT,
    evaluatedAt: QA_EVALUATED_AT,
    requiresTtstatus: true,
    requiresSecureSun: true,
    ...overrides,
  });
}

test("supplier QA accepts only result-page snapshot and trace references", () => {
  assert.equal(parseSupplierQaSnapshotReferences([]).reason, "qa_snapshot_evidence_required");
  assert.equal(parseSupplierQaSnapshotReferences([
    "https://api.nexid.lat/sun?v=1&bid=SYN-AR-2026-001-A&picc_data=0011&enc=AABB&cmac=0102",
  ]).reason, "qa_snapshot_id_required");
  const parsed = parseSupplierQaSnapshotReferences([
    "https://nexid.lat/sun?snapshot=101&trace=trace-101&fresh=must-not-be-stored",
    "https://nexid.lat/sun?snapshot=101&trace=trace-101&fresh=duplicate",
  ]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.references.length, 1);
  assert.equal(
    parsed.references[0].referenceHash,
    `sha256:${createHash("sha256").update("supplier-qa-sun/v1\u0000101\u0000trace-101", "utf8").digest("hex")}`,
  );
  assert.doesNotMatch(JSON.stringify(parsed.references), /must-not-be-stored|duplicate/);
});

test("supplier QA derives ten UID, canonical replay and electronic TagTamper evidence server-side", () => {
  const fixture = buildQaFixture();
  const gate = validateQaFixture(fixture);
  assert.equal(gate.ok, true);
  assert.equal(gate.sampleCount, 10);
  assert.equal(gate.replayChecked, true);
  assert.equal(gate.ttstatusChecked, true);
  assert.equal(gate.evidence.server_verified_sun_evidence, true);
  assert.equal(gate.evidence.physical_ceremony_verified, false);
  assert.match(gate.evidenceDigest, /^sha256:[0-9a-f]{64}$/);
  for (let index = 1; index <= 10; index += 1) {
    assert.doesNotMatch(JSON.stringify(gate.evidence), new RegExp(qaUid(index)));
  }
});

test("supplier QA accepts cryptographically verified pre-activation NOT_ACTIVE samples", () => {
  const fixture = buildQaFixture();
  for (const row of fixture.diagnostics.filter((candidate) => candidate.id >= 101 && candidate.id <= 110)) {
    row.auth_status = "NOT_ACTIVE";
    row.event_result = "NOT_ACTIVE";
    row.result_json.raw_result.result = "NOT_ACTIVE";
    row.result_json.raw_result.auth_status = "NOT_ACTIVE";
    row.result_json.raw_result.tag_status = "inactive";
  }
  const gate = validateQaFixture(fixture);
  assert.equal(gate.ok, true);
  assert.equal(gate.sampleCount, 10);
  assert.equal(gate.evidence.physical_ceremony_verified, false);
});

test("supplier QA rejects duplicate UIDs and replays without canonical original-event linkage", () => {
  const tooSmall = buildQaFixture({ count: 9 });
  assert.equal(validateQaFixture(tooSmall).reason, "qa_unique_manifest_uids_required");

  const unlinked = buildQaFixture();
  unlinked.diagnostics.find((row) => row.id === 201).replay_original_event_id = "999999";
  assert.equal(validateQaFixture(unlinked).reason, "qa_replay_pair_required");
});

test("supplier QA rejects manual or missing electronic TagTamper transitions", () => {
  const noOpened = buildQaFixture({ includeOpened: false });
  assert.equal(validateQaFixture(noOpened).reason, "qa_tt_opened_transition_required");

  const sellableOpened = buildQaFixture();
  sellableOpened.diagnostics.find((row) => row.id === 301).manifest_tag_lifecycle_state = "inactive";
  assert.equal(validateQaFixture(sellableOpened).reason, "qa_tt_sacrificial_tag_must_be_revoked");

  const manual = buildQaFixture();
  const opened = manual.diagnostics.find((row) => row.id === 301);
  opened.product_state = "VALID_MANUAL_OPENED";
  opened.event_result = "VALID_MANUAL_OPENED";
  opened.result_json.raw_result.result = "VALID_MANUAL_OPENED";
  opened.result_json.raw_result.product_state = "VALID_MANUAL_OPENED";
  opened.result_json.raw_result.tag_tamper.source = "manual";
  assert.equal(validateQaFixture(manual).reason, "qa_tt_opened_transition_required");

  const staleOpening = buildQaFixture();
  const staleRow = staleOpening.diagnostics.find((row) => row.id === 301);
  staleRow.event_id = 999;
  staleRow.result_json.raw_result.event_id = 999;
  staleRow.event_created_at = "2026-07-29T10:00:01.000Z";
  assert.equal(validateQaFixture(staleOpening).reason, "qa_tt_opened_transition_required");
});

test("supplier QA rejects demo-like, cross-tenant, stale and non-cryptographic evidence", () => {
  const wrongTenant = buildQaFixture();
  wrongTenant.diagnostics[0].event_tenant_id = "33333333-3333-4333-8333-333333333333";
  assert.equal(validateQaFixture(wrongTenant).reason, "qa_canonical_event_scope_mismatch");

  const nonCrypto = buildQaFixture();
  nonCrypto.diagnostics[0].result_json.raw_result.cryptographic_verification = false;
  assert.equal(validateQaFixture(nonCrypto).reason, "qa_cryptographic_sun_verification_required");

  const demo = buildQaFixture();
  demo.diagnostics[0].event_source = "demo";
  assert.equal(validateQaFixture(demo).reason, "qa_canonical_event_scope_mismatch");

  const stale = buildQaFixture();
  assert.equal(validateQaFixture(stale, { evaluatedAt: "2026-08-10T11:00:00.000Z" }).reason, "qa_snapshot_outside_evidence_window");

  const missingCounter = buildQaFixture();
  missingCounter.diagnostics[0].read_counter = null;
  missingCounter.diagnostics[0].event_counter = null;
  missingCounter.diagnostics[0].result_json.raw_result.ctr = null;
  assert.equal(validateQaFixture(missingCounter).reason, "qa_snapshot_counter_required");

  const rawIdentityMismatch = buildQaFixture();
  rawIdentityMismatch.diagnostics[0].result_json.raw_result.uid = qaUid(99);
  assert.equal(validateQaFixture(rawIdentityMismatch).reason, "qa_snapshot_result_identity_mismatch");

  const staleVerificationContext = buildQaFixture();
  staleVerificationContext.diagnostics[0].result_json.raw_result.sun_diagnostics.verification_context_digest = `sha256:${"d".repeat(64)}`;
  assert.equal(validateQaFixture(staleVerificationContext).reason, "qa_verification_context_mismatch");

  const staleVerificationContextVersion = buildQaFixture();
  staleVerificationContextVersion.diagnostics[0].result_json.raw_result.sun_diagnostics.verification_context_version = "v1";
  assert.equal(validateQaFixture(staleVerificationContextVersion).reason, "qa_verification_context_mismatch");

  const rawStateMismatch = buildQaFixture();
  rawStateMismatch.diagnostics[0].result_json.raw_result.product_state = "VALID_UNKNOWN_TAMPER";
  assert.equal(validateQaFixture(rawStateMismatch).reason, "qa_snapshot_result_state_mismatch");
});

test("proof layer builds a verifiable Merkle root without exposing raw events", () => {
  const eventA = hashEvidencePayload({
    tenantId: "tenant-1",
    resourceType: "supplier_sub_batch",
    resourceId: "batch-a",
    eventType: "manifest_imported",
    payload: { bid: "SYN-AR-2026-001-A", row_count: 1000 },
  });
  const eventB = hashEvidencePayload({
    tenantId: "tenant-1",
    resourceType: "supplier_sub_batch",
    resourceId: "batch-a",
    eventType: "qa_passed",
    payload: { bid: "SYN-AR-2026-001-A", sample_count: 5 },
  });
  const merkleRoot = buildMerkleRoot([eventA, eventB]);
  assert.match(merkleRoot, /^sha256:[0-9a-f]{64}$/);
  assert.equal(verifyHashInAnchor(eventA, [eventA, eventB]), true);
  assert.equal(verifyHashInAnchor("sha256:" + "0".repeat(64), [eventA, eventB]), false);
  assert.equal(isSha256Hash(eventA), true);
  assert.equal(isSha256Hash("04AABBCCDD1090"), false);
  assert.equal(findForbiddenProofPayloadKey({ uid_hex: "04AABBCCDD1090" }), "uid_hex");
  assert.equal(findForbiddenProofPayloadKey({ nested: { K_META_BATCH: "A".repeat(32) } }), "K_META_BATCH");
  assert.equal(findForbiddenProofPayloadKey({ bid: "SYN-AR-2026-001-A", content_hash: eventA }), null);
});

test("public membership rejects an injected or incomplete persisted member list", () => {
  const eventA = `sha256:${"11".repeat(32)}`;
  const eventB = `sha256:${"22".repeat(32)}`;
  const injected = `sha256:${"33".repeat(32)}`;
  const merkleRoot = buildMerkleRoot([eventA, eventB]);

  assert.deepEqual(verifyHashInMerkleAnchor({
    eventHash: eventA,
    eventHashes: [eventA, eventB],
    eventCount: 2,
    merkleRoot,
  }), {
    valid: true,
    included: true,
    reason: null,
    calculatedMerkleRoot: merkleRoot,
  });
  assert.equal(verifyHashInMerkleAnchor({
    eventHash: injected,
    eventHashes: [eventA, eventB, injected],
    eventCount: 3,
    merkleRoot,
  }).reason, "anchor_merkle_root_mismatch");
  assert.equal(verifyHashInMerkleAnchor({
    eventHash: eventA,
    eventHashes: [eventA, eventB],
    eventCount: 99,
    merkleRoot,
  }).reason, "anchor_event_count_mismatch");
  assert.equal(verifyHashInMerkleAnchor({
    eventHash: eventA,
    eventHashes: [eventA, eventB.toUpperCase()],
    eventCount: 2,
    merkleRoot,
  }).reason, "anchor_member_hash_invalid");
});
