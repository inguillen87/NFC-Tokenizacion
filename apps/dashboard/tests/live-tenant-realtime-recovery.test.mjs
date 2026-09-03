import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const crm = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8");
const login = await readFile(new URL("../src/components/login-form-panel.tsx", import.meta.url), "utf8");
const session = await readFile(new URL("../src/lib/session.ts", import.meta.url), "utf8");
const account = await readFile(new URL("../src/components/tenant-account-menu.tsx", import.meta.url), "utf8");
const fallbackStream = await readFile(new URL("../src/app/api/admin/events/stream/route.ts", import.meta.url), "utf8");
const map = await readFile(new URL("../src/components/realtime-maplibre-map.tsx", import.meta.url), "utf8");

test("CRM keeps SSE as the primary channel and reconciles persisted events every ten seconds", () => {
  assert.match(crm, /new EventSource\(streamUrl\.toString\(\)\)/);
  assert.match(crm, /new URL\("\/api\/admin\/events", window\.location\.origin\)/);
  assert.match(crm, /pollUrl\.searchParams\.set\("source", streamSource\)/);
  assert.match(crm, /pollUrl\.searchParams\.set\("range", timeRange\)/);
  assert.doesNotMatch(crm, /streamSource === "production" \? "real" : streamSource/);
  assert.match(crm, /setInterval\(\(\) => void pollPersistedEvents\(\), 10_000\)/);
  assert.match(crm, /normalizeTenantTapRealtimeEvent/);
  assert.match(crm, /row\.source !== "production"/);
  assert.match(crm, /Actualizando por respaldo/);
  assert.match(crm, /eventos persistidos se consultan cada 10 segundos/);
});

test("demo access is unmistakably isolated from a real tenant session", () => {
  assert.match(login, /data-testid="login-real-tenant-entry"/);
  assert.match(login, /Consultar TAP físicos y actividad reportada/);
  assert.match(login, /No muestra lecturas NFC físicas/);
  assert.match(login, /Abrir demo simulada/);
  assert.match(home, /data-testid="dashboard-demo-session-warning"/);
  assert.match(home, /simulación, no el tenant productivo/);
  assert.match(session, /label: "Demo Bodega Balmec"/);
  assert.match(account, /isDemo \? "Demo tenant"/);
  assert.match(account, /Simulación local/);
  assert.match(crm, /isDemo=\{account\.isDemo\}/);
});

test("fallback streams rotate before the platform timeout and the map expression uses one zoom operator", () => {
  assert.match(fallbackStream, /lifetime = setTimeout\(close, 55_000\)/);
  assert.match(fallbackStream, /enqueue\("retry: 3000/);
  const radiusBlock = map.match(/id: "tap-nearby-radius"[\s\S]*?"circle-radius": \[([\s\S]*?)\n\s*\],\n\s*"circle-color"/u)?.[1] || "";
  assert.equal((radiusBlock.match(/"zoom"/g) || []).length, 1);
});
