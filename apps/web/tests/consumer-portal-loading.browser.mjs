// Actual production Next build and router, isolated synthetic loopback API.
// Stalls, sessions and retry acknowledgements here are not customer evidence.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createConsumerPortalLoadingFixture } from "./browser/consumer-portal-loading-api.fixture.mjs";

const web = fileURLToPath(new URL("../", import.meta.url)), repo = resolve(web, "../..");
const output = resolve(process.env.QA_OUTPUT || "artifacts/consumer-portal-loading");
await mkdir(output, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const axe = await readFile(process.env.AXE_MODULE_PATH, "utf8");
const fixture = await createConsumerPortalLoadingFixture();
const reserve = createServer();
await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
const port = reserve.address().port;
await new Promise((resolve) => reserve.close(resolve));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", CONSUMER_PORTAL_LOADING_QA: "1", CONSUMER_PORTAL_LOADING_QA_API: fixture.origin });
const next = spawn(process.execPath, ["--import", pathToFileURL(join(web, "tests/consumer-portal-loading-local-fetch.mjs")).href, join(repo, "node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], { cwd: web, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
next.stdout.on("data", () => {}); next.stderr.on("data", () => {});
let serverFailed = false;
next.on("error", () => { serverFailed = true; });
const origin = `http://127.0.0.1:${port}`;
const report = { localOnly: true, actualNextProductionBuild: true, syntheticSessionsAndData: true, realAuthenticationCertified: false, physicalTapMeasured: false, checks: [], views: [], timings: [], clientErrors: [], blockedWrites: [], geolocationCalls: 0 };
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
let browser;
async function scenario(context, value) {
  await context.addCookies([{ name: "consumer_loading_qa", value, url: origin, httpOnly: true, sameSite: "Lax" }]);
}
async function open(width, theme, value) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "es-AR", reducedMotion: "reduce", serviceWorkers: "block" });
  await context.addCookies([{ name: "theme", value: theme, url: origin }, { name: "nexid_theme_version", value: "white-first-v2", url: origin }]);
  await scenario(context, value);
  await context.exposeBinding("__qaLocationCall", () => { report.geolocationCalls += 1; });
  await context.addInitScript(() => { Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() { void window.__qaLocationCall(); throw Error("Unexpected location request"); }, watchPosition() { void window.__qaLocationCall(); throw Error("Unexpected location watch"); } } }); });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.clientErrors.push({ width, theme, message: error.message }));
  await page.route("**/*", (route) => {
    const request = route.request(), url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method())) { report.blockedWrites.push({ path: url.pathname, method: request.method() }); return route.abort(); }
    return url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? route.continue() : route.abort();
  });
  return { context, page };
}
async function assess(page, selector, name, width, theme) {
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async (selector) => (await axe.run(selector, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.map((node) => node.target) })), selector);
  check(violations.length === 0, `${name}/${width}/${theme}: zero axe violations`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}/${width}/${theme}: no horizontal overflow`);
  check(await page.locator("html").getAttribute("data-theme") === theme, `${name}/${width}/${theme}: requested theme rendered`);
  await page.screenshot({ path: join(output, `${name}-${width}-${theme}.png`), fullPage: true });
  report.views.push({ name, width, theme, violations });
}
async function expectUnavailable(page, context, name, width, theme, capture = true) {
  const before = fixture.requests.length;
  const started = performance.now();
  await page.goto(`${origin}/me?fromTap=1&tapEventId=900001`, { waitUntil: "commit" });
  const loading = page.getByTestId("consumer-portal-loading");
  if (name.includes("stall")) {
    await loading.waitFor({ timeout: 3500 });
    check(await loading.getByRole("status").innerText() === "Estamos consultando tu cuenta y tus productos.", `${name}: loading explains the active read`);
    check(await loading.locator("animate,animateTransform,img,video").count() === 0, `${name}: no carousel, photos or SVG timelines in loading`);
    check(await loading.locator("*").evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).animationName === "none")), `${name}: static loading under reduced motion`);
    if (capture) await assess(page, '[data-testid="consumer-portal-loading"]', "loading", width, theme);
  }
  const error = page.getByTestId("consumer-portal-error");
  await error.waitFor({ timeout: 12_000 });
  const elapsedMs = Math.round(performance.now() - started);
  report.timings.push({ name, width, theme, elapsedMs, syntheticStall: name.includes("stall") });
  if (name.includes("stall")) check(elapsedMs < 11_000, `${name}: bounded request leaves loading within 11 seconds including rendering`);
  check(new URL(page.url()).pathname === "/me", `${name}: temporary error does not redirect to login`);
  check(new URL(page.url()).searchParams.get("tapEventId") === "900001", `${name}: return context survives failure`);
  check(await page.getByTestId("consumer-home").count() === 0 && !(await page.locator("body").innerText()).includes("Producto local QA"), `${name}: unknown session exposes no private account products`);
  check(await error.getByRole("button", { name: "Reintentar", exact: true }).evaluate((node) => node.getBoundingClientRect().height >= 44), `${name}: retry touch target is at least 44 pixels`);
  await page.waitForFunction(() => document.activeElement?.id === "consumer-error-title");
  check(true, `${name}: error heading receives keyboard focus`);
  if (capture) await assess(page, '[data-testid="consumer-portal-error"]', "error", width, theme);
  const reads = fixture.requests.slice(before);
  check(reads.length === 1 && reads[0].path === "/consumer/session", `${name}: no private data lookups start before session confirmation`);
  await scenario(context, "ready");
  await error.getByRole("button", { name: "Reintentar", exact: true }).click();
  await page.getByTestId("consumer-home").waitFor({ timeout: 12_000 });
  check((await page.getByTestId("consumer-home").innerText()).includes("Producto local QA"), `${name}: explicit retry restores the actual account projection`);
  check(new URL(page.url()).searchParams.get("tapEventId") === "900001", `${name}: retry preserves return context`);
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (serverFailed || next.exitCode !== null) break;
    try { if ((await fetch(origin + "/release.json", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check(ready, "isolated production Next server is ready");
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  for (const width of [320, 390, 768, 1440]) for (const theme of ["light", "dark"]) {
    const state = await open(width, theme, "session-headers-stall");
    await expectUnavailable(state.page, state.context, `headers-stall/${width}/${theme}`, width, theme);
    await state.context.close();
  }
  for (const name of ["session-body-stall", "session-500", "session-malformed"]) {
    const state = await open(390, "dark", name);
    await expectUnavailable(state.page, state.context, name, 390, "dark", false);
    await state.context.close();
  }
  const anonymous = await open(390, "light", "session-401");
  const anonymousBefore = fixture.requests.length;
  await anonymous.page.goto(`${origin}/me?fromTap=1&tapEventId=900001`, { waitUntil: "domcontentloaded" });
  await anonymous.page.waitForURL((url) => url.pathname === "/login");
  check(new URL(anonymous.page.url()).searchParams.get("next") === "/me?fromTap=1&tapEventId=900001", "genuine 401 redirects to login with exact return context");
  check(await anonymous.page.getByTestId("consumer-home").count() === 0 && !(await anonymous.page.locator("body").innerText()).includes("Producto local QA"), "anonymous session never displays private account products");
  check(fixture.requests.slice(anonymousBefore).every((item) => item.path === "/consumer/session"), "anonymous access reads no private account sources");
  await anonymous.context.close();
  const partial = await open(390, "light", "products-body-stall");
  const started = performance.now();
  await partial.page.goto(origin + "/me", { waitUntil: "commit" });
  await partial.page.getByTestId("consumer-home").waitFor({ timeout: 12_000 });
  check(performance.now() - started < 11_000, "stalled collection body exits loading within its read deadline");
  const partialText = await partial.page.getByTestId("consumer-home").innerText();
  check(partialText.includes("No se pudieron cargar tus productos.") && partialText.includes("Cuenta local QA"), "collection failure stays unavailable while confirmed account sources remain visible");
  check(!partialText.includes("Tu próximo producto empieza con un tap."), "failed collection is never reported as an empty collection");
  await scenario(partial.context, "ready");
  await partial.page.getByRole("button", { name: "Reintentar carga", exact: true }).click();
  await partial.page.getByRole("heading", { name: "Producto local QA", exact: true }).waitFor({ timeout: 12_000 });
  check(true, "explicit collection retry restores the account product without reauthentication");
  await partial.context.close();
  check(fixture.requests.every((item) => item.method === "GET"), "loopback fixture received only read requests");
  const stalledReads = fixture.requests.filter((item) =>
    (item.path === "/consumer/session" && ["session-headers-stall", "session-body-stall"].includes(item.scenario))
    || (item.path === "/consumer/products" && item.scenario === "products-body-stall"));
  check(stalledReads.length === 10 && stalledReads.every((item) => item.closedBeforeEnd), "timed-out headers and JSON body requests close their loopback connections");
  check(report.blockedWrites.length === 0, "no business or authentication writes were attempted");
  check(report.geolocationCalls === 0, "zero location permission calls");
  check(report.clientErrors.length === 0, "zero unhandled client exceptions");
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.error = String(error.stack);
  const page = browser?.contexts().at(-1)?.pages().at(-1);
  if (page) { report.visible = (await page.locator("body").innerText()).slice(0, 6000); await page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => {}); }
  throw error;
} finally {
  report.fixtureReads = fixture.requests;
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, views: report.views.length, blockedWrites: report.blockedWrites.length, geolocationCalls: report.geolocationCalls, error: report.error, output }));
  await browser?.close();
  if (next.exitCode === null) { next.kill(); await Promise.race([new Promise((resolve) => next.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 1500))]); }
  await fixture.close();
}
