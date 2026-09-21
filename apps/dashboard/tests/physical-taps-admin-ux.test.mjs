import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  canRefreshPhysicalTaps,
  latestPhysicalTapByState,
  mergePhysicalTapRealtimeProjection,
  mergePhysicalTapsRefresh,
  normalizePhysicalTapsPayload,
  physicalTapFromRealtimeProjection,
} = await import("../src/lib/physical-taps-contract.ts");

function row(overrides = {}) {
  return {
    eventId: "evt-1",
    tenantSlug: "demobodega",
    bid: "DEMO-2026-02",
    productName: "Gran Reserva Malbec",
    uidMasked: "0474****90",
    messageValid: true,
    sealState: "closed",
    reportedState: "VALID_CLOSED",
    result: "VALID_CLOSED",
    verdict: "valid",
    source: "real",
    dataMode: "physical_real",
    readCounter: 115,
    occurredAt: {
      utc: "2026-08-31T07:37:10.000Z",
      local: "31/08/2026, 04:37",
      timezone: "America/Argentina/Buenos_Aires",
      label: "Argentina",
    },
    location: {
      city: "Palmira",
      region: "Mendoza",
      country: "AR",
      lat: -33.05,
      lng: -68.55,
      source: "edge_ip_approx",
      precision: "approximate",
      accuracyM: null,
      evidence: "persisted_event",
    },
    evidence: {
      kind: "physical_nfc_tt_evidenced",
      messageAuthentication: "validated",
      ttStatusReported: true,
      ttState: "VALID_CLOSED",
      ttRaw: "4343",
      ttBindingStatus: "BOUND",
      ttBindingReason: "ttstatus_bound",
      ttStatusSource: "enc",
      ttStatusOffset: 0,
      ttStatusLength: 2,
      ttEvidenceAuthority: "nexid_tt_durable_receipt",
      physicalPackagingMeaning: "integration_dependent",
    },
    ...overrides,
  };
}

function payload() {
  return {
    ok: true,
    availability: "available",
    scope: { tenant: "demobodega", bid: "DEMO-2026-02", source: "real", range: "24h", limit: 20 },
    summary: {
      total: 2,
      closed: 1,
      opened: 1,
      other: 0,
      distinctUnits: 2,
      latestAt: "2026-08-31T07:37:40.000Z",
      comparisonAvailable: true,
      comparisonMeaning: "independent_physical_taps_not_a_product_journey",
    },
    rows: [
      row(),
      row({
        eventId: "evt-2",
        uidMasked: "0483****90",
        sealState: "opened",
        reportedState: "VALID_OPENED",
        result: "VALID_OPENED",
        readCounter: 98,
        occurredAt: { ...row().occurredAt, utc: "2026-08-31T07:37:40.000Z" },
        evidence: { ...row().evidence, ttState: "VALID_OPENED", ttRaw: "4F4F" },
      }),
    ],
  };
}

test("physical TAP contract accepts real tenant rows and keeps independent units separate", () => {
  const normalized = normalizePhysicalTapsPayload(payload());
  assert.ok(normalized);
  assert.equal(normalized.scope.source, "real");
  assert.equal(normalized.scope.range, "24h");
  assert.equal(normalized.summary.distinctUnits, 2);
  assert.equal(normalized.summary.comparisonMeaning, "independent_physical_taps_not_a_product_journey");
  assert.equal(latestPhysicalTapByState(normalized.rows, "closed")?.eventId, "evt-1");
  assert.equal(latestPhysicalTapByState(normalized.rows, "opened")?.eventId, "evt-2");
});

test("physical TAP contract preserves consented browser approximation as a separate source", () => {
  const browserPayload = payload();
  browserPayload.rows[0] = row({
    location: {
      ...row().location,
      source: "browser_geolocation_approximate_consent",
      precision: "browser_approximate_consent",
      accuracyM: 150,
    },
  });
  const normalized = normalizePhysicalTapsPayload(browserPayload);
  assert.ok(normalized);
  assert.equal(normalized.rows[0].location.precision, "browser_approximate_consent");
  assert.equal(normalized.rows[0].location.accuracyM, 150);
});

