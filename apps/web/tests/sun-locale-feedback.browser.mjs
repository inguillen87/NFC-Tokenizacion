// Local real SUN provider/header with a controllable transport. No session or TAP.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const output = resolve(process.env.QA_OUTPUT || "artifacts/sun-locale-feedback");
await mkdir(output, { recursive: true });
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("browser/sun-locale-feedback.fixture.tsx", import.meta.url))],
  bundle: true, write: false, outfile: "fixture.js", format: "iife", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
  plugins: [{
    name: "fixture-link-only",
    setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "next/link", namespace: "fixture-link" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture-link" }, () => ({
        contents: 'import { createElement } from "react"; export default function Link({prefetch, ...props}) { return createElement("a", props); }',
        loader: "js", resolveDir: process.cwd(),
      }));
    },
  }],
});
const js = bundle.outputFiles.find((file) => file.path.endsWith(".js")).contents;
const css = bundle.outputFiles.find((file) => file.path.endsWith(".css"))?.contents || "";
let serverWrites = 0;
const server = createServer((request, response) => {
  if (request.method !== "GET") { serverWrites++; response.writeHead(405); response.end(); return; }
  const requestUrl = new URL(request.url, "http://fixture.invalid");
  const path = requestUrl.pathname;
  if (path === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(js); }
  else if (path === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
  else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    const theme = requestUrl.searchParams.get("theme") === "dark" ? "dark" : "light";
    response.end(('<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/fixture.css"><style>*{box-sizing:border-box}body{margin:0;padding:12px;font:16px system-ui;background:#0d1b24;color:#edf4f6}#root{max-width:480px;margin:auto}html[data-theme=light] body{background:#f3f7f5;color:#17313b}select{font:inherit;background:transparent;border:0}button,a,select{touch-action:manipulation}#outside{margin:16px 0;min-height:44px}.locale-switcher{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border:1px solid currentColor;border-radius:12px}.locale-switcher select{min-height:44px;color:inherit}.locale-switcher__option{background:#fff;color:#17313b}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>').replace("<html>", '<html data-theme="' + theme + '">'));
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const report = { syntheticComponentFixture: true, nextLinkOnlyAdaptedToAnchor: true, productionOrPhysicalTapVerified: false, checks: [], contexts: [], errors: [], browserClosed: false, serverClosed: false };
const check = (passed, name) => { report.checks.push({ name, passed: Boolean(passed) }); assert(passed, name); };
const labels = {
  "es-AR": { error: "No pudimos confirmar el idioma. Reintentá.", retry: "Reintentar:", pending: "Cambiando a", translated: "Controles del pasaporte", lang: "es-AR" },
  "pt-BR": { error: "Não foi possível confirmar o idioma. Tente novamente.", retry: "Tentar novamente:", pending: "Mudando para", translated: "Controles do passaporte", lang: "pt-BR" },
  en: { error: "We could not confirm the language. Please try again.", retry: "Retry:", pending: "Changing to", translated: "Passport controls", lang: "en" },
};
const localeNames = { "es-AR": "Español (AR)", "pt-BR": "Português (BR)", en: "English" };
let browser;
async function withPage(name, locale, theme, width, run, standalone = false) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale, reducedMotion: "reduce", serviceWorkers: "block" });
  const entry = { name, locale, theme, width, errors: [], blockedWrites: [], closed: false }; report.contexts.push(entry);
  try {
    await context.addInitScript(() => {
      window.__localeGeoCalls = 0;
      Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() { window.__localeGeoCalls++; }, watchPosition() { window.__localeGeoCalls++; }, clearWatch() {} } });
    });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on("pageerror", (error) => entry.errors.push(error.message));
    await page.route("**/*", (route) => {
      const request = route.request();
      if (request.method() !== "GET") { entry.blockedWrites.push(request.method() + " " + new URL(request.url()).pathname); return route.abort(); }
      return new URL(request.url()).origin === origin ? route.continue() : route.abort();
    });
    await page.goto(`${origin}/?locale=${locale}&theme=${theme}${standalone ? "&standalone=1" : ""}`, { waitUntil: "domcontentloaded" });
    await page.locator("#fixture-state").waitFor({ state: "attached" });
    await run(page, entry);
    check(await page.evaluate(() => window.__localeQA.unexpectedFetches.length === 0 && window.__localeGeoCalls === 0), `No unrelated transport or location ${name}`);
    check(entry.blockedWrites.length === 0 && entry.errors.length === 0, `No real write or runtime error ${name}`);
  } finally { await context.close(); entry.closed = true; }
}
async function requestCount(page, count) { await page.waitForFunction((count) => window.__localeQA.requests.length === count, count); }
async function state(page, locale, pending) {
  await page.waitForFunction(({ locale, pending }) => {
    const state = document.querySelector("#fixture-state");
    return state?.dataset.locale === locale && state.dataset.pending === String(pending);
  }, { locale, pending });
}
async function settle(page, index, status) { await page.evaluate(({ index, status }) => window.__localeQA.requests[index].resolve(status), { index, status }); }
async function invoke(page, locale) { await page.evaluate((locale) => window.dispatchEvent(new CustomEvent("fixture-locale", { detail: locale })), locale); }
async function layout(page, name) {
  const result = await page.evaluate(() => {
    const feedback = document.querySelector("[data-sun-locale-feedback]");
    const header = document.querySelector("[data-testid=sun-passport-header]");
    const status = document.querySelector(".sun-live-tap-pill");
    const bounds = feedback.getBoundingClientRect(), head = header?.getBoundingClientRect(), pill = status?.getBoundingClientRect();
    const retry = feedback.querySelector("button");
    const retryBounds = retry?.getBoundingClientRect();
    return {
      noOverflow: document.documentElement.scrollWidth <= innerWidth && bounds.left >= 0 && bounds.right <= innerWidth,
      fullRow: !head || (bounds.width >= head.width - 28 && bounds.top >= pill.bottom),
      touch: !retryBounds || (retryBounds.height >= 44 && retryBounds.width >= 44),
      color: getComputedStyle(feedback).color,
      background: getComputedStyle(feedback).backgroundColor,
    };
  });
  check(result.noOverflow && result.fullRow && result.touch, `Feedback in full row with touch target and no overflow ${name}`);
  return result;
}
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  for (const locale of ["es-AR", "pt-BR", "en"]) for (const theme of ["light", "dark"]) for (const width of [320, 390, 1280]) {
    const name = `${locale}-${theme}-${width}`;
    await withPage(name, locale, theme, width, async (page) => {
      const target = locale === "en" ? "pt-BR" : "en";
      const select = page.locator("select"), copy = labels[locale];
      await select.focus(); await select.selectOption(target); await requestCount(page, 1);
      await page.locator('[data-locale-state="pending"]').waitFor();
      check(await select.isDisabled() && await select.inputValue() === locale && (await page.locator("[data-sun-locale-feedback]").innerText()).includes(copy.pending + " " + localeNames[target]), `Pending explains intended locale without committing ${name}`);
      await layout(page, "pending-" + name);
      check(await page.evaluate(() => window.__localeQA.deadlines.size === 1), `One active preference deadline ${name}`);
      await settle(page, 0, 503);
      const retry = page.locator("[data-sun-locale-feedback] button"); await retry.waitFor();
      check(await select.inputValue() === locale && await page.locator("#fixture-state").getAttribute("data-locale") === locale, `Failure preserves confirmed locale ${name}`);
      check(await page.locator('[data-sun-locale-feedback] [role="status"]').innerText() === copy.error && await retry.innerText() === copy.retry + " " + localeNames[target], `Localized concise error and retained retry ${name}`);
      check(await select.evaluate((element) => element.getAttribute("aria-describedby") === document.querySelector('[data-sun-locale-feedback] [role="status"]').id) && await retry.evaluate((element) => document.activeElement === element), `Accessible description and keyboard retry focus ${name}`);
      const colors = await layout(page, "error-" + name);
      check(theme === "light" ? colors.color === "rgb(23, 49, 59)" && colors.background === "rgb(243, 247, 245)" : colors.color === "rgb(237, 244, 246)" && colors.background === "rgb(25, 45, 55)", `Theme colors remain legible ${name}`);
      if (width === 390) await page.screenshot({ path: join(output, `error-${name}.png`) });
      await page.keyboard.press("Enter"); await requestCount(page, 2); await state(page, locale, true);
      check(await page.evaluate(() => JSON.parse(window.__localeQA.requests[1].body).locale) === target, `Explicit keyboard retry retains target ${name}`);
      await settle(page, 1, 200); await state(page, target, false);
      check(await select.inputValue() === target && await select.evaluate((element) => document.activeElement === element) && await page.locator("[data-sun-locale-feedback]").count() === 0, `Confirmed success restores ready control and focus ${name}`);
      check(await page.evaluate(() => window.__localeQA.deadlines.size === 0 && window.__localeQA.requests.every((request) => request.url === "/api/sun/locale" && request.method === "POST" && request.credentials === "same-origin" && request.cache === "no-store" && Object.keys(JSON.parse(request.body)).join() === "locale")), `Deadline cleaned and original transport contract preserved ${name}`);
      check(await page.locator("#server-evidence").innerText() === "Lectura NFC verificada" && await page.locator("#translated-copy").innerText() === labels[target].translated && await page.evaluate(() => document.documentElement.lang) === labels[target].lang, `Only presentation locale changes; evidence stays intact ${name}`);
    });
  }
  await withPage("deadline-and-races", "es-AR", "dark", 390, async (page, entry) => {
    const select = page.locator("select");
    const started = Date.now(); await select.focus(); await select.selectOption("en"); await requestCount(page, 1);
    await page.locator('[data-locale-state="error"]').waitFor({ timeout: 15000 });
    entry.observedDeadlineMs = Date.now() - started;
    check(await page.evaluate(() => window.__localeQA.requests[0].signal.aborted && window.__localeQA.deadlines.size === 0) && await select.isEnabled(), "Ignoring abort cannot leave locale control pending indefinitely");
    check(await select.getAttribute("data-locale-error") === "locale_preference_timeout" && entry.observedDeadlineMs >= 7500, "Real bounded deadline ends the hanging synthetic transport");
    await page.locator("[data-sun-locale-feedback] button").click(); await requestCount(page, 2);
    await settle(page, 0, 200); await state(page, "es-AR", true);
    check(await page.locator("[data-sun-locale-feedback]").getAttribute("data-locale-state") === "pending", "Timed-out late success cannot commit or clear current retry");
    await settle(page, 1, 200); await state(page, "en", false);
    await invoke(page, "pt-BR"); await requestCount(page, 3);
    await invoke(page, "es-AR"); await requestCount(page, 4);
    check(await page.evaluate(() => window.__localeQA.requests[2].signal.aborted && window.__localeQA.deadlines.size === 1), "Supersession aborts and clears only its prior deadline");
    await settle(page, 2, 200); await state(page, "en", true);
    await settle(page, 3, 200); await state(page, "es-AR", false);
    check(await select.inputValue() === "es-AR", "Superseded success cannot overwrite the latest choice");
    await invoke(page, "pt-BR"); await requestCount(page, 5);
    await invoke(page, "en"); await requestCount(page, 6);
    await page.evaluate(() => window.__localeQA.requests[4].reject()); await state(page, "es-AR", true);
    check(await page.locator("#fixture-state").getAttribute("data-error") === "" && await page.evaluate(() => window.__localeQA.deadlines.size === 1), "Stale transport failure and finally cannot affect newer pending request");
    await settle(page, 5, 200); await state(page, "en", false);
    await invoke(page, "pt-BR"); await requestCount(page, 7);
    await invoke(page, "en"); await state(page, "en", false);
    await settle(page, 6, 200);
    check(await page.evaluate(() => window.__localeQA.requests.length === 7 && window.__localeQA.requests[6].signal.aborted && window.__localeQA.deadlines.size === 0) && await select.inputValue() === "en", "Choosing confirmed locale cancels outstanding change without another write");
    await select.focus(); await select.selectOption("es-AR"); await requestCount(page, 8);
    await page.locator("#outside").focus(); await page.evaluate(() => window.__localeQA.requests[7].reject());
    await page.locator('[data-locale-state="error"]').waitFor();
    check(await page.locator("#outside").evaluate((element) => document.activeElement === element), "Failure does not steal focus from another action");
    check(!(await page.locator("[data-sun-locale-feedback]").innerText()).includes("Synthetic") && await page.locator("[data-sun-locale-feedback] [role=status]").innerText() === labels.en.error, "Transport details never appear as customer error copy");
    await invoke(page, "pt-BR"); await requestCount(page, 9);
    const completedBefore = await page.evaluate(() => window.__localeQA.completedOperations);
    await page.evaluate(() => window.dispatchEvent(new Event("fixture-unmount"))); await page.locator("#fixture-unmounted").waitFor();
    await page.waitForFunction((before) => window.__localeQA.completedOperations > before, completedBefore);
    check(await page.evaluate(() => window.__localeQA.requests[8].signal.aborted && window.__localeQA.deadlines.size === 0), "Unmount settles canceled operation and clears its deadline even when fetch ignores abort");
    await settle(page, 8, 200);
    check(await page.locator("#fixture-state").count() === 0, "Late success after unmount cannot restore provider UI");
  });
  for (const abortBehavior of ["reject", "resolve"]) await withPage("deadline-abort-" + abortBehavior, "es-AR", "light", 390, async (page, entry) => {
    await page.evaluate((behavior) => { window.__localeQA.transportAbortBehavior = behavior; }, abortBehavior);
    const select = page.locator("select");
    const started = Date.now(); await select.focus(); await select.selectOption("en"); await requestCount(page, 1);
    await page.locator('[data-locale-state="error"]').waitFor({ timeout: 13000 });
    entry.observedDeadlineMs = Date.now() - started;
    check(await select.getAttribute("data-locale-error") === "locale_preference_timeout" && entry.observedDeadlineMs >= 7500, "Eight-second deadline owns timeout classification before abort-side " + abortBehavior);
    check(await select.isEnabled() && await select.inputValue() === "es-AR" && await page.locator("#fixture-state").getAttribute("data-locale") === "es-AR", "Abort-side " + abortBehavior + " cannot commit or strand the preference request");
    check(await page.evaluate(() => window.__localeQA.transportAbortEvents === 1 && window.__localeQA.requests[0].signal.aborted && window.__localeQA.deadlines.size === 0), "Abort-aware transport observed cancellation and deadline cleanup " + abortBehavior);
    await page.evaluate(() => { window.__localeQA.transportAbortBehavior = "ignore"; });
    await page.locator("[data-sun-locale-feedback] button").click(); await requestCount(page, 2);
    await settle(page, 1, 200); await state(page, "en", false);
    check(await select.inputValue() === "en" && await page.evaluate(() => window.__localeQA.deadlines.size === 0), "Explicit retry recovers after abort-side " + abortBehavior);
  });
  await withPage("standalone", "pt-BR", "light", 320, async (page) => {
    await page.locator("select").focus(); await page.locator("select").selectOption("en"); await requestCount(page, 1);
    await settle(page, 0, 503); await page.locator('[data-locale-state="error"]').waitFor();
    await layout(page, "standalone");
    check(await page.locator('[data-sun-locale-feedback] [role="status"]').innerText() === labels["pt-BR"].error, "Standalone switcher retains visible localized recovery");
  }, true);
} catch (error) { report.errors.push(error.stack || error.message); }
finally {
  if (browser) { await browser.close(); report.browserClosed = true; }
  server.closeAllConnections(); await new Promise((done) => server.close(done)); report.serverClosed = true;
  report.serverWrites = serverWrites;
  report.passed = report.checks.every((entry) => entry.passed) && report.contexts.length === 22 && report.contexts.every((entry) => entry.closed && entry.errors.length === 0 && entry.blockedWrites.length === 0) && report.errors.length === 0 && serverWrites === 0 && report.browserClosed && report.serverClosed;
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, contexts: report.contexts.length, errors: report.errors, serverWrites, browserClosed: report.browserClosed, serverClosed: report.serverClosed }));
  if (!report.passed) process.exitCode = 1;
}
