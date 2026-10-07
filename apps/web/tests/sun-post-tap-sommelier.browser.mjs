// Actual SUN chat in a loopback fixture. Every API response is synthetic and intercepted.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const web = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.env.QA_OUTPUT || "artifacts/sun-post-tap-sommelier");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const paths = ["src/app/sun/qr-engagement-suite.tsx", "src/app/sun/qr-engagement-suite.module.css", "src/lib/sommelier-conversation.ts", "src/app/sun/sun-demo-sommelier.ts"];
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(join(web, path))).digest("hex")])));
const sourceHashes = await hashes();
const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SunLocaleProvider,useSunLocale}from'./src/app/sun/sun-locale-provider';import{QREngagementSuite}from'./src/app/sun/qr-engagement-suite';
function App(){const[product,setProduct]=useState('Vino QA'),[visible,setVisible]=useState(true),[enabled,setEnabled]=useState(true);const{setLocale}=useSunLocale();const configuration={version:'nexid.tenant-actions.v1',status:'published',allowedActions:enabled?['sommelier']:[],catalogAvailable:false,program:null,trivia:null};return <main className='sun-tap-experience' style={{maxWidth:430,margin:'0 auto',padding:12}}><h1>SUN · ensayo sintético</h1><p data-testid='product'>{product}</p><button data-testid='product-change' onClick={()=>setProduct('Vino QB')}>Cambiar producto</button><button data-testid='locale-change' onClick={()=>void setLocale('en')}>Cambiar idioma</button><button data-testid='permission-change' onClick={()=>setEnabled(false)}>Quitar permiso</button><button data-testid='close-chat' onClick={()=>setVisible(false)}>Cerrar chat</button>{visible?<QREngagementSuite productName={product} wineryName='Marca QA' tenantSlug='qa-synthetic' eventId='715' configuration={configuration} initialTab='sommelier'/>:<p data-testid='closed'>Chat cerrado</p>}</main>};createRoot(document.getElementById('app')).render(<SunLocaleProvider initialLocale='es-AR'><App/></SunLocaleProvider>);`;
const bundled = await build({ stdin: { contents: fixture, resolveDir: web, loader: "tsx" }, bundle: true, write: false, outfile: "fixture.js", format: "esm", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "inert-next", setup(b) {
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "nav" }));
  b.onLoad({ filter: /.*/, namespace: "nav" }, () => ({ contents: "import React from'react';export default function Link({prefetch,...props}){return <a {...props}/>}", loader: "tsx", resolveDir: web }));
} }], logLevel: "error" });
const globalCss = await postcss([tailwind()]).process(await readFile(join(web, "src/app/globals.css"), "utf8"), { from: join(web, "src/app/globals.css") });
const js = bundled.outputFiles.find(file => file.path.endsWith(".js"));
const css = (bundled.outputFiles.find(file => file.path.endsWith(".css"))?.text || "") + "\n" + globalCss.css;
const server = createServer((req, res) => {
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  const path = new URL(req.url, "http://fixture.invalid").pathname;
  if (path === "/fixture.js") { res.setHeader("content-type", "text/javascript"); return res.end(js.contents); }
  if (path === "/fixture.css") { res.setHeader("content-type", "text/css"); return res.end(css); }
  if (path === "/favicon.ico") { res.writeHead(204); return res.end(); }
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang='es-AR'><head><title>SUN · ensayo sintético</title><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='stylesheet' href='/fixture.css'><style>body{margin:0;font:16px/1.5 system-ui}*,*:before,*:after{box-sizing:border-box}h1{font-size:20px}main>button{min-height:44px;font:inherit}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
});
await mkdir(output, { recursive: true });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const report = { localOnly: true, syntheticResponses: true, actualProductionChatAndCss: true, actualNextServer: false, realProviderRequests: 0, realBusinessWrites: 0, geolocationCalls: 0, unexpectedRequests: [], errors: [], checks: [], views: [], sourceHashes };
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
const reply = text => ({ status: 200, payload: { optimizedText: text, fallback: true } });
async function open({ width = 390, theme = "dark", answer = () => reply("Guía sintética") } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage(), calls = [];
  page.setDefaultTimeout(10_000);
  page.on("pageerror", error => report.errors.push(error.message));
  await page.addInitScript(theme => {
    document.addEventListener("DOMContentLoaded", () => document.documentElement.dataset.theme = theme, { once: true });
    window.__aborts = 0; window.__gpsCalls = 0;
    const original = window.fetch.bind(window);
    window.fetch = (url, init) => { init?.signal?.addEventListener("abort", () => { window.__aborts++; }, { once: true }); return original(url, init); };
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() { window.__gpsCalls++; throw Error("Unexpected GPS"); } } });
  }, theme);
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { report.realProviderRequests++; return route.abort(); }
    if (url.pathname.startsWith("/api/")) {
      if (!["/api/cognitive-ai", "/api/sun/locale"].includes(url.pathname) || request.method() !== "POST") { report.unexpectedRequests.push({ path: url.pathname, method: request.method() }); return route.abort(); }
      calls.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
      const result = url.pathname === "/api/sun/locale" ? { status: 200, payload: { ok: true } } : await answer(request);
      return route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.payload) }).catch(() => {});
    }
    return route.continue();
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("log").waitFor();
  return { page, calls, context, close: async () => { report.geolocationCalls += await page.evaluate(() => window.__gpsCalls); await context.close(); } };
}
async function waitCalls(t, count) {
  for (let i = 0; i < 100 && t.calls.filter(c => c.path === "/api/cognitive-ai").length < count; i++) await t.page.waitForTimeout(20);
  assert.equal(t.calls.filter(c => c.path === "/api/cognitive-ai").length, count);
}
async function send(t, text) {
  await t.page.getByRole("textbox").fill(text);
  await t.page.getByRole("button", { name: "Enviar pregunta", exact: true }).click();
}
try {
  for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
    let release;
    const pending = new Promise(r => { release = r; });
    let answer = () => pending;
    const t = await open({ width, theme, answer: () => answer() });
    const label = `${width}/${theme}`;
    check(t.calls.length === 0, `${label}: opening sends no question`);
    check(await t.page.getByRole("textbox").evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16), `${label}: input avoids mobile zoom`);
    check(await t.page.getByRole("log").evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 14), `${label}: readable chat font`);
    check(await t.page.getByTestId("sun-sommelier-prompts").locator("button").evaluateAll(els => els.length === 3 && els.every(el => el.getBoundingClientRect().height >= 44)), `${label}: three touch-friendly questions`);
    await t.page.getByRole("textbox").fill("Pregunta sintética doble");
    await t.page.getByRole("textbox").evaluate(el => { for (let i = 0; i < 2; i++) el.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await waitCalls(t, 1);
    check(t.calls[0].body.postTapEventId === "715" && t.calls[0].body.tone === "sommelier-chat", `${label}: event and tone binding preserved`);
    check(t.calls[0].body.productContext.productName === "Vino QA", `${label}: current product context preserved`);
    release(reply("Respuesta sintética confirmada. " + "Orientación general de ensayo. ".repeat(25)));
    await t.page.getByRole("log").getByText("Respuesta sintética confirmada.", { exact: false }).waitFor();
    check(t.calls.length === 1, `${label}: synchronous double-submit makes one request`);
    check(await t.page.getByRole("log").getByText("Pregunta sintética doble", { exact: true }).count() === 1, `${label}: one submitted message`);
    check(await t.page.getByRole("textbox").inputValue() === "", `${label}: successful question clears draft`);
    await t.page.getByRole("log").locator("summary").last().click();
    check((await t.page.getByRole("log").innerText()).includes("Fallback del servidor"), `${label}: actual fallback provenance available`);
    answer = () => ({ status: 503, payload: { error: "synthetic_unavailable" } });
    await send(t, "Pregunta para recuperar");
    await t.page.getByRole("alert").waitFor();
    check(await t.page.getByRole("textbox").inputValue() === "Pregunta para recuperar", `${label}: denial preserves the question`);
    check(t.calls.length === 2, `${label}: denial is not retried automatically`);
    answer = () => reply("Recuperación sintética confirmada");
    await t.page.getByRole("button", { name: "Enviar pregunta", exact: true }).click();
    await t.page.getByRole("log").getByText("Recuperación sintética confirmada", { exact: false }).waitFor();
    check(t.calls.length === 3 && await t.page.getByRole("alert").count() === 0, `${label}: explicit retry recovers`);
    const log = t.page.getByRole("log");
    await log.evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll", { bubbles: true })); });
    answer = () => reply("Respuesta sintética sin desplazar la lectura");
    await send(t, "Pregunta con historial desplazado");
    await log.getByText("Respuesta sintética sin desplazar la lectura", { exact: false }).waitFor();
    check(await log.evaluate(el => el.scrollTop < 2), `${label}: new answer respects reading older messages`);
    await log.evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event("scroll", { bubbles: true })); });
    answer = () => reply("Respuesta sintética siguiendo el final");
    await send(t, "Pregunta cerca del final");
    await log.getByText("Respuesta sintética siguiendo el final", { exact: false }).waitFor();
    check(await log.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight < 3), `${label}: follows conversation when already near the end`);
    check(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
    await t.page.screenshot({ path: join(output, `chat-${width}-${theme}.png`), fullPage: true });
    report.views.push({ width, theme, syntheticRequests: t.calls.length });
    await t.close();
  }
  for (const change of ["product-change", "locale-change", "permission-change", "close-chat"]) {
    let release;
    const pending = new Promise(r => { release = r; });
    const t = await open({ answer: () => pending });
    await send(t, "Pregunta pendiente sintética");
    await waitCalls(t, 1);
    await t.page.getByTestId(change).click();
    await t.page.waitForFunction(() => window.__aborts > 0);
    if (change === "product-change") await t.page.getByTestId("product").getByText("Vino QB", { exact: true }).waitFor();
    if (change === "locale-change") await t.page.getByRole("log", { name: "Wine conversation" }).waitFor();
    if (change === "permission-change") await t.page.getByTestId("sun-actions-unavailable").waitFor();
    if (change === "close-chat") await t.page.getByTestId("closed").waitFor();
    release(reply("Respuesta tardía que no debe aparecer"));
    await t.page.waitForTimeout(50);
    check(await t.page.getByText("Respuesta tardía que no debe aparecer", { exact: false }).count() === 0, `${change}: stale answer cannot enter another scope`);
    check(t.calls.filter(c => c.path === "/api/cognitive-ai").length === 1, `${change}: cancellation makes no extra request`);
    check(await t.page.evaluate(() => window.__aborts) >= 1, `${change}: outstanding request aborted`);
    await t.close();
  }
  check(report.realProviderRequests === 0 && report.unexpectedRequests.length === 0, "all API replies are intercepted loopback fixtures");
  check(report.geolocationCalls === 0 && report.errors.length === 0, "zero GPS calls or browser exceptions");
  report.endSourceHashes = await hashes();
  check(JSON.stringify(report.sourceHashes) === JSON.stringify(report.endSourceHashes), "source stable through behavioral audit");
  report.status = "passed";
} finally {
  if (!report.status) report.status = "failed";
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(r => server.close(r));
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, views: report.views.length, output }));
