import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const { resolveEventMapCoordinate, strictCoordinatePair } = await import("../src/lib/geo-coordinates.ts");
const { buildGeojson } = await import("../src/components/realtime-maplibre-map.tsx");

const crmSource = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const customerGrowthSource = await readFile(new URL("../src/components/customer-growth-command-center.tsx", import.meta.url), "utf8");
const realtimeMapSource = await readFile(new URL("../src/components/realtime-maplibre-map.tsx", import.meta.url), "utf8");
const realtimeOpsSource = await readFile(new URL("../src/components/realtime-ops-monitor.tsx", import.meta.url), "utf8");
const multirubroSource = await readFile(new URL("../src/components/multirubro-ops-panel.tsx", import.meta.url), "utf8");
const demoMapSource = await readFile(new URL("../src/components/demo-ops-map.tsx", import.meta.url), "utf8");
const analyticsSource = await readFile(new URL("../src/components/analytics-panels.tsx", import.meta.url), "utf8");
const legacyRealMapSource = await readFile(new URL("../src/components/real-ops-map.tsx", import.meta.url), "utf8");
const globalOpsMapSource = await readFile(new URL("../../../packages/ui/src/global-ops-map.tsx", import.meta.url), "utf8");

test("strict coordinates reject null and empty values instead of coercing them to 0,0", () => {
  assert.equal(strictCoordinatePair(null, null), null);
  assert.equal(strictCoordinatePair(undefined, undefined), null);
  assert.equal(strictCoordinatePair("", ""), null);
  assert.equal(strictCoordinatePair("   ", "   "), null);
  assert.equal(strictCoordinatePair("-91", "0"), null);
  assert.equal(strictCoordinatePair("0", "181"), null);
  assert.deepEqual(strictCoordinatePair(0, 0), { lat: 0, lng: 0 });
  assert.deepEqual(strictCoordinatePair("-34.6037", "-58.3816"), { lat: -34.6037, lng: -58.3816 });
});

test("production coordinate resolution never manufactures a coordinate from city text", () => {
  const coordinate = resolveEventMapCoordinate({
    lat: null,
    lng: null,
    city: "Mendoza",
    country: "AR",
    locationSource: "browser_gps",
    locationAccuracyM: 12,
    seed: "evt-synthetic-regression",
  });

  assert.equal(coordinate, null);

  const accentedCity = resolveEventMapCoordinate({
    lat: "",
    lng: "",
    city: "Córdoba",
    country: "AR",
    seed: "evt-accented-city",
  });
  assert.equal(accentedCity, null);
});

test("reported IP coordinates remain approximate and retain declared accuracy", () => {
  const coordinate = resolveEventMapCoordinate({
    lat: -34.6,
    lng: -58.38,
    city: "Buenos Aires",
    country: "AR",
    locationSource: "ip_geo",
    locationAccuracyM: "1250",
    seed: "evt-ip-regression",
  });

  assert.ok(coordinate);
  assert.equal(coordinate.precision, "approximate");
  assert.equal(coordinate.source, "ip_geo");
  assert.equal(coordinate.accuracyM, 1250);
  assert.match(coordinate.label, /aproximada por IP/);
});

