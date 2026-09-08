import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const componentUrl = new URL("../src/app/me/_components/", import.meta.url);
const navigationSource = readFileSync(new URL("portal-navigation.tsx", componentUrl), "utf8");
const shellSource = readFileSync(new URL("portal-shell.tsx", componentUrl), "utf8");
const css = readFileSync(new URL("portal-shell.module.css", componentUrl), "utf8");
const styles = new Proxy({}, { get: (_, name) => String(name) });

// Compile the production components without a browser, auth or API calls. Only
// router context, CSS and unrelated shell children are replaced. React renders
// the actual destination links, current-page state and dialog markup.
function loadComponents(pathname) {
  let navigation;
  const stubRequire = (request) => {
    if (request === "next/link") return {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement("a", props, children),
    };
    if (request === "next/navigation") return { usePathname: () => pathname };
    if (request.endsWith(".module.css")) return { __esModule: true, default: styles };
    if (request === "./portal-navigation") return navigation;
    if (request === "./tap-association-banner") return {
      TapAssociationBanner: () => React.createElement("div", { "data-test-tap-association": "preserved" }),
    };
    if (request === "./consumer-logout-button") return {
      ConsumerLogoutButton: () => React.createElement("button", { "data-test-consumer-logout": "preserved" }, "Salir"),
    };
    if (request.endsWith("/brand-home-link")) return {
      BrandHomeLink: () => React.createElement("a", { href: "/", "data-test-brand-home": "preserved" }, "nexID"),
    };
    if (request === "@product/ui") return {
      ThemeToggle: ({ locale }) => React.createElement("button", { "data-test-theme-toggle": "preserved", "data-test-locale": locale }, "Tema"),
    };
    if (["react", "react/jsx-runtime", "lucide-react"].includes(request)) return require(request);
    throw new Error(`Unexpected portal dependency: ${request}`);
  };
  const compile = (source, filename) => {
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    });
    const loaded = { exports: {} };
    new Function("require", "module", "exports", outputText)(stubRequire, loaded, loaded.exports);
    return loaded.exports;
  };
  navigation = compile(navigationSource, "portal-navigation.tsx");
  return { ...navigation, ...compile(shellSource, "portal-shell.tsx") };
}

const model = loadComponents("/me");
const primary = model.PORTAL_PRIMARY_DESTINATIONS;
const more = model.PORTAL_MORE_DESTINATIONS;
const expectedPrimary = [
  { label: "Inicio", href: "/me" },
  { label: "Productos", href: "/me/products" },
  { label: "Historial", href: "/me/taps" },
  { label: "Beneficios", href: "/me/rewards" },
];
const expectedMore = ["passport", "brands", "wallet", "marketplace", "experiences", "sommelier", "cork-analyzer", "privacy", "security"]
  .map((segment) => `/me/${segment}`);
