import test from "node:test";
import assert from "node:assert/strict";

const {
  buildSupplierSubBatchPlan,
  generateSupplierBatchKeys,
  buildSupplierEncodingPack,
  buildSupplierPackPdfSummary,
  buildZipArchive,
  encryptSupplierZipArchive,
  decryptSupplierEncryptedZipForTest,
  validateSupplierManifestQuantity,
  canExportSupplierPack,
  canImportSupplierManifest,
  canActivateSupplierSubBatch,
  canRotateSupplierSubBatchKeys,
  validateSupplierQaEvidence,
} = await import("../src/lib/supplier-ops.ts");
const { normalizeCarrierProfileCode } = await import("../src/lib/carrier-profiles.ts");
const {
  buildMerkleRoot,
  findForbiddenProofPayloadKey,
  hashEvidencePayload,
  isSha256Hash,
  verifyHashInAnchor,
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
    quantity: 1000,
    chipModel: "NTAG 424 DNA TagTamper",
    carrierProfile: "ntag424_dna_tt",
    kMetaHex: first.kMetaHex,
    kFileHex: first.kFileHex,
    urlTemplate: "https://api.nexid.lat/sun?v=1&bid=SYN-AR-2026-001-A&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  });
  assert.match(pack.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(pack.json.TTSTATUS.closed, "4343");
  assert.match(pack.text, /MANIFEST_FORMAT=batch_id,uid_hex/);
});

