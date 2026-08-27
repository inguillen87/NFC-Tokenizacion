import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analytics = await readFile(new URL("../src/app/admin/analytics/route.ts", import.meta.url), "utf8");

test("commercial tap signals stay tenant-scoped, filtered and aggregate-only", () => {
  assert.match(analytics, /const aggregateTenant = tenant \|\| ""/);
  assert.match(analytics, /WHERE \(\$\{aggregateTenant\} = '' OR tn\.slug = \$\{aggregateTenant\}\)/);
  assert.match(analytics, /e\.created_at >= now\(\) - \$\{rangeSql\}::interval/);
  assert.match(analytics, /e\.source::text = \$\{source\}/);
  assert.match(analytics, /e\.country_code[\s\S]*?= \$\{country\}/);
  assert.match(analytics, /SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE/);

  const contractStart = analytics.indexOf("commercialSignals: {");
  const contractEnd = analytics.indexOf("feed:", contractStart);
  assert.ok(contractStart > 0 && contractEnd > contractStart);
  const contract = analytics.slice(contractStart, contractEnd);
  assert.match(contract, /aggregateOnly: true/);
  assert.match(contract, /rawCoordinatesIncluded: false/);
  assert.match(contract, /individualDeviceContextIncluded: false/);
  assert.match(contract, /socioeconomicStatusInferred: false/);
  assert.doesNotMatch(contract, /lat:|lng:|uidHex|userAgent|hardware/);
});

test("commercial signals expose browser-reported model, capability, connection and location provenance with coverage", () => {
  assert.match(analytics, /meta->'sun_context'->'client'->>'model'/);
  assert.match(analytics, /NULLIF\(e\.device_label, ''\)/);
  assert.match(analytics, /meta->'sun_context'->'device'->'capabilitySegment'->>'band'/);
  assert.match(analytics, /meta->'sun_context'->'client'->'connection'->>'effectiveType'/);
  assert.match(analytics, /meta->'sun_context'->'geo'->>'source'/);
  assert.match(analytics, /COALESCE\(NULLIF\(e\.location_source, ''\), NULLIF\(e\.meta->'sun_context'->'geo'->>'source', ''\), 'unknown'\) AS label/);
  assert.match(analytics, /extended_context_consent/);
  assert.match(analytics, /reported_device_capability_heuristic/);
  assert.match(analytics, /socioeconomicStatus: "not_inferred"/);
  assert.match(analytics, /browserReportedValuesVerified: false/);
  assert.match(analytics, /coverageConfidence\(/);
  assert.match(analytics, /coverageShare\(/);
});
