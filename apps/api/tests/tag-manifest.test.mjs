import test from "node:test";
import assert from "node:assert/strict";

const { parseTagManifest } = await import("../src/lib/tag-manifest.ts");

test("CSV manifest supports UID-only supplier import", () => {
  const manifest = parseTagManifest("uid_hex,batch_id\n04AABBCCDD1090,LOT-1\n", "LOT-1");
  assert.equal(manifest.manifestType, "csv");
  assert.equal(manifest.rows.length, 1);
  assert.equal(manifest.rejectedRows.length, 0);
  assert.equal(manifest.rows[0].uidHex, "04AABBCCDD1090");
  assert.equal(manifest.rows[0].productName, null);
  assert.equal(manifest.rows[0].sku, null);
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

test("CSV manifest can bind a UID to an exact SUN URL payload", () => {
  const url = "https://nexid.lat/sun?bid=LOT-1&picc_data=00112233445566778899AABBCCDDEEFF&enc=0102030405060708090A&cmac=0102030405060708";
  const manifest = parseTagManifest(`uid_hex,batch_id,sun_url\n04AABBCCDD1090,LOT-1,${url}\n`, "LOT-1");
  assert.equal(manifest.rows.length, 1);
  assert.equal(manifest.rejectedRows.length, 0);
  assert.equal(manifest.rows[0].sunPayload?.bid, "LOT-1");
  assert.equal(manifest.rows[0].sunPayload?.piccDataHex, "00112233445566778899AABBCCDDEEFF");
  assert.ok(manifest.rows[0].sunPayloadHashes?.rawUrlHash.startsWith("sha256:"));
  assert.ok(manifest.rows[0].sunPayloadHashes?.piccDataHash.startsWith("sha256:"));
});

test("CSV manifest rejects partial SUN payload columns", () => {
  const manifest = parseTagManifest("uid_hex,batch_id,picc_data,enc,cmac\n04AABBCCDD1090,LOT-1,001122,,0102030405060708\n", "LOT-1");
  assert.equal(manifest.rows.length, 0);
  assert.equal(manifest.rejectedRows[0].reason, "invalid_sun_payload");
});
