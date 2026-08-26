import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  classifySunLocationEvidence,
  clusterSunLocationObservations,
  describeSunLocationEvidence,
  normalizeSunCoordinatePair,
} from "../src/app/sun/sun-location-evidence.ts";

const [sunPage, sunApi, diagnostics] = await Promise.all([
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../../../apps/api/src/app/sun/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../../../apps/api/src/lib/sun-diagnostics.ts", import.meta.url), "utf8"),
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

test("SUN mobile map keeps declared origin outside real density and starts heat only with multiple observed locations", () => {
  assert.match(sunPage, /scans: point\.count/);
  assert.match(sunPage, /const opsMapPoints = isDemoPreview \? \[\.\.\.demoOriginMapPoints, \.\.\.observedMapPoints\] : observedMapPoints/);
  assert.match(sunPage, /const canShowSunIntensity = observedLocationClusters\.length >= 2/);
  assert.match(sunPage, /initialView=\{!isDemoPreview && canShowSunIntensity \? "intensity" : "events"\}/);
  assert.match(sunPage, /allowViewToggle=\{!isDemoPreview && canShowSunIntensity\}/);
  assert.doesNotMatch(sunPage, /scans: reportedScanCount/);
  assert.match(sunPage, /No completamos ciudades ni coordenadas con datos inventados/);
});

test("SUN API and snapshots preserve location source, accuracy and event identity", () => {
  assert.match(sunApi, /eventId\?: string \| null/);
  assert.match(sunApi, /locationSource\?: string \| null/);
  assert.match(sunApi, /accuracyM\?: number \| null/);
  assert.match(sunApi, /e\.id::text AS event_id/);
  assert.match(diagnostics, /resolveCurrentSnapshotTapLocation/);
  assert.match(diagnostics, /normalizeSnapshotContractFromCurrentTap/);
  assert.match(diagnostics, /locationSource: tap\.source/);
});

test("SUN legacy HTML shows only reported map evidence and never fabricates a route or global activity", () => {
  assert.match(sunApi, /const tapLocationAvailable = tapLat !== null && tapLng !== null/);
  assert.match(sunApi, /const linearReferenceAvailable = declaredOriginAvailable && tapLocationAvailable/);
  assert.match(sunApi, /Reported location; source not specified/);
  assert.match(sunApi, /Referencia declarada; no es una lectura observada ni suma intensidad/);
  assert.match(sunApi, /world-evidence-overlay/);
  assert.doesNotMatch(sunApi, /const atlasLights/);
  assert.doesNotMatch(sunApi, /animateMotion/);
  assert.doesNotMatch(sunApi, /stroke-dashoffset/);
});
