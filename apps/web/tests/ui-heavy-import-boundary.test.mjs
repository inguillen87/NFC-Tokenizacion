import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../../../", import.meta.url);
const uiPackageUrl = new URL("packages/ui/package.json", repoRoot);
const uiIndexUrl = new URL("packages/ui/src/index.ts", repoRoot);

const heavyModules = [
  "globe-3d-map",
  "global-ops-map",
  "premium-vector-map",
  "world-map-realtime",
  "world-map-placeholder",
  "trust-map-source",
];

const runtimeConsumers = [
  "apps/web/src/components/radar-section.tsx",
  "apps/web/src/components/live-demo-surfaces.tsx",
  "apps/web/src/components/mobile-demo-client.tsx",
  "apps/web/src/app/sun/sun-product-hero-stage.tsx",
  "apps/web/src/app/sun/page.tsx",
  "apps/dashboard/src/components/analytics-panels.tsx",
  "apps/dashboard/src/components/demo-ops-map.tsx",
  "apps/dashboard/src/components/real-ops-map.tsx",
  "apps/dashboard/src/components/multirubro-ops-panel.tsx",
];

test("heavy map modules are explicit UI subpath exports", async () => {
  const packageJson = JSON.parse(await readFile(uiPackageUrl, "utf8"));

  for (const moduleName of heavyModules) {
    assert.equal(
      packageJson.exports[`./${moduleName}`],
      `./src/${moduleName}.${moduleName === "trust-map-source" ? "ts" : "tsx"}`,
      `@product/ui/${moduleName} must resolve without evaluating the root barrel`,
    );
  }
});

test("the root UI barrel exposes heavy-module types but no heavy runtime", async () => {
  const source = await readFile(uiIndexUrl, "utf8");

  for (const moduleName of heavyModules) {
    assert.doesNotMatch(source, new RegExp(`export \\* from ["']\\./${moduleName}["']`));
  }

  assert.match(source, /export type \{ GlobePoint, GlobeRoute \} from "\.\/globe-3d-map"/);
  assert.match(source, /export type \{ GlobalOpsPoint, GlobalOpsRoute \} from "\.\/global-ops-map"/);
  assert.match(source, /VectorMapPoint[\s\S]*from "\.\/premium-vector-map"/);
  assert.match(source, /TrustMapSourceConfig[\s\S]*from "\.\/trust-map-source"/);
});

test("map runtime consumers use granular UI imports", async () => {
  for (const relativePath of runtimeConsumers) {
    const source = await readFile(new URL(relativePath, repoRoot), "utf8");
    const rootImports = source.match(/import[\s\S]*?from ["']@product\/ui["'];?/g) || [];

    for (const rootImport of rootImports) {
      assert.doesNotMatch(
        rootImport,
        /Globe3dMap|GlobalOpsMap|PremiumVectorMap|WorldMapRealtime|WorldMapPlaceholder|resolveTrustMapSource|formatTrustTileUrl/,
        `${relativePath} imports heavy runtime through @product/ui`,
      );
    }

    assert.doesNotMatch(source, /import\(["']@product\/ui["']\)/, `${relativePath} dynamically imports the root UI barrel`);
  }
});
