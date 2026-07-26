import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const { buildSunSensorEvidence } = await import("../src/lib/sun-sensor-evidence.ts");

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

test("reported readings never borrow missing values from product defaults", () => {
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
  assert.equal(evidence.history[0].temperatureC, 11.5);
  assert.equal(evidence.history[0].humidityPct, null);
  assert.equal(evidence.history[1].temperatureC, null);
  assert.equal(evidence.history[1].humidityPct, 72);
  assert.equal(evidence.snapshot.cellarTemperature, "11.5°C");
  assert.equal(evidence.snapshot.humidity, "72%");
  assert.equal(evidence.snapshot.lightExposure, null);
  assert.equal(evidence.snapshot.transitShock, null);
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

test("reported snapshot uses the latest reading per metric and invents no universal threshold", () => {
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

test("sensor evidence cannot invent or mutate a public quality score", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  assert.match(route, /quality: \{ score: null, tier: null, basis: "unavailable" \}/);
  assert.doesNotMatch(route, /qualityScore|sensorPenalty|trustPenalty/);
});
