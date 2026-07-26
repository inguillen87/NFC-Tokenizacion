import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homePage = await readFile(new URL("../src/app/(app)/page.tsx", import.meta.url), "utf8");
const homeClient = await readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8");
const analyticsPage = await readFile(new URL("../src/app/(app)/analytics/page.tsx", import.meta.url), "utf8");
const analyticsPanels = await readFile(new URL("../src/components/analytics-panels.tsx", import.meta.url), "utf8");

test("home never fabricates analytics or false-zero collections on production failure", () => {
  assert.doesNotMatch(homePage, /demoAnalyticsData|emptyAnalyticsData|getAnalyticsData/);
  assert.match(homePage, /const allowDemoFallback = Boolean\(session\.isDemo\)/);
  assert.doesNotMatch(homePage, /session\.isDemo \|\| adminContext\.canSelectTenant/);
  assert.match(homePage, /source: allowDemoFallback \? "demo" : "unavailable"/);
  assert.match(homePage, /availability: allowDemoFallback \? "fallback" : availability/);
  assert.match(homePage, /meta\.demoMode && !allowDemoFallback/);
  assert.match(homePage, /payload\?\.ok === false/);
});

test("home presents unavailable and demo sources explicitly", () => {
  assert.match(homeClient, /testId="home-operations-unavailable"/);
  assert.match(homeClient, /testId="home-tokenization-unavailable"/);
  assert.match(homeClient, /testId="home-overview-unavailable"/);
  assert.match(homeClient, /testId="home-explicit-demo-source"/);
  assert.match(homeClient, /no convierte la indisponibilidad en métricas cero/);
  assert.match(homeClient, /realtimeAvailable \? successfulTaps : "no disponible"/);
  assert.match(homeClient, /tokenizationAvailable \? Number\(tokenizationByStatus\.pending \|\| 0\) : "no disponible"/);
});

test("analytics accepts demo only through an explicit policy and propagates source", () => {
  assert.match(analyticsPage, /payload\?\.ok === false/);
  assert.match(analyticsPage, /responseIsDemo && !allowDemoData/);
  assert.match(analyticsPage, /session\.isDemo \|\| \(adminContext\.canSelectTenant && source === "demo"\)/);
  assert.match(analyticsPage, /analyticsData\.source === "demo" \? "demo"/);
  assert.match(analyticsPage, /Fuente confirmada:/);
  assert.match(analyticsPage, /no representa actividad productiva en tiempo real/);
  assert.match(analyticsPage, /dataSource=\{analyticsData\.source\}/);
  assert.match(analyticsPage, /sourceDetail=\{analyticsData\.detail\}/);
});

test("analytics panels label provenance and avoid percentage claims without denominators", () => {
  assert.match(analyticsPanels, /dataSource: "production" \| "demo" \| "imported" \| "mixed"/);
  assert.match(analyticsPanels, /data-analytics-source=\{dataSource\}/);
  assert.match(analyticsPanels, /scansTotal > 0 \? pct\(riskSignals, scansTotal\) : "sin base"/);
  assert.match(analyticsPanels, /products\.length > 0 \? Math\.min/);
  assert.match(analyticsPanels, /journeyCoverage == null \? "sin base"/);
  assert.match(analyticsPanels, /No ejecuta campañas ni implica geolocalización continua/);
  assert.match(analyticsPanels, /mode=\{mapMode\}/);
  assert.doesNotMatch(analyticsPanels, /cobertura real|por tap real|contexto operativo real/);
});
