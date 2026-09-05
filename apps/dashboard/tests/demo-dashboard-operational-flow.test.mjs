import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { canReadonlyDemoAccess } from "../src/lib/admin-proxy-policy.ts";
import { demoIncidentResource } from "../src/lib/demo-incidents.ts";
import {
  filterDashboardDemoEvents,
  getDashboardDemoStreamEvents,
  resetDashboardDemoEvents,
  toDemoAdminEventRow,
  toDemoRealtimeEvent,
} from "../src/lib/demo-runtime-state.ts";

test("readonly demo exposes the safe data needed by the CRM home", () => {
  for (const path of ["tenants", "events", "events/stream", "incidents", "batches", "tokenization/requests"]) {
    assert.equal(canReadonlyDemoAccess("GET", path), true, path);
  }
  assert.equal(canReadonlyDemoAccess("POST", "incidents"), false);
  assert.equal(canReadonlyDemoAccess("DELETE", "tenants/demo-tenant-001"), false);
});

test("a fresh demo stream has labelled illustrative events and mappable coordinates", () => {
  resetDashboardDemoEvents();
  const rows = getDashboardDemoStreamEvents(50);
  assert.ok(rows.length >= 6);
  assert.ok(rows.every((row) => row.tenant_slug === "demobodega"));
  assert.ok(rows.every((row) => row.source === "dashboard-demo-baseline"));
  assert.ok(rows.every((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng)));
  assert.ok(rows.some((row) => row.result === "VALID"));
  assert.ok(rows.some((row) => row.result === "REPLAY_SUSPECT"));

  const projected = rows.map(toDemoRealtimeEvent);
  assert.ok(projected.every((row) => row.source === "demo"));
  assert.ok(projected.every((row) => row.tenantSlug === "demobodega"));
});

