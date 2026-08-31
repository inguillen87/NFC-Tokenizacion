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

test("consented approximate browser geolocation requires durable evidence and is coarsened", () => {
  assert.deepEqual(sanitizePublicLocationProjection({
    lat: -34.603,
    lng: -58.382,
    locationSource: "browser_geolocation_approximate_consent",
    geoPrecision: "browser_rounded",
    locationAccuracyM: 180,
    metadata: { sun_context: { geo: {
      source: "browser_geolocation_approximate_consent",
      consent: true,
      precision: "approximate",
      accuracyM: 180,
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

test("live, QR and snapshot public contracts use the same fail-closed boundary", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  const diagnostics = await readFile(new URL("../src/lib/sun-diagnostics.ts", import.meta.url), "utf8");
  const context = await readFile(new URL("../src/app/sun/context/route.ts", import.meta.url), "utf8");
  const [privacyMigration, contextMigration, observationMigration] = await Promise.all([
    readFile(new URL("../db/migrations/20260829120000_0097_public_location_privacy.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/migrations/20260830120000_0098_event_location_context.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/migrations/20260831190000_0099_post_tap_location_observation.sql", import.meta.url), "utf8"),
  ]);

  const timelineStart = route.indexOf("async function getTimelineSummary");
  const timelineEnd = route.indexOf("async function getSdkSensorTimelineSummary", timelineStart);
  const timeline = route.slice(timelineStart, timelineEnd);
  assert.match(timeline, /date_trunc\('day', e\.created_at\)::date::text AS at/);
  assert.match(timeline, /e\.meta->'public_checkpoint'->>'visibility'/);
  assert.match(timeline, /device: null,[\s\S]*lat: null,[\s\S]*lng: null/);
  assert.doesNotMatch(timeline, /e\.id|e\.lat|e\.lng|location_source|location_accuracy_m|geo_precision/);
  assert.doesNotMatch(route, /if \(!contract\.provenance\.timelineSummary\.length\)/);

  assert.match(diagnostics, /sanitizeSnapshotPublicCoordinates/);
  assert.match(diagnostics, /sanitizePublicLocationProjection\(\{/);
  assert.doesNotMatch(diagnostics, /coarsenPublicTimelineLocation/);

  assert.match(context, /SET post_tap_location_observation = \$\{JSON\.stringify\(browserLocationObservation\)\}::jsonb/);
  assert.match(context, /WITH bound_pair AS MATERIALIZED/);
  assert.match(context, /UPDATE events event[\s\S]*UPDATE sun_diagnostics diagnostic/);
  assert.doesNotMatch(context, /\n\s*(?:lat|lng|geo_lat|geo_lng|city|country_code|geo_city|geo_country) = /);
  assert.doesNotMatch(context, /publishRealtimeEvent/);
  assert.match(privacyMigration, /t\.typtype = 'e'/);
  assert.match(privacyMigration, /ALTER TYPE public\.geo_precision ADD VALUE IF NOT EXISTS 'approximate'/);
  assert.match(contextMigration, /ADD COLUMN IF NOT EXISTS location_accuracy_m double precision/);
  assert.match(contextMigration, /ADD COLUMN IF NOT EXISTS location_source text/);
  assert.match(contextMigration, /ADD COLUMN IF NOT EXISTS location_updated_at timestamptz/);
  assert.match(observationMigration, /ADD COLUMN IF NOT EXISTS post_tap_location_observation jsonb/);
  assert.match(observationMigration, /ADD CONSTRAINT events_post_tap_location_observation_check/);
  assert.match(observationMigration, /CHECK \([\s\S]*post_tap_location_observation IS NULL/);
  assert.match(observationMigration, /NOT VALID[\s\S]*VALIDATE CONSTRAINT events_post_tap_location_observation_check/);
  assert.match(observationMigration, /post_tap_location_observation_schema_postcondition_failed/);
  assert.doesNotMatch(`${privacyMigration}\n${contextMigration}\n${observationMigration}`, /DROP\s+(TABLE|COLUMN|TYPE)|DELETE\s+FROM|UPDATE\s+/i);
});
