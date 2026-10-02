import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/brand-home-link.tsx", import.meta.url), "utf8");
const staticSource = readFileSync(new URL("../src/components/brand-home-link-static.tsx", import.meta.url), "utf8");
const typesSource = readFileSync(new URL("../src/components/brand-home-link-types.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/brand-home-link.module.css", import.meta.url), "utf8");
const styles = new Proxy({}, { get: (_, key) => String(key) });
const Link = React.forwardRef(({ children, prefetch, ...props }, ref) => React.createElement("a", { ...props, ref }, children));

// Render the real web component and original shared artwork. Only framework
// navigation, CSS and Framer's browser animation driver are replaced.
function loadBrand(hooks = React, brandSource = source, options = {}) {
  const shared = new Map();
  const local = new Map();
  const compile = (text, file, dependency) => {
    const output = ts.transpileModule(text, { fileName: file, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} };
    new Function("require", "module", "exports", output)(dependency, module, module.exports);
    return module.exports;
  };
  const loadShared = name => {
    if (!shared.has(name)) shared.set(name, compile(
      readFileSync(new URL(`../../../packages/ui/src/brand/${name}.tsx`, import.meta.url), "utf8"),
      `${name}.tsx`, dependency,
    ));
    return shared.get(name);
  };
  const loadLocal = (name, text) => {
    if (!local.has(name)) local.set(name, compile(text, `${name}.tsx`, dependency));
    return local.get(name);
  };
  const dependency = request => {
    options.runtimeDependencies?.push(request);
    if (options.forbidHeavy && (request === "@product/ui" || request === "framer-motion")) {
      throw new Error(`Static entry evaluated an animated dependency: ${request}`);
    }
    if (request === "react") return hooks;
    if (request === "react/jsx-runtime") return require(request);
    if (request === "next/link") return { __esModule: true, default: Link };
    if (request.endsWith(".module.css")) return { __esModule: true, default: styles };
    if (request === "./brand-home-link-types") return loadLocal("brand-home-link-types", typesSource);
    if (request === "./brand-home-link-static") return loadLocal("brand-home-link-static", staticSource);
    if (request === "@product/ui") return { ...loadShared("brand-lockup"), ...loadShared("brand-mark") };
    if (request === "./types") return { cx: (...names) => names.filter(Boolean).join(" ") };
    if (request.startsWith("./brand-")) return loadShared(request.slice(2));
    if (request === "framer-motion") return {
      useReducedMotion: () => false,
      motion: { span: ({ animate, initial, transition, children, ...props }) => React.createElement("span", props, children) },
    };
    throw new Error(`Unexpected brand dependency: ${request}`);
  };
  return compile(brandSource, "brand-home-link.tsx", dependency)[options.exportName || "BrandHomeLink"];
}

test("compact static identity preserves the published SUN/account markup exactly", () => {
  const published = JSON.parse(readFileSync(new URL("fixtures/brand-home-link-static-79b864d3.json", import.meta.url), "utf8"));
  assert.equal(published.sourceCommit, "79b864d3de593919f1913e9d42e0b880760ff737");
  const current = loadBrand();
  for (const { props, html } of published.cases) {
    assert.equal(renderToStaticMarkup(React.createElement(current, props)), html);
  }
});

test("the SUN static entry preserves published markup without evaluating UI or animation modules", () => {
  const published = JSON.parse(readFileSync(new URL("fixtures/brand-home-link-static-79b864d3.json", import.meta.url), "utf8"));
  const runtimeDependencies = [];
  const StaticBrand = loadBrand(React, staticSource, { exportName: "StaticBrandHomeLink", forbidHeavy: true, runtimeDependencies });
  for (const { props, html } of published.cases) {
    assert.equal(renderToStaticMarkup(React.createElement(StaticBrand, props)), html);
  }
  assert.ok(runtimeDependencies.includes("next/link"));
  assert.ok(runtimeDependencies.includes("./brand-home-link.module.css"));
  assert.ok(!runtimeDependencies.some(request => /framer-motion|@product\/ui|brand-(?:dot|mark|lockup|wordmark)/.test(request)));
});

test("the static entry keeps native home navigation and callbacks without hooks", () => {
  const StaticBrand = loadBrand({ ...React,
    useState: () => { throw new Error("static identity allocated state"); },
    useRef: () => { throw new Error("static identity allocated a ref"); },
    useEffect: () => { throw new Error("static identity registered effects"); },
  }, staticSource, { exportName: "StaticBrandHomeLink", forbidHeavy: true });
  for (const [locale, label] of [["es-AR", "Ir al inicio de nexID"], ["en", "Go to the nexID home page"], ["pt-BR", "Ir para o início da nexID"]]) {
    let called = 0;
    const link = StaticBrand({ locale, onNavigate: () => called++ });
    assert.equal(link.props.href, "/");
    assert.equal(link.props.prefetch, false);
    assert.equal(link.props["aria-label"], label);
    assert.equal(link.props["data-brand-motion"], undefined);
    assert.equal(link.props["data-brand-motion-active"], undefined);
    link.props.onClick();
    assert.equal(called, 1);
  }
});

test("public opt-in renders original mark and wordmark without starting SVG motion on the server", () => {
  const Brand = loadBrand();
  for (const variant of ["pulse", "ripple"]) {
    const html = renderToStaticMarkup(React.createElement(Brand, { size: 64, variant }));
    assert.match(html, /brand-n-path[^>]*d="M47 104V56H58L86 91V56H99V104H88L60 69V104H47Z"/);
    assert.match(html, /brand-wordmark-text--main/);
    assert.match(html, /data-brand-motion-active="false"/);
    assert.match(html, /brand-lockup--static/);
    assert.doesNotMatch(html, /<animateTransform/);
  }
});

