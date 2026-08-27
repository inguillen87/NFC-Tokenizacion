import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const {
  buildSunSensorEvidence,
  isPublicSunSensorObservation,
  normalizeSunSensorPrivacyScope,
  publicSunSensorResponsible,
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
  assert.equal(evidence.provenance.origin, "none");
  assert.equal(evidence.provenance.capturedAt, null);
  assert.deepEqual([...evidence.provenance.supportedOrigins], ["tenant_manual", "csv_import", "json_import", "live_sensor"]);
});

test("reported readings never borrow missing values from product defaults", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [
      {
        at: "2026-07-26T00:00:00.000Z",
        stage: "warehouse",
        sensorTempC: 11.5,
        sensorSource: "csv_import",
        sensorPrivacyScope: "tenant_only",
        sensorResponsible: "Bodega piloto",
      },
      {
        at: "2026-07-26T01:00:00.000Z",
        stage: "truck",
        sensorHumidity: 72,
        sensorSource: "live_sensor",
        sensorPrivacyScope: "public",
        sensorResponsible: "Operador logístico",
      },
    ],
    fallbackStorage: "16°C",
    simulatedTempC: 18,
    simulatedHumidityPct: 60,
    simulatedLight: "demo light",
    simulatedShock: "demo shock",
    allowSimulation: true,
  });

  assert.equal(evidence.kind, "reported");
  assert.equal(evidence.history.length, 1);
  assert.equal(evidence.history[0].temperatureC, null);
  assert.equal(evidence.history[0].humidityPct, 72);
  assert.equal(evidence.snapshot.cellarTemperature, null);
  assert.equal(evidence.snapshot.humidity, "72%");
  assert.equal(evidence.snapshot.lightExposure, null);
  assert.equal(evidence.snapshot.transitShock, null);
  assert.equal(evidence.provenance.origin, "live_sensor");
  assert.equal(evidence.provenance.capturedAt, "2026-07-26T01:00:00.000Z");
  assert.equal(evidence.provenance.privacyScope, "public");
  assert.equal(evidence.provenance.responsible, "Operador logístico");
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
  assert.equal(evidence.provenance.origin, "illustrative_scenario");
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

test("reported snapshot uses one latest public observation and invents no universal threshold", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [
      { at: "2026-07-26T00:00:00.000Z", stage: "warehouse", sensorTempC: 0, sensorHumidity: 90, sensorSource: "tenant_manual", sensorPrivacyScope: "public" },
      { at: "2026-07-26T01:00:00.000Z", stage: "truck", sensorTempC: 30, sensorHumidity: 20, sensorSource: "live_sensor", sensorPrivacyScope: "public" },
    ],
    allowSimulation: false,
  });

  assert.equal(evidence.kind, "reported");
  assert.equal(evidence.snapshot.cellarTemperature, "30.0°C");
  assert.equal(evidence.snapshot.humidity, "20%");
  assert.equal(evidence.history.every((item) => item.alert === null), true);
});

test("sensor provenance stays bound to one public observation and excludes private readings", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [
      {
        at: "2026-07-26T02:00:00.000Z",
        sensorTempC: 17,
        sensorSource: "live_sensor",
        sensorPrivacyScope: "tenant_only",
        sensorResponsible: "Operador interno",
      },
      {
        at: "2026-07-26T01:00:00.000Z",
        sensorHumidity: 61,
        sensorSource: "csv_import",
        sensorPrivacyScope: "public",
        sensorResponsible: "Bodega pública",
      },
    ],
    allowSimulation: false,
  });

  assert.equal(evidence.provenance.origin, "csv_import");
  assert.equal(evidence.provenance.capturedAt, "2026-07-26T01:00:00.000Z");
  assert.equal(evidence.provenance.privacyScope, "public");
  assert.equal(evidence.provenance.responsible, "Bodega pública");
  assert.equal(evidence.history.length, 1);
  assert.equal(evidence.history[0].privacyScope, "public");
  assert.equal(evidence.history[0].responsible, "Bodega pública");
  assert.equal(evidence.snapshot.cellarTemperature, null);
  assert.equal(evidence.snapshot.humidity, "61%");
});

test("every public sensor projection redacts private and unknown responsibility", () => {
  for (const privacyScope of ["tenant_only", "private", "internal", "not_reported", null]) {
    assert.equal(publicSunSensorResponsible("Operador privado", privacyScope), null);
  }
  assert.equal(normalizeSunSensorPrivacyScope(" PUBLIC "), "public");
  assert.equal(isPublicSunSensorObservation("public"), true);
  assert.equal(isPublicSunSensorObservation("tenant_only"), false);
  assert.equal(publicSunSensorResponsible(" Operador público ", "public"), "Operador público");
});

test("private sensor readings produce no public telemetry", () => {
  const evidence = buildSunSensorEvidence({
    timeline: [{
      at: "2026-07-26T03:00:00.000Z",
      stage: "private-cellar",
      sensorTempC: 13,
      sensorHumidity: 70,
      sensorSource: "live_sensor",
      sensorPrivacyScope: "private",
      sensorResponsible: "Responsable reservado",
    }],
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

test("sensor evidence cannot invent or mutate a public quality score", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  assert.match(route, /quality: \{ score: null, tier: null, basis: "unavailable" \}/);
  assert.doesNotMatch(route, /qualityScore|sensorPenalty|trustPenalty/);
  assert.match(route, /sensorResponsible: publicSunSensorResponsible\(rawSensorResponsible, sensorPrivacyScope\)/);
  assert.match(route, /sensorTempC: sensorIsPublic &&/);
  assert.match(route, /sensorHumidity: sensorIsPublic &&/);
  assert.match(route, /stage: typeof publicCheckpoint\.stage[\s\S]{0,220}sensorIsPublic &&/);
});
