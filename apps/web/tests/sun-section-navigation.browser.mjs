// Real SUN navigation and locale components, synthetic local sections/controls.
// No SUN/API requests or physical tag evidence. Set PLAYWRIGHT_MODULE to an installed runtime.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const web = join(root, "apps/web");
const navPath = join(web, "src/app/sun/sun-section-nav.tsx");
const source = await readFile(navPath, "utf8");
const baselineRef = process.env.NAV_BASELINE_REF || "989ad2deb343e16e7452d60f4850d38134f09057";
const baseline = execFileSync("git", ["show", `${baselineRef}:apps/web/src/app/sun/sun-section-nav.tsx`], { cwd: root, encoding: "utf8" });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const globals = await readFile(join(web, "src/app/globals.css"), "utf8");
const css = (await postcss([tailwindcss({ base: web })]).process(globals, { from: join(web, "src/app/globals.css") })).css;
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {SunSectionNav} from './src/app/sun/sun-section-nav';
import {SunLocaleProvider} from './src/app/sun/sun-locale-provider';
const agro=new URLSearchParams(location.search).has('agro');
createRoot(document.getElementById('app')).render(<SunLocaleProvider initialLocale="es-AR"><main className="sun-tap-experience" id="fixture-main">
  <SunSectionNav variant={agro?'agro':'default'}/><div id="prelude"/>
  <section id={agro?'agro-dpp':'sun-summary'} className="fixture-section"><h1 id="summary-title">Producto local de prueba</h1></section>
  <section id="sun-origin" className="fixture-section"><h2 id="origin-title">Origen local</h2><button>Acción de origen</button></section>
  <section id="sun-condition" className="fixture-section"><h2 id="condition-title">Estado local</h2><button>Acción de estado</button></section>
  <section id="sun-services" className="fixture-section"><h2 id="services-title">Servicios locales</h2><button>Acción de servicio</button></section>
  <div id="tail"/>
</main></SunLocaleProvider>);`;
const bundles = {};
for (const revision of ["before", "after"]) {
  const plugins = revision === "before" ? [{ name: "baseline-nav", setup(builder) {
    builder.onLoad({ filter: /sun-section-nav[.]tsx$/ }, args => ({ contents: baseline, loader: "tsx", resolveDir: dirname(args.path) }));
  } }] : [];
  const result = await build({ stdin: { contents: fixture, resolveDir: web, loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins, logLevel: "silent" });
  bundles[revision] = result.outputFiles[0].contents;
}
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://fixture.invalid");
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  if (url.pathname === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(bundles[url.searchParams.get("revision") === "before" ? "before" : "after"]); }
  if (url.pathname === "/fixture.css") { res.setHeader("Content-Type", "text/css"); return res.end(css); }
  if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
  const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  res.end(`<!doctype html><html lang="es-AR" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SUN navigation local test</title><link rel="stylesheet" href="/fixture.css"><style>
body{margin:0;font:16px system-ui;overflow-anchor:none}#fixture-main{box-sizing:border-box;max-width:900px;margin:0 auto;padding:0 12px}#prelude{height:100px}#tail{height:900px}.fixture-section{box-sizing:border-box;height:900px;scroll-margin-top:96px;padding:24px;border:1px solid #64748b}button{min-height:44px}h1,h2{font-size:24px;margin:0 0 20px}
</style></head><body><div id="app"></div><script src="/fixture.js?revision=${url.searchParams.get("revision") || "after"}"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const report = { localSyntheticDom: true, realReactComponent: true, baselineRef, physicalTapMeasured: false, checks: [], views: [], motion: [], performance: [], errors: [] };
const check = (passed, name) => { report.checks.push({ name, passed: Boolean(passed) }); assert.ok(passed, name); };
const output = process.env.QA_OUTPUT;
if (output) await mkdir(output, { recursive: true });

