import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [page, locationExperience, map, css, layout] = await Promise.all([
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-location-experience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-passport-map.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-passport-map.module.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/layout.tsx", import.meta.url), "utf8"),
]);

test("SUN uses a real lazy-loaded MapLibre map and keeps the landing map untouched", () => {
  assert.match(page, /import \{ SunLocationExperience \} from "\.\/sun-location-experience"/);
  assert.match(page, /<SunLocationExperience/);
  assert.match(locationExperience, /import \{ SunPassportMap/);
  assert.match(locationExperience, /<SunPassportMap/);
  assert.doesNotMatch(page, /<GlobalOpsMap/);
  assert.match(map, /await import\("maplibre-gl"\)/);
  assert.match(map, /IntersectionObserver/);
  assert.match(map, /new maplibre\.Map/);
  assert.match(map, /fitBounds/);
});

test("real taps never draw an inferred route while demo connection is explicit", () => {
  assert.match(page, /showRoute=\{isDemoPreview\}/);
  assert.match(map, /if \(showRoute && origin && tap && !map\.getSource\("sun-demo-connection"\)\)/);
  assert.match(map, /properties: \{ kind: "demo_only" \}/);
  assert.match(map, /Demo: la línea punteada conecta dos puntos simulados/);
  assert.match(map, /no representa un recorrido físico/);
});

test("map exposes source, uncertainty, useful fallback and safe popups", () => {
  assert.match(map, /accuracyPolygon\(tap\)/);
  assert.match(map, /publicCoordinateUncertaintyM/);
  assert.match(page, /punto público redondeado \(incertidumbre mínima/);
  assert.match(map, /sun-tap-accuracy-fill/);
  assert.match(map, /setDOMContent\(popupContent/);
  assert.doesNotMatch(map, /setHTML\(/);
  assert.match(map, /La cartografía no pudo cargarse/);
  assert.match(map, /No hay ubicaciones reportadas/);
  assert.match(map, /Reintentar mapa/);
  assert.match(map, /OpenStreetMap/);
  assert.match(map, /FALLBACK_WORLD_STREET_MAP_TEMPLATE = "https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Street_Map/);
  assert.match(map, /FALLBACK_WORLD_STREET_MAP_ATTRIBUTION = "Esri World Street Map \/ OpenStreetMap contributors"/);
  assert.doesNotMatch(map, /light_all/);
  assert.doesNotMatch(map, /tile\.openstreetmap\.org|tiles\.openfreemap\.org/);
  assert.match(map, /map\.on\("style\.load"[\s\S]*?markReady\(\)/);
  assert.match(map, /setIsDegraded\(true\)/);
  assert.match(map, /styles\.degradedBadge/);
  assert.match(css, /\.degradedBadge/);
  assert.match(layout, /referrer: "no-referrer"/);
  assert.match(map, /scrollZoom: false/);
  assert.match(map, /disableRotation\(\)/);
  assert.match(map, /map\.on\("error"/);
  assert.match(map, /map\.on\("styleimagemissing"/);
  assert.match(map, /map\.areTilesLoaded\(\)/);
  assert.match(map, /resolveTrustMapSource/);
  assert.match(map, /if \(!isConsentedGps\) return 0/);
  assert.match(map, /point\.source === "ip_geo"/);
  assert.match(map, /"Popup.Close": "Cerrar"/);
  assert.match(map, /Red \/ IP · aproximada/);
  assert.match(map, /No es GPS del teléfono ni una ubicación exacta/);
  assert.match(map, /Cómo se obtuvo esta ubicación/);
  assert.match(map, /No calculamos una distancia para el usuario porque la ubicación de red es demasiado amplia/);
  assert.doesNotMatch(map, /className="contents"/);
});

test("map has mobile-sized canvas, desktop expansion and 44px controls", () => {
  assert.match(css, /\.mapFrame[\s\S]*?min-height: 15\.5rem/);
  assert.match(css, /\.map[\s\S]*?height: 15\.5rem/);
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?height: 23rem/);
  assert.match(css, /\.fitButton[\s\S]*?min-height: 2\.75rem/);
  assert.match(css, /\.externalLink[\s\S]*?min-height: 2\.75rem/);
  assert.match(css, /maplibregl-ctrl-group button[\s\S]*?width: 2\.75rem;[\s\S]*?height: 2\.75rem/);
  assert.match(css, /prefers-reduced-motion/);
});

test("origin label comes from the same declared profile as its coordinates", () => {
  const originStart = page.indexOf("const wineryPoint = resolvedOriginCoords");
  const originEnd = page.indexOf("const hasCurrentTapCoords", originStart);
  const originProjection = page.slice(originStart, originEnd);
  assert.match(originProjection, /result\.iot\?\.wineryLocation/);
  assert.doesNotMatch(originProjection, /firstVerified\?\.country|country: "AR"/);
});
