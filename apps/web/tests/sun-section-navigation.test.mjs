import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readNavigation = () =>
  readFile(new URL("../src/app/sun/sun-section-nav.tsx", import.meta.url), "utf8");

test("SUN section navigation exposes the four product journey anchors", async () => {
  const source = await readNavigation();

  for (const [id, label] of [
    ["sun-summary", "Resumen"],
    ["sun-origin", "Origen"],
    ["sun-condition", "Estado"],
    ["sun-services", "Servicios"],
  ]) {
    assert.match(source, new RegExp(`id: "${id}", label: "${label}"`));
  }

  assert.match(source, /href=\{`#\$\{id\}`\}/);
  assert.match(source, /aria-label=\{text\("Secciones del producto"\)\}/);
  assert.match(source, /useSunLocale\(\)/);
  assert.match(source, /aria-current=\{isActive \? "location" : undefined\}/);
  assert.match(source, /sunAgroSectionNavItems/);
  assert.match(source, /id: "agro-dpp", label: "Producto"/);
});

test("SUN section navigation is touch-safe and responsive without motion runtime", async () => {
  const source = await readNavigation();

  assert.match(source, /min-h-11/);
  assert.match(source, /sticky top-4[^"]*lg:block/);
  assert.match(source, /sun-mobile-dock fixed inset-x-3 bottom-\[calc\(env\(safe-area-inset-bottom\)\+0\.5rem\)\]/);
  assert.match(source, /max-w-\[430px\]/);
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-cyan-300/);
  assert.doesNotMatch(source, /framer-motion/);
});

// Scroll, dynamic DOM, occlusion and keyboard behavior are exercised with real React
// and Chromium in sun-section-navigation.browser.mjs; source checks cover public markup only.
test("SUN hidden mobile navigation is absent from the accessibility and keyboard trees", async () => {
  const source = await readNavigation();

  assert.match(source, /aria-hidden=\{!isMobileDockVisible\}/);
  assert.match(source, /inert=\{!isMobileDockVisible\}/);
  assert.match(source, /tabIndex=\{disabled \? -1 : undefined\}/);
});

test("SUN dock transitions respect the visitor's reduced-motion setting", async () => {
  const source = await readNavigation();
  assert.match(source, /motion-reduce:transition-none/);
});
