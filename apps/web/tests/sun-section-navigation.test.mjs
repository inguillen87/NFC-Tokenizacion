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

test("SUN section navigation keeps active state synchronized with document scroll", async () => {
  const source = await readNavigation();

  assert.match(source, /window\.requestAnimationFrame\(syncActiveSection\)/);
  assert.match(source, /window\.addEventListener\("scroll", scheduleSync, \{ passive: true \}\)/);
  assert.match(source, /window\.addEventListener\("hashchange", scheduleSync\)/);
  assert.match(source, /window\.removeEventListener\("scroll", scheduleSync\)/);
  assert.match(source, /window\.cancelAnimationFrame\(frameId\)/);
});

test("SUN mobile dock waits until the first summary clears its reserved space", async () => {
  const source = await readNavigation();

  assert.match(source, /const MOBILE_DOCK_CLEARANCE_PX = 72/);
  assert.match(source, /const \[showMobileNav, setShowMobileNav\] = useState\(false\)/);
  assert.match(source, /const summaryBottom = sectionNodes\[0\]\.getBoundingClientRect\(\)\.bottom/);
  assert.match(source, /const hasLeftFirstView = window\.scrollY > 24/);
  assert.match(source, /const hasClearedIntro = variant === "agro"[\s\S]*?window\.scrollY > 280/);
  assert.match(source, /setShowMobileNav\(hasLeftFirstView && hasClearedIntro\)/);
  assert.match(source, /const isMobileDockVisible = showMobileNav && !isScrollingDown && !isDockAvoided/);
  assert.match(source, /aria-hidden=\{!isMobileDockVisible\}/);
  assert.match(source, /inert=\{!isMobileDockVisible\}/);
  assert.match(source, /tabIndex=\{disabled \? -1 : undefined\}/);
});

test("SUN mobile dock yields to downward scrolling and nearby controls", async () => {
  const source = await readNavigation();

  assert.match(source, /const dockHeight = mobileDock\?\.offsetHeight \|\| 0/);
  assert.match(source, /Number\.parseFloat\(window\.getComputedStyle\(mobileDock\)\.bottom\)/);
  assert.match(source, /const dockTop = window\.innerHeight - dockBottom - dockHeight/);
  assert.doesNotMatch(source, /MOBILE_DOCK_OCCLUSION_PX/);
  assert.match(source, /document\.querySelectorAll<HTMLElement>\("\[data-sun-dock-avoid\]"\)/);
  assert.match(source, /delta > 5\) setIsScrollingDown\(true\)/);
  assert.match(source, /setTimeout\(\(\) => setIsScrollingDown\(false\), 650\)/);
  assert.match(source, /setIsDockAvoided\(nextAvoided\)/);
});
