import assert from "node:assert/strict";
import test from "node:test";
import { buildCrmWindowActivity } from "../src/lib/crm-window-activity.ts";

function event(id, overrides = {}) {
  return {
    eventId: id,
    tenantId: "tenant-id",
    tenantSlug: "tenant-test",
    batchId: "batch-id",
    tagId: "tag-id",
    uidMasked: "same-masked-uid",
    occurredAt: "2026-09-05T12:00:00.000Z",
    occurredAtUtc: "2026-09-05T12:00:00.000Z",
    occurredAtLocal: "05/09/2026 09:00:00",
    timezone: "America/Argentina/Buenos_Aires",
    timezoneLabel: "Buenos Aires",
    timezoneOffset: "GMT-3",
    eventType: "TAP_VALID",
    result: "VALID_CLOSED",
    verdict: "valid",
    interactionClass: "authentication_verified",
    productIdentityRecognized: true,
    authenticationVerified: true,
    knownActorCount: 0,
    knownActor: false,
    commercialConsentGranted: false,
    commercialConsentChannels: [],
    riskLevel: "none",
    city: "Mendoza",
    country: "AR",
    lat: -32.89,
    lng: -68.845,
    locationSource: "browser_geolocation_approximate_consent",
    productName: "Malbec",
    source: "production",
    ...overrides,
  };
}

function assertConserved(model) {
  assert.equal(model.state, "ready");
  assert.equal(model.events.length, model.total);
  assert.equal(model.queue.length, model.total);
  assert.equal(model.zones.reduce((sum, row) => sum + row.total, 0), model.total);
  assert.equal(model.products.reduce((sum, row) => sum + row.total, 0), model.total);
  assert.equal(Object.values(model.sources).reduce((sum, count) => sum + count, 0), model.total);
  for (const zone of model.zones) {
    assert.equal(zone.events.length, zone.total);
    assert.equal(zone.gps + zone.network + zone.mixed + zone.other + zone.unlocated, zone.total);
  }
  for (const product of model.products) assert.equal(product.events.length, product.total);
}

test("pending confirmation removes stale window data without representing operational zeros", () => {
  const pending = buildCrmWindowActivity([event("stale")], { confirmed: false });
  assert.deepEqual(pending, {
    state: "pending",
    total: null,
    eligibleActivity: null,
    risk: null,
    opened: null,
    sources: null,
    events: [],
    zones: [],
    products: [],
    queue: [],
  });
  const empty = buildCrmWindowActivity([], { confirmed: true });
  assertConserved(empty);
  assert.equal(empty.total, 0);
  assert.equal(empty.eligibleActivity, 0);
});

test("all 14 visible events reconcile across zones, products, sources and the full queue", () => {
  const events = Array.from({ length: 14 }, (_, index) => event(`event-${index}`, {
    city: index < 8 ? "Mendoza" : "Córdoba",
    productName: index < 9 ? "Malbec" : "Cabernet",
    locationSource: index % 2 === 0 ? "ip_geo" : "browser_gps_approximate_consent",
  }));
  const model = buildCrmWindowActivity(events, { confirmed: true });
  assertConserved(model);
  assert.equal(model.total, 14);
  assert.deepEqual(model.zones.map(({ label, total }) => ({ label, total })), [
    { label: "Mendoza, AR", total: 8 },
    { label: "Córdoba, AR", total: 6 },
  ]);
  assert.deepEqual(model.products.map(({ label, total }) => ({ label, total })), [
    { label: "Malbec", total: 9 },
    { label: "Cabernet", total: 5 },
  ]);
  assert.deepEqual(model.sources, { gps: 7, network: 7, mixed: 0, other: 0, unlocated: 0 });
  assert.equal(model.eligibleActivity, 0);
});

test("the 50-event window is preserved without deduplicating masked UIDs or mutating input", () => {
  const events = Object.freeze(Array.from({ length: 50 }, (_, index) => Object.freeze(event(`event-${index}`))));
  const model = buildCrmWindowActivity(events, { confirmed: true });
  assertConserved(model);
  assert.equal(model.total, 50);
  assert.deepEqual(model.queue.map(({ event: row }) => row.eventId), events.map((row) => row.eventId));
  assert.equal(model.products[0].total, 50);
  assert.equal(model.zones[0].total, 50);
  assert.notEqual(model.events, events);
  assert.equal(model.events[49], events[49]);
});

