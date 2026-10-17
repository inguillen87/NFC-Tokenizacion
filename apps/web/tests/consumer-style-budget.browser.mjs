// Actual owned Next production server; all account data and sessions are synthetic.
// Compares independent cold cascades, never patches an already hydrated stylesheet.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { createConsumerPortalLoadingFixture } from "./browser/consumer-portal-loading-api.fixture.mjs";
import { normalizeSvgPaintSnapshot } from "./browser/svg-paint-reference.mjs";

const web = fileURLToPath(new URL("../", import.meta.url)), repo = resolve(web, "../..");
const output = resolve(process.env.QA_OUTPUT || "artifacts/consumer-style-budget");
const sunPath = "/sun?snapshot=0&trace=synthetic&access=invalid";
const consumers = [
  { name: "sun", path: sunPath, ready: '[data-testid="sun-summary-product"]', root: ".sun-tap-experience", session: "session-401" },
  { name: "login-choice", path: "/login", ready: "#access-choice-title", root: "main.web-auth-surface", session: "session-401" },
  { name: "consumer-login", path: "/login?consumer=1&next=%2Fme%2Fproducts", ready: "#consumer-login-title", root: "main.web-auth-surface", session: "session-401" },
  { name: "consumer-home", path: "/me", ready: '[data-testid="consumer-home"]', root: ".consumer-portal-root", session: "ready" },
  { name: "consumer-products", path: "/me/products", ready: '[data-testid="consumer-product-library"]', root: ".consumer-portal-root", session: "ready" },
];
const bindingPaths = [
  "apps/web/scripts/prepare-public-styles.mjs", "apps/web/scripts/public-style-source-graph.mjs", "apps/web/scripts/public-style-split.mjs",
  "apps/web/src/app/globals.css", "apps/web/src/app/layout.tsx", "apps/web/src/app/sun/layout.tsx", "apps/web/src/app/me/layout.tsx", "apps/web/src/app/login/layout.tsx",
  "apps/web/src/app/generated/manifest.json", "apps/web/src/app/generated/experience-root.css", "apps/web/.next/BUILD_ID",
  "apps/web/src/app/me/products/products.module.css", "apps/web/tests/browser/svg-paint-reference.mjs",
  "apps/web/tests/consumer-style-budget.browser.mjs", "apps/web/tests/consumer-style-local-fetch.mjs", "apps/web/tests/browser/consumer-portal-loading-api.fixture.mjs",
];
const sha256 = value => createHash("sha256").update(value).digest("hex");
async function sourceBindings() {
  return Object.fromEntries(await Promise.all(bindingPaths.map(async path => [path, sha256(await readFile(join(repo, path)))])));
}
const report = {
  localOnly: true, actualNextProductionBuild: true, syntheticSessionsAndData: true, serverExternalApiBlocked: true,
  realAuthenticationCertified: false, physicalTapMeasured: false, latencyMeasured: false, gitSourceOfBuildClaimed: false,
  byteMeasurement: "UTF-8 response body bytes and independent gzip estimates; excludes headers, timing and shared compression",
  checks: [], comparisons: [], views: [], navigation: [], clientErrors: [], blockedWrites: [], blockedExternalReads: [], geolocationCalls: 0,
};
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); return Boolean(value); };
const coldSharedStyles = new Map();
const coldCaptures = new Map();
await mkdir(output, { recursive: true });
report.sourceBindingsStart = await sourceBindings();
report.buildIdStart = (await readFile(join(web, ".next/BUILD_ID"), "utf8")).trim();
assert.ok(report.buildIdStart, "An existing production BUILD_ID is required; this harness never builds or regenerates CSS");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const fixture = await createConsumerPortalLoadingFixture();

