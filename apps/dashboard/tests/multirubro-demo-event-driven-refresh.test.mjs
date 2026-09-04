import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [multirubro, demoLab] = await Promise.all([
  readFile(new URL("../src/components/multirubro-ops-panel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/demo-lab.tsx", import.meta.url), "utf8"),
]);

test("multirubro and Demo Lab do not poll data on browser intervals", () => {
  for (const source of [multirubro, demoLab]) {
    assert.doesNotMatch(source, /(?:window\.)?setInterval\s*\(/);
  }
  assert.doesNotMatch(multirubro, /10_000/);
  assert.doesNotMatch(demoLab, /12000/);
});

test("multirubro refreshes from tenant events, operator intent, and tab return", () => {
  assert.match(multirubro, /useDashboardRealtime\(\)/);
  assert.doesNotMatch(multirubro, /new EventSource\(/);
  assert.match(multirubro, /const frame = realtime\.snapshot/);
  assert.match(multirubro, /const frames = unreadDashboardRealtimeFrames\(/);
  assert.match(multirubro, /if \(!isExecutiveRealtimeEvent\(payload\)\) continue/);
  assert.match(multirubro, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  assert.match(multirubro, /onClick=\{\(\) => void loadData\(\)\}/);
  assert.match(multirubro, />\s*Actualizar ahora\s*</);
  assert.match(multirubro, /void loadData\(\);[\s\S]*document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  const eventEffect = multirubro.match(/const frames = unreadDashboardRealtimeFrames[\s\S]*?\}, \[canReadSensitiveEvents, realtime\.activeScopeKey, realtime\.droppedThroughSequence, realtime\.events\]\);/)?.[0] || "";
  assert.ok(eventEffect);
  assert.match(eventEffect, /if \(fellBehind\)[\s\S]*?void loadData\(\)/);
});

test("Demo Lab loads once and refreshes only from user actions or tab return", () => {
  assert.match(demoLab, /useEffect\(\(\) => \{\s*void refresh\(\)/);
  assert.match(demoLab, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  assert.match(demoLab, /onClick=\{\(\) => void refresh\(\)\}/);
  assert.match(demoLab, /await refresh\(\)/);
});
