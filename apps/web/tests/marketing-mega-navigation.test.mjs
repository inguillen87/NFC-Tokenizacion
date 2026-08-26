import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("mega navigation groups commercial and technical depth on existing routes", async () => {
  const navigation = await read("../src/components/marketing-mega-nav.tsx");

  for (const group of ["solutions", "industries", "platform", "resources"]) {
    assert.match(navigation, new RegExp(`id: "${group}"`));
  }

  for (const href of [
    "/demo-lab?scenario=nfc-424",
    "/demo-lab?scenario=dual-proof",
    "/demo-lab?vertical=wine",
    "/proof/verify",
    "/sun",
    "/offline",
    "/sdk",
    "/docs",
    "/stack",
    "/glossary",
    "/audiences",
    "/resellers",
    "/investor-snapshot",
  ]) {
    assert.match(navigation, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(navigation, /href:\s*"\/(?:solutions|industries)(?:\/|"|\?)/);
  assert.match(navigation, /without treating it as proof of the physical object/);
  assert.match(navigation, /sin tratarla como prueba del objeto físico/);
});

test("mega navigation shares one accessible keyboard and mobile interaction model", async () => {
  const [navigation, css] = await Promise.all([
    read("../src/components/marketing-mega-nav.tsx"),
    read("../src/components/marketing-mega-nav.module.css"),
  ]);

  assert.ok((navigation.match(/copy\.groups\.map\(\(group/g) ?? []).length >= 2);
  assert.match(navigation, /event\.key === "ArrowDown"/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /event\.key !== "Tab"/);
  assert.match(navigation, /role="dialog" aria-modal="true"/);
  assert.match(navigation, /querySelectorAll<HTMLElement>\("\[data-nav-inert\]"\)/);
  assert.match(navigation, /document\.body\.style\.overflow = "hidden"/);
  assert.match(navigation, /mobileTriggerRef\.current\?\.focus\(\)/);
  assert.match(css, /\.mobileMenuButton\s*\{[\s\S]*min-height: 2\.65rem/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("corrective home restores the original journey without the duplicated technical catalog", async () => {
  const [page, layout, demoLab, sdk, css] = await Promise.all([
    read("../src/app/page.tsx"),
    read("../src/app/layout.tsx"),
    read("../src/app/(public)/demo-lab/page.tsx"),
    read("../src/app/sdk/page.tsx"),
    read("../src/app/globals.css"),
  ]);

  for (const surface of [
    "<HeroSection",
    "<SimpleTrustFlowSection",
    "<OfflineFieldOperationsSection",
    "<BrandSynergySimulator",
    "<CtaSection",
    "<DemoRequestSection",
    "<SalesChatWidget",
    "<CommercialContactModal",
    "site-footer",
  ]) {
    assert.match(page, new RegExp(surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(page, /<MarketingMegaNav/);
  assert.match(page, /<SalesChatWidget locale=\{locale\} deferUntilScroll \/>/);
  assert.match(page, /<main id="main-content" data-nav-inert>/);
  assert.doesNotMatch(page, /EnterpriseTrustLayersSection|Quick-Jump Hub|nexid-quick-hub-card|landing-mobile-action-dock|MobileNavSheet/);
  assert.match(page, /get\("theme"\)\?\.value === "dark" \? "dark" : "light"/);
  assert.match(layout, /themeCookie === "dark" \? "dark" : "light"/);
  assert.match(demoLab, /cookieTheme === "dark"[\s\S]*\? "dark"[\s\S]*: "light"/);
  assert.match(sdk, /get\("theme"\)\?\.value === "dark" \? "dark" : "light"/);
  assert.match(css, /Corrective white-first landing shell/);
  assert.match(css, /html\.theme-light body,[\s\S]*background: #ffffff !important/);
});
