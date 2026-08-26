import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [header, content, styles, page] = await Promise.all([
  readFile(new URL("../src/components/enterprise-site-header.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/enterprise-navigation.content.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/enterprise-site-header.module.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
]);

test("enterprise header keeps the approved five-menu information architecture", () => {
  const spanish = content.slice(content.indexOf('"es-AR":'), content.indexOf("\n  en: {"));
  const groupIds = spanish.match(/id: "(product|solutions|industries|demos|resources)"/g) ?? [];

  assert.equal(groupIds.length, 5);
  for (const label of ["Producto", "Soluciones", "Rubros", "Demostraciones", "Recursos"]) {
    assert.match(spanish, new RegExp(`label: "${label}"`));
  }
  for (const resource of ["Documentación", "Tecnología y seguridad", "Para desarrolladores", "Glosario"]) {
    assert.match(spanish, new RegExp(`label: "${resource}"`));
  }
  assert.doesNotMatch(spanish, /label: "SDK & API"|label: "Demo Lab"|label: "Proof Verify"|label: "Reseller"/);
});

test("navigation links only target existing product routes, landing sections or the contact modal", () => {
  const spanish = content.slice(content.indexOf('"es-AR":'), content.indexOf("\n  en: {"));
  const hrefs = [...spanish.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
  const allowed = [
    "/",
    "/#activacion",
    "/login?next=/me",
    "/login?next=/me/passport",
    "/offline",
    "/proof/ownership",
    "/proof/verify",
    "/sun",
    "/pricing",
    "/demo-lab",
    "/demo-sandbox",
    "/docs",
    "/stack",
    "/sdk",
    "/glossary",
    "/?contact=sales&intent=company_rollout#contact-modal",
  ];

  assert.ok(hrefs.length >= 25);
  for (const href of hrefs) {
    const normalized = href.startsWith("/demo-lab?") ? "/demo-lab" : href;
    assert.ok(allowed.includes(normalized), `unexpected navigation target: ${href}`);
  }

  assert.match(page, /<section id="activacion"/);
  assert.doesNotMatch(content, /\/#brand-synergy/);
  assert.match(content, /href: "\/\?contact=sales&intent=company_rollout#contact-modal"/);
});

test("desktop and mobile navigation preserve controls, focus and modal accessibility", () => {
  assert.match(header, /LocaleSwitcher/);
  assert.match(header, /ThemeToggle/);
  assert.match(header, /createPortal\(mobileNavigation, document\.body\)/);
  assert.match(header, /role="dialog" aria-modal="true"/);
  assert.match(header, /pageRoot\?\.setAttribute\("inert", ""\)/);
  assert.match(header, /event\.key === "Escape"/);
  assert.match(header, /event\.key !== "Tab"/);
  assert.match(header, /aria-expanded=\{expanded\}/);
  assert.match(header, /expanded=\{openMenu === group\.id\}/);
  assert.match(header, /data-enterprise-menu-link/);
  assert.match(header, /!item\.href\.includes\("\?"\) && !item\.href\.includes\("#"\)/);

  const utilities = header.slice(header.indexOf(`<div className={styles.headerUtilities}>`));
  const localeIndex = utilities.indexOf("<LocaleSwitcher");
  const themeIndex = utilities.indexOf("<ThemeToggle");
  const demoIndex = utilities.indexOf("styles.headerDemo");
  const salesIndex = utilities.indexOf("styles.headerSales");
  const loginIndex = utilities.indexOf("styles.loginLink");
  assert.ok(localeIndex < themeIndex && themeIndex < demoIndex && demoIndex < salesIndex && salesIndex < loginIndex);
});

test("header is near-solid white in light mode and keeps a complete dark alternative", () => {
  assert.match(styles, /--nav-bg: #071512/);
  assert.match(styles, /html\.theme-light\) \.siteHeader/);
  assert.match(styles, /--nav-bg: #ffffff/);
  assert.match(styles, /background: rgba\(255, 255, 255, 0\.985\)/);
  assert.match(styles, /background: color-mix\(in srgb, var\(--nav-bg\) 92%, transparent\)/);
  assert.match(styles, /@media \(max-width: 1160px\)[\s\S]*\.desktopNav,[\s\S]*display: none/);
  assert.match(styles, /@media \(max-width: 1160px\)[\s\S]*\.mobileMenuButton\s*\{[\s\S]*display: inline-flex/);
  assert.match(styles, /\.mobileDialog\s*\{[\s\S]*width: min\(32rem, 94vw\)[\s\S]*height: 100dvh[\s\S]*overflow: auto/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.mobileDialog\s*\{[\s\S]*width: 100vw/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