const anchors = (html) => [...html.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/g)]
  .map((match) => ({ attributes: match[1], href: match[1].match(/\bhref="([^"]+)"/)?.[1], content: match[2] }));
function renderNavigation(pathname) {
  const { PortalNavigation } = loadComponents(pathname);
  return renderToStaticMarkup(React.createElement(PortalNavigation));
}

test("portal destinations preserve four primary routes and every existing secondary route exactly once", () => {
  assert.deepEqual(primary.map(({ label, href }) => ({ label, href })), expectedPrimary);
  assert.deepEqual(more.map(({ href }) => href).sort(), [...expectedMore].sort());
  const all = [...primary, ...more];
  assert.equal(new Set(all.map(({ href }) => href)).size, all.length);
  for (const { href, label } of all) {
    assert.ok(typeof label === "string" && label.trim(), `${href} has a visible label`);
    assert.ok(existsSync(new URL(`../src/app${href}/page.tsx`, import.meta.url)), `${href} resolves to an implemented page`);
  }
});

test("current destination matching treats home as exact and nested destinations as complete route segments", () => {
  const cases = [
    [null, "/me", false], ["", "/me", false], ["/", "/me", false],
    ["/me", "/me", true], ["/me/products", "/me", false], ["/me/products/item-1", "/me", false],
    ["/me/products", "/me/products", true], ["/me/products/item-1", "/me/products", true],
    ["/me/products-extra", "/me/products", false], ["/me/product", "/me/products", false],
    ["/me/marketplace/order-1", "/me/marketplace", true], ["/me/security", "/me/privacy", false],
    ["/me/security-log", "/me/security", false],
  ];
  for (const [pathname, href, expected] of cases) {
    assert.equal(model.isPortalDestinationActive(pathname, href), expected, `${pathname} -> ${href}`);
  }
});

test("one shared navigation has four destination links plus a More dialog button", () => {
  const html = renderNavigation("/me");
  const navs = [...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/g)]
    .filter((match) => /aria-label="Navegación del portal"/.test(match[1]));
  assert.equal(navs.length, 1, "desktop and mobile use the same destination DOM");
  assert.match(navs[0][1], /aria-label="Navegación del portal"/);
  assert.deepEqual(anchors(navs[0][2]).map(({ href }) => href), expectedPrimary.map(({ href }) => href));
  const buttons = [...navs[0][2].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length, 1, "the fifth slot opens More instead of another destination");
  assert.match(buttons[0][1], /type="button"/);
  assert.match(buttons[0][1], /aria-haspopup="dialog"/);
  assert.match(buttons[0][1], /aria-expanded="false"/);
  assert.match(buttons[0][2], /Más/);
});

test("rendered links announce the current page for primary, More and descendant destinations", () => {
  for (const destination of [...primary, ...more]) {
    for (const pathname of [destination.href, ...(destination.href === "/me" ? [] : [`${destination.href}/detail`])]) {
      const current = anchors(renderNavigation(pathname)).filter(({ attributes }) => /aria-current="page"/.test(attributes));
      assert.deepEqual(current.map(({ href }) => href), [destination.href], pathname);
    }
  }
  assert.equal(anchors(renderNavigation("/me/products-extra")).filter(({ attributes }) => /aria-current="page"/.test(attributes)).length, 0);
});

test("More uses a labelled native dialog and retains all secondary links without opening on first render", () => {
  const html = renderNavigation("/me/privacy");
  const dialog = html.match(/<dialog\b([^>]*)>([\s\S]*?)<\/dialog>/);
  assert.ok(dialog);
  assert.doesNotMatch(dialog[1], /\bopen(?:\s|=|$)/);
  const titleId = dialog[1].match(/aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(titleId, "the dialog has an accessible title");
  assert.ok(dialog[2].includes(`id="${titleId}"`));
  assert.deepEqual(anchors(dialog[2]).map(({ href }) => href).sort(), [...expectedMore].sort());
  assert.match(navigationSource, /\.showModal\(/);
  assert.match(navigationSource, /\.close\(/);
  assert.match(navigationSource, /onCancel=\{/);
  assert.match(navigationSource, /onClose=\{/);
  assert.match(navigationSource, /triggerRef\.current\?\.focus\(/);
  assert.match(navigationSource, /useEffect\([\s\S]*?closeMenu\([\s\S]*?\[[^\]]*pathname[^\]]*\]/);
});

test("navigation stays a synchronous client component using Next route state and internal links", () => {
  assert.match(navigationSource, /^\s*["']use client["']/);
  assert.match(navigationSource, /import\s+(?:NextLink|Link)\s+from\s+["']next\/link["']/);
  assert.match(navigationSource, /usePathname/);
  assert.match(navigationSource, /from\s+["']next\/navigation["']/);
  assert.doesNotMatch(navigationSource, /export\s+(?:default\s+)?async\s+function\s+PortalNavigation|window\.location|\bfetch\s*\(/);
});

test("portal shell preserves caller content, tap association, logout, brand and Spanish theme control", () => {
  const { PortalShell } = model;
  const render = (notificationCount) => renderToStaticMarkup(React.createElement(PortalShell, {
    title: "Mi colección de prueba", subtitle: "Contenido propio de la página", notificationCount,
  }, React.createElement("section", { "data-test-page-content": "preserved" }, "Contenido del destino")));
  const html = render(0);
  assert.match(html, /<h1\b[^>]*>Mi colección de prueba<\/h1>/);
  assert.match(html, /Contenido propio de la página/);
  for (const marker of ["tap-association", "consumer-logout", "brand-home", "theme-toggle", "page-content"]) {
    assert.match(html, new RegExp(`data-test-${marker}="preserved"`));
  }
  assert.match(html, /data-test-locale="es-AR"/);
  assert.ok(html.indexOf("data-test-tap-association") < html.indexOf("data-test-page-content"));
  assert.equal(render(7), html, "mixed-purpose legacy counts cannot become notification badges");
  assert.equal(render(Number.NaN), html, "unknown counts cannot invent visible status");
  assert.doesNotMatch(shellSource, /heroActions|item\.badge|NFC Ready|Core Active/);
});

test("portal CSS provides five mobile slots, a 64rem desktop switch, safe areas and visible keyboard focus", () => {
  assert.match(css, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(min-width:\s*64rem\)/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /min-(?:height|block-size):\s*(?:2\.75rem|44px)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.navigation\b[^{]*\{[^}]*position:\s*fixed/);
  assert.match(css, /@media\s*\(min-width:\s*64rem\)[\s\S]*?\.navigation\b[^{]*\{[^}]*position:\s*static/);
  assert.match(css, /^\.portal\s*\{[^}]*--portal-surface:\s*#ffffff;/m);
  assert.match(css, /:global\(html\.theme-dark\)|:global\(html\[data-theme=["']dark["']\]\)/);
  assert.match(css, /var\(--[^)]+\)/);
});

test("solid portal color tokens keep readable text, current-page accents and logout in both themes", () => {
  const palette = (block) => {
    assert.ok(block, "the theme must declare its palette");
    return Object.fromEntries([...block.matchAll(/(--portal-[a-z-]+):\s*(#[0-9a-f]{6});/gi)]
      .map((match) => [match[1], match[2]]));
  };
  const light = palette(css.match(/^\.portal\s*\{([^}]+)\}/m)?.[1]);
  const dark = palette(css.match(/:global\(html\[data-theme="dark"\]\)\s*\.portal\s*\{([^}]+)\}/)?.[1]);
  const luminance = (hex) => {
    assert.match(hex || "", /^#[0-9a-f]{6}$/i);
    const linear = hex.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  assert.notEqual(light["--portal-surface"], dark["--portal-surface"]);
  const pairs = [
    ...["surface", "base", "subtle"].flatMap((background) => [["text", background], ["muted", background]]),
    ["accent", "surface"], ["accent", "active"], ["danger", "danger-bg"],
  ];
  for (const [theme, variables] of [["light", light], ["dark", dark]]) {
    for (const [foreground, background] of pairs) {
      const first = luminance(variables[`--portal-${foreground}`]);
      const second = luminance(variables[`--portal-${background}`]);
      const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
      assert.ok(ratio >= 4.5, `${theme} ${foreground}/${background}: ${ratio.toFixed(2)} must reach 4.5:1`);
    }
  }
});
