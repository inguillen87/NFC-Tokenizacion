import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../src/components/consumer-network-live-refresh.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/(app)/consumer-network/overview/page.tsx", import.meta.url), "utf8");

test("consumer network refreshes from tenant-scoped SSE and polls only while the stream is unavailable", () => {
  assert.match(component, /new EventSource\(streamUrl\.toString\(\)\)/);
  assert.match(component, /streamUrl\.searchParams\.set\("source", "production"\)/);
  assert.match(component, /if \(tenantSlug\) streamUrl\.searchParams\.set\("tenant", tenantSlug\)/);
  assert.match(component, /source\.addEventListener\("event", onEvent as EventListener\)/);
  assert.match(component, /source\.addEventListener\("snapshot", onSnapshot as EventListener\)/);
  assert.match(component, /reconcileTimer = window\.setInterval\(poll, RECONCILE_INTERVAL_MS\)/);
  assert.match(component, /streamHealthy = true;[\s\S]*?stopPolling\(\);[\s\S]*?setMode\("live"\)/);
  assert.match(component, /document\.visibilityState !== "visible"[\s\S]*?stopPolling\(\)/);
  assert.match(component, /refreshOnVisible = true/);
  assert.match(component, /if \(refreshOnVisible\)[\s\S]*?queueRefresh\(\)/);
  assert.match(component, /pendingRef\.current[\s\S]*?trailingRefreshRef\.current/);
  assert.match(component, /const RECONCILE_INTERVAL_MS = 10_000/);
  assert.match(component, /router\.refresh\(\)/);
  assert.match(component, /document\.visibilityState === "visible"/);
  assert.match(component, /data-testid="consumer-network-live-refresh"/);
});

test("demo never refreshes production while authorized non-sensitive roles retain durable polling", () => {
  assert.match(page, /dashboardHighImpactPermissionMatches\([\s\S]*?"events\.read_sensitive"/);
  assert.match(page, /refreshEnabled=\{!session\.isDemo\}/);
  assert.match(page, /streamEnabled=\{canReadSensitiveEvents\}/);
  assert.match(component, /if \(streamEnabled\) \{[\s\S]*?new EventSource\(streamUrl\.toString\(\)\)/);
  assert.match(component, /else \{[\s\S]*?enterPollingMode\(\)/);
  assert.doesNotMatch(component, /source", "demo"|demoFallback|sandbox/);
});

test("consumer network distinguishes session resolver outages from generic CRM failures", () => {
  assert.match(page, /x-nexid-auth-outcome"\) === "session-resolver-unavailable"/);
  assert.match(page, /session_unavailable/);
  assert.match(page, /Sesión temporalmente no verificable/);
  assert.match(component, /Último intento de actualización/);
  assert.match(page, /Taps SUN operativos/);
});
