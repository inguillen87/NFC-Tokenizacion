import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  classifySunLocationEvidence,
  clusterSunLocationObservations,
  describeSunLocationEvidence,
  normalizeSunCoordinatePair,
  resolveSunCurrentTapPlace,
} from "../src/app/sun/sun-location-evidence.ts";

const [sunPage, sunApi, diagnostics, locationExperience, passportMap] = await Promise.all([
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../../../apps/api/src/app/sun/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../../../apps/api/src/lib/sun-diagnostics.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-location-experience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-passport-map.tsx", import.meta.url), "utf8"),
]);

test("SUN location evidence accepts only complete WGS84 coordinate pairs", () => {
  assert.deepEqual(normalizeSunCoordinatePair(-34.6037, -58.3816), { lat: -34.6037, lng: -58.3816 });
  assert.deepEqual(normalizeSunCoordinatePair("0", "0"), { lat: 0, lng: 0 });
  assert.equal(normalizeSunCoordinatePair(-34, null), null);
  assert.equal(normalizeSunCoordinatePair(91, -58), null);
  assert.equal(normalizeSunCoordinatePair(-34, -181), null);
  assert.equal(normalizeSunCoordinatePair("Mendoza", -68), null);
});

test("SUN location labels distinguish measured, approximate, declared and absent evidence", () => {
  assert.equal(classifySunLocationEvidence("device_gnss_measured", true), "measured");
  assert.equal(classifySunLocationEvidence("browser_gps_approximate_consent", true), "approximate");
  assert.equal(classifySunLocationEvidence("brand_profile", true, { declared: true }), "declared");
  assert.equal(classifySunLocationEvidence("browser_gps_approximate_consent", false), "absent");
  assert.match(describeSunLocationEvidence("approximate", 180), /±180 m/);
  assert.match(describeSunLocationEvidence("declared"), /declarado por la marca/);
});

test("consented phone location never borrows a historical city or country", () => {
  assert.deepEqual(resolveSunCurrentTapPlace({
    locationSource: "browser_gps_approximate_consent",
    currentCity: null,
    currentCountry: null,
    historicalCity: "Buenos Aires",
    historicalCountry: "AR",
  }), {
    city: "Zona aproximada compartida",
    country: "",
    display: "Zona aproximada compartida",
  });

  assert.deepEqual(resolveSunCurrentTapPlace({
    locationSource: "browser_gps_approximate_consent",
    currentCity: "Godoy Cruz",
    currentCountry: "AR",
    historicalCity: "Buenos Aires",
    historicalCountry: "AR",
  }), {
    city: "Godoy Cruz",
    country: "AR",
    display: "Godoy Cruz, AR",
  });
});

test("SUN heat density counts observed events, groups repeated coordinates and never invents invalid points", () => {
  const clusters = clusterSunLocationObservations([
    { id: "e1", eventId: "101", lat: -34.6037, lng: -58.3816, result: "VALID", source: "ip_geo", at: "2026-08-26T10:00:00Z" },
    { id: "e1-repeat", eventId: "101", lat: -34.6037, lng: -58.3816, result: "VALID", source: "ip_geo", at: "2026-08-26T10:00:00Z" },
    { id: "e2", eventId: "102", lat: -34.6037, lng: -58.3816, result: "REPLAY_SUSPECT", source: "browser_gps_approximate_consent", accuracyM: 200, at: "2026-08-26T11:00:00Z", current: true },
    { id: "broken", eventId: "103", lat: -34.6, lng: null, result: "VALID" },
  ]);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].count, 2);
  assert.equal(clusters[0].risk, 1);
  assert.equal(clusters[0].current, true);
  assert.equal(clusters[0].accuracyM, 200);
  assert.match(clusters[0].sourceLabel, /aproximada/i);
});

test("SUN mobile map renders only declared origin and the current consented tap", () => {
  assert.match(sunPage, /const resolvedOriginCoords = isUsableCoordinate\(wineryCoordinates\?\.lat, wineryCoordinates\?\.lng\)/);
  assert.match(sunPage, /const hasCurrentTapCoords = isUsableCoordinate\(result\.tapContext\?\.lat, result\.tapContext\?\.lng\)/);
  assert.match(sunPage, /<SunLocationExperience[\s\S]*?origin=\{wineryPoint\[0\] \?[\s\S]*?tap=\{currentTapPoint\[0\] \?/);
  assert.match(sunPage, /showRoute=\{isDemoPreview\}/);
  assert.match(sunPage, /isConsentedBrowserLocationSource\(rawLocationSource\)/);
  assert.match(sunPage, /No es tu posición:[\s\S]*?puede ubicarte en otra ciudad/);
  assert.match(locationExperience, /const effectiveTap = confirmedTap \|\| tap/);
  assert.doesNotMatch(locationExperience, /externalTiles=\{showRoute\}/);
  assert.match(passportMap, /const showDemoConnection = Boolean\(showRoute && origin && tap\?\.source === "demo"\)/);
  assert.match(passportMap, /data-route-mode=\{showDemoConnection \? "demo" : "no-route"\}/);
  assert.match(passportMap, /style: mapStyleForTheme\(isLightTheme\(\)\)/);
  assert.doesNotMatch(passportMap, /localCoordinateStyle|data-external-tiles/);
  assert.doesNotMatch(sunPage, /GlobalOpsMap|opsMapPoints|consumerCurrentTapMapPoints/);
});

test("SUN API and snapshots preserve location source, accuracy and event identity", () => {
  assert.match(sunApi, /locationSource: params\.tap\.locationSource/);
  assert.match(sunApi, /accuracyM: publicTapLocation\.lat != null \? params\.tap\.locationAccuracyM : null/);
  assert.doesNotMatch(sunApi, /e\.id::text AS event_id/);
  assert.match(diagnostics, /resolveCurrentSnapshotTapLocation/);
  assert.match(diagnostics, /WHERE event\.id = \$\{eventId\}::bigint[\s\S]*?event\.bid[\s\S]*?event\.uid_hex/);
  assert.match(diagnostics, /post_tap_location_observation/);
  assert.match(diagnostics, /browser_geolocation_approximate_consent/);
  assert.match(diagnostics, /browser_gps_approximate_consent/);
  assert.match(diagnostics, /normalizeSnapshotContractFromCurrentTap/);
  assert.match(diagnostics, /sanitizePublicLocationProjection/);
  assert.match(diagnostics, /locationSource: source \|\| "none"/);
  assert.match(diagnostics, /timelineSummary: \[currentTimelineEvent\]/);
});

test("browser SUN requests redirect to the clean web passport while legacy HTML stays explicit and noindex", () => {
  assert.match(sunApi, /function wantsInlineApiHtml\(url: URL\)/);
  assert.match(sunApi, /view === "api-html" \|\| view === "legacy-html"/);
  assert.match(sunApi, /const webTarget = wantsInlineApiHtml\(url\)[\s\S]*?: buildWebSunSnapshotUrl/);
  assert.match(sunApi, /return Response\.redirect\(webTarget, 303\)/);
  assert.match(sunApi, /'x-robots-tag': 'noindex, nofollow'/);
  assert.match(sunApi, /public_checkpoint[\s\S]*?visibility[\s\S]*?public/);
  assert.match(sunApi, /Product history is tenant-published and deliberately coarse/);
  assert.doesNotMatch(sunApi, /e\.id::text AS event_id/);
});
