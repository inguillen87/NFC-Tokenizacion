// Actual SUN chat in a loopback fixture. Every API response is synthetic and intercepted.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { build, stop } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const web = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.env.QA_OUTPUT || "artifacts/sun-post-tap-sommelier");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
// Same external AXE source input as the existing sun-managed-sommelier browser suite.
// Missing AXE is a failed prerequisite, never a reason to skip accessibility or contrast.
const axeSource = await readFile(process.env.AXE_MODULE_PATH, "utf8");
const paths = ["src/lib/use-sommelier-recovery.ts", "src/app/sun/syngenta-product-assistant.tsx", "src/app/sun/syngenta-product-assistant.module.css", "src/app/me/sommelier/sommelier-client.tsx", "src/app/me/sommelier/portal-managed-sommelier.ts", "src/app/me/sommelier/sommelier.module.css", "src/app/me/_components/portal-shell.module.css", "tests/sun-post-tap-sommelier.browser.mjs", "src/app/sun/qr-engagement-suite.tsx", "src/app/sun/qr-engagement-suite.module.css", "src/lib/managed-sommelier.ts", "src/lib/sommelier-guidance.ts", "src/lib/sommelier-conversation.ts", "src/app/sun/sun-demo-sommelier.ts", "src/app/sun/valle-secreto-demo.ts", "src/app/sun/sun-locale-provider.tsx", "src/app/globals.css", "src/app/layout.tsx", "../../packages/ui/src/theme-toggle.tsx"];
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(join(web, path))).digest("hex")])));
const sourceHashes = await hashes();
const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SunLocaleProvider,useSunLocale}from'./src/app/sun/sun-locale-provider';import{QREngagementSuite}from'./src/app/sun/qr-engagement-suite';import{VALLE_SECRETO_DEMO}from'./src/app/sun/valle-secreto-demo';import{SyngentaProductAssistant}from'./src/app/sun/syngenta-product-assistant';import SommelierClient from'./src/app/me/sommelier/sommelier-client';import portalShell from'./src/app/me/_components/portal-shell.module.css';
const params=new URLSearchParams(location.search),initialLocale=['es-AR','en','pt-BR'].includes(params.get('locale'))?params.get('locale'):'es-AR';const recoverySurface=params.get('recoverySurface')||'sun';function App(){const[product,setProduct]=useState('Vino QA'),[eventId,setEventId]=useState(params.has('eventless')?null:'715'),[visible,setVisible]=useState(true),[enabled,setEnabled]=useState(true),[tenant,setTenant]=useState('qa-synthetic');const{locale,setLocale}=useSunLocale();const configuration={version:'nexid.tenant-actions.v1',status:'published',allowedActions:enabled?['sommelier']:[],catalogAvailable:false,program:null,trivia:null};window.__qaPendingDraftTenantOnly=()=>setTenant('qa-other');return <main className='sun-tap-experience' style={{maxWidth:recoverySurface==='portal'?1200:430,margin:'0 auto',padding:12}}><h1>SUN · ensayo sintético</h1><p data-testid='product' data-tenant={tenant}>{product}</p><button data-testid='tenant-change' onClick={()=>{setTenant('qa-other');setProduct('Vino QB');setEventId('716')}}>Cambiar marca</button><button data-testid='tenant-return' onClick={()=>{setTenant('qa-synthetic');setProduct('Vino QA');setEventId('715')}}>Volver a la marca</button><button data-testid='product-change' onClick={()=>{setProduct('Vino QB');setEventId('716')}}>Cambiar producto</button><button data-testid='label-change' onClick={()=>setProduct('Vino QA etiqueta actualizada')}>Cambiar sólo etiqueta</button><button data-testid='locale-change' onClick={()=>void setLocale('en')}>Cambiar idioma</button><button data-testid='permission-change' onClick={()=>setEnabled(false)}>Quitar permiso</button><button data-testid='close-chat' onClick={()=>setVisible(false)}>Cerrar chat</button>{visible?(recoverySurface==='syngenta'?<SyngentaProductAssistant locale={locale}/>:recoverySurface==='portal'?<section className={portalShell.portal}><SommelierClient productName={product} brandName='Marca QA'/></section>:<QREngagementSuite productName={product} wineryName='Marca QA' tenantSlug={tenant} eventId={eventId} configuration={configuration} isDemoPreview={params.has('valleDemo')} demoWineProfile={params.has('valleDemo')?VALLE_SECRETO_DEMO:null} initialTab='sommelier'/>):<p data-testid='closed'>Chat cerrado</p>}</main>};createRoot(document.getElementById('app')).render(<SunLocaleProvider initialLocale={initialLocale}><App/></SunLocaleProvider>);`;
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
const report = { localOnly: true, syntheticResponses: true, actualApplicationChatAndCss: true, actualNextServer: false, realTenantSessionAcceptance: false, publicAcceptance: false, realProviderRequests: 0, realBusinessWrites: 0, geolocationCalls: 0, unexpectedRequests: [], errors: [], checks: [], views: [], accessibility: [], recoveryAccessibility: [], conversationGeometry: [], pageAnchors: [], deadlineCases: [], sourceHashes, axeSourceSha256: createHash("sha256").update(axeSource).digest("hex"), configuredManagedDeadlineMs: 12_000, fixtureThemePolicy: "canonical layout lightclass/data-theme; explicit-dark-class separately labelled" };
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
const reply = (text, fallback = false, options = {}) => ({ status: 200, payload: { ok: true, answer: text, source: fallback ? "fallback" : "live", fallback, demo: options.demo ?? false, ...(!fallback ? { provider: "fixture-provider", model: "fixture-model" } : {}), sources: options.sources ?? [{ id: "product", label: "Dato publicado sintético", url: null }], suggestedQuestions: options.suggestedQuestions ?? [] } });
async function open({ width = 390, theme = "dark", themeClasses = "layout", locale = "es-AR", eventless = false, valleDemo = false, surface = "sun", controlledClock = false, reducedMotion = "reduce", answer = () => reply("Guía sintética") } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion, serviceWorkers: "block" });
  const page = await context.newPage(), calls = [];
  if (controlledClock) await page.clock.install({ time: new Date("2026-10-28T12:00:00.000Z") });
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
      if (!["/api/sommelier/chat", "/api/sun/locale", ...((valleDemo || surface === "syngenta") ? ["/api/sommelier/demo/session"] : [])].includes(url.pathname) || request.method() !== "POST") { report.unexpectedRequests.push({ path: url.pathname, method: request.method() }); return route.abort(); }
      calls.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
      const result = url.pathname === "/api/sun/locale" ? { status: 200, payload: { ok: true } } : url.pathname === "/api/sommelier/demo/session" ? { status: 200, payload: { ok: true, profile: surface === "syngenta" ? "syngenta" : "valle-secreto" } } : await answer(request);
      return route.fulfill({ status: result.status, headers: result.headers || {}, contentType: "application/json", body: JSON.stringify(result.payload) }).catch(() => {});
    }
    return route.continue();
  });
  const fixtureUrl = new URL(origin);
  fixtureUrl.searchParams.set("locale", locale);
  fixtureUrl.searchParams.set("recoverySurface", surface);
  fixtureUrl.searchParams.set("theme", theme);
  fixtureUrl.searchParams.set("themeClasses", themeClasses);
  if (eventless) fixtureUrl.searchParams.set("eventless", "1");
  if (valleDemo) fixtureUrl.searchParams.set("valleDemo", "1");
  await page.goto(fixtureUrl.href, { waitUntil: "networkidle" });
  await (surface === "syngenta" ? page.getByTestId("syngenta-product-assistant") : surface === "portal" ? page.getByTestId("sommelier-conversation") : page.getByRole("log")).waitFor();
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

// Same native loopback harness, four real UI surfaces, no Next build or provider.
const recoveryRoot = (t, surface) => surface === 'syngenta' ? t.page.getByTestId('syngenta-product-assistant')
  : surface === 'portal' ? t.page.getByTestId('sommelier-conversation') : t.page.locator('.sun-engagement-suite');
async function recoverySettled(t, surface) {
  await t.page.waitForFunction(surface => surface === 'syngenta'
    ? document.querySelector('[data-testid="syngenta-product-assistant"]')?.getAttribute('data-assistant-pending') === 'false'
    : surface === 'portal' ? document.querySelector('[data-testid="sommelier-conversation"] form')?.getAttribute('aria-busy') === 'false'
    : document.querySelector('[role="log"]')?.getAttribute('aria-busy') === 'false', surface);
}
const recoveryPayload = (surface, fallback, reason, retryAfter) => {
  const demo = surface === 'sun-demo' || surface === 'syngenta';
  const response = reply(fallback ? 'Synthetic official guidance without a confirmed AI answer' : 'Synthetic confirmed answer', fallback, {
    demo, sources: surface === 'syngenta' ? [{ id: 'product', label: 'Syngenta Argentina', url: 'https://www.syngenta.com.ar/product/crop-protection/fungicida/amistar-xtra' }] : [],
    suggestedQuestions: ['QA follow-up question'],
  });
  if (surface === 'syngenta') Object.assign(response.payload, { demoProfile: 'syngenta', contextSource: 'syngenta_demo' });
  if (surface === 'sun-demo') response.payload.contextSource = 'valle_secreto_demo';
  if (reason) response.payload.reason = reason;
  if (retryAfter !== undefined) response.payload.retryAfter = retryAfter;
  return response;
};
async function runRecoveryCases() {
  report.recoveryCases = []; report.recoveryFailures = [];
  const selected = process.env.QA_RECOVERY_SURFACE;
  if (selected && !["sun-demo", "sun-consumer", "syngenta", "portal", "scope"].includes(selected)) throw new Error("Unknown recovery surface selector");
  for (const surface of ['sun-demo', 'sun-consumer', 'syngenta', 'portal']) {
    if (selected && selected !== surface) continue;
    for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
      const locales = surface === 'portal' ? ['es-AR'] : ['es-AR', 'en', 'pt-BR'];
      for (const locale of locales) {
        const label = `recovery/${surface}/${width}/${theme}/${locale}`; let mode = 'live';
        const t = await open({ width, theme, locale, surface: ['syngenta', 'portal'].includes(surface) ? surface : 'sun',
          valleDemo: surface === 'sun-demo', controlledClock: true, answer: () => mode === 'http-wait'
            ? { status: 429, headers: { 'retry-after': '30' }, payload: { ok: false, reason: 'sommelier_rate_limited' } }
            : recoveryPayload(surface, mode === 'fallback-wait', mode === 'fallback-wait' ? 'sommelier_budget_exhausted' : undefined, mode === 'fallback-wait' ? 30 : undefined) });
        const root = recoveryRoot(t, surface), draft = root.getByRole('textbox'), form = root.locator('form'), submit = form.locator('button[type="submit"]');
        const chatCount = () => t.calls.filter(call => call.path === '/api/sommelier/chat').length;
        const attemptDuringWait = async phase => {
          const before = t.calls.length;
          await form.evaluate(element => element.requestSubmit());
          await draft.press('Enter');
          // requestSubmit exercises the synchronous form guard; DOM probes supplement native disabled checks.
          await submit.evaluate(button => { const wasDisabled = button.disabled; button.disabled = false; button.click(); button.disabled = wasDisabled; });
          const direct = surface === 'syngenta' ? root.getByTestId('syngenta-assistant-suggestion')
            : surface === 'portal' ? root.locator('[role="group"] button')
            : root.locator('[data-testid="sun-sommelier-prompts"] button,[data-testid="sun-sommelier-follow-ups"] button');
          if (surface === 'portal') {
            // Portal suggestions prepare a draft; keeping them usable must not send it.
            if (await direct.count()) { check(await direct.first().isEnabled(), `${label}/${phase}: prepare-only suggestion remains available`); await direct.first().click(); }
          } else {
            for (const button of await direct.all()) check(await button.isDisabled(), `${label}/${phase}: direct prompt or follow-up is disabled during the known wait`);
            await direct.evaluateAll(buttons => buttons.forEach(button => { const wasDisabled = button.disabled; button.disabled = false; button.click(); button.disabled = wasDisabled; }));
          }
          if (surface === 'syngenta' && phase === 'http-wait') {
            const retry = root.getByRole('button', { name: /Reintentar esta pregunta|Retry this question|Tentar esta pergunta novamente/ });
            check(await retry.count() === 1 && await retry.isDisabled(), `${label}: explicit retry is visible but disabled during the wait`);
            await retry.evaluate(button => { const wasDisabled = button.disabled; button.disabled = false; button.click(); button.disabled = wasDisabled; });
          }
          await t.page.evaluate(() => Promise.resolve());
          check(t.calls.length === before, `${label}/${phase}: submit, keyboard, direct handlers and suggestions produce zero requests during wait`);
        };
        try {
          check(t.calls.length === 0, `${label}: mounting makes zero API requests`);
          await draft.fill('QA initial confirmed conversation'); await form.evaluate(element => element.requestSubmit());
          await waitCalls(t, 1); await recoverySettled(t, surface);
          mode = 'fallback-wait'; const question = `QA preserved fallback question ${surface}`;
          await draft.fill(question); await form.evaluate(element => element.requestSubmit());
          await waitCalls(t, 2); await recoverySettled(t, surface);
          check(await draft.inputValue() === question, `${label}: a received fallback preserves the submitted question`);
          check(await draft.isEditable(), `${label}: a known wait keeps the draft editable`);
          check(await submit.isDisabled(), `${label}: a local API budget wait prevents immediate resend`);
          if (surface === 'portal') check(!(await root.getByRole('status').innerText()).includes('Respuesta recibida. Podés hacer otra consulta.'), `${label}: fallback is not announced as a confirmed success`);
          if (locale === 'es-AR') check(!((await root.innerText()).includes('Podés volver a enviar la pregunta.')), `${label}: known wait never invites an immediate resend`);
          await draft.fill('QA draft edited while the service is paused');
          await attemptDuringWait('fallback-wait');
          const beforeExpiry = t.calls.length;
          await t.page.clock.fastForward(10_000);
          check(t.calls.length === beforeExpiry, `${label}: elapsed time alone sends no request`);
          await t.page.clock.fastForward(21_000);
          await t.page.waitForFunction(() => [...document.querySelectorAll('form button[type="submit"]')].some(button => !button.disabled));
          check(t.calls.length === beforeExpiry && chatCount() === 2, `${label}: wait expiry enables a manual action without auto-send`);
          mode = 'live'; await form.evaluate(element => element.requestSubmit()); await waitCalls(t, 3); await recoverySettled(t, surface);
          check(await draft.inputValue() === '', `${label}: only the explicit confirmed retry clears its draft`);

          mode = 'http-wait'; const httpQuestion = `QA preserved HTTP wait question ${surface}`;
          await draft.fill(httpQuestion); await form.evaluate(element => element.requestSubmit()); await waitCalls(t, 4); await recoverySettled(t, surface);
          check(await draft.inputValue() === httpQuestion && await draft.isEditable() && await submit.isDisabled(), `${label}: HTTP429 header delay preserves the editable draft and gates sending`);
          await attemptDuringWait('http-wait');
          if (surface === 'syngenta') {
            await root.getByRole('button', { name: /Nueva conversación|New conversation|Nova conversa/ }).click();
            await draft.fill('QA deliberate new conversation during the same wait');
            check(await submit.isDisabled(), `${label}: resetting the conversation cannot reset the API wait`);
            const before = t.calls.length; await form.evaluate(element => element.requestSubmit());
            await t.page.evaluate(() => Promise.resolve()); check(t.calls.length === before, `${label}: reset also preserves the synchronous send guard`);
          }
          const before = t.calls.length; await t.page.clock.fastForward(31_000);
          check(t.calls.length === before && chatCount() === 4, `${label}: no automatic retry when the HTTP wait expires`);
          check(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: known-wait state fits the responsive viewport`);
          const selector = surface === 'portal' ? '[data-testid="sommelier-conversation"]' : surface === 'syngenta' ? '[data-testid="syngenta-product-assistant"]' : '.sun-engagement-suite';
          const a11y = await t.page.evaluate(async selector => (await axe.run(selector, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(value => ({
            id: value.id, impact: value.impact,
            nodes: value.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary ?? null })),
          })), selector);
          // Preserve scoped findings before the assertion can enter the case catch.
          report.recoveryAccessibility.push({ surface, width, theme, locale, selector, phase: 'http-wait-expired', violations: a11y });
          check(a11y.length === 0, `${label}: actual recovery component has zero scoped AXE violations`);
          report.recoveryCases.push({ surface, width, theme, locale, status: 'passed', chatRequests: chatCount(), synthetic: true });
        } catch (error) {
          report.recoveryFailures.push({ surface, width, theme, locale, error: String(error?.stack || error) });
        } finally { await t.close(); }
      }
    }
  }
  // A late fallback must not install a wait or restore an old answer after scope change/unmount.
  for (const surface of ['sun-demo', 'sun-consumer', 'syngenta', 'portal']) {
    if (selected && selected !== surface) continue;
    for (const change of ['context', 'unmount']) {
      let release, held = true; const waiting = new Promise(resolve => { release = resolve; });
      const t = await open({ width: 390, theme: 'dark', surface: ['syngenta', 'portal'].includes(surface) ? surface : 'sun', valleDemo: surface === 'sun-demo',
        answer: () => held ? waiting : recoveryPayload(surface, false) });
      try {
        const root = recoveryRoot(t, surface); await root.getByRole('textbox').fill('QA cancelled question'); await root.locator('form').evaluate(form => form.requestSubmit()); await waitCalls(t, 1);
        await t.page.getByTestId(change === 'unmount' ? 'close-chat' : surface === 'syngenta' ? 'locale-change' : 'product-change').click();
        held = false; release({ ...recoveryPayload(surface, true, 'sommelier_budget_exhausted', 60), payload: { ...recoveryPayload(surface, true, 'sommelier_budget_exhausted', 60).payload, answer: 'QA stale recovery must not reappear' } });
        if (change === 'unmount') {
          await t.page.getByTestId('closed').waitFor(); check(await recoveryRoot(t, surface).count() === 0, `${surface}: unmount cannot restore late recovery UI`);
        } else {
          if (surface === 'syngenta') await recoveryRoot(t, surface).getByRole('button', { name: /Nueva conversación|New conversation|Nova conversa/ }).click();
          check(!(await recoveryRoot(t, surface).innerText()).includes('QA stale recovery must not reappear'), `${surface}: context change discards a late fallback`);
          await recoveryRoot(t, surface).getByRole('textbox').fill('QA new scope manual question');
          await recoveryRoot(t, surface).locator('form').evaluate(form => form.requestSubmit()); await waitCalls(t, 2); await recoverySettled(t, surface);
          check(t.calls.filter(call => call.path === '/api/sommelier/chat').at(-1).body.question === 'QA new scope manual question', `${surface}: late old recovery did not install a new-scope wait`);
        }
      } catch (error) { report.recoveryFailures.push({ surface, phase: change, error: String(error?.stack || error) }); }
      finally { release(recoveryPayload(surface, false)); await t.close(); }
    }
  }

  // Four bounded scope checks on the same real native components and intercepted transport.
  if (!selected || selected === 'scope') {
    report.scopeCases = [];
    const assistantCalls = t => t.calls.filter(call => call.path !== '/api/sun/locale').length;
    let mode = 'wait';
    const t = await open({ width: 390, theme: 'dark', controlledClock: true,
      answer: () => recoveryPayload('sun-consumer', mode === 'wait', mode === 'wait' ? 'sommelier_budget_exhausted' : undefined, mode === 'wait' ? 30 : undefined) });
    try {
      const root = recoveryRoot(t, 'sun-consumer'), input = root.getByRole('textbox'), form = root.locator('form'), submit = form.locator('button[type="submit"]');
      await input.fill('QA tenant A request'); await form.evaluate(form => form.requestSubmit()); await waitCalls(t, 1); await recoverySettled(t, 'sun-consumer');
      check(await submit.isDisabled(), 'scope/A: API wait disables tenant A');
      for (const control of ['locale-change', 'product-change']) {
        await t.page.getByTestId(control).click(); await input.fill(`QA tenant A after ${control}`);
        check(await submit.isDisabled(), `scope/A: ${control} cannot erase the same-tenant pause`);
        const before = assistantCalls(t); await form.evaluate(form => form.requestSubmit()); await t.page.evaluate(() => Promise.resolve());
        check(assistantCalls(t) === before, `scope/A: ${control} preserves the synchronous guard`);
      }
      await t.page.getByTestId('tenant-change').click(); await input.fill('QA tenant B manual request');
      check(await submit.isEnabled(), 'scope/B: a legitimate different tenant does not inherit A pause');
      mode = 'live'; await form.evaluate(form => form.requestSubmit()); await waitCalls(t, 2); await recoverySettled(t, 'sun-consumer');
      check(t.calls.filter(call => call.path === '/api/sommelier/chat').at(-1).body.question === 'QA tenant B manual request', 'scope/B: only explicit B intent sends its own request');
      await t.page.getByTestId('tenant-return').click(); await input.fill('QA tenant A resumed draft');
      check(await submit.isDisabled(), 'scope/A-return: returning to A retains its active wait');
      const before = assistantCalls(t); await form.evaluate(form => form.requestSubmit()); await t.page.evaluate(() => Promise.resolve());
      check(assistantCalls(t) === before, 'scope/A-return: returning cannot send through a stale enabled handler');
      await t.page.clock.fastForward(31_000);
      await t.page.waitForFunction(() => document.querySelector('form button[type="submit"]')?.disabled === false);
      check(assistantCalls(t) === before, 'scope/A-return: expiry enables A without an automatic request');
      report.scopeCases.push({ name: 'tenant-A-wait-B-isolation-return-A', status: 'passed', synthetic: true });
    } catch (error) { report.recoveryFailures.push({ phase: 'tenant-A-B-return-A', error: String(error?.stack || error) }); }
    finally { await t.close(); }

    let stale = true;
    const late = await open({ width: 390, theme: 'light', controlledClock: true,
      answer: () => recoveryPayload('sun-consumer', stale, stale ? 'sommelier_budget_exhausted' : undefined, stale ? 60 : undefined) });
    try {
      // Retain the parsed synthetic body, so cancellation cannot merely abort a socket before a reply exists.
      await late.page.evaluate(() => {
        const transport = window.fetch.bind(window); window.__scopeHoldNextBody = true; window.__scopeBodyWaiting = 0;
        window.fetch = async (url, init) => {
          const response = await transport(url, init);
          if (String(url) === '/api/sommelier/chat' && window.__scopeHoldNextBody) {
            window.__scopeHoldNextBody = false; const parse = response.json.bind(response);
            response.json = async () => { const payload = await parse(); window.__scopeBodyWaiting++;
              await new Promise(resolve => { window.__scopeReleaseBody = resolve; }); window.__scopeBodyWaiting--; return payload; };
          }
          return response;
        };
      });
      const root = recoveryRoot(late, 'sun-consumer'), input = root.getByRole('textbox'), form = root.locator('form'), submit = form.locator('button[type="submit"]');
      await input.fill('QA old tenant A pending request'); await form.evaluate(form => form.requestSubmit());
      await late.page.waitForFunction(() => window.__scopeBodyWaiting === 1);
      await late.page.getByTestId('tenant-change').click(); await late.page.getByTestId('tenant-return').click();
      await late.page.evaluate(() => { if (!window.__scopeReleaseBody) throw Error('Missing owned held body'); window.__scopeReleaseBody(); window.__scopeReleaseBody = null; });
      await late.page.waitForFunction(() => window.__scopeBodyWaiting === 0);
      stale = false; await input.fill('QA new tenant A intent after A-B-A');
      check(await submit.isEnabled(), 'scope/A-B-A: old A body cannot install a wait in the new A owner');
      await form.evaluate(form => form.requestSubmit()); await waitCalls(late, 2); await recoverySettled(late, 'sun-consumer');
      check(late.calls.filter(call => call.path === '/api/sommelier/chat').at(-1).body.question === 'QA new tenant A intent after A-B-A', 'scope/A-B-A: only the new explicit request survives');
      const before = late.calls.length; await late.page.clock.fastForward(61_000);
      check(late.calls.length === before, 'scope/A-B-A: no late-body or expiry auto-send');
      report.scopeCases.push({ name: 'late-body-A-B-A-owner', status: 'passed', synthetic: true });
    } catch (error) { report.recoveryFailures.push({ phase: 'late-body-A-B-A', error: String(error?.stack || error) }); }
    finally { await late.page.evaluate(() => window.__scopeReleaseBody?.()).catch(() => {}); await late.close(); }

    for (const surface of ['portal', 'syngenta']) {
      const t = await open({ width: 390, theme: 'dark', surface, controlledClock: true,
        answer: () => recoveryPayload(surface, true, 'sommelier_rate_limited', 30) });
      try {
        const root = recoveryRoot(t, surface), input = root.getByRole('textbox'), form = root.locator('form'), submit = form.locator('button[type="submit"]');
        await input.fill(`QA ${surface} initial wait`); await form.evaluate(form => form.requestSubmit()); await waitCalls(t, 1); await recoverySettled(t, surface);
        if (surface === 'portal') await t.page.getByTestId('product-change').click();
        else {
          await t.page.getByTestId('locale-change').click();
          await root.getByRole('button', { name: /Nueva conversación|New conversation|Nova conversa/ }).click();
        }
        await input.fill(`QA ${surface} editable draft after cosmetic change`);
        check(await input.isEditable() && await submit.isDisabled(), `scope/${surface}: label/locale/reset cannot erase the same account or demo wait`);
        const before = assistantCalls(t); await form.evaluate(form => form.requestSubmit()); await t.page.evaluate(() => Promise.resolve());
        check(assistantCalls(t) === before, `scope/${surface}: cosmetic change retains the synchronous guard`);
        await t.page.clock.fastForward(31_000); check(assistantCalls(t) === before, `scope/${surface}: cosmetic recovery never sends automatically`);
        report.scopeCases.push({ name: `${surface}-cosmetic-scope`, status: 'passed', synthetic: true });
      } catch (error) { report.recoveryFailures.push({ surface, phase: 'cosmetic-scope', error: String(error?.stack || error) }); }
      finally { await t.close(); }
    }
    // Cosmetic changes keep the editable draft; a new event/tenant must not inherit it.
    for (const surface of ['sun-consumer', 'sun-demo']) {
      const t = await open({ width: 390, theme: surface === 'sun-consumer' ? 'light' : 'dark', controlledClock: true,
        valleDemo: surface === 'sun-demo', answer: () => recoveryPayload(surface, true, 'sommelier_rate_limited', 60) });
      try {
        const root = recoveryRoot(t, surface), input = root.getByRole('textbox'), form = root.locator('form'), submit = form.locator('button[type="submit"]');
        const sent = `QA initial restored question ${surface}`;
        const draft = `QA pregunta sobre añada, envío y regalo ${surface}`;
        await input.fill(sent); await form.evaluate(element => element.requestSubmit()); await waitCalls(t, 1); await recoverySettled(t, surface);
        check(await input.inputValue() === sent, `draft/${surface}: API fallback first restores the submitted question`);
        await input.fill(draft);
        check(await input.isEditable() && await submit.isDisabled(), `draft/${surface}: the edited draft remains available during the known pause`);
        const before = assistantCalls(t);

        await t.page.getByTestId('locale-change').click();
        // The welcome reset proves the cosmetic effect ran before checking the
        // draft; observing only html.lang could race that passive effect.
        await t.page.waitForFunction(sent => document.documentElement.lang === 'en'
          && !document.querySelector('[role="log"]')?.textContent?.includes(sent), sent);
        check(await input.inputValue() === draft, `draft/${surface}: locale change preserves the exact localized draft before any refill`);
        check(await input.isEditable() && await submit.isDisabled(), `draft/${surface}: locale change preserves the same active wait`);
        check(assistantCalls(t) === before, `draft/${surface}: changing locale never sends an assistant request`);

        await t.page.getByTestId('label-change').click();
        await t.page.waitForFunction(() => document.querySelector('[data-testid="product"]')?.textContent === 'Vino QA etiqueta actualizada');
        await t.page.evaluate(() => Promise.resolve());
        check(await input.inputValue() === draft, `draft/${surface}: changing only the product label preserves the exact draft before any refill`);
        check(await input.isEditable() && await submit.isDisabled(), `draft/${surface}: label change cannot erase or renew the active wait`);
        check(assistantCalls(t) === before, `draft/${surface}: label change causes no automatic request`);

        await t.page.getByTestId('product-change').click();
        await t.page.waitForFunction(() => document.querySelector('[data-testid="product"]')?.textContent === 'Vino QB'
          && document.querySelector('[role="log"]')?.closest('.sun-engagement-suite')?.querySelector('form input')?.value === '');
        check(await input.inputValue() === '', `draft/${surface}: a genuinely different event clears the previous journey draft`);
        await input.fill('QA new event draft that must not leak to another tenant');
        await t.page.getByTestId('tenant-change').click();
        await t.page.waitForFunction(() => document.querySelector('[role="log"]')?.closest('.sun-engagement-suite')?.querySelector('form input')?.value === '');
        check(await input.inputValue() === '', `draft/${surface}: a different tenant clears the current draft`);
        check(assistantCalls(t) === before, `draft/${surface}: event/tenant transitions neither POST nor restore another journey draft`);
        await t.page.clock.fastForward(61_000);
        check(assistantCalls(t) === before, `draft/${surface}: expiry alone never resends the preserved question`);
        report.scopeCases.push({ name: `${surface}-cosmetic-draft-preservation`, status: 'passed', synthetic: true, localizedDraftPreserved: true, eventAndTenantClear: true });
      } catch (error) { report.recoveryFailures.push({ surface, phase: 'cosmetic-draft-preservation', error: String(error?.stack || error) }); }
      finally { await t.close(); }
    }

    // Cancellation must retain a usable question, never a late answer or a
    // previous event/tenant draft. These cases hold an already parsed body.
    report.pendingDraftCases = [];
    const pendingCases = [
      ...['sun-consumer', 'sun-demo'].flatMap(surface => ['locale-change', 'label-change'].map(change => ({ surface, change }))),
      { surface: 'sun-consumer', change: 'locale-change', newerDraft: true },
      { surface: 'sun-demo', change: 'label-change', newerDraft: true },
      { surface: 'sun-consumer', change: 'product-change', journeyChange: true },
      { surface: 'sun-demo', change: 'tenant-only', journeyChange: true },
      { surface: 'syngenta', change: 'locale-change' },
      { surface: 'portal', change: 'label-change' },
    ];
    for (const item of pendingCases) {
      const { surface, change, newerDraft = false, journeyChange = false } = item;
      const name = `pending-draft/${surface}/${change}/${newerDraft ? 'newer' : 'submitted'}`;
      const staleAnswer = `QA stale response must never be restored: ${name}`;
      const latePayload = recoveryPayload(surface, true, 'sommelier_budget_exhausted', 60);
      latePayload.payload.answer = staleAnswer;
      const t = await open({ width: 390, theme: surface === 'sun-demo' || surface === 'syngenta' ? 'dark' : 'light',
        surface: ['syngenta', 'portal'].includes(surface) ? surface : 'sun', valleDemo: surface === 'sun-demo', controlledClock: true,
        answer: () => latePayload });
      const observation = { name, surface, change, newerDraft, journeyChange, status: 'running', synthetic: true };
      report.pendingDraftCases.push(observation);
      try {
        await t.page.evaluate(() => {
          const transport = window.fetch.bind(window); window.__pendingDraftHold = true; window.__pendingDraftBodyWaiting = 0;
          window.fetch = async (url, init) => {
            const response = await transport(url, init);
            if (String(url) === '/api/sommelier/chat' && window.__pendingDraftHold) {
              window.__pendingDraftHold = false; const parse = response.json.bind(response);
              response.json = async () => { const body = await parse(); window.__pendingDraftBodyWaiting++;
                await new Promise(resolve => { window.__pendingDraftRelease = resolve; }); window.__pendingDraftBodyWaiting--; return body; };
            }
            return response;
          };
        });
        const root = recoveryRoot(t, surface), input = root.getByRole('textbox'), form = root.locator('form'), submit = form.locator('button[type="submit"]');
        const sent = `QA última pregunta enviada ${name}`;
        const newer = `QA borrador nuevo editado durante la consulta ${name}`;
        await input.fill(sent); await form.evaluate(element => element.requestSubmit());
        await t.page.waitForFunction(() => window.__pendingDraftBodyWaiting === 1);
        check(t.calls.filter(call => call.path === '/api/sommelier/chat').length === 1, `${name}: one explicit request reached the held parsed-body boundary`);
        if (newerDraft) { check(await input.isEditable(), `${name}: QR allows editing a newer draft while pending`); await input.fill(newer); }
        const before = assistantCalls(t);
        if (change === 'tenant-only') {
          // The fixture changes only the tenant prop; eventId/product stay put.
          await t.page.evaluate(() => window.__qaPendingDraftTenantOnly());
          await t.page.waitForFunction(() => document.querySelector('[data-testid="product"]')?.getAttribute('data-tenant') === 'qa-other');
        } else {
          await t.page.getByTestId(change).click();
          if (change === 'locale-change') await t.page.waitForFunction(() => document.documentElement.lang === 'en');
          else await t.page.waitForFunction(expected => document.querySelector('[data-testid="product"]')?.textContent === expected,
            change === 'label-change' ? 'Vino QA etiqueta actualizada' : 'Vino QB');
        }
        await recoverySettled(t, surface);
        const expected = journeyChange ? '' : newerDraft ? newer : sent;
        Object.assign(observation, { expectedAfterChange: expected, actualAfterChange: await input.inputValue(), assistantRequestsBeforeChange: before, assistantRequestsAfterChange: assistantCalls(t) });
        check(observation.actualAfterChange === expected, `${name}: cancellation preserves the submitted/newer question only within the same journey, before any refill`);
        check(await input.isEditable(), `${name}: cancellation releases the composer for deliberate editing`);
        check(assistantCalls(t) === before, `${name}: locale/label/context change never retries or sends automatically`);
        let expectedAfterLateBody = expected;
        if (journeyChange) { expectedAfterLateBody = `QA new journey draft after explicit context change ${name}`; await input.fill(expectedAfterLateBody); }
        await t.page.evaluate(() => { if (!window.__pendingDraftRelease) throw Error('Missing owned pending body'); window.__pendingDraftRelease(); window.__pendingDraftRelease = null; });
        await t.page.waitForFunction(() => window.__pendingDraftBodyWaiting === 0); await recoverySettled(t, surface);
        check(!(await root.innerText()).includes(staleAnswer), `${name}: the cancelled old response is never restored`);
        check(await input.inputValue() === expectedAfterLateBody, `${name}: the old body never overwrites the retained or new-journey draft`);
        check(await submit.isEnabled(), `${name}: a discarded old quota response installs no pause in the current owner`);
        check(assistantCalls(t) === before, `${name}: releasing the old response causes no rePOST`);
        await t.page.clock.fastForward(61_000);
        check(assistantCalls(t) === before && await input.inputValue() === expectedAfterLateBody, `${name}: time alone neither sends nor replaces the draft`);
        observation.status = 'passed';
        report.scopeCases.push({ name, status: 'passed', synthetic: true, realAuthentication: false, realTenantSynchronization: false });
      } catch (error) {
        observation.status = 'failed'; observation.error = String(error?.stack || error);
        report.recoveryFailures.push({ surface, phase: name, error: observation.error });
      } finally { await t.page.evaluate(() => window.__pendingDraftRelease?.()).catch(() => {}); await t.close(); }
    }

    // Confirmed replies may clear their own question, never a newer editable
    // draft. An immediate prompt must also remain visible while it is pending.
    report.pendingSuccessDraftCases = [];
    for (const surface of ['sun-consumer', 'sun-demo']) for (const scenario of ['live-newer-draft', 'empty-prompt']) {
      const name = `pending-success/${surface}/${scenario}`, answer = `QA first confirmed live answer ${name}`;
      const response = recoveryPayload(surface, false); response.payload.answer = answer;
      const t = await open({ width: 390, theme: surface === 'sun-demo' ? 'dark' : 'light', controlledClock: true,
        valleDemo: surface === 'sun-demo', answer: () => response });
      const observation = { name, surface, scenario, status: 'running', synthetic: true };
      report.pendingSuccessDraftCases.push(observation);
      try {
        await t.page.evaluate(() => {
          const transport = window.fetch.bind(window); window.__pendingLiveHold = true; window.__pendingLiveBodyWaiting = 0;
          window.fetch = async (url, init) => {
            const response = await transport(url, init);
            if (String(url) === '/api/sommelier/chat' && window.__pendingLiveHold) {
              window.__pendingLiveHold = false; const parse = response.json.bind(response);
              response.json = async () => { const body = await parse(); window.__pendingLiveBodyWaiting++;
                await new Promise(resolve => { window.__pendingLiveRelease = resolve; }); window.__pendingLiveBodyWaiting--; return body; };
            }
            return response;
          };
        });
        const root = recoveryRoot(t, surface), input = root.getByRole('textbox'), form = root.locator('form');
        let sent;
        if (scenario === 'empty-prompt') {
          check(await input.inputValue() === '', `${name}: prompt starts with an empty composer`);
          const prompt = root.getByTestId('sun-sommelier-prompts').getByRole('button').first(); sent = (await prompt.innerText()).trim();
          await prompt.click();
        } else {
          sent = `QA initial live question ${surface}`; await input.fill(sent); await form.evaluate(element => element.requestSubmit());
        }
        await t.page.waitForFunction(() => window.__pendingLiveBodyWaiting === 1);
        const calls = t.calls.filter(call => call.path === '/api/sommelier/chat');
        check(calls.length === 1 && calls[0].body.question === sent, `${name}: only the deliberately submitted question is requested`);
        let expected;
        if (scenario === 'empty-prompt') {
          Object.assign(observation, { expectedWhilePending: sent, actualWhilePending: await input.inputValue() });
          check(observation.actualWhilePending === sent, `${name}: the chosen prompt is visible as an editable pending question before any refill`);
          check(await input.isEditable(), `${name}: a pending prompt remains editable`); expected = '';
        } else {
          expected = `QA newer unsent draft, añada y regalo ${surface}`;
          check(await input.isEditable(), `${name}: the user may prepare a newer draft while the first reply is pending`);
          await input.fill(expected);
        }
        const before = assistantCalls(t);
        await t.page.evaluate(() => { if (!window.__pendingLiveRelease) throw Error('Missing owned live body'); window.__pendingLiveRelease(); window.__pendingLiveRelease = null; });
        await t.page.waitForFunction(() => window.__pendingLiveBodyWaiting === 0); await recoverySettled(t, surface);
        // Record enough evidence even when no answer anchor is produced. The
        // body is a direct Text node beside provenance metadata, not an element
        // whose complete text can equal `answer` for getByText({exact:true}).
        Object.assign(observation, { beforeReplyContract: {
          input: await input.inputValue(), log: (await root.getByRole('log').innerText()).slice(0, 12_000),
          alerts: await root.getByRole('alert').allTextContents(),
          recovery: await root.getByTestId('sun-sommelier-recovery-notice').allTextContents(),
          latestAnswerCount: await root.getByTestId('sun-sommelier-latest-answer').count(),
          transportPayload: response.payload,
          browser: await t.page.evaluate(() => ({ language: document.documentElement.lang, aborts: window.__aborts, heldBodies: window.__pendingLiveBodyWaiting })),
        } });
        const latest = root.getByTestId('sun-sommelier-latest-answer'); await latest.waitFor();
        const replyDom = await latest.evaluate(anchor => {
          const bubble = anchor.firstElementChild;
          const textNodes = [...(bubble?.childNodes || [])].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent || '');
          return { anchorId: anchor.id, insideLog: Boolean(anchor.closest('[role="log"]')),
            bubbleTag: bubble?.tagName || null, textNodes, bodyText: textNodes.join('').trim(),
            textContent: bubble?.textContent || '', innerText: bubble?.innerText || '',
            provenanceTexts: [...(bubble?.querySelectorAll('details p') || [])].map(node => (node.textContent || '').trim()) };
        });
        observation.replyDom = replyDom;
        check(replyDom.insideLog && replyDom.bodyText === answer, `${name}: the latest assistant reply contains exactly the confirmed response body in its Text node`);
        check(replyDom.provenanceTexts.length === 1 && replyDom.provenanceTexts[0] === 'Proveedor confirmado · fixture-provider / fixture-model · no es ficha técnica', `${name}: the same latest reply has the exact confirmed live provenance`);
        Object.assign(observation, { expectedAfterLive: expected, actualAfterLive: await input.inputValue() });
        check(observation.actualAfterLive === expected, `${name}: a first confirmed reply clears only its own untouched question and preserves a newer draft`);
        check(assistantCalls(t) === before, `${name}: receiving a confirmed reply never sends the next draft`);
        await t.page.clock.fastForward(61_000);
        check(assistantCalls(t) === before && await input.inputValue() === expected, `${name}: time alone cannot send or replace the next draft`);
        observation.status = 'passed';
        report.scopeCases.push({ name, status: 'passed', synthetic: true, realProviderReply: false });
      } catch (error) {
        observation.status = 'failed'; observation.error = String(error?.stack || error);
        report.recoveryFailures.push({ surface, phase: name, error: observation.error });
      } finally {
        await t.page.evaluate(() => window.__pendingLiveRelease?.()).catch(() => {});
        await t.page.waitForFunction(() => window.__pendingLiveBodyWaiting === 0);
        await t.close();
      }
    }

  }

  check(report.recoveryFailures.length === 0, `all four actual UI surfaces honor recovery; failures=${report.recoveryFailures.length}`);
}

