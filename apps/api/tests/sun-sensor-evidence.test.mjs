import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const {
  buildSunSensorEvidence,
  declaredStaticSensorFromLocaleData,
} = await import("../src/lib/sun-sensor-evidence.ts");

test("a real tap without sensor readings exposes no telemetry", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [{ at: "2026-07-26T00:00:00.000Z", stage: "retail" }],
    fallbackStorage: "16°C",
    barrelMonths: 12,
    allowSimulation: false,
  });

  assert.equal(evidence.kind, "none");
  assert.deepEqual(evidence.history, []);
  assert.deepEqual(evidence.snapshot, {
    cellarTemperature: null,
    humidity: null,
    lightExposure: null,
    transitShock: null,
  });
});

test("reported snapshot is one observation and never borrows a metric from another reading", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [
      { at: "2026-07-26T00:00:00.000Z", stage: "warehouse", sensorTempC: 11.5 },
      { at: "2026-07-26T01:00:00.000Z", stage: "truck", sensorHumidity: 72 },
    ],
    fallbackStorage: "16°C",
    simulatedTempC: 18,
    simulatedHumidityPct: 60,
    simulatedLight: "demo light",
    simulatedShock: "demo shock",
    allowSimulation: true,
  });

  assert.equal(evidence.kind, "reported");
  assert.equal(evidence.history[0].temperatureC, null);
  assert.equal(evidence.history[0].humidityPct, 72);
  assert.equal(evidence.history[1].temperatureC, 11.5);
  assert.equal(evidence.history[1].humidityPct, null);
  assert.equal(evidence.snapshot.cellarTemperature, null);
  assert.equal(evidence.snapshot.humidity, "72%");
  assert.equal(evidence.snapshot.lightExposure, null);
  assert.equal(evidence.snapshot.transitShock, null);
});

test("manifest sensor JSON is declared static and exposes only allow-listed provenance", () => {
  const declaredStatic = declaredStaticSensorFromLocaleData({
    iot: {
      measuredAt: "2026-07-25T23:00:00.000Z",
      deviceId: "logger-7",
      temperatureC: "12,4",
      humidityPct: 67,
      lightExposure: "Low",
      transitShock: "0.2g",
      storageZone: "warehouse-a",
      apiKey: "must-never-be-public",
    },
  });
  const evidence = buildSunSensorEvidence({
    timeline: [],
    declaredStatic,
    allowSimulation: true,
  });

  assert.equal(evidence.kind, "declared_static");
  assert.equal(evidence.snapshot.cellarTemperature, "12.4°C");
  assert.equal(evidence.snapshot.humidity, "67%");
  assert.equal(evidence.snapshot.observedAt, "2026-07-25T23:00:00.000Z");
  assert.equal(evidence.snapshot.source, "manifest");
  assert.equal(evidence.snapshot.deviceId, "logger-7");
  assert.deepEqual(evidence.history[0], {
    at: "2026-07-25T23:00:00.000Z",
    stage: "warehouse-a",
    temperatureC: 12.4,
    humidityPct: 67,
    lightExposure: "Low",
    transitShock: "0.2g",
    barrelAgeMonths: null,
    alert: null,
    evidenceKind: "declared_static",
    source: "manifest",
    deviceId: "logger-7",
  });
  assert.equal("apiKey" in evidence.declaredStatic, false);
});

test("measured event readings remain reported when a static manifest also exists", () => {
  const declaredStatic = declaredStaticSensorFromLocaleData({
    manifest: { iot: { measuredAt: "2026-07-25T20:00:00.000Z", temperatureC: 14 } },
  });
  const evidence = buildSunSensorEvidence({
    timeline: [{
      at: "2026-07-26T00:00:00.000Z",
      sensorMeasuredAt: "2026-07-25T23:59:30.000Z",
      sensorTempC: 11.5,
      sensorHumidity: 72,
      sensorLightExposure: "18 lux",
      sensorTransitShock: "0.4g",
      sensorSource: "mqtt-bridge",
      sensorDeviceId: "sensor-live-2",
    }],
    declaredStatic,
    allowSimulation: false,
  });

  assert.equal(evidence.kind, "reported");
  assert.equal(evidence.snapshot.observedAt, "2026-07-25T23:59:30.000Z");
  assert.equal(evidence.snapshot.source, "mqtt-bridge");
  assert.equal(evidence.snapshot.deviceId, "sensor-live-2");
  assert.equal(evidence.snapshot.lightExposure, "18 lux");
  assert.equal(evidence.snapshot.transitShock, "0.4g");
  assert.equal(evidence.history[0].evidenceKind, "reported");
  assert.equal(evidence.history[0].source, "mqtt-bridge");
  assert.equal(evidence.declaredStatic.evidenceKind, "declared_static");
});

