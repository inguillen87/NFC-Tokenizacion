import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [source, executiveSource] = await Promise.all([
  readFile(new URL("../src/components/realtime-ops-monitor.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
]);

test("realtime operations centralize verdict classes and exclude lifecycle unknowns from risk", () => {
  assert.match(source, /type RealtimeVerdictBucket = "valid" \| "duplicate_replay" \| "tamper" \| "invalid" \| "unknown"/);
  assert.match(source, /function classifyRealtimeVerdict/);
  assert.match(source, /function isRealtimeRisk/);
  assert.match(source, /\["duplicate_replay", "tamper", "invalid"\]\.includes/);
  assert.match(source, /\["UNKNOWN", "NOT_REGISTERED", "NOT_ACTIVE"\]/);
  assert.doesNotMatch(source, /length - valid|!== "valid"|!== "VALID"|result !== "VALID"/);
});

test("all realtime risk derivatives use the centralized classification", () => {
  assert.match(source, /risk: isRealtimeRisk\(result\) \? 1 : 0/);
  assert.match(source, /if \(isRealtimeRisk\(row\.verdict\)\) current\.risk \+= 1/);
  assert.match(source, /const risk = visibleEvents\.filter\(\(item\) => isRealtimeRisk\(item\.verdict\)\)\.length/);
  assert.match(source, /if \(isRealtimeRisk\(event\.verdict\)\) buckets\[bucketIndex\]\.risk \+= 1/);
  assert.match(source, /visibleEvents\.filter\(\(event\) => isRealtimeRisk\(event\.verdict\)\)/);
  assert.match(source, /ALERTA DE RIESGO NFC/);
  assert.match(source, /liveMetrics\.unknown/);
});

test("browser_gps_reported is recognized as client-reported, non-independent GPS evidence", () => {
  assert.match(source, /source\.includes\("gps"\)/);
  assert.match(source, /GPS reportado por cliente/);
  assert.match(source, /no verificacion independiente/);
  assert.match(source, /isClientReportedGps\(item\.locationSource\)/);
  assert.doesNotMatch(source, /source === "browser_gps"/);
});

test("executive CRM keeps lifecycle unknowns out of risk and recognizes reported GPS variants", () => {
  assert.match(executiveSource, /function classifyRealtimeVerdict/);
  assert.match(executiveSource, /function isRealtimeRisk/);
  assert.match(executiveSource, /const unknown = visibleEvents\.filter/);
  assert.match(executiveSource, /explicitRiskRate/);
  assert.match(executiveSource, /no se cuentan como riesgo/);
  assert.match(executiveSource, /source\.includes\("gps"\)/);
  assert.doesNotMatch(executiveSource, /length - valid|fraudRate|source === "browser_gps"|toLowerCase\(\) !== "valid"/);
});
