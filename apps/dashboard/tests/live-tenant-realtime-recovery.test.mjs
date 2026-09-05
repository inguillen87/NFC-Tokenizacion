import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const crm = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
const login = await readFile(new URL("../src/components/login-form-panel.tsx", import.meta.url), "utf8");
const session = await readFile(new URL("../src/lib/session.ts", import.meta.url), "utf8");
const account = await readFile(new URL("../src/components/tenant-account-menu.tsx", import.meta.url), "utf8");
const fallbackStream = await readFile(new URL("../src/app/api/admin/events/stream/route.ts", import.meta.url), "utf8");
const map = await readFile(new URL("../src/components/realtime-maplibre-map.tsx", import.meta.url), "utf8");

test("CRM uses a tenant-scoped event stream without browser polling", () => {
  assert.match(crm, /useDashboardRealtime\(\)/);
  assert.doesNotMatch(crm, /new EventSource\(/);
  assert.doesNotMatch(crm, /new URL\("\/api\/admin\/events", window\.location\.origin\)/);
  assert.doesNotMatch(crm, /pollPersistedEvents|startPollingFallback|pollingFallbackActive/);
  assert.match(crm, /executiveRealtimeSnapshotScopeMatches\(realtime\.activeScope\.tenant, realtime\.activeScope\.window, payload\.scope\)/);
  assert.match(crm, /EventSource está reconectando sin polling/);
  const heartbeatEffect = crm.match(/const frame = realtime\.heartbeat;[\s\S]*?\}, \[realtime\.activeScopeKey, realtime\.heartbeat\]\);/)?.[0] || "";
  assert.doesNotMatch(heartbeatEffect, /setStreamConfirmed\(true\)/);
  const eventEffect = crm.match(/const frames = unreadDashboardRealtimeFrames\([\s\S]*?\}, \[queryTenant,[\s\S]*?\]\);/)?.[0] || "";
  assert.doesNotMatch(eventEffect, /setStreamConfirmed\(true\)/);
  assert.doesNotMatch(crm, /incomingId === lastEventIdRef\.current/);
  assert.match(crm, /accepted\.reduce\([\s\S]*?mergeRealtimeEvents\(next, item\.payload, EXECUTIVE_REALTIME_EVENT_LIMIT\)/);
  assert.match(crm, /dashboardRealtimeConsumerFellBehind\(/);
  assert.match(crm, /router\.refresh\(\)/);
  assert.match(fallbackStream, /scope: \{ tenant: tenant \|\| "global", window: options\.window \|\| "24h" \}/);
});

test("demo access is unmistakably isolated from a real tenant session", () => {
  assert.match(login, /data-testid="login-real-tenant-entry"/);
  assert.match(login, /Consultar TAP físicos y actividad reportada/);
  assert.match(login, /No muestra lecturas NFC físicas/);
  assert.match(login, /Abrir demo simulada/);
  assert.match(shell, /data-testid="dashboard-demo-session-warning"/);
  assert.match(shell, /Sandbox ilustrativo: no muestra taps físicos\./);
  assert.match(shell, /Cambiar a cuenta piloto/);
  assert.match(session, /label: "Demo Bodega Balmec"/);
  assert.match(account, /isDemo \? "Demo tenant"/);
  assert.match(account, /Simulación local/);
  assert.match(crm, /isDemo=\{account\.isDemo\}/);
});

test("fallback streams rotate before the platform timeout and the map expression uses one zoom operator", () => {
  assert.match(fallbackStream, /lifetime = setTimeout\(close, 55_000\)/);
  assert.match(fallbackStream, /enqueue\("retry: 3000/);
  const radiusBlock = map.match(/id: "tap-nearby-radius"[\s\S]*?"circle-radius": \[([\s\S]*?)\r?\n\s*\],\r?\n\s*"circle-color"/u)?.[1] || "";
  assert.equal((radiusBlock.match(/"zoom"/g) || []).length, 1);
});