test("demo stream and incident response use the same replay event identity", async () => {
  const [streamRoute, proxyRoute] = await Promise.all([
    readFile(new URL("../src/app/api/admin/events/stream/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(streamRoute, /getDashboardDemoStreamEvents\(limit\)/);
  assert.match(streamRoute, /session\.isDemo[\s\S]*availability: "ready"[\s\S]*emitWarning: false/);
  assert.match(proxyRoute, /demoIncidentResource\(method, normalized, demoTenant\.slug, url\.searchParams, getDashboardDemoStreamEvents\(160\)\)/);
  const response = demoIncidentResource("GET", "incidents", "demobodega", new URLSearchParams(), getDashboardDemoStreamEvents(160));
  assert.equal(response.body.incidents[0].eventId, "demo-baseline-replay-001");
  assert.deepEqual(response.body.scope, { tenant: "demobodega", source: "demo" });
  assert.match(proxyRoute, /filterDashboardDemoEvents\(getDashboardDemoStreamEvents\(160\), url\.searchParams\)/);
  assert.match(proxyRoute, /rows: filtered\.events\.map\(toDemoAdminEventRow\)/);
});

test("demo audit rows match the real endpoint shape without claiming physical evidence", () => {
  resetDashboardDemoEvents();
  const events = getDashboardDemoStreamEvents(50);
  const rows = events.map(toDemoAdminEventRow);
  assert.deepEqual(rows.map((row) => row.id), events.map((row) => row.id));
  for (const [index, row] of rows.entries()) {
    const event = events[index];
    assert.equal(row.tenantSlug, event.tenant_slug);
    assert.equal(row.uidHex, event.uid_hex);
    assert.equal(row.createdAt, event.created_at);
    assert.equal(row.location.city, event.city);
    assert.equal(row.location.lat, event.lat);
    assert.equal(row.device.label, event.device);
    assert.equal(row.device.os, "No informado");
    assert.equal(row.source, "demo");
    assert.equal(row.isPhysicalTap, false);
    assert.equal(row.cmacOk, null);
    assert.equal(row.allowlisted, null);
  }
});

test("missing optional demo context remains explicitly unavailable", () => {
  const event = getDashboardDemoStreamEvents(1)[0];
  const row = toDemoAdminEventRow({ ...event, city: undefined, country_code: undefined, lat: undefined, lng: undefined, device: undefined });
  assert.deepEqual(row.location, { city: "No informada", country: "--", lat: null, lng: null, source: "demo", accuracyM: null });
  assert.equal(row.device.label, "Dispositivo no informado");
  assert.equal(row.device.timezone, "No informada");
  assert.equal(row.device.mobile, null);
});

const fixtureNow = Date.parse("2026-09-04T12:00:00.000Z");

// Synthetic unit fixtures only. None are written to the demo runtime or real API.
function demoFilterFixture(overrides = {}) {
  return {
    id: "demo-filter-fixture", sequence: 1, result: "VALID", reason: "sun_ok",
    uid_hex: "04ABCDEF1090", bid: "BALMEC-DEMO-2026-02", tenant_slug: "demobodega",
    city: "Ciudad ilustrativa", country_code: "AR", lat: -32.8895, lng: -68.8458,
    product_name: "Producto ilustrativo", device: "Dispositivo ilustrativo",
    vertical: "wine", mode: "valid", scenario: "valid", risk: 0, source: "demo-test-fixture",
    created_at: new Date(fixtureNow - 60_000).toISOString(),
    ...overrides,
  };
}

test("demo event filters combine canonical tenant, UID, exact BID and result with AND semantics", () => {
  const match = demoFilterFixture({ id: "match" });
  const rows = [
    match,
    demoFilterFixture({ id: "other-tenant", tenant_slug: "demoevents" }),
    demoFilterFixture({ id: "other-uid", uid_hex: "04ABCDEF1091" }),
    demoFilterFixture({ id: "other-batch", bid: "BALMEC-DEMO-2026-03" }),
    demoFilterFixture({ id: "other-result", result: "VALID_OPENED" }),
  ];
  const params = new URLSearchParams({ tenant: " DEMOBODEGA ", uid: " 04abcdef1090 ", bid: match.bid, result: " valid " });
  const filtered = filterDashboardDemoEvents(rows, params, fixtureNow);
  assert.deepEqual(filtered.events, [match]);
  assert.deepEqual(filtered.scope, {
    tenant: "demobodega", source: "demo", range: "24h", limit: 50,
    uid: "04ABCDEF1090", bid: match.bid, result: "VALID",
  });
  assert.equal(filtered.events[0], match, "preserves the exact event object and its evidence");
});

test("demo event identifier filters never treat fragments or wildcards as matches", () => {
  const row = demoFilterFixture();
  for (const query of [
    { uid: "04ABCDEF" }, { uid: "%" }, { tenant: "bodega" },
    { bid: "BALMEC" }, { bid: row.bid.toLowerCase() }, { bid: ` ${row.bid} ` },
    { result: "VAL" }, { result: "%" },
  ]) {
    assert.deepEqual(filterDashboardDemoEvents([row], new URLSearchParams(query), fixtureNow).events, [], JSON.stringify(query));
  }
});

test("every supported demo time range applies an inclusive lower bound and excludes future or invalid dates", () => {
  const durations = { "5m": 300_000, "1h": 3_600_000, "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 };
  for (const [range, duration] of Object.entries(durations)) {
    const rows = [
      demoFilterFixture({ id: "boundary", created_at: new Date(fixtureNow - duration).toISOString() }),
      demoFilterFixture({ id: "before-boundary", created_at: new Date(fixtureNow - duration - 1).toISOString() }),
      demoFilterFixture({ id: "now", created_at: new Date(fixtureNow).toISOString() }),
      demoFilterFixture({ id: "future", created_at: new Date(fixtureNow + 1).toISOString() }),
      demoFilterFixture({ id: "invalid", created_at: "not-a-date" }),
    ];
    const filtered = filterDashboardDemoEvents(rows, new URLSearchParams({ range }), fixtureNow);
    assert.equal(filtered.scope.range, range);
    assert.deepEqual(filtered.events.map((row) => row.id), ["now", "boundary"], range);
  }
});

test("demo limits are applied after exact filtering and newest-first sorting without mutating the input", () => {
  const rows = [
    demoFilterFixture({ id: "oldest", created_at: new Date(fixtureNow - 30_000).toISOString() }),
    demoFilterFixture({ id: "wrong-tenant", tenant_slug: "demoevents", created_at: new Date(fixtureNow).toISOString() }),
    demoFilterFixture({ id: "newest", created_at: new Date(fixtureNow - 1_000).toISOString() }),
    demoFilterFixture({ id: "middle", created_at: new Date(fixtureNow - 20_000).toISOString() }),
  ];
  const before = structuredClone(rows);
  rows.forEach(Object.freeze);
  Object.freeze(rows);
  const filtered = filterDashboardDemoEvents(rows, new URLSearchParams({ tenant: "demobodega", limit: "2" }), fixtureNow);
  assert.deepEqual(filtered.events.map((row) => row.id), ["newest", "middle"]);
  assert.deepEqual(rows, before);
});

test("demo range and limit fallbacks are bounded and empty filters preserve the available scope", () => {
  const rows = Array.from({ length: 220 }, (_, index) => demoFilterFixture({ id: `fixture-${index}` }));
  for (const [limit, expected] of [["oops", 50], ["-2", 1], ["0", 1], ["999", 200]]) {
    const filtered = filterDashboardDemoEvents(rows, new URLSearchParams({ range: "unsupported", limit }), fixtureNow);
    assert.equal(filtered.scope.range, "24h");
    assert.equal(filtered.scope.limit, expected);
    assert.equal(filtered.scope.tenant, "global");
    assert.equal(filtered.events.length, expected);
  }
  const canonicalRange = filterDashboardDemoEvents(rows, new URLSearchParams({ range: " 7D " }), fixtureNow);
  assert.equal(canonicalRange.scope.range, "7d");
  assert.deepEqual(filterDashboardDemoEvents(rows, new URLSearchParams({ tenant: "unavailable-demo" }), fixtureNow).events, []);
});

test("filtering the shared demo baseline keeps IDs, locations and explicit demo provenance in the audit projection", () => {
  resetDashboardDemoEvents();
  const baseline = getDashboardDemoStreamEvents(160);
  const candidate = baseline.find((row) => row.id === "demo-baseline-replay-001");
  assert.ok(candidate);
  const filtered = filterDashboardDemoEvents(baseline, new URLSearchParams({ uid: candidate.uid_hex, result: candidate.result, range: "30d" }));
  assert.deepEqual(filtered.events, [candidate]);
  const projected = filtered.events.map(toDemoAdminEventRow)[0];
  assert.equal(projected.id, candidate.id);
  assert.equal(projected.source, "demo");
  assert.equal(projected.isPhysicalTap, false);
  assert.equal(projected.location.lat, candidate.lat);
  assert.equal(projected.location.lng, candidate.lng);
  assert.deepEqual(getDashboardDemoStreamEvents(160), baseline, "a query does not create, refresh or alter activity");
});