async function openFixture({ width = 390, theme = "dark", revision = "after", agro = false, reducedMotion = "reduce" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.addInitScript(() => {
    const sectionIds = new Set(["sun-summary", "agro-dpp", "sun-origin", "sun-condition", "sun-services"]);
    window.navMetrics = { avoidQueries: 0, sectionRects: 0, avoidRects: 0, dockReads: 0, frames: 0 };
    window.navListeners = { scroll: 0, resize: 0 };
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, ...args) { if (this === window && type in window.navListeners) window.navListeners[type]++; return add.call(this, type, ...args); };
    EventTarget.prototype.removeEventListener = function(type, ...args) { if (this === window && type in window.navListeners) window.navListeners[type]--; return remove.call(this, type, ...args); };
    const query = document.querySelectorAll.bind(document);
    document.querySelectorAll = (selector) => { if (selector === "[data-sun-dock-avoid]") window.navMetrics.avoidQueries++; return query(selector); };
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() { if (sectionIds.has(this.id)) window.navMetrics.sectionRects++; if (this.hasAttribute("data-sun-dock-avoid")) window.navMetrics.avoidRects++; return rect.call(this); };
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { ...height, get() { if (this.classList.contains("sun-mobile-dock")) window.navMetrics.dockReads++; return height.get.call(this); } });
    const style = window.getComputedStyle;
    window.getComputedStyle = function(node, ...args) { if (node.classList.contains("sun-mobile-dock")) window.navMetrics.dockReads++; return style.call(this, node, ...args); };
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => raf.call(window, timestamp => { if (["syncNavigation", "syncActiveSection", "syncDockVisibility"].includes(callback.name)) window.navMetrics.frames++; callback(timestamp); });
  });
  await page.goto(`${origin}/?revision=${revision}&theme=${theme}${agro ? "&agro=1" : ""}`);
  await page.locator(".sun-mobile-dock").waitFor({ state: "attached" });
  await idle(page);
  return { context, page };
}
async function frames(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))); }
async function idle(page) { await page.waitForTimeout(720); await frames(page); }
async function scrollTo(page, y, settle = true) { await page.evaluate(value => window.scrollTo(0, value), y); await frames(page); if (settle) await idle(page); }
async function sectionTop(page, id) { return page.locator(`#${id}`).evaluate(node => node.getBoundingClientRect().top + scrollY); }
async function activeId(page, width) { return page.locator(width < 1024 ? ".sun-mobile-dock a[aria-current]" : "nav:not(.sun-mobile-dock) a[aria-current]").getAttribute("href"); }
async function dockShown(page) { return (await page.locator(".sun-mobile-dock").getAttribute("aria-hidden")) === "false"; }

