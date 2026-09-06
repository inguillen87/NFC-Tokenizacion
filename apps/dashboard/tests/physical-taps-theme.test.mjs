import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const componentPath = new URL("../src/components/physical-taps-command-center.tsx", import.meta.url);
const source = await readFile(componentPath, "utf8");
const moduleCss = await readFile(new URL("../src/components/physical-taps-command-center.module.css", import.meta.url), "utf8");

function contrast(a, b) {
  const luminance = (hex) => {
    const channels = hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255)
      .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + .05) / (low + .05);
}

test("physical TAP surfaces own their theme without relying on global dark utility overrides", () => {
  assert.match(source, /import styles from "\.\/physical-taps-command-center\.module\.css"/);
  assert.equal((source.match(/styles\.workspace/g) || []).length, 2);
  assert.doesNotMatch(source, /text-white|text-slate-\d|bg-slate-\d|bg-\[radial-gradient/);
  assert.match(moduleCss, /:global\(html\.theme-light\) \.workspace/);
  assert.match(moduleCss, /:global\(html\[data-theme="light"\]\) \.workspace/);
  assert.match(moduleCss, /prefers-reduced-motion/);
  assert.match(moduleCss, /:focus-visible/);
  const themes = [...moduleCss.matchAll(/--taps-text: #[a-f\d]+;[\s\S]+?--taps-base: #[a-f\d]+;/g)];
  assert.equal(themes.length, 2);
  for (const [index, match] of themes.entries()) {
    const tokens = Object.fromEntries([...match[0].matchAll(/--taps-([\w-]+): (#[a-f\d]+);/g)].map((entry) => [entry[1], entry[2]]));
    for (const [foreground, background] of [
      ["text", "surface"], ["muted", "surface"], ["muted", "base"],
      ["accent", "accent-bg"], ["success", "success-bg"], ["warning", "warning-bg"],
      ["violet", "violet-bg"], ["on-accent", "accent"],
    ]) assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5, `theme ${index}: ${foreground} / ${background}`);
  }
});

test("evidence dates and live claims remain explicit without adding polling or new reads", () => {
  assert.match(source, /Última confirmación: \{absoluteDate\(liveResult\.checkedAt\)\}/);
  assert.match(source, /payload\.summary\.latestAt \? absoluteDate\(payload\.summary\.latestAt\)/);
  assert.match(source, /syncState === "live" && realtime\.status === "connected" \? "Canal en vivo"/);
  assert.match(source, /Consultando evidencia…/);
  assert.match(source, /Último intento de consulta:/);
  assert.match(source, /Tu cuenta no tiene acceso a estos TAP/);
  assert.equal((source.match(/\bfetch\(/g) || []).length, 1);
  assert.doesNotMatch(source, /setInterval|new EventSource|relativeDate\(/);
});

test("physical TAP browser QA checks themes, filters, pending state and retained evidence locally", {
  skip: !process.env.NEXID_TEST_PLAYWRIGHT_MODULE || !process.env.NEXID_TEST_CHROMIUM
    ? "Set the installed Playwright module and Chromium paths for offline browser QA." : false,
  timeout: 60_000,
}, async () => {
  const { build } = await import("esbuild");
  const { default: postcss } = await import("postcss");
  const { default: tailwindcss } = await import("tailwindcss");
  const { chromium } = await import(process.env.NEXID_TEST_PLAYWRIGHT_MODULE);
  const components = fileURLToPath(new URL("../src/components/", import.meta.url));
  const fixture = `
    import React from 'react';import{createRoot}from'react-dom/client';
    import{PhysicalTapsCommandCenter}from'./physical-taps-command-center';
    const params=new URLSearchParams(location.search);
    const rows=['closed','opened'].map((sealState,index)=>({eventId:'fixture-'+index,tenantSlug:'fixture-tenant',bid:'LOT-FIXTURE',productName:'Producto de prueba local',uidMasked:'TEST****0'+index,messageValid:true,sealState,reportedState:sealState==='closed'?'VALID_CLOSED':'VALID_OPENED',readCounter:2+index,occurredAt:{utc:'2026-09-05T12:00:00Z',timezone:'America/Argentina/Buenos_Aires'},location:{city:'Zona de prueba',region:'',country:'',lat:null,lng:null,source:'none',precision:'none'},evidence:{kind:'physical_nfc_tt_evidenced',ttStatusReported:true}}));
    const result=params.get('availability')==='forbidden'?{availability:'forbidden',payload:null,detail:'HTTP_403',checkedAt:'2026-09-05T12:05:00Z'}:{availability:'ready',detail:'offline fixture only',checkedAt:'2026-09-05T12:05:00Z',payload:{scope:{tenant:'fixture-tenant',range:'24h',bid:'all',source:'real'},summary:{total:2,closed:1,opened:1,distinctUnits:2,latestAt:'2026-09-05T12:00:00Z'},rows}};
    createRoot(document.getElementById('root')).render(<PhysicalTapsCommandCenter result={result} tenantSlug="fixture-tenant" tenantDisplayName="Empresa de prueba local"/>);
  `;
  const stubs = {
    "next/link": "import React from'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}",
    "@product/ui/premium-vector-map": "export function PremiumVectorMap(){return null}",
    "./secure-dashboard-logout-button": "import React from'react';export function SecureDashboardLogoutButton({label,testId,className}){return <button className={className} data-testid={testId}>{label}</button>}",
    "./dashboard-realtime-provider": "const value={status:'connected',snapshot:null,events:[],warning:null,activeScope:{window:'24h'},activeScopeKey:'fixture',droppedThroughSequence:0};export function useDashboardRealtime(){return value}",
  };
  const bundle = await build({
    stdin: { contents: fixture, loader: "tsx", resolveDir: components },
    bundle: true, write: false, outfile: "fixture.js", format: "iife", platform: "browser", jsx: "automatic", logLevel: "silent",
    plugins: [{ name: "physical-taps-offline-boundaries", setup(builder) {
      builder.onResolve({ filter: /^(next\/link|@product\/ui\/premium-vector-map|\.\/secure-dashboard-logout-button|\.\/dashboard-realtime-provider)$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: stubs[args.path], loader: "tsx", resolveDir: components }));
    } }],
  });
  const globalCss = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const css = (await postcss([tailwindcss({ content: [{ raw: source, extension: "tsx" }], theme: { extend: {} }, plugins: [] })]).process(globalCss, { from: undefined })).css
    + bundle.outputFiles.find((file) => file.path.endsWith(".css")).text
    + "body{font-family:system-ui;margin:0;padding:16px}*{box-sizing:border-box}";
  const js = bundle.outputFiles.find((file) => file.path.endsWith(".js")).contents;
  const server = createServer((req, res) => {
    if (req.url === "/fixture.js") { res.setHeader("content-type", "text/javascript"); res.end(js); return; }
    const theme = new URL(req.url, "http://fixture.invalid").searchParams.get("theme") === "dark" ? "dark" : "light";
    res.setHeader("content-type", "text/html;charset=utf-8");
    res.end(`<!doctype html><html class="theme-${theme}" data-theme="${theme}"><head><meta name="viewport" content="width=device-width"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXID_TEST_CHROMIUM });
  try {
    for (const theme of ["light", "dark"]) for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [];
      let requests = 0;
      let finishRefresh;
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.startsWith("/api/admin/")) {
          requests += 1;
          await new Promise((resolve) => { finishRefresh = resolve; });
          return route.fulfill({ status: 503, json: { ok: false } });
        }
        return route.continue();
      });
      await page.goto(`${origin}/?theme=${theme}`);
      const workspace = page.getByTestId("physical-taps-command-center");
      await workspace.waitFor();
      assert.equal(await page.getByTestId("physical-taps-event-row").count(), 2);
      assert.equal(requests, 0, "rendering and waiting for stream must not poll");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.match(await page.getByTestId("physical-taps-last-evidence").textContent(), /Última confirmación/);
      const rendered = await workspace.evaluate((element) => {
        const heading = getComputedStyle(element.querySelector("h2"));
        const panel = getComputedStyle(element);
        return { heading: heading.color, base: panel.backgroundColor };
      });
      assert.equal(rendered.heading, theme === "light" ? "rgb(22, 48, 73)" : "rgb(241, 247, 255)");
      assert.equal(rendered.base, theme === "light" ? "rgb(241, 248, 251)" : "rgb(10, 24, 41)");
      if (process.env.NEXID_PHYSICAL_TAPS_QA_SCREENSHOTS) {
        await mkdir(process.env.NEXID_PHYSICAL_TAPS_QA_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: join(process.env.NEXID_PHYSICAL_TAPS_QA_SCREENSHOTS, `physical-taps-${width}-${theme}.png`), fullPage: true });
      }
      await page.getByLabel("Filtrar TAP por estado").selectOption("closed");
      assert.equal(await page.getByTestId("physical-taps-event-row").count(), 1);
      assert.equal(requests, 0, "filters operate on retained data");
      await page.getByRole("button", { name: "Actualizar TAP físicos ahora" }).click();
      await page.getByText("Consultando evidencia…", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Actualizar TAP físicos ahora" }).isDisabled(), true);
      assert.equal(requests, 1);
      finishRefresh();
      await page.getByText("Último snapshot confirmado", { exact: true }).waitFor();
      assert.equal(await page.getByTestId("physical-taps-event-row").count(), 1, "outage preserves evidence and filter");
      assert.deepEqual(errors, []);
      await page.goto(`${origin}/?theme=${theme}&availability=forbidden`);
      await page.getByRole("heading", { name: "Tu cuenta no tiene acceso a estos TAP" }).waitFor();
      assert.equal(await page.getByTestId("physical-taps-command-center").count(), 0);
      assert.equal(await page.getByRole("button", { name: "Reintentar ahora" }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