test("physical TAP contract rejects provenance drift and invented journey semantics", () => {
  assert.equal(normalizePhysicalTapsPayload({ ...payload(), scope: { ...payload().scope, source: "demo" } }), null);
  assert.equal(normalizePhysicalTapsPayload({ ...payload(), summary: { ...payload().summary, comparisonMeaning: "same_product_before_after" } }), null);
  assert.equal(normalizePhysicalTapsPayload({ ...payload(), rows: [row({ source: "demo" }), payload().rows[1]] }), null);
  assert.equal(normalizePhysicalTapsPayload({ ...payload(), rows: [row({ tenantSlug: "otro-tenant" }), payload().rows[1]] }), null);
  assert.equal(normalizePhysicalTapsPayload({ ...payload(), rows: [row(), row()] }), null);
  assert.equal(normalizePhysicalTapsPayload({ ...payload(), rows: [row(), payload().rows[1]], summary: { ...payload().summary, total: 3, other: 1 } }), null);
  assert.equal(normalizePhysicalTapsPayload({
    ...payload(),
    rows: [row({ location: { ...row().location, precision: "none" } }), payload().rows[1]],
  }), null);
});

test("physical TAP refresh recovers initial outages, preserves snapshots and stops on terminal access states", () => {
  for (const availability of ["ready", "upstream_error", "invalid_payload", "unreachable"]) {
    assert.equal(canRefreshPhysicalTaps(availability), true, `${availability} should refresh`);
  }
  for (const availability of ["forbidden", "requires_tenant_session"]) {
    assert.equal(canRefreshPhysicalTaps(availability), false, `${availability} must not refresh`);
  }

  const confirmedPayload = normalizePhysicalTapsPayload(payload());
  assert.ok(confirmedPayload);
  const outage = { availability: "unreachable", payload: null, detail: "offline", checkedAt: "2026-09-04T10:00:00.000Z" };
  const confirmed = { availability: "ready", payload: confirmedPayload, detail: "live", checkedAt: "2026-09-04T10:00:05.000Z" };
  assert.equal(mergePhysicalTapsRefresh(outage, confirmed), confirmed, "an unavailable initial state must recover to ready");
  assert.equal(mergePhysicalTapsRefresh(confirmed, outage), confirmed, "a recoverable outage must preserve the last confirmed snapshot");
  assert.equal(
    mergePhysicalTapsRefresh(confirmed, { ...outage, availability: "forbidden" }).availability,
    "forbidden",
    "revoked access must not retain tenant evidence",
  );
});

test("canonical realtime tap projections update the tenant snapshot without inventing a TT receipt", () => {
  const projection = physicalTapFromRealtimeProjection({
    eventId: "evt-live-3",
    tenantSlug: "demobodega",
    bid: "DEMO-2026-02",
    tagId: "tag-3",
    uidMasked: "0499****90",
    occurredAt: "2026-09-04T21:12:00.000Z",
    eventType: "TAP_VALID",
    result: "VALID_OPENED",
    verdict: "VALID",
    riskLevel: "LOW",
    productName: "Gran Reserva 2022",
    source: "production",
    eventSource: "real",
    dataProvenance: "operational_tap",
    authenticationVerified: true,
    lat: -34.6037,
    lng: -58.3816,
    locationSource: "browser_geolocation_approximate_consent",
    locationAccuracyM: 120,
  }, "demobodega");
  assert.ok(projection);
  assert.equal(projection.bid, "DEMO-2026-02");
  assert.equal(projection.sealState, "opened");
  assert.equal(projection.evidence.ttStatusReported, false);
  assert.equal(projection.evidence.ttEvidenceAuthority, "not_reported");
  assert.equal(projection.location.precision, "browser_approximate_consent");

  const currentPayload = normalizePhysicalTapsPayload(payload());
  assert.ok(currentPayload);
  currentPayload.rows = currentPayload.rows.map((item, index) => ({
    ...item,
    occurredAt: { ...item.occurredAt, utc: `2026-09-04T20:0${index}:00.000Z` },
  }));
  currentPayload.summary.latestAt = "2026-09-04T20:01:00.000Z";
  const merged = mergePhysicalTapRealtimeProjection({
    availability: "ready",
    payload: currentPayload,
    detail: "durable",
    checkedAt: "2026-09-04T21:11:00.000Z",
  }, projection, "2026-09-04T21:12:01.000Z", Date.parse("2026-09-04T21:12:01.000Z"));
  assert.ok(merged?.payload);
  assert.equal(merged.payload.rows[0].eventId, "evt-live-3");
  assert.equal(merged.payload.summary.total, 3);

  assert.equal(physicalTapFromRealtimeProjection({
    ...projection,
    eventId: "evt-without-bid",
    bid: "",
    source: "production",
    eventSource: "real",
    eventType: "TAP_VALID",
    occurredAt: "2026-09-04T21:13:00.000Z",
  }, "demobodega"), null, "an incomplete projection must reconcile durably instead of inventing a BID");
});

