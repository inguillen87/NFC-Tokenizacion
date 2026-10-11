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
// Same external AXE source input as the existing sun-managed-sommelier browser suite.
// Missing AXE is a failed prerequisite, never a reason to skip accessibility or contrast.
const axeSource = await readFile(process.env.AXE_MODULE_PATH, "utf8");
const paths = ["tests/sun-post-tap-sommelier.browser.mjs", "src/app/sun/qr-engagement-suite.tsx", "src/app/sun/qr-engagement-suite.module.css", "src/lib/managed-sommelier.ts", "src/lib/sommelier-guidance.ts", "src/lib/sommelier-conversation.ts", "src/app/sun/sun-demo-sommelier.ts", "src/app/sun/valle-secreto-demo.ts", "src/app/sun/sun-locale-provider.tsx", "src/app/globals.css", "src/app/layout.tsx", "../../packages/ui/src/theme-toggle.tsx"];
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(join(web, path))).digest("hex")])));
const sourceHashes = await hashes();
const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SunLocaleProvider,useSunLocale}from'./src/app/sun/sun-locale-provider';import{QREngagementSuite}from'./src/app/sun/qr-engagement-suite';import{VALLE_SECRETO_DEMO}from'./src/app/sun/valle-secreto-demo';
const params=new URLSearchParams(location.search),initialLocale=['es-AR','en','pt-BR'].includes(params.get('locale'))?params.get('locale'):'es-AR';function App(){const[product,setProduct]=useState('Vino QA'),[eventId,setEventId]=useState(params.has('eventless')?null:'715'),[visible,setVisible]=useState(true),[enabled,setEnabled]=useState(true);const{setLocale}=useSunLocale();const configuration={version:'nexid.tenant-actions.v1',status:'published',allowedActions:enabled?(params.has('tooltips')?['sommelier','feedback','lead']:['sommelier']):[],catalogAvailable:false,program:null,trivia:null};return <main className='sun-tap-experience' style={{maxWidth:430,margin:'0 auto',padding:12}}><h1>SUN · ensayo sintético</h1><p data-testid='product'>{product}</p><button data-testid='product-change' onClick={()=>{setProduct('Vino QB');setEventId('716')}}>Cambiar producto</button><button data-testid='locale-change' onClick={()=>void setLocale(params.get('nextLocale')==='pt-BR'?'pt-BR':'en')}>Cambiar idioma</button><button data-testid='permission-change' onClick={()=>setEnabled(false)}>Quitar permiso</button><button data-testid='close-chat' onClick={()=>setVisible(false)}>Cerrar chat</button>{visible?<QREngagementSuite productName={product} wineryName='Marca QA' tenantSlug='qa-synthetic' eventId={eventId} configuration={configuration} isDemoPreview={params.has('valleDemo')} demoWineProfile={params.has('valleDemo')?VALLE_SECRETO_DEMO:null} initialTab='sommelier'/>:<p data-testid='closed'>Chat cerrado</p>}</main>};createRoot(document.getElementById('app')).render(<SunLocaleProvider initialLocale={initialLocale}><App/></SunLocaleProvider>);`;
const bundled = await build({ stdin: { contents: fixture, resolveDir: web, loader: "tsx" }, bundle: true, write: false, outfile: "fixture.js", format: "esm", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "inert-next", setup(b) {
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "nav" }));
  b.onLoad({ filter: /.*/, namespace: "nav" }, () => ({ contents: "import React from'react';export default function Link({prefetch,...props}){return <a {...props}/>}", loader: "tsx", resolveDir: web }));
} }], logLevel: "error" });
const globalCss = await postcss([tailwind()]).process(await readFile(join(web, "src/app/globals.css"), "utf8"), { from: join(web, "src/app/globals.css") });
const js = bundled.outputFiles.find(file => file.path.endsWith(".js"));
const css = (bundled.outputFiles.find(file => file.path.endsWith(".css"))?.text || "") + "\n" + globalCss.css;
const server = createServer((req, res) => {
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  const fixtureUrl = new URL(req.url, "http://fixture.invalid"), path = fixtureUrl.pathname;
  if (path === "/fixture.js") { res.setHeader("content-type", "text/javascript"); return res.end(js.contents); }
  if (path === "/fixture.css") { res.setHeader("content-type", "text/css"); return res.end(css); }
  if (path === "/favicon.ico") { res.writeHead(204); return res.end(); }
  res.setHeader("content-type", "text/html; charset=utf-8");
  const fixtureTheme = fixtureUrl.searchParams.get("theme") === "light" ? "light" : "dark";
  const fixtureLocale = ["es-AR", "en", "pt-BR"].includes(fixtureUrl.searchParams.get("locale")) ? fixtureUrl.searchParams.get("locale") : "es-AR";
  // layout.tsx and applyTheme use lightclass + data-theme; theme-dark is an extra variant, not canonical layout.
  const explicitDarkClass = fixtureTheme === "dark" && fixtureUrl.searchParams.get("themeClasses") === "explicit-dark-class";
  const fixtureClass = fixtureTheme === "light" ? "theme-light" : explicitDarkClass ? "theme-dark" : "";
  res.end(`<!doctype html><html lang='${fixtureLocale}' class='${fixtureClass}' data-theme='${fixtureTheme}'><head><title>SUN · ensayo sintético</title><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='stylesheet' href='/fixture.css'><style>body{margin:0;font:16px/1.5 system-ui}*,*:before,*:after{box-sizing:border-box}h1{font-size:20px}main>button{min-height:44px;font:inherit}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
});
await mkdir(output, { recursive: true });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const report = { localOnly: true, syntheticResponses: true, actualApplicationChatAndCss: true, actualNextServer: false, realTenantSessionAcceptance: false, publicAcceptance: false, realProviderRequests: 0, realBusinessWrites: 0, geolocationCalls: 0, unexpectedRequests: [], errors: [], checks: [], views: [], accessibility: [], conversationGeometry: [], pageAnchors: [], deadlineCases: [], sourceHashes, axeSourceSha256: createHash("sha256").update(axeSource).digest("hex"), configuredManagedDeadlineMs: 12_000, fixtureThemePolicy: "canonical layout lightclass/data-theme; explicit-dark-class separately labelled" };
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
const reply = (text, fallback = false, options = {}) => ({ status: 200, payload: { ok: true, answer: text, source: fallback ? "fallback" : "live", fallback, demo: options.demo ?? false, ...(!fallback ? { provider: "fixture-provider", model: "fixture-model" } : {}), sources: options.sources ?? [{ id: "product", label: "Dato publicado sintético", url: null }], suggestedQuestions: options.suggestedQuestions ?? [] } });
async function open({ width = 390, theme = "dark", themeClasses = "layout", locale = "es-AR", eventless = false, valleDemo = false, tooltips = false, nextLocale = null, reducedMotion = "reduce", answer = () => reply("Guía sintética") } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion, serviceWorkers: "block" });
  const page = await context.newPage(), calls = [];
  page.setDefaultTimeout(10_000);
  page.on("pageerror", error => report.errors.push(error.message));
  await page.addInitScript(({ theme, themeClasses, locale }) => {
    document.addEventListener("DOMContentLoaded", () => {
      const root = document.documentElement;
      root.dataset.theme = theme; root.lang = locale; root.style.colorScheme = theme;
      root.classList.toggle("theme-light", theme === "light");
      root.classList.toggle("theme-dark", theme === "dark" && themeClasses === "explicit-dark-class");
    }, { once: true });
    window.__aborts = 0; window.__gpsCalls = 0; window.__answerAnchorScrolls = [];
    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(options) {
      if (this.matches('[data-testid="sun-sommelier-latest-answer"]')) window.__answerAnchorScrolls.push({ id: this.id, behavior: options?.behavior ?? null, block: options?.block ?? null });
      return scrollIntoView.call(this, options);
    };
    const original = window.fetch.bind(window);
    window.fetch = (url, init) => { init?.signal?.addEventListener("abort", () => { window.__aborts++; }, { once: true }); return original(url, init); };
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() { window.__gpsCalls++; throw Error("Unexpected GPS"); } } });
  }, { theme, themeClasses, locale });
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { report.realProviderRequests++; return route.abort(); }
    if (url.pathname.startsWith("/api/")) {
      if (!["/api/sommelier/chat", "/api/sun/locale", ...(valleDemo ? ["/api/sommelier/demo/session"] : [])].includes(url.pathname) || request.method() !== "POST") { report.unexpectedRequests.push({ path: url.pathname, method: request.method() }); return route.abort(); }
      calls.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
      const result = url.pathname === "/api/sun/locale" ? { status: 200, payload: { ok: true } } : url.pathname === "/api/sommelier/demo/session" ? { status: 200, payload: { ok: true, profile: "valle-secreto" } } : await answer(request);
      return route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.payload) }).catch(() => {});
    }
    return route.continue();
  });
  const fixtureUrl = new URL(origin);
  fixtureUrl.searchParams.set("locale", locale);
  fixtureUrl.searchParams.set("theme", theme);
  fixtureUrl.searchParams.set("themeClasses", themeClasses);
  if (eventless) fixtureUrl.searchParams.set("eventless", "1");
  if (valleDemo) fixtureUrl.searchParams.set("valleDemo", "1");
  if (tooltips) fixtureUrl.searchParams.set("tooltips", "1");
  if (nextLocale) fixtureUrl.searchParams.set("nextLocale", nextLocale);
  await page.goto(fixtureUrl.href, { waitUntil: "networkidle" });
  await page.getByRole("log").waitFor();
  check(await page.evaluate(({ theme, themeClasses, locale }) => document.documentElement.dataset.theme === theme && document.documentElement.lang === locale && document.documentElement.classList.contains("theme-light") === (theme === "light") && document.documentElement.classList.contains("theme-dark") === (theme === "dark" && themeClasses === "explicit-dark-class"), { theme, themeClasses, locale }), `${width}/${theme}/${locale}/${themeClasses}: fixture uses the declared theme/locale contract`);
  await page.addScriptTag({ content: axeSource });
  return { page, calls, context, width, theme, themeClasses, locale, reducedMotion, close: async () => { report.geolocationCalls += await page.evaluate(() => window.__gpsCalls); await context.close(); } };
}
async function waitCalls(t, count) {
  for (let i = 0; i < 100 && t.calls.filter(c => c.path === "/api/sommelier/chat").length < count; i++) await t.page.waitForTimeout(20);
  assert.equal(t.calls.filter(c => c.path === "/api/sommelier/chat").length, count);
}
async function send(t, text) {
  await t.page.getByRole("textbox").fill(text);
  await t.page.getByRole("textbox").locator("..").getByRole("button", { exact: true }).click();
}
async function inspectAccessibility(t, phase) {
  // Include color-contrast unchanged; incomplete contrast is pending evidence, not an accepted pass.
  const observation = await t.page.evaluate(async () => {
    const result = await axe.run(".sun-engagement-suite", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
    const rows = values => values.map(value => ({ id: value.id, impact: value.impact, nodes: value.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary, any: node.any.map(item => ({ id: item.id, data: item.data })) })) }));
    return { violations: rows(result.violations), incomplete: rows(result.incomplete), contrastPassedNodes: result.passes.filter(value => value.id === "color-contrast").reduce((count, value) => count + value.nodes.length, 0) };
  });
  report.accessibility.push({ width: t.width, theme: t.theme, themeClasses: t.themeClasses, locale: t.locale, phase, ...observation });
  check(observation.violations.length === 0, `${t.width}/${t.theme}/${t.locale}/${phase}: actual SUN component AXE has zero violations`);
  check(!observation.incomplete.some(value => value.id === "color-contrast") && observation.contrastPassedNodes > 0, `${t.width}/${t.theme}/${t.locale}/${phase}: contrast has evaluated passing text and no incomplete contrast`);
}
async function inspectNaturalConversation(t, phase) {
  const observation = await t.page.getByRole("log").evaluate(log => {
    const box = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width }; };
    const logRect = box(log), style = getComputedStyle(log);
    const rows = [...log.children].map((row, index) => {
      const bubble = row.firstElementChild, elements = [bubble, ...bubble.querySelectorAll("details, summary, details[open] > p")].filter(element => element.getClientRects().length);
      return { index, bubble: box(bubble), details: [...bubble.querySelectorAll("details")].map(box), clipped: elements.some(element => {
        const r = box(element);
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const s = getComputedStyle(parent), p = box(parent);
          if (["hidden", "clip", "auto", "scroll"].includes(s.overflowY) && (r.top < p.top - 2 || r.bottom > p.bottom + 2)) return true;
          if (["hidden", "clip", "auto", "scroll"].includes(s.overflowX) && (r.left < p.left - 2 || r.right > p.right + 2)) return true;
        }
        return false;
      }) };
    });
    return { logRect, overflowY: style.overflowY, minHeight: parseFloat(style.minHeight), scrollHeight: log.scrollHeight, clientHeight: log.clientHeight, rows };
  });
  report.conversationGeometry.push({ width: t.width, theme: t.theme, locale: t.locale, phase, ...observation });
  check(observation.overflowY === "visible" && observation.minHeight >= 280 && observation.scrollHeight <= observation.clientHeight + 2, `${t.width}/${t.theme}/${phase}: whole conversation grows in page flow without an inner viewport`);
  check(observation.rows.length > 0 && observation.rows.every(row => row.bubble.height > 0 && row.bubble.top >= observation.logRect.top - 2 && row.bubble.bottom <= observation.logRect.bottom + 2 && !row.clipped), `${t.width}/${t.theme}/${phase}: every retained bubble and expanded source detail fits its ancestors without clipping`);
}
async function viewLatestAnswer(t, label, expectedText) {
  const link = t.page.getByTestId("sun-sommelier-latest-answer-link"), target = t.page.getByTestId("sun-sommelier-latest-answer");
  const id = await target.getAttribute("id");
  check(Boolean(id) && await link.getAttribute("href") === `#${id}` && await link.getAttribute("aria-controls") === id, `${label}: explicit latest-answer action points to the current page anchor`);
  await link.focus();
  // Observe the document destination before activation; do not substitute a timer for scrolling.
  const before = await target.evaluate(target => {
    const top = target.getBoundingClientRect().top, style = getComputedStyle(target), rootStyle = getComputedStyle(document.scrollingElement || document.documentElement);
    const pixels = value => Number.isFinite(parseFloat(value)) ? parseFloat(value) : 0;
    const targetDocumentTop = scrollY + top, scrollMarginStart = pixels(style.scrollMarginBlockStart), scrollPaddingStart = pixels(rootStyle.scrollPaddingBlockStart);
    const pageHeight = document.documentElement.scrollHeight, viewportHeight = innerHeight, maxScrollY = Math.max(0, pageHeight - viewportHeight);
    const destinationY = Math.max(0, Math.min(maxScrollY, targetDocumentTop - scrollMarginStart - scrollPaddingStart));
    return { id: target.id, pageY: scrollY, top, targetDocumentTop, scrollMarginStart, scrollPaddingStart, pageHeight, viewportHeight, maxScrollY, destinationY, destinationTop: targetDocumentTop - destinationY };
  });
  await t.page.keyboard.press("Enter");
  const observation = await t.page.evaluate(({ before, expectedText, behavior }) => new Promise(resolve => {
    const timeoutMs = 10_000, requiredStableFrames = 3, startedAt = performance.now();
    let frame = null, timer = null, finished = false, frames = 0, stableFrames = 0, previous = null, firstSample = null, lastSample = null;
    const capture = () => {
      const target = document.querySelector('[data-testid="sun-sommelier-latest-answer"]'), rect = target?.getBoundingClientRect();
      return { id: target?.id ?? null, text: target?.innerText ?? "", focused: Boolean(target && target === document.activeElement), pageY: scrollY, pageHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight, top: rect?.top ?? null, targetDocumentTop: rect ? scrollY + rect.top : null, lastScroll: window.__answerAnchorScrolls.at(-1) ?? null, elapsedMs: performance.now() - startedAt };
    };
    const finish = completed => {
      if (finished) return;
      finished = true;
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
      resolve({ ...capture(), before, completion: { completed, timeoutMs, requiredStableFrames, frames, stableFrames, firstSample, lastSample, elapsedMs: performance.now() - startedAt } });
    };
    const sample = () => {
      const current = capture(); frames++;
      if (!firstSample) firstSample = current;
      lastSample = current;
      if (current.elapsedMs >= timeoutMs) return finish(false);
      const destinationReached = current.id === before.id && current.focused && current.text.includes(expectedText) && current.pageHeight === before.pageHeight && current.viewportHeight === before.viewportHeight && Math.abs(current.targetDocumentTop - before.targetDocumentTop) <= 2 && Math.abs(current.pageY - before.destinationY) <= 2 && Math.abs(current.top - before.destinationTop) <= 2 && current.top >= -2 && current.top < current.viewportHeight && current.lastScroll?.id === before.id && current.lastScroll.block === "start" && current.lastScroll.behavior === behavior;
      const stable = previous && Math.abs(current.pageY - previous.pageY) <= 1 && Math.abs(current.top - previous.top) <= 1;
      stableFrames = destinationReached ? stable ? stableFrames + 1 : 1 : 0;
      previous = current;
      if (stableFrames >= requiredStableFrames) return finish(true);
      frame = requestAnimationFrame(sample);
    };
    timer = setTimeout(() => finish(false), timeoutMs);
    frame = requestAnimationFrame(sample);
  }), { before, expectedText, behavior: t.reducedMotion === "reduce" ? "auto" : "smooth" });
  report.pageAnchors.push({ width: t.width, theme: t.theme, locale: t.locale, reducedMotion: t.reducedMotion, label, ...observation });
  check(observation.completion.completed, `${label}: manual anchor reaches its clamped destination for three actual animation frames within the real 10s bound`);
  check(observation.text.includes(expectedText) && observation.focused && (observation.pageHeight <= observation.viewportHeight + 2 || observation.pageY > 0) && observation.lastScroll?.id === id && observation.lastScroll.block === "start" && observation.lastScroll.behavior === (t.reducedMotion === "reduce" ? "auto" : "smooth"), `${label}: manual anchor reaches the latest full answer and honors reduced motion`);
}
try {
  for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
    let release;
    const pending = new Promise(r => { release = r; });
    let answer = () => pending;
    const t = await open({ width, theme, answer: () => answer() });
    const label = `${width}/${theme}`;
    check(t.calls.length === 0, `${label}: opening sends no question`);
    await inspectAccessibility(t, "initial");
    await inspectNaturalConversation(t, "initial");
    check(await t.page.getByTestId("sun-sommelier-latest-answer-link").count() === 0, `${label}: welcome alone does not advertise a received answer`);
    check(await t.page.getByRole("textbox").evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16), `${label}: input avoids mobile zoom`);
    check(await t.page.getByRole("log").evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 14), `${label}: readable chat font`);
    check(await t.page.getByTestId("sun-sommelier-prompts").locator("button").evaluateAll(els => els.length === 3 && els.every(el => el.getBoundingClientRect().height >= 44)), `${label}: three touch-friendly questions`);
    await t.page.getByRole("textbox").fill("Pregunta sintética doble");
    await t.page.getByRole("textbox").evaluate(el => { for (let i = 0; i < 2; i++) el.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await waitCalls(t, 1);
    check(t.calls[0].body.eventId === "715" && t.calls[0].body.mode === "consumer" && t.calls[0].body.locale === "es-AR", `${label}: event, consumer mode and locale binding preserved`);
    check(JSON.stringify(Object.keys(t.calls[0].body).sort()) === JSON.stringify(["eventId", "history", "locale", "mode", "question"]), `${label}: product, tenant and NFC facts cannot be supplied by the browser`);
    check(t.calls[0].body.history.length === 0, `${label}: welcome cannot become authoritative conversation evidence`);
    check(await t.page.getByRole("textbox").getAttribute("maxlength") === "1500", `${label}: input matches the API question cap`);
    release(reply("Respuesta sintética confirmada. " + "Orientación general de ensayo. ".repeat(25)));
    await t.page.getByRole("log").getByText("Respuesta sintética confirmada.", { exact: false }).waitFor();
    check(t.calls.length === 1, `${label}: synchronous double-submit makes one request`);
    check(await t.page.getByRole("log").getByText("Pregunta sintética doble", { exact: true }).count() === 1, `${label}: one submitted message`);
    check(await t.page.getByRole("textbox").inputValue() === "", `${label}: successful question clears draft`);
    await t.page.getByRole("log").locator("summary").last().click();
    check((await t.page.getByRole("log").innerText()).includes("Proveedor confirmado · fixture-provider / fixture-model"), `${label}: LIVE provenance is shown only for the intercepted confirmed response`);
    check(await t.page.getByRole("log").getByText("Dato publicado sintético", { exact: true }).count() === 1, `${label}: server source label is rendered`);
    await inspectNaturalConversation(t, "live-provenance-expanded");
    check((await t.page.getByRole("log").innerText()).includes("Respuesta sintética confirmada. " + "Orientación general de ensayo. ".repeat(25).trim()), `${label}: full long response remains in the document`);
    await inspectAccessibility(t, "live-provenance");
    answer = () => ({ status: 503, payload: { error: "synthetic_unavailable" } });
    await send(t, "Pregunta para recuperar");
    await t.page.getByRole("alert").waitFor();
    check(await t.page.getByRole("textbox").inputValue() === "Pregunta para recuperar", `${label}: denial preserves the question`);
    check(t.calls.length === 2, `${label}: denial is not retried automatically`);
    check(t.calls[1].body.eventId === "715" && t.calls[1].body.history.length === 2 && t.calls[1].body.history[0].content === "Pregunta sintética doble", `${label}: follow-up retains the reading and previous conversation`);
    check(t.calls[1].body.history.every(row => ["user", "assistant"].includes(row.role) && row.content.length <= 1000) && new TextEncoder().encode(JSON.stringify(t.calls[1].body.history)).length <= 6000, `${label}: follow-up history remains within the API caps`);
    answer = () => reply("Recuperación sintética confirmada");
    await t.page.getByRole("button", { name: "Enviar pregunta", exact: true }).click();
    await t.page.getByRole("log").getByText("Recuperación sintética confirmada", { exact: false }).waitFor();
    check(t.calls.length === 3 && await t.page.getByRole("alert").count() === 0, `${label}: explicit retry recovers`);
    const log = t.page.getByRole("log");
    let releaseOlder;
    answer = () => new Promise(resolve => { releaseOlder = resolve; });
    await send(t, "Pregunta con historial desplazado");
    await waitCalls(t, 4);
    await log.locator(":scope > div").first().scrollIntoViewIfNeeded();
    const readingPosition = await t.page.evaluate(() => ({ pageY: scrollY, anchorCalls: window.__answerAnchorScrolls.length }));
    releaseOlder(reply("Respuesta sintética sin desplazar la lectura"));
    await log.getByText("Respuesta sintética sin desplazar la lectura", { exact: false }).waitFor();
    check(await t.page.evaluate(before => Math.abs(scrollY - before.pageY) < 2 && window.__answerAnchorScrolls.length === before.anchorCalls, readingPosition), `${label}: new answer respects the page position while reading older messages`);
    answer = () => reply("Respuesta sintética siguiendo el final");
    await send(t, "Pregunta cerca del final");
    await log.getByText("Respuesta sintética siguiendo el final", { exact: false }).waitFor();
    await viewLatestAnswer(t, label, "Respuesta sintética siguiendo el final");
    await inspectNaturalConversation(t, "manual-latest-answer");
    answer = () => reply("Orientación general del servicio sintético", true);
    const beforeFallback = t.calls.length;
    await send(t, "Pregunta con fallback del servicio");
    await log.getByText("Orientación general del servicio sintético", { exact: false }).waitFor();
    check(t.calls.length === beforeFallback + 1 && t.calls.at(-1).body.eventId === "715", `${label}: server fallback keeps one scoped request`);
    check(await t.page.getByRole("textbox").inputValue() === "Pregunta con fallback del servicio", `${label}: server fallback preserves the unconfirmed question`);
    await log.locator("summary").last().click();
    check((await log.locator("details").last().innerText()).includes("Fallback del servidor") && !(await log.locator("details").last().innerText()).includes("fixture-provider"), `${label}: fallback has no LIVE provider badge`);
    answer = () => ({ status: 403, payload: { ok: false, reason: "sommelier_event_not_authorized", detail: "synthetic-private-diagnostic" } });
    const beforeDenial = t.calls.length;
    await send(t, "Pregunta con lectura no autorizada");
    await t.page.getByRole("alert").filter({ hasText: "No pudimos habilitar el asistente para esta lectura." }).waitFor();
    check(t.calls.length === beforeDenial + 1 && t.calls.at(-1).body.eventId === "715" && t.calls.at(-1).body.mode === "consumer", `${label}: denied reading cannot retry as demo or without its event`);
    check(await t.page.getByRole("textbox").inputValue() === "Pregunta con lectura no autorizada", `${label}: 403 preserves the question`);
    await log.locator("summary").last().click();
    check((await log.locator("details").last().innerText()).includes("Fallback local"), `${label}: denied reading clearly shows local guidance`);
    check(!(await t.page.locator("main").innerText()).includes("synthetic-private-diagnostic") && !(await t.page.getByRole("alert").innerText()).includes("No pudimos confirmar tu sesión"), `${label}: event denial neither exposes diagnostics nor infers missing login`);
    check(await t.page.getByRole("link", { name: "Ver las opciones de mi cuenta", exact: true }).getAttribute("href") === "/me/products", `${label}: recovery uses the normal account route`);
    check(await log.locator(":scope > div").count() === 15, `${label}: welcome and all seven question/answer pairs remain in the document`);
    await inspectNaturalConversation(t, "denied-local-recovery");
    await inspectAccessibility(t, "denied-local-recovery");
    check(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
    await t.page.screenshot({ path: join(output, `chat-${width}-${theme}.png`), fullPage: true });
    report.views.push({ width, theme, syntheticRequests: t.calls.length });
    await t.close();
  }
  const syntheticSheetUrl = "https://brand.example.invalid/technical-sheet.pdf";
  const serverSuggestion = "¿Qué información publicó la marca?";
  const suggestions = [serverSuggestion, "", "x".repeat(201), "¿Cómo consulto la ficha publicada?", "¿Dónde reviso los datos del producto?", "Cuarta sugerencia que supera el máximo"];
  const sourceOptions = {
    sources: [
      { id: "sheet", label: "Ficha sintética HTTPS", url: syntheticSheetUrl },
      { id: "product", label: "Dato publicado sintético", url: null },
      { id: "script", label: "SOURCE SCRIPT REJECTED", url: "javascript:alert(1)" },
      { id: "credential", label: "SOURCE CREDENTIAL REJECTED", url: "https://user:pass@brand.example.invalid/private" },
      { id: "http", label: "SOURCE HTTP REJECTED", url: "http://brand.example.invalid/sheet.pdf" },
      { id: "port", label: "SOURCE PORT REJECTED", url: "https://brand.example.invalid:8443/sheet.pdf" },
    ], suggestedQuestions: suggestions,
  };
  for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let answer = () => reply("Respuesta con fuentes y sugerencias sintéticas", false, sourceOptions);
    const t = await open({ width, theme, answer: () => answer() });
    const label = `suggestions/${width}/${theme}`;
    const log = t.page.getByRole("log");
    check(t.calls.length === 0, `${label}: sources and suggestions do not query on mount`);
    await send(t, "Pregunta inicial con fuente sintética");
    await log.getByText("Respuesta con fuentes y sugerencias sintéticas", { exact: false }).waitFor();
    const sourceLink = log.getByRole("link", { name: "Ficha sintética HTTPS ↗", exact: true });
    check(await sourceLink.getAttribute("href") === syntheticSheetUrl && await sourceLink.getAttribute("target") === "_blank", `${label}: validated HTTPS source is linked without navigation`);
    check(await sourceLink.getAttribute("rel") === "noopener noreferrer" && await sourceLink.getAttribute("referrerpolicy") === "no-referrer", `${label}: source link protects opener and referrer`);
    check(await log.getByRole("link").count() === 1 && await log.getByText("Dato publicado sintético", { exact: true }).count() === 1, `${label}: only validated source link and null-URL source label render`);
    check(!(await log.innerText()).includes("REJECTED") && !((await log.innerText()).includes("user:pass")), `${label}: unsafe source diagnostics are never rendered`);
    const followUps = t.page.getByTestId("sun-sommelier-follow-ups").getByRole("button");
    check(await followUps.count() === 3 && await followUps.first().innerText() === serverSuggestion, `${label}: nonempty bounded server suggestions render`);
    check(await followUps.evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44)), `${label}: server suggestions keep touch targets`);
    check(t.calls.length === 1, `${label}: rendering suggestions makes no automatic request`);
    await log.locator("summary").last().click();
    await inspectNaturalConversation(t, "validated-source-and-suggestions");
    await inspectAccessibility(t, "validated-source-and-suggestions");
    await followUps.first().focus();
    await t.page.keyboard.press("Tab");
    check(await followUps.nth(1).evaluate(button => button === document.activeElement), `${label}: suggestions have normal keyboard focus order`);
    await followUps.first().focus();
    answer = () => pending;
    await t.page.keyboard.press("Enter");
    await waitCalls(t, 2);
    check(t.calls[1].body.question === serverSuggestion && t.calls[1].body.eventId === "715" && t.calls[1].body.mode === "consumer" && t.calls[1].body.locale === "es-AR", `${label}: manual keyboard suggestion keeps question/event/mode/locale`);
    check(t.calls[1].body.history.length === 2 && t.calls[1].body.history[0].content === "Pregunta inicial con fuente sintética" && t.calls[1].body.history[1].content === "Respuesta con fuentes y sugerencias sintéticas", `${label}: suggestion uses conversation history, not source facts`);
    check(JSON.stringify(Object.keys(t.calls[1].body).sort()) === JSON.stringify(["eventId", "history", "locale", "mode", "question"]) && !JSON.stringify(t.calls[1].body).includes(syntheticSheetUrl), `${label}: source/tenant facts cannot enter the authoritative request body`);
    check(await followUps.evaluateAll(buttons => buttons.every(button => button.disabled)) && await log.getAttribute("aria-busy") === "true", `${label}: pending suggestion locks controls`);
    release(reply("Respuesta confirmada de seguimiento sintético", false, { suggestedQuestions: ["Seguimiento sintético nuevo"] }));
    await log.getByText("Respuesta confirmada de seguimiento sintético", { exact: false }).waitFor();
    check(t.calls.length === 2 && await log.getAttribute("aria-busy") === "false", `${label}: one explicit suggestion makes exactly one request`);
    check(await t.page.getByTestId("sun-sommelier-follow-ups").getByRole("button").count() === 1 && await t.page.getByTestId("sun-sommelier-follow-ups").getByRole("button").innerText() === "Seguimiento sintético nuevo", `${label}: newest response owns suggestions`);
    check(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: source and suggestions have no horizontal overflow`);
    await t.page.screenshot({ path: join(output, `source-suggestions-${width}-${theme}.png`), fullPage: true });
    report.views.push({ width, theme, phase: "source-and-suggestions", syntheticRequests: t.calls.length });
    await t.close();
  }
  for (const theme of ["light", "dark"]) {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let answer = () => pending;
    const t = await open({ width: 390, theme, answer: () => answer() });
    const label = `deadline/390/${theme}`, question = "Pregunta con plazo agotado sintético";
    try {
      await send(t, question);
      await waitCalls(t, 1);
      const log = t.page.getByRole("log");
      check(await log.getAttribute("aria-busy") === "true", `${label}: pending request is announced`);
      await t.page.getByRole("alert").filter({ hasText: "No recibimos una respuesta del asistente." }).waitFor({ timeout: 17_000 });
      check(await t.page.getByRole("textbox").inputValue() === question && await t.page.getByRole("button", { name: "Enviar pregunta", exact: true }).isEnabled(), `${label}: configured 12s deadline preserves question and releases send lock`);
      check(await log.getAttribute("aria-busy") === "false" && await t.page.evaluate(() => window.__aborts) >= 1, `${label}: configured deadline aborts the outstanding fetch and ends busy state`);
      check(t.calls.length === 1 && t.calls[0].body.eventId === "715" && t.calls[0].body.mode === "consumer", `${label}: timeout makes no automatic retry or eventless/demo downgrade`);
      await log.locator("summary").last().click();
      check((await log.locator("details").last().innerText()).includes("Fallback local") && !(await log.innerText()).includes("fixture-provider"), `${label}: timeout shows local provenance without LIVE badge`);
      await inspectAccessibility(t, "deadline-local-recovery");
      release(reply("Respuesta tardía tras deadline que no debe aparecer"));
      await t.page.waitForTimeout(50);
      check(await log.getByText("Respuesta tardía tras deadline que no debe aparecer", { exact: false }).count() === 0 && t.calls.length === 1, `${label}: late answer cannot commit or trigger a retry`);
      answer = () => reply("Respuesta recuperada tras retry manual sintético");
      await t.page.getByRole("button", { name: "Enviar pregunta", exact: true }).click();
      await log.getByText("Respuesta recuperada tras retry manual sintético", { exact: false }).waitFor();
      check(t.calls.length === 2 && t.calls[1].body.question === question && t.calls[1].body.eventId === "715" && t.calls[1].body.mode === "consumer", `${label}: explicit recovery sends exactly one scoped request after timeout`);
      check(await t.page.getByRole("alert").count() === 0 && await t.page.getByRole("textbox").inputValue() === "", `${label}: successful manual recovery clears the error and draft`);
      report.deadlineCases.push({ width: 390, theme, configuredDeadlineMs: 12_000, shortenedClock: false, syntheticRequests: t.calls.length, timeoutThenExplicitRetry: true });
      await t.page.screenshot({ path: join(output, `deadline-recovery-${theme}.png`), fullPage: true });
    } finally {
      release(reply("Released synthetic transport for teardown"));
      await t.close();
    }
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
    check(t.calls.filter(c => c.path === "/api/sommelier/chat").length === 1, `${change}: cancellation makes no extra request`);
    check(await t.page.evaluate(() => window.__aborts) >= 1, `${change}: outstanding request aborted`);
    await t.close();
  }
  for (const change of ["product-change", "locale-change", "permission-change", "close-chat"]) {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let answer = () => reply("Respuesta para sugerencia pendiente sintética", false, { suggestedQuestions: [serverSuggestion] });
    const t = await open({ answer: () => answer() });
    const label = `manual-suggestion/${change}`;
    try {
      await send(t, "Pregunta previa para sugerencia sintética");
      await t.page.getByRole("log").getByText("Respuesta para sugerencia pendiente sintética", { exact: false }).waitFor();
      check(t.calls.filter(call => call.path === "/api/sommelier/chat").length === 1, `${label}: suggestion rendering does not send itself`);
      answer = () => pending;
      await t.page.getByTestId("sun-sommelier-follow-ups").getByRole("button", { name: serverSuggestion, exact: true }).click();
      await waitCalls(t, 2);
      const sent = t.calls.filter(call => call.path === "/api/sommelier/chat")[1].body;
      check(sent.question === serverSuggestion && sent.eventId === "715" && sent.mode === "consumer" && sent.locale === "es-AR" && sent.history.length === 2, `${label}: explicit suggestion keeps original scope and conversation`);
      await t.page.getByTestId(change).click();
      await t.page.waitForFunction(() => window.__aborts > 0);
      if (change === "product-change") await t.page.getByTestId("product").getByText("Vino QB", { exact: true }).waitFor();
      if (change === "locale-change") await t.page.getByRole("log", { name: "Wine conversation" }).waitFor();
      if (change === "permission-change") await t.page.getByTestId("sun-actions-unavailable").waitFor();
      if (change === "close-chat") await t.page.getByTestId("closed").waitFor();
      release(reply("Sugerencia tardía que no debe cruzar scope"));
      await t.page.waitForTimeout(50);
      check(await t.page.getByText("Sugerencia tardía que no debe cruzar scope", { exact: false }).count() === 0, `${label}: late suggestion answer cannot enter changed scope`);
      check(t.calls.filter(call => call.path === "/api/sommelier/chat").length === 2, `${label}: changed scope makes no automatic new assistant query`);
    } finally {
      release(reply("Released synthetic suggestion for teardown"));
      await t.close();
    }
  }
  // Compatibility coverage only: production layout does not emit this explicit dark class.
  {
    const t = await open({ width: 390, theme: "dark", themeClasses: "explicit-dark-class" });
    check(t.calls.length === 0, "explicit-dark-class: no mount question");
    await send(t, "Pregunta del modo oscuro explícito sintético");
    await t.page.getByRole("log").getByText("Guía sintética", { exact: false }).waitFor();
    await inspectAccessibility(t, "explicit-dark-class-compatibility");
    check(t.calls.length === 1 && t.calls[0].body.eventId === "715", "explicit-dark-class: same bound consumer contract");
    report.views.push({ width: 390, theme: "dark", themeClasses: "explicit-dark-class", canonicalLayout: false, syntheticRequests: t.calls.length });
    await t.close();
  }
  for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const locale of ["es-AR", "en", "pt-BR"]) {
    const t = await open({ width, theme, locale, eventless: true });
    const label = `eventless/${width}/${theme}/${locale}`;
    check(t.calls.length === 0, `${label}: opening sends no question`);
    await send(t, "Pregunta local sintética");
    const localNotice = { "es-AR": "Esta es una guía local", en: "This is a local guide", "pt-BR": "Este é um guia local" }[locale];
    await t.page.getByRole("log").getByText(localNotice, { exact: false }).waitFor();
    check(t.calls.length === 0, `${label}: missing event makes zero HTTP requests and no unrestricted consumer or demo call`);
    check(await t.page.getByRole("textbox").inputValue() === "" && await t.page.getByRole("alert").count() === 0, `${label}: successful local guidance clears the draft without claiming a failed remote send`);
    await t.page.getByRole("log").locator("summary").last().click();
    const localOrigin = { "es-AR": "Fallback local", en: "Local guide", "pt-BR": "Guia local" }[locale];
    check((await t.page.getByRole("log").locator("details").last().innerText()).includes(localOrigin), `${label}: local provenance follows the selected language`);
    const latestLabel = { "es-AR": "Ver última respuesta", en: "View latest answer", "pt-BR": "Ver a última resposta" }[locale];
    check(await t.page.getByRole("link", { name: latestLabel, exact: true }).count() === 1, `${label}: latest-answer action follows the selected language`);
    await viewLatestAnswer(t, label, localNotice);
    await inspectNaturalConversation(t, "eventless-local-guidance");
    await inspectAccessibility(t, "eventless-local-guidance");
    check(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
    report.views.push({ width, theme, locale, eventless: true, syntheticRequests: t.calls.length });
    await t.close();
  }
  {
    const t = await open({ reducedMotion: "no-preference", answer: () => reply("Respuesta sintética con navegación manual suave") });
    await send(t, "Pregunta para navegación manual suave");
    await t.page.getByRole("log").getByText("Respuesta sintética con navegación manual suave", { exact: false }).waitFor();
    await viewLatestAnswer(t, "motion/no-preference", "Respuesta sintética con navegación manual suave");
    await inspectNaturalConversation(t, "motion/no-preference");
    check(t.calls.length === 1, "motion/no-preference: navigating the answer makes no extra request");
    await t.close();
  }
  for (const locale of ["es-AR", "en", "pt-BR"]) for (const theme of ["light", "dark"]) for (const failure of ["fallback", "unavailable"]) {
    let answer = failure === "fallback" ? () => reply("Orientación sintética sin IA confirmada", true, { demo: true }) : () => ({ status: 503, payload: { ok: false } });
    const t = await open({ width: 390, theme, locale, valleDemo: true, answer: request => answer(request) });
    const label = `valle/${theme}/${locale}/${failure}`;
    const question = "Pregunta Valle sintética para recuperar";
    check(t.calls.length === 0, `${label}: mounting does not create a session or ask a question`);
    await t.page.getByRole("textbox").fill(question);
    await t.page.getByRole("textbox").locator("..").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    const expectedAlert = {
      "es-AR": { fallback: "El servicio devolvió orientación general, sin una respuesta de IA confirmada. Podés volver a enviar la pregunta.", unavailable: "No recibimos una respuesta del asistente. Podés volver a enviar la pregunta; mientras tanto, mostramos una guía local." },
      en: { fallback: "The service returned general guidance without a confirmed AI response. You can send the question again.", unavailable: "No assistant response was received. You can send the question again; meanwhile, we show a local guide." },
      "pt-BR": { fallback: "O serviço retornou orientação geral, sem uma resposta de IA confirmada. Você pode enviar a pergunta novamente.", unavailable: "Nenhuma resposta do assistente foi recebida. Você pode enviar a pergunta novamente; enquanto isso, mostramos um guia local." },
    }[locale][failure];
    await t.page.getByRole("alert").filter({ hasText: expectedAlert }).waitFor();
    check(await t.page.getByRole("textbox").inputValue() === question, `${label}: an unconfirmed managed response preserves the question`);
    check(await t.page.getByRole("alert").innerText() === expectedAlert, `${label}: accessible recovery states the unconfirmed response without inferring account ownership`);
    const chats = t.calls.filter(call => call.path === "/api/sommelier/chat"), sessions = t.calls.filter(call => call.path === "/api/sommelier/demo/session");
    check(chats.length === 1 && sessions.length === 1 && t.calls.length === 2, `${label}: synchronous double-submit makes one existing session request and one chat request`);
    check(sessions[0].body.profile === "valle-secreto" && sessions[0].body.locale === locale && chats[0].body.mode === "demo" && chats[0].body.locale === locale && chats[0].body.question === question && !Object.hasOwn(chats[0].body, "eventId"), `${label}: the existing Valle demo contract and locale are preserved`);
    check(await t.page.getByRole("log").getByText(question, { exact: true }).count() === 1, `${label}: the first explicit question is not duplicated in conversation`);
    await t.page.getByRole("log").locator("summary").last().click();
    const localOrigin = { "es-AR": "Fallback local", en: "Local guide", "pt-BR": "Guia local" }[locale];
    check((await t.page.getByRole("log").locator("details").last().innerText()).includes(localOrigin) && !(await t.page.getByRole("log").innerText()).includes("fixture-provider"), `${label}: the displayed sample remains local guidance rather than confirmed AI`);
    await inspectNaturalConversation(t, `${label}-recovery`);
    await inspectAccessibility(t, `${label}-recovery`);
    await t.page.waitForTimeout(80);
    check(t.calls.length === 2, `${label}: showing recovery does not retry automatically`);
    answer = () => reply("Respuesta Valle sintética tras reintento explícito", false, { demo: true });
    await t.page.getByRole("textbox").locator("..").getByRole("button", { exact: true }).click();
    await t.page.getByRole("log").getByText("Respuesta Valle sintética tras reintento explícito", { exact: false }).waitFor();
    const retryChats = t.calls.filter(call => call.path === "/api/sommelier/chat"), retrySessions = t.calls.filter(call => call.path === "/api/sommelier/demo/session");
    check(retryChats.length === 2 && retrySessions.length === 2 && t.calls.length === 4 && retryChats[1].body.question === question, `${label}: only explicit retry sends one additional existing session and one chat`);
    check(await t.page.getByRole("alert").count() === 0 && await t.page.getByRole("textbox").inputValue() === "", `${label}: a confirmed synthetic recovery clears the draft and alert`);
    let releasePending;
    const pendingNewDraft = new Promise(resolve => { releasePending = resolve; });
    answer = () => pendingNewDraft;
    const submittedPendingQuestion = "Pregunta Valle enviada antes del borrador nuevo";
    const newerDraft = "Borrador Valle diferente escrito mientras llega la respuesta";
    await t.page.getByRole("textbox").fill(submittedPendingQuestion);
    await t.page.getByRole("textbox").locator("..").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await waitCalls(t, 3);
    check(await t.page.getByRole("log").getAttribute("aria-busy") === "true" && await t.page.getByRole("textbox").inputValue() === "", `${label}: the third explicit question is pending before a new draft is typed`);
    await t.page.getByRole("textbox").fill(newerDraft);
    releasePending(failure === "fallback" ? reply("Orientación sintética pendiente sin IA confirmada", true, { demo: true }) : { status: 503, payload: { ok: false } });
    await t.page.getByRole("alert").filter({ hasText: expectedAlert }).waitFor();
    check(await t.page.getByRole("textbox").inputValue() === newerDraft && await t.page.getByRole("alert").innerText() === expectedAlert, `${label}: failed pending response preserves the newer different draft and localized alert`);
    const pendingChats = t.calls.filter(call => call.path === "/api/sommelier/chat"), pendingSessions = t.calls.filter(call => call.path === "/api/sommelier/demo/session");
    check(t.calls.length === 6 && pendingChats.length === 3 && pendingSessions.length === 3 && pendingChats[2].body.question === submittedPendingQuestion, `${label}: recovery has only the three explicit session/chat pairs observed so far`);
    check(await t.page.getByRole("log").getByText(submittedPendingQuestion, { exact: true }).count() === 1 && await t.page.getByRole("log").getByText(newerDraft, { exact: true }).count() === 0, `${label}: the unsent newer draft is not inserted into conversation`);
    await inspectNaturalConversation(t, `${label}-newer-draft-recovery`);
    await inspectAccessibility(t, `${label}-newer-draft-recovery`);
    answer = () => reply("Respuesta Valle confirmada para el borrador nuevo", false, { demo: true });
    await t.page.getByRole("textbox").locator("..").getByRole("button", { exact: true }).click();
    await t.page.getByRole("log").getByText("Respuesta Valle confirmada para el borrador nuevo", { exact: false }).waitFor();
    const newerChats = t.calls.filter(call => call.path === "/api/sommelier/chat"), newerSessions = t.calls.filter(call => call.path === "/api/sommelier/demo/session");
    check(t.calls.length === 8 && newerChats.length === 4 && newerSessions.length === 4 && newerChats[3].body.question === newerDraft && newerChats[3].body.mode === "demo" && newerChats[3].body.locale === locale && !Object.hasOwn(newerChats[3].body, "eventId"), `${label}: one explicit action submits the newer draft with the same existing Valle contract`);
    check(await t.page.getByRole("alert").count() === 0 && await t.page.getByRole("textbox").inputValue() === "", `${label}: confirmed newer-draft submission clears its input and alert`);
    report.views.push({ width: 390, theme, locale, valleDemo: true, recovery: failure, newerDraftWhilePending: true, syntheticRequests: t.calls.length });
    await t.close();
  }
  for (const locale of ["en", "pt-BR"]) {
    const t = await open({ width: 390, theme: "dark", locale: "es-AR", tooltips: true, nextLocale: locale });
    const label = `tooltip-switch/${locale}`;
    await t.page.getByTestId("locale-change").click();
    const expected = locale === "en" ? {
      sommelier: "Ask about pairings, tasting, temperature and recommendations", feedback: "Share a short opinion about the product or experience", contact: "Allow contact about updates published by the brand", feedbackLabel: "Rate", contactLabel: "Updates", name: "Name for receiving brand updates", channel: "Contact for receiving authorized updates", occasion: "Purchase or consumption context", gender: "Optional information for aggregated segmentation", submit: "Register contact for brand updates",
    } : {
      sommelier: "Consultar harmonizações, degustação, temperatura e recomendações", feedback: "Enviar uma opinião breve sobre o produto ou a experiência", contact: "Autorizar contato sobre novidades publicadas pela marca", feedbackLabel: "Avaliar", contactLabel: "Novidades", name: "Nome para receber novidades da marca", channel: "Contato para receber novidades autorizadas", occasion: "Contexto de compra ou consumo", gender: "Informação opcional para segmentação agregada", submit: "Registrar contato para novidades da marca",
    };
    await t.page.getByTitle(expected.sommelier, { exact: true }).waitFor();
    check(await t.page.getByRole("button", { name: expected.feedbackLabel, exact: true }).getAttribute("title") === expected.feedback && await t.page.getByRole("button", { name: expected.contactLabel, exact: true }).getAttribute("title") === expected.contact, `${label}: inherited tab labels and localized titles follow the locale switch`);
    await t.page.getByRole("button", { name: expected.contactLabel, exact: true }).click();
    for (const key of ["name", "channel", "occasion", "gender", "submit"]) check(await t.page.getByTitle(expected[key], { exact: true }).count() === 1, `${label}: existing ${key} control has its translated tooltip`);
    check(t.calls.length === 1 && t.calls[0].path === "/api/sun/locale" && t.calls[0].body.locale === locale, `${label}: inspecting tooltip controls makes only the explicit existing locale request, no chat or business submission`);
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
