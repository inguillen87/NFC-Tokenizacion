import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const { sanitizePublicLocationProjection } = await import("../src/lib/approximate-location.ts");

test("legacy exact coordinates never leave the public projection", () => {
  assert.deepEqual(sanitizePublicLocationProjection({
    lat: -34.603722,
    lng: -58.381592,
    locationSource: "browser_gps",
    geoPrecision: "browser_exact",
  }), { lat: null, lng: null });
});

test("edge/IP approximate coordinates are limited to two decimals", () => {
  assert.deepEqual(sanitizePublicLocationProjection({
    lat: -34.603722,
    lng: -58.381592,
    locationSource: "edge_ip_approx",
    geoPrecision: "ip",
  }), { lat: -34.6, lng: -58.38 });
});

test("consented approximate browser GPS requires durable evidence and is coarsened", () => {
  assert.deepEqual(sanitizePublicLocationProjection({
    lat: -34.603,
    lng: -58.382,
    locationSource: "browser_gps_approximate_consent",
    geoPrecision: "browser_rounded",
    locationAccuracyM: 180,
    metadata: { sun_context: { geo: {
      source: "browser_gps_approximate_consent",
      consent: true,
      precision: "approximate",
      accuracy: 180,
    } } },
  }), { lat: -34.6, lng: -58.38 });
});

test("unknown, contradictory, or unconsented evidence is omitted", () => {
  assert.deepEqual(sanitizePublicLocationProjection({
    lat: -34.603,
    lng: -58.382,
    locationSource: "unknown",
    geoPrecision: "approximate",
  }), { lat: null, lng: null });
  assert.deepEqual(sanitizePublicLocationProjection({
    lat: -34.603,
    lng: -58.382,
    locationSource: "browser_gps_approximate_consent",
    geoPrecision: "approximate",
    locationAccuracyM: 200,
    metadata: { geo_evidence: { source: "browser_gps_approximate_consent", consent: false, precision: "approximate" } },
  }), { lat: null, lng: null });
});

test("live, QR, fallback and snapshot public contracts use the same fail-closed boundary", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  const diagnostics = await readFile(new URL("../src/lib/sun-diagnostics.ts", import.meta.url), "utf8");
  const context = await readFile(new URL("../src/app/sun/context/route.ts", import.meta.url), "utf8");
  const [privacyMigration, contextMigration] = await Promise.all([
    readFile(new URL("../db/migrations/20260829120000_0097_public_location_privacy.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/migrations/20260830120000_0098_event_location_context.sql", import.meta.url), "utf8"),
  ]);

  assert.match(route, /e\.location_source[\s\S]*e\.geo_precision::text[\s\S]*e\.location_accuracy_m/);
  assert.match(route, /if \(code !== "42703"\) throw error/);
  assert.match(route, /sanitizePublicLocationProjection\(\{[\s\S]*locationSource: row\.location_source/);
  assert.doesNotMatch(route, /lat: typeof row\.lat === "number"/);
  const fallbackStart = route.indexOf("if (!contract.provenance.timelineSummary.length)");
  const fallbackEnd = route.indexOf("const tenantTokenizationMode", fallbackStart);
  assert.notEqual(fallbackStart, -1);
  assert.notEqual(fallbackEnd, -1);
  assert.match(route.slice(fallbackStart, fallbackEnd), /lat: contract\.tapContext\.lat/);
  assert.doesNotMatch(route.slice(fallbackStart, fallbackEnd), /lat: geoLat|lng: geoLng/);

  assert.match(diagnostics, /sanitizeSnapshotPublicCoordinates/);
  assert.match(diagnostics, /sanitizePublicLocationProjection\(\{/);
  assert.doesNotMatch(diagnostics, /coarsenPublicTimelineLocation/);

  assert.match(context, /geo_precision = 'approximate'/);
  assert.match(context, /WITH bound_pair AS MATERIALIZED/);
  assert.match(context, /UPDATE events event[\s\S]*UPDATE sun_diagnostics diagnostic/);
  assert.doesNotMatch(context, /lat = NULL, lng = NULL, geo_lat = NULL, geo_lng = NULL/);
  assert.match(context, /publishRealtimeEvent\(\{[\s\S]*lat,[\s\S]*lng,[\s\S]*location_source: locationSource/);
  assert.match(privacyMigration, /t\.typtype = 'e'/);
  assert.match(privacyMigration, /ALTER TYPE public\.geo_precision ADD VALUE IF NOT EXISTS 'approximate'/);
  assert.match(contextMigration, /ADD COLUMN IF NOT EXISTS location_accuracy_m double precision/);
  assert.match(contextMigration, /ADD COLUMN IF NOT EXISTS location_source text/);
  assert.match(contextMigration, /ADD COLUMN IF NOT EXISTS location_updated_at timestamptz/);
  assert.doesNotMatch(`${privacyMigration}\n${contextMigration}`, /DROP\s+(TABLE|COLUMN|TYPE)|DELETE\s+FROM|UPDATE\s+/i);
});
