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

test("CSV manifest keeps unit metadata and IoT separate from product identity", () => {
  const csv = [
    "uid_hex;batch_id;bottle_number;case_id;sensor_json;temperature_c;humidity_pct",
    '04AABBCCDD1090;LOT-1;55555;CASE-9;"{""deviceId"":""logger-7"",""lightExposure"":""Low""}";12.4;67',
  ].join("\n");
  const manifest = parseTagManifest(csv, "LOT-1");
  assert.equal(manifest.rows.length, 1);
  assert.equal(manifest.rejectedRows.length, 0);
  assert.equal(manifest.rows[0].productName, null);
  assert.equal(manifest.rows[0].sku, null);
  assert.equal(manifest.rows[0].serial, "55555");
  assert.equal(manifest.rows[0].unitMetadata.bottle_number, "55555");
  assert.equal(manifest.rows[0].unitMetadata.case_id, "CASE-9");
  assert.equal(manifest.rows[0].iotData.deviceId, "logger-7");
  assert.equal(manifest.rows[0].iotData.lightExposure, "Low");
  assert.equal(manifest.rows[0].iotData.temperatureC, 12.4);
  assert.equal(manifest.rows[0].iotData.humidityPct, 67);
  assert.equal(manifest.rows[0].iotData.evidenceKind, "declared_static");
});

test("CSV manifest rejects invalid IoT JSON", () => {
  const manifest = parseTagManifest("uid_hex;batch_id;sensor_json\n04AABBCCDD1090;LOT-1;{bad-json}\n", "LOT-1");
  assert.equal(manifest.rows.length, 0);
  assert.equal(manifest.rejectedRows[0].reason, "invalid_iot_json");
});

test("CSV manifest rejects secret, unsupported and nested sensor JSON before persistence", () => {
  for (const sensorJson of [
    '{"temperatureC":12,"apiKey":"must-not-persist"}',
    '{"temperatureC":12,"connector":{"host":"internal"}}',
    '{"temperatureC":12,"unknownMetric":1}',
  ]) {
    const escaped = `"${sensorJson.replaceAll('"', '""')}"`;
    const manifest = parseTagManifest(`uid_hex;batch_id;sensor_json\n04AABBCCDD1090;LOT-1;${escaped}\n`, "LOT-1");
    assert.equal(manifest.rows.length, 0);
    assert.equal(manifest.rejectedRows[0].reason, "invalid_iot_json");
    assert.doesNotMatch(String(manifest.rejectedRows[0].value || ""), /must-not-persist|internal/);
  }
});

test("CSV manifest normalizes sensor aliases and rejects ambiguous or out-of-range telemetry", () => {
  const normalized = parseTagManifest([
    "uid_hex;batch_id;sensor_json;sensor_at;temperature_c;humidity_pct",
    '04AABBCCDD1090;LOT-1;"{""logger_id"":""logger-9"",""provider"":""acme-gateway"",""pressure"":""1007.4""}";2026-08-29T10:30:00-03:00;12,4;68',
  ].join("\n"), "LOT-1");
  assert.equal(normalized.rows.length, 1);
  assert.deepEqual(normalized.rows[0].iotData, {
    deviceId: "logger-9",
    source: "acme-gateway",
    pressureHpa: 1007.4,
    measuredAt: "2026-08-29T13:30:00.000Z",
    temperatureC: 12.4,
    humidityPct: 68,
    evidenceKind: "declared_static",
  });

  for (const [sensorJson, expected] of [
    ['{"humidityPct":101}', "invalid_iot_humidityPct"],
    ['{"temperatureC":"hot"}', "invalid_iot_temperatureC"],
    ['{"temperatureC":12,"temperature_c":13}', "conflicting_iot_temperatureC"],
    ['{"measuredAt":"2026-08-29 13:00"}', "invalid_iot_measuredAt"],
  ]) {
    const escaped = `"${sensorJson.replaceAll('"', '""')}"`;
    const manifest = parseTagManifest(`uid_hex;batch_id;sensor_json\n04AABBCCDD1090;LOT-1;${escaped}\n`, "LOT-1");
    assert.equal(manifest.rows.length, 0);
    assert.equal(manifest.rejectedRows[0].reason, "invalid_iot_json");
    assert.equal(manifest.rejectedRows[0].value, expected);
  }

  const invalidColumn = parseTagManifest(
    "uid_hex;batch_id;humidity_pct\n04AABBCCDD1090;LOT-1;140\n",
    "LOT-1",
  );
  assert.equal(invalidColumn.rows.length, 0);
  assert.equal(invalidColumn.rejectedRows[0].value, "invalid_iot_humidityPct");

  const conflictingSources = parseTagManifest([
    "uid_hex;batch_id;sensor_json;temperature_c",
    '04AABBCCDD1090;LOT-1;"{""temperatureC"":12}";13',
  ].join("\n"), "LOT-1");
  assert.equal(conflictingSources.rows.length, 0);
  assert.equal(conflictingSources.rejectedRows[0].value, "conflicting_iot_temperatureC");
});

test("CSV manifest rejects mismatched batch and duplicate UID", () => {
  const manifest = parseTagManifest("uid_hex,batch_id,sku\n04AABBCCDD1090,OTHER,SKU-1\n04AABBCCDD1090,LOT-1,SKU-1\n04AABBCCDD1090,LOT-1,SKU-1\n", "LOT-1");
  assert.equal(manifest.rows.length, 1);
  assert.ok(manifest.rejectedRows.some((row) => row.reason === "batch_id_mismatch"));
  assert.ok(manifest.rejectedRows.some((row) => row.reason === "duplicate_uid_in_manifest"));
});

test("TXT manifest supports UID-only import but rejects malformed or odd-length UID", () => {
  const manifest = parseTagManifest("uid_hex\n04AABBCCDD1090\nbad-uid\n04AABBCCD\n", "LOT-1");
  assert.equal(manifest.manifestType, "txt");
  assert.equal(manifest.rows.length, 1);
  assert.equal(manifest.rejectedRows[0].reason, "invalid_uid_hex");
  assert.equal(manifest.rejectedRows[1].reason, "invalid_uid_hex");
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
