import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [qrEngagement, sunPage] = await Promise.all([
  readFile(new URL("../src/app/sun/qr-engagement-suite.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
]);

test("QR engagement geolocation is explicit opt-in and approximate before network transfer", () => {
  assert.match(qrEngagement, /shareApproximateLocation/);
  assert.match(qrEngagement, /type="checkbox"/);
  assert.match(qrEngagement, /consent: true/);
  assert.match(qrEngagement, /precision: "approximate"/);
  assert.match(qrEngagement, /source: "browser_gps_approximate_consent"/);
  assert.match(qrEngagement, /Math\.round\(position\.coords\.latitude \* 1_000\) \/ 1_000/);
  assert.match(qrEngagement, /Math\.max\(150, Math\.round\(position\.coords\.accuracy\)\)/);
  assert.doesNotMatch(qrEngagement, /lat: position\.coords\.latitude/);
  assert.doesNotMatch(qrEngagement, /lng: position\.coords\.longitude/);
});

test("public SUN maps only plot measured WGS84 pairs and never synthesize city coordinates", () => {
  assert.doesNotMatch(sunPage, /KNOWN_TAP_COORDS|KNOWN_ORIGIN_COORDS|resolveKnownTapCoordinates|resolveOriginCoordinates|tap_city_geocenter/);
  assert.match(sunPage, /parsedLat >= -90/);
  assert.match(sunPage, /parsedLat <= 90/);
  assert.match(sunPage, /parsedLng >= -180/);
  assert.match(sunPage, /parsedLng <= 180/);
  assert.doesNotMatch(sunPage, /Number\(lat\) === 0 && Number\(lng\) === 0/);
});
