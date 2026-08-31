import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  classifyPhysicalTapSealState,
  isAuthenticatedNfcMessage,
  normalizeAdminPhysicalTap,
  summarizeAdminPhysicalTaps,
} = await import("../src/lib/admin-physical-taps.ts");

const physicalEvents = [
  {
    id: 665,
    tenant_slug: "demobodega",
    bid: "DEMO-2026-02",
    uid_hex: "0474856A0B1090",
    result: "VALID_CLOSED",
    verdict: "valid",
    reason: "sun_ok",
    read_counter: 115,
    source: "real",
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
    reason: "sun_ok",
    read_counter: 98,
    source: "real",
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
  assert.equal(isAuthenticatedNfcMessage({ result: "VALID_OPENED", verdict: "valid" }), true);
  assert.equal(isAuthenticatedNfcMessage({ result: "OPENED" }), false);
  assert.equal(isAuthenticatedNfcMessage({ result: "OPENED", verdict: "valid" }), true);
  assert.equal(isAuthenticatedNfcMessage({ result: "TAMPER_RISK", verdict: "valid" }), false);
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
  assert.match(helper, /LOWER\(COALESCE\(e\.source::text, ''\)\) = 'real'/);
  assert.match(helper, /WHERE tn\.slug = \$\{tenantSlug\}/);
  assert.match(helper, /AND \(\$\{bid\} = '' OR b\.bid = \$\{bid\}\)/);
  assert.match(helper, /sun_tt_truth_receipts/);
  assert.match(helper, /maskUid/);
  assert.doesNotMatch(route, /0474856A0B1090|0483826A0B1090/);
});

test("admin analytics and event feeds separate authenticated message validity from seal condition", async () => {
  const [analytics, events] = await Promise.all([
    readFile(new URL("../src/app/admin/analytics/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/events/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(analytics, /e\.result LIKE 'VALID_%'/);
  assert.doesNotMatch(analytics, /LIKE 'VALID_%' OR e\.result IN \('OPENED'/);
  assert.match(analytics, /messageValid: isAuthenticatedNfcMessage/);
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