try {
  for (const theme of ["light", "dark"]) for (const width of [320, 390, 768, 1440]) {
    const { context, page } = await openFixture({ width, theme });
    const label = `${width} ${theme}`;
    check(await activeId(page, width) === "#sun-summary", `Initial active summary ${label}`);
    check(!(await dockShown(page)), `Dock hidden before intro clears ${label}`);
    check(await page.locator(".sun-mobile-dock").evaluate(node => node.inert && [...node.querySelectorAll("a")].every(link => link.tabIndex === -1)), `Hidden dock is inert ${label}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal overflow ${label}`);
    check(await page.locator(".sun-mobile-dock").evaluate(node => { const style = getComputedStyle(node); return style.transitionProperty === "none" || style.transitionDuration === "0s"; }), `Reduced-motion dock ${label}`);
    const summaryBottom = await page.locator("#sun-summary").evaluate(node => node.getBoundingClientRect().bottom + scrollY);
    await scrollTo(page, summaryBottom - 900 + 62);
    check(!(await dockShown(page)), `Dock reserves summary clearance ${label}`);
    await scrollTo(page, summaryBottom - 900 + 82);
    check(await dockShown(page) === (width < 1024), `Dock reveals after summary ${label}`);
    if (width < 1024) {
      await page.evaluate(() => scrollBy(0, 80)); await frames(page);
      check(!(await dockShown(page)), `Downward scroll hides dock ${label}`);
      await idle(page);
      check(await dockShown(page), `Idle restores dock ${label}`);
      await page.evaluate(() => scrollBy(0, -20)); await frames(page);
      check(await dockShown(page), `Upward scroll restores dock ${label}`);
      check(await page.locator(".sun-mobile-dock a").evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44)), `Touch targets at least 44px ${label}`);
    }
    for (const id of ["sun-origin", "sun-condition", "sun-services"]) {
      await scrollTo(page, await sectionTop(page, id) + 32);
      check(await activeId(page, width) === `#${id}`, `Active ${id} follows scroll ${label}`);
    }
    await scrollTo(page, await sectionTop(page, "sun-origin") + 32);
    await page.evaluate(() => document.querySelector("#prelude").style.height = "450px"); await frames(page);
    check(await activeId(page, width) === "#sun-summary", `Resize invalidates cached section positions ${label}`);
    await page.evaluate(() => document.querySelector("#prelude").style.height = "100px"); await frames(page);
    check(await activeId(page, width) === "#sun-origin", `Restored layout updates active section ${label}`);
    await page.evaluate(() => { window.removedOrigin = document.querySelector("#sun-origin"); window.removedOrigin.remove(); }); await frames(page);
    check(await activeId(page, width) === "#sun-condition", `Removed section leaves active navigation ${label}`);
    await page.evaluate(() => document.querySelector("#sun-condition").before(window.removedOrigin)); await frames(page);
    check(await activeId(page, width) === "#sun-origin", `Inserted section joins active navigation ${label}`);

    const nav = page.locator(width < 1024 ? ".sun-mobile-dock" : "nav:not(.sun-mobile-dock)");
    await idle(page);
    const keyboardLink = nav.locator('a[href="#sun-condition"]');
    await keyboardLink.focus(); await keyboardLink.press("Enter"); await frames(page);
    check(new URL(page.url()).hash === "#sun-condition", `Keyboard preserves native hash ${label}`);
    check(await page.evaluate(() => document.activeElement?.id === "condition-title"), `Keyboard moves focus to destination heading ${label}`);
    check(await activeId(page, width) === "#sun-condition", `Keyboard destination remains active ${label}`);
    await page.keyboard.press("Tab");
    check(await page.locator("#condition-title").getAttribute("tabindex") === null, `Temporary heading tab index is cleaned ${label}`);
    await idle(page);
    await nav.locator('a[href="#sun-origin"]').click(); await frames(page);
    check(new URL(page.url()).hash === "#sun-origin", `Pointer preserves native anchor ${label}`);
    check(await page.locator("#origin-title").getAttribute("tabindex") === null, `Pointer does not add heading focus ${label}`);
    await idle(page);

    if (width < 1024) {
      await page.evaluate(() => {
        const control = document.createElement("button"); control.id = "fixture-avoid"; control.textContent = "Control local"; control.setAttribute("data-sun-dock-avoid", "");
        Object.assign(control.style, { position: "absolute", top: `${scrollY + innerHeight - 40}px`, left: "12px", height: "44px" }); document.body.append(control);
      }); await frames(page);
      check(!(await dockShown(page)), `Inserted control avoids dock occlusion ${label}`);
      check(await page.locator(".sun-mobile-dock").evaluate(node => node.inert), `Occluded dock is inert ${label}`);
      await page.evaluate(() => document.querySelector(".sun-mobile-dock a").focus());
      check(await page.evaluate(() => !document.activeElement?.closest(".sun-mobile-dock")), `Hidden dock cannot receive focus ${label}`);
      await page.evaluate(() => document.querySelector("#fixture-avoid").removeAttribute("data-sun-dock-avoid")); await frames(page);
      check(await dockShown(page), `Avoid attribute removal restores dock ${label}`);
      await page.evaluate(() => document.querySelector("#fixture-avoid").setAttribute("data-sun-dock-avoid", "")); await frames(page);
      check(!(await dockShown(page)), `Avoid attribute addition hides dock ${label}`);
      await page.evaluate(() => document.querySelector("#fixture-avoid").style.top = `${scrollY + 100}px`); await frames(page);
      await page.waitForFunction(() => document.querySelector(".sun-mobile-dock").getAttribute("aria-hidden") === "false", null, { timeout: 600 });
      check(await dockShown(page), `Moved control refreshes cached geometry ${label}`);
      await page.evaluate(() => document.querySelector("#fixture-avoid").remove()); await frames(page);
    }
    if (output) {
      const screenshot = `nav-${width}-${theme}.png`;
      await idle(page); await page.screenshot({ path: join(output, screenshot), fullPage: false });
      report.views.push({ width, theme, screenshot });
    } else report.views.push({ width, theme });
    await context.close();
  }
  for (const theme of ["light", "dark"]) {
    const { context, page } = await openFixture({ theme, agro: true });
    check(await activeId(page, 390) === "#agro-dpp", `Agro uses product anchor ${theme}`);
    await scrollTo(page, 280); check(!(await dockShown(page)), `Agro intro threshold ${theme}`);
    await scrollTo(page, 300); check(await dockShown(page), `Agro dock after intro ${theme}`);
    await context.close();
  }
  for (const width of [390, 1440]) for (const revision of ["before", "after"]) {
    const { context, page } = await openFixture({ width, revision, reducedMotion: "no-preference" });
    await scrollTo(page, await sectionTop(page, "sun-origin") + 120);
    if (width === 390 && revision === "after") {
      await page.evaluate(() => window.scrollBy(0, 80)); await frames(page);
      check(!(await dockShown(page)), "Normal-motion dock starts hidden before slide restoration");
      const properties = await page.locator(".sun-mobile-dock").evaluate(node => {
        window.dockTransitionProperties = [];
        window.dockMotionSamples = [];
        window.dockMotionCaptureStarted = false;
        node.addEventListener("transitionrun", event => {
          if (event.target !== node) return;
          window.dockTransitionProperties.push(event.propertyName);
          if (event.propertyName !== "translate" || window.dockMotionCaptureStarted) return;
          window.dockMotionCaptureStarted = true;
          const capture = () => {
            const animation = node.getAnimations().find(item => item.transitionProperty === "translate");
            const style = getComputedStyle(node);
            window.dockMotionSamples.push({
              translate: style.translate,
              opacity: Number(style.opacity),
              progress: animation?.effect?.getComputedTiming().progress ?? null,
              playState: animation?.playState ?? "finished",
            });
            if (window.dockMotionSamples.length < 24 && animation?.playState === "running") {
              requestAnimationFrame(capture);
            }
          };
          requestAnimationFrame(capture);
        });
        return getComputedStyle(node).transitionProperty.split(",").map(value => value.trim());
      });
      check(properties.includes("translate"), "Normal-motion dock transitions its individual translate property");
      await page.evaluate(() => window.scrollBy(0, -24));
      await page.waitForFunction(() => window.dockMotionSamples.some(sample =>
        typeof sample.progress === "number" && sample.progress > 0 && sample.progress < 1 &&
        sample.opacity > 0 && sample.opacity < 1
      ), null, { timeout: 1200 });
      const motion = await page.locator(".sun-mobile-dock").evaluate(node => {
        const samples = window.dockMotionSamples.slice(0, 24);
        const interpolated = samples.find(sample => typeof sample.progress === "number" &&
          sample.progress > 0 && sample.progress < 1 && sample.opacity > 0 && sample.opacity < 1);
        return { properties: window.dockTransitionProperties, samples, ...interpolated };
      });
      check(motion.properties.includes("opacity") && motion.properties.includes("translate"), "Actual dock restoration runs opacity and sliding transitions");
      check(typeof motion.progress === "number" && motion.progress > 0 && motion.progress < 1 &&
        motion.opacity > 0 && motion.opacity < 1, "Dock translation interpolates during normal motion");
      report.motion.push({ width, reducedMotion: "no-preference", ...motion });
      await idle(page);
    }
    const listeners = await page.evaluate(() => ({ ...window.navListeners }));
    const metrics = await page.evaluate(async () => {
      for (const key of Object.keys(window.navMetrics)) window.navMetrics[key] = 0;
      for (let i = 0; i < 30; i++) { window.scrollBy(0, i % 2 ? -8 : 8); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }
      return { ...window.navMetrics };
    });
    report.performance.push({ width, revision, measuredScrollSteps: 30, listeners, ...metrics });
    await context.close();
  }
  for (const width of [390, 1440]) {
    const before = report.performance.find(row => row.width === width && row.revision === "before");
    const after = report.performance.find(row => row.width === width && row.revision === "after");
    check(before.listeners.scroll === 2 && after.listeners.scroll === 1, `One scroll listener instead of two ${width}`);
    check(before.listeners.resize === 2 && after.listeners.resize === 1, `One resize listener instead of two ${width}`);
    check(before.avoidQueries >= 20 && after.avoidQueries === 0, `No avoid DOM queries during scroll ${width}`);
    check(before.sectionRects > 0 && after.sectionRects === 0, `No unchanged section layout reads during scroll ${width}`);
    check(before.dockReads >= 40 && after.dockReads === 0, `No unchanged or desktop dock layout/style reads ${width}`);
    check(after.frames <= before.frames / 2 + 2, `One scheduled navigation frame ${width}`);
  }
  check(!report.errors.length, "No browser or React exceptions");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  if (output) await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ checks: report.checks.length, failed: report.checks.filter(row => !row.passed), views: report.views.length, performance: report.performance, evidence: "LOCAL real component, synthetic sections and controls; no physical NFC certification" }, null, 2));
