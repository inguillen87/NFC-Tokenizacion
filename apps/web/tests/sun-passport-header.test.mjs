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
  const compactHeader = compact.nodes.find(node => node.type === "rule" && node.selector === ".header:global(.sun-passport-header)");
  assert.equal(compactHeader.nodes.find(node => node.type === "decl" && node.prop === "padding-block").value, "0.25rem");
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
  assert.match(header, /<ThemeToggle locale=\{locale\} waitForClientReady \/>/);
  assert.match(header, /<a href="\/me" className=\{styles\.accountLink\} data-testid="sun-account-link" referrerPolicy="no-referrer">/);
  assert.doesNotMatch(header, /<Link[^>]*href="\/me"|onClick=|router\./);
  assert.match(header, /\{translatedLivePillLabel\}/);
  assert.doesNotMatch(header, /fetch\(|getCurrentPosition|freshToken|cmac|telemetry|<img|<Image/);
  assert.match(page, /<SunLocaleProvider initialLocale=\{locale\}>[\s\S]*?<SunPassportHeader[\s\S]*?pulseClass=\{pulseClass\}[\s\S]*?\/>/);
  assert.match(page, /!isDemoPreview && <ConsumerPassportLink href=\{isFreshCommercialTap && freshToken \? withTapQuery\("\/me\/products","products"\) : "\/me\/products"\} eventId=\{eventId\} freshToken=\{isFreshCommercialTap \? freshToken : ""\}/);
});

// Render the production header, brand, documentary account anchor and ThemeToggle. The
// locale context is selected explicitly; preferences are not changed in SSR.
function renderSunComponent(locale, props, componentUrl = headerUrl, exportName = "SunPassportHeader") {
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
  const Component = load(fileURLToPath(componentUrl))[exportName];
  return renderToStaticMarkup(React.createElement(Component, props));
}
const renderHeader = (locale, props) => renderSunComponent(locale, props);

test("SUN theme starts disabled in SSR while other ThemeToggle consumers retain their existing enabled default", () => {
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const html = renderHeader(locale, { isQrScan: false, livePillLabel: "Muestra demo", pulseClass: "bg-emerald-300" });
    const button = html.match(/<button\b[^>]*class="theme-toggle[^>]*>/)?.[0];
    assert.ok(button && /\bdisabled=""/.test(button), "SUN must not expose an interactive button before its listeners are ready");
    const shared = renderSunComponent(locale, { locale, initialTheme: "dark" }, new URL("../../../packages/ui/src/theme-toggle.tsx", import.meta.url), "ThemeToggle");
    assert.doesNotMatch(shared, /\bdisabled=/, "the readiness guard is opt-in for SUN, not a shared-platform behavior change");
    assert.match(shared, /theme-toggle__glyph--dark/);
  }
});

test("SUN loading provides localized documentary account access outside its busy state only through noscript", () => {
  const expected = [
    ["es-AR", "Mi cuenta", "Activá JavaScript para continuar", "El pasaporte y el acceso a tu cuenta necesitan JavaScript", "Abriendo el pasaporte"],
    ["en", "My account", "Enable JavaScript to continue", "The passport and account sign-in require JavaScript", "Opening the passport"],
    ["pt-BR", "Minha conta", "Ative o JavaScript para continuar", "O passaporte e o acesso à sua conta precisam de JavaScript", "Abrindo o passaporte"],
    ["unknown", "Mi cuenta", "Activá JavaScript para continuar", "El pasaporte y el acceso a tu cuenta necesitan JavaScript", "Abriendo el pasaporte"],
  ];
  for (const [locale, label, title, explanation, loading] of expected) {
    const html = renderSunComponent(locale, { locale }, new URL("../src/app/sun/sun-loading-view.tsx", import.meta.url), "SunLoadingView");
    const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0];
    const fallback = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
    assert.ok(main && fallback);
    assert.match(main, /data-testid="sun-loading" aria-busy="true"/);
    assert.ok(main.includes(loading) && main.includes('role="status"'));
    assert.doesNotMatch(main, /sun-nojs-account-link/);
    assert.ok(html.indexOf("</main>") < html.indexOf("<noscript>"), "fallback is a sibling of the busy passport loader");
    assert.ok(fallback.includes(title) && fallback.includes(explanation));
    assert.match(fallback, /aria-labelledby="sun-nojs-title"/);
    assert.match(fallback, /\[data-testid=sun-loading\] \{ display: none !important; \}/);
    const link = fallback.match(/<a\b[^>]*data-testid="sun-nojs-account-link"[^>]*>[\s\S]*?<\/a>/)?.[0];
    assert.ok(link && link.endsWith(`>${label}</a>`));
    assert.match(link, /href="\/me"/);
    assert.match(link, /referrerPolicy="no-referrer"/i);
    assert.doesNotMatch(fallback, /aria-busy|href="\/me\?|<script|<form|onClick|eventId|freshToken|tap-handoff/);
    assert.equal((html.match(/data-testid="sun-nojs-account-link"/g) || []).length, 1);
  }
});