const WINDOW_NOW = "2026-09-05T18:00:00.000Z";
const WINDOW_NOW_MS = Date.parse(WINDOW_NOW);

function timedRow(eventId, utc, overrides = {}) {
  return row({ eventId, uidMasked: `TEST****${eventId}`, occurredAt: { ...row().occurredAt, utc }, ...overrides });
}

function windowResult(range = "24h", rows = []) {
  const closed = rows.filter((item) => item.sealState === "closed").length;
  const opened = rows.filter((item) => item.sealState === "opened").length;
  return {
    availability: "ready", checkedAt: WINDOW_NOW, detail: "fixture",
    payload: {
      scope: { tenant: "demobodega", bid: "DEMO-2026-02", source: "real", range, limit: 20 },
      rows,
      summary: { total: rows.length, closed, opened, other: rows.length - closed - opened, distinctUnits: new Set(rows.map((item) => item.uidMasked)).size, latestAt: rows[0]?.occurredAt.utc || null, comparisonAvailable: closed > 0 && opened > 0, comparisonMeaning: "independent_physical_taps_not_a_product_journey" },
    },
  };
}

function realtimeProjection(overrides = {}) {
  // Synthetic local evidence only; no physical scan or production row is created.
  return {
    eventId: "fixture-real",
    tenantSlug: "demobodega",
    eventType: "TAP_VALID",
    bid: "DEMO-2026-02",
    uidMasked: "TEST****01",
    occurredAt: WINDOW_NOW,
    source: "production",
    eventSource: "real",
    result: "VALID_CLOSED",
    dataProvenance: "operational_tap",
    verdict: "valid",
    authenticationVerified: true,
    ...overrides,
  };
}

test("production transport admits only explicitly real event origins into physical TAP rows", () => {
  for (const eventSource of ["imported", "production", "unknown", "demo", "", null, undefined]) {
    assert.equal(
      physicalTapFromRealtimeProjection(realtimeProjection({ eventSource }), "demobodega"),
      null,
      `${eventSource} cannot become a real TAP because its transport is production`,
    );
  }
  for (const source of ["real", "imported", "unknown", "demo", "", null, undefined]) {
    assert.equal(physicalTapFromRealtimeProjection(realtimeProjection({ source }), "demobodega"), null);
  }
  assert.equal(physicalTapFromRealtimeProjection(realtimeProjection({ tenantSlug: "other-tenant" }), "demobodega"), null);
  assert.equal(physicalTapFromRealtimeProjection(realtimeProjection(), ""), null);
  for (const event_source of ["real", "imported", "production", "unknown"]) {
    const projected = physicalTapFromRealtimeProjection(realtimeProjection({ eventSource: undefined, event_source }), "demobodega");
    assert.equal(Boolean(projected), event_source === "real", "legacy field spelling preserves the same origin rule");
  }
});

test("real origin keeps failed authentication and replay visible without certifying the carrier", () => {
  for (const [eventType, result, authenticationVerified] of [
    ["TAP_VALID", "VALID_CLOSED", true],
    ["TAP_INVALID", "INVALID", false],
    ["REPLAY_SUSPECT", "REPLAY_SUSPECT", false],
  ]) {
    const projected = physicalTapFromRealtimeProjection(realtimeProjection({ eventType, result, authenticationVerified }), "demobodega");
    assert.ok(projected, `${eventType} remains available for investigation`);
    assert.equal(projected.source, "real");
    assert.equal(projected.messageValid, authenticationVerified);
    assert.equal(projected.result, result);
    assert.equal(projected.evidence.messageAuthentication, authenticationVerified ? "validated" : "not_validated");
    assert.equal(projected.evidence.kind, "real_tap_event_carrier_unconfirmed");
    assert.equal(projected.evidence.ttStatusReported, false);
    assert.equal(projected.evidence.ttState, null);
    assert.equal(projected.evidence.ttEvidenceAuthority, "not_reported");
    const merged = mergePhysicalTapRealtimeProjection(windowResult(), projected, WINDOW_NOW, WINDOW_NOW_MS);
    assert.equal(merged.payload.summary.total, 1);
    assert.equal(merged.payload.summary.other, authenticationVerified ? 0 : 1);
  }
});

