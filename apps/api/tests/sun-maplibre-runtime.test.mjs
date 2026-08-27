import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_PUBLIC_DARK_MAP_STYLE_URL,
  DEFAULT_PUBLIC_MAP_ATTRIBUTION,
  DEFAULT_PUBLIC_MAP_STYLE_URL,
  isNoKeyPublicMapStyleUrl,
  isNoKeyPublicRasterTileTemplate,
  normalizePublicMapStyleUrl,
  normalizePublicRasterTileTemplate,
} from "../src/lib/sun-map-source.ts";

const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");

test("public SUN map defaults to real OpenFreeMap vector styles without an API key", () => {
  assert.equal(DEFAULT_PUBLIC_MAP_STYLE_URL, "https://tiles.openfreemap.org/styles/positron");
  assert.equal(DEFAULT_PUBLIC_DARK_MAP_STYLE_URL, "https://tiles.openfreemap.org/styles/dark");
  assert.equal(DEFAULT_PUBLIC_MAP_ATTRIBUTION, "OpenFreeMap © OpenMapTiles · Data from OpenStreetMap");
  assert.equal(isNoKeyPublicMapStyleUrl(DEFAULT_PUBLIC_MAP_STYLE_URL), true);
  assert.equal(isNoKeyPublicRasterTileTemplate("/tiles/{z}/{x}/{y}.png"), true);
  assert.equal(isNoKeyPublicRasterTileTemplate("https://tiles.example.test/{z}/{x}/{y}.png"), true);
});

test("SUN map rejects key-gated providers, keyed URLs and stale production overrides", () => {
  const forbiddenCarto = "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";
  const forbiddenKeyed = "https://tiles.example.test/{z}/{x}/{y}.png?api_key=secret";

  assert.equal(isNoKeyPublicRasterTileTemplate(forbiddenCarto), false);
  assert.equal(isNoKeyPublicRasterTileTemplate(forbiddenKeyed), false);
  assert.equal(normalizePublicRasterTileTemplate(forbiddenCarto), "");
  assert.equal(normalizePublicRasterTileTemplate(forbiddenKeyed), "");
  assert.equal(normalizePublicMapStyleUrl("https://api.mapbox.com/styles/v1/demo?access_token=secret"), DEFAULT_PUBLIC_MAP_STYLE_URL);
});

test("inline SUN passport keeps MapLibre, visible attribution and vector default with optional safe raster override", () => {
  assert.match(route, /data-nexid-map="maplibre-gl"/);
  assert.match(route, /new window\.maplibregl\.Map/);
  assert.match(route, /AttributionControl/);
  assert.match(route, /normalizePublicRasterTileTemplate\(requestedRasterTileTemplate\)/);
  assert.match(route, /normalizePublicMapStyleUrl\(requestedMapStyleUrl\)/);
  assert.match(route, /styleUrl: mapStyleUrl/);
  assert.match(route, /baseMapStyle = sunMapData\.tileTemplate/);
  assert.match(route, /tiles: \[sunMapData\.tileTemplate\]/);
  assert.doesNotMatch(route, /lightTileTemplate|dark_all|voyager_nolabels|basemaps\.cartocdn\.com|tile\.openstreetmap\.org/);
});
