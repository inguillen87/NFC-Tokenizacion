// Production client and CSS; all answers are local synthetic fixtures.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const web = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.env.QA_OUTPUT || "artifacts/sommelier-conversation");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const axeSource = await readFile(process.env.AXE_MODULE_PATH, "utf8");
const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import SommelierClient from'./src/app/me/sommelier/sommelier-client';import shell from'./src/app/me/_components/portal-shell.module.css';function App(){const[visible,setVisible]=useState(true);return <main className={shell.portal} style={{padding:16,boxSizing:'border-box'}}><h1>Asistente de vinos · ensayo local</h1><p>Respuestas sintéticas. Sin consultas a proveedores ni operaciones reales.</p><button type='button' onClick={()=>setVisible(false)}>Salir del ensayo</button>{visible?<SommelierClient productName='' brandName=''/>:<p>Asistente cerrado</p>}</main>};createRoot(document.getElementById('app')).render(<App/>);`;
const bundled = await build({ stdin: { contents: fixture, resolveDir: web, loader: "tsx" }, bundle: true, write: false, outfile: "fixture.js", format: "esm", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "fixture-navigation", setup(build) { build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture-navigation" })); build.onLoad({ filter: /.*/, namespace: "fixture-navigation" }, () => ({ contents: "import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>}", loader: "tsx", resolveDir: web })); } }], logLevel: "error" });
const js = bundled.outputFiles.find(file => file.path.endsWith(".js"));
const css = bundled.outputFiles.find(file => file.path.endsWith(".css"));
const server = createServer((req, res) => {
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  if (req.url === "/fixture.js") { res.setHeader("content-type", "text/javascript"); return res.end(js.contents); }
  if (req.url === "/fixture.css") { res.setHeader("content-type", "text/css"); return res.end(css.contents); }
  if (req.url === "/favicon.ico") { res.writeHead(204); return res.end(); }
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang="es-AR"><head><title>Asistente · ensayo local</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;font:16px/1.5 system-ui}button{font:inherit;min-height:44px}h1{font-size:24px}</style></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>`);
});
await mkdir(output, { recursive: true });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const report = { localOnly: true, actualProductionClientAndCss: true, actualNextServer: false, nextLinkReplacedWithNativeAnchor: true, syntheticAnswers: true, realProviderRequests: 0, geolocationCalls: 0, errors: [], checks: [], views: [] };
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
async function open({ width = 390, theme = "light", answer = () => ({ payload: { optimizedText: "Guía sintética del servicio", fallback: true } }) } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", locale: "es-AR", serviceWorkers: "block" });
  const page = await context.newPage(), calls = [];
  page.setDefaultTimeout(10_000);
  page.on("pageerror", error => report.errors.push(error.message));
  await page.addInitScript(theme => { document.addEventListener("DOMContentLoaded", () => document.documentElement.setAttribute("data-theme", theme), { once: true }); window.__gpsCalls = 0; Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() { window.__gpsCalls++; throw Error("Unexpected GPS"); } } }); }, theme);
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { report.realProviderRequests++; return route.abort(); }
    if (url.pathname.startsWith("/api/")) {
      calls.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
      const result = await answer(request);
      return route.fulfill({ status: result.status || 200, contentType: "application/json", body: typeof result.body === "string" ? result.body : JSON.stringify(result.payload) }).catch(() => {});
    }
    return route.continue();
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByTestId("sommelier-conversation").waitFor();
  return { context, page, calls, close: async () => { report.geolocationCalls += await page.evaluate(() => window.__gpsCalls); await context.close(); } };
}
async function assess(page, width, theme, name) {
  const scope = page.getByTestId("sommelier-conversation");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}/${theme}/${name} fits the viewport`);
  check(await scope.locator("textarea").evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16), `${width}/${theme}/${name} input prevents mobile zoom`);
  check(await scope.locator("a,button,summary").evaluateAll(elements => elements.filter(el => el.getClientRects().length).every(el => el.getBoundingClientRect().height >= 44)), `${width}/${theme}/${name} controls have touch targets`);
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await window.axe.run('[data-testid="sommelier-conversation"]', { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(node => node.target) })));
  check(violations.length === 0, `${width}/${theme}/${name} zero axe violations`);
  await page.screenshot({ path: join(output, `${name}-${width}-${theme}.png`), fullPage: true });
  report.views.push({ width, theme, name, violations });
}
try {
  for (const width of [320, 390, 768, 1440]) for (const theme of ["light", "dark"]) {
    const t = await open({ width, theme });
    check(t.calls.length === 0, `${width}/${theme} opening the assistant makes no request`);
    check((await t.page.getByRole("log").innerText()).includes("No seleccionaste un producto"), `${width}/${theme} no invented product context`);
    await t.page.getByRole("button", { name: "Elegir un maridaje", exact: true }).focus();
    await t.page.keyboard.press("Enter");
    const draft = t.page.getByRole("textbox", { name: "Tu pregunta sobre vinos" });
    check((await draft.inputValue()).includes("maridaje") && await draft.evaluate(el => el === document.activeElement), `${width}/${theme} starter prepares editable draft and keyboard focus`);
    check(t.calls.length === 0, `${width}/${theme} starter never sends automatically`);
    await assess(t.page, width, theme, "ready");
    await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
    await t.page.getByRole("status").filter({ hasText: "Respuesta recibida" }).waitFor();
    check(await draft.inputValue() === "", `${width}/${theme} confirmed text reply clears only the submitted draft`);
    check((await t.page.getByRole("log").innerText()).includes("Guía general del servicio") && !(await t.page.getByRole("log").innerText()).includes("Respuesta con IA"), `${width}/${theme} server fallback is not labeled AI`);
    await t.page.getByText("Origen y alcance de esta respuesta", { exact: true }).click();
    check((await t.page.getByRole("log").innerText()).includes("Fallback del servidor"), `${width}/${theme} response source remains inspectable`);
    await assess(t.page, width, theme, "server-fallback");
    await t.close();
  }
  for (const [name, response] of [["http-denial", { status: 503, payload: { optimizedText: "Unconfirmed text", fallback: false, provider: "qa", model: "qa" } }], ["invalid-json", { body: "not json" }], ["empty-answer", { payload: { optimizedText: " " } }]]) {
    const t = await open({ answer: () => response });
    const draft = t.page.getByRole("textbox", { name: "Tu pregunta sobre vinos" });
    await draft.fill("Consulta sintética que debe conservarse");
    await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
    await t.page.getByRole("status").filter({ hasText: "Conservamos tu consulta" }).waitFor();
    check(await draft.inputValue() === "Consulta sintética que debe conservarse", `${name} preserves the draft`);
    check(t.calls.length === 1 && !(await t.page.getByRole("log").innerText()).includes("Respuesta con IA"), `${name} makes one attempt and never claims an AI answer`);
    check((await t.page.getByRole("log").innerText()).includes("Guía local") && (await t.page.getByRole("log").innerText()).includes("Respuesta del servicio no recibida"), `${name} distinguishes local help from received service response`);
    if (name === "http-denial") await assess(t.page, 390, "light", name);
    await t.close();
  }
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const concurrent = await open({ answer: () => held });
  await concurrent.page.getByRole("textbox", { name: "Tu pregunta sobre vinos" }).fill("Pregunta de doble envío sintético");
  await concurrent.page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await concurrent.page.getByRole("button", { name: "Consultando…", exact: true }).waitFor();
  check(concurrent.calls.length === 1, "synchronous duplicate submit starts one request");
  check(await concurrent.page.getByRole("textbox").getAttribute("readonly") !== null && await concurrent.page.locator("form").getAttribute("aria-busy") === "true", "in-flight draft is stable and pending state is exposed");
  check(await concurrent.page.getByRole("button", { name: "Conservarlo", exact: true }).isDisabled(), "starter cannot race an in-flight request");
  release({ payload: { optimizedText: "Respuesta IA sintética", fallback: false, provider: "qa-provider", model: "qa-model" } });
  await concurrent.page.getByRole("status").filter({ hasText: "Respuesta recibida" }).waitFor();
  check((await concurrent.page.getByRole("log").innerText()).includes("Respuesta con IA"), "only confirmed provider provenance receives AI label");
  await concurrent.close();

  let releaseLate;
  const late = new Promise(resolve => { releaseLate = resolve; });
  const cancelled = await open({ answer: () => late });
  await cancelled.page.getByRole("textbox").fill("Consulta cancelada por navegación");
  await cancelled.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
  await cancelled.page.getByRole("button", { name: "Consultando…", exact: true }).waitFor();
  await cancelled.page.getByRole("button", { name: "Salir del ensayo", exact: true }).click();
  releaseLate({ payload: { optimizedText: "Respuesta tardía sintética", fallback: false, provider: "qa", model: "qa" } });
  await cancelled.page.getByText("Asistente cerrado", { exact: true }).waitFor();
  check(await cancelled.page.getByTestId("sommelier-conversation").count() === 0, "unmount cancellation cannot restore an old conversation");
  await cancelled.close();
  check(report.realProviderRequests === 0 && report.geolocationCalls === 0, "zero real provider or GPS requests");
  check(report.errors.length === 0, "zero unhandled client exceptions");
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.error = String(error.stack);
  const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page) { report.visible = (await page.locator("body").innerText()).slice(0, 8000); await page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => {}); }
  throw error;
} finally {
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, views: report.views.length, errors: report.errors, output }, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
