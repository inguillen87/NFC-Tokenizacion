import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmWindowActivityPanel } from "../src/components/crm-window-activity-panel.tsx";

const [crm, panel] = await Promise.all([
  readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/crm-window-activity-panel.tsx", import.meta.url), "utf8"),
]);

// Synthetic normalized events exercise presentation only; no API or live data.
function event(index, overrides = {}) {
  return {
    eventId: String(index), tenantId: "test-a", tenantSlug: "tenant-a",
    eventType: "TAP_VALID", verdict: "valid", result: "VALID_CLOSED",
    productIdentityRecognized: true, authenticationVerified: true,
    knownActor: false, knownActorCount: 0,
    interactionClass: "authentication_verified", riskLevel: "none",
    commercialConsentGranted: false, commercialConsentChannels: [],
    productName: "Producto de prueba", city: "Mendoza", country: "AR",
    lat: -32.9, lng: -68.8, locationSource: "ip_geo", source: "production",
    occurredAt: "2026-09-05T12:00:00Z",
    ...overrides,
  };
}

function render(overrides = {}) {
  return renderToStaticMarkup(React.createElement(CrmWindowActivityPanel, {
    events: [], confirmed: true, source: "production", sourceLabel: "Producción",
    tenantLabel: "Tenant de prueba", timeRangeLabel: "Últimas 24h",
    formatEventTime: () => "05/09/2026, 09:00",
    onSelectEvent() {}, onOpenPhysicalTaps() {},
    auditUnavailableReason: "Auditoría no habilitada: esta sesión no tiene events.read_sensitive.",
    ...overrides,
  }));
}

test("the real component renders a complete 14-event window without audiences or geographic scores", () => {
  const events = Array.from({ length: 14 }, (_, index) => event(index, index === 0 ? { result: "VALID_OPENED" } : {}));
  const html = render({ events });
  assert.match(html, /Actividad de esta ventana/);
  assert.match(html, /Tenant de prueba · Últimas 24h · Hasta 50 eventos recientes, no histórico/);
  assert.match(html, /<strong>14 eventos<\/strong>/);
  assert.match(html, /Actividad elegible, no audiencia: 0/);
  assert.match(html, /Red\/IP: 14/);
  assert.doesNotMatch(html, /GPS reportado: 0|Mixta\/sin precisar: 0|Otra fuente: 0/);
  assert.equal((html.match(/data-signal="opened"/g) || []).length, 1);
  assert.equal((html.match(/data-signal="activity"/g) || []).length, 13);
  assert.match(html, /0 con riesgo explícito · 1 con apertura reportada/);
  assert.match(html, /data-testid="activity-audit-unavailable"/);
  assert.doesNotMatch(html, /IA de cercanía|Prioridad heurística|Abrir campañas|zonas listas/);
});

test("pending scope or source removes stale counts and rows instead of presenting operational zeros", () => {
  const html = render({ events: [event(1)], confirmed: false });
  assert.match(html, /data-state="pending"/);
  assert.match(html, /Esperando confirmación de fuente, tenant y ventana/);
  assert.doesNotMatch(html, /<strong>\d+ eventos|data-signal=|Producto de prueba|Ver lecturas/);
  assert.match(html, /Tenant de prueba · Últimas 24h/);
});

test("confirmed empty scope shows an honest zero and disables reading navigation", () => {
  const html = render();
  assert.match(html, /<strong>0 eventos<\/strong>/);
  assert.match(html, /No hay eventos confirmados en el alcance y la ventana seleccionados/);
  assert.match(html, /class="nexid-crm-activity-primary"[^>]*disabled=""/);
  assert.doesNotMatch(html, /data-signal=/);
});

test("demo and missing product labels remain explicit while all 50 events stay accessible", () => {
  const events = Array.from({ length: 50 }, (_, index) => event(index, { source: "demo", productName: null }));
  const html = render({ events, source: "demo", sourceLabel: "Demo", onOpenAudit() {} });
  assert.match(html, /Demo · datos ilustrativos/);
  assert.match(html, /Producto no informado/);
  assert.match(html, /<strong>50 eventos<\/strong>/);
  assert.equal((html.match(/data-signal="activity"/g) || []).length, 50);
  assert.match(html, /Abrir auditoría/);
  assert.doesNotMatch(html, /activity-audit-unavailable/);
});

