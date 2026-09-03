import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const stateSource = await readFile(new URL("../src/components/enterprise-ops-state.tsx", import.meta.url), "utf8");
const loadingSource = await readFile(new URL("../src/app/(app)/loading.tsx", import.meta.url), "utf8");
const errorSource = await readFile(new URL("../src/app/(app)/error.tsx", import.meta.url), "utf8");
const analyticsSource = await readFile(new URL("../src/app/(app)/analytics/page.tsx", import.meta.url), "utf8");
const leadsSource = await readFile(new URL("../src/app/(app)/leads-tickets/page.tsx", import.meta.url), "utf8");
const crmSource = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../src/components/realtime-maplibre-map.tsx", import.meta.url), "utf8");

test("shared operational states expose loading and failure semantics", () => {
  assert.match(stateSource, /role=\{isError \? "alert" : "status"\}/);
  assert.match(stateSource, /aria-live=\{isError \? "assertive" : "polite"\}/);
  assert.match(stateSource, /aria-busy=\{variant === "loading"\}/);
  assert.match(stateSource, /motion-reduce:animate-none/);
});

test("app workspace has honest loading and recoverable error boundaries", () => {
  assert.match(loadingSource, /Los datos no se reemplazan por valores simulados/);
  assert.match(loadingSource, /testId="dashboard-workspace-loading"/);
  assert.match(errorSource, /"use client"/);
  assert.match(errorSource, /onClick=\{reset\}/);
  assert.match(errorSource, /No mostramos métricas parciales/);
});

test("analytics separates confirmed zero activity from upstream failure and labels every filter", () => {
  assert.match(analyticsSource, /type AnalyticsAvailability = "ready" \| "upstream_error" \| "invalid_payload" \| "unreachable"/);
  assert.match(analyticsSource, /analyticsData\.availability === "ready" && analyticsData\.data/);
  assert.match(analyticsSource, /no convierte el fallo en métricas cero/);
  assert.match(analyticsSource, /aria-label="Filtros de analytics"/);
  assert.match(analyticsSource, /Ventana temporal/);
  assert.match(analyticsSource, /Fuente de datos/);
  assert.match(analyticsSource, /País \(ISO-2\)/);
});

test("CRM tracks connection, snapshots, heartbeat freshness and degraded stream warnings", () => {
  assert.match(crmSource, /const \[streamConfirmed, setStreamConfirmed\]/);
  assert.match(crmSource, /const \[connectionAttempted, setConnectionAttempted\]/);
  assert.match(crmSource, /source\.addEventListener\("heartbeat", onHeartbeat/);
  assert.match(crmSource, /source\.addEventListener\("warning", onWarning/);
  assert.match(crmSource, /freshnessNow - lastUpdateMs > 20_000/);
  assert.match(crmSource, /const \[pollingFallbackActive, setPollingFallbackActive\]/);
  assert.match(crmSource, /pollingFallbackActive && dataAvailability === "ready" && streamConfirmed/);
  assert.match(crmSource, /dataAvailability !== "ready" \|\| !streamConfirmed \|\| streamIsStale/);
  assert.match(crmSource, /no representan un cero operativo/);
  assert.match(crmSource, /data-testid="crm-stream-live-region"/);
  assert.match(crmSource, /aria-label="Filtrar lecturas por tenant"/);
});

test("realtime map has accessible status, failure fallback and a textual geographic summary", () => {
  assert.match(mapSource, /const mapTitleId = useId\(\)/);
  assert.match(mapSource, /aria-labelledby=\{mapTitleId\}/);
  assert.match(mapSource, /role="region"/);
  assert.match(mapSource, /role="status" aria-busy="true"/);
  assert.match(mapSource, /role="alert"/);
  assert.match(mapSource, /prefers-reduced-motion: reduce/);
  assert.match(mapSource, /Resumen textual del mapa/);
  assert.match(mapSource, /El resumen textual conserva las zonas disponibles y explicita su nivel de precisi/);
});

test("commercial CRM reports partial upstream availability instead of silent empty arrays", () => {
  assert.match(leadsSource, /type AdminCollectionResult/);
  assert.match(leadsSource, /availability: "upstream_error"/);
  assert.match(leadsSource, /availability: "invalid_payload"/);
  assert.match(leadsSource, /CRM parcialmente disponible/);
  assert.match(leadsSource, /no deben interpretarse como cero actividad comercial/);
  assert.match(leadsSource, /href=\{retryHref\}/);
});
