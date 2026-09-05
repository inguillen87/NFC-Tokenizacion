import assert from "node:assert/strict";
import test from "node:test";

import {
  APPROXIMATE_ACCURACY_CEILING_M,
  APPROXIMATE_ACCURACY_FLOOR_M,
  APPROXIMATE_GEOLOCATION_OPTIONS,
  classifyLocationSubmissionFailure,
  isConsentedApproximateLocationReceipt,
  normalizeApproximateBrowserPosition,
  requestApproximateBrowserLocation,
  roundApproximateCoordinate,
} from "../src/app/sun/tap-location-model.ts";

test("browser location uses fresh low-precision options and normalizes before returning", async () => {
  const requestedAtMs = Date.parse("2026-08-31T15:00:00.000Z");
  const measuredAtMs = requestedAtMs + 2_500;
  let calls = 0;
  let observedOptions;

  const result = await requestApproximateBrowserLocation({
    getCurrentPosition(success, _error, options) {
      calls += 1;
      observedOptions = options;
      success({
        coords: { latitude: -34.603722, longitude: -58.381592, accuracy: 9.4 },
        timestamp: measuredAtMs,
      });
    },
  }, requestedAtMs);

  assert.equal(calls, 1);
  assert.deepEqual(observedOptions, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
  assert.deepEqual(APPROXIMATE_GEOLOCATION_OPTIONS, observedOptions);
  assert.equal(APPROXIMATE_ACCURACY_FLOOR_M, 150);
  assert.deepEqual(result, {
    ok: true,
    location: { lat: -34.604, lng: -58.382, accuracyM: 150, measuredAt: "2026-08-31T15:00:02.500Z" },
  });
});

test("coordinate publication is rounded to three decimals and never understates coarse accuracy", () => {
  assert.equal(roundApproximateCoordinate(34.12351), 34.124);
  assert.equal(roundApproximateCoordinate(-58.381592), -58.382);
  const result = normalizeApproximateBrowserPosition({
    coords: { latitude: 34.12351, longitude: -58.381592, accuracy: 987.4 },
    timestamp: 1_001,
  }, 1_000);
  assert.deepEqual(result, {
    ok: true,
    location: { lat: 34.124, lng: -58.382, accuracyM: 987, measuredAt: "1970-01-01T00:00:01.001Z" },
  });
});

test("stale and invalid browser measurements fail closed", () => {
  const validCoords = { latitude: -34.6, longitude: -58.38, accuracy: 30 };
  assert.deepEqual(normalizeApproximateBrowserPosition({ coords: validCoords, timestamp: 9_999 }, 10_000), { ok: false, reason: "stale" });
  for (const coords of [
    { latitude: 90.001, longitude: -58.38, accuracy: 30 },
    { latitude: -34.6, longitude: -180.001, accuracy: 30 },
    { latitude: -34.6, longitude: -58.38, accuracy: -1 },
    { latitude: -34.6, longitude: -58.38, accuracy: 50_001 },
    { latitude: Number.NaN, longitude: -58.38, accuracy: 30 },
  ]) {
    assert.deepEqual(normalizeApproximateBrowserPosition({ coords, timestamp: 10_001 }, 10_000), { ok: false, reason: "invalid" });
  }
});

test("permission denial, timeout and unsupported browsers remain distinct non-throwing outcomes", async () => {
  const failurePort = (code) => ({ getCurrentPosition(_success, error) { error({ code }); } });
  assert.deepEqual(await requestApproximateBrowserLocation(failurePort(1), 1_000), { ok: false, reason: "denied" });
  assert.deepEqual(await requestApproximateBrowserLocation(failurePort(3), 1_000), { ok: false, reason: "timeout" });
  assert.deepEqual(await requestApproximateBrowserLocation(undefined, 1_000), { ok: false, reason: "unsupported" });
  assert.deepEqual(await requestApproximateBrowserLocation(failurePort(2), 1_000), { ok: false, reason: "unavailable" });
  assert.deepEqual(await requestApproximateBrowserLocation({ getCurrentPosition() { throw new Error("browser policy blocked geolocation"); } }, 1_000), { ok: false, reason: "unavailable" });
});

test("saved receipts require consented source, bounded accuracy and a measured timestamp", () => {
  const receipt = {
    source: "browser_geolocation_approximate_consent",
    precision: "approximate",
    lat: -34.6,
    lng: -58.38,
    accuracyM: APPROXIMATE_ACCURACY_FLOOR_M,
    tapReceivedAt: "2026-09-03T12:00:00.000Z",
    measuredAt: "2026-09-03T12:00:03.000Z",
    receivedAt: "2026-09-03T12:00:04.000Z",
    timing: "client_reported_after_tap",
  };

  assert.equal(isConsentedApproximateLocationReceipt(receipt), true);
  assert.equal(isConsentedApproximateLocationReceipt({ ...receipt, source: "ip_geo" }), false);
  assert.equal(isConsentedApproximateLocationReceipt({ ...receipt, accuracyM: null }), false);
  assert.equal(isConsentedApproximateLocationReceipt({ ...receipt, accuracyM: APPROXIMATE_ACCURACY_CEILING_M + 1 }), false);
  assert.equal(isConsentedApproximateLocationReceipt({ ...receipt, measuredAt: "not-a-date" }), false);
  assert.equal(isConsentedApproximateLocationReceipt({ ...receipt, timing: "tap_http_request_received" }), false);
});

test("submission failures distinguish safe retry, spent capability and uncertain delivery", () => {
  assert.equal(classifyLocationSubmissionFailure(422, "fresh_location_measurement_required"), "retryable");
  assert.equal(classifyLocationSubmissionFailure(422, "post_tap_location_timing_invalid"), "retryable");
  assert.equal(classifyLocationSubmissionFailure(429, "rate_limited"), "retryable");
  assert.equal(classifyLocationSubmissionFailure(503, "sun_context_upstream_unavailable"), "uncertain");
  assert.equal(classifyLocationSubmissionFailure(403, "fresh_tap_capability_required", "fresh_token_expired"), "fresh_tap_required");
  assert.equal(classifyLocationSubmissionFailure(409, "sun_context_evidence_already_consumed"), "fresh_tap_required");
  assert.equal(classifyLocationSubmissionFailure(503, "context_persistence_unavailable"), "uncertain");
  assert.equal(classifyLocationSubmissionFailure(200, "malformed_success_receipt"), "uncertain");
});