test("real source without explicit operational provenance cannot repopulate the physical reader", () => {
  for (const dataProvenance of [undefined, null, "", "declared_demo", "imported", "legacy_unclassified", "mixed", "real", "OPERATIONAL_TAP", {}, true]) {
    assert.equal(physicalTapFromRealtimeProjection(realtimeProjection({ dataProvenance }), "demobodega"), null);
  }
  assert.ok(physicalTapFromRealtimeProjection(realtimeProjection({ dataProvenance: undefined, data_provenance: "operational_tap" }), "demobodega"));
  assert.equal(physicalTapFromRealtimeProjection(realtimeProjection({ dataProvenance: "legacy_unclassified", data_provenance: "operational_tap" }), "demobodega"), null);
});

test("mixed snapshots and later deltas cannot add imported TAPs or overwrite real location evidence", () => {
  const durable = timedRow("durable", "2026-09-05T15:00:00.000Z");
  const consume = (current, candidate) => {
    const projected = physicalTapFromRealtimeProjection(candidate, "demobodega");
    return projected ? mergePhysicalTapRealtimeProjection(current, projected, WINDOW_NOW, WINDOW_NOW_MS) || current : current;
  };
  const initial = windowResult("24h", [durable]);
  const snapshotRows = [
    realtimeProjection(),
    realtimeProjection({ eventId: "fixture-imported", eventSource: "imported" }),
    realtimeProjection({ eventId: "fixture-transport-only", eventSource: "production" }),
    realtimeProjection({ eventId: "fixture-unknown", eventSource: "unknown" }),
    realtimeProjection({ eventId: "fixture-simulated-real", dataProvenance: "declared_demo" }),
    realtimeProjection({ eventId: "fixture-legacy-real", dataProvenance: "legacy_unclassified" }),
    realtimeProjection({ eventId: "fixture-old-frame", dataProvenance: undefined }),
  ];
  const snapshot = snapshotRows.reduce(consume, initial);
  assert.deepEqual(snapshot.payload.rows.map((item) => item.eventId), ["fixture-real", "durable"]);
  assert.equal(snapshot.payload.summary.total, 2);
  assert.equal(snapshot.payload.summary.closed, 2);

  for (const eventSource of ["imported", "production", "unknown"]) {
    const delta = realtimeProjection({ eventId: "durable", eventSource, lat: -32.9, lng: -68.8, locationSource: "edge_ip_approx" });
    assert.equal(consume(snapshot, delta), snapshot, "rejected origins cannot revise an existing real reading");
    assert.equal(consume(snapshot, { ...delta, eventId: `new-${eventSource}` }), snapshot, "rejected origins cannot inflate the panel");
  }
  assert.equal(snapshot.payload.rows.find((item) => item.eventId === "durable"), durable);
  for (const dataProvenance of [undefined, "legacy_unclassified", "declared_demo", "imported"]) {
    const delta = realtimeProjection({ eventId: "durable", dataProvenance, lat: -32.9, lng: -68.8, locationSource: "edge_ip_approx" });
    assert.equal(consume(snapshot, delta), snapshot, "unclassified deltas cannot replace consented location or durable TT evidence");
    assert.equal(consume(snapshot, { ...delta, eventId: "new-legacy" }), snapshot, "unclassified deltas cannot inflate counts");
  }
  assert.equal(initial.payload.summary.total, 1, "the confirmed input remains unchanged");
});