test("an explicitly allowed fixture stays labelled simulated", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [],
    fallbackStorage: "15°C",
    barrelMonths: 10,
    simulatedHumidityPct: 64,
    allowSimulation: true,
    now: "2026-07-26T02:00:00.000Z",
  });

  assert.equal(evidence.kind, "simulated");
  assert.equal(evidence.history.length, 1);
  assert.equal(evidence.history[0].stage, "simulation");
  assert.equal(evidence.snapshot.cellarTemperature, "15.0°C");
  assert.equal(evidence.snapshot.humidity, "64%");
  assert.match(evidence.snapshot.lightExposure, /simulada/i);
  assert.match(evidence.snapshot.transitShock, /simulaci[oó]n/i);
});

test("null or blank simulation inputs never become zero-degree telemetry", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [],
    fallbackStorage: null,
    simulatedTempC: null,
    simulatedHumidityPct: "",
    allowSimulation: true,
    now: "2026-07-26T12:00:00.000Z",
  });

  assert.equal(evidence.kind, "simulated");
  assert.equal(evidence.history[0]?.temperatureC, 16);
  assert.equal(evidence.history[0]?.humidityPct, 68);
  assert.equal(evidence.history[0]?.alert, null);
  assert.notEqual(evidence.snapshot.cellarTemperature, "0.0°C");
});

test("reported snapshot uses the latest complete observation and invents no universal threshold", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [
      { at: "2026-07-26T00:00:00.000Z", stage: "warehouse", sensorTempC: 0, sensorHumidity: 90 },
      { at: "2026-07-26T01:00:00.000Z", stage: "truck", sensorTempC: 30, sensorHumidity: 20 },
    ],
    allowSimulation: false,
  });

  assert.equal(evidence.kind, "reported");
  assert.equal(evidence.snapshot.cellarTemperature, "30.0°C");
  assert.equal(evidence.snapshot.humidity, "20%");
  assert.equal(evidence.history.every((item) => item.alert === null), true);
});

test("interleaved devices cannot attribute an older metric to the newest source", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [
      {
        sensorMeasuredAt: "2026-07-26T01:00:00.000Z",
        sensorHumidity: 64,
        sensorSource: "gateway-b",
        sensorDeviceId: "device-b",
      },
      {
        sensorMeasuredAt: "2026-07-26T00:00:00.000Z",
        sensorTempC: 9.5,
        sensorSource: "gateway-a",
        sensorDeviceId: "device-a",
      },
    ],
    allowSimulation: false,
  });

  assert.equal(evidence.snapshot.humidity, "64%");
  assert.equal(evidence.snapshot.cellarTemperature, null);
  assert.equal(evidence.snapshot.observedAt, "2026-07-26T01:00:00.000Z");
  assert.equal(evidence.snapshot.source, "gateway-b");
  assert.equal(evidence.snapshot.deviceId, "device-b");
  assert.equal(evidence.history[0].source, "gateway-b");
  assert.equal(evidence.history[1].source, "gateway-a");
});

test("sensor evidence cannot invent or mutate a public quality score", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  const diagnostics = await readFile(new URL("../src/lib/sun-diagnostics.ts", import.meta.url), "utf8");
  assert.match(route, /quality: \{ score: null, tier: null, basis: "unavailable" \}/);
  assert.doesNotMatch(route, /qualityScore|sensorPenalty|trustPenalty/);
  assert.match(route, /declaredStaticSensorFromLocaleData\(params\.passport\?\.locale_data\)/);
  assert.match(route, /sensorEvidenceKind: sensorEvidence\.kind/);
  assert.match(diagnostics, /existingSensorEvidenceKind !== "reported"/);
  assert.match(diagnostics, /manifestTelemetry: declaredStaticEvidence\.declaredStatic \|\| null/);
});