test("account loading explains JavaScript requirement in each locale without an OTP promise or a documentary navigation loop", async () => {
  for (const [locale, title, loading] of [["es-AR", "Tu cuenta necesita JavaScript", "Abriendo tu cuenta"], ["en", "Your account requires JavaScript", "Opening your account"], ["pt-BR", "Sua conta precisa de JavaScript", "Abrindo sua conta"]]) {
    const html = renderSunComponent(locale, { locale, mode: "account" }, new URL("../src/app/sun/sun-loading-view.tsx", import.meta.url), "SunLoadingView");
    const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0];
    const fallback = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
    assert.ok(main && fallback && main.includes(loading));
    assert.match(main, /data-testid="account-loading" aria-busy="true"/);
    assert.match(main, /role="status"/);
    assert.ok(html.indexOf("</main>") < html.indexOf("<noscript>"));
    assert.ok(fallback.includes(title));
    assert.match(fallback, /data-testid="account-nojs-fallback"/);
    assert.match(fallback, /\[data-testid=account-loading\] \{ display: none !important; \}/);
    assert.doesNotMatch(fallback, /<a\b|<button\b|<form\b|<input\b|aria-busy|sun-nojs-account-link|href=|onClick|eventId|freshToken/);
    assert.doesNotMatch(main, /sun-loading-product-placeholder|NFC|Ubicación|Location|Localização/);
  }
  const loader = await readFile(new URL("../src/app/login/loading.tsx", import.meta.url), "utf8");
  assert.match(loader, /getWebI18n\(\)/);
  assert.match(loader, /<SunLoadingView locale=\{locale\} mode="account"\s*\/>/);
  assert.doesNotMatch(loader, /cookies\(|fetch\(|redirect\(|auth|session|token|code|contact/);
});

test("SUN no-script account action has a touch target, keyboard focus and readable solid colors in both themes", async () => {
  const css = postcss.parse(await readFile(new URL("../src/app/sun/sun-loading.module.css", import.meta.url), "utf8"));
  const rule = selector => css.nodes.find(node => node.type === "rule" && node.selector === selector);
  const value = (selector, property) => rule(selector).nodes.find(node => node.type === "decl" && node.prop === property).value;
  assert.equal(value(".accountLink", "min-height"), "2.75rem");
  assert.equal(value(".accountLink", "font-size"), "16px");
  assert.equal(value(".accountLink", "max-width"), "100%");
  assert.equal(value(".accountLink:focus-visible", "outline"), "3px solid #8bd8c3");
  assert.equal(value(":global(html[data-theme=light]) .accountLink:focus-visible", "outline-color"), "#086f62");
  const luminance = hex => {
    const normalized = hex.length === 4 ? '#' + [...hex.slice(1)].map(value => value + value).join('') : hex;
    const linear = normalized.slice(1).match(/.{2}/g).map(value => Number.parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  for (const selector of [".accountLink", ":global(html[data-theme=light]) .accountLink"]) {
    const a = luminance(value(selector, "color")), b = luminance(value(selector, "background"));
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, selector);
  }
});

test("SUN rendered account link is always plain portal access across locales and QR/NFC states, without a reading capability", () => {
  for (const [locale, label] of [["es-AR", "Mi cuenta"], ["en", "My account"], ["pt-BR", "Minha conta"]]) {
    for (const isQrScan of [false, true]) for (const livePillLabel of ["Muestra demo", "Tap físico activo", "Consulta segura", "Consulta pendiente"]) {
      const html = renderHeader(locale, { isQrScan, livePillLabel, pulseClass: "bg-emerald-300" });
      const account = html.match(/<a\b[^>]*data-testid="sun-account-link"[^>]*>[\s\S]*?<\/a>/g) || [];
      assert.equal(account.length, 1);
      assert.match(account[0], /\bhref="\/me"/);
      assert.match(account[0], /\breferrerPolicy="no-referrer"/i);
      assert.match(account[0], new RegExp(`>${label}</a>$`));
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
