import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSnapshotContractFromCurrentTap } from "../src/lib/sun-diagnostics.ts";

const historicalContract = {
  tapContext: {
    city: "Buenos Aires",
    country: "AR",
    lat: -34.604,
    lng: -58.382,
    locationSource: "ip_geo",
    accuracyM: 25000,
    utcTime: "2026-08-26T22:00:00.000Z",
    deviceId: "historical-reader",
    uidMasked: "A1B2****EF",
    browserLocationObservation: {
      source: "browser_gps_approximate_consent",
      consent: true,
      lat: -34.604,
      lng: -58.382,
    },
  },
  provenance: {
    lastVerifiedLocation: {
      at: "2026-08-26T22:00:00.000Z",
      city: "Buenos Aires",
      country: "AR",
      result: "VALID_CLOSED",
    },
    timelineSummary: [{
      eventId: "648",
      at: "2026-08-26T22:00:00.000Z",
      result: "VALID_CLOSED",
      city: "Buenos Aires",
      country: "AR",
      lat: -34.604,
      lng: -58.382,
      locationSource: "ip_geo",
      accuracyM: 25000,
      device: "historical-reader",
      uidMasked: "A1B2****EF",
    }],
  },
};

test("current consented phone location replaces historical GPS and tap identity", () => {
  const normalized = normalizeSnapshotContractFromCurrentTap(historicalContract, {
    eventId: "649",
    at: "2026-08-27T03:12:00.000Z",
    result: "VALID_CLOSED",
    city: null,
    country: null,
    lat: -32.889,
    lng: -68.846,
    source: "browser_geolocation_approximate_consent",
    precision: "approximate",
    accuracyM: 200,
    consent: true,
  });

  assert.equal(normalized.tapContext.city, null);
  assert.equal(normalized.tapContext.country, null);
  assert.equal(normalized.tapContext.lat, -32.89);
  assert.equal(normalized.tapContext.lng, -68.85);
  assert.equal(normalized.tapContext.locationSource, "browser_geolocation_approximate_consent");
  assert.equal(normalized.tapContext.geoPrecision, "approximate");
  assert.equal(normalized.tapContext.accuracyM, 200);
  assert.equal(normalized.tapContext.utcTime, "2026-08-27T03:12:00.000Z");
  assert.equal("deviceId" in normalized.tapContext, false);
  assert.equal("uidMasked" in normalized.tapContext, false);
  assert.deepEqual(normalized.tapContext.browserLocationObservation, {
    source: "browser_geolocation_approximate_consent",
    consent: true,
    precision: "approximate",
    normalization: "rounded_2_decimals_public_min_150m",
    city: null,
    countryCode: null,
    lat: -32.89,
    lng: -68.85,
    accuracyM: 200,
    eventOccurredAt: "2026-08-27T03:12:00.000Z",
  });
  assert.deepEqual(normalized.provenance.lastVerifiedLocation, {
    at: "2026-08-27T03:12:00.000Z",
    city: null,
    country: null,
    result: "VALID_CLOSED",
  });
  assert.deepEqual(normalized.provenance.timelineSummary[0], {
    eventId: "649",
    at: "2026-08-27T03:12:00.000Z",
    result: "VALID_CLOSED",
    city: null,
    country: null,
    lat: -32.89,
    lng: -68.85,
    locationSource: "browser_geolocation_approximate_consent",
    geoPrecision: "approximate",
    accuracyM: 200,
  });
  assert.equal(normalized.provenance.timelineSummary.length, 1);
  assert.equal("device" in normalized.provenance.timelineSummary[0], false);
  assert.equal("uidMasked" in normalized.provenance.timelineSummary[0], false);
});

test("current consented phone GPS uses only current event labels when available", () => {
  const normalized = normalizeSnapshotContractFromCurrentTap(historicalContract, {
    eventId: "649",
    at: "2026-08-27T03:12:00.000Z",
    result: "VALID_CLOSED",
    city: "Godoy Cruz",
    country: "AR",
    lat: -32.929,
    lng: -68.843,
    source: "browser_geolocation_approximate_consent",
    precision: "approximate",
    accuracyM: 200,
    consent: true,
  });

  assert.equal(normalized.tapContext.city, "Godoy Cruz");
  assert.equal(normalized.tapContext.country, "AR");
  assert.equal(normalized.provenance.lastVerifiedLocation.city, "Godoy Cruz");
  assert.equal(normalized.provenance.timelineSummary[0].city, "Godoy Cruz");
});

test("missing current location clears the historical snapshot instead of reusing it", () => {
  const normalized = normalizeSnapshotContractFromCurrentTap(historicalContract, {
    eventId: "649",
    at: "2026-08-27T03:12:00.000Z",
    result: "VALID_CLOSED",
    city: null,
    country: null,
    lat: null,
    lng: null,
    source: null,
    precision: null,
    accuracyM: null,
    consent: null,
  });

  assert.equal(normalized.tapContext.city, null);
  assert.equal(normalized.tapContext.country, null);
  assert.equal(normalized.tapContext.lat, null);
  assert.equal(normalized.tapContext.lng, null);
  assert.equal(normalized.tapContext.locationSource, "none");
  assert.equal(normalized.tapContext.browserLocationObservation, null);
  assert.equal(normalized.provenance.timelineSummary.length, 1);
  assert.equal(normalized.provenance.timelineSummary[0].eventId, "649");
  assert.equal(normalized.provenance.timelineSummary[0].lat, null);
  assert.equal(normalized.provenance.timelineSummary[0].locationSource, "none");
  assert.equal("device" in normalized.provenance.timelineSummary[0], false);
});

test("rejected browser evidence cannot leak its coordinates or labels", () => {
  const normalized = normalizeSnapshotContractFromCurrentTap(historicalContract, {
    eventId: "649",
    at: "2026-08-27T03:12:00.000Z",
    result: "VALID_CLOSED",
    city: "Godoy Cruz",
    country: "AR",
    lat: -32.929,
    lng: -68.843,
    source: "browser_geolocation_approximate_consent",
    precision: "approximate",
    accuracyM: 200,
    consent: false,
  });

  assert.equal(normalized.tapContext.city, null);
  assert.equal(normalized.tapContext.country, null);
  assert.equal(normalized.tapContext.lat, null);
  assert.equal(normalized.tapContext.lng, null);
  assert.equal(normalized.tapContext.accuracyM, null);
  assert.equal(normalized.provenance.timelineSummary[0].lat, null);
});

test("an unresolved current tap removes all historical location and timeline identity", () => {
  const normalized = normalizeSnapshotContractFromCurrentTap(historicalContract, null);

  assert.equal(normalized.tapContext.lat, null);
  assert.equal(normalized.tapContext.lng, null);
  assert.equal(normalized.tapContext.city, null);
  assert.equal(normalized.tapContext.locationSource, "none");
  assert.equal("deviceId" in normalized.tapContext, false);
  assert.deepEqual(normalized.provenance.timelineSummary, []);
  assert.deepEqual(normalized.provenance.lastVerifiedLocation, {
    at: null,
    city: null,
    country: null,
    result: null,
  });
});
