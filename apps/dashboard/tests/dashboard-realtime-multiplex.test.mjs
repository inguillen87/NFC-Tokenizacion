import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const {
  appendDashboardRealtimeBuffer,
  appendDashboardRealtimeFrame,
  dashboardRealtimeConsumerFellBehind,
  dashboardRealtimeControlConfirmsReady,
  dashboardRealtimeSnapshotConfirmsReady,
  unreadDashboardRealtimeFrames,
} = await tsImport("../src/lib/dashboard-realtime-buffer.ts", import.meta.url);

const sources = Object.fromEntries(await Promise.all([
  "dashboard-realtime-provider.tsx",
  "dashboard-shell.tsx",
  "executive-realtime-crm.tsx",
  "physical-taps-command-center.tsx",
  "admin-notification-bell.tsx",
  "multirubro-ops-panel.tsx",
  "tenant-engagement-panel.tsx",
  "consumer-network-live-refresh.tsx",
  "realtime-ops-monitor.tsx",
].map(async (name) => [
  name,
  await readFile(new URL(`../src/components/${name}`, import.meta.url), "utf8"),
])));

const bff = await readFile(new URL("../src/app/api/admin/events/stream/route.ts", import.meta.url), "utf8");

test("one shell provider owns the only dashboard EventSource", () => {
  const eventSourceConstructions = Object.values(sources)
    .flatMap((source) => source.match(/new EventSource\(/g) || []);
  assert.equal(eventSourceConstructions.length, 1);
  assert.match(sources["dashboard-realtime-provider.tsx"], /const stream = new EventSource\(streamUrl\.toString\(\)\)/);
  assert.match(sources["dashboard-shell.tsx"], /<DashboardRealtimeProvider[\s\S]*?<DashboardShellInner \{\.\.\.props\} \/>[\s\S]*?<\/DashboardRealtimeProvider>/);

  for (const component of [
    "executive-realtime-crm.tsx",
    "physical-taps-command-center.tsx",
    "admin-notification-bell.tsx",
    "multirubro-ops-panel.tsx",
    "tenant-engagement-panel.tsx",
    "consumer-network-live-refresh.tsx",
    "realtime-ops-monitor.tsx",
  ]) {
    assert.match(sources[component], /useDashboardRealtime\(\)/, `${component} must consume the shared transport`);
    assert.doesNotMatch(sources[component], /new EventSource\(/, `${component} must not open another transport`);
  }
});

test("the shared transport is a stable session superset and view filters stay local", () => {
  const provider = sources["dashboard-realtime-provider.tsx"];
  const crm = sources["executive-realtime-crm.tsx"];
  assert.match(provider, /window: "all"/);
  assert.match(provider, /limit: 50/);
  assert.match(provider, /tenant: tenantSlug \|\| ""/);
  assert.match(provider, /source,/);
  assert.match(crm, /const cutoff = freshnessNow - timeRangeMs\(timeRange\)/);
  assert.match(crm, /effectiveSelectedTenant === "all" \? events : events\.filter/);
  assert.doesNotMatch(crm, /searchParams\.set\("window", timeRange\)/);
  assert.doesNotMatch(crm, /searchParams\.set\("tenant", queryTenant\).*new EventSource/s);
});

test("the shared transport drains ordered bursts and exposes bounded-buffer overflow", () => {
  const scopeKey = "balmec|all|production|50";
  const frames = Array.from({ length: 300 }, (_, index) => ({
    data: { eventId: `evt-${index + 1}` },
    eventId: `cursor-${index + 1}`,
    receivedAt: `2026-09-04T12:00:${String(index % 60).padStart(2, "0")}.000Z`,
    scopeKey,
    sequence: index + 1,
  }));
  const shortBurst = frames.slice(0, 3).reduce(
    (current, frame) => appendDashboardRealtimeFrame(current, frame, 3),
    [],
  );
  assert.deepEqual(shortBurst.map((frame) => frame.sequence), [1, 2, 3]);

  const buffer = frames.reduce(
    (current, frame) => appendDashboardRealtimeBuffer(current, frame, 256),
    { frames: [], droppedThroughSequence: 0 },
  );
  assert.equal(buffer.frames.length, 256);
  assert.equal(buffer.droppedThroughSequence, 44);
  assert.deepEqual(buffer.frames.slice(0, 2).map((frame) => frame.sequence), [45, 46]);
  assert.deepEqual(buffer.frames.slice(-2).map((frame) => frame.sequence), [299, 300]);
  assert.equal(dashboardRealtimeConsumerFellBehind(43, buffer.droppedThroughSequence), true);
  assert.equal(dashboardRealtimeConsumerFellBehind(44, buffer.droppedThroughSequence), false);
  assert.deepEqual(
    unreadDashboardRealtimeFrames(buffer.frames, 295, scopeKey).map((frame) => frame.sequence),
    [296, 297, 298, 299, 300],
  );
  assert.deepEqual(unreadDashboardRealtimeFrames(buffer.frames, 0, "other-scope"), []);
});

test("transport health requires an explicit ready control or a valid scoped ready snapshot", () => {
  const expected = { tenant: "balmec", window: "all", source: "production" };
  assert.equal(dashboardRealtimeControlConfirmsReady({ availability: "ready" }), true);
  assert.equal(dashboardRealtimeControlConfirmsReady({ availability: "fallback" }), false);
  assert.equal(dashboardRealtimeControlConfirmsReady({ availability: "upstream_error" }), false);
  assert.equal(dashboardRealtimeSnapshotConfirmsReady({
    availability: "ready",
    rows: [],
    scope: { tenant: "balmec", window: "all" },
    source: "production",
  }, expected), true);
  assert.equal(dashboardRealtimeSnapshotConfirmsReady({
    availability: "fallback",
    rows: [],
    scope: { tenant: "balmec", window: "all" },
    source: "production",
  }, expected), false);
  assert.equal(dashboardRealtimeSnapshotConfirmsReady({
    availability: "ready",
    rows: [],
    scope: { tenant: "other", window: "all" },
    source: "production",
  }, expected), false);
});

test("every shared consumer drains the ring and reconciles when its cursor falls behind", () => {
  for (const component of [
    "executive-realtime-crm.tsx",
    "physical-taps-command-center.tsx",
    "admin-notification-bell.tsx",
    "multirubro-ops-panel.tsx",
    "tenant-engagement-panel.tsx",
    "consumer-network-live-refresh.tsx",
    "realtime-ops-monitor.tsx",
  ]) {
    assert.match(sources[component], /unreadDashboardRealtimeFrames\(/, `${component} must drain ordered frames`);
    assert.match(sources[component], /dashboardRealtimeConsumerFellBehind\(/, `${component} must detect buffer overflow`);
    assert.match(sources[component], /droppedThroughSequence/, `${component} must advance across an overflow`);
    assert.doesNotMatch(sources[component], /realtime\.event\b/, `${component} must not consume only the latest frame`);
  }
});

test("open and heartbeat prove transport only; ready frames confirm data health", () => {
  const provider = sources["dashboard-realtime-provider.tsx"];
  assert.match(provider, /stream\.onopen = \(\) => \{[\s\S]*?setStatus\("connecting"\)/);
  assert.doesNotMatch(provider, /const onHeartbeat[\s\S]*?setStatus\("connected"\)[\s\S]*?const onWarning/);
  assert.match(provider, /dashboardRealtimeSnapshotConfirmsReady\(next\.data, activeScope\)/);
  assert.match(provider, /dashboardRealtimeControlConfirmsReady\(next\.data\)/);
  assert.match(provider, /const onWarning[\s\S]*?setStatus\("reconnecting"\)/);
  assert.match(provider, /addEventListener\("connected", onConnected/);
});

test("physical taps project complete events locally and only reconcile incomplete events with a strong rate limit", () => {
  const physical = sources["physical-taps-command-center.tsx"];
  assert.match(physical, /physicalFrames\.flatMap/);
  assert.match(physical, /physicalTapFromRealtimeProjection\(frame\.data, tenantSlug\)/);
  assert.match(physical, /projected\.reduce/);
  assert.match(physical, /mergePhysicalTapRealtimeProjection\(next, item\.row, item\.receivedAt\)/);
  assert.match(physical, /PHYSICAL_RECONCILE_MIN_INTERVAL_MS = 15_000/);
  assert.match(physical, /Exceptional durable reconciliation only/);
  assert.match(physical, /queuePhysicalTapsRefresh\(\)/);
  assert.doesNotMatch(physical, /setInterval\(/);
});

test("multirubro only counts canonical tap projections and understands camelCase evidence", () => {
  const multirubro = sources["multirubro-ops-panel.tsx"];
  assert.match(multirubro, /if \(!isExecutiveRealtimeEvent\(payload\)\) continue/);
  assert.match(multirubro, /payload\.eventId \|\| payload\.id/);
  assert.match(multirubro, /payload\.uidMasked \|\| payload\.uid_hex/);
  assert.match(multirubro, /payload\.tenantSlug \|\| payload\.tenant_slug/);
  assert.match(multirubro, /payload\.locationSource \|\| payload\.coordinate_source \|\| payload\.location_source/);
});

test("dashboard SSE BFF declares the long-running budget and disables proxy buffering", () => {
  assert.match(bff, /export const maxDuration = 300/);
  assert.equal((bff.match(/"X-Accel-Buffering": "no"/g) || []).length, 2);
  assert.match(bff, /signal: request\.signal/);
  assert.match(bff, /"Cache-Control": "no-cache, no-transform"/);
  assert.match(bff, /lifetime = setTimeout\(close, 55_000\)/);
});
