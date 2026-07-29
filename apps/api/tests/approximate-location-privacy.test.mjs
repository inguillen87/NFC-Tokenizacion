import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  APPROXIMATE_LOCATION_MIN_ACCURACY_M,
  normalizeCoordinatePair,
  normalizeConsentedApproximateLocation,
  redactSensitiveQueryValues,
} from "../src/lib/approximate-location.ts";

test("location is rejected without explicit consent", () => {
  const result = normalizeConsentedApproximateLocation({ lat: -34.603722, lng: -58.381592, precision: "approximate" });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "location_consent_required");
  assert.equal(result.lat, null);
});

test("exact precision requests are rejected by the approximate-default boundary", () => {
  const result = normalizeConsentedApproximateLocation({ consent: true, precision: "exact", lat: -34.603722, lng: -58.381592 });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "approximate_location_required");
});

test("consented coordinates are rounded and accuracy cannot imply false precision", () => {
  const result = normalizeConsentedApproximateLocation({
    consent: true,
    precision: "approximate",
    lat: -34.603722,
    lng: -58.381592,
    accuracy: 9,
  });
  assert.deepEqual(result, {
    accepted: true,
    reason: "consented_approximate_location",
    lat: -34.604,
    lng: -58.382,
    accuracy: APPROXIMATE_LOCATION_MIN_ACCURACY_M,
  });
});

test("invalid coordinates fail closed even with consent", () => {
  const result = normalizeConsentedApproximateLocation({ consent: true, precision: "approximate", lat: 91, lng: -58 });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "invalid_location");
});

test("strict API coordinate pairs preserve zero but reject null coercion and partial pairs", () => {
  assert.deepEqual(normalizeCoordinatePair(0, 0), { lat: 0, lng: 0 });
  assert.deepEqual(normalizeCoordinatePair("-34.6", "-58.4"), { lat: -34.6, lng: -58.4 });
  assert.equal(normalizeCoordinatePair(null, null), null);
  assert.equal(normalizeCoordinatePair("", ""), null);
  assert.equal(normalizeCoordinatePair(-34.6, null), null);
  assert.equal(normalizeCoordinatePair(91, 0), null);
});

test("raw location and SUN dynamic auth values are redacted without removing non-secret evidence", () => {
  assert.deepEqual(redactSensitiveQueryValues({
    qr: "1",
    bid: "BATCH-001",
    v: "1",
    lat: "-34.603722",
    gps_lng: "-58.381592",
    accuracy: "9",
    PICC_DATA: "001122",
    piccDataHex: "334455",
    ENC: "667788",
    "encrypted-picc-data": "99AABB",
    CMAC: "CCDDEEFF",
    cmacHex: "0011AABB",
  }), {
    qr: "1",
    bid: "BATCH-001",
    v: "1",
    lat: "[redacted_location]",
    gps_lng: "[redacted_location]",
    accuracy: "[redacted_location]",
    PICC_DATA: "[redacted_sun_dynamic]",
    piccDataHex: "[redacted_sun_dynamic]",
    ENC: "[redacted_sun_dynamic]",
    "encrypted-picc-data": "[redacted_sun_dynamic]",
    CMAC: "[redacted_sun_dynamic]",
    cmacHex: "[redacted_sun_dynamic]",
  });
});

test("tap event persistence validates pairs, preserves 0,0 and redacts query geolocation", async () => {
  const tapService = await readFile(new URL("../src/lib/tap-event-service.ts", import.meta.url), "utf8");
  assert.match(tapService, /normalizeCoordinatePair\(payload\.lat, payload\.lng\)/);
  assert.match(tapService, /coordinate\?\.lat \?\? null/);
  assert.match(tapService, /coordinate\?\.lng \?\? null/);
  assert.match(tapService, /redactSensitiveQueryValues\(payload\.rawQuery\)/);
  assert.doesNotMatch(tapService, /payload\.lat \|\| null|payload\.lng \|\| null/);
});

test("SUN context and ownership claims enforce the shared privacy boundary", async () => {
  const [contextRoute, claimRoute, qrRoute, leadsRoute, sunService, atomicPersistence, diagnostics] = await Promise.all([
    readFile(new URL("../src/app/sun/context/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/public/cta/claim-ownership/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/public/leads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/sun-atomic-persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/sun-diagnostics.ts", import.meta.url), "utf8"),
  ]);
  for (const source of [contextRoute, claimRoute, qrRoute, leadsRoute]) assert.match(source, /normalizeConsentedApproximateLocation/);
  assert.match(contextRoute, /browser_gps_approximate_consent/);
  assert.match(contextRoute, /altitude: null/);
  assert.match(contextRoute, /speed: null/);
  assert.match(claimRoute, /location_consent: body\.locationConsent === true/);
  assert.match(qrRoute, /redactSensitiveQueryValues/);
  assert.match(qrRoute, /raw_query_location_redacted: true/);
  assert.match(qrRoute, /raw_query_sun_dynamic_redacted: true/);
  assert.match(leadsRoute, /source: "browser_gps_approximate_consent"/);

  // Dynamic values remain exact for CMAC/tamper verification, then are redacted
  // only at the persistence boundaries while their hashes remain available.
  assert.match(qrRoute, /piccDataHex: picc_data/);
  assert.match(qrRoute, /encHex: enc/);
  assert.match(qrRoute, /cmacHex: cmac/);
  assert.match(qrRoute, /processSunScan\(sunScanInput\)/);
  assert.match(qrRoute, /const diagnosticRequest = \{[\s\S]*?redactSensitiveQueryValues\(\{ bid, picc_data, enc, cmac \}\)/);
  assert.match(qrRoute, /request_json: diagnosticRequest/);
  assert.doesNotMatch(qrRoute, /request_json: \{ bid, picc_data, enc, cmac \}/);
  assert.match(qrRoute, /const persistedRawQuery = redactSensitiveQueryValues\(input\.rawQuery\) \|\| \{\}/);
  assert.match(qrRoute, /JSON\.stringify\(persistedRawQuery\)/);
  assert.match(sunService, /resolveTamperSignal\(\{[\s\S]*?rawQuery: input\.rawQuery/);
  assert.match(sunService, /persistSunScanAtomically\(\{[\s\S]*?rawQuery: input\.rawQuery/);
  assert.match(atomicPersistence, /redactSensitiveQueryValues\(input\.rawQuery\)/);
  assert.match(atomicPersistence, /picc_data_hash: input\.piccDataHash/);
  assert.match(atomicPersistence, /cmac_hash: input\.cmacHash/);
  assert.match(diagnostics, /redactSensitiveQueryValues\(input\.request_json as Record<string, unknown>\)/);
  assert.match(diagnostics, /JSON\.stringify\(persistedRequestJson \|\| \{\}\)/);
  assert.ok(sunService.indexOf("resolveTamperSignal({") < sunService.indexOf("persistSunScanAtomically({"));
});
