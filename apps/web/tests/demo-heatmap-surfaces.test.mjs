import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const demoLabUrl = new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url);
const liveDemoUrl = new URL("../src/components/live-demo-surfaces.tsx", import.meta.url);
const liveDemoPollingUrl = new URL("../src/components/live-demo-polling.ts", import.meta.url);
const demoPageUrl = new URL("../src/app/demo/page.tsx", import.meta.url);
const mobileDemoUrl = new URL("../src/components/mobile-demo-client.tsx", import.meta.url);
const sdkUrl = new URL("../src/app/sdk/page.tsx", import.meta.url);
const investorUrl = new URL("../src/app/investor-snapshot/investor-snapshot-client.tsx", import.meta.url);
const heroSceneUrl = new URL("../src/components/hero-scene.tsx", import.meta.url);
const cssUrl = new URL("../src/app/globals.css", import.meta.url);
const sharedMapUrl = new URL("../../../packages/ui/src/real-geographic-map.tsx", import.meta.url);
const trustMapSourceUrl = new URL("../../../packages/ui/src/trust-map-source.ts", import.meta.url);
const webPackageUrl = new URL("../package.json", import.meta.url);

test("Demo Lab separates API heat intensity from simulated relationships", async () => {
  const source = await readFile(demoLabUrl, "utf8");

  assert.match(source, /type DemoMapViewMode = "heat" \| "relations"/);
  assert.match(source, /const DemoPremiumVectorMap = dynamic\(/);
  assert.match(source, /import\("@product\/ui\/premium-vector-map"\)/);
  assert.match(source, /ssr: false/);
  assert.match(source, /feedTruthState === "recorded_events" \|\| feedTruthState === "public_evidence"/);
  assert.match(source, /feedBacked \? aggregateDemoHeatPoints\(heatSourcePoints\) : \[\]/);
  assert.match(source, /function toDemoApiHeatPoints\(events: DemoEvent\[]/);
  assert.match(source, /function demoCoordinateEvidence\(event: DemoEvent/);
  assert.match(source, /Approximate city centroid/);
  assert.match(source, /Fuente de ubicación no informada/);
  assert.match(source, /if \(!\(reportedScans > 0\)\) return/);
  assert.match(source, /point\.id === "origin"/);
  assert.match(source, /No fabricamos zonas de calor/);
  assert.match(source, /density="heat"/);
  assert.match(source, /data-demo-map-truth=\{feedTruthState\}/);
  assert.match(source, /HeroTrustNetworkDiagram/);
  assert.doesNotMatch(source, /HeroTrustAtlasSvg/);
  assert.equal((source.match(/<DemoMapViewport/g) || []).length, 2);
});

test("public demo groups only geolocated API events and leaves an honest empty state", async () => {
  const [source, page] = await Promise.all([
    readFile(liveDemoUrl, "utf8"),
    readFile(demoPageUrl, "utf8"),
  ]);

  assert.match(source, /useState<LiveEvent\[]>\(\[\]\)/);
  assert.match(source, /filter\(\(item\) => Number\.isFinite\(item\.lat\) && Number\.isFinite\(item\.lng\)\)/);
  assert.match(source, /data-demo-api-source=\{feedMetadata\.source\}/);
  assert.match(source, /data-demo-location-precision=\{feedMetadata\.locationPrecision\}/);
  assert.match(source, /data-demo-api-stale=\{loadState === "error" && hasValidSnapshot \? "true" : "false"\}/);
  assert.match(source, /No se generan puntos ni zonas de calor artificiales/);
  assert.match(source, /data-demo-api-points=\{points\.length\}/);
  assert.match(source, /data-map-truth=\{points\.length \? "demo-api-recorded-events" : "empty-demo-api-feed"\}/);
  assert.match(source, /<Card className="demo-live-map-empty" role="status"/);
  assert.match(page, /<LiveDemoSurfaces locale=\{locale\} \/>/);
});

test("public demo polling backs off, pauses when hidden, and preserves the last valid response", async () => {
  const source = await readFile(liveDemoUrl, "utf8");

  assert.match(source, /schedulePoll\(LIVE_DEMO_SUCCESS_POLL_MS\)/);
  assert.match(source, /schedulePoll\(liveDemoRetryDelay\(consecutiveFailures\)\)/);
  assert.match(source, /if \(disposed \|\| document\.hidden \|\| requestInFlight\) return/);
  assert.match(source, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(source, /document\.removeEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(source, /activeController\?\.abort\(\)/);
  assert.match(source, /if \(!response\.ok\) throw new Error/);
  assert.match(source, /if \(!hasLiveDemoItems\(data\)\) throw new Error/);
  assert.match(source, /setItems\(data\.items as LiveEvent\[\]\)/);
  assert.match(source, /setHasValidSnapshot\(true\)/);
  assert.match(source, /hasValidSnapshot \? items\.length : "—"/);
  assert.match(source, /hasValidSnapshot \? riskSignals : "—"/);
  assert.doesNotMatch(source, /setInterval\(/);
  assert.doesNotMatch(source, /setItems\(\[\]\)/);
  assert.doesNotMatch(source, /Array\.isArray\(data\.items\) \? data\.items : \[\]/);
});

test("public demo retry policy uses a bounded 30-to-60-second error backoff", async () => {
  const polling = await import(liveDemoPollingUrl.href);

  assert.equal(polling.LIVE_DEMO_SUCCESS_POLL_MS, 4_000);
  assert.equal(polling.LIVE_DEMO_REQUEST_TIMEOUT_MS, 10_000);
  assert.equal(polling.liveDemoRetryDelay(1), 30_000);
  assert.equal(polling.liveDemoRetryDelay(2), 60_000);
  assert.equal(polling.liveDemoRetryDelay(8), 60_000);
  assert.equal(polling.liveDemoRetryDelay(Number.NaN), 30_000);
  assert.equal(polling.hasLiveDemoItems({ items: [] }), true);
  assert.equal(polling.hasLiveDemoItems({ items: null }), false);
  assert.equal(polling.hasLiveDemoItems(null), false);
});

test("mobile demo discloses scope and SDK uses a non-geographic process diagram", async () => {
  const [mobile, sdk, investor, heroScene] = await Promise.all([
    readFile(mobileDemoUrl, "utf8"),
    readFile(sdkUrl, "utf8"),
    readFile(investorUrl, "utf8"),
    readFile(heroSceneUrl, "utf8"),
  ]);

  assert.match(mobile, /data-mobile-demo-map-truth=/);
  assert.match(mobile, /Sin telemetría productiva/);
  assert.match(mobile, /no genera un mapa de calor productivo/);
  assert.doesNotMatch(mobile, /pending-location|illustrativeOrigin\.lat \+ 7|illustrativeOrigin\.lng \+ 16/);
  assert.match(sdk, /data-diagram-truth="simulated-sdk-flow"/);
  assert.match(sdk, /data-geographic="false"/);
  assert.match(sdk, /Escenario SDK ilustrativo/);
  assert.match(sdk, /Diagrama no geográfico: sin coordenadas, telemetría productiva ni recorrido físico/);
  assert.match(investor, /Diagrama conceptual no geográfico para inversores/);
  assert.match(investor, /sin inventar ubicaciones, recorridos ni evidencia física/);
  assert.match(heroScene, /data-nexid-diagram="trust-signal-flow"/);
  assert.match(heroScene, /data-geographic="false"/);
  assert.match(heroScene, /Sin mapa, coordenadas, rutas terrestres ni telemetría/);
  assert.doesNotMatch(`${sdk}\n${investor}\n${heroScene}`, /HeroTrustAtlasSvg|LegacyHeroTrustAtlasSvg|data-map-truth="simulated-sdk-scenario"/);
  assert.doesNotMatch(heroScene, /WORLD_ATLAS_PATHS|data-nexid-map="hero-trust-atlas"/);
  assert.doesNotMatch(sdk, /Infraestructura viva|ruta operativa/);
});

test("demo heatmap controls are touch-safe and white-mode aware", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /\.demo-map-viewport__switch button\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.demo-map-viewport__empty button\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /html:is\(\.theme-light, \[data-theme="light"\]\) \.demo-map-viewport/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.demo-map-viewport__switch\s*\{[\s\S]*?width:\s*100%;/);
  assert.match(css, /html:is\(\.theme-light, \[data-theme="light"\]\) \.mobile-demo-map-card/);
  assert.match(css, /\.nexid-real-map \.maplibregl-ctrl-group button,[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.nexid-real-map \.maplibregl-canvas:focus-visible/);
});

test("shared MapLibre map resolves white-first before boot and exposes its interactive canvas", async () => {
  const [source, webPackageSource] = await Promise.all([
    readFile(sharedMapUrl, "utf8"),
    readFile(webPackageUrl, "utf8"),
  ]);
  const webPackage = JSON.parse(webPackageSource);

  assert.match(source, /type MapTheme = "light" \| "dark"/);
  assert.match(source, /const \[mapTheme, setMapTheme\] = useState<MapTheme \| null>\(null\)/);
  assert.match(source, /if \(mapTheme === null\) return/);
  assert.match(source, /function resolveDocumentMapTheme[\s\S]*?return "light";/);
  assert.doesNotMatch(source, /ref=\{containerRef\}[^>]*aria-hidden/);
  assert.match(source, /const canvas = map\.getCanvas\(\)/);
  assert.match(source, /canvas\.setAttribute\("aria-label", mapCanvasLabel\)/);
  assert.match(source, /canvas\.setAttribute\("aria-describedby", summaryId\)/);
  assert.equal(webPackage.dependencies["maplibre-gl"], "^5.24.0");
});

test("shared maps use no-key OpenFreeMap vector styles and reject key-required providers", async () => {
  const [source, mapSource] = await Promise.all([
    readFile(sharedMapUrl, "utf8"),
    readFile(trustMapSourceUrl, "utf8"),
  ]);

  assert.match(mapSource, /https:\/\/tiles\.openfreemap\.org\/styles\/positron/);
  assert.match(mapSource, /https:\/\/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(mapSource, /OpenFreeMap © OpenMapTiles · Data from OpenStreetMap/);
  assert.match(mapSource, /normalizeNoKeyMapStyleUrl/);
  assert.match(mapSource, /normalizeNoKeyRasterTileTemplate/);
  assert.match(mapSource, /KEY_REQUIRED_HOST_PATTERN/);
  assert.doesNotMatch(`${source}\n${mapSource}`, /dark_all|light_all|voyager_nolabels|basemaps\.cartocdn\.com|tile\.openstreetmap\.org/);
  assert.match(source, /raster-brightness-max/);
});
