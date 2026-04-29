import test from "node:test";
import assert from "node:assert/strict";

const { mergeRealtimeEvents } = await import("../src/lib/realtime-feed.ts");

test("dashboard dedupes repeated eventId", () => {
  const first = {
    eventId: "evt-1",
    tenantId: "t1",
    tenantSlug: "tenant-a",
    batchId: "b1",
    tagId: "tag-1",
    uidMasked: "04A1****D4",
    occurredAt: "2026-04-28T00:00:00.000Z",
    verdict: "valid",
    riskLevel: "none",
    source: "production",
  };
  const second = { ...first, occurredAt: "2026-04-28T00:00:10.000Z" };
  const merged = mergeRealtimeEvents([first], second, 40);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].eventId, "evt-1");
});
