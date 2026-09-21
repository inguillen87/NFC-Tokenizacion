import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  classifyPhysicalTapSealState,
  isAuthenticatedNfcMessage,
  normalizeAdminPhysicalTap,
  summarizeAdminPhysicalTaps,
  listAdminPhysicalTaps,
} = await import("../src/lib/admin-physical-taps.ts");

const physicalEvents = [
  {
    id: 665,
    tenant_slug: "demobodega",
    bid: "DEMO-2026-02",
    uid_hex: "0474856A0B1090",
    result: "VALID_CLOSED",
    verdict: "valid",
    event_type: "TAP_VALID",
    cmac_ok: true,
    allowlisted: true,
    reason: "sun_ok",
    read_counter: 115,
    source: "real",
    meta: { replay_execution_class: "operational" },
    has_exact_tenant_asset_binding: true,
    created_at: "2026-08-31T07:37:10.000Z",
    city: "Palmira",
    country_code: "AR",
    lat: -33.05,
    lng: -68.55,
    location_source: "edge_ip_approx",
    geo_precision: "ip",
    tt_raw: "4343",
    tt_canonical_product_state: "VALID_CLOSED",
    tt_binding_status: "BOUND",
    tt_binding_reason: "ttstatus_bound",
    tt_status_source: "enc",
    tt_status_offset: 0,
    tt_status_length: 2,
  },
  {
    id: 666,
    tenant_slug: "demobodega",
    bid: "DEMO-2026-02",
    uid_hex: "0483826A0B1090",
    result: "VALID_OPENED",
    verdict: "valid",
    event_type: "TAP_VALID",
    cmac_ok: true,
    allowlisted: true,
    reason: "sun_ok",
    read_counter: 98,
    source: "real",
    meta: { replay_execution_class: "operational" },
    has_exact_tenant_asset_binding: true,
    created_at: "2026-08-31T07:37:40.000Z",
    geo_city: "Palmira",
    geo_country: "AR",
    geo_lat: -33.05,
    geo_lng: -68.55,
    location_source: "edge_ip_approx",
    geo_precision: "ip",
    tt_raw: "4F4F",
    tt_canonical_product_state: "VALID_OPENED",
    tt_binding_status: "BOUND",
    tt_binding_reason: "ttstatus_bound",
    tt_status_source: "enc",
    tt_status_offset: 0,
    tt_status_length: 2,
  },
];

test("real physical events 665 and 666 keep message validity separate from seal state", () => {
  const [closed, opened] = physicalEvents.map(normalizeAdminPhysicalTap);
  assert.equal(closed.eventId, "665");
  assert.equal(closed.messageValid, true);
  assert.equal(closed.sealState, "closed");
  assert.equal(closed.reportedState, "VALID_CLOSED");
  assert.equal(closed.source, "real");
  assert.equal(closed.dataMode, "physical_real");
  assert.equal(closed.uidMasked, "0474****90");
  assert.equal(closed.evidence.kind, "physical_nfc_tt_evidenced");
  assert.equal(closed.evidence.ttEvidenceAuthority, "nexid_tt_durable_receipt");

  assert.equal(opened.eventId, "666");
  assert.equal(opened.messageValid, true);
  assert.equal(opened.sealState, "opened");
  assert.equal(opened.reportedState, "VALID_OPENED");
  assert.equal(opened.location.source, "edge_ip_approx");
  assert.equal(opened.location.precision, "approximate");
  assert.equal(opened.location.accuracyM, null);
});

test("admin physical taps preserve accuracy for canonical and legacy consented browser sources", () => {
  for (const [locationSource, accuracyM] of [
    ["browser_geolocation_approximate_consent", 180],
    ["browser_gps_approximate_consent", "225"],
  ]) {
    const tap = normalizeAdminPhysicalTap({
      ...physicalEvents[0],
      location_source: locationSource,
      location_accuracy_m: accuracyM,
    });

    assert.equal(tap.location.source, locationSource);
    assert.equal(tap.location.precision, "browser_approximate_consent");
    assert.equal(tap.location.accuracyM, Number(accuracyM));
    assert.equal(tap.location.evidence, "persisted_event");
  }
});

