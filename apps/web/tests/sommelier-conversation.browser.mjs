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
const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import SommelierClient from'./src/app/me/sommelier/sommelier-client';import shell from'./src/app/me/_components/portal-shell.module.css';function App(){const[visible,setVisible]=useState(true);const[scope,setScope]=useState(window.__sommelierScope||{productName:'',brandName:''});return <main className={shell.portal} style={{padding:16,boxSizing:'border-box'}}><h1>Asistente de vinos · ensayo local</h1><p>Respuestas sintéticas. Sin consultas a proveedores ni operaciones reales.</p><button type='button' onClick={()=>setVisible(false)}>Salir del ensayo</button><button type='button' onClick={()=>setScope({eventId:'716',productName:'Segundo producto privado',brandName:'Marca B'})}>Cambiar producto del ensayo</button>{visible?<SommelierClient key={scope.eventId||'general'} {...scope}/>:<p>Asistente cerrado</p>}</main>};createRoot(document.getElementById('app')).render(<App/>);`;
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
const syntheticLive = { ok: true, version: "nexid.sommelier.v1", answer: "Respuesta IA sintética", source: "live", fallback: false, provider: "synthetic", model: "fixture", demo: false, sources: [{ id: "sheet", label: "Ficha sintética publicada", url: "https://vallesecreto.cl/" }], suggestedQuestions: ["¿Qué comida vas a preparar?"] };
async function open({ width = 390, theme = "light", scope = { productName: "", brandName: "" }, answer = () => ({ payload: syntheticLive }) } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", locale: "es-AR", serviceWorkers: "block" });
  const page = await context.newPage(), calls = [];
  page.setDefaultTimeout(10_000);
  page.on("pageerror", error => report.errors.push(error.message));
  await page.addInitScript(theme => { document.addEventListener("DOMContentLoaded", () => document.documentElement.setAttribute("data-theme", theme), { once: true }); window.__gpsCalls = 0; Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() { window.__gpsCalls++; throw Error("Unexpected GPS"); } } }); }, theme);
  await page.addInitScript(scope => { window.__sommelierScope = scope; }, scope);
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
  check(await page.evaluate(() => document.documentElement.dataset.theme) === theme, `${width}/${theme}/${name} uses the requested theme`);
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
    check((await t.page.getByRole("log").innerText()).includes("Respuesta con IA"), `${width}/${theme} only received live provenance is labeled AI`);
    check(t.calls.length === 1 && t.calls[0].path === "/api/sommelier/chat" && t.calls[0].body.mode === "consumer" && !Object.hasOwn(t.calls[0].body, "eventId"), `${width}/${theme} general mode reuses consumer API without product facts or a demo grant`);
    await t.page.getByText("Origen y alcance de esta respuesta", { exact: true }).click();
    check((await t.page.getByRole("log").innerText()).includes("Proveedor confirmado"), `${width}/${theme} response source remains inspectable`);
    check(await t.page.getByRole("link", { name: "Ficha sintética publicada ↗" }).getAttribute("referrerpolicy") === "no-referrer", `${width}/${theme} published source opens without passport referrer`);
    await assess(t.page, width, theme, "live-reply");
    await t.close();
  }
  for (const [name, response] of [["http-denial", { status: 403, payload: { ok: false, reason: "sommelier_event_not_authorized" } }], ["invalid-json", { body: "not json" }], ["empty-answer", { payload: { ...syntheticLive, answer: " " } }]]) {
    const t = await open({ answer: () => response });
    const draft = t.page.getByRole("textbox", { name: "Tu pregunta sobre vinos" });
    await draft.fill("Consulta sintética que debe conservarse");
    await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
    await t.page.getByRole("status").filter({ hasText: "Conservamos tu consulta" }).waitFor();
    check(await draft.inputValue() === "Consulta sintética que debe conservarse", `${name} preserves the draft`);
    check(t.calls.length === 1 && !(await t.page.getByRole("log").innerText()).includes("Respuesta con IA"), `${name} makes one attempt and never claims an AI answer`);
    check((await t.page.getByRole("log").innerText()).includes("Guía local") && (await t.page.getByRole("log").innerText()).includes("Respuesta de IA no confirmada"), `${name} distinguishes local help from received service response`);
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
  release({ payload: syntheticLive });
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
  releaseLate({ payload: { ...syntheticLive, answer: "Respuesta tardía sintética" } });
  await cancelled.page.getByText("Asistente cerrado", { exact: true }).waitFor();
  check(await cancelled.page.getByTestId("sommelier-conversation").count() === 0, "unmount cancellation cannot restore an old conversation");
  await cancelled.close();

  const fallback = await open({ answer: () => ({ payload: { ...syntheticLive, answer: "Guía general sintética", source: "fallback", fallback: true } }) });
  await fallback.page.getByRole("textbox").fill("Pregunta sintética para reintentar");
  await fallback.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
  await fallback.page.getByRole("status").filter({ hasText: "La IA no está disponible" }).waitFor();
  check(await fallback.page.getByRole("textbox").inputValue() === "Pregunta sintética para reintentar", "server fallback preserves the question");
  check((await fallback.page.getByRole("log").innerText()).includes("Guía general del servicio") && !(await fallback.page.getByRole("log").innerText()).includes("Respuesta con IA"), "server fallback has no live AI badge");
  await fallback.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
  await fallback.page.getByRole("button", { name: "Enviar consulta", exact: true }).waitFor();
  check(fallback.calls.length === 2 && fallback.calls[1].body.history.length === 0, "failed question and fallback never re-enter history as confirmed turns");
  await assess(fallback.page, 390, "light", "server-fallback");
  await fallback.close();

  const contextual = await open({ theme: "dark", scope: { eventId: "715", productName: "Producto privado A", brandName: "Marca A" } });
  await contextual.page.getByRole("textbox").fill("Primera consulta privada");
  await contextual.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
  await contextual.page.getByRole("status").filter({ hasText: "Respuesta recibida" }).waitFor();
  check(contextual.calls[0].body.eventId === "715" && !Object.hasOwn(contextual.calls[0].body, "productContext") && !Object.hasOwn(contextual.calls[0].body, "tenant"), "context sends only the server-authorized event reference");
  await contextual.page.getByRole("button", { name: "¿Qué comida vas a preparar?", exact: true }).click();
  check(contextual.calls.length === 1 && await contextual.page.getByRole("textbox").inputValue() === "¿Qué comida vas a preparar?", "follow-up prepares a draft without automatically querying");
  await contextual.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
  await contextual.page.getByRole("status").filter({ hasText: "Respuesta recibida" }).waitFor();
  check(contextual.calls[1].body.history.length === 2 && contextual.calls[1].body.history[0].content === "Primera consulta privada", "next answer carries the confirmed conversation");
  for (let index = 0; index < 5; index++) {
    await contextual.page.getByRole("textbox").fill(`Consulta ${index}`);
    await contextual.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
    await contextual.page.getByRole("button", { name: "Enviar consulta", exact: true }).waitFor();
  }
  check(contextual.calls.at(-1).body.history.length === 6 && new TextEncoder().encode(JSON.stringify(contextual.calls.at(-1).body.history)).length <= 6000, "conversation history remains inside backend limits");
  await assess(contextual.page, 390, "dark", "contextual-history");
  await contextual.close();

  let releaseScope;
  const scopeHeld = new Promise(resolve => { releaseScope = resolve; });
  const changing = await open({ scope: { eventId: "715", productName: "Producto privado A", brandName: "Marca A" }, answer: () => scopeHeld });
  await changing.page.getByRole("textbox").fill("Consulta de producto anterior");
  await changing.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
  await changing.page.getByRole("button", { name: "Consultando…", exact: true }).waitFor();
  await changing.page.getByRole("button", { name: "Cambiar producto del ensayo", exact: true }).click();
  await changing.page.getByText("Segundo producto privado", { exact: true }).waitFor();
  releaseScope({ payload: { ...syntheticLive, answer: "Respuesta tardía de producto anterior" } });
  await changing.page.getByRole("button", { name: "Enviar consulta", exact: true }).waitFor();
  check(!(await changing.page.getByRole("log").innerText()).includes("Respuesta tardía") && await changing.page.getByRole("textbox").inputValue() === "", "context cancellation cannot restore an old answer or draft");
  await changing.close();
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
