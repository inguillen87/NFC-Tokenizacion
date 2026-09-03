import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  latestPhysicalTapByState,
  normalizePhysicalTapsPayload,
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

test("Balmec physical TAP UX is wired into home and analytics without hardcoded event ids", async () => {
  const [component, home, analytics, reader] = await Promise.all([
    readFile(new URL("../src/components/physical-taps-command-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(app)/analytics/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/physical-taps-read.ts", import.meta.url), "utf8"),
  ]);
  assert.match(home, /PhysicalTapsCommandCenter compact/);
  assert.match(home, /tenantSlug=\{tenantScope\}/);
  assert.match(analytics, /<PhysicalTapsCommandCenter\s+result=/);
  assert.match(analytics, /tenantSlug=\{tenantScope\}/);
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
  assert.match(component, /setInterval\([\s\S]*?5_000/);
  assert.match(component, /\/api\/admin\/sun\/physical-taps\?/);
  assert.match(component, /Último snapshot confirmado/);
  assert.match(component, /refresh failure must never become a false zero/);
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
