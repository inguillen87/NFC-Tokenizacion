// Production React/CSS with local synthetic account projections. No real
// customer session, API, provider, OTP, storage or physical NFC acceptance.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const root = fileURLToPath(new URL("../../../", import.meta.url)), web = join(root, "apps/web");
const output = resolve(process.env.QA_OUTPUT || join(root, "artifacts/consumer-home-contact"));
await mkdir(output, { recursive: true });
const sources = ["apps/web/src/app/me/_components/consumer-home-model.ts", "apps/web/src/app/me/_components/me-portal-interactive-client.tsx", "apps/web/src/app/me/_components/consumer-home.module.css", "apps/web/src/app/globals.css", "apps/web/tests/consumer-home-contact.browser.mjs"];
const hashes = async () => Object.fromEntries(await Promise.all(sources.map(async path => [path, createHash("sha256").update(await readFile(join(root, path))).digest("hex")])));
const report = { localOnly: true, productionReactAndCss: true, actualNextAndBff: false, authenticatedCustomerAccepted: false, sourceHashesStart: await hashes(), views: [], checks: [], apiRequests: [], externalRequests: [], exceptions: [] };
const check = (passed, label) => { report.checks.push({ passed: Boolean(passed), label }); assert.ok(passed, label); };
const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{MePortalInteractiveClient}from'./src/app/me/_components/me-portal-interactive-client';import{buildConsumerHomeModel}from'./src/app/me/_components/consumer-home-model';const params=new URLSearchParams(location.search),list={ok:true,items:[]};const phone='+541155551234',email='a-very-long-synthetic-account-contact-to-check-wrapping@example.invalid';window.__refreshes=0;const account=mode=>mode==='unavailable'?null:{ok:true,consumer:{status:mode==='unknown'?'unrecognized-status':'registered',...(mode==='email'||mode==='both'?{email}:{}),...(mode==='whatsapp'||mode==='both'?{phone,display_name:phone}:{})},stats:{products:0,taps:0}};function Fixture(){const[mode,setMode]=React.useState(params.get('mode'));React.useEffect(()=>{const refresh=()=>setMode('whatsapp');addEventListener('qa-refresh',refresh);return()=>removeEventListener('qa-refresh',refresh)},[]);return <main><h1>Mi espacio</h1><MePortalInteractiveClient model={buildConsumerHomeModel({account:account(mode),products:list,taps:list,brands:list})}/></main>}createRoot(document.getElementById('app')).render(<Fixture/>);`;
const shim = `import React from 'react';export const useRouter=()=>({refresh(){window.__refreshes++;dispatchEvent(new Event('qa-refresh'));}});export default React.forwardRef(function Link({prefetch,...props},ref){return <a {...props} ref={ref}/>});`;
const bundle = await build({ stdin: { contents: fixture, resolveDir: web, loader: "tsx" }, bundle: true, write: false, outdir: join(output, "bundle"), format: "iife", jsx: "automatic", loader: { ".module.css": "local-css" }, define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "synthetic-next", setup(builder) {
  builder.onResolve({ filter: /^next\/(link|navigation)$/ }, () => ({ path: "next", namespace: "fixture" }));
  builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: shim, loader: "tsx", resolveDir: web }));
  builder.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "fixture-image" }));
  builder.onLoad({ filter: /.*/, namespace: "fixture-image" }, () => ({ contents: "import React from 'react';export default function Image({unoptimized,sizes,...props}){return <img {...props}/>}", loader: "tsx", resolveDir: web }));
} }], logLevel: "silent" });
const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).contents;
const css = bundle.outputFiles.find(file => file.path.endsWith(".css")).contents;
const globals = (await postcss([tailwindcss({ base: web })]).process(await readFile(join(web, "src/app/globals.css"), "utf8"), { from: join(web, "src/app/globals.css") })).css;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://fixture.invalid");
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  if (url.pathname === "/fixture.js") { res.setHeader("content-type", "text/javascript"); return res.end(js); }
  if (url.pathname === "/fixture.css") { res.setHeader("content-type", "text/css"); return res.end(css); }
  if (url.pathname === "/base.css") { res.setHeader("content-type", "text/css"); return res.end(globals); }
  if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
  const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
  res.setHeader("content-type", "text/html;charset=utf-8");
  res.end(`<!doctype html><html lang="es-AR" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contacto local</title><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0}main{max-width:1220px;margin:auto;padding:20px}h1{font-size:24px}</style></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>`);
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_MODULE_PATH, "utf8");
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  for (const width of [320, 390, 768, 1280]) for (const theme of ["light", "dark"]) for (const mode of ["whatsapp", "email", "both", "unknown", "unavailable"]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
    try {
      const page = await context.newPage(); page.on("pageerror", () => report.exceptions.push("pageerror"));
      page.on("console", message => { if (message.type() === "error") report.exceptions.push("console_error"); });
      await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) { report.externalRequests.push(url.origin); return route.abort(); }
        if (url.pathname.startsWith("/api/") || route.request().method() !== "GET") { report.apiRequests.push(url.pathname); return route.abort(); }
        return route.continue();
      });
      await page.goto(`${origin}/?theme=${theme}&mode=${mode}`, { waitUntil: "networkidle" });
      const panel = page.locator('section[aria-labelledby="home-account-title"]'); await panel.waitFor();
      const label = `${width}/${theme}/${mode}`;
      const text = await panel.innerText();
      if (mode === "whatsapp" || mode === "both") {
        check(await panel.locator("dt").filter({ hasText: "WhatsApp" }).count() === 1 && text.includes("+541155551234"), `${label}: reported phone shown once`);
        check(!text.includes("Correo no informado") && !text.includes("registered") && text.includes("Cuenta registrada"), `${label}: WhatsApp identity has readable state`);
        check(await page.getByRole("heading", { name: "Tu cuenta", exact: true }).count() === 2, `${label}: contact is not repeated in greeting`);
      }
      if (mode === "email" || mode === "both") check(await panel.locator("dt").filter({ hasText: "Correo electrónico" }).count() === 1, `${label}: reported email shown once`);
      if (mode === "unknown") check(text.includes("Contacto no informado") && text.includes("Estado de la cuenta no informado") && !text.includes("unrecognized-status"), `${label}: unknown fields are not invented`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
      await page.addScriptTag({ content: axe });
      const violations = await page.evaluate(async () => (await axe.run('[data-testid="consumer-home"]', { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })));
      report.views.push({ width, theme, mode, violations }); check(violations.length === 0, `${label}: zero axe violations`);
      for (const link of await panel.getByRole("link").all()) check(await link.getAttribute("href") !== "/login", `${label}: account actions retain their normal protected destinations`);
      if (mode === "unavailable") {
        const retry = page.getByRole("button", { name: "Reintentar carga", exact: true }); await retry.focus();
        await page.keyboard.press("Enter"); await panel.getByText("+541155551234", { exact: true }).waitFor();
        check(await page.evaluate(() => window.__refreshes) === 1 && !(await panel.innerText()).includes("No se pudieron cargar"), `${label}: one manual retry recovers the reported WhatsApp account`);
      }
      if (width === 390 && ["whatsapp", "both"].includes(mode)) await page.screenshot({ path: join(output, `home-${mode}-${theme}.png`), fullPage: true });
    } finally { await context.close(); }
  }
  check(!report.apiRequests.length && !report.externalRequests.length && !report.exceptions.length, "No provider/API requests or browser exceptions");
  report.sourceHashesEnd = await hashes(); check(JSON.stringify(report.sourceHashesStart) === JSON.stringify(report.sourceHashesEnd), "Source remained stable throughout the run");
} finally {
  if (browser) await browser.close(); await new Promise(done => server.close(done));
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
}
console.log(JSON.stringify({ views: report.views.length, checks: report.checks.length, passed: report.checks.filter(item => item.passed).length, apiRequests: report.apiRequests.length, externalRequests: report.externalRequests.length, exceptions: report.exceptions.length }));