// Keep the owned server outside Chromium's unsafe-port list on Windows too.
const reserve = createServer(); let port;
for (let candidate = 32805; candidate <= 32835; candidate++) {
  try {
    await new Promise((done, reject) => { reserve.once("error", reject); reserve.listen(candidate, "127.0.0.1", done); });
    reserve.removeAllListeners("error"); port = candidate; break;
  } catch (error) { reserve.removeAllListeners("error"); if (error.code !== "EADDRINUSE" || candidate === 32835) { await fixture.close(); throw error; } }
}
await new Promise(done => reserve.close(done));
const origin = `http://127.0.0.1:${port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", CONSUMER_STYLE_QA: "1", CONSUMER_STYLE_QA_API: fixture.origin, CONSUMER_STYLE_QA_ORIGIN: origin });
const next = spawn(process.execPath, ["--import", pathToFileURL(join(web, "tests/consumer-style-local-fetch.mjs")).href, join(repo, "node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], { cwd: web, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let nextLog = "", spawnError;
next.stdout.on("data", chunk => { nextLog += chunk; }); next.stderr.on("data", chunk => { nextLog += chunk; });
next.on("error", error => { spawnError = error; });
let browser;

async function stylesheet(url) {
  const absolute = new URL(url, origin);
  assert.equal(absolute.origin, origin, "CSS measurements only read the owned Next server");
  const response = await fetch(absolute, { redirect: "error" });
  assert.equal(response.status, 200, `Compiled stylesheet is readable: ${absolute.pathname}`);
  const css = await response.text();
  return { url: absolute.href, path: absolute.pathname, css, rawBytes: Buffer.byteLength(css), gzipEstimateBytes: gzipSync(css).length, sha256: sha256(css) };
}
async function pageStyles(page) {
  const urls = await page.locator('link[rel="stylesheet"][href]').evaluateAll(nodes => [...new Set(nodes.map(node => node.href))]);
  return Promise.all(urls.map(stylesheet));
}
function leanStyle(styles, name) {
  // Content identifies the application-wide sheet; CSS-module chunk names and
  // sizes are not a contract and must not accidentally become the reference.
  const candidates = styles.filter(style => style.css.includes(".consumer-portal-root") && style.css.includes(".web-auth-card"));
  assert.equal(candidates.length, 1, `${name}: exactly one shared application sheet is present in the cold route`);
  return candidates[0];
}
function sizes(styles) {
  return styles.reduce((sum, style) => ({ rawBytes: sum.rawBytes + style.rawBytes, gzipEstimateBytes: sum.gzipEstimateBytes + style.gzipEstimateBytes }), { rawBytes: 0, gzipEstimateBytes: 0 });
}
async function open(width, theme, session, locale = "es-AR") {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale, timezoneId: "UTC", reducedMotion: "reduce", serviceWorkers: "block" });
  await context.addCookies([
    { name: "theme", value: theme, url: origin }, { name: "nexid_theme_version", value: "white-first-v2", url: origin },
    { name: "locale", value: locale, url: origin }, { name: "consumer_loading_qa", value: session, url: origin, httpOnly: true, sameSite: "Lax" },
  ]);
  await context.exposeBinding("__qaConsumerStyleLocation", () => { report.geolocationCalls++; });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { value: {
      getCurrentPosition() { void window.__qaConsumerStyleLocation(); throw Error("CSS QA must not request location"); },
      watchPosition() { void window.__qaConsumerStyleLocation(); throw Error("CSS QA must not watch location"); },
    } });
  });
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method())) { report.blockedWrites.push({ method: request.method(), path: url.pathname }); return route.abort(); }
    if (url.origin === origin || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    report.blockedExternalReads.push({ origin: url.origin, path: url.pathname }); return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", error => report.clientErrors.push({ width, theme, locale, path: new URL(page.url()).pathname, message: error.message }));
  return { context, page, width, theme, locale, session };
}
async function settle(page, view) {
  await page.locator(view.ready).waitFor({ state: "visible", timeout: 15_000 });
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    scrollTo({ left: 0, top: 0, behavior: "instant" });
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}
async function capture(page, view) {
  const snapshot = await page.evaluate(selector => {
    const root = document.querySelector(selector);
    if (!root) throw Error("Missing CSS comparison root: " + selector);
    const properties = ["display", "position", "visibility", "color", "backgroundColor", "backgroundImage", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft", "borderTopWidth", "borderTopColor", "borderRadius", "boxSizing", "boxShadow", "gridTemplateColumns", "gap", "alignItems", "justifyContent", "overflowX", "overflowY", "fill", "stroke"];
    const round = value => Math.round(value * 10) / 10;
    const svgScopes = [], svgIndexes = new Map();
    function svgScope(element, style) {
      if (![style.fill, style.stroke].some(value => value.toLowerCase().includes("url("))) return null;
      const svg = element.closest("svg");
      if (!svg) throw Error("SVG paint URL is outside an SVG element");
      if (svgIndexes.has(svg)) return svgIndexes.get(svg);
      const elements = [svg, ...svg.querySelectorAll("*")].filter(node => node.closest("svg") === svg);
      const keys = new Map(elements.map((node, key) => [node, key]));
      const nodes = elements.map(node => ({
        key: keys.get(node), tag: node.localName, namespace: node.namespaceURI,
        attributes: [...node.attributes].map(attribute => ({ name: attribute.name, namespace: attribute.namespaceURI, value: attribute.value })),
        content: [...node.childNodes].flatMap(child => {
          if (child.nodeType === 3 || child.nodeType === 4) return [{ text: child.textContent }];
          if (child.nodeType !== 1) return [];
          if (!keys.has(child)) return [{ outsideSvg: true }];
          return [{ node: keys.get(child) }];
        }),
        ...(node.localName === "stop" ? { stopStyle: { stopColor: getComputedStyle(node).stopColor, stopOpacity: getComputedStyle(node).stopOpacity } } : {}),
      }));
      const index = svgScopes.length; svgScopes.push({ nodes }); svgIndexes.set(svg, index); return index;
    }
    const elements = [root, ...root.querySelectorAll("*")].flatMap(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (!rect.width || !rect.height || style.display === "none" || style.visibility === "hidden") return [];
      const pseudo = name => { const computed = getComputedStyle(element, name); return { content: computed.content, display: computed.display, color: computed.color, backgroundColor: computed.backgroundColor }; };
      return [{ tag: element.tagName, classes: element.getAttribute("class") || "", role: element.getAttribute("role"), disabled: element.hasAttribute("disabled"), svgScope: svgScope(element, style),
        styles: Object.fromEntries(properties.map(property => [property, style[property]])),
        geometry: { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) },
        before: pseudo("::before"), after: pseudo("::after") }];
    });
    return { elements, svgScopes };
  }, view.root);
  return normalizeSvgPaintSnapshot(snapshot);
}
const differences = (before, after) => Array.from({ length: Math.max(before.length, after.length) }, (_, index) => index)
  .filter(index => JSON.stringify(before[index]) !== JSON.stringify(after[index]))
  .slice(0, 8).map(index => ({ index, lean: before[index], full: after[index] }));
async function overflow(page, label) { check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ": no horizontal overflow"); }

async function compare(view, width, theme, full, locale = "es-AR") {
  const label = `${view.name}/${width}/${theme}/${locale}`, name = label.replaceAll("/", "-");
  const actual = await open(width, theme, view.session, locale), reference = await open(width, theme, view.session, locale);
  try {
    await actual.page.goto(origin + view.path, { waitUntil: "networkidle", timeout: 45_000 });
    await settle(actual.page, view);
    const styles = await pageStyles(actual.page), lean = leanStyle(styles, label), total = sizes(styles);
    const known = coldSharedStyles.get(view.name);
    check(!known || known.sha256 === lean.sha256, label + ": the same compiled route sheet is used across sizes, themes and locales");
    coldSharedStyles.set(view.name, { path: lean.path, sha256: lean.sha256 });
    check(lean.sha256 !== full.sha256 && lean.rawBytes < full.rawBytes, label + ": route has a smaller shared stylesheet than the full homepage");
    check(styles.every(style => style.sha256 !== full.sha256), label + ": cold route never installs the complete homepage sheet");
    check(await actual.page.locator("html").getAttribute("data-theme") === theme, label + ": server theme preserved");
    check(await actual.page.locator("html").getAttribute("lang") === locale, label + ": server locale preserved");
    const before = await capture(actual.page, view);
    if (locale === "es-AR") coldCaptures.set(`${view.name}/${width}/${theme}`, before);
    await actual.page.screenshot({ path: join(output, name + ".png"), fullPage: true });
    await reference.page.route(lean.url, route => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ status: 200, contentType: "text/css", headers: { "cache-control": "no-store" }, body: full.css });
    });
    await reference.page.goto(origin + view.path, { waitUntil: "networkidle", timeout: 45_000 });
    await settle(reference.page, view);
    const after = await capture(reference.page, view), identical = JSON.stringify(before) === JSON.stringify(after);
    check(identical, label + ": cold lean/full computed styles and geometry are identical");
    if (!identical) await reference.page.screenshot({ path: join(output, name + "-reference.png"), fullPage: true });
    await overflow(actual.page, label); await overflow(reference.page, label + "/reference");
    report.comparisons.push({ name: view.name, path: view.path, width, theme, locale, syntheticSession: view.session, identical, visibleElements: before.length,
      lean: { path: lean.path, sha256: lean.sha256, rawBytes: lean.rawBytes, gzipEstimateBytes: lean.gzipEstimateBytes },
      full: { path: full.path, sha256: full.sha256, rawBytes: full.rawBytes, gzipEstimateBytes: full.gzipEstimateBytes },
      routeCss: total, referenceRouteCssEstimate: { rawBytes: total.rawBytes - lean.rawBytes + full.rawBytes, gzipEstimateBytes: total.gzipEstimateBytes - lean.gzipEstimateBytes + full.gzipEstimateBytes },
      differences: differences(before, after) });
    report.views.push({ name: view.name, width, theme, locale, file: name + ".png" });
  } finally { await actual.context.close(); await reference.context.close(); }
}

async function navigation(width, theme, destination, full) {
  const state = await open(width, theme, destination === "account-login" ? "session-401" : "ready");
  const sun = consumers[0], name = `navigation-${destination}-${width}-${theme}`;
  try {
    await state.page.goto(origin + sunPath, { waitUntil: "networkidle", timeout: 45_000 }); await settle(state.page, sun);
    const before = await capture(state.page, sun), writes = report.blockedWrites.length;
    const link = destination === "account-login" ? state.page.getByTestId("sun-account-link") : state.page.locator('a[href="/me/products"]').first();
    check(await link.getAttribute("href") === (destination === "account-login" ? "/me" : "/me/products"), name + ": existing read-only destination link is used");
    await link.click();
    const target = destination === "account-login" ? consumers[2] : consumers[4];
    await state.page.waitForURL(url => url.pathname === (destination === "account-login" ? "/login" : "/me/products"));
    await state.page.waitForLoadState("networkidle"); await settle(state.page, target);
    // Next may retain the SUN sheet across client navigation. The destination
    // must install its independently measured cold consumer sheet as well.
    const styles = await pageStyles(state.page), expected = coldSharedStyles.get(target.name);
    check(Boolean(expected) && styles.some(style => style.sha256 === expected.sha256), name + ": destination installs its independently measured consumer sheet");
    check(styles.every(style => style.sha256 !== full.sha256), name + ": destination retains consumer styles without loading the full marketing sheet");
    const coldDestination = coldCaptures.get(`${target.name}/${width}/${theme}`), warmDestination = await capture(state.page, target);
    const destinationIdentical = Boolean(coldDestination) && JSON.stringify(coldDestination) === JSON.stringify(warmDestination);
    check(destinationIdentical, name + ": destination computed styles and geometry equal its independent cold capture");
    const destinationDifferences = differences(coldDestination || [], warmDestination).map(({ index, lean, full }) => ({ index, cold: lean, warm: full }));
    if (destination === "account-login") {
      check(new URL(state.page.url()).searchParams.get("next") === "/me", name + ": genuine synthetic 401 preserves the account return path");
      check(await state.page.getByTestId("consumer-home").count() === 0, name + ": anonymous navigation displays no private account home");
    }
    await overflow(state.page, name + "/destination");
    await state.page.goBack({ waitUntil: "networkidle" }); await settle(state.page, sun);
    const returned = await capture(state.page, sun), identical = JSON.stringify(before) === JSON.stringify(returned);
    check(new URL(state.page.url()).pathname === "/sun" && identical, name + ": returning to SUN preserves computed styles and geometry at normalized scroll");
    check(report.blockedWrites.length === writes, name + ": navigation attempts no business/authentication write");
    await overflow(state.page, name + "/returned");
    await state.page.screenshot({ path: join(output, name + ".png"), fullPage: true });
    report.navigation.push({ width, theme, destination, syntheticSession: state.session, destinationIdentical, destinationDifferences, identical, scrollNormalizedForComparison: true, differences: differences(before, returned), file: name + ".png" });
  } finally { await state.context.close(); }
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (spawnError || next.exitCode !== null) break;
    try { if ((await fetch(origin + "/release.json", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 250));
  }
  assert.ok(ready, "Owned loopback production Next server is ready");
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  const homepage = await fetch(origin, { redirect: "error" }), html = await homepage.text();
  assert.equal(homepage.status, 200, "Full-style reference homepage is available");
  const homeUrls = [...new Set([...html.matchAll(/href="([^\"]+\.css(?:\?[^\"]*)?)"/g)].map(match => match[1].replaceAll("&amp;", "&")))];
  const homeStyles = await Promise.all(homeUrls.map(stylesheet));
  const full = homeStyles.filter(style => style.css.includes(".landing-root") && style.css.includes(".consumer-portal-root") && style.css.includes(".web-auth-card")).toSorted((a, b) => b.rawBytes - a.rawBytes)[0];
  assert.ok(full, "Full reference is selected by known marketing and consumer selectors, not an arbitrary largest chunk");
  report.reference = { documentSha256: sha256(html), path: full.path, sha256: full.sha256, rawBytes: full.rawBytes, gzipEstimateBytes: full.gzipEstimateBytes };
  for (const theme of ["light", "dark"]) for (const width of [320, 390, 768, 1440]) for (const view of consumers) await compare(view, width, theme, full);
  for (const locale of ["en", "pt-BR"]) for (const view of consumers.slice(1, 3)) await compare(view, 390, "light", full, locale);
  for (const [width, theme] of [[390, "light"], [1440, "dark"]]) for (const destination of ["account-login", "products"]) await navigation(width, theme, destination, full);
  check(fixture.requests.every(request => request.method === "GET"), "Synthetic account API received only GETs");
  check(fixture.requests.some(request => request.scenario === "ready" && request.path === "/consumer/products" && request.responseStatus === 200), "Ready account and product views consumed the existing synthetic product fixture");
  check(fixture.requests.some(request => request.scenario === "session-401" && request.path === "/consumer/session" && request.responseStatus === 401), "Anonymous navigation consumed an actual synthetic session 401");
  check(report.blockedWrites.length === 0, "No business, handoff or authentication writes were attempted");
  check(report.geolocationCalls === 0, "No location permission calls");
  check(report.clientErrors.length === 0, "No client exceptions");
  report.status = report.checks.every(item => item.passed) ? "passed" : "failed";
} catch (error) {
  report.status = "failed"; report.error = String(error.stack || error);
  const page = browser?.contexts().at(-1)?.pages().at(-1);
  if (page) await page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  report.fixtureReads = fixture.requests;
  try {
    report.sourceBindingsEnd = await sourceBindings(); report.buildIdEnd = (await readFile(join(web, ".next/BUILD_ID"), "utf8")).trim();
    const stable = JSON.stringify(report.sourceBindingsStart) === JSON.stringify(report.sourceBindingsEnd) && report.buildIdStart === report.buildIdEnd;
    check(stable, "Source, layouts, capture/fixture helpers, generated manifest and BUILD_ID remained unchanged during the run");
    if (!stable) report.status = "failed";
  } catch (error) { report.status = "failed"; report.bindingError = String(error.stack || error); }
  await browser?.close();
  if (next.exitCode === null) { next.kill(); await Promise.race([new Promise(done => next.once("exit", done)), new Promise(done => setTimeout(done, 1500))]); }
  await fixture.close();
  await writeFile(join(output, "local-server.log"), nextLog);
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failed: report.checks.filter(item => !item.passed), comparisons: report.comparisons.length, navigation: report.navigation.length, views: report.views.length, clientErrors: report.clientErrors, blockedWrites: report.blockedWrites, geolocationCalls: report.geolocationCalls, buildId: report.buildIdStart, error: report.error, output }, null, 2));
assert.equal(report.status, "passed", "Consumer CSS budget and cascade acceptance failed; see the bound report");