test("admin physical taps project the separate consented post-tap observation without mutating tap evidence", () => {
  const tap = normalizeAdminPhysicalTap({
    ...physicalEvents[0],
    location_source: "edge_ip_approx",
    location_accuracy_m: null,
    post_tap_location_observation: {
      source: "browser_geolocation_approximate_consent",
      consent: true,
      precision: "approximate",
      city: "Mendoza",
      countryCode: "AR",
      lat: -32.89,
      lng: -68.84,
      accuracyM: 180,
    },
  });

  assert.deepEqual(tap.location, {
    city: "Mendoza",
    region: null,
    country: "AR",
    lat: -32.89,
    lng: -68.84,
    source: "browser_geolocation_approximate_consent",
    precision: "browser_approximate_consent",
    accuracyM: 180,
    evidence: "persisted_event",
  });
  assert.equal(tap.source, "real");
  assert.equal(tap.eventId, "665");
});

test("admin physical taps reject an invalid post-tap observation and retain the canonical tap location", () => {
  const tap = normalizeAdminPhysicalTap({
    ...physicalEvents[0],
    post_tap_location_observation: {
      source: "browser_geolocation_approximate_consent",
      consent: false,
      precision: "approximate",
      lat: -32.89,
      lng: -68.84,
      accuracyM: 180,
    },
  });

  assert.equal(tap.location.source, "edge_ip_approx");
  assert.equal(tap.location.lat, -33.05);
  assert.equal(tap.location.lng, -68.55);
  assert.equal(tap.location.accuracyM, null);
});

test("admin physical taps do not attach browser accuracy to non-browser location evidence", () => {
  const tap = normalizeAdminPhysicalTap({
    ...physicalEvents[0],
    location_source: "edge_ip_approx",
    location_accuracy_m: 180,
  });

  assert.equal(tap.location.source, "edge_ip_approx");
  assert.equal(tap.location.precision, "approximate");
  assert.equal(tap.location.accuracyM, null);
});

test("closed/opened summary compares independent units without inventing a journey", () => {
  const summary = summarizeAdminPhysicalTaps(physicalEvents);
  assert.deepEqual(summary, {
    total: 2,
    closed: 1,
    opened: 1,
    other: 0,
    distinctUnits: 2,
    latestAt: "2026-08-31T07:37:40.000Z",
    comparisonAvailable: true,
    comparisonMeaning: "independent_physical_taps_not_a_product_journey",
  });
});

test("classification never turns an authenticated opened seal into a security failure", () => {
  assert.equal(classifyPhysicalTapSealState("VALID_CLOSED"), "closed");
  assert.equal(classifyPhysicalTapSealState("VALID_OPENED"), "opened");
  assert.equal(classifyPhysicalTapSealState("VALID_OPENED_PREVIOUSLY"), "opened");
  assert.equal(classifyPhysicalTapSealState("REPLAY_SUSPECT"), "other");
  assert.equal(isAuthenticatedNfcMessage({ eventType: "TAP_VALID", result: "VALID_OPENED", verdict: "valid", cmacOk: true, allowlisted: true }), true);
  assert.equal(isAuthenticatedNfcMessage({ result: "OPENED" }), false);
  assert.equal(isAuthenticatedNfcMessage({ eventType: "TAP_VALID", result: "OPENED", verdict: "valid", cmacOk: true, allowlisted: true }), true);
  assert.equal(isAuthenticatedNfcMessage({ result: "TAMPER_RISK", verdict: "valid" }), false);
  assert.equal(isAuthenticatedNfcMessage({ eventType: "TAP_VALID", result: "VALID", verdict: "valid", cmacOk: false, allowlisted: true }), false);
  assert.equal(isAuthenticatedNfcMessage({ eventType: "TAP_VALID", result: "VALID", verdict: "valid", cmacOk: null, allowlisted: null }), false);
});