test("reported cities survive absent coordinates, and coordinates never manufacture a city", () => {
  const events = [
    event("city-network", { city: "Córdoba", lat: null, lng: null, locationSource: "ip_geo" }),
    event("city-gps-incomplete", { city: "Córdoba", lat: null, lng: -64.18 }),
    event("coordinate-only", { city: null, country: null, lat: 0, lng: 0 }),
    event("no-location", { city: null, country: null, lat: null, lng: null }),
    event("country-only", { city: null, country: "UY", lat: null, lng: null, locationSource: "edge_ip_approx" }),
  ];
  const model = buildCrmWindowActivity(events, { confirmed: true });
  assertConserved(model);
  const cordoba = model.zones.find((row) => row.label === "Córdoba, AR");
  assert.equal(cordoba.total, 2);
  assert.equal(cordoba.network, 1);
  assert.equal(cordoba.other, 1);
  assert.equal(cordoba.gps, 0);
  assert.equal(model.zones.find((row) => row.key === "coordinate-only").label, "Coordenada reportada · ciudad no informada");
  assert.ok(model.zones.some((row) => row.label === "UY · ciudad no informada"));
  assert.deepEqual(model.sources, { gps: 1, network: 2, mixed: 0, other: 1, unlocated: 1 });
  assert.equal(events[2].city, null);
});

test("source coverage uses usable evidence and the canonical provenance classification", () => {
  const model = buildCrmWindowActivity([
    event("gps", { locationSource: "browser_approximate_consent" }),
    event("network", { locationSource: "ip_approx" }),
    event("mixed", { locationSource: "mixed_or_unknown_approx" }),
    event("unknown-source", { locationSource: null }),
    event("other", { locationSource: "browser_gps_reported" }),
    event("invalid-gps", { city: null, country: null, lat: 91, lng: 0 }),
    event("unlocated-network", { city: null, country: null, lat: null, lng: null, locationSource: "ip_geo" }),
  ], { confirmed: true });
  assertConserved(model);
  assert.deepEqual(model.sources, { gps: 1, network: 1, mixed: 2, other: 1, unlocated: 2 });
});

test("only known geographic placeholders are removed from reported zones and coverage", () => {
  const model = buildCrmWindowActivity([
    event("api-missing", { city: " Unknown ", country: "--", lat: null, lng: null, locationSource: "ip_geo" }),
    event("demo-missing", { city: "NO   INFORMADA", country: " -- ", lat: null, lng: null }),
    event("coordinate", { city: "Unknown", country: "--" }),
    event("city", { city: "Córdoba", country: "--", lat: null, lng: null, locationSource: "ip_geo" }),
    event("country", { city: "Unknown", country: "UY", lat: null, lng: null, locationSource: "ip_geo" }),
    event("contains-placeholder", { city: "Unknown Valley", country: "AR", productName: "Unknown" }),
  ], { confirmed: true });
  assertConserved(model);
  assert.equal(model.zones.find((row) => row.key === "unlocated").total, 2);
  assert.equal(model.zones.find((row) => row.key === "coordinate-only").total, 1);
  assert.ok(model.zones.some((row) => row.label === "Córdoba"));
  assert.ok(model.zones.some((row) => row.label === "UY · ciudad no informada"));
  assert.ok(model.zones.some((row) => row.label === "Unknown Valley, AR"));
  assert.ok(model.products.some((row) => row.label === "Unknown"));
  assert.deepEqual(model.sources, { gps: 2, network: 2, mixed: 0, other: 0, unlocated: 2 });
});

test("missing descriptive fields stay explicit and do not invent products, people or eligibility", () => {
  const model = buildCrmWindowActivity([
    { eventId: "missing-fields", verdict: "UNKNOWN" },
    event("blank-name", { productName: "   ", commercialConsentChannels: undefined }),
    event("reported-name", { productName: " Malbec  Reserva " }),
    event("same-reported-name", { productName: "malbec reserva" }),
  ], { confirmed: true });
  assertConserved(model);
  assert.equal(model.products.find((row) => row.label === "Producto no informado").total, 2);
  assert.equal(model.products.find((row) => row.label === "Malbec Reserva").total, 2);
  assert.equal(model.eligibleActivity, 0);
  assert.equal(model.risk, 0);
  assert.equal(model.opened, 0);
});

