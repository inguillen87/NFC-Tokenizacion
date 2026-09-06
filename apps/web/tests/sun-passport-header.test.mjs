import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const headerUrl = new URL("../src/app/sun/sun-passport-header.tsx", import.meta.url);
const pageUrl = new URL("../src/app/sun/page.tsx", import.meta.url);

test("SUN header gives the existing brand priority and puts status and locale in a bounded secondary row", async () => {
  const [source, css] = await Promise.all([
    readFile(headerUrl, "utf8"),
    readFile(new URL("../src/app/sun/sun-passport-header.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /sun-passport-header sun-topbar \$\{styles\.header\}/);
  assert.match(source, /<BrandLockup size=\{52\} variant="static" theme="dark" \/>/);
  assert.ok(source.indexOf("<BrandLockup") < source.indexOf("<ThemeToggle"));
  assert.ok(source.indexOf("<ThemeToggle") < source.indexOf("sun-topbar-actions"));
  assert.ok(source.indexOf("sun-topbar-actions") < source.indexOf("sun-live-tap-pill"));
  assert.ok(source.indexOf("sun-live-tap-pill") < source.indexOf("<SunLocaleSwitcher"));
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 2\.75rem/);
  assert.match(css, /\.header \.utilities\s*\{[^}]*grid-column: 1 \/ -1;[^}]*grid-template-columns: minmax\(0, 1fr\) 9rem;/);
  assert.match(css, /\.header \.status\s*\{[^}]*max-width: 100%;[^}]*white-space: normal;/);
});

test("SUN header sizing overrides legacy logo shrink rules and keeps real controls touch-safe", async () => {
  const css = await readFile(new URL("../src/app/sun/sun-passport-header.module.css", import.meta.url), "utf8");

  assert.match(css, /\.header \.brand :global\(\.brand-mark\)\s*\{[^}]*width: 3\.25rem !important;[^}]*height: 3\.25rem !important;/);
  assert.match(css, /\.header \.brand :global\(\.brand-wordmark-svg\)\s*\{[^}]*width: 13rem !important;[^}]*height: 3rem !important;[^}]*max-width: none !important;[^}]*flex-shrink: 0;/);
  assert.match(css, /margin-inline-end: -5\.75rem/);
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
  assert.match(css, /\.header \.brand \*[\s\S]*?animation: none !important;/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important;[\s\S]*?transition: none !important;/);
  assert.doesNotMatch(css, /animation[^;]*infinite/);
});
