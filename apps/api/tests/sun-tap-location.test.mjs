import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  buildSunRequestLocationEvidence,
  isPostTapLocationTimingValid,
  SUN_POST_TAP_LOCATION_CLOCK_SKEW_MS,
} from "../src/lib/sun-tap-location.ts";

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

test("post-tap browser timing is bound to the event and server receipt clocks", () => {
  const eventCreatedAt = "2026-08-31T12:00:00.000Z";
  const requestReceivedAtMs = Date.parse("2026-08-31T12:00:08.000Z");

  assert.equal(SUN_POST_TAP_LOCATION_CLOCK_SKEW_MS, 60_000);
  assert.equal(isPostTapLocationTimingValid({
    eventCreatedAt,
    locationRequestedAt: "2026-08-31T12:00:03.000Z",
    locationMeasuredAt: "2026-08-31T12:00:06.000Z",
    requestReceivedAtMs,
  }), true);
  assert.equal(isPostTapLocationTimingValid({
    eventCreatedAt,
    locationRequestedAt: "2026-08-31T11:58:59.999Z",
    locationMeasuredAt: "2026-08-31T12:00:06.000Z",
    requestReceivedAtMs,
  }), false, "a request older than the event skew window must be rejected");
  assert.equal(isPostTapLocationTimingValid({
    eventCreatedAt,
    locationRequestedAt: "2026-08-31T12:00:03.000Z",
    locationMeasuredAt: "2026-08-31T12:01:08.001Z",
    requestReceivedAtMs,
  }), false, "a measurement beyond the server-clock skew window must be rejected");
  assert.equal(isPostTapLocationTimingValid({
    eventCreatedAt,
    locationRequestedAt: "2026-08-31T12:00:07.000Z",
    locationMeasuredAt: "2026-08-31T12:00:06.000Z",
    requestReceivedAtMs,
  }), false, "measurement time cannot precede the browser request time");
  assert.equal(isPostTapLocationTimingValid({
    eventCreatedAt: "invalid",
    locationRequestedAt: "2026-08-31T12:00:03.000Z",
    locationMeasuredAt: "2026-08-31T12:00:06.000Z",
    requestReceivedAtMs,
  }), false, "malformed timestamps must fail closed");
});

test("post-tap browser location works without exposing the raw UID in the passport", async () => {
  const context = await readFile(new URL("../src/app/sun/context/route.ts", import.meta.url), "utf8");
  const optionalUidValidation = context.indexOf("(uid && !UID_RE.test(uid))");
  const counterValidation = context.indexOf("if (ctr === null");
  const preAuthRateLimit = context.indexOf("const preAuthLimited = await enforceCriticalRateLimit(req");
  const preflight = context.indexOf("requireSunFreshHandoff(req, body");
  const scopedRateLimit = context.indexOf("const capabilityScopedLimit = await enforceCriticalRateLimit(req");
  const invalidGpsRejection = context.indexOf("if (!hasBrowserLocation)");
  const staleGpsRejection = context.indexOf("Date.parse(locationMeasuredAt) < Date.parse(locationRequestedAt)");
  const eventBoundTimingRejection = context.indexOf("isPostTapLocationTimingValid({");
  const serverClockTimingRejection = context.indexOf("requestReceivedAtMs,", eventBoundTimingRejection);
  const canonicalUid = context.indexOf("const targetUid = String(target.uid_hex");
  const storageCheck = context.indexOf("storage = await resolveEventLocationStorage()");
  const schemaRejection = context.indexOf('reason: "sun_context_schema_not_ready"');
  const oneTimeConsume = context.indexOf("consumeSunFreshHandoff(req, body");

  assert.notEqual(optionalUidValidation, -1);
  assert.notEqual(counterValidation, -1);
  assert.notEqual(preAuthRateLimit, -1);
  assert.notEqual(preflight, -1);
  assert.notEqual(scopedRateLimit, -1);
  assert.notEqual(invalidGpsRejection, -1);
  assert.notEqual(staleGpsRejection, -1);
  assert.notEqual(eventBoundTimingRejection, -1);
  assert.notEqual(serverClockTimingRejection, -1);
  assert.notEqual(canonicalUid, -1);
  assert.notEqual(storageCheck, -1);
  assert.notEqual(schemaRejection, -1);
  assert.notEqual(oneTimeConsume, -1);
  assert.ok(counterValidation < preAuthRateLimit);
  assert.ok(preAuthRateLimit < preflight);
  assert.ok(preflight < scopedRateLimit);
  assert.ok(scopedRateLimit < canonicalUid);
  assert.ok(preflight < canonicalUid);
  assert.ok(invalidGpsRejection < oneTimeConsume);
  assert.ok(staleGpsRejection < oneTimeConsume);
  assert.ok(eventBoundTimingRejection < canonicalUid);
  assert.ok(serverClockTimingRejection < canonicalUid);
  assert.ok(canonicalUid < oneTimeConsume);
  assert.ok(storageCheck < schemaRejection);
  assert.ok(schemaRejection < oneTimeConsume);
  assert.match(context, /tenantId: "platform",[\s\S]*subjectId: "sun-context:unauthenticated"/);
  assert.match(context, /tenantId: `sun-bid:\$\{bid\}`/);
  assert.match(context, /subjectId: `sun-event:\$\{eventId\}`/);
  assert.match(context, /const requestReceivedAtMs = Date\.now\(\)/);
  assert.match(context, /eventCreatedAt: target\.created_at,[\s\S]*locationRequestedAt,[\s\S]*locationMeasuredAt,[\s\S]*requestReceivedAtMs/);
  assert.match(context, /reason: "post_tap_location_timing_invalid"/);
  assert.match(context, /uidHex: targetUid/);
  assert.match(context, /client_reported_after_tap/);
  assert.match(context, /locationAccepted: false \}, 422/);
  assert.match(context, /tapReceivedAt/);
  assert.match(context, /locationMeasuredAt/);
  assert.match(context, /locationReceivedAt/);
  assert.match(context, /sanitizePublicLocationProjection/);
  assert.doesNotMatch(context, /publishRealtimeEvent/);
  assert.match(context, /const finalCity = hasBrowserLocation \? resolvedCity : firstText\(target\.city\)/);
  assert.match(context, /const shouldResolveCity = hasBrowserLocation;/);
  assert.match(context, /const locationSource = "browser_geolocation_approximate_consent"/);
  assert.match(context, /SET post_tap_location_observation = \$\{JSON\.stringify\(browserLocationObservation\)\}::jsonb/);
  assert.match(context, /event\.post_tap_location_observation IS NULL/);
  assert.doesNotMatch(context, /\n\s*(?:lat|lng|geo_lat|geo_lng|city|country_code|geo_city|geo_country) = /);
  assert.doesNotMatch(context, /SET meta =|device_label =|geo_precision =|location_source =/);
  assert.doesNotMatch(context, /ALTER TABLE|ensureEventLocationContextSchema|meta_only|canonicalLocationUpdated/);
  const clientContextStart = context.indexOf("function safeClientContext(");
  const clientContextEnd = context.indexOf("function clientTimestamp(", clientContextStart);
  const clientContext = context.slice(clientContextStart, clientContextEnd);
  assert.notEqual(clientContextStart, -1);
  assert.notEqual(clientContextEnd, -1);
  assert.doesNotMatch(clientContext, /userAgent|platform|languages|viewport|pixelRatio/);
});

test("physical SUN route durably classifies edge location before timeline projection", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  const enrichment = route.indexOf("await persistSunRequestLocationAndPublish({");
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
