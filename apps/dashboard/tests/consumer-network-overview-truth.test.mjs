import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  buildUtcHourlyHeatmap,
  describeProductActivity,
  formatUtcTimestamp,
  parseConsumerNetworkMembers,
  parseConsumerNetworkOverview,
  parseConsumerNetworkProducts,
  parseConsumerNetworkTaps,
  withTenantScope,
} from "../src/lib/consumer-network-overview-truth.ts";

const overviewPage = await readFile(new URL("../src/app/(app)/consumer-network/overview/page.tsx", import.meta.url), "utf8");
const loadingPage = await readFile(new URL("../src/app/(app)/consumer-network/overview/loading.tsx", import.meta.url), "utf8");
const errorPage = await readFile(new URL("../src/app/(app)/consumer-network/overview/error.tsx", import.meta.url), "utf8");

function overviewPayload(overrides = {}) {
  return {
    ok: true,
    tenant: "bodega-a",
    overview: {
      totalActivity: 0,
      totalTaps: 0,
      customerActions: 0,
      activityWithKnownActor: 0,
      activityWithoutActor: 0,
      actorLinkedActivityRate: 0,
      recognizedUnits: 0,
      knownActors: 0,
      verifiedIdentityActors: 0,
      activeTenantMembers: 0,
      consentPurpose: "marketing",
      consentedActorsByChannel: { email: 0, whatsapp: 0, phone: 0 },
      savedProducts: 0,
      riskBlockedClaims: 0,
      ...overrides,
    },
    identityBoundary: "Los identificadores de actividad y unidades no son personas.",
    topProductsByClaims: [],
  };
}

test("overview parser rejects arbitrary, incomplete, inconsistent, and cross-tenant payloads", () => {
  assert.equal(parseConsumerNetworkOverview({}, "bodega-a"), null);
  assert.equal(parseConsumerNetworkOverview({ ok: true, tenant: "bodega-a" }, "bodega-a"), null);
  assert.equal(parseConsumerNetworkOverview(overviewPayload({ totalTaps: undefined }), "bodega-a"), null);
  assert.equal(parseConsumerNetworkOverview(overviewPayload({ totalActivity: 1 }), "bodega-a"), null);
  assert.equal(parseConsumerNetworkOverview(overviewPayload({ actorLinkedActivityRate: "0" }), "bodega-a"), null);
  assert.equal(parseConsumerNetworkOverview(overviewPayload({ activeTenantMembers: 0, verifiedIdentityActors: 1 }), "bodega-a"), null);
  assert.equal(parseConsumerNetworkOverview(overviewPayload(), "otro-tenant"), null);
});

test("a fully validated zero overview is an explicit empty result, not a fallback", () => {
  const parsed = parseConsumerNetworkOverview(overviewPayload(), "bodega-a");
  assert.ok(parsed);
  assert.equal(parsed.empty, true);
  assert.equal(parsed.data.overview.totalTaps, 0);
  assert.equal(parsed.data.overview.riskBlockedClaims, 0);

  const active = overviewPayload({
    totalActivity: 4,
    totalTaps: 3,
    customerActions: 1,
    activityWithKnownActor: 2,
    activityWithoutActor: 2,
    actorLinkedActivityRate: 50,
  });
  const activeParsed = parseConsumerNetworkOverview(active, "bodega-a");
  assert.ok(activeParsed);
  assert.equal(activeParsed.empty, false);
});

test("list contracts distinguish valid emptiness from malformed rows and missing fields", () => {
  const empty = { ok: true, tenant: "bodega-a", items: [] };
  assert.equal(parseConsumerNetworkMembers(empty, "bodega-a")?.empty, true);
  assert.equal(parseConsumerNetworkProducts(empty, "bodega-a")?.empty, true);
  assert.equal(parseConsumerNetworkTaps(empty, "bodega-a")?.empty, true);

  assert.equal(parseConsumerNetworkMembers({ ok: true, tenant: "bodega-a", items: [{}] }, "bodega-a"), null);
  assert.equal(parseConsumerNetworkProducts({ ok: true, tenant: "bodega-a", items: [{ product_name: "Vino" }] }, "bodega-a"), null);
  assert.equal(parseConsumerNetworkTaps({ ok: true, tenant: "bodega-a", items: [{ created_at: "not-a-date" }] }, "bodega-a"), null);
  assert.equal(parseConsumerNetworkTaps({
    ok: true,
    tenant: "bodega-a",
    items: [{ tap_event_id: "evt-1", tenant_slug: "bodega-a", verdict: null, risk_level: null, created_at: "2026-09-03T03:45:00" }],
  }, "bodega-a"), null);
});

