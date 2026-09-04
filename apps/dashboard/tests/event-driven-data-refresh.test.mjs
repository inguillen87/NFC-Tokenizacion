import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPaths = [
  "../src/components/consumer-network-live-refresh.tsx",
  "../src/components/physical-taps-command-center.tsx",
  "../src/components/tenant-engagement-panel.tsx",
  "../src/components/admin-notification-bell.tsx",
];

const [consumerNetwork, physicalTaps, engagement, notifications] = await Promise.all(
  componentPaths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
);

test("dashboard data surfaces contain no browser polling intervals", () => {
  for (const source of [consumerNetwork, physicalTaps, engagement, notifications]) {
    assert.doesNotMatch(source, /(?:window\.)?setInterval\s*\(/);
    assert.doesNotMatch(source, /cada\s+(?:5|10|15)\s*s|cada\s+10\s+segundos/i);
  }
});

test("tap and engagement views reconcile from scoped SSE events and operator actions", () => {
  for (const source of [consumerNetwork, physicalTaps, engagement]) {
    assert.match(source, /useDashboardRealtime\(\)/);
    assert.doesNotMatch(source, /new EventSource\(/);
    assert.match(source, /unreadDashboardRealtimeFrames\(/);
    assert.match(source, /realtime\.events/);
    assert.match(source, /dashboardRealtimeConsumerFellBehind\(/);
    assert.match(source, /realtime\.snapshot/);
    assert.match(source, /visibilitychange/);
  }
  assert.match(consumerNetwork, /onClick=\{refresh\}/);
  assert.match(physicalTaps, /aria-label="Actualizar TAP físicos ahora"/);
  assert.match(engagement, /<RefreshCw size=\{15\} \/> Actualizar/);
  assert.match(engagement, />Reintentar</);
});

test("notification inbox loads initially and on meaningful SSE frames, never on heartbeat", () => {
  assert.match(notifications, /void load\(\);[\s\S]*?document\.addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(notifications, /realtime\.snapshot\.receivedAt[\s\S]*?void load\(\)/);
  assert.match(notifications, /frames\.some\(\(frame\) => notificationMayHaveChanged\(frame\.data\)\)[\s\S]*?void load\(\)/);
  assert.match(notifications, /realtime\.heartbeat\.receivedAt/);
  assert.doesNotMatch(notifications, /realtime\.heartbeat[\s\S]{0,120}void load\(\)/);
});
