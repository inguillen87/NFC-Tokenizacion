import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

import { buildGeojson } from "../src/components/realtime-maplibre-map.tsx";

const source = await readFile(new URL("../src/components/realtime-maplibre-map.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("map.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);

function actualFunction(name, dependencies = {}) {
  const declaration = parsed.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `exercise the actual ${name} implementation`);
  const compiled = ts.transpileModule(declaration.getText(parsed), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}\nreturn ${name};`)(...Object.values(dependencies));
}

function mapFixture() {
  const layers = new Map();
  const sources = new Map();
  return {
    layers,
    sources,
    getLayer: (id) => layers.get(id),
    getSource: (id) => sources.get(id),
    addLayer: (layer) => layers.set(layer.id, structuredClone(layer)),
    addSource: (id, specification) => sources.set(id, structuredClone(specification)),
    setLayoutProperty: (id, property, value) => {
      const layer = layers.get(id);
      layer.layout = { ...layer.layout, [property]: value };
    },
    setPaintProperty: (id, property, value) => { layers.get(id).paint[property] = value; },
    easeTo: () => {},
  };
}

const ensureLayers = actualFunction("ensureLayers");
const setLayerVisibility = actualFunction("setLayerVisibility");
const setBasemapLayer = actualFunction("setBasemapLayer", {
  ensureTerrainEnhancement: () => {},
  mapMotionDuration: () => 0,
});

function eventFixture(source = "edge_ip_approx") {
  return {
    eventId: "fixture-1",
    tenantSlug: "fixture-tenant",
    occurredAt: "2026-09-05T23:04:51.221Z",
    city: "Fixture City",
    country: "AR",
    lat: -30,
    lng: -60,
    locationSource: source,
    verdict: "valid",
  };
}

test("one observed event has a visible crisp marker in Density at regional and close zoom", () => {
  const data = buildGeojson([eventFixture()]);
  const map = mapFixture();
  ensureLayers(map, data);
  setLayerVisibility(map, "heat");
  const marker = map.layers.get("tap-bubbles");

  assert.equal(marker.layout.visibility, "visible");
  assert.deepEqual(marker.filter, ["!", ["has", "point_count"]]);
  // Constant opacity/stroke deliberately avoids the former zero-opacity zoom
  // stops. The isolated event cannot disappear at zoom 3, 7, 8 or 13.
  assert.equal(typeof marker.paint["circle-opacity"], "number");
  assert.ok(marker.paint["circle-opacity"] >= 0.85);
  assert.ok(marker.paint["circle-blur"] <= 0.15);
  assert.ok(marker.paint["circle-stroke-width"] >= 1);
  assert.ok(marker.paint["circle-stroke-opacity"] >= 0.8);
  assert.deepEqual(marker.paint["circle-radius"].slice(0, 5), ["interpolate", ["linear"], ["get", "localTaps"], 1, 5]);
  assert.equal(data.features[0].properties.weight, 1, "visibility must not exaggerate density");
  assert.equal(data.features[0].properties.locationClass, "network_approx");
  assert.equal(data.features[0].properties.locationPrecision, "approximate");
});

test("Density preserves distinct GPS, network and other colors and unchanged heat weights", () => {
  const data = buildGeojson([
    eventFixture("edge_ip_approx"),
    { ...eventFixture("browser_gps_approximate_consent"), eventId: "fixture-2", verdict: "invalid" },
    { ...eventFixture(null), eventId: "fixture-3" },
  ]);
  const map = mapFixture();
  ensureLayers(map, data);
  assert.deepEqual(data.features.map((row) => row.properties.weight), [1, 1, 1]);
  assert.deepEqual(data.features.map((row) => row.properties.locationClass), ["network_approx", "consented_gps", "other_reported"]);
  assert.deepEqual(map.layers.get("tap-bubbles").paint["circle-color"], [
    "case",
    ["==", ["get", "risk"], 1], "#fb7185",
    ["==", ["get", "locationClass"], "consented_gps"], "#2dd4bf",
    ["==", ["get", "locationClass"], "network_approx"], "#f59e0b",
    "#a78bfa",
  ]);
  for (const id of ["tap-heat-network", "tap-heat-gps", "tap-heat-other"]) {
    assert.deepEqual(map.layers.get(id).paint["heatmap-weight"], ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1]);
  }
});

test("markers contrast on light and dark basemaps and switch cleanly between views", () => {
  const map = mapFixture();
  ensureLayers(map, buildGeojson([eventFixture()]));
  for (const [theme, stroke] of [["light", "#0f172a"], ["dark", "#ffffff"]]) {
    setBasemapLayer(map, theme);
    assert.equal(map.layers.get("tap-bubbles").paint["circle-stroke-color"], stroke);
  }
  for (const view of ["heat", "points", "nearby", "heat"]) {
    setLayerVisibility(map, view);
    assert.equal(map.layers.get("tap-bubbles").layout.visibility, view === "heat" ? "visible" : "none");
    assert.equal(map.layers.get("tap-points").layout.visibility, view === "heat" ? "none" : "visible");
  }
  ensureLayers(map, buildGeojson([eventFixture()]));
  assert.equal(map.layers.size, 7, "reconciliation does not duplicate marker layers");
});

test("no coordinate is manufactured and snapshots or filters cannot start a perpetual pulse", () => {
  const data = buildGeojson([{ ...eventFixture(), lat: null, lng: null }]);
  assert.equal(data.features.length, 0);
  assert.doesNotMatch(source, /animatePulse|pulseStarted|id: "tap-pulse"/);
  assert.match(source, /startFiniteTapArrivalAnimation\(\{/);
  assert.match(source, /consumedArrivalRef\.current === arrival\.key/);
  assert.match(source, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches \? 0 : duration/);
  assert.match(source, /popupRef\.current\?\.remove\(\)/);
  assert.match(source, /mapRef\.current\?\.remove\(\)/);
});

test("Density and Events markers share the same observed-evidence popup", () => {
  assert.match(source, /for \(const layer of \["tap-bubbles", "tap-points"\]\) \{\s*map\.on\("click", layer, onTapClick\)/);
  assert.match(source, /locationProvenanceLabel\(props\.locationSource\)/);
  assert.match(source, /escapeHtml\(props\.locationLabel\)/);
});
