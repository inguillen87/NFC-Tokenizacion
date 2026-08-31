import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PUBLIC_RASTER_ATTRIBUTION,
  DEFAULT_PUBLIC_RASTER_TEMPLATE,
  formatTrustTileUrl,
  resolveTrustMapSource,
} from "../src/trust-map-source.ts";

test("default trust map uses the public Esri XYZ-compatible endpoint without a token claim", () => {
  const source = resolveTrustMapSource({
    rasterTileTemplate: DEFAULT_PUBLIC_RASTER_TEMPLATE,
    attribution: DEFAULT_PUBLIC_RASTER_ATTRIBUTION,
  });

  assert.equal(source.mode, "public-raster");
  assert.equal(source.badge, "Esri public raster");
  assert.doesNotMatch(source.badge, /free/i);
  assert.match(source.detail, /sin token de aplicacion configurado/i);
  assert.match(source.attribution, /^Esri,/);
  assert.equal(
    formatTrustTileUrl(source.rasterTileTemplate, 4, 3, 9),
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/4/9/3",
  );
});

test("legacy anonymous CARTO fallbacks and their stale attribution migrate together", () => {
  const source = resolveTrustMapSource({
    rasterTileTemplate: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution: "CARTO / OpenStreetMap",
  });

  assert.equal(source.rasterTileTemplate, DEFAULT_PUBLIC_RASTER_TEMPLATE);
  assert.equal(source.attribution, DEFAULT_PUBLIC_RASTER_ATTRIBUTION);
  assert.equal(source.badge, "Esri public raster");
});

test("an explicitly configured external raster and attribution remain configurable", () => {
  const source = resolveTrustMapSource({
    rasterTileTemplate: "https://maps.tenant.example/tiles/{z}/{x}/{y}.png",
    attribution: "Tenant map provider",
  });

  assert.equal(source.rasterTileTemplate, "https://maps.tenant.example/tiles/{z}/{x}/{y}.png");
  assert.equal(source.attribution, "Tenant map provider");
  assert.equal(source.badge, "Public raster source");
  assert.match(source.detail, /configurada por entorno/i);
});