test("queue prioritizes explicit risks then opening signals, retaining every ordinary event", () => {
  const events = [
    event("ordinary"),
    event("unknown", { result: "UNKNOWN", verdict: "unknown", riskLevel: "high" }),
    event("opened", { result: "VALID_OPENED", riskLevel: "high" }),
    event("tamper", { result: "TAMPER", verdict: "valid" }),
    event("replay", { result: "REPLAY_SUSPECT", verdict: "replay_suspect" }),
    event("opened-risk", { result: "VALID_OPENED", reason: "REPLAY_SUSPECT", verdict: "replay_suspect" }),
  ];
  const model = buildCrmWindowActivity(events, { confirmed: true });
  assertConserved(model);
  assert.deepEqual(model.queue.map(({ event: row }) => row.eventId), ["tamper", "replay", "opened-risk", "opened", "ordinary", "unknown"]);
  assert.deepEqual(model.queue.map(({ signal }) => signal), ["risk", "risk", "risk", "opened", "activity", "activity"]);
  assert.equal(model.risk, 3);
  assert.equal(model.opened, 2);
  assert.equal(model.queue.find(({ event: row }) => row.eventId === "opened-risk").opened, true);
  assert.equal(model.queue.find(({ event: row }) => row.eventId === "opened").risk, false);
  assert.deepEqual(events.map((row) => row.eventId), ["ordinary", "unknown", "opened", "tamper", "replay", "opened-risk"]);
});

test("only exact opening enums count; free-form reasons and unknown prefixes do not", () => {
  const results = ["OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "VALID_MANUAL_OPENED"];
  const model = buildCrmWindowActivity([
    ...results.map((result) => event(result, { result })),
    event("from-verdict", { result: "", verdict: "OPENED" }),
    event("from-event-type", { result: "", eventType: "OPENED_PREVIOUSLY" }),
    event("freeform", { reason: "Operador dice OPENED; revisar apertura" }),
    event("unknown-enum", { result: "VALID_OPEN" }),
    event("prefix-enum", { result: "VALID_OPENED_FUTURE" }),
    event("closed", { result: "VALID_CLOSED" }),
    event("unavailable-seal", { result: "VALID_UNKNOWN_TAMPER" }),
  ], { confirmed: true });
  assertConserved(model);
  assert.equal(model.opened, 8);
  assert.equal(model.risk, 0);
  for (const id of ["freeform", "unknown-enum", "prefix-enum", "closed", "unavailable-seal"]) {
    assert.equal(model.queue.find(({ event: row }) => row.eventId === id).signal, "activity");
  }
});

test("commercial eligibility retains every existing consent and interaction requirement", () => {
  const eligible = { knownActor: true, commercialConsentGranted: true, commercialConsentChannels: ["whatsapp"] };
  const model = buildCrmWindowActivity([
    event("tap", eligible),
    event("provenance", { ...eligible, eventType: "PROVENANCE_VIEWED" }),
    event("case-normalized", { ...eligible, eventType: "tap_valid" }),
    event("missing-identity", { ...eligible, productIdentityRecognized: false }),
    event("security", { ...eligible, interactionClass: "security_signal" }),
    event("anonymous", { ...eligible, knownActor: false, knownActorCount: 42 }),
    event("no-consent", { ...eligible, commercialConsentGranted: false }),
    event("string-consent", { ...eligible, commercialConsentGranted: "true" }),
    event("no-channel", { ...eligible, commercialConsentChannels: [] }),
    event("missing-channel", { ...eligible, commercialConsentChannels: undefined }),
    event("lifecycle", { ...eligible, eventType: "CLAIMED" }),
    event("nonexact-type", { ...eligible, eventType: " TAP_VALID " }),
  ], { confirmed: true });
  assertConserved(model);
  assert.equal(model.eligibleActivity, 3);
});