test("non-cryptographic supplier profiles never expose 424 batch keys", () => {
  const keys = generateSupplierBatchKeys();
  const ntagPack = buildSupplierEncodingPack({
    clientSlug: "balmec",
    batchId: "BALMEC-EVENT-A",
    quantity: 500,
    chipModel: "NTAG215 wristband",
    carrierProfile: "event_wristband",
    kMetaHex: keys.kMetaHex,
    kFileHex: keys.kFileHex,
    urlTemplate: "https://nexid.lat/t/BALMEC-EVENT-A/<UID_HEX>",
  });
  assert.doesNotMatch(ntagPack.text, /K_META_BATCH=/);
  assert.doesNotMatch(ntagPack.text, /K_FILE_BATCH=/);
  assert.match(ntagPack.text, /KEY_MATERIAL=NO_BATCH_KEYS_REQUIRED_FOR_THIS_PROFILE/);
  assert.match(ntagPack.text, /MANIFEST_FORMAT=batch_id,uid_hex,attendee_ref,zone,valid_from,valid_until/);

  const gs1Pack = buildSupplierEncodingPack({
    clientSlug: "syngenta",
    batchId: "SYN-GS1-A",
    quantity: 1000,
    chipModel: "GS1 Digital Link label",
    carrierProfile: "gs1_digital_link",
    kMetaHex: keys.kMetaHex,
    kFileHex: keys.kFileHex,
    urlTemplate: "https://nexid.lat/01/<GTIN>/10/<LOT>/21/<SERIAL>",
  });
  assert.doesNotMatch(gs1Pack.text, /K_META_BATCH=/);
  assert.doesNotMatch(gs1Pack.text, /K_FILE_BATCH=/);
  assert.match(gs1Pack.text, /GTIN, lot and serial in manifest/);
  assert.equal(gs1Pack.json.KEY_MATERIAL, "NO_BATCH_KEYS_REQUIRED_FOR_THIS_PROFILE");
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
    quantity: 1000,
    chipModel: "NTAG 424 DNA",
    carrierProfile: "ntag424_dna",
    keyFingerprint: keys.fingerprint,
    contentHash: pack.contentHash,
    jsonHash: "sha256:" + "a".repeat(64),
    urlTemplate: "https://api.nexid.lat/sun?v=1&bid=SYN-AR-2026-001-A&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  });
  assert.equal(pdf.subarray(0, 8).toString("utf8"), "%PDF-1.4");

  const zip = buildZipArchive([
    { path: "README_FIRST.txt", data: "nexID supplier pack\n" },
    { path: "SYN-AR-2026-001-A/SYN-AR-2026-001-A_supplier_encoding_pack.txt", data: pack.text },
    { path: "SYN-AR-2026-001-A/SYN-AR-2026-001-A_supplier_encoding_pack.json", data: jsonBody },
    { path: "SYN-AR-2026-001-A/SYN-AR-2026-001-A_supplier_encoding_summary.pdf", data: pdf },
  ]);
  assert.equal(zip.subarray(0, 2).toString("utf8"), "PK");
  assert.match(zip.toString("utf8"), /README_FIRST\.txt/);
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

test("supplier manifest gate rejects quantity mismatch before activation", () => {
  const manifest = parseTagManifest("batch_id,uid_hex\nSYN-AR-2026-001-A,04AABBCCDD1090\n", "SYN-AR-2026-001-A");
  const gate = validateSupplierManifestQuantity(manifest, 1000);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, "quantity_mismatch");
  assert.equal(gate.expected, 1000);
  assert.equal(gate.received, 1);
});

test("supplier activation gate requires imported manifest, QA and matching count", () => {
  assert.equal(canActivateSupplierSubBatch({ manifestStatus: "pending", qaStatus: "passed", expectedQuantity: 1000, manifestCount: 1000 }).reason, "manifest_not_imported");
  assert.equal(canActivateSupplierSubBatch({ manifestStatus: "imported", qaStatus: "pending", expectedQuantity: 1000, manifestCount: 1000 }).reason, "qa_not_passed");
  assert.equal(canActivateSupplierSubBatch({ manifestStatus: "imported", qaStatus: "passed", expectedQuantity: 1000, manifestCount: 999 }).reason, "manifest_quantity_mismatch");
  assert.equal(canActivateSupplierSubBatch({ manifestStatus: "imported", qaStatus: "passed", expectedQuantity: 1000, manifestCount: 1000 }).ok, true);
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
    manifestStatus: "pending",
    qaStatus: "pending",
    expectedQuantity: 1000,
    manifestCount: 0,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "manifest_not_imported");

  const unaudited = canActivateSupplierSubBatch({
    manifestStatus: "pending",
    qaStatus: "pending",
    expectedQuantity: 1000,
    manifestCount: 0,
    overrideReason: "urgent",
  });
  assert.equal(unaudited.ok, false);
  assert.equal(unaudited.reason, "supplier_activation_override_audit_required");

  const override = canActivateSupplierSubBatch({
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

test("supplier QA gate rejects empty pass declarations", () => {
  assert.equal(validateSupplierQaEvidence({ passed: false }).ok, true);
  assert.equal(validateSupplierQaEvidence({ passed: true, sampleUrls: [], replayChecked: true, ttstatusChecked: true, requiresTtstatus: true }).reason, "qa_sample_evidence_required");
  assert.equal(validateSupplierQaEvidence({ passed: true, sampleUrls: ["https://qa.nexid.lat/sample/1"], replayChecked: false, ttstatusChecked: true, requiresTtstatus: true }).reason, "qa_replay_check_required");
  assert.equal(validateSupplierQaEvidence({ passed: true, sampleUrls: ["https://qa.nexid.lat/sample/1"], replayChecked: true, ttstatusChecked: false, requiresTtstatus: true }).reason, "qa_ttstatus_check_required");
  assert.equal(validateSupplierQaEvidence({ passed: true, sampleUrls: ["https://qa.nexid.lat/sample/1"], replayChecked: true, ttstatusChecked: false, requiresTtstatus: false }).ok, true);
  assert.equal(validateSupplierQaEvidence({ passed: true, sampleUrls: ["https://qa.nexid.lat/sample/1"], replayChecked: true, ttstatusChecked: true, requiresTtstatus: true }).ok, true);
});

test("supplier QA gate ties production evidence to the expected BID and SUN sample", () => {
  const validSample = "https://api.nexid.lat/sun?v=1&bid=SYN-AR-2026-001-A&picc_data=0011223344556677&enc=AABBCCDDEEFF0011&cmac=0102030405060708";
  const gate = validateSupplierQaEvidence({
    passed: true,
    sampleUrls: [validSample],
    replayChecked: true,
    ttstatusChecked: true,
    requiresTtstatus: true,
    requiresSecureSun: true,
    expectedBid: "SYN-AR-2026-001-A",
  });
  assert.equal(gate.ok, true);
  assert.match(gate.evidenceDigest, /^sha256:[0-9a-f]{64}$/);

  assert.equal(validateSupplierQaEvidence({
    passed: true,
    sampleUrls: [validSample.replace("SYN-AR-2026-001-A", "SYN-AR-2026-001-B")],
    replayChecked: true,
    ttstatusChecked: true,
    requiresTtstatus: true,
    requiresSecureSun: true,
    expectedBid: "SYN-AR-2026-001-A",
  }).reason, "qa_sample_bid_mismatch");

  assert.equal(validateSupplierQaEvidence({
    passed: true,
    sampleUrls: ["https://api.nexid.lat/sun?v=1&bid=SYN-AR-2026-001-A"],
    replayChecked: true,
    ttstatusChecked: true,
    requiresTtstatus: true,
    requiresSecureSun: true,
    expectedBid: "SYN-AR-2026-001-A",
  }).reason, "qa_secure_sun_sample_required");
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
