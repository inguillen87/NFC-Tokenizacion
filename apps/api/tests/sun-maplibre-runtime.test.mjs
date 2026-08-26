import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");

test("physical SUN HTML uses an interactive MapLibre map instead of the SVG atlas", () => {
  assert.match(source, /maplibre-gl@5\.24\.0\/dist\/maplibre-gl\.css/);
  assert.match(source, /maplibre-gl@5\.24\.0\/dist\/maplibre-gl\.js/);
  assert.match(source, /data-nexid-map="maplibre-gl"/);
  assert.match(source, /new window\.maplibregl\.Map/);
  assert.match(source, /map\.on\('error'/);
  assert.match(source, /data-map-state', 'degraded'/);
  assert.match(source, /new window\.maplibregl\.NavigationControl/);
  assert.match(source, /type: 'geojson'/);
  assert.match(source, /id: 'sun-location-points'/);
  assert.match(source, /No se pudo iniciar MapLibre/);
  assert.doesNotMatch(source, /\$\{responsiveAtlasSvg\}/);
});

test("SUN map separates an observed tap from a declared origin and does not invent a route", () => {
  assert.match(source, /The declared origin is a reference marker only/);
  assert.match(source, /no line is drawn as if it were a physical route/);
  assert.match(source, /mapPoints = \[sunMapData\.origin, sunMapData\.tap\]\.filter\(Boolean\)/);
  const initStart = source.indexOf("const initSunMap =");
  const initEnd = source.indexOf("const ui =", initStart);
  const initializer = source.slice(initStart, initEnd);
  assert.doesNotMatch(initializer, /LineString|heatmap/);
});

test("physical SUN passport stays white-first even when the device prefers dark mode", () => {
  assert.match(source, /id="nexid-white-first"/);
  assert.match(source, /const prefersLight = true/);
  assert.match(source, /\.sensor-evidence\{background:#f8fafc!important\}/);
});

test("SUN measured-location wording requires an explicit measured source and positive accuracy", () => {
  assert.match(source, /rawTapAccuracyM > 0/);
  assert.match(source, /new Set\(\["device_gnss_measured", "device_gps_measured", "gnss_measured", "gps_measured", "surveyed"\]\)/);
  assert.doesNotMatch(source, /new Set\(\["gps", "gnss", "device_gps", "reader_gps"/);
});
