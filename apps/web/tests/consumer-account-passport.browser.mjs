// Local presentation QA uses the actual account model, panels, retry control
// and portal theme tokens. Accounts are synthetic; no API/provider is called.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const web = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.env.QA_OUTPUT || "artifacts/consumer-account-passport");
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || "C:/Users/guill/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs").href);
const [panelCss, portalCss] = await Promise.all([
  readFile(new URL("../src/app/me/passport/passport.module.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/me/_components/portal-shell.module.css", import.meta.url), "utf8"),
]);
const themeCss = portalCss.replace(/:global\(([^)]+)\)/g, "$1");
const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{PassportAccountPanel,PassportAccountUnavailable}from'./src/app/me/passport/passport-account-panel';import{passportAccountModel}from'./src/app/me/passport/passport-account-model';const params=new URLSearchParams(location.search),mode=params.get('mode');document.documentElement.dataset.theme=params.get('theme');window.__refreshCount=0;const email='very-long-synthetic-account-contact-to-check-wrapping@example.invalid',phone='+541155551234';const data=(selected)=>selected==='unavailable'?null:{ok:true,consumer:{id:'synthetic-consumer',status:selected==='unknown'?'new-status':'registered',...(selected==='both'?{display_name:'Una persona de ejemplo con un nombre extenso para comprobar la lectura'}:{}),...(selected==='email'||selected==='both'?{email}:{}),...(selected==='phone'||selected==='both'?{phone}:{})},stats:selected==='unknown'?null:{products:0,taps:4,memberships:2}};function Fixture(){const[account,setAccount]=React.useState(()=>passportAccountModel(data(mode)));React.useEffect(()=>{const refresh=()=>setAccount(passportAccountModel(data('both')));addEventListener('qa:refresh',refresh);return()=>removeEventListener('qa:refresh',refresh)},[]);return <div className='portal'><main className='main'><div className='pageHeading'><h1>Mi cuenta y mis registros</h1><p>Tus contactos, tus productos y tu relación con las marcas, en un solo lugar.</p></div>{account.state==='ready'?<PassportAccountPanel account={account} tenant='valle-secreto'/>:<PassportAccountUnavailable/>}</main></div>}createRoot(document.getElementById('app')).render(<Fixture/>);`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: web, loader: "tsx" }, bundle: true, write: false, format: "esm", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}", "process.browser": "true" },
  plugins: [{ name: "local-presentation", setup(builder) {
    builder.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: "export default new Proxy({}, {get:(_,key)=>String(key)});", loader: "js" }));
    builder.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: "fixture-next" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture-next" }, args => args.path === "next/link"
      ? { contents: "import React from 'react';export default function Link({prefetch,...props}){return React.createElement('a',props)}", loader: "js", resolveDir: web }
      : { contents: "export function useRouter(){return{refresh(){window.__refreshCount++;window.dispatchEvent(new Event('qa:refresh'))}}}", loader: "js" });
  } }], logLevel: "error",
});
const server = createServer((request, response) => {
  if (request.method !== "GET") { response.writeHead(405); return response.end(); }
  if (request.url === "/fixture.js") { response.setHeader("content-type", "text/javascript"); return response.end(bundle.outputFiles[0].contents); }
  if (request.url === "/favicon.ico") { response.writeHead(204); return response.end(); }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang='es-AR'><head><meta name='viewport' content='width=device-width,initial-scale=1'><title>Ensayo local de cuenta</title><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui}${themeCss}${panelCss}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined) });
const report = { localOnly: true, syntheticAccounts: true, actualModelPanelsRetryAndCss: true, nextRouterAndLinkStubbed: true, liveApiNotTested: true, views: [], checks: [], apiRequests: [], externalRequests: [], exceptions: [] };
const check = (passed, label) => { report.checks.push({ label, passed: Boolean(passed) }); assert.ok(passed, label); };
try {
  for (const width of [320, 390, 768, 1280]) for (const theme of ["light", "dark"]) for (const mode of ["email", "phone", "both", "unknown", "unavailable"]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, locale: "es-AR", serviceWorkers: "block", reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", error => report.exceptions.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { report.externalRequests.push({ origin: url.origin }); return route.abort(); }
      if (url.pathname.startsWith("/api/") || request.method() !== "GET") { report.apiRequests.push({ method: request.method(), path: url.pathname }); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/passport?theme=${theme}&mode=${mode}`);
    await page.getByRole("heading", { name: "Mi cuenta y mis registros", exact: true }).waitFor();
    if (mode === "unavailable") await page.getByRole("button", { name: "Reintentar carga", exact: true }).waitFor();
    else await page.locator("[data-account-state]").waitFor();
    const label = `${width} ${theme} ${mode}`;
    const text = await page.locator("body").innerText();
    check(!/Cuenta inicial|email no validado|PENDING|DOCUMENTO DE IDENTIDAD|NFT|Premium|ownership|Memberships/.test(text), `${label}: no invented account or premium claims`);
    check(await page.locator("input,form").count() === 0, `${label}: no association, purchase or contact form`);
    check(await page.evaluate(() => window.__refreshCount) === 0, `${label}: no automatic retry`);
    if (mode === "unavailable") {
      check(text.includes("No pudimos cargar los datos de tu cuenta") && text.includes("Tus productos y contactos no se modificaron") && !text.includes("Productos guardados: 0"), `${label}: failure is recoverable, not an empty account`);
      check(await page.getByRole("status").count() === 1 && await page.locator("[data-account-state],dl").count() === 0, `${label}: no account status fabricated after failure`);
    } else {
      check(await page.locator("dl dd").count() === (mode === "both" ? 3 : mode === "unknown" ? 1 : 2), `${label}: contacts plus account status match the current projection`);
      check(await page.locator("[data-account-state]").getAttribute("data-account-state") === (mode === "unknown" ? "unknown" : "registered"), `${label}: account status uses the deployed field`);
      check(mode === "unknown" ? text.includes("Productos guardados: no informado") && text.includes("Lecturas guardadas: no informado") : text.includes("Productos guardados: 0") && text.includes("Lecturas guardadas: 4"), `${label}: unknown counts differ from real zero`);
      check(await page.getByRole("link", { name: "Mis puntos y registros", exact: true }).getAttribute("href") === "/me/wallet?tenant=valle-secreto" && await page.getByRole("link", { name: "Explorar catálogo", exact: true }).getAttribute("href") === "/me/marketplace?tenant=valle-secreto", `${label}: wallet and catalog retain the canonical tenant`);
      check(await page.getByRole("link", { name: "Ver mis beneficios", exact: true }).getAttribute("href") === "/me/rewards?tenant=valle-secreto" && await page.getByRole("link", { name: "Revisar contactos", exact: true }).getAttribute("href") === "/me/security", `${label}: benefits and contact consultation paths are explicit`);
    }
    const layout = await page.evaluate(() => {
      const main = document.querySelector("main");
      const luminance = color => { const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
      const samples = [...document.querySelectorAll("h1,h2,.pageHeading p,.eyebrow,.contacts dt,.contacts dd,.note,.destinationCopy strong,.destinationCopy span,.destinationCopy small,.benefits p,.textLink,.recovery p,.recovery button")].map(node => {
        const style = getComputedStyle(node);
        let background = style.backgroundColor, parent = node;
        while (background === "rgba(0, 0, 0, 0)" && parent.parentElement) { parent = parent.parentElement; background = getComputedStyle(parent).backgroundColor; }
        const text = luminance(style.color), fill = luminance(background);
        return (Math.max(text, fill) + .05) / (Math.min(text, fill) + .05);
      });
      const targetHeights = [...document.querySelectorAll("a,button")].map(node => node.getBoundingClientRect().height);
      return { pageOverflow: document.documentElement.scrollWidth > innerWidth, panelOverflow: main.scrollWidth > main.clientWidth, minimumTargetHeight: Math.min(...targetHeights), contrastMinimum: Math.min(...samples) };
    });
    check(!layout.pageOverflow && !layout.panelOverflow, `${label}: no horizontal overflow with long name or contact`);
    check(layout.minimumTargetHeight >= 44, `${label}: all account actions have a 44px touch target`);
    check(layout.contrastMinimum >= 4.5, `${label}: normal text meets contrast in ${theme}`);
    const controls = await page.locator("a,button").count();
    for (let index = 0; index < controls; index++) {
      await page.keyboard.press("Tab");
      check(await page.locator("a,button").nth(index).evaluate(node => node === document.activeElement && getComputedStyle(node).outlineStyle !== "none"), `${label}: control ${index + 1} has ordered visible keyboard focus`);
    }
    if (width === 390 && (mode === "both" || mode === "unavailable")) await page.screenshot({ path: resolve(output, `passport-${mode}-${theme}.png`), fullPage: true });
    if (mode === "unavailable") {
      await page.getByRole("button", { name: "Reintentar carga", exact: true }).click();
      await page.locator("[data-account-state='registered']").waitFor();
      check(await page.evaluate(() => window.__refreshCount) === 1 && await page.getByRole("status").count() === 0 && await page.locator("dl dd").count() === 3, `${label}: one user retry refreshes the account consultation`);
    }
    report.views.push({ width, theme, mode, ...layout });
    await context.close();
  }
  check(report.apiRequests.length === 0 && report.externalRequests.length === 0 && report.exceptions.length === 0, "No API/provider writes, external requests or browser exceptions");
} finally {
  await browser.close(); await new Promise(done => server.close(done));
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
}
console.log(JSON.stringify({ views: report.views.length, checks: report.checks.length, passed: report.checks.filter(item => item.passed).length, apiRequests: report.apiRequests.length, externalRequests: report.externalRequests.length, exceptions: report.exceptions.length }));
