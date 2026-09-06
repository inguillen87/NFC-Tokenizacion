import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EXECUTIVE_REALTIME_EVENT_LIMIT,
  executiveRealtimeRequestKey,
  executiveRealtimeResponseScopeMatches,
  executiveRealtimeRowsMatchTenant,
  executiveRealtimeSnapshotScopeMatches,
  executiveRealtimeSourceMatchesRequest,
  isExecutiveRealtimeEvent,
  normalizeExecutiveRealtimeTenantDirectory,
  recentEventSamplePresentation,
  resolveExecutiveRealtimeQueryTenant,
} from "../src/lib/executive-realtime-scope.ts";

const crmSource = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const homeSource = await readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8");

test("tenant sessions remain locked while global sessions query the selected tenant", () => {
  assert.equal(resolveExecutiveRealtimeQueryTenant({
    mode: "tenant",
    tenantScope: "Tenant-Asignado",
    selectedTenant: "tenant-ajeno",
  }), "tenant-asignado");
  assert.equal(resolveExecutiveRealtimeQueryTenant({
    mode: "global",
    tenantScope: "",
    selectedTenant: "all",
  }), "");
  assert.equal(resolveExecutiveRealtimeQueryTenant({
    mode: "global",
    tenantScope: "",
    selectedTenant: " Tenant-Elegido ",
  }), "tenant-elegido");

  assert.notEqual(
    executiveRealtimeRequestKey({ tenant: "tenant-a", timeRange: "24h", source: "production" }),
    executiveRealtimeRequestKey({ tenant: "tenant-b", timeRange: "24h", source: "production" }),
  );
});