test("CRM, customer growth and realtime map all consume the strict coordinate contract", () => {
  assert.match(crmSource, /strictCoordinatePair\(event\.lat, event\.lng\)/);
  assert.match(customerGrowthSource, /strictCoordinatePair\(event\.lat, event\.lng\)/);
  assert.match(realtimeMapSource, /resolveEventMapCoordinate\(\{/);
  assert.doesNotMatch(crmSource, /Number\.isFinite\(Number\(event\.lat\)\)/);
  assert.doesNotMatch(customerGrowthSource, /Number\.isFinite\(Number\(event\.lat\)\)/);
  assert.doesNotMatch(realtimeMapSource, /Number\.isFinite\(Number\(row\.lat\)\)/);
  assert.doesNotMatch(realtimeMapSource, /precisionSummary\.synthetic|sintéticas por centro urbano/);
  assert.match(realtimeMapSource, /source: "tap-events-heat"/);
  assert.match(realtimeMapSource, /Risk remains an independent marker and never inflates activity volume/);
  assert.doesNotMatch(realtimeMapSource, /riskBoost/);
  assert.doesNotMatch(realtimeMapSource, /weight: risk \?/);
  assert.doesNotMatch(realtimeOpsSource, /KNOWN_CITY_COORDS|cityFallback/);
  assert.match(realtimeOpsSource, /strictCoordinatePair\(row\.lat, row\.lng\)/);
  assert.match(multirubroSource, /strictCoordinatePair\(payload\.lat, payload\.lng\)/);
  assert.match(multirubroSource, /strictCoordinatePair\(point\.lat, point\.lng\)/);
  assert.match(multirubroSource, /TenantTapRealtimeWireEvent/);
  assert.doesNotMatch(multirubroSource, /const lat = Number\(payload\.lat\)/);
});

test("CRM heat layer describes observed volume and keeps risk visually separate", () => {
  assert.match(crmSource, /Volumen relativo de lecturas con ubicación observada/);
  assert.match(crmSource, /El riesgo se muestra por separado y no altera la intensidad/);
  assert.match(crmSource, /Escala relativa de volumen observado/);
  assert.match(crmSource, /Menor volumen/);
  assert.match(crmSource, /Mayor volumen/);
  assert.match(crmSource, /useState<BaseMapLayer>\("light"\)/);
});

test("each observed map event has equal heat weight regardless of risk", () => {
  const shared = {
    city: "Mendoza",
    country: "AR",
    lat: -32.8895,
    lng: -68.8458,
    locationSource: "browser_gps",
    locationAccuracyM: 12,
    occurredAt: "2026-08-26T12:00:00.000Z",
    tenantSlug: "nexid-test",
  };
  const collection = buildGeojson([
    { ...shared, eventId: "evt-valid", uidMasked: "UID-1", verdict: "VALID" },
    { ...shared, eventId: "evt-risk", uidMasked: "UID-2", verdict: "INVALID", reason: "replay_detected" },
  ]);

  assert.equal(collection.features.length, 2);
  assert.deepEqual(collection.features.map((feature) => feature.properties.weight), [1, 1]);
  assert.deepEqual(collection.features.map((feature) => feature.properties.localTaps), [2, 2]);
  assert.deepEqual(collection.features.map((feature) => feature.properties.risk), [0, 1]);
});

test("aggregated analytics points never invent a route or current recency", () => {
  assert.doesNotMatch(demoMapSource, /new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(demoMapSource, /normalizedPoints\.slice\(1/);
  assert.doesNotMatch(demoMapSource, /rutas punteadas entre eventos/);
  assert.match(demoMapSource, /routes=\{\[\]\}/);
  assert.match(demoMapSource, /playbackEnabled=\{false\}/);
  assert.match(demoMapSource, /No infiere recorridos entre puntos agregados/);
  assert.doesNotMatch(analyticsSource, /new Date\(\)\.toISOString\(\)/);
  assert.match(analyticsSource, /const cityLastSeenByKey = useMemo/);
  assert.match(analyticsSource, /lastSeen: cityLastSeenByKey\.get/);
  assert.doesNotMatch(analyticsSource, /<DemoOpsMap/);
  assert.match(analyticsSource, /isDeclaredProductOrigin\(item\.originSource\)/);
  assert.match(analyticsSource, /sin distancia logistica/);
  assert.match(analyticsSource, /isDeclaredProductOrigin\(item\.originSource\)/);
  assert.match(analyticsSource, /Primer tap reportado/);
  assert.doesNotMatch(analyticsSource, /última ubicación verificada/);
  assert.match(analyticsSource, /scans: row\.scans/);
  assert.doesNotMatch(analyticsSource, /scans: Math\.max\(row\.scans, 1\)/);
});

test("legacy operational map does not invent recency or connect independent city points", () => {
  assert.doesNotMatch(legacyRealMapSource, /new Date\(\)\.toISOString\(\)/);
  assert.match(legacyRealMapSource, /lastSeen: point\.lastSeen \|\| ""/);
  assert.match(legacyRealMapSource, /routes=\{\[\]\}/);
  assert.match(legacyRealMapSource, /playbackEnabled=\{false\}/);
  assert.match(legacyRealMapSource, /Los puntos independientes no se convierten en una ruta/);
});

test("shared operational maps never invent tokenization or physical-product verification", () => {
  assert.match(globalOpsMapSource, /No hay señal TOKEN\/MINT\/CLAIM\/NFT en este scope/);
  assert.match(globalOpsMapSource, /el tap no transfiere propiedad automáticamente/);
  assert.match(globalOpsMapSource, /Escenario sin producto confirmado/);
  assert.doesNotMatch(globalOpsMapSource, /\|\| "ready"/);
  assert.doesNotMatch(globalOpsMapSource, /\|\| "Producto verificado"/);
  assert.doesNotMatch(globalOpsMapSource, /mapa vivo nexID/);
});

test("dashboard heatmaps resolve a no-key shared basemap and keep visible attribution", () => {
  assert.match(realtimeMapSource, /resolveTrustMapSource/);
  assert.match(realtimeMapSource, /TRUST_MAP_SOURCE\.styleUrl/);
  assert.match(realtimeMapSource, /TRUST_MAP_SOURCE\.darkStyleUrl/);
  assert.match(realtimeMapSource, /TRUST_MAP_SOURCE\.rasterTileTemplate/);
  assert.match(realtimeMapSource, /TRUST_MAP_SOURCE\.attribution/);
  assert.match(realtimeMapSource, /AttributionControl/);
  assert.match(realtimeMapSource, /raster-brightness-max/);
  assert.match(realtimeMapSource, /map\.on\("styleimagemissing"/);
  assert.match(realtimeMapSource, /\^circle-\(\\d\+\)\$/);
  assert.match(realtimeMapSource, /map\.addImage\(imageId/);
  assert.doesNotMatch(realtimeMapSource, /basemaps\.cartocdn\.com|dark_all|light_all|voyager_nolabels|tile\.openstreetmap\.org/);
});
