import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoTapTimeline } from "../src/lib/consumer-network-demo-timeline.ts";

const tap = (eventId, dataProvenance = "declared_demo", tenantSlug = "demobodega", createdAt = "2026-09-03T12:15:00Z") => ({
  eventId, dataProvenance, tenantSlug, createdAt, verdict: null, riskLevel: null,
});

test("illustrative timeline never combines operational records, other tenants, or invalid timestamps", () => {
  const result = buildDemoTapTimeline([
    tap("example"), tap("real", "operational_tap"), tap("import", "imported"),
    tap("other", "declared_demo", "other-tenant"), tap("bad-date", "declared_demo", "demobodega", "invalid"),
  ], "demobodega");
  assert.deepEqual(result.records.map((record) => record.eventId), ["example"]);
  assert.equal(result.hours.reduce((sum, hour) => sum + hour.count, 0), 1);
});

test("illustrative timeline deduplicates events and reconciles all 24 UTC hour bins", () => {
  const result = buildDemoTapTimeline([
    tap("repeat"), tap("repeat"), tap("same-hour"),
    tap("offset", "declared_demo", "demobodega", "2026-09-03T06:00:00-03:00"),
  ], "demobodega");
  assert.equal(result.records.length, 3);
  assert.equal(result.hours.length, 24);
  assert.equal(result.hours[9].count, 1);
  assert.equal(result.hours[12].count, 2);
  assert.equal(result.hours.reduce((sum, hour) => sum + hour.count, 0), 3);
  assert.equal(result.maxCount, 2);
  assert.equal(buildDemoTapTimeline([], "demobodega").records.length, 0);
});
