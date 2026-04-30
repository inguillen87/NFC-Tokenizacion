import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "../..");

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

test("demo corpus docs document canonical batch and tenant", () => {
  const doc = read("docs/DEMO_FLAGSHIP.md");
  assert.match(doc, /DEMO-2026-02/);
  assert.match(doc.toLowerCase(), /demobodega/);
});

test("canonical demo manifest has deterministic 10 tags", () => {
  const manifest = read("apps/api/prisma/demo/demobodega_manifest.csv").trim().split(/\r?\n/);
  assert.equal(manifest.length, 11, "manifest should have header + 10 tags");
  assert.match(manifest[1], /^DEMO-2026-02,/);
});

test("required cross-vertical demo products are present in seed corpus", () => {
  const seed = JSON.parse(read("apps/api/prisma/demo/demobodega_seed.json"));
  const productNames = new Set((seed.products || []).map((item) => String(item.productName || "")));
  assert.equal(productNames.has("Reserva Malbec 2022"), true);
  assert.equal(productNames.has("Dermaluxe Serum C"), true);
  assert.equal(productNames.has("Night Repair Cream"), true);
  assert.equal(productNames.has("VIP Festival Pass"), true);
});

test("root and api scripts expose demo seed/reset/emit commands", () => {
  const rootPkg = JSON.parse(read("package.json"));
  const apiPkg = JSON.parse(read("apps/api/package.json"));

  assert.ok(rootPkg.scripts["demo:seed"]);
  assert.ok(rootPkg.scripts["demo:reset"]);
  assert.ok(rootPkg.scripts["demo:emit-taps"]);

  assert.ok(apiPkg.scripts["demo:seed"]);
  assert.ok(apiPkg.scripts["demo:reset"]);
  assert.ok(apiPkg.scripts["demo:emit-taps"]);
});

test("demo writer scripts are explicitly guarded for demo mode and production safety", () => {
  const seedScript = read("apps/api/scripts/demo-demobodega.mjs");
  const resetScript = read("apps/api/scripts/demo-reset-demobodega.mjs");
  const emitScript = read("apps/api/scripts/demo-emit-taps.mjs");

  for (const script of [seedScript, resetScript, emitScript]) {
    assert.match(script, /DEMO_MODE/);
    assert.match(script, /DEMO_ALLOW_PROD_DATA_WRITE/);
  }
});

test("demo smoke script covers required health, sun, stream and optional me/marketplace checks", () => {
  const smoke = read("apps/api/scripts/demo-smoke.mjs");
  assert.match(smoke, /health/);
  assert.match(smoke, /sun\?view=json/);
  assert.match(smoke, /sun\?view=html/);
  assert.match(smoke, /admin\/events\/stream/);
  assert.match(smoke, /\/me/);
  assert.match(smoke, /\/me\/marketplace/);
});
