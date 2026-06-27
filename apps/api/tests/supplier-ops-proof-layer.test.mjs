import test from "node:test";
import assert from "node:assert/strict";

const {
  buildSupplierSubBatchPlan,
  generateSupplierBatchKeys,
  buildSupplierEncodingPack,
  validateSupplierManifestQuantity,
  canActivateSupplierSubBatch,
} = await import("../src/lib/supplier-ops.ts");
const {
  buildMerkleRoot,
  hashEvidencePayload,
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
});
