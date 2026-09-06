import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { classifyLocationProvenance, locationProvenanceLabel } = await import("../src/lib/location-provenance.ts");
const { buildGeojson } = await import("../src/components/realtime-maplibre-map.tsx");

const realtimeMap = await readFile(new URL("../src/components/realtime-maplibre-map.tsx", import.meta.url), "utf8");
const demoMap = await readFile(new URL("../src/components/demo-ops-map.tsx", import.meta.url), "utf8");
const analyticsPanels = await readFile(new URL("../src/components/analytics-panels.tsx", import.meta.url), "utf8");
const analyticsPage = await readFile(new URL("../src/app/(app)/analytics/page.tsx", import.meta.url), "utf8");

test("location provenance keeps consented GPS separate from network and mixed approximations", () => {
  assert.equal(classifyLocationProvenance("browser_geolocation_approximate_consent"), "consented_gps");
  assert.equal(classifyLocationProvenance("browser_gps_approximate_consent"), "consented_gps");
  assert.equal(classifyLocationProvenance("browser_approximate_consent"), "consented_gps");
  assert.equal(classifyLocationProvenance("ip_geo"), "network_approx");
  assert.equal(classifyLocationProvenance("ip_approx"), "network_approx");
  assert.equal(classifyLocationProvenance("mixed_or_unknown_approx"), "mixed_approx");
  assert.equal(classifyLocationProvenance("browser_gps_reported"), "other_reported");
  assert.equal(classifyLocationProvenance("browser_geolocation"), "other_reported");
  assert.match(locationProvenanceLabel("ip_approx"), /Red\/IP/);
});

test("realtime GeoJSON preserves source classification without changing heat weight by risk", () => {
  const shared = {
    city: "Mendoza",
    country: "AR",
    occurredAt: "2026-08-27T12:00:00.000Z",
    tenantSlug: "nexid-test",
    verdict: "VALID",
  };
  const collection = buildGeojson([
    { ...shared, eventId: "gps", uidMasked: "GPS", lat: -32.889, lng: -68.845, locationSource: "browser_gps_approximate_consent", locationAccuracyM: 150 },
    { ...shared, eventId: "ip", uidMasked: "IP", lat: -34.603, lng: -58.381, locationSource: "ip_geo", locationAccuracyM: 20_000 },
    { ...shared, eventId: "sun-browser", uidMasked: "SUN", lat: -32.9, lng: -68.8, locationSource: "browser_geolocation_approximate_consent", locationAccuracyM: 150 },
  ]);

  assert.deepEqual(collection.features.map((feature) => feature.properties.locationClass), ["consented_gps", "network_approx", "consented_gps"]);
  assert.deepEqual(collection.features.map((feature) => feature.properties.weight), [1, 1, 1]);
});

test("MapLibre renders provenance-specific heat and uncertainty layers with attribution intact", () => {
  assert.match(realtimeMap, /id: "tap-heat-gps"/);
  assert.match(realtimeMap, /id: "tap-heat-network"/);
  assert.match(realtimeMap, /id: "tap-heat-other"/);
  assert.match(realtimeMap, /filter: \["==", \["get", "locationClass"\], "consented_gps"\]/);
  assert.match(realtimeMap, /filter: \["==", \["get", "locationClass"\], "network_approx"\]/);
  assert.match(realtimeMap, /3, 20, 8, 38, 12, 58/);
  assert.match(realtimeMap, /3, 8, 8, 16, 12, 26/);
  assert.match(realtimeMap, /set\("tap-heat-gps", view === "heat"\)/);
  assert.match(realtimeMap, /AttributionControl/);
  assert.match(realtimeMap, /TRUST_MAP_SOURCE\.attribution/);
});

test("aggregated analytics propagates provenance and exposes an accessible source filter", () => {
  assert.match(analyticsPage, /coordinateSource\?: string/);
  assert.match(analyticsPage, /coordinateAccuracyMeters\?: number \| null/);
  assert.match(analyticsPanels, /locationSource: point\.coordinateSource/);
  assert.match(analyticsPanels, /locationAccuracyM: point\.coordinateAccuracyMeters/);
  assert.match(demoMap, /aria-label="Filtrar por procedencia geográfica"/);
  assert.doesNotMatch(demoMap, /if \(!String\(point\.locationSource \|\| ""\)\.trim\(\)\) return counts/);
  assert.match(demoMap, /GPS consentido: zona aproximada más acotada/);
  assert.match(demoMap, /Red\/IP: zona amplia, no posición del teléfono/);
  assert.match(demoMap, /locationSource: point\.locationSource \|\| undefined/);
  assert.match(demoMap, /locationAccuracyM: point\.locationAccuracyM \?\? undefined/);
  assert.match(demoMap, /routes=\{\[\]\}/);
});
