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
const webMap = await readFile(new URL("../../web/src/app/sun/sun-passport-map.tsx", import.meta.url), "utf8");

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

test("web SUN passport owns the MapLibre runtime while the API hands HTML traffic to the clean web surface", () => {
  assert.match(route, /const webTarget = wantsInlineApiHtml\(url\)/);
  assert.match(route, /buildWebSunSnapshotUrl\(url, diagnosticId, traceId, locale, freshHandoffToken, snapshotAccessToken\)/);
  assert.match(route, /return Response\.redirect\(webTarget, 303\)/);

  assert.match(webMap, /resolveTrustMapSource\(\)/);
  assert.match(webMap, /await import\("maplibre-gl"\)/);
  assert.match(webMap, /new maplibre\.Map\(/);
  assert.match(webMap, /new maplibre\.AttributionControl\(\{ compact: true \}\)/);
  assert.match(webMap, /tiles: \[tileTemplate\]/);
  assert.match(webMap, /attribution,/);
  assert.match(webMap, /TRUST_MAP_SOURCE\.rasterTileTemplate !== LEGACY_CARTO_TEMPLATE/);
  assert.match(webMap, /no-referrer/);
  assert.doesNotMatch(webMap, /access_token=|api_key=|key=secret/);
});
