// Actual SUN components on loopback; all session/chat/locale replies are synthetic.
// Delayed-body cases exercise cancellation after HTTP completion, without waiving transport failures.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const web = fileURLToPath(new URL("../", import.meta.url));
const output = join(resolve(process.env.QA_OUTPUT || "artifacts/sun-managed-sommelier"), `run-${randomUUID()}`);
await mkdir(output, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const axe = await readFile(process.env.AXE_MODULE_PATH, "utf8");
const paths = [
  "tests/sun-managed-sommelier.browser.mjs", "src/app/sun/qr-engagement-suite.tsx", "src/app/sun/qr-engagement-suite.module.css",
  "src/lib/managed-sommelier.ts", "src/lib/sommelier-conversation.ts", "src/lib/sommelier-guidance.ts",
  "src/app/sun/sun-demo-sommelier.ts", "src/app/sun/sun-demo-wine-quiz.ts", "src/app/sun/valle-secreto-demo.ts",
  "src/app/sun/valle-secreto-experience.tsx", "src/app/sun/valle-secreto-experience.module.css",
  "src/app/sun/sun-locale-provider.tsx", "src/app/sun/sun-locale.ts", "src/app/globals.css", "src/app/sun/sun-passport-experience.module.css",
];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async path => [path, hash(await readFile(join(web, path)))])));
const sourceHashes = await hashes();
const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SunLocaleProvider,useSunLocale}from'./src/app/sun/sun-locale-provider';import{QREngagementSuite}from'./src/app/sun/qr-engagement-suite';import{VALLE_SECRETO_DEMO}from'./src/app/sun/valle-secreto-demo';import{ValleSecretoDemoServices}from'./src/app/sun/valle-secreto-experience';import{demoSommelierCopy}from'./src/app/sun/sun-demo-sommelier';import passport from'./src/app/sun/sun-passport-experience.module.css';
function App(){const{locale,setLocale}=useSunLocale(),[product,setProduct]=useState(VALLE_SECRETO_DEMO.name),[visible,setVisible]=useState(true);window.__managedCopy=demoSommelierCopy(locale);return <><aside aria-label='Synthetic QA controls'><button data-testid='qa-product-change' onClick={()=>setProduct('Profundo · QA context B')}>Change context</button><button data-testid='qa-locale-change' onClick={()=>void setLocale(locale==='en'?'pt-BR':'en')}>Change locale</button><button data-testid='qa-unmount' onClick={()=>setVisible(false)}>Unmount</button></aside><main className='sun-tap-experience' style={{maxWidth:430,margin:'0 auto',padding:12}}><h1>Sommelier · synthetic QA</h1><div className={passport.passport+' sun-tap-shell'}><ValleSecretoDemoServices locale={locale}/><section id='qr-engagement'>{visible?<QREngagementSuite productName={product} wineryName={VALLE_SECRETO_DEMO.brand} isDemoPreview demoWineProfile={VALLE_SECRETO_DEMO} initialTab='sommelier'/>:<p data-testid='qa-unmounted'>Unmounted</p>}</section></div></main></>};const locale=new URLSearchParams(location.search).get('locale')||'es-AR';createRoot(document.getElementById('app')).render(<SunLocaleProvider initialLocale={locale}><App/></SunLocaleProvider>);`;
const bundled = await build({ stdin: { contents: fixture, resolveDir: web, loader: "tsx" }, bundle: true, write: false, outfile: "fixture.js", format: "esm", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "inert-next", setup(b) {
  b.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: "nav" }));
  b.onLoad({ filter: /.*/, namespace: "nav" }, args => ({ contents: args.path === "next/navigation" ? "export function useRouter(){return {push(){throw Error('Navigation must stay inert')}}}" : "import React from'react';export default function Link({prefetch,...props}){return <a {...props}/>}", loader: "tsx", resolveDir: web }));
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
  if (path !== "/") { res.writeHead(404); return res.end(); }
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html><head><title>SUN managed sommelier · synthetic QA</title><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='stylesheet' href='/fixture.css'><style>body{margin:0;font:16px/1.5 system-ui}h1{font-size:20px}*,*:before,*:after{box-sizing:border-box}aside{display:flex;gap:4px;flex-wrap:wrap}aside button{min-height:44px}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const report = {
  schema: "nexid.managed-sommelier-browser-fixture/v1", localOnly: true, actualNextServer: false, fixtureHtml: true,
  actualProductionComponentsAndCss: true, nextNavigationInert: true, syntheticResponses: true,
  realProviderRequests: 0, realBusinessWrites: 0, customerAuthenticationProven: false, releaseAcceptance: false,
  output, sourceHashes, fixtureSha256: hash(fixture), compiledFixtureSha256: hash(js.contents), compiledCssSha256: hash(css),
  selectedCase: process.env.QA_ONLY || null, checks: [], cases: [], views: [], accessibility: [], apiRequests: [],
  externalRequests: [], unexpectedRequests: [], failedRequests: [], pageErrors: [], consoleEvents: [], expectedSyntheticHttpConsole: [], consoleErrors: [], errors: [],
  geolocationCalls: 0, storageWrites: [], delayedBodyObservations: [],
};
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
const technicalSheet = "https://vallesecreto.cl/wp-content/uploads/2025/10/10-2025-Ficha-Tecnica-PROFUNDO-2019.pdf";
const foreign = "https://invalid.example.test/untrusted";
const dish = { "es-AR": "Cordero", en: "Lamb", "pt-BR": "Cordeiro" };
const localOrigin = { "es-AR": "Fallback local · orientación general, no ficha técnica", en: "Local guide · general advice, not a technical sheet", "pt-BR": "Guia local · orientação geral, não é ficha técnica" };
const pairing = { "es-AR": "¿Con qué comida lo acompaño?", en: "What food can I pair it with?", "pt-BR": "Com que comida posso harmonizar?" };
const live = (answer, question) => ({ status: 200, payload: { ok: true, answer, source: "live", fallback: false, provider: "huggingface", model: "openai/gpt-oss-20b:deepinfra", demo: true,
  sources: [{ id: "technical_sheet", label: "Producer sheet · QA", url: technicalSheet }, { id: "foreign", label: "FOREIGN SOURCE", url: foreign }, { id: "script", label: "SCRIPT SOURCE", url: "javascript:alert(1)" }, { id: "credentials", label: "CREDENTIAL SOURCE", url: "https://user:pass@vallesecreto.cl/private" }, { id: "http", label: "HTTP SOURCE", url: "http://vallesecreto.cl/not-https" }],
  suggestedQuestions: [dish[question.locale], "QA follow-up two", "QA follow-up three"] } });

async function open(width, theme, locale) {
  const view = `${locale}/${width}/${theme}`;
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage(), calls = [];
  const state = { mode: "live", reply: "QA live pairing", activeRoutes: 0, pendingRoutes: new Set() };
  page.setDefaultTimeout(10_000);
  page.on("pageerror", error => report.pageErrors.push({ view, name: error.name, message: error.message }));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const location = message.location();
    let url; try { url = new URL(location.url); } catch { /* Missing location is never an expected response. */ }
    const status = /^Failed to load resource: the server responded with a status of (429|503) \((?:Too Many Requests|Service Unavailable)\)$/.exec(message.text());
    const row = { view, message: message.text(), path: url?.origin === origin ? url.pathname : "[unknown]", status: status ? Number(status[1]) : null };
    report.consoleEvents.push(row);
    const expected = status && url?.origin === origin && !url.search && ["/api/sommelier/demo/session", "/api/sommelier/chat"].includes(url.pathname)
      && calls.some(call => call.path === url.pathname && call.synthetic === true && call.responseStatus === Number(status[1]));
    if (expected) report.expectedSyntheticHttpConsole.push(row);
    else report.consoleErrors.push(row);
  });
  page.on("requestfailed", request => { const u = new URL(request.url()); report.failedRequests.push({ view, path: u.origin === origin ? u.pathname : "[external]", method: request.method(), resourceType: request.resourceType(), error: request.failure()?.errorText || "unknown" }); });
  await page.addInitScript(({ theme, locale }) => {
    document.addEventListener("DOMContentLoaded", () => { document.documentElement.dataset.theme = theme; document.documentElement.lang = locale; }, { once: true });
    window.__managedBodyWaiting = 0; window.__managedReleasedBodies = 0; window.__managedChatAborts = 0; window.__managedGpsCalls = 0; window.__managedStorageWrites = [];
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() { window.__managedGpsCalls++; throw Error("Unexpected GPS"); }, watchPosition() { window.__managedGpsCalls++; throw Error("Unexpected GPS"); } } });
    for (const name of ["setItem", "removeItem", "clear"]) { const original = Storage.prototype[name]; Storage.prototype[name] = function (...args) { window.__managedStorageWrites.push({ method: name, key: typeof args[0] === "string" ? args[0] : null }); return original.apply(this, args); }; }
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const path = new URL(typeof input === "string" ? input : input.url, location.origin).pathname;
      if (path === "/api/sommelier/chat") init?.signal?.addEventListener("abort", () => window.__managedChatAborts++, { once: true });
      const response = await original(input, init);
      if (path === "/api/sommelier/chat" && window.__managedHoldNextBody) {
        window.__managedHoldNextBody = false;
        const json = response.json.bind(response);
        response.json = async () => { const payload = await json(); window.__managedBodyWaiting++; await new Promise(resolve => { window.__managedReleaseBody = resolve; }); window.__managedBodyWaiting--; window.__managedReleasedBodies++; return payload; };
      }
      return response;
    };
  }, { theme, locale });
  await page.route("**/*", async route => {
    const work = (async () => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { report.externalRequests.push({ view, origin: url.origin, method: request.method(), resourceType: request.resourceType() }); report.realProviderRequests++; return route.abort(); }
      if (url.pathname.startsWith("/api/")) {
        if (!["/api/sommelier/demo/session", "/api/sommelier/chat", "/api/sun/locale"].includes(url.pathname) || request.method() !== "POST" || url.search) {
          report.unexpectedRequests.push({ view, path: url.pathname, method: request.method() }); return route.abort();
        }
        const body = request.postDataJSON(), call = { view, path: url.pathname, method: request.method(), body, synthetic: true };
        calls.push(call); report.apiRequests.push(call);
        let response;
        if (url.pathname === "/api/sun/locale") response = { status: 200, payload: { ok: true } };
        else if (url.pathname === "/api/sommelier/demo/session") response = state.mode === "session-denied" ? { status: 503, payload: { ok: false, error: "sommelier_unavailable" } } : state.mode === "session-quota" ? { status: 429, payload: { ok: false, error: "quota_exceeded" } } : { status: 200, payload: { ok: true } };
        else if (state.mode === "chat-quota") response = { status: 429, payload: { ok: false, error: "quota_exceeded" } };
        else if (state.mode === "server-fallback") response = { status: 200, payload: { ok: true, answer: "QA server fallback must not be called AI", source: "fallback", fallback: true, demo: true, sources: [], suggestedQuestions: [] } };
        else response = live(state.reply, body);
        call.responseStatus = response.status;
        await route.fulfill({ status: response.status, contentType: "application/json", body: JSON.stringify(response.payload) });
        return;
      }
      if (request.method() !== "GET" || !["/", "/fixture.js", "/fixture.css", "/favicon.ico"].includes(url.pathname) || (url.pathname !== "/" && url.search)) { report.unexpectedRequests.push({ view, path: url.pathname, method: request.method() }); return route.abort(); }
      await route.continue();
    })();
    state.pendingRoutes.add(work); state.activeRoutes++;
    try { await work; } catch (error) { report.errors.push({ view, kind: "route", name: error.name, message: error.message }); }
    finally { state.pendingRoutes.delete(work); state.activeRoutes--; }
  });
  await page.goto(`${origin}/?locale=${locale}`, { waitUntil: "networkidle" });
  await page.getByRole("log").waitFor();
  return { view, context, page, calls, state, copy: await page.evaluate(() => window.__managedCopy), chatCalls: () => calls.filter(call => call.path === "/api/sommelier/chat"), sessionCalls: () => calls.filter(call => call.path === "/api/sommelier/demo/session") };
}
async function send(t, text) { const input = t.page.getByRole("textbox"); await input.fill(text); await input.press("Enter"); }
async function settled(t, count) { await t.page.waitForFunction(expected => { const log = document.querySelector('[role="log"]'); return log?.getAttribute("aria-busy") === "false" && log.children.length === expected; }, count); }
async function releaseBody(t) { await t.page.evaluate(() => { if (!window.__managedReleaseBody) throw Error("No held body"); window.__managedReleaseBody(); window.__managedReleaseBody = null; }); await t.page.waitForFunction(() => window.__managedBodyWaiting === 0); }
async function holdQuestion(t, text, answer) { t.state.mode = "live"; t.state.reply = answer; await t.page.evaluate(() => { window.__managedHoldNextBody = true; }); await send(t, text); await t.page.waitForFunction(() => window.__managedBodyWaiting === 1); }
async function inspectAccessibility(t, phase) {
  const observation = await t.page.evaluate(async () => { const result = await axe.run("main", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }); return { violations: result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, failureSummary: n.failureSummary, any: n.any })) })), incomplete: result.incomplete.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, any: n.any })) })) }; });
  report.accessibility.push({ view: t.view, phase, ...observation });
  check(observation.violations.length === 0, `${t.view}: ${phase} scoped actual-component AXE has zero violations`);
  return observation;
}
async function close(t) {
  await Promise.all([...t.state.pendingRoutes]);
  const observation = await t.page.evaluate(() => ({ geolocationCalls: window.__managedGpsCalls, storageWrites: window.__managedStorageWrites, heldBodies: window.__managedBodyWaiting, releasedBodies: window.__managedReleasedBodies, chatAborts: window.__managedChatAborts }));
  report.geolocationCalls += observation.geolocationCalls; report.storageWrites.push(...observation.storageWrites.map(row => ({ view: t.view, ...row }))); report.delayedBodyObservations.push({ view: t.view, ...observation });
  check(observation.heldBodies === 0 && t.state.activeRoutes === 0, `${t.view}: all synthetic responses and held bodies drained`);
  await t.context.close();
}

let active;
try {
  for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const locale of ["es-AR", "en", "pt-BR"]) {
    const view = `${locale}/${width}/${theme}`;
    if (process.env.QA_ONLY && process.env.QA_ONLY !== view) continue;
    const t = active = await open(width, theme, locale), log = t.page.getByRole("log");
    check(t.calls.length === 0, `${view}: opening sends zero session/chat/locale requests`);
    check(await t.page.getByTestId("sun-sommelier-prompts").getByRole("button").count() === 5, `${view}: five useful Valle entries`);
    check(await t.page.getByRole("textbox").evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16), `${view}: input font avoids mobile zoom`);
    const pairs = [];
    const questions = [pairing[locale], dish[locale], "QA service follow-up", "QA gift follow-up", "QA storage follow-up"];
    for (const [index, question] of questions.entries()) {
      const answer = index === 3 ? "QA contextual long answer " + "Guidance for this synthetic conversation. ".repeat(40) : `QA live reply ${index + 1} · ${locale}`;
      const before = await log.locator(":scope > div").count(); t.state.reply = answer;
      if (index === 1) await t.page.getByTestId("sun-sommelier-follow-ups").getByRole("button", { name: dish[locale], exact: true }).click();
      else await send(t, question);
      await settled(t, before + 2);
      const request = t.chatCalls().at(-1).body;
      check(request.mode === "demo" && request.locale === locale && !Object.hasOwn(request, "eventId"), `${view}: round ${index + 1} binds explicit demo and current locale without NFC event`);
      check(Object.keys(request).sort().join() === "history,locale,mode,question", `${view}: round ${index + 1} sends only the managed chat contract`);
      check(t.sessionCalls().at(-1).body.profile === "valle-secreto" && t.sessionCalls().at(-1).body.locale === locale, `${view}: round ${index + 1} scopes its session to Valle and locale`);
      check(Array.isArray(request.history) && request.history.length <= 6 && Buffer.byteLength(JSON.stringify(request.history)) <= 6000 && request.history.every(row => ["user", "assistant"].includes(row.role) && row.content.length <= 1000), `${view}: round ${index + 1} has bounded conversation history`);
      if (index === 0) check(request.history.length === 0, `${view}: welcome/context does not masquerade as user history`);
      if (index === 1) check(request.history.length === 2 && request.history[0].content === questions[0] && request.history[1].content === pairs[0].answer && request.question === dish[locale], `${view}: brief dish reply carries the earlier user and assistant`);
      if (index === 4) check(request.history.length === 6 && request.history[0].content === questions[1] && request.history.at(-1).content.length === 1000 && pairs[3].answer.startsWith(request.history.at(-1).content), `${view}: oldest pair is removed and long assistant text is bounded`);
      const last = log.locator(":scope > div").last();
      check((await last.innerText()).includes(t.copy.live) && (await last.innerText()).includes(t.copy.sample), `${view}: live provenance and educational sample label are both visible`);
      check(await last.locator(`a[href="${technicalSheet}"]`).count() === 1 && await last.locator("a").count() === 1, `${view}: only the allowlisted producer source is linked`);
      check(await last.locator("a").getAttribute("referrerpolicy") === "no-referrer" && !/FOREIGN SOURCE|SCRIPT SOURCE|CREDENTIAL SOURCE|HTTP SOURCE/.test(await last.innerText()), `${view}: injected source URLs and labels are discarded`);
      pairs.push({ question, answer });
    }
    const followUps = t.page.getByTestId("sun-sommelier-follow-ups").getByRole("button");
    check(await followUps.count() === 3 && await followUps.first().innerText() === dish[locale], `${view}: validated live suggestions become continuations`);
    await log.locator(":scope > div").last().locator("summary").click();
    check(/openai\/gpt-oss-20b:deepinfra/.test(await log.locator(":scope > div").last().innerText()), `${view}: response origin discloses the synthetic provider/model payload`);
    await t.page.screenshot({ path: join(output, `${locale}-${width}-${theme}-live.png`), fullPage: true });
    report.cases.push({ view, kind: "live_history_sources", passed: true, completed: true });

    const beforeDuplicate = t.chatCalls().length, beforeDuplicateSession = t.sessionCalls().length, beforeMessages = await log.locator(":scope > div").count();
    t.state.reply = "QA one duplicate answer";
    await t.page.evaluate(() => { window.__managedHoldNextBody = true; });
    await t.page.getByRole("textbox").fill("QA synchronous duplicate question");
    await t.page.getByRole("textbox").evaluate(el => { for (let i = 0; i < 2; i++) el.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await t.page.waitForFunction(() => window.__managedBodyWaiting === 1);
    check(t.chatCalls().length === beforeDuplicate + 1 && t.sessionCalls().length === beforeDuplicateSession + 1, `${view}: synchronous duplicate submit makes one session and one chat`);
    check(await log.getByText("QA synchronous duplicate question", { exact: true }).count() === 1, `${view}: duplicate submit creates one user message`);
    await releaseBody(t); await settled(t, beforeMessages + 2);
    check((await log.locator(":scope > div").last().innerText()).includes("QA one duplicate answer"), `${view}: one completed answer after duplicate submit`);
    report.cases.push({ view, kind: "duplicate_submit", passed: true, completed: true });

    for (const mode of ["session-quota", "session-denied", "chat-quota", "server-fallback"]) {
      const before = await log.locator(":scope > div").count(), chats = t.chatCalls().length, sessions = t.sessionCalls().length;
      t.state.mode = mode; await send(t, pairing[locale]); await settled(t, before + 2);
      const last = log.locator(":scope > div").last();
      check(t.sessionCalls().length === sessions + 1 && t.chatCalls().length === chats + (mode.startsWith("session-") ? 0 : 1), `${view}: ${mode} has no automatic retry or chat after session denial`);
      check(!(await last.innerText()).includes(t.copy.live) && !(await last.innerText()).includes("QA server fallback must not be called AI"), `${view}: ${mode} never claims a live AI answer`);
      check((await last.innerText()).includes("Profundo 2019") && await last.locator(`a[href="${technicalSheet}"]`).count() === 1 && await t.page.getByRole("alert").count() === 0, `${view}: ${mode} retains useful sourced local guidance without a blocking error`);
      await last.locator("summary").click();
      check((await last.innerText()).includes(localOrigin[locale]), `${view}: ${mode} exposes the honest local response origin in the selected language`);
      report.cases.push({ view, kind: mode, passed: true, completed: true });
    }
    await t.page.screenshot({ path: join(output, `${locale}-${width}-${theme}-local.png`), fullPage: true });
    await t.page.addScriptTag({ content: axe });
    await inspectAccessibility(t, "local-expanded");
    // Preserve expanded/partially scrolled AXE evidence first. The second observation uses
    // the same nodes and CSS, with disclosures closed via their native controls and chat at its end.
    while (await log.locator("details[open] summary").count()) await log.locator("details[open] summary").first().click();
    await log.evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event("scroll", { bubbles: true })); });
    check(await log.locator("details[open]").count() === 0 && await log.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight < 2), `${view}: normal condensed chat is at the final message without excluding nodes`);
    await inspectAccessibility(t, "local-condensed-at-end");
    await t.page.screenshot({ path: join(output, `${locale}-${width}-${theme}-local-condensed.png`), fullPage: true });
    check(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${view}: no horizontal overflow`);
    check(await t.page.locator("main button:not(:disabled),main a,main summary").evaluateAll(els => els.filter(el => el.getClientRects().length).every(el => el.getBoundingClientRect().height >= 43.5)), `${view}: visible actions have 44px touch targets`);

    for (const change of ["qa-product-change", "qa-locale-change", "qa-unmount"]) {
      const beforeCalls = t.chatCalls().length, beforeAborts = await t.page.evaluate(() => window.__managedChatAborts);
      const late = `QA stale body after ${change}`;
      await holdQuestion(t, "QA pending scope question", late);
      await t.page.getByTestId(change).click();
      await t.page.waitForFunction(before => window.__managedChatAborts > before, beforeAborts);
      if (change === "qa-locale-change") { await t.page.waitForFunction(previous => document.querySelector("[data-sun-locale]")?.getAttribute("data-sun-locale") !== previous, locale); t.copy = await t.page.evaluate(() => window.__managedCopy); }
      if (change === "qa-unmount") await t.page.getByTestId("qa-unmounted").waitFor();
      else await settled(t, 1);
      await releaseBody(t);
      check(await t.page.getByText(late, { exact: false }).count() === 0 && t.chatCalls().length === beforeCalls + 1, `${view}: ${change} cancels pending body without restoring a late answer`);
      if (change === "qa-locale-change") {
        t.state.reply = "QA new locale conversation"; await send(t, "QA after locale change"); await settled(t, 3);
        const body = t.chatCalls().at(-1).body, nextLocale = locale === "en" ? "pt-BR" : "en";
        check(body.locale === nextLocale && body.history.length === 0, `${view}: a new locale starts a clean managed conversation`);
      }
      report.cases.push({ view, kind: change.replace("qa-", "") + "_pending_body", passed: true, completed: true, transportCompletedBeforeCancellation: true });
    }
    report.views.push({ view, width, theme, locale, completed: true, syntheticSessionRequests: t.sessionCalls().length, syntheticChatRequests: t.chatCalls().length, syntheticLocaleRequests: t.calls.filter(call => call.path === "/api/sun/locale").length });
    await close(t); active = null;
  }
  check(report.views.length === (process.env.QA_ONLY ? 1 : 12), "responsive locale/theme matrix complete");
  check(report.externalRequests.length === 0 && report.realProviderRequests === 0 && report.unexpectedRequests.length === 0, "no external/provider/unexpected API requests");
  check(report.failedRequests.length === 0 && report.pageErrors.length === 0 && report.consoleErrors.length === 0 && report.errors.length === 0, "every transport/browser failure remains fatal");
  check(report.geolocationCalls === 0 && report.storageWrites.length === 0, "zero GPS and persistence writes");
  report.endSourceHashes = await hashes(); report.sourceAndHelperStable = JSON.stringify(report.sourceHashes) === JSON.stringify(report.endSourceHashes);
  check(report.sourceAndHelperStable, "source and new helper stable throughout the fixture audit");
  report.status = "passed";
} catch (error) {
  report.errors.push({ kind: "assertion", name: error.name, message: error.message });
  if (active) { await active.page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => {}); await active.context.close(); active = null; }
  report.status = "failed"; process.exitCode = 1;
} finally {
  report.endSourceHashes ||= await hashes(); report.sourceAndHelperStable = JSON.stringify(report.sourceHashes) === JSON.stringify(report.endSourceHashes);
  await browser.close(); await new Promise(r => server.close(r));
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
}
console.log(JSON.stringify({ status: report.status, schema: report.schema, checks: report.checks.length, views: report.views.length, output, reportSha256: hash(await readFile(join(output, "report.json"))) }));
