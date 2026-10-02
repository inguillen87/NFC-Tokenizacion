import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import postcss from "postcss";

const headerUrl = new URL("../src/app/sun/sun-passport-header.tsx", import.meta.url);
const pageUrl = new URL("../src/app/sun/page.tsx", import.meta.url);

test("SUN header gives the existing brand priority and puts status and locale in a bounded secondary row", async () => {
  const [source, css] = await Promise.all([
    readFile(headerUrl, "utf8"),
    readFile(new URL("../src/app/sun/sun-passport-header.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /sun-passport-header sun-topbar \$\{styles\.header\}/);
  assert.match(source, /<Link href="\/" prefetch=\{false\} aria-label=\{homeLabel\(locale\)\}/);
  assert.ok(source.indexOf("<SunBrandIdentity") < source.indexOf("<ThemeToggle"));
  assert.match(source, /<SunBrandIdentity variant="passport" \/>/);
  assert.ok(source.indexOf("sun-topbar-actions") < source.indexOf("<ThemeToggle"));
  assert.ok(source.indexOf("sun-topbar-actions") < source.indexOf("sun-live-tap-pill"));
  assert.ok(source.indexOf("sun-live-tap-pill") < source.indexOf("<SunLocaleSwitcher"));
  assert.ok(source.indexOf("<SunLocaleSwitcher") < source.indexOf("<ThemeToggle"));
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /\.header \.utilities\s*\{[^}]*grid-column: 1 \/ -1;[^}]*grid-template-columns: minmax\(0, 1fr\) 7\.625rem 2\.75rem;/);
  assert.match(css, /@media \(max-width: 299px\)[\s\S]*?\.header \.status \{ grid-column: 1 \/ -1; grid-row: 2;/);
  assert.match(css, /\.header \.status\s*\{[^}]*max-width: 100%;[^}]*white-space: normal;/);
});

test("SUN header keeps the web home identity and real controls touch-safe", async () => {
  const css = await readFile(new URL("../src/app/sun/sun-passport-header.module.css", import.meta.url), "utf8");

  assert.match(css, /\.header \.brand \[data-brand-home-link\]\s*\{[^}]*min-width: 2\.75rem;[^}]*min-height: 2\.75rem;/);
  assert.match(css, /\.homeLink:focus-visible\s*\{[^}]*outline: 2px solid var\(--header-accent\)/);
  assert.doesNotMatch(css, /brand-wordmark-svg|margin-inline-end:\s*-/);
  assert.match(css, /\.header \.theme :global\(\.theme-toggle\)\s*\{[^}]*width: 2\.75rem;[^}]*min-height: 2\.75rem;/);
  assert.match(css, /\.header \.locale select\s*\{[^}]*min-width: 0;[^}]*min-height: 2\.75rem;/);
  assert.match(css, /span:not\(:global\(\.theme-toggle__glyph\)\)\s*\{[^}]*display: none;/);
  assert.match(css, /\.header :is\(button, select\):focus-visible/);
  assert.match(css, /html:is\(\.theme-light, \[data-theme="light"\]\)/);
});

test("SUN passport header preserves identity, evidence labels and the existing preference controls", async () => {
  const [header, page] = await Promise.all([
    readFile(headerUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(header, /const passportLabel = text\(isQrScan \? "Pasaporte QR" : "Pasaporte NFC"\)/);
  assert.match(header, /sun-passport-brand__caption \$\{styles\.caption\}/);
  assert.match(header, /aria-label=\{text\("Controles del pasaporte"\)\}/);
  assert.match(header, /role="status"/);
  assert.match(header, /<SunLocaleSwitcher \/>/);
  assert.doesNotMatch(header, /<LocaleSwitcher|router\.refresh|router\.push/);
  assert.match(header, /<ThemeToggle locale=\{locale\} \/>/);
  assert.match(header, /\{translatedLivePillLabel\}/);
  assert.doesNotMatch(header, /fetch\(|getCurrentPosition|freshToken|cmac|telemetry|<img|<Image/);
  assert.match(page, /<SunLocaleProvider initialLocale=\{locale\}>[\s\S]*?<SunPassportHeader[\s\S]*?pulseClass=\{pulseClass\}[\s\S]*?\/>/);
});

test("SUN header presentation has one local owner without changing shared brand assets", async () => {
  const [experienceCss, wordmark] = await Promise.all([
    readFile(new URL("../src/app/sun/sun-passport-experience.module.css", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/ui/src/brand/brand-wordmark.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(experienceCss, /sun-passport-header|sun-passport-brand|sun-live-tap-pill/);
  assert.match(wordmark, /viewBox="0 0 520 120"/);
});

test("SUN brand entrance is finite and respects reduced motion, including inherited animation", async () => {
  const [source, css] = await Promise.all([
    readFile(headerUrl, "utf8"),
    readFile(new URL("../src/app/sun/sun-passport-header.module.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(source, /animate-pulse|variant="ripple"/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important;[\s\S]*?transition: none !important;/);
  assert.doesNotMatch(css, /animation[^;]*infinite/);
});

test("SUN owns solid header and theme-control paint despite the inherited global glass styles", async () => {
  const [localCss, globalCss] = await Promise.all([
    readFile(new URL("../src/app/sun/sun-passport-header.module.css", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  const local = postcss.parse(localCss);
  const global = postcss.parse(globalCss);
  const rule = (root, selector) => root.nodes.find(node => node.type === "rule" && node.selector === selector);
  const declaration = (node, property) => node.nodes.find(child => child.type === "decl" && child.prop === property);

  // This was the actual cascade conflict: the global important gradient beat
  // a normal declaration in the otherwise more specific SUN control rule.
  assert.match(declaration(rule(global, ".theme-toggle"), "background").value, /linear-gradient/);
  assert.equal(declaration(rule(global, ".theme-toggle"), "background").important, true);
  assert.match(declaration(rule(global, ".sun-topbar"), "backdrop-filter").value, /blur/);

  const header = rule(local, ".header:global(.sun-passport-header)");
  assert.equal(declaration(header, "backdrop-filter").value, "none");
  assert.equal(declaration(header, "-webkit-backdrop-filter").value, "none");
  const theme = rule(local, ".header .theme :global(.theme-toggle)");
  for (const [property, value] of [
    ["background", "var(--header-control)"],
    ["border-color", "var(--header-line)"],
    ["color", "var(--header-ink)"],
  ]) {
    const selected = declaration(theme, property);
    assert.equal(selected.value, value);
    assert.equal(selected.important, true);
  }
});
