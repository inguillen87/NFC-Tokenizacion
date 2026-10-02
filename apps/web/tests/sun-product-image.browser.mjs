// Real component + native dialog in Chromium. Images and prop updates are local fixtures.
// Root controls execution; this file never contacts production or sends a write.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const output = resolve(process.env.QA_OUTPUT || "artifacts/sun-product-image");
await mkdir(output, { recursive: true });
const bundle = await build({ entryPoints: [fileURLToPath(new URL("browser/sun-product-image.fixture.tsx", import.meta.url))], bundle: true, write: false, outfile: "fixture.js", format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent" });
const js = bundle.outputFiles.find((file) => file.path.endsWith(".js")).contents;
const css = bundle.outputFiles.find((file) => file.path.endsWith(".css"))?.contents || "";
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="#10877d"/><circle cx="120" cy="180" r="64" fill="#ffffff"/></svg>';
const server = createServer((request, response) => {
  if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
  const path = new URL(request.url, "http://fixture.invalid").pathname;
  if (path === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(js); }
  else if (path === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
  else if (path === "/missing.svg") { response.writeHead(404); response.end(); }
  else if (path.endsWith(".svg")) { response.setHeader("Content-Type", "image/svg+xml"); response.setHeader("Cache-Control", "public, max-age=3600"); response.end(svg); }
  else { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/fixture.css"><style>body{margin:20px;font:16px system-ui}.photo{position:relative;width:260px;height:360px;margin-top:20px;background:#eef4f1;border-radius:16px;overflow:hidden}.photo>img{width:100%;height:100%;object-fit:contain}html[data-theme=dark]{background:#0d1b24;color:#edf4f6;--passport-ink:#edf4f6;--passport-muted:#adbec8;--passport-accent:#8bd8c3;--passport-line:#31454e;--passport-surface:#142630;--passport-media:#1d333c}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const report = { syntheticComponentFixture: true, productionOrPhysicalTapVerified: false, checks: [], contexts: [], errors: [], browserClosed: false, serverClosed: false };
const check = (passed, name) => report.checks.push({ name, passed: Boolean(passed) });
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  for (const locale of ["es-AR", "en", "pt-BR"]) for (const theme of ["light", "dark"]) {
    const labels = locale === "en" ? { loading: "Loading product image", enlarge: "Enlarge product image", close: "Close image", failed: "Product image unavailable" } : locale === "pt-BR" ? { loading: "Carregando imagem do produto", enlarge: "Ampliar imagem do produto", close: "Fechar imagem", failed: "Imagem do produto indisponível" } : { loading: "Cargando imagen del producto", enlarge: "Ampliar imagen del producto", close: "Cerrar imagen", failed: "Imagen del producto no disponible" };
    const name = `${locale}-${theme}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale, reducedMotion: "reduce", serviceWorkers: "block" });
    const entry = { name, requests: [], blockedWrites: [], errors: [], closed: false }; report.contexts.push(entry);
    let release;
    let slowRequestObserved;
    const slowRequest = new Promise((done) => { slowRequestObserved = done; });
    try {
      await context.addInitScript(({ theme }) => { document.addEventListener("DOMContentLoaded", () => { document.documentElement.dataset.theme = theme; }); window.__imageGeoCalls = 0; Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() { window.__imageGeoCalls++; }, watchPosition() { window.__imageGeoCalls++; }, clearWatch() {} } }); }, { theme });
      const page = await context.newPage(); page.setDefaultTimeout(10000); page.on("pageerror", (error) => entry.errors.push(error.message));
      await page.route("**/*", async (route) => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() !== "GET") { entry.blockedWrites.push({ method: request.method(), path: url.pathname }); return route.abort(); }
        if (url.origin !== origin) return route.abort();
        entry.requests.push({ path: url.pathname, referrer: request.headers().referer || null });
        if (url.pathname === "/slow-photo.svg") { await new Promise((done) => { release = done; slowRequestObserved(); }); return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg, headers: { "Cache-Control": "public, max-age=3600" } }); }
        return route.continue();
      });
      await page.goto(`${origin}/?locale=${locale}`, { waitUntil: "domcontentloaded" });
      await page.getByTestId("sun-image-loading").waitFor();
      check(await page.getByTestId("sun-image-loading").getAttribute("aria-label") === labels.loading, `Real pending image localized ${name}`);
      check(await page.getByTestId("sun-image-zoom").count() === 0, `No zoom before ready ${name}`);
      let slowTimer;
      try { await Promise.race([slowRequest, new Promise((_, reject) => { slowTimer = setTimeout(() => reject(new Error("native_delayed_image_request_timeout")), 10000); })]); }
      finally { clearTimeout(slowTimer); }
      assert(release, "native_delayed_image_request_required"); release(); release = null;
      await page.locator('[data-testid="sun-product-image"][data-image-state="ready"]').waitFor();
      const image = page.getByTestId("sun-product-image"), opener = page.getByTestId("sun-image-zoom");
      check(await image.evaluate((element) => element.complete && element.naturalWidth === 240 && element.naturalHeight === 360), `Loaded native image ${name}`);
      check(await image.getAttribute("referrerpolicy") === "no-referrer" && entry.requests.filter((request) => request.path === "/slow-photo.svg").every((request) => request.referrer === null), `Image request has no referrer ${name}`);
      check(await image.evaluate((element) => getComputedStyle(element).animationName === "none"), `Reduced motion image ${name}`);
      check(await opener.getAttribute("aria-label") === labels.enlarge, `Localized zoom action ${name}`);
      check(await opener.evaluate((element) => { const rect = element.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; }), `Zoom touch size ${name}`);
      const readsBefore = entry.requests.filter((request) => request.path.endsWith(".svg")).length;
      await opener.click();
      const dialog = page.getByTestId("sun-image-dialog"); await dialog.waitFor();
      check(await dialog.evaluate((element) => element.open && element.matches(":modal")), `Native modal ${name}`);
      check(await page.getByTestId("sun-image-close").getAttribute("aria-label") === labels.close && await page.getByTestId("sun-image-close").evaluate((element) => document.activeElement === element), `Localized close and initial focus ${name}`);
      check(await page.getByTestId("sun-image-expanded").evaluate((canvas) => canvas.width === 240 && canvas.height === 360 && canvas.getContext("2d").getImageData(0, 0, 1, 1).data.join(",") === "16,135,125,255"), `Supplied decoded bitmap reused ${name}`);
      check(entry.requests.filter((request) => request.path.endsWith(".svg")).length === readsBefore, `Zoom makes no image request ${name}`);
      check(await dialog.evaluate((element) => getComputedStyle(element).animationName === "none"), `Reduced motion dialog ${name}`);
      await page.screenshot({ path: join(output, `dialog-${name}.png`) });
      await page.keyboard.press("Tab");
      check(await page.getByTestId("sun-image-close").evaluate((element) => document.activeElement === element && element.closest("dialog")?.matches(":modal")), `Tab stays inside the native image dialog ${name}`);
      await page.keyboard.press("Shift+Tab");
      check(await page.getByTestId("sun-image-close").evaluate((element) => document.activeElement === element && element.closest("dialog")?.matches(":modal")), `Shift Tab stays inside the native image dialog ${name}`);
      await page.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" });
      check(await opener.evaluate((element) => document.activeElement === element), `Escape restores opener ${name}`);
      await opener.click(); await page.getByTestId("sun-image-close").click(); await dialog.waitFor({ state: "detached" });
      check(await opener.evaluate((element) => document.activeElement === element), `Close restores opener ${name}`);
      await opener.click(); await page.mouse.click(2, 2); await dialog.waitFor({ state: "detached" });
      check(await opener.evaluate((element) => document.activeElement === element), `Backdrop restores opener ${name}`);
      await opener.click();
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("fixture-source", { detail: "/photo-b.svg" })));
      await dialog.waitFor({ state: "detached" }); await page.locator('[data-testid="sun-product-image"][data-image-state="ready"]').waitFor();
      check(await image.getAttribute("src") === "/photo-b.svg", `Source change closes old preview ${name}`);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("fixture-source", { detail: "/missing.svg" })));
      await page.getByTestId("sun-image-unavailable").waitFor();
      check(await page.getByTestId("sun-image-unavailable").getAttribute("aria-label") === labels.failed && await opener.count() === 0, `True failure has no photo replacement or zoom ${name}`);
      await page.evaluate(() => window.dispatchEvent(new Event("fixture-remount")));
      await page.locator('.photo[data-fixture-instance="1"]').waitFor(); await page.getByTestId("sun-image-unavailable").waitFor();
      check(await page.getByTestId("sun-product-image").count() === 0, `Failed source remains truthful after remount ${name}`);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("fixture-source", { detail: "/photo-b.svg" })));
      await page.locator('[data-testid="sun-product-image"][data-image-state="ready"]').waitFor();
      check(await opener.count() === 1 && await page.getByTestId("sun-image-unavailable").count() === 0, `New source does not inherit failure ${name}`);
      await page.evaluate(() => window.dispatchEvent(new Event("fixture-disable-zoom")));
      await opener.waitFor({ state: "detached" });
      check(await opener.count() === 0, `Zoom remains optional ${name}`);
      check(await page.evaluate(() => window.__imageGeoCalls) === 0 && entry.blockedWrites.length === 0, `No GPS or writes ${name}`);
      check(entry.errors.length === 0, `No component runtime error ${name}`);
    } finally { release?.(); await context.close(); entry.closed = true; }
  }
} catch (error) { report.errors.push(error.message); }
finally {
  if (browser) { await browser.close(); report.browserClosed = true; }
  server.closeAllConnections(); await new Promise((done) => server.close(done)); report.serverClosed = true;
  report.passed = report.checks.every((entry) => entry.passed) && report.contexts.length === 6 && report.contexts.every((entry) => entry.closed && entry.errors.length === 0 && entry.blockedWrites.length === 0) && report.errors.length === 0 && report.browserClosed && report.serverClosed;
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, contexts: report.contexts.length, errors: report.errors, browserClosed: report.browserClosed, serverClosed: report.serverClosed }));
  if (!report.passed) process.exitCode = 1;
}
