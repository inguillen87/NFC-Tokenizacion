import test from "node:test";
import assert from "node:assert/strict";
import { tsImport } from "tsx/esm/api";

const { mergeRealtimeEvents } = await tsImport("../src/lib/realtime-feed.ts", import.meta.url);

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

test("dashboard replaces a mutable actor and consent projection without adding activity", () => {
  const consented = {
    eventId: "evt-41",
    tenantId: "t1",
    tenantSlug: "tenant-a",
    batchId: "b1",
    tagId: "tag-1",
    uidMasked: "04A1****D4",
    occurredAt: "2026-09-03T12:00:00.000Z",
    verdict: "identified_unverified",
    knownActorCount: 1,
    knownActor: true,
    commercialConsentGranted: true,
    commercialConsentChannels: ["email"],
    riskLevel: "none",
    source: "production",
  };
  const revokedProjection = {
    ...consented,
    knownActorCount: 0,
    knownActor: false,
    commercialConsentGranted: false,
    commercialConsentChannels: [],
  };

  const merged = mergeRealtimeEvents([consented], revokedProjection, 40);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].eventId, "evt-41");
  assert.equal(merged[0].knownActor, false);
  assert.equal(merged[0].commercialConsentGranted, false);
});
