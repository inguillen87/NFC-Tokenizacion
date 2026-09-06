import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const [{ classifyRealtimeVerdict, isRealtimeRisk }, source, executiveSource, multirubroSource, windowActivity] = await Promise.all([
  tsImport("../src/lib/realtime-feed.ts", import.meta.url),
  readFile(new URL("../src/components/realtime-ops-monitor.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/multirubro-ops-panel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/crm-window-activity.ts", import.meta.url), "utf8"),
]);

test("realtime operations centralize verdict classes and exclude lifecycle unknowns from risk", () => {
  assert.equal(classifyRealtimeVerdict("VALID_OPENED"), "valid");
  assert.equal(classifyRealtimeVerdict("CLAIMED"), "unknown");
  assert.equal(classifyRealtimeVerdict("NOT_REGISTERED"), "unknown");
  assert.equal(classifyRealtimeVerdict({
    verdict: "identified_unverified",
    eventType: "PROVENANCE_VIEWED",
    result: "QR_SCAN",
  }), "identified_unverified");
  assert.equal(isRealtimeRisk({ verdict: "identified_unverified", eventType: "PROVENANCE_VIEWED" }), false);
  assert.equal(isRealtimeRisk("CLAIMED"), false);
  assert.equal(isRealtimeRisk("NOT_REGISTERED"), false);
  assert.equal(isRealtimeRisk("REPLAY_SUSPECT"), true);
  assert.equal(isRealtimeRisk("TAMPER_RISK"), true);
  assert.equal(isRealtimeRisk("INVALID"), true);
  assert.equal(isRealtimeRisk("REVOKED"), true);
  assert.equal(classifyRealtimeVerdict({ verdict: "valid", result: "REPLAY_SUSPECT" }), "duplicate_replay");
  assert.equal(classifyRealtimeVerdict({ verdict: "valid", result: "TAMPER_RISK" }), "tamper");
  assert.equal(classifyRealtimeVerdict({ verdict: "valid", result: "REVOKED" }), "invalid");
  assert.equal(classifyRealtimeVerdict({ verdict: "valid", result: "INVALID" }), "invalid");

  assert.match(source, /classifyRealtimeVerdict,/);
  assert.match(source, /isRealtimeRisk,/);
  assert.doesNotMatch(source, /function classifyRealtimeVerdict|function isRealtimeRisk/);
  assert.doesNotMatch(source, /length - valid|!== "valid"|!== "VALID"|result !== "VALID"/);
});

test("all realtime risk derivatives use the centralized classification", () => {
  assert.match(source, /risk: isRealtimeRisk\(result, row\.reason\) \? 1 : 0/);
  assert.match(source, /if \(isRealtimeRisk\(row\.verdict, row\.reason\)\) current\.risk \+= 1/);
  assert.match(source, /const risk = visibleEvents\.filter\(\(item\) => isRealtimeRisk\(item\.verdict, item\.reason\)\)\.length/);
  assert.match(source, /if \(isRealtimeRisk\(event\.verdict, event\.reason\)\) buckets\[bucketIndex\]\.risk \+= 1/);
  assert.match(source, /visibleEvents\.filter\(\(event\) => isRealtimeRisk\(event\.verdict, event\.reason\)\)/);
  assert.match(source, /ALERTA DE RIESGO NFC/);
  assert.match(source, /liveMetrics\.unknown/);
  assert.match(multirubroSource, /classifyRealtimeVerdict\(payload, payload\.reason\)/);
  assert.match(multirubroSource, /isRealtimeRisk\(payload, payload\.reason\)/);
});

test("only the explicit consented GPS provenance class is campaign-eligible", () => {
  assert.match(source, /classifyLocationProvenance\(value\) === "consented_gps"/);
  assert.match(source, /GPS reportado por cliente/);
  assert.match(source, /no verificacion independiente/);
  assert.match(source, /isClientReportedGps\(item\.locationSource\)/);
  assert.doesNotMatch(source, /source === "browser_gps"|source\.includes\("gps"\)/);
});

test("executive CRM keeps lifecycle unknowns out of risk and recognizes reported GPS variants", () => {
  assert.match(executiveSource, /classifyRealtimeVerdict,/);
  assert.match(executiveSource, /isRealtimeRisk,/);
  assert.doesNotMatch(executiveSource, /function classifyRealtimeVerdict|function isRealtimeRisk/);
  assert.match(executiveSource, /const unknown = visibleEvents\.filter/);
  assert.match(executiveSource, /explicitRiskRate/);
  assert.match(windowActivity, /const eventRisk = isRealtimeRisk\(event\)/);
  assert.match(windowActivity, /signal: eventRisk \? "risk" : eventOpened \? "opened" : "activity"/);
  assert.match(executiveSource, /classifyLocationProvenance\(value\) === "consented_gps"/);
  assert.match(executiveSource, /productIdentityRecognized/);
  assert.match(executiveSource, /knownActor/);
  assert.match(executiveSource, /commercialConsentChannels/);
  assert.match(executiveSource, /isCommercialActivitySignal/);
  assert.match(executiveSource, /isGeoOpportunitySignal/);
  assert.doesNotMatch(executiveSource, /length - valid|fraudRate|source === "browser_gps"|source\.includes\("gps"\)|toLowerCase\(\) !== "valid"/);
});
