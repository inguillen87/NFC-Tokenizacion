import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [heroStage, globalCss] = await Promise.all([
  readFile(new URL("../src/app/sun/sun-product-hero-stage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);

test("SUN hero fails closed when a complete observed coordinate pair is unavailable", () => {
  assert.match(heroStage, /hasTraceCoordinates \? \([\s\S]*?<Globe3dMap/);
  assert.match(heroStage, /data-geographic-renderer="none"/);
  assert.match(heroStage, /data-location-evidence="absent"/);
  assert.match(heroStage, /Sin coordenadas observadas/);
  assert.match(heroStage, /No mostramos un mapa, una ruta ni puntos de ejemplo\./);
});

test("SUN hero never renders invented pins or distance when coordinates are absent", () => {
  assert.match(
    heroStage,
    /\{hasTraceCoordinates \? \([\s\S]*?sun-stage-pin--origin[\s\S]*?sun-stage-pin--tap[\s\S]*?sun-stage-route-label[\s\S]*?\) : null\}/,
  );
  assert.doesNotMatch(heroStage, /className="sun-stage-map"|sun-stage-map__/);
  assert.doesNotMatch(globalCss, /\.sun-stage-map(?:__|\s*\{)/);
});
