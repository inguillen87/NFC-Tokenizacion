import test from "node:test";
import assert from "node:assert/strict";

const { parseTagManifest } = await import("../src/lib/tag-manifest.ts");

test("CSV manifest requires UID plus product name or SKU", () => {
  const manifest = parseTagManifest("uid_hex,batch_id,product_name,sku\n04AABBCCDD1090,LOT-1,Reserva,SKU-1\n", "LOT-1");
  assert.equal(manifest.manifestType, "csv");
  assert.equal(manifest.rows.length, 1);
  assert.equal(manifest.rejectedRows.length, 0);
  assert.equal(manifest.rows[0].uidHex, "04AABBCCDD1090");
  assert.equal(manifest.rows[0].productName, "Reserva");
});

test("CSV manifest rejects mismatched batch and duplicate UID", () => {
  const manifest = parseTagManifest("uid_hex,batch_id,sku\n04AABBCCDD1090,OTHER,SKU-1\n04AABBCCDD1090,LOT-1,SKU-1\n04AABBCCDD1090,LOT-1,SKU-1\n", "LOT-1");
  assert.equal(manifest.rows.length, 1);
  assert.ok(manifest.rejectedRows.some((row) => row.reason === "batch_id_mismatch"));
  assert.ok(manifest.rejectedRows.some((row) => row.reason === "duplicate_uid_in_manifest"));
});

test("TXT manifest supports UID-only import but rejects malformed UID", () => {
  const manifest = parseTagManifest("uid_hex\n04AABBCCDD1090\nbad-uid\n", "LOT-1");
  assert.equal(manifest.manifestType, "txt");
  assert.equal(manifest.rows.length, 1);
  assert.equal(manifest.rejectedRows[0].reason, "invalid_uid_hex");
});
