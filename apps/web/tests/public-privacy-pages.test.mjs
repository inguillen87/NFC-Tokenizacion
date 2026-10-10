import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const linkModule = { __esModule: true, default: ({ children, prefetch, ...props }) => React.createElement("a", props, children) };

async function compile(path, modules) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)((id) => {
    if (Object.hasOwn(modules, id)) return modules[id];
    if (id === "react/jsx-runtime") return require(id);
    throw new Error(`Unexpected public page dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}

async function renderPublicPage(page, theme = "light") {
  const cookieReads = [];
  const icon = () => React.createElement("svg", { "aria-hidden": "true" });
  const shell = await compile("../src/components/public-legal-shell.tsx", {
    "next/link": linkModule,
    "next/headers": { cookies: async () => ({ get: (name) => { cookieReads.push(name); return name === "theme" ? { value: theme } : { value: "v2" }; } }) },
    "lucide-react": { ArrowLeft: icon, ArrowUpRight: icon, Mail: icon },
    "@product/ui": { ThemeToggle: ({ initialTheme }) => React.createElement("button", { type: "button", "aria-label": "Cambiar apariencia" }, initialTheme) },
    "@product/ui/theme-preference": { resolveThemePreference: (value) => value === "dark" ? "dark" : "light", THEME_PREFERENCE_VERSION_COOKIE: "nexid_theme_preference" },
    "./brand-home-link": { BrandHomeLink: () => React.createElement("a", { href: "/", "aria-label": "Inicio de NexID" }, "nexID") },
    "./public-legal-shell.module.css": { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) },
  });
  const loaded = await compile(`../src/app/${page}/page.tsx`, {
    "next/link": linkModule,
    "../../components/public-legal-shell": shell,
  });
  const pageElement = loaded.default();
  const shellElement = await pageElement.type(pageElement.props);
  return { html: renderToStaticMarkup(shellElement), metadata: loaded.metadata, cookieReads };
}

test("both privacy documents render publicly with no identity, session or API dependency", async () => {
  for (const page of ["privacy", "data-deletion"]) {
    const { html, cookieReads } = await renderPublicPage(page);
    assert.ok(html.includes('lang="es-AR"'));
    assert.ok(html.includes('id="legal-content"'));
    assert.ok(html.includes('href="#legal-content"'));
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.deepEqual(cookieReads, ["theme", "nexid_theme_preference"]);
    assert.ok(html.includes("GUILLEN MARCELO ARIEL"));
    assert.ok(html.includes("info@nexid.lat"));
    assert.equal((html.match(/<form/g) || []).length, 0, "visiting a document never submits a deletion or access request");
  }
});

test("request links use the documented public email and make deletion an explicit email action", async () => {
  const { html } = await renderPublicPage("data-deletion");
  const requestLinks = [...html.matchAll(/href="(mailto:[^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  assert.ok(requestLinks.length >= 2);
  for (const href of requestLinks) assert.equal(new URL(href).pathname, "info@nexid.lat");
  assert.ok(requestLinks.some((href) => new URL(href).searchParams.get("subject") === "Solicitud de eliminación de datos NexID"));
  assert.ok(html.includes("la solicitud se envía cuando vos enviás el mensaje"));
  assert.ok(html.includes("no ejecuta una eliminación automática"));
  assert.ok(html.includes("No envíes códigos de verificación"));
});

test("navigation and metadata keep public documents separate from the authenticated privacy view", async () => {
  const scope = await compile("../src/lib/clerk-route-scope.ts", {});
  for (const page of ["privacy", "data-deletion"]) {
    const { html, metadata } = await renderPublicPage(page);
    assert.equal(scope.requiresClerkMiddleware(`/${page}`), false);
    assert.equal(metadata.alternates.canonical, `https://nexid.lat/${page}`);
    assert.equal(metadata.openGraph.locale, "es_AR");
    assert.ok(html.includes('href="/privacy"'));
    assert.ok(html.includes('href="/data-deletion"'));
    assert.ok(html.includes('href="/me/privacy"'));
    assert.ok(html.includes("iniciar sesión") || html.includes("necesitás iniciar sesión"));
    assert.ok(html.includes('aria-current="page"'));
  }
});

test("server markup retains the document and email action with an anonymous dark preference", async () => {
  const light = await renderPublicPage("privacy", "light");
  const dark = await renderPublicPage("privacy", "dark");
  for (const { html } of [light, dark]) {
    assert.ok(html.includes("Ubicación y permisos"));
    assert.ok(html.includes("Podés continuar sin compartirla"));
    assert.ok(html.includes("no autoriza por sí solo mensajes comerciales"));
    assert.ok(html.includes('href="mailto:info@nexid.lat?subject='));
  }
  assert.ok(dark.html.includes(">dark</button>"));
  assert.ok(light.html.includes(">light</button>"));
});
