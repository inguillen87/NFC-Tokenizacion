import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (url) => readFile(new URL(url, import.meta.url), "utf8");

test("realtime CRM recovers incidents from events, reconnect snapshots and operator visibility", async () => {
  const source = await read("../src/components/executive-realtime-crm.tsx");
  assert.match(source, /useDashboardRealtime\(\)/);
  assert.doesNotMatch(source, /new EventSource\(/);
  assert.match(source, /isIncidentRealtimeWireEvent\(payload\)/);
  assert.match(source, /fetch\(url, \{ cache: "no-store", signal: controller\.signal \}\)/);
  assert.match(source, /incidentRequestAbortRef\.current\?\.abort\(\)/);
  assert.doesNotMatch(source, /setInterval\(\(\) => void refreshIncidents/);
  assert.match(source, /if \(canReadIncidents\) void refreshIncidents\(\)/);
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.match(source, /setIncidentAvailability\("unavailable"\)/);
  assert.match(source, /!dashboardPermissionDenied\(account\.deniedPermissions, "incidents:read"\)/);
  assert.match(source, /dashboardPermissionMatches\(account\.permissions, "incidents:read", account\.deniedPermissions\)/);
  assert.match(source, /!dashboardPermissionDenied\(account\.deniedPermissions, "incidents:write"\)/);
  assert.match(source, /dashboardPermissionMatches\(account\.permissions, "incidents:write", account\.deniedPermissions\)/);
  assert.match(source, /data-testid="open-event-incident-drawer"/);
});

test("event drawer explains persisted evidence and supports immediate open/transition updates", async () => {
  const [drawer, workflow] = await Promise.all([
    read("../src/components/incident-event-drawer.tsx"),
    read("../src/lib/incident-workflow.ts"),
  ]);
  assert.match(drawer, /La explicación siguiente es determinística/);
  assert.match(drawer, /fetch\("\/api\/admin\/incidents",/);
  assert.match(drawer, /url\.searchParams\.set\("eventId", String\(event\.eventId\)\)/);
  assert.match(drawer, /matches\.length !== payload\.incidents\.length \|\| matches\.length > 1/);
  assert.match(drawer, /eventLookupState !== "ready"/);
  assert.match(drawer, /Reintentar consulta segura/);
  assert.match(drawer, /"idempotency-key": idempotencyKey/);
  assert.match(drawer, /expectedVersion: incident\.version/);
  assert.match(drawer, /response\.status === 409 && failure === "stale_version"/);
  assert.match(drawer, /Otro operador actualizó este incidente/);
  assert.match(drawer, /setLookupRevision\(\(current\) => current \+ 1\)/);
  assert.match(drawer, /onIncident\(payload\.incident as DashboardIncident\)/);
  assert.match(drawer, /Historial inmutable/);
  assert.match(drawer, /No se interpreta la ausencia de datos como “sin incidente”/);
  assert.match(drawer, /incidents:read/);
  assert.match(drawer, /incidents:write/);
  assert.match(workflow, /recommendedIncidentSeverity/);
  assert.match(workflow, /La taxonomía no permite afirmar fraude ni validez/);
});

test("dashboard proxy applies dedicated read and write permissions to incident endpoints", async () => {
  const policy = await read("../src/lib/permission-policy.ts");
  assert.match(policy, /normalizedPath === "incidents" \|\| normalizedPath\.startsWith\("incidents\/"\)/);
  assert.match(policy, /"incidents:read" : "incidents:write"/);
});
