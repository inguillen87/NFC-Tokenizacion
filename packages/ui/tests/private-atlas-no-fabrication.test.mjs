import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PremiumVectorMap } from "../src/premium-vector-map.tsx";
import { buildTrustMapPointGeoJson, buildTrustMapRouteGeoJson } from "../src/real-geographic-map.tsx";

globalThis.React = React;

const origin = {
  id: "origin",
  label: "Origen declarado",
  lat: -33,
  lng: -68,
  tone: "origin",
};
const tap = {
  id: "tap",
  label: "Tap reportado",
  lat: -34.6,
  lng: -58.4,
  tone: "tap",
};
const route = {
  id: "reported-route",
  fromLat: origin.lat,
  fromLng: origin.lng,
  toLat: tap.lat,
  toLng: tap.lng,
};

test("geographic renderer does not manufacture a tap or route for real origin-only evidence", () => {
  const pointData = buildTrustMapPointGeoJson([origin], "balanced");
  const routeData = buildTrustMapRouteGeoJson([]);
  assert.deepEqual(pointData.features.map((feature) => feature.properties.id), ["origin"]);
  assert.equal(routeData.features.length, 0);

  const markup = renderToStaticMarkup(React.createElement(PremiumVectorMap, {
    points: [origin],
    routes: [],
    selectedPointId: origin.id,
    chrome: "enterprise-atlas",
    externalTiles: false,
  }));

  assert.match(markup, /data-nexid-map="maplibre-gl"/);
  assert.match(markup, /data-nexid-map-source="nexid-local-coordinate-grid"/);
  assert.match(markup, /data-nexid-external-tiles="disabled"/);
  assert.match(markup, /1 puntos geográficos, 0 relaciones reportadas/);
  assert.doesNotMatch(markup, />Tap reportado</);
});

test("geographic renderer retains only explicitly supplied demo tap and connection evidence", () => {
  const pointData = buildTrustMapPointGeoJson([origin, tap], "route");
  const routeData = buildTrustMapRouteGeoJson([route]);
  assert.deepEqual(pointData.features.map((feature) => feature.properties.id), ["origin", "tap"]);
  assert.equal(routeData.features.length, 1);
  assert.deepEqual(routeData.features[0].geometry.coordinates, [[origin.lng, origin.lat], [tap.lng, tap.lat]]);

  const markup = renderToStaticMarkup(React.createElement(PremiumVectorMap, {
    points: [origin, tap],
    routes: [route],
    selectedPointId: tap.id,
    chrome: "minimal",
    density: "route",
    externalTiles: true,
  }));

  assert.match(markup, /data-nexid-external-tiles="enabled"/);
  assert.match(markup, /2 puntos geográficos, 1 relaciones reportadas/);
  assert.match(markup, />Tap reportado</);
});

test("real consumer mode accepts only an explicitly consented browser observation", () => {
  const consented = {
    ...tap,
    locationSource: "browser_geolocation_approximate_consent",
    locationAccuracyM: 150,
  };
  const markup = renderToStaticMarkup(React.createElement(PremiumVectorMap, {
    points: [origin, consented],
    routes: [route],
    chrome: "consumer",
    externalTiles: false,
  }));

  assert.match(markup, /data-consumer-location="consented-approximate"/);
  assert.match(markup, /data-consumer-location-source="browser_geolocation_approximate_consent"/);
  assert.match(markup, /data-nexid-map-source="nexid-local-coordinate-grid"/);
  assert.match(markup, /Un punto aproximado compartido por este dispositivo/);
  assert.doesNotMatch(markup, /1 relaciones reportadas/);
});