try {
  if (!process.env.QA_RECOVERY_ONLY) {
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
    check(await t.page.getByTestId("sun-sommelier-recovery-notice").count() === 0, `${label}: consumer service failures retain the alert contract rather than a Valle notice`);
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
  for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const failure of ["fallback", "unavailable"]) {
    let release, releaseNew;
    const pending = new Promise(resolve => { release = resolve; });
    let answer = () => pending;
    const t = await open({ width, theme, valleDemo: true, answer: request => answer(request) });
    const label = `valle-recovery/${width}/${theme}/${failure}`, question = "Pregunta Valle con respuesta pendiente";
    const degraded = () => failure === "fallback" ? reply("Orientación Valle sintética sin IA confirmada", true, { demo: true }) : { status: 503, payload: { ok: false } };
    const notice = failure === "fallback" ? "El servicio devolvió orientación general, sin una respuesta de IA confirmada. Podés volver a enviar la pregunta." : "No recibimos una respuesta del asistente. Podés volver a enviar la pregunta; mientras tanto, mostramos una guía local.";
    try {
      check(t.calls.length === 0, `${label}: mounting makes no session or assistant request`);
      await t.page.getByRole("textbox").fill(question);
      await t.page.getByRole("textbox").locator("..").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      await waitCalls(t, 1);
      check(await t.page.getByRole("log").getAttribute("aria-busy") === "true" && await t.page.getByRole("textbox").inputValue() === question, `${label}: question waits once with its exact submitted draft preserved`);
      release(degraded());
      await t.page.getByTestId("sun-sommelier-recovery-notice").filter({ hasText: notice }).waitFor();
      check(await t.page.getByRole("textbox").inputValue() === question && await t.page.getByRole("status").filter({ hasText: notice }).innerText() === notice && await t.page.getByRole("alert").count() === 0, `${label}: handled fallback restores the question and announces a truthful non-blocking status`);
      check(t.calls.length === 2 && t.calls[0].path === "/api/sommelier/demo/session" && t.calls[0].body.profile === "valle-secreto" && t.calls[1].path === "/api/sommelier/chat" && t.calls[1].body.mode === "demo" && t.calls[1].body.locale === "es-AR" && t.calls[1].body.question === question && !Object.hasOwn(t.calls[1].body, "eventId"), `${label}: only one explicit existing Valle session/chat pair is sent`);
      await t.page.getByRole("log").locator("summary").last().click();
      check((await t.page.getByRole("log").locator("details").last().innerText()).includes("Fallback local") && !(await t.page.getByRole("log").innerText()).includes("fixture-provider"), `${label}: the useful sourced answer is labelled as local guidance`);
      await inspectNaturalConversation(t, `${label}-first`);
      await inspectAccessibility(t, `${label}-first`);
      await t.page.waitForTimeout(80);
      check(t.calls.length === 2, `${label}: showing fallback does not retry automatically`);
      const nextQuestion = "Pregunta Valle antes de otro borrador", newerDraft = "Borrador distinto escrito mientras espero";
      const pendingNew = new Promise(resolve => { releaseNew = resolve; });
      answer = () => pendingNew;
      await send(t, nextQuestion);
      await waitCalls(t, 2);
      check(await t.page.getByRole("log").getAttribute("aria-busy") === "true" && await t.page.getByTestId("sun-sommelier-recovery-notice").count() === 0, `${label}: an explicit new question clears the previous notice before its response`);
      await t.page.getByRole("textbox").fill(newerDraft);
      releaseNew(degraded());
      await t.page.getByTestId("sun-sommelier-recovery-notice").filter({ hasText: notice }).waitFor();
      check(await t.page.getByRole("textbox").inputValue() === newerDraft && await t.page.getByRole("alert").count() === 0 && await t.page.getByRole("log").getByText(newerDraft, { exact: true }).count() === 0, `${label}: recovery preserves the newer unsent draft`);
      check(t.calls.length === 4 && t.calls.filter(call => call.path === "/api/sommelier/chat").length === 2 && t.calls.filter(call => call.path === "/api/sommelier/demo/session").length === 2, `${label}: the pending response creates no extra request`);
      await inspectNaturalConversation(t, `${label}-newer`);
      await inspectAccessibility(t, `${label}-newer`);
      answer = () => reply("Respuesta Valle sintética después del reintento manual", false, { demo: true });
      await t.page.getByRole("textbox").locator("..").getByRole("button", { exact: true }).click();
      await t.page.getByRole("log").getByText("Respuesta Valle sintética después del reintento manual", { exact: false }).waitFor();
      const chats = t.calls.filter(call => call.path === "/api/sommelier/chat"), sessions = t.calls.filter(call => call.path === "/api/sommelier/demo/session");
      check(t.calls.length === 6 && chats.length === 3 && sessions.length === 3 && chats[2].body.question === newerDraft && chats[2].body.mode === "demo" && !Object.hasOwn(chats[2].body, "eventId"), `${label}: only the explicit retry submits the newer draft once`);
      check(await t.page.getByTestId("sun-sommelier-recovery-notice").count() === 0 && await t.page.getByRole("alert").count() === 0 && await t.page.getByRole("textbox").inputValue() === "", `${label}: confirmed synthetic recovery clears status and draft`);
      report.views.push({ width, theme, phase: "valle-recovery", failure, syntheticRequests: t.calls.length });
    } finally {
      release(degraded()); releaseNew?.(degraded()); await t.close();
    }
  }
  }
  await runRecoveryCases();
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
  stop();
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, views: report.views.length, output }));
