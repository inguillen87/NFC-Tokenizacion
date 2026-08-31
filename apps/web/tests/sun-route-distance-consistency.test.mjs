import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  fmtDistance,
  haversineKm,
  selectCanonicalSunMapRoutes,
} from "../src/app/sun/sun-route-distance.ts";

test("SUN demo uses one canonical Bodega Balmec to Buenos Aires distance", () => {
  const origin = { lat: -33.2095, lng: -69.1211 };
  const buenosAires = { lat: -34.6037, lng: -58.3816 };
  const santiago = { lat: -33.4489, lng: -70.6693 };
  const canonicalRoute = {
    fromLat: origin.lat,
    fromLng: origin.lng,
    toLat: buenosAires.lat,
    toLng: buenosAires.lng,
    label: "Origen del producto -> tap actual",
  };
  const intermediateRoutes = [{
    fromLat: origin.lat,
    fromLng: origin.lng,
    toLat: santiago.lat,
    toLng: santiago.lng,
    label: "Origen -> primer evento",
  }];

  const canonicalDistance = haversineKm(
    canonicalRoute.fromLat,
    canonicalRoute.fromLng,
    canonicalRoute.toLat,
    canonicalRoute.toLng,
  );
  const intermediateDistance = haversineKm(origin.lat, origin.lng, santiago.lat, santiago.lng);

  assert.equal(fmtDistance(canonicalDistance), "1.003 km");
  assert.equal(fmtDistance(intermediateDistance), "146 km");
  assert.deepEqual(selectCanonicalSunMapRoutes(canonicalRoute, intermediateRoutes), [canonicalRoute]);
});

test("SUN page feeds the map the same origin-to-current-tap distance as its summary", async () => {
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const originToTapDistance = wineryPoint\.length && currentTapPoint\.length/);
  assert.match(page, /const distanceDisplay = fmtDistance\(originToTapDistance\)/);
  assert.match(page, /distanceLabel=\{distanceDisplay\}/);
  assert.match(page, /showRoute=\{isDemoPreview\}/);
  assert.doesNotMatch(page, /const opsMapRoutes/);
});
