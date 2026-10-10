// Real React component/CSS; local synthetic fetch responses and router only.
// This is not an actual Next/BFF, signed NFC, authenticated or production test.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const root = fileURLToPath(new URL("../../../", import.meta.url)), web = join(root, "apps/web");
const output = resolve(process.env.QA_OUTPUT || join(root, "artifacts/consumer-handoff-recovery"));
await mkdir(output, { recursive: true });
const sourcePaths = ["apps/web/src/app/sun/consumer-passport-link.tsx", "apps/web/src/app/sun/sun-locale-provider.tsx", "apps/web/src/app/sun/sun-locale.ts", "apps/web/src/app/sun/sun-passport-experience.module.css", "apps/web/src/app/globals.css", "apps/web/tests/post-tap-navigation-handoff.test.mjs", "apps/web/tests/consumer-handoff-recovery.browser.mjs", "apps/web/tests/browser/consumer-handoff-recovery.fixture.tsx"];
const hashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash("sha256").update(await readFile(join(root, path))).digest("hex")])));
const report = { localOnly: true, actualReactComponent: true, actualNextAndBff: false, syntheticHandoffAndNavigation: true, productionOrPhysicalTapVerified: false, sourceHashesStart: await hashes(), checks: [], views: [], contexts: [], errors: [], browserClosed: false, serverClosed: false };
const check = (passed, name) => { report.checks.push({ name, passed: Boolean(passed) }); assert.ok(passed, name); };
const nextShim = `import React from 'react';export const useRouter=()=>({push(href){window.__handoffPushes.push(href);if(window.__handoffNavigationMode==='throw')throw Error('synthetic_navigation_failure');const commit=()=>{history.pushState(null,'',href);window.dispatchEvent(new Event('fixture-navigate'));};if(window.__handoffNavigationMode==='hold'){window.__handoffCommit=commit;return;}commit();}});export default React.forwardRef(function Link({prefetch,...props},ref){return <a {...props} ref={ref} data-prefetch={String(prefetch)}/>});`;
const bundle = await build({ entryPoints: [join(web, "tests/browser/consumer-handoff-recovery.fixture.tsx")], bundle: true, write: false, outdir: join(output, "bundle"), format: "iife", platform: "browser", jsx: "automatic", loader: { ".module.css": "local-css" }, define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "synthetic-next", setup(builder) {
  builder.onResolve({ filter: /^next\/(link|navigation)$/ }, () => ({ path: "next-shim", namespace: "fixture" }));
  builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: nextShim, loader: "tsx", resolveDir: web }));
} }], logLevel: "silent" });
const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).contents;
const css = bundle.outputFiles.find(file => file.path.endsWith(".css")).contents;
const globals = (await postcss([tailwindcss({ base: web })]).process(await readFile(join(web, "src/app/globals.css"), "utf8"), { from: join(web, "src/app/globals.css") })).css;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://fixture.invalid");
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  if (url.pathname === "/fixture.js") { res.setHeader("content-type", "text/javascript"); return res.end(js); }
  if (url.pathname === "/fixture.css") { res.setHeader("content-type", "text/css"); return res.end(css); }
  if (url.pathname === "/base.css") { res.setHeader("content-type", "text/css"); return res.end(globals); }
  if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
  if (url.pathname === "/me/products") { res.setHeader("content-type", "text/html"); return res.end('<!doctype html><html lang="es-AR"><title>Colección sintética</title><h1>Productos guardados del ensayo</h1></html>'); }
  if (url.pathname !== "/") { res.writeHead(404); return res.end(); }
  const locale = ["en", "pt-BR"].includes(url.searchParams.get("locale")) ? url.searchParams.get("locale") : "es-AR";
  const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
  res.setHeader("content-type", "text/html;charset=utf-8");
  res.end(`<!doctype html><html lang="${locale}" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Handoff local</title><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;font:16px system-ui}main{box-sizing:border-box;margin:0 auto;max-width:600px;padding:20px}h1{font-size:24px}p{margin:12px 0}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const axe = await readFile(process.env.AXE_MODULE_PATH, "utf8");
const labels = {
  "es-AR": { retry: "Reintentar acceso", newReading: "Nueva lectura necesaria", readOnly: "Abrir mis productos guardados", fresh: "Acercá de nuevo el teléfono a la etiqueta." },
  en: { retry: "Retry access", newReading: "New reading needed", readOnly: "Open my saved products", fresh: "Tap the tag again with your phone." },
  "pt-BR": { retry: "Tentar acesso novamente", newReading: "Nova leitura necessária", readOnly: "Abrir meus produtos salvos", fresh: "Aproxime o celular da etiqueta novamente." },
};
let browser;
async function open({ width = 390, theme = "light", locale = "es-AR" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const entry = { width, theme, locale, handoffs: 0, businessWrites: 0, geolocationCalls: null, blocked: [], errors: [], expectedFailures: [], closed: false }; report.contexts.push(entry);
  let mode = "success", release, observed, requestObserved;
  page.on("pageerror", () => entry.errors.push("pageerror"));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const knownFailure = message.location().url === origin + "/api/consumer/tap-handoff" && /^Failed to load resource: (?:net::ERR_FAILED|the server responded with a status of (?:400|503) \(.+\))$/.test(message.text());
    (knownFailure ? entry.expectedFailures : entry.errors).push(knownFailure ? "synthetic_transport_failure" : "console_error");
  });
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { entry.blocked.push("external"); return route.abort(); }
    if (request.method() === "POST" && url.pathname === "/api/consumer/tap-handoff" && !url.search) {
      entry.handoffs++;
      const body = request.postDataJSON();
      check(["715", "716"].includes(body.eventId) && body.freshToken === `synthetic-capability-${body.eventId}` && Object.keys(body).sort().join() === "eventId,freshToken", "Exact synthetic handoff body");
      check(!request.headers().authorization && !request.headers().cookie, "No real authentication in fixture handoff");
      const currentMode = mode;
      if (currentMode === "connectivity") return route.abort("failed");
      if (["delayed", "delayed-terminal"].includes(currentMode)) { observed?.(); await new Promise(done => { release = done; }); }
      if (["terminal", "delayed-terminal"].includes(currentMode)) return route.fulfill({ status: 400, json: { ok: false, error: "tap_handoff_invalid_or_expired" } });
      if (currentMode === "invalid-json") return route.fulfill({ status: 400, contentType: "application/json", body: "not-json" });
      if (currentMode === "wrong-status") return route.fulfill({ status: 503, json: { ok: false, error: "tap_handoff_invalid_or_expired" } });
      if (currentMode === "wrong-ok") return route.fulfill({ status: 400, json: { ok: true, error: "tap_handoff_invalid_or_expired" } });
      if (currentMode === "other-error") return route.fulfill({ status: 400, json: { ok: false, error: "tap_capability_ambiguous" } });
      if (currentMode === "wrong-event") return route.fulfill({ status: 200, json: { ok: true, eventId: "717" } });
      return route.fulfill({ status: 200, json: { ok: true, eventId: body.eventId } }).catch(() => {
        if (contextClosed || entry.expectedAbort) entry.expectedFailures.push("synthetic_cancelled_response");
        else entry.errors.push("response_delivery_failure");
      });
    }
    if (request.method() !== "GET") { entry.businessWrites++; return route.abort(); }
    if (!["/", "/fixture.js", "/fixture.css", "/base.css", "/favicon.ico", "/me/products"].includes(url.pathname)) { entry.blocked.push("unexpected_path"); return route.abort(); }
    return route.continue();
  });
  let contextClosed = false;
  await page.goto(`${origin}/?locale=${locale}&theme=${theme}`, { waitUntil: "load" });
  await page.getByTestId("consumer-passport-primary").getByRole("button").waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="consumer-passport-primary"] button').disabled);
  check(entry.handoffs === 0, "Mount and hydration do not prepare access");
  return { page, entry, context, setMode(value) { mode = value; }, hold(value = "delayed") { mode = value; requestObserved = new Promise(done => { observed = done; }); return requestObserved; }, release() { release?.(); release = null; }, async close() {
    release?.(); contextClosed = true;
    entry.geolocationCalls = await page.evaluate(() => window.__handoffGeoCalls ?? null) ?? entry.geolocationCalls;
    check(entry.geolocationCalls === 0, "No geolocation in the component fixture");
    await context.close(); entry.closed = true;
  } };
}
async function assess(fixture, scenario) {
  const { page, entry } = fixture;
  const region = page.getByTestId("consumer-passport-primary"), alert = region.getByRole("alert");
  check(await alert.evaluate(node => node === document.activeElement), `Feedback focus ${scenario}`);
  check(await region.getByRole("button").getAttribute("aria-describedby") === await alert.getAttribute("id"), `Feedback association ${scenario}`);
  check(await region.getByRole("link", { name: labels[entry.locale].readOnly, exact: true }).evaluate(node => { const r = node.getBoundingClientRect(); return r.height >= 44 && r.width >= 44 && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("a") === node; }), `Read-only 44px target unobstructed ${scenario}`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal overflow ${scenario}`);
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async () => (await axe.run('[data-testid="consumer-passport-primary"]', { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })));
  check(violations.length === 0, `Accessible feedback ${scenario}`);
  const screenshot = `${scenario}-${entry.width}-${entry.theme}-${entry.locale}.png`;
  await page.screenshot({ path: join(output, screenshot) });
  report.views.push({ scenario, width: entry.width, theme: entry.theme, locale: entry.locale, screenshot, violations });
}
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  for (const locale of ["es-AR", "en", "pt-BR"]) for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
    const fixture = await open({ locale, width, theme });
    try {
      fixture.setMode("terminal");
      const button = fixture.page.getByTestId("consumer-passport-primary").getByRole("button");
      check(await button.evaluate(node => { const r = node.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; }), "Primary touch target remains at least 44px");
      await button.focus(); await fixture.page.keyboard.press("Enter");
      const alert = fixture.page.getByRole("alert"); await alert.waitFor();
      check((await alert.innerText()).includes(labels[locale].fresh) && await button.innerText() === labels[locale].newReading && await button.isDisabled(), "Known terminal response asks for a new physical reading");
      await button.evaluate(node => node.click());
      check(fixture.entry.handoffs === 1 && await fixture.page.evaluate(() => window.__handoffPushes.length === 0), "Terminal capability is not retried and never navigates");
      fixture.entry.geolocationCalls = await fixture.page.evaluate(() => window.__handoffGeoCalls);
      check(fixture.entry.geolocationCalls === 0, "Handoff does not request geolocation");
      await assess(fixture, "terminal-known-400");
      await fixture.page.keyboard.press("Tab");
      check(await fixture.page.getByRole("link", { name: labels[locale].readOnly, exact: true }).evaluate(node => node === document.activeElement), "Read-only recovery is the next keyboard target");
      await fixture.page.keyboard.press("Enter");
      await fixture.page.getByRole("heading", { name: "Productos guardados del ensayo" }).waitFor();
      check(new URL(fixture.page.url()).pathname === "/me/products" && new URL(fixture.page.url()).search === "" && fixture.entry.handoffs === 1, "Read-only collection does not reuse TAP context or send another handoff");
    } finally { await fixture.close(); }
  }
  for (const mode of ["connectivity", "invalid-json", "wrong-status", "wrong-ok", "other-error", "wrong-event"]) {
    const fixture = await open();
    try {
      fixture.setMode(mode);
      await fixture.page.getByTestId("consumer-passport-primary").getByRole("button").click();
      const retry = fixture.page.getByRole("button", { name: labels["es-AR"].retry, exact: true }); await retry.waitFor();
      check(!await retry.isDisabled() && await fixture.page.getByRole("alert").getAttribute("data-handoff-failure") === "retryable" && fixture.entry.handoffs === 1, `Manual retry without false terminal state ${mode}`);
      if (mode === "connectivity") await assess(fixture, "connectivity-retry");
      fixture.setMode("success"); await retry.click();
      await fixture.page.getByTestId("fixture-left-reading").waitFor();
      check(fixture.entry.handoffs === 2 && await fixture.page.evaluate(() => JSON.stringify(window.__handoffPushes) === JSON.stringify(["/me/products?fromTap=1&eventId=715&tenant=qa-only&action=products"])), `One deliberate retry preserves the exact destination ${mode}`);
    } finally { await fixture.close(); }
  }
  for (const kind of ["double-click", "unmount-abort", "unmount-late-body", "context-change"]) {
    const fixture = await open();
    try {
      if (["unmount-late-body", "context-change"].includes(kind)) await fixture.page.evaluate(() => { window.__ignoreHandoffAbort = true; });
      fixture.entry.expectedAbort = kind === "unmount-abort";
      const observed = fixture.hold();
      await fixture.page.getByTestId("consumer-passport-primary").getByRole("button").evaluate(node => { node.click(); node.click(); });
      await observed;
      check(fixture.entry.handoffs === 1 && await fixture.page.getByTestId("consumer-passport-primary").getByRole("button").isDisabled(), `One in-flight request ${kind}`);
      if (kind === "double-click") {
        fixture.release(); await fixture.page.getByTestId("fixture-left-reading").waitFor();
        check(await fixture.page.evaluate(() => window.__handoffPushes.length === 1), "Double click has one confirmed navigation");
      } else {
        if (kind === "context-change") await fixture.page.evaluate(() => window.dispatchEvent(new Event("fixture-change-context")));
        else await fixture.page.getByRole("button", { name: "Salir de esta lectura" }).click();
        await fixture.page.waitForFunction(() => window.__handoffAborts === 1);
        if (kind === "context-change") await fixture.page.locator('[data-testid="fixture-current-reading"][data-event-id="716"]').waitFor();
        else await fixture.page.getByTestId("fixture-left-reading").waitFor();
        fixture.release();
        if (kind !== "unmount-abort") await fixture.page.waitForFunction(() => window.__handoffBodies === 1);
        check(await fixture.page.evaluate(() => window.__handoffPushes.length === 0) && await fixture.page.getByRole("alert").count() === 0, `Late response cannot navigate or show stale feedback ${kind}`);
        if (kind === "context-change") {
          fixture.setMode("success"); await fixture.page.getByTestId("consumer-passport-primary").getByRole("button").click();
          await fixture.page.getByTestId("fixture-left-reading").waitFor();
          check(await fixture.page.evaluate(() => JSON.stringify(window.__handoffPushes) === JSON.stringify(["/me/products?fromTap=1&eventId=716&tenant=qa-only&action=products"])), "Changed context navigates only on a new deliberate click");
        }
      }
    } finally { await fixture.close(); }
  }
  {
    const fixture = await open();
    try {
      const observed = fixture.hold("delayed-terminal");
      await fixture.page.getByTestId("consumer-passport-primary").getByRole("button").click(); await observed;
      await fixture.page.getByRole("button", { name: "Salir de esta lectura" }).focus();
      fixture.release(); await fixture.page.getByRole("alert").waitFor();
      check(await fixture.page.getByRole("button", { name: "Salir de esta lectura" }).evaluate(node => node === document.activeElement), "Delayed feedback does not steal focus after another control is focused");
      check(await fixture.page.getByTestId("consumer-passport-primary").getByRole("button").isDisabled() && fixture.entry.handoffs === 1, "Terminal state remains terminal when feedback focus is not moved");
    } finally { await fixture.close(); }
  }
  for (const interaction of ["wheel", "touchmove", "scroll", "keyboard", "pointer"]) {
    const fixture = await open();
    try {
      const observed = fixture.hold("delayed-terminal");
      const trigger = fixture.page.getByTestId("consumer-passport-primary").getByRole("button").first();
      await trigger.click(); await observed;
      await fixture.page.evaluate(kind => {
        if (kind === "keyboard") document.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));
        else if (kind === "pointer") document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        else (kind === "touchmove" ? document : window).dispatchEvent(new Event(kind, { bubbles: true }));
      }, interaction);
      fixture.release(); await fixture.page.getByRole("alert").waitFor();
      check(!await fixture.page.getByRole("alert").evaluate(node => node === document.activeElement), `Reading interaction cancels delayed feedback focus ${interaction}`);
      check(await fixture.page.getByRole("alert").getAttribute("data-handoff-failure") === "fresh_required" && fixture.entry.handoffs === 1, `Reading interaction keeps terminal feedback announced ${interaction}`);
    } finally { await fixture.close(); }
  }
  for (const theme of ["light", "dark"]) for (const width of [320, 390, 1280]) {
    const fixture = await open({ theme, width });
    try {
      await fixture.page.evaluate(() => { window.__handoffNavigationMode = "hold"; });
      const trigger = fixture.page.getByTestId("consumer-passport-primary").getByRole("button").first();
      await trigger.evaluate(node => { node.click(); node.click(); });
      await fixture.page.locator('[data-handoff-navigation="opening"]').waitFor();
      check(await trigger.isDisabled() && await trigger.getAttribute("aria-busy") === "true", "Prepared handoff remains busy until route commit");
      await trigger.evaluate(node => { node.click(); node.click(); });
      check(fixture.entry.handoffs === 1 && await fixture.page.evaluate(() => window.__handoffPushes.length === 1), "Delayed destination cannot create a second capability POST");
      // Wait for the actual production navigation timer. It only offers a GET
      // navigation recovery; the transport and capability stay locked.
      await fixture.page.locator('[data-handoff-navigation="slow"]').waitFor();
      check(await trigger.isDisabled() && fixture.entry.handoffs === 1, "Slow navigation deadline never enables another capability POST");
      const retry = fixture.page.getByRole("button", { name: "Volver a abrir la página", exact: true });
      check(await retry.evaluate(node => node.getBoundingClientRect().height >= 44), "Navigation recovery is a 44px target");
      check(await fixture.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Navigation feedback fits narrow and desktop viewports");
      await fixture.page.addScriptTag({ content: axe });
      const violations = await fixture.page.evaluate(async () => (await axe.run('[data-testid="consumer-passport-primary"]', { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, impact: v.impact })));
      check(violations.length === 0, "Navigation recovery keeps accessible status and controls");
      const screenshot = `navigation-slow-${width}-${theme}.png`; await fixture.page.screenshot({ path: join(output, screenshot) });
      report.views.push({ scenario: "navigation-slow", width, theme, locale: "es-AR", screenshot, violations });
      await retry.click();
      check(fixture.entry.handoffs === 1 && await fixture.page.evaluate(() => window.__handoffPushes.length === 2 && window.__handoffPushes.every(href => href === "/me/products?fromTap=1&eventId=715&tenant=qa-only&action=products")), "Explicit slow-route retry reuses only the exact destination");
      await fixture.page.evaluate(() => window.__handoffCommit());
      await fixture.page.getByTestId("fixture-left-reading").waitFor();
    } finally { await fixture.close(); }
  }
  {
    const fixture = await open();
    try {
      await fixture.page.evaluate(() => { window.__handoffNavigationMode = "throw"; });
      const trigger = fixture.page.getByTestId("consumer-passport-primary").getByRole("button").first();
      await trigger.click(); await fixture.page.locator('[data-handoff-navigation="failed"]').waitFor();
      check(await trigger.isDisabled() && await trigger.getAttribute("aria-busy") === "false" && await trigger.innerText() === "Acceso preparado" && fixture.entry.handoffs === 1, "Thrown route error is honest and never retries the capability");
      await fixture.page.evaluate(() => { window.__handoffNavigationMode = "immediate"; });
      await fixture.page.getByRole("button", { name: "Volver a abrir la página", exact: true }).click();
      await fixture.page.getByTestId("fixture-left-reading").waitFor();
      check(fixture.entry.handoffs === 1 && await fixture.page.evaluate(() => window.__handoffPushes.length === 2), "Route failure recovery navigates without another capability POST");
    } finally { await fixture.close(); }
  }
  {
    const fixture = await open();
    try {
      fixture.entry.expectedAbort = true;
      const observed = fixture.hold();
      await fixture.page.getByTestId("consumer-passport-primary").getByRole("button").click(); await observed;
      const retry = fixture.page.getByRole("button", { name: labels["es-AR"].retry, exact: true }); await retry.waitFor();
      check(await fixture.page.evaluate(() => window.__handoffAborts === 1 && window.__handoffPushes.length === 0) && fixture.entry.handoffs === 1, "The existing eight-second timeout cancels transport without navigation or automatic retry");
      fixture.release(); fixture.setMode("success"); await retry.click();
      await fixture.page.getByTestId("fixture-left-reading").waitFor();
      check(fixture.entry.handoffs === 2 && await fixture.page.evaluate(() => window.__handoffPushes.length === 1), "A timed-out handoff remains recoverable by one deliberate retry");
    } finally { await fixture.close(); }
  }
} catch { report.errors.push("handoff_recovery_assertion_or_runtime_failure"); }
finally {
  if (browser) { await browser.close(); report.browserClosed = true; }
  server.closeAllConnections(); await new Promise(done => server.close(done)); report.serverClosed = true;
  report.sourceHashesEnd = await hashes();
  report.accepted = report.checks.every(item => item.passed) && report.views.length === 19 && report.contexts.length === 36 && report.contexts.every(entry => entry.closed && entry.errors.length === 0 && entry.blocked.length === 0 && entry.businessWrites === 0 && entry.geolocationCalls === 0) && report.errors.length === 0 && JSON.stringify(report.sourceHashesStart) === JSON.stringify(report.sourceHashesEnd) && report.browserClosed && report.serverClosed;
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ accepted: report.accepted, checks: report.checks.length, views: report.views.length, contexts: report.contexts.length, errors: report.errors }));
  if (!report.accepted) process.exitCode = 1;
}
