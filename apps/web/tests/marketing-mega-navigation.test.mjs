import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("consumer account entry is direct and distinct from business sign in in every locale", async () => {
  const navigation = await read("../src/components/marketing-mega-nav.tsx");
  for (const [account, business] of [
    ["Mi cuenta", "Empresas"],
    ["My account", "Business"],
    ["Minha conta", "Empresas"],
  ]) {
    assert.ok(navigation.includes(`account: "${account}"`));
    assert.ok(navigation.includes(`login: "${business}"`));
  }
  for (const entry of ["header", "menu"]) {
    assert.match(navigation, new RegExp(`<Link href="/me" prefetch=\\{false\\}[^>]*data-consumer-entry="${entry}"`));
  }
  assert.equal(navigation.match(/href: "\/me"/g)?.length, 3);
  assert.doesNotMatch(navigation, /\/login\?next=\/me/);
  assert.match(navigation, /<a href=\{loginHref\} className=\{styles\.loginLink\}>\{copy\.login\}/);
  assert.match(navigation, /href="\/demo-lab" prefetch=\{false\} className=\{styles\.headerCta\}/);
});

test("mega navigation groups commercial and technical depth on existing routes", async () => {
  const navigation = await read("../src/components/marketing-mega-nav.tsx");

  for (const group of ["solutions", "industries", "platform", "resources"]) {
    assert.match(navigation, new RegExp(`id: "${group}"`));
  }
  assert.doesNotMatch(navigation, /id: "plans"/);

  for (const href of [
    "/demo-lab?scenario=nfc-424",
    "/demo-lab?scenario=dual-proof",
    "/demo-lab?vertical=wine",
    "/demo-lab?profile=packaging",
    "/proof/verify",
    "/sun",
    "/offline",
    "/sdk",
    "/docs",
    "/about",
    "/stack",
    "/glossary",
    "/audiences",
    "/resellers",
    "/pricing",
  ]) {
    assert.match(navigation, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(navigation, /href:\s*"\/(?:solutions|industries)(?:\/|"|\?)/);
  assert.equal(navigation.match(/href: "\/demo-lab\?profile=packaging"/g)?.length, 3);
  assert.doesNotMatch(navigation, /href: "\/demo-lab\?vertical=perfume"/);
  assert.match(navigation, /without treating it as proof of the physical object/);
  assert.match(navigation, /sin tratarla como prueba del objeto físico/);
  assert.match(navigation, /Plans and pilots/);
  assert.match(navigation, /Planes y pilotos/);
  assert.match(navigation, /Planos e pilotos/);
  assert.doesNotMatch(navigation, /Investor snapshot/);
  assert.match(navigation, /className=\{styles\.navDirectLink\}/);
  assert.match(navigation, /about: "Quiénes somos"/);
  assert.match(navigation, /about: "Quem somos"/);
  assert.match(navigation, /about: "About us"/);
  assert.match(navigation, /className=\{styles\.mobileAboutLink\}/);
  assert.match(navigation, /const groups = copy\.groups\.filter\(\(group\) => group\.id !== "industries"\)/);
  assert.match(navigation, /group\.id === "solutions" && industries/);
  assert.equal(navigation.match(/industries\.items\.map/g)?.length, 2);
  assert.equal(navigation.match(/group\.items\.filter\(\(item\) => item\.href !== "\/about"\)/g)?.length, 1);
  assert.match(navigation, /function isNavigationGroupCurrent/);
  assert.match(navigation, /solutions: \["\/pricing"\]/);
  assert.match(navigation, /platform: \["\/demo", "\/demo-lab", "\/proof", "\/sun", "\/offline", "\/login", "\/sdk"\]/);
  assert.match(navigation, /resources: \["\/about", "\/docs", "\/stack", "\/glossary", "\/audiences", "\/resellers"\]/);
  assert.match(navigation, /aria-current=\{groupCurrent \? "page" : undefined\}/);
});

test("mega navigation shares one accessible keyboard and mobile interaction model", async () => {
  const [navigation, css] = await Promise.all([
    read("../src/components/marketing-mega-nav.tsx"),
    read("../src/components/marketing-mega-nav.module.css"),
  ]);

  assert.ok((navigation.match(/groups\.map\(\(group/g) ?? []).length >= 2);
  assert.match(navigation, /event\.key === "ArrowDown"/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /event\.key !== "Tab"/);
  assert.match(navigation, /role="dialog" aria-modal="true"/);
  assert.match(navigation, /querySelectorAll<HTMLElement>\("\[data-nav-inert\]"\)/);
  assert.match(navigation, /document\.body\.style\.overflow = "hidden"/);
  assert.match(navigation, /mobileTriggerRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /\.mobileMenuButton\s*\{[\s\S]*min-height: 2\.75rem/);
  assert.match(css, /\.mobileAboutLink\s*\{[\s\S]*min-height: 3\.65rem/);
  assert.match(css, /@media not all and \(min-width: 1280px\)[\s\S]*\.desktopNav,[\s\S]*\.desktopUtility/);
  assert.match(navigation, /const desktop = window\.matchMedia\("\(min-width: 1280px\)"\)/);
  assert.doesNotMatch(css, /1599px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("mega navigation keeps hover intent stable instead of closing on pointer gaps", async () => {
  const navigation = await read("../src/components/marketing-mega-nav.tsx");

  assert.match(navigation, /function scheduleDesktopMenuClose\(/);
  assert.match(navigation, /function cancelScheduledClose\(\)/);
  assert.match(navigation, /window\.setTimeout\(\(\) => \{[\s\S]*setOpenMenu\(null\)/);
  assert.match(navigation, /window\.clearTimeout\(/);
  assert.match(navigation, /function openDesktopMenu\(groupId: string, source: "hover" \| "click"\) \{[\s\S]{0,220}cancelScheduledClose\(\)[\s\S]{0,220}openMenuSourceRef\.current = source[\s\S]{0,220}setOpenMenu\(groupId\)/);
  assert.match(navigation, /if \(expanded && openMenuSourceRef\.current === "click"\) closeDesktopMenu\(\)/);
  assert.match(navigation, /else openDesktopMenu\(group\.id, "click"\)/);
  assert.match(navigation, /if \(openMenuSourceRef\.current === "click"\) return/);
  assert.match(navigation, /event\.pointerType !== "mouse"/);
  assert.match(navigation, /onPointerEnter=\{\(event\) => handleDesktopMenuEnter\(event, group\.id\)\}/);
  assert.match(navigation, /onPointerLeave=\{scheduleDesktopMenuClose\}/);
  assert.match(navigation, /onFocus=\{cancelScheduledClose\}/);
  assert.match(navigation, /groupElement\.contains\(document\.activeElement\)/);
  assert.doesNotMatch(navigation, /onMouseLeave=\{\(\) => setOpenMenu\(null\)\}/);
  assert.doesNotMatch(navigation, /onPointerLeave=\{\(\) => setOpenMenu\(null\)\}/);
});

test("public headers use isolated tokens and a responsive brand with a single session entrance", async () => {
  const [home, publicHeader, brand, navigationCss, headerCss] = await Promise.all([
    read("../src/app/page.tsx"),
    read("../src/components/public-site-header.tsx"),
    read("../src/components/marketing-header-brand.tsx"),
    read("../src/components/marketing-mega-nav.module.css"),
    read("../src/components/public-site-header.module.css"),
  ]);

  assert.match(home, /<header className=\{headerStyles\.header\}>\s*<div className=\{headerStyles\.row\}>\s*<MarketingHeaderBrand locale=\{locale\}/);
  assert.match(publicHeader, /<header className=\{styles\.header\}>\s*<div className=\{styles\.row\}>\s*<MarketingHeaderBrand locale=\{locale\}/);
  assert.match(brand, /<StaticBrandHomeLink locale=\{locale\} size=\{48\}/);
  assert.match(brand, /sessionStorage\.getItem\("nexid-brand-intro"\)/);
  assert.match(brand, /prefers-reduced-motion: reduce/);
  assert.match(headerCss, /min-height: 72px/);
  assert.match(headerCss, /max-width: 767px[\s\S]*min-height: 60px[\s\S]*width: 40px; height: 40px/);
  assert.match(headerCss, /\.brand svg \{ width: 48px; height: 48px/);
  for (const css of [navigationCss, headerCss]) {
    assert.doesNotMatch(css, /!important|backdrop-filter/);
    assert.match(css, /var\(--nexid-/);
  }
  assert.doesNotMatch(headerCss, /:global|landing-mega-header|header-main-row/);
  assert.match(navigationCss, /@media not all and \(min-width: 1280px\)[\s\S]{0,180}\.desktopNav,[\s\S]{0,100}display: none/);
  for (const group of ["desktopNav", "compactNav", "navGroup", "headerUtilities"]) {
    assert.match(navigationCss, new RegExp(`\\.${group}\\s*\\{[^}]*flex: 0 0 auto`));
  }
});

test("desktop, compact and mobile navigation give demos a direct entry while the passport explanation stays on the landing", async () => {
  const [navigation, css, home, globalCss] = await Promise.all([
    read("../src/components/marketing-mega-nav.tsx"),
    read("../src/components/marketing-mega-nav.module.css"),
    read("../src/components/home-sections.tsx"),
    read("../src/app/globals.css"),
  ]);
  assert.match(navigation, /passport: "Demos por rubro"/);
  assert.match(navigation, /passport: "Demos por setor"/);
  assert.match(navigation, /passport: "Demos by industry"/);
  assert.equal(navigation.match(/data-demo-entry="gallery"/g)?.length, 3);
  assert.equal(navigation.match(/<a href=\{SUN_DEMO_GALLERY_HREF\}/g)?.length, 3);
  assert.match(navigation, /focusInitialPassportFragment\(\)/);
  assert.match(navigation, /<nav className=\{styles\.compactNav\}/);
  assert.match(navigation, /href=\{SUN_DEMO_GALLERY_HREF\} className=\{styles\.mobileAboutLink\} onClick=\{handleDemoNavigation\}/);
  assert.match(css, /@media not all and \(min-width: 1280px\)\s*\{\s*\.desktopNav,[\s\S]*@media \(min-width: 768px\)\s*\{\s*\.compactNav\s*\{\s*display: flex/);
  assert.match(home, /id="pasaporte-digital"/);
  const journey = await read("../src/components/simple-trust-industry-journey.tsx");
  assert.match(journey, /href="\/about" prefetch=\{false\}/);
  assert.doesNotMatch(journey, /valle.secreto/i);
  assert.match(globalCss, /width: clamp\(8\.75rem, calc\(100vw - 200px\), 12rem\) !important/);
});

test("focused home keeps the commercial journey while the mega menu carries depth", async () => {
  const [page, layout, demoLab, sdk, css] = await Promise.all([
    read("../src/app/page.tsx"),
    read("../src/app/layout.tsx"),
    read("../src/app/(public)/demo-lab/page.tsx"),
    read("../src/app/sdk/page.tsx"),
    read("../src/app/globals.css"),
  ]);

  for (const surface of [
    "<HeroSection",
    "<ScrollStory",
    "<DemoLauncherSection",
    "<CommercialContactModal",
    "site-footer",
  ]) {
    assert.match(page, new RegExp(surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(page, /<MarketingMegaNav/);
  assert.doesNotMatch(page, /<CtaSection/);
  assert.doesNotMatch(page, /<SalesChatWidget/);
  assert.match(page, /<main id="main-content" tabIndex=\{-1\} data-nav-inert>/);
  assert.doesNotMatch(
    page,
    /OfflineFieldOperationsSection|BrandSynergySimulator|DemoRequestSection|offline-field-operations|brand-synergy|EnterpriseTrustLayersSection|Quick-Jump Hub|nexid-quick-hub-card|landing-mobile-action-dock|MobileNavSheet/,
  );
  for (const surface of [page, layout, demoLab, sdk]) {
    assert.match(surface, /resolveThemePreference\(/);
    assert.match(surface, /THEME_PREFERENCE_VERSION_COOKIE/);
  }
  assert.match(css, /Corrective white-first landing shell/);
  assert.match(css, /html\.theme-light body,[\s\S]*background: #ffffff !important/);
});
