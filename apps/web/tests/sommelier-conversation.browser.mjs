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
  for (const [name, response] of [["invalid-json", { body: "not json" }], ["empty-answer", { payload: { ...syntheticLive, answer: " " } }]]) {
    const t = await open({ answer: () => response });
    const draft = t.page.getByRole("textbox", { name: "Tu pregunta sobre vinos" });
    await draft.fill("Consulta sintética que debe conservarse");
    await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
    await t.page.getByRole("status").filter({ hasText: "Conservamos tu consulta" }).waitFor();
    check(await draft.inputValue() === "Consulta sintética que debe conservarse", `${name} preserves the draft`);
    check(t.calls.length === 1 && !(await t.page.getByRole("log").innerText()).includes("Respuesta con IA"), `${name} makes one attempt and never claims an AI answer`);
    check((await t.page.getByRole("log").innerText()).includes("Guía local") && (await t.page.getByRole("log").innerText()).includes("Respuesta de IA no confirmada"), `${name} distinguishes local help from received service response`);
    await t.close();
  }

  for (const width of [320, 390, 1440]) for (const theme of ["light", "dark"]) {
    const t = await open({ width, theme, scope: { eventId: "715", productName: "Producto privado A", brandName: "Marca A" }, answer: () => ({ status: 401, payload: { ok: false } }) });
    const question = "Consulta privada de sesión que debe conservarse";
    const draft = t.page.getByRole("textbox", { name: "Tu pregunta sobre vinos" });
    await draft.fill(question);
    await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
    await t.page.getByRole("status").filter({ hasText: "Necesitás entrar a tu cuenta" }).waitFor();
    const login = t.page.getByRole("link", { name: "Entrar a mi cuenta ↗", exact: true });
    const href = new URL(await login.getAttribute("href"), origin);
    check(href.pathname === "/login" && href.searchParams.get("consumer") === "1" && href.searchParams.get("next") === "/me/sommelier?eventId=715", `${width}/${theme} session recovery keeps only the canonical private reading in login`);
    check(await login.getAttribute("target") === "_blank" && await login.getAttribute("rel") === "noopener noreferrer" && await login.getAttribute("referrerpolicy") === "no-referrer", `${width}/${theme} normal login preserves the original in-memory question without a referrer`);
    check(await draft.inputValue() === question && !href.href.includes(question) && await t.page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ""), `${width}/${theme} draft is retained only in the original screen, never URL or storage`);
    check(t.calls.length === 1 && await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).isDisabled(), `${width}/${theme} session denial cannot automatically resend`);
    check(!(await t.page.getByRole("log").innerText()).includes("Guía local") && !(await t.page.getByRole("log").innerText()).includes("Respuesta con IA"), `${width}/${theme} session denial is not presented as a reply`);
    await login.focus();
    await t.page.keyboard.press("Tab");
    await t.page.keyboard.press("Shift+Tab");
    check(await login.evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== "none"), `${width}/${theme} login recovery is keyboard reachable with visible focus`);
    await assess(t.page, width, theme, "session-recovery");
    await t.page.getByRole("button", { name: "Ya ingresé, revisar mi pregunta", exact: true }).click();
    check(t.calls.length === 1 && await draft.inputValue() === question && await draft.evaluate(el => el === document.activeElement), `${width}/${theme} explicit return prepares a draft and never sends`);
    await t.close();
  }

  for (const [name, status, reason, scope, expectedNext] of [
    ["general-session-403", 403, "sommelier_consumer_session_required", { productName: "", brandName: "" }, "/me/sommelier"],
    ["invalid-event-session-401", 401, undefined, { eventId: "715&tenant=other", productName: "Untrusted label", brandName: "Untrusted brand" }, "/me/sommelier"],
  ]) {
    const t = await open({ scope, answer: () => ({ status, payload: { ok: false, reason } }) });
    await t.page.getByRole("textbox").fill("Borrador de acceso sintético");
    await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
    await t.page.getByRole("status").filter({ hasText: "Necesitás entrar a tu cuenta" }).waitFor();
    const login = t.page.getByRole("link", { name: "Entrar a mi cuenta ↗", exact: true });
    check(new URL(await login.getAttribute("href"), origin).searchParams.get("next") === expectedNext, `${name} cannot carry labels or invalid event data into normal login`);
    const popupPromise = t.page.waitForEvent("popup");
    await login.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    check(await t.page.getByRole("textbox").inputValue() === "Borrador de acceso sintético" && t.calls.length === 1, `${name} opening normal login leaves the draft and makes no automatic query`);
    await popup.close();
    await t.close();
  }

  for (const theme of ["light", "dark"]) {
    const t = await open({ theme, scope: { eventId: "715", productName: "Producto privado A", brandName: "Marca A" }, answer: () => ({ status: 403, payload: { ok: false, reason: "sommelier_event_not_authorized" } }) });
    await t.page.getByRole("textbox").fill("Pregunta de acceso al producto");
    await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
    await t.page.getByRole("status").filter({ hasText: "No pudimos confirmar tu acceso" }).waitFor();
    const reading = t.page.getByRole("link", { name: "Revisar mi lectura ↗", exact: true });
    check(await reading.getAttribute("href") === "/me/taps/715" && await reading.getAttribute("target") === "_blank" && await reading.getAttribute("rel") === "noopener noreferrer" && await reading.getAttribute("referrerpolicy") === "no-referrer", `${theme} denied product context opens its own reading separately without draft or referrer`);
    check(await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).isDisabled() && t.calls.length === 1 && await t.page.getByRole("textbox").inputValue() === "Pregunta de acceso al producto", `${theme} permission recovery preserves the draft and prevents a retry loop`);
    check(await t.page.getByRole("link", { name: "Entrar a mi cuenta ↗", exact: true }).count() === 0 && !(await t.page.getByRole("log").innerText()).includes("Guía local"), `${theme} ambiguous context denial never claims a logout or a service reply`);
    await assess(t.page, 390, theme, "access-recovery");
    const popupPromise = t.page.waitForEvent("popup");
    await reading.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    check(await t.page.getByRole("textbox").inputValue() === "Pregunta de acceso al producto" && t.calls.length === 1, `${theme} reading review keeps the original draft without automatic requests`);
    await popup.close();
    await t.page.getByRole("button", { name: "Ya revisé, volver a consultar", exact: true }).click();
    check(t.calls.length === 1 && await t.page.getByRole("textbox").evaluate(el => el === document.activeElement), `${theme} explicit reading review only readies the draft, without assuming authorization`);
    await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
    await t.page.getByRole("status").filter({ hasText: "No pudimos confirmar tu acceso" }).waitFor();
    check(t.calls.length === 2 && t.calls[1].body.history.length === 0 && await t.page.getByRole("button", { name: "Enviar consulta", exact: true }).isDisabled(), `${theme} another 403 reasserts the access guard and excludes unconfirmed history`);
    await t.close();
  }

  const service = await open({ answer: () => ({ status: 503, payload: { ok: false, reason: "sommelier_disabled", detail: "PRIVATE PROVIDER TEXT" } }) });
  await service.page.getByRole("textbox").fill("Pregunta durante la caída del servicio");
  await service.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
  await service.page.getByRole("status").filter({ hasText: "El asistente no está disponible por el momento" }).waitFor();
  check(await service.page.getByRole("textbox").inputValue() === "Pregunta durante la caída del servicio" && service.calls.length === 1, "503 preserves the draft with one attempt");
  check(await service.page.getByRole("link", { name: "Entrar a mi cuenta ↗", exact: true }).count() === 0 && !(await service.page.locator("body").innerText()).includes("PRIVATE PROVIDER TEXT"), "503 never invents a logout or displays private provider details");
  check(!(await service.page.getByRole("button", { name: "Enviar consulta", exact: true }).isDisabled()) && (await service.page.getByRole("log").innerText()).includes("Guía local"), "503 permits only a manual retry and keeps local help labeled");
  await assess(service.page, 390, "light", "service-recovery");
  await service.close();

  const recovered = await open({ answer: request => request.postDataJSON().history.length === 0 && recovered.calls.length === 1 ? { status: 401, payload: { ok: false } } : { payload: syntheticLive } });
  await recovered.page.getByRole("textbox").fill("Pregunta para recuperar la sesión");
  await recovered.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
  await recovered.page.getByRole("status").filter({ hasText: "Necesitás entrar a tu cuenta" }).waitFor();
  await recovered.page.getByRole("button", { name: "Ya ingresé, revisar mi pregunta", exact: true }).click();
  check(recovered.calls.length === 1, "re-entering the account is never treated as consent to resend");
  await recovered.page.getByRole("button", { name: "Enviar consulta", exact: true }).click();
  await recovered.page.getByRole("status").filter({ hasText: "Respuesta recibida" }).waitFor();
  check(recovered.calls.length === 2 && recovered.calls[1].body.history.length === 0 && await recovered.page.getByRole("textbox").inputValue() === "", "manual resend revalidates through the service and excludes the unconfirmed denied turn");
  await recovered.close();
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
  releaseLate({ status: 401, payload: { ok: false } });
  await cancelled.page.getByText("Asistente cerrado", { exact: true }).waitFor();
  check(await cancelled.page.getByTestId("sommelier-conversation").count() === 0 && await cancelled.page.getByRole("link", { name: "Entrar a mi cuenta ↗", exact: true }).count() === 0, "unmount cancellation cannot restore a late session recovery or an old conversation");
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