test("shared all-time snapshot and single events both respect the physical 24h window", () => {
  const snapshot = { scope: { window: "all" }, rows: [
    timedRow("old", "2026-09-03T15:00:00.000Z"),
    timedRow("today", "2026-09-05T15:00:00.000Z"),
    timedRow("today-open", "2026-09-05T16:00:00.000Z", { sealState: "opened" }),
  ] };
  const merged = snapshot.rows.reduce((current, item) => mergePhysicalTapRealtimeProjection(current, item, WINDOW_NOW, WINDOW_NOW_MS) || current, windowResult());
  assert.deepEqual(merged.payload.rows.map((item) => item.eventId), ["today-open", "today"]);
  assert.equal(merged.payload.scope.range, "24h");
  assert.equal(merged.payload.summary.total, 2);
  assert.equal(merged.payload.summary.closed, 1);
  assert.equal(merged.payload.summary.opened, 1);
  assert.equal(merged.payload.summary.distinctUnits, 2);
  assert.equal(merged.payload.summary.latestAt, "2026-09-05T16:00:00.000Z");
  const oldUpdate = { ...snapshot.rows[0], updatedAt: WINDOW_NOW };
  const afterUpdate = mergePhysicalTapRealtimeProjection(merged, oldUpdate, WINDOW_NOW, WINDOW_NOW_MS);
  assert.deepEqual(afterUpdate.payload.rows, merged.payload.rows, "a newly received update cannot change the original reading time");
});

test("physical TAP ranges use inclusive lower bounds and an injected clock", () => {
  for (const [range, days] of [["24h", 1], ["7d", 7], ["30d", 30], ["90d", 90]]) {
    const cutoff = WINDOW_NOW_MS - days * 86_400_000;
    const incoming = timedRow("boundary", new Date(cutoff).toISOString());
    const current = windowResult(range, [timedRow("expired", new Date(cutoff - 1).toISOString())]);
    const merged = mergePhysicalTapRealtimeProjection(current, incoming, WINDOW_NOW, WINDOW_NOW_MS);
    assert.deepEqual(merged.payload.rows.map((item) => item.eventId), ["boundary"], range);
    assert.equal(merged.payload.summary.total, 1);
    const future = timedRow("future", new Date(WINDOW_NOW_MS + 1).toISOString());
    assert.deepEqual(mergePhysicalTapRealtimeProjection(merged, future, WINDOW_NOW, WINDOW_NOW_MS).payload.rows, merged.payload.rows);
  }
});

test("physical TAP merge defaults to the current clock, not the frame or event timestamp", (context) => {
  context.mock.method(Date, "now", () => WINDOW_NOW_MS);
  const old = timedRow("old", "2026-09-03T15:00:00.000Z");
  const merged = mergePhysicalTapRealtimeProjection(windowResult(), old, "2026-09-03T15:00:01.000Z");
  assert.equal(merged.payload.summary.total, 0, "a delayed frame must not move the 24h window backward");
});

test("realtime dedupe preserves durable evidence and expires the original event time", () => {
  const durable = timedRow("same", "2026-09-05T15:00:00.000Z");
  const lessCompleteUpdate = { ...durable, sealState: "opened", evidence: { ...durable.evidence, ttStatusReported: false, ttEvidenceAuthority: "not_reported" } };
  const merged = mergePhysicalTapRealtimeProjection(windowResult("24h", [durable]), lessCompleteUpdate, WINDOW_NOW, WINDOW_NOW_MS);
  assert.equal(merged.payload.summary.total, 1);
  assert.deepEqual(merged.payload.rows[0], durable, "existing durable receipt wins on duplicate ID");
  assert.equal(merged.payload.summary.closed, 1);
  const original = { ...durable, occurredAt: { ...durable.occurredAt, utc: "2026-09-03T15:00:00.000Z" } };
  const expired = mergePhysicalTapRealtimeProjection(windowResult("24h", [original]), lessCompleteUpdate, WINDOW_NOW, WINDOW_NOW_MS);
  assert.equal(expired.payload.summary.total, 0, "a duplicate must not replace an old original time with today's time");
  assert.equal(expired.payload.summary.latestAt, null);
});

