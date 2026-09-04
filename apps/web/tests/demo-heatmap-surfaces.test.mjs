import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const demoLabUrl = new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url);
const liveDemoUrl = new URL("../src/components/live-demo-surfaces.tsx", import.meta.url);
const liveDemoFeedUrl = new URL("../src/components/live-demo-feed.ts", import.meta.url);
const demoPageUrl = new URL("../src/app/demo/page.tsx", import.meta.url);
const mobileDemoUrl = new URL("../src/components/mobile-demo-client.tsx", import.meta.url);
const mobileDemoPageUrl = new URL("../src/app/(public)/demo-lab/mobile/[tenant]/[itemId]/page.tsx", import.meta.url);
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

test("public demo uses user-driven refresh without periodic data polling", async () => {
  const source = await readFile(liveDemoUrl, "utf8");

  assert.match(source, /const \[refreshRequest, setRefreshRequest\] = useState\(0\)/);
  assert.match(source, /if \(disposed \|\| document\.hidden \|\| requestInFlight\) return/);
  assert.match(source, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(source, /document\.removeEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(source, /activeController\?\.abort\(\)/);
  assert.match(source, /onClick=\{\(\) => setRefreshRequest\(\(request\) => request \+ 1\)\}/);
  assert.match(source, /\}, \[refreshRequest\]\)/);
  assert.match(source, /if \(!response\.ok\) throw new Error/);
  assert.match(source, /if \(!hasLiveDemoItems\(data\)\) throw new Error/);
  assert.match(source, /setItems\(data\.items as LiveEvent\[\]\)/);
  assert.match(source, /setHasValidSnapshot\(true\)/);
  assert.match(source, /hasValidSnapshot \? items\.length : "—"/);
  assert.match(source, /hasValidSnapshot \? riskSignals : "—"/);
  assert.doesNotMatch(source, /setInterval\(/);
  assert.doesNotMatch(source, /schedulePoll|liveDemoRetryDelay|SUCCESS_POLL/);
  assert.doesNotMatch(source, /setItems\(\[\]\)/);
  assert.doesNotMatch(source, /Array\.isArray\(data\.items\) \? data\.items : \[\]/);
});

test("public demo feed validates snapshots and bounds each on-demand request", async () => {
  const feed = await import(liveDemoFeedUrl.href);

  assert.equal(feed.LIVE_DEMO_REQUEST_TIMEOUT_MS, 10_000);
  assert.equal(feed.hasLiveDemoItems({ items: [] }), true);
  assert.equal(feed.hasLiveDemoItems({ items: null }), false);
  assert.equal(feed.hasLiveDemoItems(null), false);
});

test("Demo Lab refreshes data on mount, visibility, manual action and post-mutation only", async () => {
  const source = await readFile(demoLabUrl, "utf8");
  const summaryRefreshEffect = source.slice(
    source.indexOf("let alive = true;"),
    source.indexOf("if (!running) return;"),
  );
  const crmDashboard = source.slice(source.indexOf("function DemoCrmDashboard"));

  assert.match(summaryRefreshEffect, /loadWhenVisible\(\)/);
  assert.match(summaryRefreshEffect, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.doesNotMatch(summaryRefreshEffect, /setInterval|setTimeout/);
  assert.match(source, /await refreshSummary\(\);[\s\S]*return true/);
  assert.match(crmDashboard, /onClick=\{\(\) => void refreshSummary\(\)\}/);
  assert.match(crmDashboard, /data-demo-refresh-mode="event-driven"/);
  assert.doesNotMatch(crmDashboard, /setInterval|Auto-refresh \(10s\)|autoRefresh/);
  assert.match(source, /window\.setInterval\(\(\) => setBeat/);
});

test("mobile demo discloses scope and SDK uses a non-geographic process diagram", async () => {
  const [mobile, mobilePage, sdk, investor, heroScene] = await Promise.all([
    readFile(mobileDemoUrl, "utf8"),
    readFile(mobileDemoPageUrl, "utf8"),
    readFile(sdkUrl, "utf8"),
    readFile(investorUrl, "utf8"),
    readFile(heroSceneUrl, "utf8"),
  ]);

  assert.match(mobile, /data-mobile-demo-map-truth=/);
  assert.match(mobile, /Sin telemetría productiva/);
  assert.match(mobile, /no genera un mapa de calor productivo/);
  assert.equal((mobile.match(/setInterval/g) || []).length, 1);
  assert.match(mobile, /setScanProgress\(\(value\) => \(value >= 92 \? value : value \+ 14\)\)/);
  assert.doesNotMatch(mobile, /setInterval[\s\S]{0,500}fetch\(/);
  assert.doesNotMatch(mobilePage, /setInterval|setTimeout|fetch\(/);
  assert.match(mobilePage, /await loadPackSeed\(pack, itemId\)/);
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
  assert.doesNotMatch(source, /dark_all|light_all|voyager_nolabels|basemaps\.cartocdn\.com|tile\.openstreetmap\.org/);
  assert.match(mapSource, /replaceLegacyRaster/);
  assert.match(mapSource, /return value\.includes\(LEGACY_LOW_FIDELITY_RASTER_TEMPLATE\) \|\| isLegacyAnonymousCarto[\s\S]*?DEFAULT_PUBLIC_RASTER_TEMPLATE/);
  assert.match(source, /raster-brightness-max/);
});
