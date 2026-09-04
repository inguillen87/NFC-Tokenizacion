import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../src/components/consumer-network-live-refresh.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/(app)/consumer-network/overview/page.tsx", import.meta.url), "utf8");

test("consumer network refreshes from tenant-scoped SSE without periodic polling", () => {
  assert.match(component, /useDashboardRealtime\(\)/);
  assert.doesNotMatch(component, /new EventSource\(/);
  assert.match(component, /realtime\.event/);
  assert.match(component, /realtime\.snapshot/);
  assert.match(component, /setMode\("live"\)/);
  assert.doesNotMatch(component, /setInterval|RECONCILE_INTERVAL_MS|startPolling|stopPolling/);
  assert.match(component, /realtime\.status === "reconnecting"/);
  assert.match(component, /refreshOnVisibleRef\.current = true/);
  assert.match(component, /if \(refreshOnVisibleRef\.current\)[\s\S]*?queueRefresh\(\)/);
  assert.match(component, /pendingRef\.current[\s\S]*?trailingRefreshRef\.current/);
  assert.match(component, /EventSource intenta restablecer el canal automáticamente/);
  assert.match(component, /router\.refresh\(\)/);
  assert.match(component, /document\.visibilityState === "visible"/);
  assert.match(component, /data-testid="consumer-network-live-refresh"/);
});

test("demo never refreshes production while non-sensitive roles retain explicit refresh only", () => {
  assert.match(page, /dashboardHighImpactPermissionMatches\([\s\S]*?"events\.read_sensitive"/);
  assert.match(page, /refreshEnabled=\{!session\.isDemo\}/);
  assert.match(page, /streamEnabled=\{canReadSensitiveEvents\}/);
  assert.match(component, /if \(!refreshEnabled \|\| !streamEnabled\)[\s\S]*?setMode\("manual"\)/);
  assert.match(component, /Actualización bajo demanda/);
  assert.doesNotMatch(component, /Actualización periódica|cada 10 segundos|polling/);
  assert.doesNotMatch(component, /demoFallback|sandbox/);
});

test("consumer network distinguishes session resolver outages from generic CRM failures", () => {
  assert.match(page, /x-nexid-auth-outcome"\) === "session-resolver-unavailable"/);
  assert.match(page, /session_unavailable/);
  assert.match(page, /Sesión temporalmente no verificable/);
  assert.match(component, /Último intento de actualización/);
  assert.match(page, /Taps SUN operativos/);
});
