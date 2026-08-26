import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  brandHomeLink,
  home,
  publicHeader,
  pwaPrompt,
  manifest,
  premiumMap,
  realMap,
  globalMap,
  globeMap,
  realtimeMap,
] = await Promise.all([
  read("../src/components/brand-home-link.tsx"),
  read("../src/app/page.tsx"),
  read("../src/components/public-site-header.tsx"),
  read("../src/components/pwa-install-prompt.tsx"),
  read("../src/app/manifest.ts"),
  read("../../../packages/ui/src/premium-vector-map.tsx"),
  read("../../../packages/ui/src/real-geographic-map.tsx"),
  read("../../../packages/ui/src/global-ops-map.tsx"),
  read("../../../packages/ui/src/globe-3d-map.tsx"),
  read("../../../packages/ui/src/world-map-realtime.tsx"),
]);

test("brand marks use one accessible home-link contract on public surfaces", () => {
  assert.match(brandHomeLink, /href="\/"/);
  assert.match(brandHomeLink, /min-h-11 min-w-11/);
  assert.match(brandHomeLink, /data-brand-home-link/);
  assert.match(home, /<BrandHomeLink/);
  assert.match(publicHeader, /<BrandHomeLink/);
});

test("PWA defaults to a white, responsive standalone surface", () => {
  assert.match(manifest, /background_color: "#f7fbff"/);
  assert.match(manifest, /theme_color: "#ffffff"/);
  assert.match(manifest, /orientation: "any"/);
  assert.match(pwaPrompt, /min-h-11/);
  assert.match(pwaPrompt, /beforeinstallprompt/);
  assert.match(pwaPrompt, /12_000/);
  assert.match(pwaPrompt, /Math\.max\(480, window\.innerHeight \* 0\.7\)/);
  assert.match(pwaPrompt, /!engaged/);
  assert.match(pwaPrompt, /criticalJourney/);
  assert.match(pwaPrompt, /pathname === "\/sun"/);
  assert.match(pwaPrompt, /pathname\.startsWith\("\/s\/"\)/);
});

test("heat views use a stable scan scale and keep risk semantically separate", () => {
  assert.match(realMap, /Math\.log10\(safeScans\) \/ 3/);
  assert.match(realMap, /"nexid-evidence-heatmap"/);
  assert.match(realMap, /\["!=", \["get", "tone"\], "origin"\]/);
  assert.match(realMap, /Risk is deliberately excluded from this weight/);
  assert.match(realMap, /setMapWarning/);
  assert.doesNotMatch(realMap, /nexid-evidence-cluster-count/);
  assert.match(realMap, /Riesgo separado/);
  assert.match(realMap, /Calor = volumen observado/);

  assert.match(globalMap, /Intensidad de eventos reportados/);
  assert.match(globalMap, /point\.role !== "origin" && Number\(point\.scans \|\| 0\) > 0/);
  assert.match(globalMap, /El origen declarado se muestra como referencia y no suma intensidad/);

  assert.match(globeMap, /Math\.log10\(Math\.max\(1, point\.scans \|\| 1\)\) \* 5/);
  assert.match(globeMap, /point\.status !== "origin" && Number\(point\.scans \|\| 0\) > 0/);
  assert.match(globeMap, /Riesgo separado/);
  assert.doesNotMatch(globeMap, /verified tap density|real-time taps|peso comercial/);
});

test("real tap maps preserve the full observed window and expose an honest view switch", () => {
  assert.match(globalMap, /mode === "demo" \|\| chrome === "compact" \? "all" : "24h"/);
  assert.match(globalMap, /initialView\?: MapView/);
  assert.match(globalMap, /allowViewToggle\?: boolean/);
  assert.match(globalMap, /sourceLabel\?: string/);
  assert.match(globalMap, /locationNote\?: string/);
  assert.match(globalMap, /ubicaciones observadas/);
  assert.match(globalMap, /volumen sin mezclarlo con riesgo/);
  assert.match(premiumMap, /return <RealGeographicMap \{\.\.\.props\} \/>/);
  assert.doesNotMatch(premiumMap, /LegacyPremiumVectorMap|<svg/);
  assert.match(realMap, /data-nexid-map="maplibre-gl"/);
  assert.match(realMap, /canvas\.setAttribute\("aria-label"/);
  assert.match(realMap, /canvas\.setAttribute\("aria-describedby"/);
  assert.match(realMap, /new maplibre\.NavigationControl/);
  assert.match(realMap, /type: "geojson"/);
});

test("geographic surfaces keep a single reachable MapLibre renderer", () => {
  assert.match(globalMap, /<PremiumVectorMap/);
  assert.doesNotMatch(globalMap, /mapContainerRef|mapRef|global-ops-fallback|<svg/);
  assert.match(globeMap, /<MapLibreGlobeFallback/);
  assert.doesNotMatch(globeMap, /LegacyGlobeFallbackVisual/);
  assert.doesNotMatch(premiumMap, /LegacyPremiumVectorMap|data-nexid-map="premium-vector-map"/);
});

test("the reachable operations map opens in heat view with touch-safe controls", () => {
  assert.match(realtimeMap, /useState<MapMode>\("classic"\)/);
  assert.match(realtimeMap, /Mapa de calor de lecturas reportadas/);
  assert.match(realtimeMap, /min-h-11/);
  assert.match(realtimeMap, /aria-pressed/);
  assert.match(realtimeMap, /no prueba recorridos físicos/);
});
