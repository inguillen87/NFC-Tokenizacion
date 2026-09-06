import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";

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
  assert.match(map, /style: mapStyleForTheme\(isLightTheme\(\)\)/);
  assert.match(map, /data-basemap="configured-raster"/);
  assert.match(map, /data-basemap-state=\{isDegraded && loadState === "ready" \? "degraded" : loadState\}/);
  assert.doesNotMatch(locationExperience, /externalTiles=\{showRoute\}/);
  assert.doesNotMatch(map, /localCoordinateStyle|data-external-tiles/);
});

test("real taps never draw an inferred route while demo connection is explicit", () => {
  assert.match(page, /showRoute=\{isDemoPreview\}/);
  assert.match(map, /const showDemoConnection = Boolean\(showRoute && origin && tap\?\.source === "demo"\)/);
  assert.match(map, /if \(showDemoConnection && origin && tap && !map\.getSource\("sun-demo-connection"\)\)/);
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
  assert.doesNotMatch(map, /map\.on\("style\.load", \(\) => \{[\s\S]{0,180}markReady\(\)/);
  assert.match(map, /if \(!isConsentedBrowserLocation\) return 0/);
  assert.match(map, /point\.source === "ip_geo"/);
  assert.match(map, /"Popup.Close": "Cerrar"/);
  assert.match(map, /Red \/ IP · aproximada/);
  assert.match(map, /No es GPS del teléfono ni una ubicación exacta/);
  assert.match(map, /Cómo se obtuvo esta ubicación/);
  assert.match(map, /No calculamos una distancia para el usuario porque la ubicación de red es demasiado amplia/);
  assert.match(map, /Navegador · aproximada/);
  assert.match(map, /Fuente heredada · no confirmada/);
  assert.match(map, /Demo simulado/);
  assert.match(map, /data-location-source=\{tapPresentation\.kind\}/);
  assert.doesNotMatch(map, /GPS · con permiso/);
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

test("map legends, fallback and native controls follow both themes with visible keyboard focus", () => {
  assert.match(css, /^\.shell\s*\{[^}]*--map-ui-bg: #102338;[^}]*--map-ui-ink: #f1f7fc;/);
  assert.match(css, /:global\(html\.theme-light\) \.shell\s*\{[^}]*--map-ui-bg: #ffffff;[^}]*--map-ui-ink: #163048;/);
  for (const selector of [".loading,", ".legendItem,", ".popup {", ".map :global(.maplibregl-ctrl-group) {", ".map :global(.maplibregl-popup-content) {"]) {
    const block = css.slice(css.indexOf(selector)).split("}", 1)[0];
    assert.ok(block.includes("var(--map-ui-"), `${selector} must use the theme palette`);
  }
  assert.match(css, /maplibregl-ctrl-group button:focus-visible/);
  assert.match(css, /maplibregl-popup-close-button:focus-visible/);
  assert.match(css, /\.fitButton\s*\{[^}]*color: #ffffff;[^}]*background: #0e7490;/);
  assert.match(css, /maplibregl-popup-content\)\s*\{[^}]*padding: 0\.85rem 2\.75rem 0\.85rem 1rem;/);
});

test("dark SUN raster is a valid inverted charcoal basemap with readable light labels", () => {
  const paints = map.match(/paint: light\s*\?\s*(\{[^}]+\})\s*:\s*(\{[^}]+\})/);
  assert.ok(paints, "both raster theme paints must remain explicit");
  const parsePaint = (source) => JSON.parse(source.replace(/,\s*}/g, "}"));
  const light = parsePaint(paints[1]);
  const dark = parsePaint(paints[2]);
  for (const paint of [light, dark]) {
    const errors = validateStyleMin({
      version: 8,
      sources: { raster: { type: "raster", tiles: ["https://example.invalid/{z}/{x}/{y}.png"], tileSize: 256 } },
      layers: [{ id: "raster", type: "raster", source: "raster", paint }],
    });
    assert.deepEqual(errors, [], "the installed MapLibre specification must accept the paint");
  }
  assert.deepEqual(light, { "raster-saturation": -0.12, "raster-contrast": 0.04 });
  assert.ok(dark["raster-brightness-min"] > dark["raster-brightness-max"], "dimming alone is not dark cartography");
  assert.equal(dark["raster-saturation"], -1, "charcoal avoids inverted land/water hues");

  // Evaluate MapLibre's raster shader for representative light land/dark ink.
  // This catches a return to dimming, while browser QA covers real tile labels.
  const sample = (input) => {
    const contrast = dark["raster-contrast"];
    const factor = contrast > 0 ? 1 / (1 - contrast) : 1 + contrast;
    const channel = (input - 0.5) * factor + 0.5;
    return Math.max(0, Math.min(1, dark["raster-brightness-min"]
      + (dark["raster-brightness-max"] - dark["raster-brightness-min"]) * channel));
  };
  const land = sample(0.93);
  const label = sample(0.25);
  const luminance = (value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  assert.ok(land < 0.2, "light source land must become charcoal");
  assert.ok(label > 0.7, "dark source labels must become light");
  assert.ok((luminance(label) + 0.05) / (luminance(land) + 0.05) >= 4.5);
  assert.doesNotMatch(css, /canvas[^}]*filter\s*:/);
});

test("map markers are semantic and a single origin cannot look like an event count", () => {
  assert.match(map, /markerCode\.textContent = kind === "origin" \? "O" : "T"/);
  assert.match(map, /const locationCode = kind === "origin" \? "O" : "T"/);
  assert.match(map, /Solo origen · lectura sin coordenadas/);
  assert.doesNotMatch(map, /String\(index \+ 1\)/);
  assert.doesNotMatch(map, /renderLocation\("origin", origin, 1\)/);
  assert.match(css, /\.missingTapBadge/);
  assert.match(map, /points\.length > 1[\s\S]*?Ver ambos puntos<\/button> : null/);
  assert.doesNotMatch(map, />Reencuadrar</);
  assert.match(map, /origin && tap[\s\S]*?origen declarado y la zona informada[\s\S]*?origen declarado; esta lectura no informó coordenadas/);
  assert.match(map, /aria-label=\{mapAriaLabel\}/);
});

test("origin label comes from the same declared profile as its coordinates", () => {
  const originStart = page.indexOf("const wineryPoint = resolvedOriginCoords");
  const originEnd = page.indexOf("const hasCurrentTapCoords", originStart);
  const originProjection = page.slice(originStart, originEnd);
  assert.match(originProjection, /result\.iot\?\.wineryLocation/);
  assert.doesNotMatch(originProjection, /firstVerified\?\.country|country: "AR"/);
});