test("physical same-id location enrichment and removal preserve original reading, receipt and counts", () => {
  const original = timedRow("location-update", "2026-09-05T15:00:00.000Z");
  const browserLocation = {
    ...original.location, city: "Mendoza", lat: -32.9, lng: -68.8,
    source: "browser_geolocation_approximate_consent", precision: "browser_approximate_consent", accuracyM: 150,
  };
  const incoming = {
    ...original, location: browserLocation, productName: "Less complete projection", readCounter: null,
    occurredAt: { ...original.occurredAt, utc: "2026-09-05T17:00:00.000Z" },
    evidence: { ...original.evidence, ttStatusReported: false, ttEvidenceAuthority: "not_reported" },
  };
  const current = windowResult("24h", [original]);
  const enriched = mergePhysicalTapRealtimeProjection(current, incoming, WINDOW_NOW, WINDOW_NOW_MS);
  assert.equal(enriched.payload.rows.length, 1);
  assert.equal(enriched.payload.rows[0].location, browserLocation);
  assert.equal(enriched.payload.rows[0].evidence, original.evidence);
  assert.equal(enriched.payload.rows[0].occurredAt, original.occurredAt);
  assert.equal(enriched.payload.rows[0].productName, original.productName);
  assert.equal(enriched.payload.rows[0].readCounter, original.readCounter);
  assert.deepEqual(enriched.payload.summary, current.payload.summary);
  assert.deepEqual(enriched.payload.scope, current.payload.scope);
  assert.equal(original.location.source, "edge_ip_approx", "retained source row is not mutated");

  const removedLocation = { city: "", region: "", country: "", lat: null, lng: null, source: "none", precision: "none", accuracyM: null, evidence: "none" };
  const removed = mergePhysicalTapRealtimeProjection(enriched, { ...incoming, location: removedLocation }, WINDOW_NOW, WINDOW_NOW_MS);
  assert.equal(removed.payload.rows[0].location, removedLocation, "a new removal cannot keep an older consented coordinate");
  assert.equal(removed.payload.rows[0].evidence, original.evidence);
  assert.equal(removed.payload.rows[0].occurredAt, original.occurredAt);
  assert.equal(removed.payload.summary.total, 1);
  assert.equal(removed.payload.summary.distinctUnits, 1);
  assert.equal(removed.payload.scope.range, "24h");
});

test("invalid dates or undeclared physical ranges cannot broaden the recent collection", () => {
  const current = windowResult();
  const incoming = timedRow("today", "2026-09-05T15:00:00.000Z");
  for (const invalidDate of ["", "not-a-date"]) {
    assert.equal(mergePhysicalTapRealtimeProjection(current, timedRow("invalid", invalidDate), WINDOW_NOW, WINDOW_NOW_MS), null);
    assert.equal(mergePhysicalTapRealtimeProjection(current, incoming, invalidDate, WINDOW_NOW_MS), null);
  }
  assert.equal(mergePhysicalTapRealtimeProjection(current, incoming, WINDOW_NOW, NaN), null);
  for (const range of ["", "unexpected", "all", "5m", "1h"]) {
    assert.equal(mergePhysicalTapRealtimeProjection(windowResult(range), incoming, WINDOW_NOW, WINDOW_NOW_MS), null, `${range} is not a declared physical query range`);
  }
  assert.equal(mergePhysicalTapRealtimeProjection(current, { ...incoming, tenantSlug: "other" }, WINDOW_NOW, WINDOW_NOW_MS), null);
  assert.equal(mergePhysicalTapRealtimeProjection(current, { ...incoming, bid: "other" }, WINDOW_NOW, WINDOW_NOW_MS), null);
  const event = { eventId: "source-check", tenantSlug: "demobodega", eventType: "TAP_VALID", bid: "DEMO-2026-02", uidMasked: "TEST****01", occurredAt: WINDOW_NOW, source: "production", eventSource: "real", dataProvenance: "operational_tap" };
  assert.ok(physicalTapFromRealtimeProjection(event, "demobodega"));
  assert.equal(physicalTapFromRealtimeProjection({ ...event, source: "demo" }, "demobodega"), null);
  assert.equal(physicalTapFromRealtimeProjection({ ...event, eventSource: "demo" }, "demobodega"), null);
  assert.equal(physicalTapFromRealtimeProjection({ ...event, occurredAt: "not-a-date" }, "demobodega"), null);
});

