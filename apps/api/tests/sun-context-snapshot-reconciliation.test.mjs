import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/app/sun/context/route.ts", import.meta.url),
  "utf8",
);

test("SUN context binds the snapshot update only to the verified fresh capability", () => {
  const consume = source.indexOf("const capability = await consumeSunFreshHandoff(");
  const binding = source.indexOf("const capabilityBinding = capability.payload", consume);
  const cte = source.indexOf("WITH bound_pair AS MATERIALIZED", binding);

  assert.notEqual(consume, -1);
  assert.notEqual(binding, -1);
  assert.notEqual(cte, -1);
  assert.ok(consume < binding && binding < cte);
  assert.match(source, /diagnostic\.id = \$\{capabilityBinding\.diagnosticId\}/);
  assert.match(source, /diagnostic\.trace_id = \$\{capabilityBinding\.traceId\}/);
  assert.match(source, /event\.id = \$\{capabilityBinding\.eventId\}::bigint/);
  assert.match(source, /diagnostic\.bid = \$\{capabilityBinding\.bid\}/);
  assert.match(source, /diagnostic\.read_counter = \$\{boundReadCounter\}/);
  assert.match(source, /event\.meta->>'trace_id' = \$\{capabilityBinding\.traceId\}/);
  assert.doesNotMatch(source, /body\.(?:diagnosticId|diagnostic_id|traceId|trace_id)/);
});

test("event and frozen snapshot reconciliation share one atomic data-modifying CTE", () => {
  const cteStart = source.indexOf("WITH bound_pair AS MATERIALIZED");
  const cteEnd = source.indexOf("`;", cteStart);
  const cte = source.slice(cteStart, cteEnd);

  assert.notEqual(cteStart, -1);
  assert.notEqual(cteEnd, -1);
  assert.equal((source.match(/UPDATE events event/g) || []).length, 1);
  assert.equal((source.match(/UPDATE sun_diagnostics diagnostic/g) || []).length, 1);
  assert.match(cte, /updated_event AS \([\s\S]*updated_diagnostic AS \(/);
  assert.match(cte, /FROM updated_event event[\s\S]*CROSS JOIN updated_diagnostic diagnostic/);
  assert.match(cte, /SET post_tap_location_observation = \$\{JSON\.stringify\(browserLocationObservation\)\}::jsonb/);
  assert.match(cte, /event\.post_tap_location_observation IS NULL/);
  assert.doesNotMatch(cte, /\n\s*(?:lat|lng|geo_lat|geo_lng|city|country_code|geo_city|geo_country) = /);
  assert.doesNotMatch(cte, /SET meta =|device_label =|geo_precision =|location_source =/);
  assert.doesNotMatch(source, /if \(storage\.isEnum\)/);
});

test("the CTE fails closed on consumed QA evidence and non-unique binding", () => {
  assert.match(source, /NOT EXISTS \([\s\S]*FROM supplier_qa_diagnostic_consumptions consumption/);
  assert.match(source, /consumption\.diagnostic_id = diagnostic\.id/);
  assert.match(source, /consumption\.canonical_event_id = event\.id/);
  assert.match(source, /FOR UPDATE OF diagnostic, event/);
  assert.match(source, /unique_pair AS MATERIALIZED \([\s\S]*WHERE \(SELECT COUNT\(\*\) FROM bound_pair\) = 1/);
  assert.match(source, /UPDATE events event[\s\S]*FROM unique_pair binding/);
  assert.match(source, /UPDATE sun_diagnostics diagnostic[\s\S]*FROM unique_pair binding/);
  assert.match(source, /if \(persistenceRows\.length !== 1\)/);
  assert.match(source, /SELECT EXISTS \([\s\S]*AS evidence_already_consumed/);
  assert.match(source, /evidenceAlreadyConsumed = consumptionRows\[0\]\?\.evidence_already_consumed === true/);
  assert.match(source, /if \(evidenceAlreadyConsumed\)[\s\S]*reason: "sun_context_evidence_already_consumed"/);
  assert.match(source, /reason: "capability_bound_snapshot_mismatch"/);
  assert.match(source, /if \(sqlState\(error\) === "55000"\)/);
  assert.match(source, /reason: "sun_context_evidence_already_consumed"/);
  assert.match(source, /reason: "context_persistence_unavailable"/);
});

test("snapshot reconciliation adds one coarse browser observation without replacing tapContext", () => {
  const patchStart = source.indexOf("const browserLocationObservation = {");
  const patchEnd = source.indexOf("let persistenceRows", patchStart);
  const snapshotPatch = source.slice(patchStart, patchEnd);
  const diagnosticStart = source.indexOf("updated_diagnostic AS (");
  const diagnosticEnd = source.indexOf("SELECT\n        event.id AS event_id", diagnosticStart);
  const diagnosticUpdate = source.slice(diagnosticStart, diagnosticEnd);

  assert.notEqual(patchStart, -1);
  assert.notEqual(patchEnd, -1);
  assert.match(snapshotPatch, /schemaVersion: "sun-browser-location-observation\/v1"/);
  assert.match(snapshotPatch, /consent: body\.geoConsent === true[\s\S]*precision: hasBrowserLocation \? "approximate"/);
  assert.match(snapshotPatch, /publicBrowserLocationObservation[\s\S]*lat: publicLocation\.lat,[\s\S]*lng: publicLocation\.lng/);
  assert.doesNotMatch(snapshotPatch, /\n\s*(?:client|device|geoError|uid|fresh_token|freshToken):/);
  assert.match(diagnosticUpdate, /jsonb_set\([\s\S]*'\{contract,tapContext,browserLocationObservation\}'/);
  assert.doesNotMatch(diagnosticUpdate, /\(diagnostic\.result_json #> '\{contract,tapContext\}'\) \|\|/);
  assert.doesNotMatch(diagnosticUpdate, /raw_result|timelineSummary|\{contract,provenance\}/);
});

test("a later browser observation is not republished as the original canonical tap event", () => {
  assert.doesNotMatch(source, /publishRealtimeEvent/);
  assert.match(source, /const locationSource = "browser_geolocation_approximate_consent"/);
  assert.match(source, /timing: "client_reported_after_tap"/);
});
