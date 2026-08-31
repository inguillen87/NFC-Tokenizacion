import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { buildSunRequestLocationEvidence } from "../src/lib/sun-tap-location.ts";

test("SUN request location is classified as an edge/IP zone at HTTP receipt", () => {
  const location = buildSunRequestLocationEvidence({
    lat: -34.603722,
    lng: -58.381592,
    city: "Buenos Aires",
    country: "AR",
    recordedAt: "2026-08-29T12:00:00.000Z",
  });

  assert.deepEqual(location, {
    coordinate: { lat: -34.603722, lng: -58.381592 },
    source: "edge_ip_approx",
    precision: "ip",
    evidence: {
      schema_version: "sun-tap-request-location/v1",
      source: "edge_ip_approx",
      precision: "ip_approximate",
      verification: "network_edge_estimate_not_device_gps",
      timing: "tap_http_request_received",
      recorded_at: "2026-08-29T12:00:00.000Z",
      city: "Buenos Aires",
      country: "AR",
      consent: false,
    },
  });
  assert.equal(buildSunRequestLocationEvidence({ lat: 91, lng: -58 }), null);
});

test("post-tap browser location works without exposing the raw UID in the passport", async () => {
  const context = await readFile(new URL("../src/app/sun/context/route.ts", import.meta.url), "utf8");
  const optionalUidValidation = context.indexOf("(uid && !UID_RE.test(uid))");
  const counterValidation = context.indexOf("if (ctr === null");
  const rateLimit = context.indexOf("enforceCriticalRateLimit(req");
  const preflight = context.indexOf("requireSunFreshHandoff(req, body");
  const invalidGpsRejection = context.indexOf("if (!hasBrowserGps)");
  const staleGpsRejection = context.indexOf("Date.parse(locationMeasuredAt) < Date.parse(locationRequestedAt)");
  const canonicalUid = context.indexOf("const targetUid = String(target.uid_hex");
  const storageCheck = context.indexOf("storage = await resolveEventLocationStorage()");
  const schemaRejection = context.indexOf('reason: "sun_context_schema_not_ready"');
  const oneTimeConsume = context.indexOf("consumeSunFreshHandoff(req, body");

  assert.notEqual(optionalUidValidation, -1);
  assert.notEqual(counterValidation, -1);
  assert.notEqual(rateLimit, -1);
  assert.notEqual(preflight, -1);
  assert.notEqual(invalidGpsRejection, -1);
  assert.notEqual(staleGpsRejection, -1);
  assert.notEqual(canonicalUid, -1);
  assert.notEqual(storageCheck, -1);
  assert.notEqual(schemaRejection, -1);
  assert.notEqual(oneTimeConsume, -1);
  assert.ok(counterValidation < rateLimit);
  assert.ok(rateLimit < preflight);
  assert.ok(preflight < canonicalUid);
  assert.ok(invalidGpsRejection < oneTimeConsume);
  assert.ok(staleGpsRejection < oneTimeConsume);
  assert.ok(canonicalUid < oneTimeConsume);
  assert.ok(storageCheck < schemaRejection);
  assert.ok(schemaRejection < oneTimeConsume);
  assert.match(context, /tenantId: `sun-bid:\$\{bid\}`/);
  assert.match(context, /subjectId: `sun-event:\$\{eventId\}`/);
  assert.match(context, /uidHex: targetUid/);
  assert.match(context, /browser_location_confirmed_after_tap/);
  assert.match(context, /locationAccepted: false \}, 422/);
  assert.match(context, /tapReceivedAt/);
  assert.match(context, /locationMeasuredAt/);
  assert.match(context, /locationReceivedAt/);
  assert.match(context, /sanitizePublicLocationProjection/);
  assert.doesNotMatch(context, /lat = NULL, lng = NULL, geo_lat = NULL, geo_lng = NULL/);
  assert.match(context, /publishRealtimeEvent\(\{/);
  assert.match(context, /const finalCity = hasBrowserGps \? resolvedCity : firstText\(target\.city\)/);
  assert.match(context, /city = \$\{resolvedCity\}/);
  assert.doesNotMatch(context, /city = COALESCE\(\$\{resolvedCity\}, NULLIF\(city, ''\), geo_city\)/);
  assert.match(context, /const shouldResolveCity = hasBrowserGps;/);
  assert.match(context, /location_accuracy_m = \$\{accuracy\},[\s\S]*location_source = 'browser_gps_approximate_consent'/);
  assert.match(context, /location_updated_at = now\(\)/);
  assert.doesNotMatch(context, /ALTER TABLE|ensureEventLocationContextSchema|meta_only|canonicalLocationUpdated/);
  assert.doesNotMatch(context, /userAgent|platform|languages|viewport|pixelRatio/);
});

test("physical SUN route durably classifies edge location before timeline projection", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  const enrichment = route.indexOf("await persistSunRequestLocation({");
  const timeline = route.indexOf("withTimeout(getTimelineSummary", enrichment);

  assert.notEqual(enrichment, -1);
  assert.notEqual(timeline, -1);
  assert.ok(enrichment < timeline);
  assert.match(route, /lat: edgeCoordinate\.lat/);
  assert.match(route, /lng: edgeCoordinate\.lng/);
});

test("isolated post-tap E2E harness binds fresh GPS context to the real event counter", async () => {
  const harness = await readFile(new URL("../scripts/e2e-simulation-test.js", import.meta.url), "utf8");
  const contextRequest = harness.indexOf('fetch(`${API_BASE}/sun/context`');
  const ownershipFlow = harness.indexOf("Iniciando autenticación del Comprador", contextRequest);
  const requestBody = harness.slice(contextRequest, ownershipFlow);

  assert.notEqual(contextRequest, -1);
  assert.notEqual(ownershipFlow, -1);
  assert.match(harness, /SELECT id, result, sdm_read_ctr FROM events/);
  assert.match(requestBody, /fresh_token: freshToken/);
  assert.match(requestBody, /ctr: readCounter/);
  assert.match(requestBody, /locationRequestedAt/);
  assert.match(requestBody, /measuredAt: locationMeasuredAt/);
  assert.doesNotMatch(requestBody, /userAgent:|platform:|mobile:/);
});