test("member projection never promotes a UID into a person label", () => {
  const parsed = parseConsumerNetworkMembers({
    ok: true,
    tenant: "bodega-a",
    items: [{
      consumer_id: "04A1B2C3D4",
      display_name: "UID: 04A1B2C3D4",
      email_masked: "",
      tenant_slug: "bodega-a",
      status: "active",
      points_balance: null,
      last_activity_at: null,
    }],
  }, "bodega-a");

  assert.ok(parsed);
  assert.equal(parsed.data[0].label, "Actor conocido sin alias");
  assert.doesNotMatch(JSON.stringify(parsed.data[0]), /04A1B2C3D4|consumer_id|uid/i);
});

test("product state is derived only from validated counts and never labels zero as risk", () => {
  const parsed = parseConsumerNetworkProducts({
    ok: true,
    tenant: "bodega-a",
    items: [{
      product_name: "Reserva",
      tenant_slug: "bodega-a",
      bid: "BID-1",
      claimed_count: 0,
      saved_count: 0,
      latest_activity_at: null,
    }],
  }, "bodega-a");

  assert.ok(parsed);
  assert.equal(describeProductActivity(parsed.data[0]), "Sin actividad registrada");
  assert.doesNotMatch(describeProductActivity(parsed.data[0]), /active|risk/i);
});

test("tap freshness and heatmap use explicit UTC semantics", () => {
  const parsed = parseConsumerNetworkTaps({
    ok: true,
    tenant: "bodega-a",
    items: [
      { tap_event_id: "evt-1", tenant_slug: "bodega-a", verdict: null, risk_level: null, created_at: "2026-09-03T00:15:00-03:00" },
      { tap_event_id: "evt-2", tenant_slug: "bodega-a", verdict: "VALID", risk_level: "low", created_at: "2026-09-03T03:45:00Z" },
    ],
  }, "bodega-a");

  assert.ok(parsed);
  assert.equal(parsed.latestRecordedAt, "2026-09-03T03:45:00.000Z");
  const heatmap = buildUtcHourlyHeatmap(parsed.data);
  assert.equal(heatmap[3].count, 2);
  assert.equal(formatUtcTimestamp(parsed.latestRecordedAt), "03/09/2026, 03:45:00 UTC");
});

test("retry and in-page navigation retain the validated tenant scope", () => {
  assert.equal(withTenantScope("/consumer-network/overview", "Bodega-A"), "/consumer-network/overview?tenant=bodega-a");
  assert.equal(
    withTenantScope("/consumer-network/overview?view=table#taps", "Bodega-A"),
    "/consumer-network/overview?view=table&tenant=bodega-a#taps",
  );
  assert.equal(withTenantScope("/consumer-network/overview?tenant=old", ""), "/consumer-network/overview");
});

test("page exposes loading, empty, unavailable, error, provenance and freshness without fallback statuses", () => {
  assert.match(overviewPage, /type SourceAvailability = "ready" \| "empty" \| "unavailable" \| "error"/);
  assert.match(overviewPage, /parseConsumerNetworkOverview/);
  assert.match(overviewPage, /consumer-network-overview-empty/);
  assert.match(overviewPage, /consumer-network-source-errors/);
  assert.match(overviewPage, /consumer-network-partial-sources/);
  assert.match(overviewPage, /consumer-network-provenance/);
  assert.match(overviewPage, /Zona horaria visible: UTC/);
  assert.match(overviewPage, /withTenantScope\("\/consumer-network\/overview/);
  assert.doesNotMatch(overviewPage, /Number\([^\n]+\|\|\s*0/);
  assert.doesNotMatch(overviewPage, /item\.status\s*\|\|\s*"active"/);
  assert.doesNotMatch(overviewPage, /\?\s*"active"\s*:\s*[^\n]+"risk"/);
  assert.doesNotMatch(overviewPage, /\.getHours\(\)/);

  assert.match(loadingPage, /variant="loading"/);
  assert.match(loadingPage, /consumer-network-loading/);
  assert.match(errorPage, /variant="error"/);
  assert.match(errorPage, /Reintentar conserva la URL actual y su tenant/);
});