test("Balmec physical TAP UX is wired into home and analytics without hardcoded event ids", async () => {
  const [component, home, crm, page, analytics, reader] = await Promise.all([
    readFile(new URL("../src/components/physical-taps-command-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(app)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(app)/analytics/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/physical-taps-read.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(home, /<PhysicalTapsCommandCenter/);
  assert.match(home, /physicalTapsResult=\{physicalTapsResult\}/);
  assert.match(home, /initialView=\{currentCrmView\}/);
  assert.match(home, /searchParams\.get\("view"\) === "physical-taps"/);
  assert.match(page, /resolveDashboardCrmView\(resolvedSearchParams\.view\)/);
  assert.match(page, /initialCrmView=\{initialCrmView\}/);
  assert.match(crm, /data-testid="crm-physical-taps-view"/);
  assert.match(crm, /aria-label="Abrir TAP físicos"/);
  assert.match(crm, /aria-label="Volver al mapa y CRM"/);
  assert.equal((crm.match(/<PhysicalTapsCommandCenter/g) || []).length, 1);
  assert.doesNotMatch(crm, /<PhysicalTapsCommandCenter\s+compact/);
  assert.match(crm, /searchParams\.set\("view", "physical-taps"\)/);
  assert.doesNotMatch(analytics, /<PhysicalTapsCommandCenter|readPhysicalTaps/);
  assert.match(analytics, /getAnalytics\(\{ context: adminContext, source, range, country, allowDemoData \}\)/);
  assert.match(reader, /sun\/physical-taps/);
  assert.match(reader, /real_data_requires_tenant_session/);
  assert.match(reader, /bid = ""/);
  assert.match(reader, /if \(normalizedBid\) params\.set\("bid", normalizedBid\)/);
  assert.doesNotMatch(home, /bid:\s*"DEMO-2026-02"/);
  assert.doesNotMatch(analytics, /bid:\s*"DEMO-2026-02"/);
  assert.match(component, /Cada tarjeta representa un evento persistido/);
  assert.match(component, /No inferimos que cerrado y abierto formen un antes\/después/);
  assert.match(component, /Sin rutas ni precisión domiciliaria/);
  assert.match(component, /browser_approximate_consent/);
  assert.match(component, /Ubicación aproximada compartida desde el navegador con consentimiento/);
  assert.match(component, /payload\.scope\.bid !== "all"/);
  assert.match(component, /Contacto bloqueado hasta consentimiento/);
  assert.doesNotMatch(component, /setInterval|Actualización cada 5 s/);
  assert.match(component, /const realtime = useDashboardRealtime\(\)/);
  assert.doesNotMatch(component, /new EventSource\(/);
  assert.match(component, /frame\.scopeKey !== realtime\.activeScopeKey/);
  assert.match(component, /isPhysicalTapStreamEvent\(frame\.data, tenantSlug\)/);
  assert.match(component, /streamSource === "production"/);
  assert.match(component, /&& eventSource === "real"/);
  assert.match(component, /event\.dataProvenance \?\? event\.data_provenance\) === "operational_tap"/);
  assert.doesNotMatch(component, /eventSource === "imported"|eventSource === "production"/);
  assert.match(component, /snapshot\.scope\?\.tenant/);
  assert.match(component, /snapshot\.scope\?\.window/);
  assert.match(component, /snapshot\.source/);
  assert.match(component, /physicalTapFromRealtimeProjection\(frame\.data, tenantSlug\)/);
  assert.match(component, /PHYSICAL_RECONCILE_MIN_INTERVAL_MS = 15_000/);
  assert.match(component, /if \(refreshInFlightRef\.current\)[\s\S]*?trailingRefreshRef\.current = true/);
  assert.match(component, /else if \(trailingRefreshRef\.current\)[\s\S]*?void runPhysicalTapsRefresh\(\)/);
  assert.match(component, /document\.addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(component, /Canal en vivo/);
  assert.match(component, /canRefreshPhysicalTaps\(liveResult\.availability\)/);
  assert.doesNotMatch(component, /result\.availability !== "ready"/);
  assert.match(component, /mergePhysicalTapsRefresh\(current, failedResult\)/);
  assert.match(component, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(component, /\/api\/admin\/sun\/physical-taps\?/);
  assert.match(component, /Último snapshot confirmado/);
  assert.doesNotMatch(component, /\b665\b|\b666\b|0474856A0B1090|0483826A0B1090/);
});

test("dashboard proxy treats physical TAPs as a sensitive read and demo never fabricates rows", async () => {
  const [policy, permission, proxy] = await Promise.all([
    readFile(new URL("../src/lib/admin-proxy-policy.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/permission-policy.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(policy, /"sun\/physical-taps"/);
  assert.match(permission, /normalizedPath === "sun\/physical-taps"/);
  assert.match(permission, /return "events\.read_sensitive"/);
  assert.match(proxy, /normalizedPath === "sun\/physical-taps"/);
  assert.doesNotMatch(proxy, /independent_physical_taps_not_a_product_journey/);
});