test("real TAP rows without a durable TT receipt do not certify the physical carrier", () => {
  const unbound = normalizeAdminPhysicalTap({
    ...physicalEvents[0],
    id: 667,
    tt_raw: null,
    tt_canonical_product_state: null,
    tt_binding_status: null,
  });
  assert.equal(unbound.dataMode, "physical_real");
  assert.equal(unbound.evidence.kind, "real_tap_event_carrier_unconfirmed");
  assert.equal(unbound.evidence.ttStatusReported, false);
  assert.equal(unbound.evidence.ttEvidenceAuthority, "not_reported");
});

test("physical tap route is dual-permission, tenant-bound, real-only and backed by TT receipts", async () => {
  const [route, helper] = await Promise.all([
    readFile(new URL("../src/app/admin/sun/physical-taps/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/admin-physical-taps.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /checkAdminWithPermission\(req, "analytics:read"\)/);
  assert.match(route, /checkAdminPermission\(req, "events\.read_sensitive"\)/);
  assert.match(route, /getAdminTenantAccess\(req, requestedTenant\)/);
  assert.match(route, /physical_taps_tenant_required/);
  assert.match(helper, /withConsumerNetworkEventProvenance/);
  assert.match(helper, /WHERE data_provenance = 'operational_tap'/);
  assert.match(helper, /WHERE tn\.slug = \$\{tenantSlug\}/);
  assert.match(helper, /b\.id = e\.batch_id\s+AND b\.tenant_id = e\.tenant_id/);
  assert.match(helper, /JOIN tenants tn ON tn\.id = e\.tenant_id/);
  assert.match(helper, /event_tag\.id::text = e\.tag_id\s+AND event_tag\.batch_id = e\.batch_id\s+AND UPPER\(event_tag\.uid_hex\) = UPPER\(e\.uid_hex\)/);
  assert.match(helper, /LEFT JOIN tag_profiles tp ON tp\.tag_id = event_tag\.id/);
  assert.doesNotMatch(helper, /JOIN batches b ON b\.id = e\.batch_id\s+JOIN tenants tn ON tn\.id = b\.tenant_id/);
  assert.match(helper, /AND \(\$\{bid\} = '' OR b\.bid = \$\{bid\}\)/);
  assert.match(helper, /sun_tt_truth_receipts/);
  assert.match(helper, /tt\.tenant_id = e\.tenant_id/);
  assert.match(helper, /tt\.batch_id = e\.batch_id/);
  assert.match(helper, /e\.event_type,[\s\S]*e\.cmac_ok,[\s\S]*e\.allowlisted/);
  assert.match(helper, /to_jsonb\(e\)->'post_tap_location_observation' AS post_tap_location_observation/);
  assert.match(helper, /maskUid/);
  assert.doesNotMatch(route, /0474856A0B1090|0483826A0B1090/);
});

test("a real source alone never promotes imported, simulated or legacy evidence into physical counts", () => {
  const uncertain = [
    { ...physicalEvents[0], id: 700, meta: {} },
    { ...physicalEvents[0], id: 701, meta: { replay_execution_class: "operational", simulated: true } },
    { ...physicalEvents[0], id: 702, source: "imported" },
    { ...physicalEvents[0], id: 703, has_exact_tenant_asset_binding: false },
  ];
  for (const event of uncertain) {
    const row = normalizeAdminPhysicalTap(event);
    assert.equal(row.dataMode, "provenance_unconfirmed");
    assert.equal(row.evidence.kind, "provenance_unconfirmed");
    assert.equal(row.evidence.ttEvidenceAuthority, "not_reported");
  }
  assert.deepEqual(summarizeAdminPhysicalTaps([...physicalEvents, ...uncertain]), summarizeAdminPhysicalTaps(physicalEvents));
});

test("operational invalid and replay events count without becoming authenticated or TT-certified", () => {
  const rows = ["TAP_INVALID", "REPLAY_SUSPECT"].map((event_type, index) => ({
    ...physicalEvents[0], id: 710 + index, event_type, result: event_type,
    cmac_ok: false, allowlisted: false, verdict: "invalid", tt_binding_status: null,
  }));
  for (const event of rows) {
    const row = normalizeAdminPhysicalTap(event);
    assert.equal(row.dataProvenance, "operational_tap");
    assert.equal(row.dataMode, "physical_real");
    assert.equal(row.messageValid, false);
    assert.equal(row.evidence.kind, "real_tap_event_carrier_unconfirmed");
  }
  assert.equal(summarizeAdminPhysicalTaps(rows).total, 2);
  assert.equal(summarizeAdminPhysicalTaps(rows).other, 2);
});

test("physical read labels its bounded count and keeps request values as SQL parameters", async () => {
  let statement, parameters;
  const tenant = "tenant' OR true --";
  const result = await listAdminPhysicalTaps({ tenantSlug: tenant, limit: 1 }, async (strings, ...values) => {
    statement = strings.join("?"); parameters = values;
    return physicalEvents;
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.summary.total, 1);
  assert.equal(result.provenance.countScope, "returned_rows_within_requested_range_and_limit");
  assert.equal(result.provenance.returnedRows, 1);
  assert.equal(result.provenance.hasMore, true);
  assert.equal(result.provenance.invalidAndReplayIncluded, true);
  assert.equal(result.provenance.physicalPresenceClaim, "not_asserted");
  assert.ok(parameters.includes(tenant.toLowerCase()));
  assert.equal(parameters.at(-1), 2);
  assert.ok(!statement.includes(tenant.toLowerCase()));
  assert.ok(statement.indexOf("WHERE data_provenance = 'operational_tap'") < statement.indexOf("LIMIT ?"));
  assert.ok(!JSON.stringify(result).includes("replay_execution_class"));
});

test("a inconsistent executor result fails closed instead of returning a false empty or promoted row", async () => {
  await assert.rejects(
    listAdminPhysicalTaps({ tenantSlug: "fixture" }, async () => [{ ...physicalEvents[0], meta: {} }]),
    /physical_taps_provenance_inconsistent/,
  );
});

test("admin analytics and event feeds separate authenticated message validity from seal condition", async () => {
  const [analytics, events] = await Promise.all([
    readFile(new URL("../src/app/admin/analytics/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/events/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(analytics, /e\.result LIKE 'VALID_%'/);
  assert.doesNotMatch(analytics, /LIKE 'VALID_%' OR e\.result IN \('OPENED'/);
  assert.match(analytics, /messageValid: isAuthenticatedNfcMessage/);
  assert.match(analytics, /eventType: row\.event_type,[\s\S]*cmacOk: row\.cmac_ok,[\s\S]*allowlisted: row\.allowlisted/);
  assert.match(events, /eventType: row\.event_type,[\s\S]*cmacOk: row\.cmac_ok,[\s\S]*allowlisted: row\.allowlisted/);
  assert.match(analytics, /sealState: classifyPhysicalTapSealState/);
  assert.match(analytics, /recentPhysicalTaps/);
  assert.match(analytics, /closedTaps: closed/);
  assert.match(analytics, /openedTaps: opened/);
  assert.match(events, /isPhysicalTap \? "physical_real"/);
  assert.match(events, /rowSource === "real" \? "production_real"/);
  assert.match(events, /messageValid/);
  assert.match(events, /sealState/);
});

test("admin OpenAPI publishes the bounded masked physical TAP contract", async () => {
  const spec = JSON.parse(await readFile(new URL("../public/openapi/nexid-admin-v1.json", import.meta.url), "utf8"));
  const operation = spec.paths["/admin/sun/physical-taps"].get;
  assert.deepEqual(operation["x-nexid-permissions"], ["analytics:read", "events.read_sensitive"]);
  const row = spec.components.schemas.PhysicalTapEvent;
  assert.equal(row.properties.source.const, "real");
  assert.equal(row.properties.dataMode.const, "physical_real");
  assert.match(row.properties.uidMasked.description, /raw UID is not returned/);
  assert.deepEqual(row.properties.evidence.properties.kind.enum, ["physical_nfc_tt_evidenced", "real_tap_event_carrier_unconfirmed"]);
});
