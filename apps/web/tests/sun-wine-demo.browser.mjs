// Production SUN hub/CSS in a loopback fixture. No Next server, providers, accounts or business writes.
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
const output = resolve(process.env.QA_OUTPUT || "artifacts/sun-wine-demo");
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_MODULE_PATH, "utf8");
const paths = ["tests/sun-wine-demo.browser.mjs", "src/app/sun/sun-services-hub.tsx", "src/app/sun/sun-services-hub.module.css", "src/app/sun/qr-engagement-suite.tsx", "src/app/sun/qr-engagement-suite.module.css", "src/app/sun/sun-demo-wine-quiz.ts", "src/app/sun/sun-demo-sommelier.ts", "src/app/sun/valle-secreto-demo.ts", "src/app/sun/valle-secreto-experience.tsx", "src/app/sun/valle-secreto-experience.module.css", "src/app/globals.css", "src/app/sun/sun-passport-experience.module.css", "public/sun/valle-secreto/profundo.webp", "public/sun/valle-secreto/logo-dark.webp", "public/sun/valle-secreto/logo-light.png"];
paths.push("src/lib/managed-sommelier.ts", "src/lib/sommelier-conversation.ts", "src/lib/sommelier-guidance.ts");
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(join(web, path))).digest("hex")])));
const startHashes = await hashes();
const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{SunLocaleProvider}from'./src/app/sun/sun-locale-provider';import{SunServicesHub}from'./src/app/sun/sun-services-hub';import{QREngagementSuite}from'./src/app/sun/qr-engagement-suite';import{VALLE_SECRETO_DEMO}from'./src/app/sun/valle-secreto-demo';import{ValleSecretoExperience,ValleSecretoDemoServices}from'./src/app/sun/valle-secreto-experience';import{demoWineTrivia}from'./src/app/sun/sun-demo-wine-quiz';import{demoSommelierCopy,demoSommelierPrompts}from'./src/app/sun/sun-demo-sommelier';import passport from'./src/app/sun/sun-passport-experience.module.css';const params=new URLSearchParams(location.search),locale=params.get('locale')||'es-AR',wine=params.get('profile')==='generic'?null:VALLE_SECRETO_DEMO,productName=wine?.name||'Gran Reserva Malbec',wineryName=wine?.brand||'Bodega Balmec';window.__wineQuiz=demoWineTrivia({productName,wineryName,locale,facts:wine||undefined});window.__wineChatCopy=demoSommelierCopy(locale);window.__wineChatPrompts=demoSommelierPrompts(locale,wine);createRoot(document.getElementById('app')).render(<SunLocaleProvider initialLocale={locale}><main className='sun-tap-experience' style={{maxWidth:430,margin:'0 auto',padding:12}}><h1>Vino · muestra local</h1><div className={passport.passport+' sun-tap-shell'}>{wine?<><ValleSecretoExperience locale={locale}/><ValleSecretoDemoServices locale={locale}/></>:<SunServicesHub locale={locale} freshnessState='demo' riskState='clear' demoIntent='benefit' policyAvailability={{promotion:false,purchase:false,subscribe:false,claimOrManage:false,warranty:false}}/>}<section id='qr-engagement'><QREngagementSuite productName={productName} wineryName={wineryName} isDemoPreview demoWineProfile={wine} initialTab='sommelier'/></section></div></main></SunLocaleProvider>);`;
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
  if (["/sun/valle-secreto/profundo.webp", "/sun/valle-secreto/logo-dark.webp", "/sun/valle-secreto/logo-light.png"].includes(path)) {
    res.setHeader("content-type", path.endsWith(".png") ? "image/png" : "image/webp");
    readFile(join(web, "public", path.slice(1))).then(bytes => res.end(bytes)).catch(() => { res.writeHead(404); res.end(); });
    return;
  }
  if (path === "/favicon.ico") { res.writeHead(204); return res.end(); }
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html><head><title>SUN · muestra local</title><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='stylesheet' href='/fixture.css'><style>body{margin:0;font:16px/1.5 system-ui}h1{font-size:20px}*,*:before,*:after{box-sizing:border-box}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { localOnly: true, actualProductionComponentsAndCss: true, actualNextServer: false, nextNavigationInert: true, physicalTapMeasured: false, realBusinessWrites: 0, managedServiceDisabledMock: true, managedDemoRequests: [], selectedCase: process.env.QA_ONLY || null, externalRequests: [], apiRequests: [], errors: [], geolocationCalls: 0, checks: [], views: [], sourceHashes: startHashes };
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
async function playWineDemo(page, label, locale, hasProfile) {
  const copy = await page.evaluate(() => window.__wineChatCopy);
  const prompts = await page.evaluate(() => window.__wineChatPrompts);
  const chat = page.getByRole("log", { name: copy.log });
  const topics = [/(prefer|taste|gust)/i, /cordero|lamb|cordeiro|cocin|cook|cozin|prato/i, /16.18|temperatur/i, /solar/i, /Tesoro|Treasure|Tesouro/i];
  const waitForAnswer = async before => page.waitForFunction(expected => {
    const log = document.querySelector('[role="log"]');
    return log?.getAttribute('aria-busy') === 'false' && log.children.length === expected;
  }, before + 2);
  check(prompts.length === (hasProfile ? 5 : 3), `${label}: useful entries match the selected demo`);
  for (const [index, prompt] of prompts.entries()) {
    const before = await chat.locator(":scope > div").count();
    await page.getByTestId("sun-sommelier-prompts").getByRole("button", { name: prompt, exact: true }).click();
    await waitForAnswer(before);
    const answer = await chat.locator(":scope > div").last().innerText();
    check(answer.length > 90 && topics[index].test(answer), `${label}: prompt ${index + 1} gives useful guidance about its topic`);
    if (hasProfile) {
      const path = index < 3 ? "Ficha-Tecnica-PROFUNDO-2019.pdf" : index === 3 ? "Practicas-Sustentables-Formato-VVS-Aprobada_VS.pdf" : "/experiencias/";
      check(await chat.locator(":scope > div").last().locator(`a[href*="${path}"]`).count() === 1, `${label}: prompt ${index + 1} links its own producer source`);
      check(await page.getByTestId("sun-sommelier-follow-ups").getByRole("button").count() === 3, `${label}: three clear continuations after prompt ${index + 1}`);
      if (index === 1) {
        const dish = { "es-AR": "Cordero", en: "Lamb", "pt-BR": "Cordeiro" }[locale];
        const beforeReply = await chat.locator(":scope > div").count();
        await page.getByRole("textbox", { name: copy.placeholder, exact: true }).fill(dish);
        await page.getByRole("textbox", { name: copy.placeholder, exact: true }).press("Enter");
        await waitForAnswer(beforeReply);
        const reply = await chat.locator(":scope > div").last().innerText();
        check(reply.includes(dish) && /Profundo 2019/.test(reply), `${label}: brief dish reply continues the pairing conversation`);
        check(await chat.locator(":scope > div").last().locator('a[href*="Ficha-Tecnica-PROFUNDO-2019.pdf"]').count() === 1, `${label}: contextual pairing keeps its public source`);
      }
    }
  }
  if (hasProfile) {
    const before = await chat.locator(":scope > div").count();
    await page.getByRole("textbox", { name: copy.placeholder, exact: true }).fill("???");
    await page.getByRole("textbox", { name: copy.placeholder, exact: true }).press("Enter");
    await waitForAnswer(before);
    check((await chat.locator(":scope > div").last().innerText()).includes("?"), `${label}: an ambiguous question gives useful clarification`);
    check(await chat.locator(":scope > div").last().locator("a").count() === 0, `${label}: clarification does not invent a producer source`);
  }
  await page.screenshot({ path: join(output, `${label.replaceAll("/", "-")}-sommelier.png`), fullPage: true });
  await page.locator(".sun-engagement-tabs button").nth(1).click();
  const questions = await page.evaluate(() => window.__wineQuiz);
  const next = { "es-AR": "Siguiente pregunta", en: "Next question", "pt-BR": "Próxima pergunta" }[locale];
  const finish = { "es-AR": "Finalizar trivia", en: "Finish quiz", "pt-BR": "Finalizar quiz" }[locale];
  for (const [index, question] of questions.entries()) {
    await page.getByRole("heading", { name: question.prompt, exact: true }).waitFor();
    check(!/replay|CMAC|batch|CRM/i.test(question.prompt), `${label}: question ${index + 1} is about the wine`);
    const advance = page.getByRole("button", { name: index === questions.length - 1 ? finish : next, exact: true });
    check(await advance.isDisabled(), `${label}: unanswered question cannot advance`);
    await page.getByRole("button", { name: question.options[question.correctIndex], exact: true }).click();
    if (index === 0) {
      if (hasProfile) {
        const guide = page.getByTestId("valle-secreto-guide-link"), tabs = page.locator(".sun-engagement-tabs button");
        await guide.click();
        check(new URL(page.url()).hash === "#qr-engagement", `${label}: guide retains the native section destination`);
        check(await tabs.first().getAttribute("aria-pressed") === "true", `${label}: service opens Sommelier from Trivia`);
        await tabs.nth(1).click();
        await guide.focus();
        await guide.press("Enter");
        check(await tabs.first().getAttribute("aria-pressed") === "true", `${label}: Enter reopens Sommelier with the same hash`);
        await tabs.nth(1).click();
        await page.evaluate(() => { window.__guideEvents = 0; window.addEventListener("sun:demo-wine-guide", () => window.__guideEvents++); });
        for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) await guide.dispatchEvent("click", { button: 0, [modifier]: true });
        await guide.dispatchEvent("click", { button: 2 });
        check(await page.evaluate(() => window.__guideEvents) === 0, `${label}: modified clicks do not activate a local tool`);
        check(await tabs.nth(1).getAttribute("aria-pressed") === "true", `${label}: modified clicks preserve the current panel`);
      } else {
        await page.evaluate(() => window.dispatchEvent(new Event("sun:demo-wine-guide")));
        check(await page.locator(".sun-engagement-tabs button").nth(1).getAttribute("aria-pressed") === "true", `${label}: Valle navigation event is inert in the generic demo`);
      }
      check(await page.getByRole("button", { name: question.options[question.correctIndex], exact: true }).getAttribute("aria-pressed") === "true" && await advance.isEnabled(), `${label}: returning to Trivia preserves the selected answer`);
    }
    await advance.click();
  }
  const resultTitle = { "es-AR": "Lo que aprendiste", en: "What you learned", "pt-BR": "O que você aprendeu" }[locale];
  await page.getByRole("heading", { name: resultTitle, exact: true }).waitFor();
  const result = await page.locator(".sun-engagement-suite").innerText();
  check(/3.*3/.test(result), `${label}: three correct answers are reflected in the local result`);
  check(/no se otorgaron puntos ni premios|no points or prizes awarded|sem pontos nem prêmios/.test(result), `${label}: local education awards no points or prizes`);
  check(!/Tus respuestas ayudan|interés por ciudad|Market quiz|Insight para mejorar/.test(result), `${label}: demo does not claim to send brand research`);
  check(await page.locator('.sun-engagement-suite a[href^="/me"],.sun-engagement-suite a[href^="/login"]').count() === 0, `${label}: demo result does not pretend to save real rewards`);
  if (hasProfile) {
    const guide = page.getByTestId("valle-secreto-guide-link"), before = await page.evaluate(() => window.__guideEvents);
    // A native fragment jump moves the viewport. A coordinate double-click can hit a different control.
    // Two Enter activations address this same anchor and verify repeatability without suppressing native navigation.
    await guide.press("Enter");
    await guide.press("Enter");
    await page.waitForFunction(() => document.querySelector(".sun-engagement-tabs button")?.getAttribute("aria-pressed") === "true");
    check(await page.evaluate(() => window.__guideEvents) === before + 2, `${label}: both repeated activations target the guide`);
    check(await page.locator(".sun-engagement-tabs button").first().getAttribute("aria-pressed") === "true", `${label}: repeated guide activations select Sommelier`);
    await page.locator(".sun-engagement-tabs button").nth(1).click();
    check(await page.getByRole("heading", { name: resultTitle, exact: true }).isVisible(), `${label}: the completed quiz result survives guide navigation`);
  }
}
async function playTreasure(page, label) {
  await page.getByTestId("wine-treasure-start").click();
  for (const index of [0, 1, 2]) {
    const options = page.getByTestId("wine-treasure-option"), next = page.getByTestId("wine-treasure-next");
    check(await next.isDisabled(), `${label}: clue ${index + 1} requires a choice`);
    await options.nth((index + 1) % 3).click();
    check(await next.isDisabled(), `${label}: a wrong clue does not advance the game`);
    check((await page.locator('#valle-secreto-treasure [role="status"]').innerText()).length > 20, `${label}: wrong clue gives a recovery instruction`);
    await options.nth(index).click();
    check(await options.nth(index).getAttribute("aria-pressed") === "true", `${label}: correct clue selection is accessible`);
    check(await next.isEnabled(), `${label}: correct clue can advance`);
    await next.click();
  }
  check(await page.locator('#valle-secreto-treasure [data-complete="true"]').count() === 3, `${label}: three completed clue markers`);
  await page.getByTestId("wine-treasure-restart").waitFor();
  check(await page.locator('#valle-secreto-place a[href*="google.com/maps/search/?api=1"]').count() === 1, `${label}: public-address map link is available without GPS`);
  await page.getByTestId("wine-treasure-restart").click();
  check(await page.getByTestId("wine-treasure-next").isDisabled(), `${label}: restart clears the previous choice`);
}
try {
  for (const profile of ["valle-secreto", "generic"]) for (const width of [320, 390, 430, 692]) for (const theme of ["light", "dark"]) for (const locale of (profile === "generic" ? ["es-AR"] : ["es-AR", "en", "pt-BR"])) {
    const label = `${profile}/${width}/${theme}/${locale}`;
    if (process.env.QA_ONLY && process.env.QA_ONLY !== label) continue;
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.addInitScript(({ theme, locale }) => {
      document.addEventListener("DOMContentLoaded", () => { document.documentElement.dataset.theme = theme; document.documentElement.lang = locale; }, { once: true });
      window.__gpsCalls = 0;
      Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() { window.__gpsCalls++; } } });
    }, { theme, locale });
    await page.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { report.externalRequests.push(url.hostname); return route.abort(); }
      if (profile === "valle-secreto" && url.pathname === "/api/sommelier/demo/session" && request.method() === "POST" && !url.search) {
        const body = request.postDataJSON();
        check(body && Object.keys(body).sort().join(",") === "locale,profile" && body.profile === "valle-secreto" && body.locale === locale, `${label}: the mock session receives only the explicit demo profile and locale`);
        report.managedDemoRequests.push({ view: label, path: url.pathname, method: request.method(), profile: body.profile, locale: body.locale, mocked: true, status: 503 });
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "sommelier_unavailable" }) });
      }
      if (url.pathname.startsWith("/api/") || request.method() !== "GET") { report.apiRequests.push({ path: url.pathname, method: request.method() }); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/?locale=${locale}&profile=${profile}`, { waitUntil: "networkidle" });
    check(report.managedDemoRequests.filter(request => request.view === label).length === 0, `${label}: opening a demo does not automatically send a question or initialize an AI session`);
    const cards = await page.locator('.sun-services-card [role="listitem"]').evaluateAll(elements => elements.map(el => {
      const r = el.getBoundingClientRect(), text = el.querySelector("strong").getBoundingClientRect(), badge = el.querySelector('[class*="selectedBadge"]')?.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, textWidth: text.width, textBottom: text.bottom, badgeY: badge?.y, display: getComputedStyle(el).display };
    }));
    if (profile === "generic") {
      check(cards.length === 3, `${label}: three illustrative options`);
      check(cards.every(card => card.display === "grid" && Math.abs(card.x - cards[0].x) < 1 && card.width > 250), `${label}: full-width rows, including narrow passport on a wide viewport`);
      check(cards.every(card => card.textWidth >= 140 && card.height < 220), `${label}: readable text column without vertical card sprawl`);
      check(cards[1].badgeY >= cards[1].textBottom, `${label}: selected badge stays below the title`);
      check(await page.locator('[data-demo-selected-intent="benefit"]').count() === 1, `${label}: chosen option remains highlighted`);
      check(await page.locator('[role="list"] a,[role="list"] button').count() === 0, `${label}: illustrative services remain read-only`);
    } else {
      check(await page.getByTestId("valle-secreto-services").locator("a").count() === 3, `${label}: three clear brand experience destinations`);
      await playTreasure(page, label);
    }
    await playWineDemo(page, label, locale, profile === "valle-secreto");
    const smallTargets = await page.locator('main button,main a').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.getBoundingClientRect().height < 44).map(el => ({ text: el.textContent, height: el.getBoundingClientRect().height })));
    check(smallTargets.length === 0, `${label}: engagement touch targets remain at least 44px ${JSON.stringify(smallTargets)}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
    await page.addScriptTag({ content: axe });
    const accessibility = await page.evaluate(async () => { const result = await axe.run("main", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }); return { violations: result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary, checks: n.any.map(check => ({ id: check.id, data: check.data })) })) })), incomplete: result.incomplete.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })) }; });
    report.views.push({ profile, width, theme, locale, cards, ...accessibility });
    await page.screenshot({ path: join(output, `${profile}-${width}-${theme}-${locale}.png`), fullPage: true });
    check(accessibility.violations.length === 0, `${label}: zero axe violations`);
    report.geolocationCalls += await page.evaluate(() => window.__gpsCalls);
    await context.close();
  }
  check(report.apiRequests.length === 0 && report.externalRequests.length === 0, "zero unexpected API, external or business operations; demo session responses are local disabled mocks");
  check(report.views.length === (process.env.QA_ONLY ? 1 : 32), "all requested views executed");
  check(report.geolocationCalls === 0 && report.errors.length === 0, "zero GPS calls or browser exceptions");
  report.endSourceHashes = await hashes();
  check(JSON.stringify(report.sourceHashes) === JSON.stringify(report.endSourceHashes), "source unchanged throughout the layout audit");
  report.status = "passed";
} finally {
  if (!report.status) report.status = "failed";
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(r => server.close(r));
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, views: report.views.length, output }));
