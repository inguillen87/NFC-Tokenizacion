import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { canReadonlyDemoAccess } from "../src/lib/admin-proxy-policy.ts";
import {
  getDashboardDemoStreamEvents,
  resetDashboardDemoEvents,
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
  assert.match(proxyRoute, /eventId: "demo-baseline-replay-001"/);
  assert.match(proxyRoute, /scope: \{ tenant: demoTenant\.slug, source: "demo" \}/);
});
