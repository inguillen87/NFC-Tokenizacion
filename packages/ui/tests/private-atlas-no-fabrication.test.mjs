import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PremiumVectorMap } from "../src/premium-vector-map.tsx";

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

test("private atlas does not manufacture a tap node or route for real data with routes=[]", () => {
  const markup = renderToStaticMarkup(React.createElement(PremiumVectorMap, {
    points: [origin],
    routes: [],
    selectedPointId: origin.id,
    chrome: "enterprise-atlas",
  }));

  assert.match(markup, /data-nexid-atlas-origin="reported"/);
  assert.doesNotMatch(markup, /data-nexid-atlas-tap=/);
  assert.doesNotMatch(markup, /data-nexid-atlas-route=/);
  assert.doesNotMatch(markup, />EVENTO REPORTADO</);
  assert.match(markup, />Sin relación configurada</);
});

test("private atlas retains explicitly supplied demo tap and route evidence", () => {
  const markup = renderToStaticMarkup(React.createElement(PremiumVectorMap, {
    points: [origin, tap],
    routes: [route],
    selectedPointId: tap.id,
    chrome: "enterprise-atlas",
  }));

  assert.match(markup, /data-nexid-atlas-origin="reported"/);
  assert.match(markup, /data-nexid-atlas-tap="reported"/);
  assert.match(markup, /data-nexid-atlas-route="reported"/);
  assert.match(markup, />Tap reportado</);
});

test("SUN route map bounds tile requests and labels only the two consumer endpoints", () => {
  const markup = renderToStaticMarkup(React.createElement(PremiumVectorMap, {
    points: [origin, tap],
    routes: [route],
    selectedPointId: tap.id,
    chrome: "minimal",
    density: "route",
    alwaysLabelEndpoints: true,
    mapSource: {
      rasterTileTemplate: "https://tiles.example/{z}/{x}/{y}.png",
    },
  }));

  const tiles = markup.match(/https:\/\/tiles\.example\/4\/\d+\/\d+\.png/g) || [];
  assert.ok(tiles.length > 0, "expected public route tiles at z4");
  assert.ok(tiles.length <= 36, `expected at most 36 fitted tiles, received ${tiles.length}`);
  assert.match(markup, />Origen</);
  assert.match(markup, />Tap</);
});
