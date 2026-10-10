// Actual contact-security presentation and styles, with synthetic local accounts.
// No backend/provider, contact linking, OTP, GPS or customer data is used.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const web = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.env.QA_OUTPUT || "artifacts/consumer-contact-security");
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || "C:/Users/guill/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs").href);
const [panelCss, portalCss] = await Promise.all([
  readFile(new URL("../src/app/me/security/security-panel.module.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/me/_components/portal-shell.module.css", import.meta.url), "utf8"),
]);
const themeCss = portalCss.replace(/:global\(([^)]+)\)/g, "$1");
const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{SecurityPanel}from'./src/app/me/security/security-panel';const params=new URLSearchParams(location.search),mode=params.get('mode');document.documentElement.dataset.theme=params.get('theme');const email='very-long-synthetic-account-contact-to-check-wrapping@example.invalid',phone='+541155551234';const consumer={id:'synthetic-consumer',...(mode!=='phone'?{email}:{}),...(mode!=='email'?{phone}:{})};createRoot(document.getElementById('app')).render(<main className='portal' style={{padding:'16px',boxSizing:'border-box'}}><h1>Seguridad y contactos</h1><SecurityPanel initialConsumer={consumer}/></main>);`;
const bundle = await build({ stdin: { contents: fixture, resolveDir: web, loader: "tsx" }, bundle: true, write: false, format: "esm", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env": "{}", "process.browser": "true" }, plugins: [{ name: "panel-css", setup(builder) { builder.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: "export default new Proxy({}, {get:(_,key)=>String(key)});", loader: "js" })); } }], logLevel: "error" });
const server = createServer((request, response) => {
  if (request.method !== "GET") { response.writeHead(405); return response.end(); }
  if (request.url === "/fixture.js") { response.setHeader("content-type", "text/javascript"); return response.end(bundle.outputFiles[0].contents); }
  if (request.url === "/favicon.ico") { response.writeHead(204); return response.end(); }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang='es-AR'><head><meta name='viewport' content='width=device-width,initial-scale=1'><title>Ensayo local de seguridad</title><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui}${themeCss}${panelCss}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined) });
const report = { localOnly: true, syntheticAccounts: true, actualPanelAndCss: true, views: [], checks: [], apiRequests: [], externalRequests: [], exceptions: [] };
const check = (passed, label) => { report.checks.push({ label, passed: Boolean(passed) }); assert.ok(passed, label); };
try {
  for (const width of [320, 390, 768, 1280]) for (const theme of ["light", "dark"]) for (const mode of ["email", "phone", "both"]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, locale: "es-AR", serviceWorkers: "block" });
    const page = await context.newPage();
    page.on("pageerror", error => report.exceptions.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { report.externalRequests.push({ origin: url.origin }); return route.abort(); }
      if (url.pathname.startsWith("/api/") || request.method() !== "GET") { report.apiRequests.push({ method: request.method(), path: url.pathname }); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/security?theme=${theme}&mode=${mode}`);
    await page.getByRole("heading", { name: "Contactos de esta cuenta", exact: true }).waitFor();
    const label = `${width} ${theme} ${mode}`;
    check(await page.locator("[data-contact-linking-state='feature_disabled']").count() === 1, `${label}: unavailable status is visible`);
    check(await page.locator("input,button,form").count() === 0, `${label}: no unavailable verification controls`);
    check(await page.locator("dl dd").count() === (mode === "both" ? 2 : 1), `${label}: only existing contacts displayed`);
    const text = await page.locator("body").innerText();
    check(text.includes("temporalmente deshabilitada") && text.includes("usá el mismo contacto con el que los guardaste") && !text.includes("Revisá el formato"), `${label}: honest recovery copy`);
    const layout = await page.evaluate(() => {
      const main = document.querySelector("main"), link = document.querySelector("a[href='/me']");
      const rect = link.getBoundingClientRect();
      const luminance = color => { const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
      const samples = [...document.querySelectorAll(".card p,.contacts dd,.status,.availability > p,.back")].map(node => {
        const style = getComputedStyle(node);
        let background = style.backgroundColor, parent = node;
        while (background === "rgba(0, 0, 0, 0)" && parent.parentElement) { parent = parent.parentElement; background = getComputedStyle(parent).backgroundColor; }
        const text = luminance(style.color), fill = luminance(background);
        return (Math.max(text, fill) + .05) / (Math.min(text, fill) + .05);
      });
      return { pageOverflow: document.documentElement.scrollWidth > innerWidth, panelOverflow: main.scrollWidth > main.clientWidth, targetHeight: rect.height, contrastMinimum: Math.min(...samples) };
    });
    check(!layout.pageOverflow && !layout.panelOverflow, `${label}: no horizontal overflow with long contact`);
    check(layout.targetHeight >= 44 && layout.contrastMinimum >= 4.5, `${label}: readable contrast and touch target`);
    await page.keyboard.press("Tab");
    check(await page.getByRole("link", { name: "Volver a mi cuenta", exact: true }).evaluate(node => node === document.activeElement && getComputedStyle(node).outlineStyle !== "none"), `${label}: keyboard reaches visible focus`);
    check(await page.getByRole("link", { name: "Volver a mi cuenta", exact: true }).getAttribute("href") === "/me", `${label}: back returns to current account`);
    report.views.push({ width, theme, mode, ...layout });
    if (width === 390 && mode === "both") await page.screenshot({ path: resolve(output, `security-${theme}.png`), fullPage: true });
    await context.close();
  }
  check(report.apiRequests.length === 0 && report.externalRequests.length === 0 && report.exceptions.length === 0, "No requests to association/provider or browser exceptions");
} finally {
  await browser.close(); await new Promise(done => server.close(done));
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
}
console.log(JSON.stringify({ views: report.views.length, checks: report.checks.length, passed: report.checks.filter(item => item.passed).length, apiRequests: report.apiRequests.length, externalRequests: report.externalRequests.length, exceptions: report.exceptions.length }));
