import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { approximateDemoPosition, MENDOZA_DEMO_POINT } from "../src/app/sun/valle-secreto-demo-location.ts";
import { sunReferenceMapStyle } from "../src/app/sun/sun-reference-map.ts";
import { VALLE_SECRETO_DEMO, valleSecretoDemoResult } from "../src/app/sun/valle-secreto-demo.ts";

const [worldBytes, provenanceBytes] = await Promise.all([
  readFile(new URL("../public/sun/valle-secreto/world-reference.geojson", import.meta.url)),
  readFile(new URL("../public/sun/valle-secreto/world-reference.provenance.json", import.meta.url)),
]);
const world = JSON.parse(worldBytes);
const provenance = JSON.parse(provenanceBytes);

test("demo location rejects invalid positions, accuracy and unsupported Mercator latitudes", () => {
  const valid = { latitude: -32.889458, longitude: -68.845838, accuracy: 7 };
  for (const patch of [
    { latitude: NaN }, { latitude: Infinity }, { latitude: -Infinity }, { latitude: 85.01 }, { latitude: -85.01 },
    { longitude: NaN }, { longitude: Infinity }, { longitude: 180.01 }, { longitude: -180.01 },
    { accuracy: NaN }, { accuracy: Infinity }, { accuracy: -1 }, { accuracy: 1_000_001 }, { latitude: "-32.89" }, { longitude: null }, { accuracy: "7" },
  ]) assert.equal(approximateDemoPosition({ ...valid, ...patch }), null, JSON.stringify(patch));
  for (const latitude of [-85, 85]) for (const longitude of [-180, 180]) {
    assert.notEqual(approximateDemoPosition({ latitude, longitude, accuracy: 0 }), null);
  }
});

test("demo location rounds coordinates before returning them and floors uncertainty", () => {
  const raw = { latitude: -32.889458, longitude: -68.845838, accuracy: 7 };
  const position = approximateDemoPosition(raw);
  assert.equal(position.lat, -32.89);
  assert.equal(position.lng, -68.85);
  assert.ok(position.accuracyM >= 150);
  assert.notEqual(position.lat, raw.latitude);
  assert.notEqual(position.lng, raw.longitude);
  assert.deepEqual(raw, { latitude: -32.889458, longitude: -68.845838, accuracy: 7 });
  assert.equal(approximateDemoPosition({ latitude: 12.34567, longitude: 45.67891, accuracy: 1200 }).accuracyM, 1200);
  assert.equal(approximateDemoPosition({ latitude: 0, longitude: 0, accuracy: 0 }).lat, 0);
  assert.deepEqual(MENDOZA_DEMO_POINT, { lat: -32.89, lng: -68.84 });
});

test("the public winery destination cannot become raw SUN identity or customer location evidence", () => {
  assert.deepEqual(VALLE_SECRETO_DEMO.coordinates, { lat: -34.482672, lng: -70.837119 });
  assert.equal(VALLE_SECRETO_DEMO.navigationSource, "https://waze.com/ul/h63veu49gz");
  for (const scenario of ["closed", "opened"]) {
    const result = valleSecretoDemoResult(true, "valle-secreto", scenario);
    assert.equal(result.identity.uid, null);
    assert.equal(result.identity.eventId, "demo-sun-preview");
    assert.equal(result.identity.readCounter, 0);
    assert.equal(result.identity.scanCount, 0);
    assert.equal(result.iot.wineryCoordinates, null);
    assert.equal(result.tapContext, undefined);
    assert.deepEqual(result.provenance.timelineSummary, []);
    assert.deepEqual(result.allowedActions, []);
    assert.ok(Object.values(result.cta).every(value => value === false));
  }
});

test("the world reference is hash-bound public geography with valid finite closed rings", () => {
  assert.equal(createHash("sha256").update(worldBytes).digest("hex"), provenance.outputSha256);
  assert.equal(provenance.outputSha256, "4a05dddaa4c9347b9f9b6bec379f39ee0bbd118535b7bf886583649edcda7418");
  assert.equal(provenance.sourceCommit, "ca96624a56bd078437bca8184e78163e5039ad19");
  assert.equal(provenance.license, "Public domain");
  assert.equal(provenance.licenseUrl, "https://www.naturalearthdata.com/about/terms-of-use/");
  assert.equal(worldBytes.length, provenance.outputBytes);
  assert.equal(world.type, "FeatureCollection");
  assert.equal(world.features.length, 177);
  const countryNames = new Map(world.features.map(feature => [feature.properties.code, feature.properties.name]));
  for (const [code, name] of [["CHL", "Chile"], ["ARG", "Argentina"], ["JPN", "Japan"], ["CAN", "Canada"], ["ZAF", "South Africa"]]) assert.equal(countryNames.get(code), name);
  let ringCount = 0;
  for (const feature of world.features) {
    assert.equal(feature.type, "Feature");
    assert.deepEqual(Object.keys(feature.properties).sort(), ["code", "name"]);
    assert.ok(["Polygon", "MultiPolygon"].includes(feature.geometry.type));
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) {
      ringCount++;
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring.at(-1), ring[0]);
      assert.ok(new Set(ring.slice(0, -1).map(position => JSON.stringify(position))).size >= 3);
      for (const position of ring) {
        assert.equal(position.length, 2);
        assert.ok(position.every(Number.isFinite));
        assert.ok(Math.abs(position[0]) <= 180);
        assert.ok(Math.abs(position[1]) <= 90);
      }
    }
  }
  assert.equal(ringCount, 289);
});

test("both reference themes are valid MapLibre styles with zero external load surfaces", () => {
  for (const light of [false, true]) {
    const style = sunReferenceMapStyle(light);
    assert.deepEqual(validateStyleMin(style), []);
    assert.equal(style.version, 8);
    for (const key of ["glyphs", "sprite", "imports"]) assert.equal(style[key], undefined);
    assert.deepEqual(Object.keys(style.sources), ["geography"]);
    const geography = style.sources.geography;
    assert.equal(geography.type, "geojson");
    assert.equal(geography.data, "/sun/valle-secreto/world-reference.geojson");
    for (const key of ["url", "tiles", "urlTemplate"]) assert.equal(geography[key], undefined);
    assert.equal(new URL(geography.data, "https://nexid.example").origin, "https://nexid.example");
    const highlight = style.layers.find(layer => layer.id === "reference-vineyard-region");
    assert.deepEqual(highlight.filter, ["in", "name", "Chile", "Argentina"]);
    const highlighted = world.features.filter(feature => highlight.filter.slice(2).includes(feature.properties[highlight.filter[1]]));
    assert.deepEqual(highlighted.map(feature => feature.properties.code).sort(), ["ARG", "CHL"]);
    assert.ok(style.layers.every(layer => ["background", "fill", "line"].includes(layer.type)));
  }
  assert.notDeepEqual(sunReferenceMapStyle(false).layers[0].paint, sunReferenceMapStyle(true).layers[0].paint);
});
