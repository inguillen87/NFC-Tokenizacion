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
  },
  provenance: {
    lastVerifiedLocation: {
      at: "2026-08-26T22:00:00.000Z",
      city: "Buenos Aires",
      country: "AR",
      result: "VALID_CLOSED",
    },
    timelineSummary: [{
      eventId: "649",
      at: "2026-08-26T22:00:00.000Z",
      result: "VALID_CLOSED",
      city: "Buenos Aires",
      country: "AR",
      lat: -34.604,
      lng: -58.382,
      locationSource: "ip_geo",
      accuracyM: 25000,
    }],
  },
};

test("current consented phone GPS never inherits an older IP city or country", () => {
  const normalized = normalizeSnapshotContractFromCurrentTap(historicalContract, {
    eventId: "649",
    at: "2026-08-27T03:12:00.000Z",
    result: "VALID_CLOSED",
    city: null,
    country: null,
    lat: -32.889,
    lng: -68.845,
    source: "browser_gps_approximate_consent",
    accuracyM: 200,
  });

  assert.deepEqual(normalized.tapContext, {
    city: null,
    country: null,
    lat: -32.889,
    lng: -68.845,
    locationSource: "browser_gps_approximate_consent",
    accuracyM: 200,
    utcTime: "2026-08-27T03:12:00.000Z",
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
    lat: -32.889,
    lng: -68.845,
    locationSource: "browser_gps_approximate_consent",
    accuracyM: 200,
  });
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
    source: "browser_gps_approximate_consent",
    accuracyM: 200,
  });

  assert.equal(normalized.tapContext.city, "Godoy Cruz");
  assert.equal(normalized.tapContext.country, "AR");
  assert.equal(normalized.provenance.lastVerifiedLocation.city, "Godoy Cruz");
  assert.equal(normalized.provenance.timelineSummary[0].city, "Godoy Cruz");
});

test("missing or rejected phone GPS preserves the prior snapshot location", () => {
  const normalized = normalizeSnapshotContractFromCurrentTap(historicalContract, {
    eventId: "649",
    at: "2026-08-27T03:12:00.000Z",
    result: "VALID_CLOSED",
    city: null,
    country: null,
    lat: null,
    lng: null,
    source: null,
    accuracyM: null,
  });

  assert.equal(normalized.tapContext.city, "Buenos Aires");
  assert.equal(normalized.tapContext.country, "AR");
  assert.equal(normalized.tapContext.lat, -34.604);
  assert.equal(normalized.tapContext.lng, -58.382);
  assert.equal(normalized.provenance.timelineSummary[0].locationSource, "ip_geo");
});