test("home links retain native destinations, localized names, callback and disabled prefetch", () => {
  const hooks = { ...React, useRef: () => ({ current: null }), useState: () => [false, () => {}], useEffect: () => {} };
  const Brand = loadBrand(hooks);
  for (const [locale, label] of [["es-AR", "Ir al inicio de nexID"], ["en", "Go to the nexID home page"], ["pt-BR", "Ir para o início da nexID"]]) {
    let called = 0;
    const link = Brand({ locale, variant: "pulse", onNavigate: () => called++ });
    assert.equal(link.props.href, "/");
    assert.equal(link.props.prefetch, false);
    assert.equal(link.props["aria-label"], label);
    link.props.onClick();
    assert.equal(called, 1);
  }
});

test("real motion lifecycle stops hidden/reduced/offscreen timelines and resumes only in view", () => {
  let active = false, effectCursor = 0, pauses = 0, resumes = 0, observed = 0, disconnected = 0, callback;
  const effects = [], pending = [], visibility = new Set(), preferenceListeners = new Set();
  const svg = { pauseAnimations: () => pauses++, unpauseAnimations: () => resumes++ };
  const anchor = { querySelectorAll: () => [svg] };
  const preference = { matches: false, addEventListener: (_, fn) => preferenceListeners.add(fn), removeEventListener: (_, fn) => preferenceListeners.delete(fn) };
  const document = { hidden: false, addEventListener: (_, fn) => visibility.add(fn), removeEventListener: (_, fn) => visibility.delete(fn) };
  const previousGlobals = Object.fromEntries(["window", "document", "IntersectionObserver"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { window: { matchMedia: () => preference }, document, IntersectionObserver: class {
    constructor(fn) { callback = fn; }
    observe(node) { assert.equal(node, anchor); observed++; }
    disconnect() { disconnected++; }
  } });
  const hooks = { ...React,
    useRef: () => ({ current: anchor }), useState: () => [active, value => { active = value; }],
    useEffect: (fn, deps) => {
      const index = effectCursor++;
      if (!effects[index] || deps.some((value, i) => value !== effects[index].deps[i])) pending.push({ index, fn, deps });
    },
  };
  try {
    const Brand = loadBrand(hooks);
    const render = (variant = "ripple") => {
      effectCursor = 0;
      const element = Brand({ variant, size: 64 });
      while (pending.length) { const { index, fn, deps } = pending.shift(); effects[index]?.cleanup?.(); effects[index] = { deps, cleanup: fn() }; }
      return element;
    };
    assert.equal(render().props["data-brand-motion-active"], false);
    assert.equal(observed, 1);
    assert.equal(visibility.size, 1);
    assert.equal(preferenceListeners.size, 1);
    callback([{ target: anchor, isIntersecting: true }]);
    const running = render();
    assert.equal(running.props["data-brand-motion-active"], true);
    assert.match(renderToStaticMarkup(running), /<animateTransform/);
    assert.ok(resumes > 0);
    document.hidden = true;
    const beforePause = pauses;
    visibility.forEach(fn => fn());
    assert.ok(pauses > beforePause, "SVG freezes immediately on visibility event");
    assert.doesNotMatch(renderToStaticMarkup(render()), /<animateTransform/);
    document.hidden = false; visibility.forEach(fn => fn());
    assert.equal(render().props["data-brand-motion-active"], true);
    preference.matches = true; preferenceListeners.forEach(fn => fn());
    assert.equal(render().props["data-brand-motion-active"], false);
    preference.matches = false; preferenceListeners.forEach(fn => fn());
    assert.equal(render().props["data-brand-motion-active"], true);
    callback([{ target: anchor, isIntersecting: false }]);
    assert.equal(render().props["data-brand-motion-active"], false);
    assert.doesNotMatch(renderToStaticMarkup(render()), /<animateTransform/);
    callback([{ target: anchor, isIntersecting: true }]);
    assert.equal(render().props["data-brand-motion-active"], true);
    render("static");
    assert.equal(disconnected, 1);
    assert.equal(visibility.size, 0);
    assert.equal(preferenceListeners.size, 0);
  } finally {
    effects.forEach(effect => effect.cleanup?.());
    for (const [key, descriptor] of Object.entries(previousGlobals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});

test("static callers never attach motion observers or preference/visibility listeners", () => {
  const effects = [];
  const hooks = { ...React, useRef: () => ({ current: {} }), useState: () => [false, () => {}], useEffect: fn => effects.push(fn) };
  const Brand = loadBrand(hooks);
  Brand({ variant: "static", size: 44 });
  for (const effect of effects) assert.equal(effect(), undefined);
});

test("scoped artwork keeps document-theme authority and enforces inactive/reduced CSS motion", () => {
  assert.match(css, /\.homeLink\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  assert.match(css, /html\[data-theme="dark"\][\s\S]*\.originalIdentity \.originalLockup/);
  assert.match(css, /html\[data-theme="light"\][\s\S]*\.originalIdentity \.originalLockup/);
  assert.match(css, /data-brand-motion-active="false"[\s\S]*animation-play-state: paused !important/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
  assert.doesNotMatch(source, /addEventListener\("(?:scroll|resize)"/);
});
