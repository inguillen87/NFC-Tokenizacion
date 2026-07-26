import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  allowRealtimeEventForSource,
  parseRealtimeEventSourceFilter,
} = await import("../src/lib/realtime-stream-filter.ts");
const { normalizeTenantTapRealtimeEvent } = await import("../../../packages/core/src/event-contract.ts");

test("SSE source parser accepts only the public aggregate and canonical persisted values", () => {
  for (const value of [undefined, "", "all", "production", "demo", "real", "imported"]) {
    assert.notEqual(parseRealtimeEventSourceFilter(value), null, String(value));
  }
  assert.equal(parseRealtimeEventSourceFilter("seed"), null);
  assert.equal(parseRealtimeEventSourceFilter("alerts"), null);
  assert.equal(parseRealtimeEventSourceFilter("production OR 1=1"), null);
});

test("production means real plus imported and specific streams fail closed", () => {
  assert.equal(allowRealtimeEventForSource("production", "real"), true);
  assert.equal(allowRealtimeEventForSource("production", "imported"), true);
  assert.equal(allowRealtimeEventForSource("production", "demo"), false);
  assert.equal(allowRealtimeEventForSource("production", "seed"), false);
  assert.equal(allowRealtimeEventForSource("demo", "demo"), true);
  assert.equal(allowRealtimeEventForSource("demo", undefined), false);
  assert.equal(allowRealtimeEventForSource("all", undefined), true);
});

test("normalized SSE payload preserves the canonical event source", () => {
  const imported = normalizeTenantTapRealtimeEvent({ id: 1, source: "imported", created_at: "2026-07-26T00:00:00.000Z" });
  const seed = normalizeTenantTapRealtimeEvent({ id: 2, source: "seed", created_at: "2026-07-26T00:00:00.000Z" });
  assert.equal(imported.source, "production");
  assert.equal(imported.eventSource, "imported");
  assert.equal(seed.source, "demo");
  assert.equal(seed.eventSource, "seed");
});

test("SSE route applies source to both snapshots and live events before emitting", async () => {
  const source = await readFile(new URL("../src/app/admin/events/stream/route.ts", import.meta.url), "utf8");
  assert.match(source, /parseRealtimeEventSourceFilter\(searchParams\.get\("source"\)\)/);
  assert.match(source, /reason: "invalid_source_filter"/);
  assert.equal((source.match(/LOWER\(COALESCE\(e\.source, ''\)\) IN \('real', 'imported'\)/g) || []).length, 2);
  assert.match(source, /allowRealtimeEventForSource\(sourceFilter, rawPayload\.source\)/);
  assert.match(source, /if \(sourceFilter !== "all"\) return/);
});