test("the tenant directory is independent from the recent-event buffer", () => {
  assert.deepEqual(normalizeExecutiveRealtimeTenantDirectory([
    { slug: "tenant-b", name: "Marca B" },
    { slug: "TENANT-A", name: "Marca A" },
    { slug: "tenant-b", name: "Nombre duplicado" },
    { slug: "", name: "Sin scope" },
  ]), [
    { slug: "tenant-a", name: "Marca A" },
    { slug: "tenant-b", name: "Marca B" },
  ]);
  assert.match(homeSource, /tenantDirectory=\{opsTenantRows\}/);
  assert.match(crmSource, /normalizeExecutiveRealtimeTenantDirectory\(tenantDirectory\)/);
  assert.doesNotMatch(crmSource, /events\.map\(\(event\).*tenantSlug/);
});

test("SSE and event-triggered incidents share the resolved tenant and invalidate stale work", () => {
  assert.match(crmSource, /const realtime = useDashboardRealtime\(\)/);
  assert.doesNotMatch(crmSource, /new EventSource\(/);
  assert.match(crmSource, /if \(queryTenant\) url\.searchParams\.set\("tenant", queryTenant\)/);
  assert.match(crmSource, /incidentRequestAbortRef\.current\?\.abort\(\)/);
  assert.match(crmSource, /\[canReadIncidents, queryTenant\]/);
  assert.match(crmSource, /realtime\.activeScope\.tenant/);
  assert.match(crmSource, /realtime\.activeScope\.window/);
  assert.equal(executiveRealtimeResponseScopeMatches("tenant-a", "tenant-a"), true);
  assert.equal(executiveRealtimeResponseScopeMatches("tenant-a", "tenant-b"), false);
  assert.equal(executiveRealtimeResponseScopeMatches("", "global"), true);
  assert.equal(executiveRealtimeResponseScopeMatches("", "tenant-a"), false);
  assert.equal(executiveRealtimeRowsMatchTenant([{ tenantSlug: "tenant-a" }], "tenant-a"), true);
  assert.equal(executiveRealtimeRowsMatchTenant([{ tenant_slug: "tenant-b" }], "tenant-a"), false);
  assert.equal(executiveRealtimeSnapshotScopeMatches("tenant-a", "5m", { tenant: "tenant-a", window: "5m" }), true);
  assert.equal(executiveRealtimeSnapshotScopeMatches("tenant-a", "5m", { tenant: "tenant-a", window: "24h" }), false);
  assert.equal(executiveRealtimeSnapshotScopeMatches("tenant-a", "5m", { tenant: "tenant-b", window: "5m" }), false);
  assert.match(crmSource, /executiveRealtimeRowsMatchTenant\(payload\.incidents, queryTenant\)/);
  assert.match(crmSource, /executiveRealtimeResponseScopeMatches\(queryTenant, payload\.scope\?\.tenant\)/);
  assert.match(crmSource, /executiveRealtimeSnapshotScopeMatches\(realtime\.activeScope\.tenant, realtime\.activeScope\.window, payload\.scope\)/);
  assert.match(crmSource, /No timer or browser polling loop is created/);
  assert.match(crmSource, /Muestra de hasta 50 eventos del recorrido demo aislado/);
  assert.match(crmSource, /setLastUpdateAt\(frame\.receivedAt\)/);
});

test("the executive realtime surface contains no browser polling fallback", () => {
  assert.doesNotMatch(crmSource, /pollPersistedEvents|pollUrl|pollingFallbackActive/);
  assert.doesNotMatch(crmSource, /setInterval\(\(\) => void refreshIncidents/);
  assert.match(crmSource, /useDashboardRealtime\(\)/);
  assert.doesNotMatch(crmSource, /new EventSource\(/);
  assert.match(crmSource, /realtime\.status === "reconnecting"/);
  assert.match(crmSource, /EventSource está reconectando sin polling/);
});

test("SSE rows require the normalized runtime shape and a source allowed by the request", () => {
  const valid = {
    eventId: "evt-1",
    tenantId: "tenant-id",
    tenantSlug: "tenant-a",
    batchId: "batch-1",
    tagId: "tag-1",
    uidMasked: "04AB••EF",
    occurredAt: "2026-09-03T21:11:00.000Z",
    occurredAtUtc: "2026-09-03T21:11:00.000Z",
    occurredAtLocal: "2026-09-03T18:11:00-03:00",
    timezone: "America/Argentina/Buenos_Aires",
    timezoneLabel: "Argentina/Buenos Aires",
    timezoneOffset: "-03:00",
    eventType: "tap",
    result: "VALID",
    verdict: "VALID",
    interactionClass: "authentication_verified",
    productIdentityRecognized: true,
    authenticationVerified: true,
    knownActorCount: 0,
    knownActor: false,
    commercialConsentGranted: false,
    commercialConsentChannels: [],
    riskLevel: "LOW",
    source: "production",
  };
  assert.equal(isExecutiveRealtimeEvent(valid), true);
  assert.equal(isExecutiveRealtimeEvent({ ...valid, commercialConsentChannels: null }), false);
  assert.equal(isExecutiveRealtimeEvent({ ...valid, occurredAt: "not-a-date" }), false);
  assert.equal(isExecutiveRealtimeEvent({ ...valid, source: "seed" }), false);
  assert.equal(executiveRealtimeSourceMatchesRequest("production", "production"), true);
  assert.equal(executiveRealtimeSourceMatchesRequest("production", "demo"), false);
  assert.equal(executiveRealtimeSourceMatchesRequest("demo", "unknown"), false);
  assert.equal(executiveRealtimeSourceMatchesRequest("demo", "production"), false);
  assert.equal(executiveRealtimeSourceMatchesRequest("all", "demo"), true);
  assert.equal(executiveRealtimeSourceMatchesRequest("all", "unknown"), false);
  assert.match(crmSource, /normalizedRows\.some\(\(row\) => !executiveRealtimeSourceMatchesRequest\(realtime\.activeScope\.source, row\.source\)\)/);
  assert.match(crmSource, /normalizedRows\.length !== rawRows\.length/);
  assert.match(crmSource, /isExecutiveRealtimeEvent\(payload\)/);
});

test("a scope transition is explicit before an empty result and capped samples are disclosed", () => {
  assert.equal(EXECUTIVE_REALTIME_EVENT_LIMIT, 50);
  assert.deepEqual(recentEventSamplePresentation(49), {
    value: "49",
    detail: "hasta 50",
    limitReached: false,
  });
  assert.deepEqual(recentEventSamplePresentation(50), {
    value: "50",
    detail: "límite 50",
    limitReached: true,
  });
  assert.match(crmSource, /title=\{requestTransitionPending \? "Sincronizando tenant…"/);
  assert.match(crmSource, /Todavía no se confirma un cero operativo/);
  assert.match(crmSource, /label="Eventos recientes visibles"/);
  assert.match(crmSource, /Indicadores calculados sobre hasta 50 eventos recientes visibles/);
  assert.match(crmSource, /La muestra alcanzó el límite; puede haber más eventos en la ventana/);
  assert.match(crmSource, /selectTenant = [\s\S]*?setIncidentSelection\(null\)/);
  assert.match(crmSource, /<CrmWindowActivityPanel[\s\S]*?events=\{visibleEvents\}[\s\S]*?confirmed=\{!valuesUnavailable && mapEvidence\.state !== "unavailable"\}/);
  assert.match(crmSource, /const valuesUnavailable = requestTransitionPending \|\| !streamConfirmed/);
  assert.match(crmSource, /if \(valuesUnavailable\) return \[\]/);
  assert.match(crmSource, /data-testid="crm-velocity-pending"/);
  assert.doesNotMatch(crmSource, /data-testid="crm-map-pending"/);
  assert.match(crmSource, /<RealtimeMapLibreMap[\s\S]*?dataState=\{mapEvidence\.state\}/);
  assert.match(crmSource, /data-testid="crm-map-data-mode"/);
  assert.match(crmSource, /selectTenant\("all"\)/);
  assert.match(crmSource, /const cutoff = freshnessNow - timeRangeMs\(timeRange\)/);
  assert.doesNotMatch(crmSource, /label="Actividad total"|Todas las interacciones persistidas/);
});
