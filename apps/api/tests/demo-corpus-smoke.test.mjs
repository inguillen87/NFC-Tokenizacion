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

test("demo pack assets exist for canonical corpus", () => {
  const required = [
    "apps/web/public/demo/wine-secure/seed.json",
    "apps/web/public/demo/wine-secure/manifest.csv",
    "apps/web/public/demo/cosmetics-secure/seed.json",
    "apps/web/public/demo/pharma-secure/seed.json",
    "apps/web/public/demo/luxury-basic/seed.json",
    "apps/web/public/demo/demobodega_manifest.csv",
  ];

  for (const rel of required) {
    const full = path.join(repoRoot, rel);
    assert.equal(fs.existsSync(full), true, `missing demo asset: ${rel}`);
  }
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
