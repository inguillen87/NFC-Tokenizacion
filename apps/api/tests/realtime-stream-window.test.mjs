import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  REALTIME_STREAM_WINDOW_IDS,
  resolveRealtimeStreamWindow,
} = await import("../src/lib/realtime-stream-window.ts");

test("snapshot and live filtering share one exact realtime window definition", () => {
  assert.deepEqual(REALTIME_STREAM_WINDOW_IDS, ["5m", "1h", "24h", "7d", "30d", "all"]);
  assert.deepEqual(resolveRealtimeStreamWindow(undefined), {
    id: "24h",
    interval: "24 hours",
    maxAgeMs: 24 * 60 * 60 * 1_000,
  });
  assert.equal(resolveRealtimeStreamWindow(" 7D ")?.interval, "7 days");
  assert.equal(resolveRealtimeStreamWindow("all")?.maxAgeMs, null);
});

test("unsupported realtime windows fail closed instead of widening live delivery", () => {
  for (const value of ["", "2h", "forever", "24 hours", "1h; drop table events"]) {
    assert.equal(resolveRealtimeStreamWindow(value), null, value || "empty");
  }
});

test("the SSE route returns 400 before opening a stream and reuses the validated window", async () => {
  const source = await readFile(new URL("../src/app/admin/events/stream/route.ts", import.meta.url), "utf8");
  const invalidWindowIndex = source.indexOf('reason: "invalid_window"');
  const streamIndex = source.indexOf("new ReadableStream<Uint8Array>");
  assert.ok(invalidWindowIndex >= 0 && streamIndex > invalidWindowIndex);
  assert.match(source, /allowed: REALTIME_STREAM_WINDOW_IDS/);
  assert.match(source, /fetchRows\(searchParams, realtimeWindow, forcedTenantSlug, sourceFilter\)/);
  assert.match(source, /realtimeWindow\.maxAgeMs !== null/);
  assert.match(source, /scope: \{ tenant: tenant \|\| "global", window: realtimeWindow\.id \}/);
});
