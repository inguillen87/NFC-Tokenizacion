import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

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
  assert.equal(navigation.match(/group\.items\.filter\(\(item\) => item\.href !== "\/about"\)/g)?.length, 2);
  assert.match(navigation, /function isNavigationGroupCurrent/);
  assert.match(navigation, /solutions: \["\/pricing"\]/);
  assert.match(navigation, /platform: \["\/demo", "\/demo-lab", "\/proof", "\/sun", "\/offline", "\/login", "\/sdk"\]/);
  assert.match(navigation, /resources: \["\/docs", "\/stack", "\/glossary", "\/audiences", "\/resellers"\]/);
  assert.match(navigation, /aria-current=\{groupCurrent \? "page" : undefined\}/);
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
  assert.match(css, /\.mobileMenuButton\s*\{[\s\S]*min-height: 2\.75rem/);
  assert.match(css, /\.mobileAboutLink\s*\{[\s\S]*min-height: 3\.65rem/);
  assert.match(css, /@media \(max-width: 1599px\)[\s\S]*\.desktopNav,[\s\S]*\.desktopUtility/);
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

test("public headers give the brand a responsive, prominent lockup on every viewport", async () => {
  const [home, publicHeader, css, navigationCss] = await Promise.all([
    read("../src/app/page.tsx"),
    read("../src/components/public-site-header.tsx"),
    read("../src/app/globals.css"),
    read("../src/components/marketing-mega-nav.module.css"),
  ]);

  assert.match(home, /<BrandHomeLink[\s\S]{0,180}size=\{64\}/);
  assert.match(publicHeader, /<BrandHomeLink[\s\S]{0,160}size=\{64\}/);
  assert.match(css, /\.landing-mega-header\s*\{[\s\S]{0,360}linear-gradient\(108deg[\s\S]{0,260}backdrop-filter: blur\(20px\) saturate\(145%\)/);
  assert.match(css, /html\.theme-dark \.landing-mega-header,[\s\S]{0,100}html\[data-theme="dark"\] \.landing-mega-header\s*\{[\s\S]{0,260}linear-gradient\(108deg/);
  assert.match(css, /\.landing-mega-header \.site-brand-lockup \.brand-wordmark-svg\s*\{[\s\S]{0,100}width: clamp\(11\.5rem, 15vw, 14\.5rem\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]{0,520}\.landing-mega-header \.site-brand-lockup\s*\{[\s\S]{0,220}transform: scale\(0\.94\)/);
  assert.match(navigationCss, /@media \(max-width: 1599px\)[\s\S]{0,180}\.desktopNav,[\s\S]{0,100}display: none/);
  assert.match(css, /\.landing-mega-header \.header-main-row\s*\{[^}]*max-width: 96rem/);
  for (const group of ["desktopNav", "compactNav", "navGroup", "headerUtilities"]) {
    assert.match(navigationCss, new RegExp(`\\.${group}\\s*\\{[^}]*flex: 0 0 auto`));
  }
});

test("desktop, compact and mobile navigation keep a direct route to the passport explanation", async () => {
  const [navigation, css, home, globalCss] = await Promise.all([
    read("../src/components/marketing-mega-nav.tsx"),
    read("../src/components/marketing-mega-nav.module.css"),
    read("../src/components/home-sections.tsx"),
    read("../src/app/globals.css"),
  ]);
  assert.match(navigation, /passport: "Pasaporte digital"/);
  assert.match(navigation, /passport: "Passaporte digital"/);
  assert.match(navigation, /passport: "Digital product passport"/);
  assert.equal(navigation.match(/href="\/#pasaporte-digital"/g)?.length, 3);
  // Native fragments also work after leaving the home route; client route
  // restoration can otherwise retain the hero scroll position on return.
  assert.equal(navigation.match(/<a href="\/#pasaporte-digital"/g)?.length, 3);
  assert.doesNotMatch(navigation, /<Link href="\/#pasaporte-digital"/);
  assert.match(navigation, /<nav className=\{styles\.compactNav\}/);
  assert.match(navigation, /href="\/#pasaporte-digital" className=\{styles\.mobileAboutLink\} onClick=\{\(\) => setMobileOpen\(false\)\}/);
  assert.match(css, /@media \(min-width: 980px\) and \(max-width: 1599px\)\s*\{\s*\.compactNav\s*\{\s*display: flex/);
  assert.match(home, /id="pasaporte-digital"/);
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
    "<SimpleTrustFlowSection",
    "<CommercialValueSection",
    "<CommercialContactModal",
    "site-footer",
  ]) {
    assert.match(page, new RegExp(surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(page, /<MarketingMegaNav/);
  assert.doesNotMatch(page, /<CtaSection/);
  assert.doesNotMatch(page, /<SalesChatWidget/);
  assert.match(page, /<main id="main-content" data-nav-inert>/);
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