test("global aggregates keep all events but disclose tenant-bounded drawer navigation", () => {
  const html = render({ events: [event(1), event(2, { tenantSlug: "tenant-b", tenantId: "test-b" })] });
  assert.match(html, /<strong>2 eventos<\/strong>/);
  assert.match(html, /Vista global: cada detalle navega sólo su tenant/);
  assert.match(html, /Abrir lecturas del tenant de este evento: tenant-a/);
  assert.match(html, /05\/09\/2026, 09:00 · tenant-a/);
  assert.match(html, /05\/09\/2026, 09:00 · tenant-b/);
  assert.equal((html.match(/data-signal="activity"/g) || []).length, 2);
});

test("new controls use the existing scoped drawer and authorized destinations only", () => {
  assert.match(crm, /<CrmWindowActivityPanel[\s\S]*?events=\{visibleEvents\}[\s\S]*?confirmed=\{!valuesUnavailable && mapEvidence\.state !== "unavailable"\}/);
  assert.match(crm, /onSelectEvent=\{\(event, selection\) => setIncidentSelection\(snapshotIncidentEventSelection\(event, selection\)\)\}/);
  assert.match(crm, /onOpenPhysicalTaps=\{\(\) => selectActiveView\("physical-taps"\)\}/);
  assert.match(crm, /onOpenAudit=\{canReadSensitiveEvents \? \(\) => router\.push\(DASHBOARD_DESTINATIONS\.events\.href\) : undefined\}/);
  assert.match(panel, /onSelectEvent\(zone\.events\[0\], zone\.events\)/);
  assert.match(panel, /onSelectEvent\(product\.events\[0\], product\.events\)/);
  assert.match(panel, /onSelectEvent\(event, queueEvents\)/);
  assert.doesNotMatch(panel, /fetch\(|setInterval\(|new EventSource|router\.push|localStorage|\/api\//);
});

test("the rail names observed activity and obsolete recommendation-only code is gone", () => {
  assert.match(crm, /label: "Actividad", short: "DATOS", title: "Ver zonas, productos y eventos observados en esta ventana\."/);
  assert.match(crm, /getElementById\("window-activity-panel"\)/);
  assert.match(crm, />CRM y trazabilidad<\/h1>/);
  assert.doesNotMatch(crm, /COMMERCIAL_CONTEXTS|MarketOpportunity|commercialRecommendation|buildMarketOpportunities|offerReady|campaignDraft|const alerts =/);
  assert.match(panel, /<details className="nexid-crm-activity-method">[\s\S]*Apertura no equivale a riesgo/);
});

test("Activity returns to overview and focuses its mounted heading with reduced-motion support", () => {
  assert.match(crm, /const openWindowActivity = \(\) => \{\s*selectActiveView\("overview"\);\s*setActivityPanelRequested\(true\);/);
  assert.match(crm, /label: "Actividad"[^\n]*action: openWindowActivity/);
  const effect = crm.slice(crm.indexOf("    if (!activityPanelRequested) return;"), crm.indexOf("  }, [activityPanelRequested, activeView]);"));
  assert.match(effect, /setActivityPanelRequested\(false\);\s*if \(activeView !== "overview"\) return;/);
  assert.match(effect, /const panel = document\.getElementById\("window-activity-panel"\)/);
  assert.match(effect, /const heading = document\.getElementById\("window-activity-title"\)/);
  assert.match(effect, /if \(!panel \|\| !heading\) return;/);
  assert.match(effect, /scrollIntoView\(\{ behavior: window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches \? "auto" : "smooth", block: "nearest" \}\)/);
  assert.match(effect, /heading\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(effect, /setTimeout|setInterval|requestAnimationFrame/);
  assert.match(render(), /<h2 id="window-activity-title" tabindex="-1">/);
});
