import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../../../", import.meta.url));

function loadHelpBot() {
  const cache = new Map(), dynamicCalls = [], runtimeRequests = [];
  let pathname = "/";
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const output = ts.transpileModule(readFileSync(file, "utf8"), { fileName: file, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const dependency = request => {
      runtimeRequests.push({ file, request });
      if (request === "react" || request === "react/jsx-runtime") return require(request);
      if (request === "next/navigation") return { usePathname: () => pathname };
      if (request === "next/dynamic") return { __esModule: true, default: (loader, options) => {
        dynamicCalls.push({ loader, options });
        // The real Next SSR/preload behavior is checked in the built app. This
        // framework adapter renders the original component to verify its DOM.
        return props => React.createElement(load(resolve(root, "packages/ui/src/helpbot.tsx")).HelpBot, props);
      } };
      if (request === "framer-motion") return {
        useReducedMotion: () => false,
        motion: { span: ({ animate, initial, transition, children, ...props }) => React.createElement("span", props, children) },
      };
      if (request.startsWith(".")) {
        const base = resolve(dirname(file), request);
        const target = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")].find(candidate => existsSync(candidate) && /\.tsx?$/.test(candidate));
        if (target) return load(target);
      }
      throw new Error(`Unexpected HelpBot dependency: ${request}`);
    };
    new Function("require", "module", "exports", output)(dependency, module, module.exports);
    return module.exports;
  };
  const Contextual = load(resolve(root, "apps/web/src/components/contextual-helpbot.tsx")).ContextualHelpBot;
  return { Contextual, dynamicCalls, runtimeRequests, setPath: value => { pathname = value; }, load };
}

test("contextual HelpBot keeps consumer routes empty and preserves the public SSR button and locale", async () => {
  const runtime = loadHelpBot();
  assert.equal(runtime.dynamicCalls.length, 1);
  assert.equal(runtime.dynamicCalls[0].options.ssr, true);
  for (const pathname of ["/login", "/sun", "/sun/product", "/me", "/web3", "/demo-lab", "/docs", "/sdk", "/pricing", "/r/trace"]) {
    runtime.setPath(pathname);
    assert.equal(runtime.Contextual({ locale: "es-AR" }), null, pathname);
  }
  for (const pathname of ["/", "/about", "/products"]) {
    runtime.setPath(pathname);
    for (const [locale, label] of [["es-AR", "Abrir asistente"], ["en", "Open assistant"], ["pt-BR", "Abrir assistente"]]) {
      const original = runtime.load(resolve(root, "packages/ui/src/helpbot.tsx")).HelpBot;
      const html = renderToStaticMarkup(React.createElement(runtime.Contextual, { locale }));
      assert.equal(html, renderToStaticMarkup(React.createElement(original, { locale, mode: "sales" })));
      assert.ok(html.includes(`aria-label="${label}"`));
      assert.ok(html.includes("helpbot-trigger"));
    }
  }
});

test("the deferred HelpBot bridge resolves the original component without evaluating the UI barrel", async () => {
  const runtime = loadHelpBot();
  const before = runtime.runtimeRequests.slice();
  assert.ok(!before.some(({ request }) => request.includes("packages/ui") || request === "@product/ui"));
  const bridge = await runtime.dynamicCalls[0].loader();
  const original = runtime.load(resolve(root, "packages/ui/src/helpbot.tsx")).HelpBot;
  assert.equal(bridge.default, original);
  assert.ok(runtime.runtimeRequests.some(({ request }) => request === "../../../../packages/ui/src/helpbot"));
  assert.ok(!runtime.runtimeRequests.some(({ request }) => request === "@product/ui"));
});
