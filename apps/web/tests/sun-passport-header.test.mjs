import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import postcss from "postcss";
import { translateSunUiText } from "../src/app/sun/sun-locale.ts";

const headerUrl = new URL("../src/app/sun/sun-passport-header.tsx", import.meta.url);
const pageUrl = new URL("../src/app/sun/page.tsx", import.meta.url);

test("SUN header gives account access priority beside preferences while preserving brand and a bounded status row", async () => {
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
  assert.ok(source.indexOf('href="/me"') < source.indexOf("<SunLocaleSwitcher"));
  assert.ok(source.indexOf("<SunLocaleSwitcher") < source.indexOf("<ThemeToggle"));
  assert.ok(source.indexOf("<ThemeToggle") < source.indexOf("sun-live-tap-pill"));
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /\.header \.utilities\s*\{[^}]*grid-column: 1 \/ -1;[^}]*grid-template-columns: minmax\(0, 1fr\) 7\.625rem 2\.75rem;/);
  assert.match(css, /\.header \.status\s*\{[^}]*grid-column: 1 \/ -1;[^}]*grid-row: 2;/);
  assert.match(css, /@media \(max-width: 299px\)[\s\S]*?\.header \.accountLink \{ grid-column: 1 \/ -1; grid-row: 1;/);
  assert.match(css, /@media \(max-width: 299px\)[\s\S]*?\.header \.status \{ grid-column: 1 \/ -1; grid-row: 3;/);
  assert.match(css, /\.header \.status\s*\{[^}]*max-width: 100%;[^}]*white-space: normal;/);
});

test("SUN header keeps the web home identity and real controls touch-safe", async () => {
  const css = await readFile(new URL("../src/app/sun/sun-passport-header.module.css", import.meta.url), "utf8");
  const parsedCss = postcss.parse(css);
  const compact = parsedCss.nodes.find(node => node.type === "atrule" && node.name === "media" && node.params === "(max-width: 389px)");
  for (const selector of [".header .brand", ".homeLink", '.header .brand [data-sun-brand-identity][data-sun-brand-variant="passport"]']) {
    const selected = compact.nodes.find(node => node.type === "rule" && node.selector === selector);
    assert.equal(selected.nodes.find(node => node.type === "decl" && node.prop === "min-height").value, "4.5rem");
  }
  const regular = parsedCss.nodes.find(node => node.type === "atrule" && node.name === "media" && node.params === "(min-width: 390px)");
  assert.equal(regular.nodes.find(node => node.type === "rule" && node.selector === ".header .brand").nodes.find(node => node.type === "decl" && node.prop === "min-height").value, "6rem");

  assert.match(css, /\.header \.brand \[data-brand-home-link\]\s*\{[^}]*min-width: 2\.75rem;[^}]*min-height: 2\.75rem;/);
  assert.match(css, /\.homeLink:focus-visible\s*\{[^}]*outline: 2px solid var\(--header-accent\)/);
  assert.match(css, /\.header \.accountLink\s*\{[^}]*min-width: 2\.75rem;[^}]*min-height: 2\.75rem;/);
  assert.match(css, /\.accountLink:focus-visible\s*\{[^}]*outline: 2px solid var\(--header-accent\)/);
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
  assert.match(header, /<Link href="\/me" prefetch=\{false\} className=\{styles\.accountLink\}/);
  assert.match(header, /\{translatedLivePillLabel\}/);
  assert.doesNotMatch(header, /fetch\(|getCurrentPosition|freshToken|cmac|telemetry|<img|<Image/);
  assert.match(page, /<SunLocaleProvider initialLocale=\{locale\}>[\s\S]*?<SunPassportHeader[\s\S]*?pulseClass=\{pulseClass\}[\s\S]*?\/>/);
  assert.match(page, /!isDemoPreview && <ConsumerPassportLink href=\{isFreshCommercialTap && freshToken \? withTapQuery\("\/me\/products","products"\) : "\/me\/products"\} eventId=\{eventId\} freshToken=\{isFreshCommercialTap \? freshToken : ""\}/);
});

// Render the production header, brand and ThemeToggle with real Next Link. The
// locale context is selected explicitly; preferences are not changed in SSR.
function renderHeader(locale, props) {
  const require = createRequire(import.meta.url), modules = new Map();
  const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const source = readFileSync(filename, "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const localRequire = name => {
      if (name.endsWith(".module.css")) return css;
      if (name === "./sun-locale-provider") return {
        useSunLocale: () => ({ locale, text: value => translateSunUiText(value, locale) }),
        SunLocaleSwitcher: () => React.createElement("select", { "aria-label": "Language", defaultValue: locale }, React.createElement("option", { value: locale }, locale)),
      };
      if (!name.startsWith(".")) return require(name);
      const base = resolve(dirname(filename), name);
      const dependency = [base, `${base}.tsx`, `${base}.ts`].find(path => existsSync(path));
      assert.ok(dependency, `Production dependency exists: ${name}`);
      return load(dependency);
    };
    new Function("require", "module", "exports", js)(localRequire, module, module.exports);
    return module.exports;
  }
  const { SunPassportHeader } = load(fileURLToPath(headerUrl));
  return renderToStaticMarkup(React.createElement(SunPassportHeader, props));
}

test("SUN rendered account link is always plain portal access across locales and QR/NFC states, without a reading capability", () => {
  for (const [locale, label] of [["es-AR", "Mi cuenta"], ["en", "My account"], ["pt-BR", "Minha conta"]]) {
    for (const isQrScan of [false, true]) for (const livePillLabel of ["Muestra demo", "Tap físico activo", "Consulta segura", "Consulta pendiente"]) {
      const html = renderHeader(locale, { isQrScan, livePillLabel, pulseClass: "bg-emerald-300" });
      assert.match(html, new RegExp(`<a[^>]*data-testid="sun-account-link"[^>]*href="/me"[^>]*>${label}</a>`));
      assert.match(html, new RegExp(`aria-label="${translateSunUiText("Estado", locale)}: ${translateSunUiText(livePillLabel, locale)}"`));
      assert.ok(html.includes(translateSunUiText(isQrScan ? "Pasaporte QR" : "Pasaporte NFC", locale)));
      assert.match(html, /data-sun-brand-variant="passport"/);
      assert.doesNotMatch(html, /href="\/me\?|tap-handoff|freshToken|eventId|claim|purchase|<form/);
      assert.equal((html.match(/data-testid="sun-account-link"/g) || []).length, 1);
    }
  }
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
