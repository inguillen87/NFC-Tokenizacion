// Real consumer widgets and Next app dynamic runtime; only navigation/preload hosts are inert.
// All identities, form values and HTTP writes in this fixture are synthetic.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const web = fileURLToPath(new URL('../', import.meta.url)), repo = resolve(web, '../..');
const output = resolve(process.env.QA_OUTPUT || 'artifacts/performance/deferred-tools');
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const fixture = `import React from 'react';import{hydrateRoot}from'react-dom/client';import{SunLocaleProvider}from'./src/app/sun/sun-locale-provider';import{DeferredCtaActions,DeferredQREngagementSuite}from'./src/app/sun/sun-deferred-consumer-tools';export function App(){return <SunLocaleProvider initialLocale='es-AR'><h1>Ensayo de opciones SUN</h1><p>Datos de prueba. Sin tap físico ni operaciones reales.</p><div style={{height:2000}} aria-hidden='true'/><div id='protected-actions'><DeferredCtaActions bid='synthetic-bid' uid='synthetic-uid' eventId='0' freshToken='' canExecute={false} tapState='blocked' allowedActions={['report']} blockedActions={['claimOwnership','registerWarranty','tokenization']}/></div><div style={{height:1500}} aria-hidden='true'/><div id='qr-engagement'><DeferredQREngagementSuite wineryName='Marca de ensayo' productName='Producto de ensayo' tenantSlug='synthetic' eventId='0' bid='synthetic-bid' initialTab='contact' allowedActions={['lead','feedback','sommelier','rewards']}/></div><div style={{height:1800}} aria-hidden='true'/></SunLocaleProvider>};`;
const plugin = { name: 'consumer-tool-hosts', setup(b) {
  b.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: join(repo, 'node_modules/next/dist/shared/lib/app-dynamic.js') }));
  // PreloadChunks is server-only, never reached by these ssr:false tools.
  b.onLoad({ filter: /[\\/]lazy-dynamic[\\/]preload-chunks\.js$/ }, () => ({ contents: 'exports.PreloadChunks=function(){return null;};', loader: 'js' }));
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'inert-navigation-link', namespace: 'tool-fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'tool-fixture' }, () => ({ contents: `import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}`, loader: 'js', resolveDir: web }));
  b.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: 'export default new Proxy({}, {get:(_,key)=>String(key)});', loader: 'js' }));
} };
const browserBundle = await build({ stdin: { contents: fixture + "hydrateRoot(document.getElementById('app'),<App/>);", resolveDir: web, loader: 'tsx' }, bundle: true, write: false, minify: true, splitting: true, format: 'esm', platform: 'browser', jsx: 'automatic', outdir: join(output, 'bundles'), entryNames: 'fixture', chunkNames: 'chunks/[name]-[hash]', plugins: [plugin], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' });
const ssr = await build({ stdin: { contents: fixture + "import{renderToString}from'react-dom/server';export const render=()=>renderToString(<App/>);", resolveDir: web, loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', plugins: [plugin], external: ['react', 'react-dom/server'], logLevel: 'error' });
const module = { exports: {} }; new Function('module', 'exports', 'require', ssr.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
const html = module.exports.render();
const css = (await readFile(join(web, 'src/app/sun/sun-deferred-consumer-tools.module.css'), 'utf8')).replace(/:global\(([^)]+)\)/g, '$1');
const files = new Map();
for (const file of browserBundle.outputFiles) { const path = file.path.replace(join(output, 'bundles'), '').replaceAll('\\', '/'); files.set(path, file.contents); await mkdir(dirname(file.path), { recursive: true }); await writeFile(file.path, file.contents); }
const tools = [...files].filter(([path]) => /\/chunks\/(cta-actions|qr-engagement-suite)-/.test(path));
assert.equal(tools.length, 2, 'Widgets each retain a separate deferred chunk');
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://fixture.invalid');
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  if (files.has(u.pathname)) { res.setHeader('content-type', 'text/javascript'); return res.end(files.get(u.pathname)); }
  if (u.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang='es-AR' data-theme='light'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Opciones SUN sintéticas</title><style>${css}body{margin:0;padding:16px;font:14px/1.5 system-ui;color:#334155;background:white}*{box-sizing:border-box}button,input,textarea{font:inherit}button{min-height:44px}section{padding:12px;border:1px solid #ddd}input{display:block;max-width:100%}</style></head><body><div id='app'>${html}</div><script type='module' src='/fixture.js'></script></body></html>`);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const report = { actualConsumerWidgets: true, actualNextAppDynamicRuntime: true, navigationAndServerPreloadHostsInert: true, syntheticData: true, physicalTapMeasured: false, checks: [], chunks: tools.map(([path, bytes]) => ({ path, decodedBytes: bytes.length, gzipBytes: gzipSync(bytes).length })), scenarios: [], exceptions: [] };
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
async function scenario(hash = '', hold = false, failOnce = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await context.newPage();
  const state = { requests: [], writes: [], held: [], hold, failOnce, geo: 0 };
  await page.addInitScript(() => { window.__geoRequests = 0; Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__geoRequests++; } } }); });
  page.on('pageerror', e => report.exceptions.push(e.message));
  await page.route('**/*', route => { const request = route.request(), u = new URL(request.url()); state.requests.push(u.pathname); if (request.method() !== 'GET') { state.writes.push(u.pathname); return route.abort(); } if (u.origin !== origin) return route.abort(); if (state.failOnce && /\/chunks\/cta-actions-/.test(u.pathname)) { state.failOnce = false; return route.fulfill({ status: 503, contentType: 'text/javascript', body: '' }); } if (state.hold && /\/chunks\/cta-actions-/.test(u.pathname)) { state.held.push(route); return; } return route.continue(); });
  await page.goto(origin + '/' + hash); await page.waitForTimeout(350);
  report.scenarios.push(state); return { context, page, state };
}
try {
  const ssrOnly = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } }), ssrPage = await ssrOnly.newPage();
  await ssrPage.goto(origin); check(await ssrPage.getByRole('heading', { name: 'Postventa y garantía', exact: true }).count() === 1, 'Useful post-sale fallback is server-rendered'); check(await ssrPage.getByRole('heading', { name: 'Novedades y experiencias', exact: true }).count() === 1, 'Useful brand fallback is server-rendered'); check((await ssrPage.locator('noscript').allTextContents()).every(t => t.includes('información del producto')), 'JavaScript-free fallback explains how to keep reading'); await ssrOnly.close();
  const t = await scenario('', true), cta = t.page.locator('[data-sun-deferred-tool="protected-actions"]'), qr = t.page.locator('[data-sun-deferred-tool="qr-engagement"]');
  check(await cta.getAttribute('data-tool-load-state') === 'waiting' && await qr.getAttribute('data-tool-load-state') === 'waiting', 'Offscreen tools remain waiting'); check(!t.state.requests.some(p => /\/chunks\/(cta-actions|qr-engagement-suite)-/.test(p)), 'Neither tool chunk downloads offscreen');
  await cta.getByRole('button', { name: 'Ver opciones' }).evaluate(el => el.focus({ preventScroll: true })); await t.page.keyboard.press('Enter'); await t.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="protected-actions"]')?.getAttribute('aria-busy') === 'true');
  check(await cta.getAttribute('data-tool-load-state') === 'loading', 'Keyboard action reports pending chunk download'); check(await cta.getByRole('status').innerText() === 'Preparando las opciones…', 'Chunk loading exposes clear status');
  t.state.hold = false; for (const route of t.state.held) await route.continue();
  await t.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="protected-actions"]')?.getAttribute('data-tool-load-state') === 'ready');
  check(await cta.getAttribute('aria-busy') === 'false', 'Ready chunk clears aria-busy'); check(await cta.evaluate(el => el === document.activeElement), 'Keyboard load keeps focus in the loaded region');
  check(await cta.getByText('Necesito una nueva lectura NFC', { exact: true }).count() === 1, 'Blocked policy remains blocked after deferred mount');
  await t.page.locator('#qr-engagement').scrollIntoViewIfNeeded(); await t.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="qr-engagement"]')?.getAttribute('data-tool-load-state') === 'ready');
  check(t.state.requests.filter(p => /\/chunks\/qr-engagement-suite-/.test(p)).length === 1, 'Brand tools download once when approaching viewport');
  const name = qr.getByPlaceholder('Tu nombre completo'); await name.fill('Persona de ensayo'); const inputIdentity = await name.evaluate(el => { window.__savedFormInput = el; return true; });
  const countBefore = t.state.requests.filter(p => /\/chunks\/(cta-actions|qr-engagement-suite)-/.test(p)).length;
  await t.page.evaluate(() => scrollTo(0, 0)); await t.page.waitForTimeout(150); await t.page.locator('#qr-engagement').scrollIntoViewIfNeeded();
  check(inputIdentity && await name.evaluate(el => el === window.__savedFormInput) && await name.inputValue() === 'Persona de ensayo', 'Leaving and returning preserves the same input and entered value'); check(t.state.requests.filter(p => /\/chunks\/(cta-actions|qr-engagement-suite)-/.test(p)).length === countBefore, 'Leaving and returning does not reload tool chunks');
  check(t.state.writes.length === 0 && await t.page.evaluate(() => window.__geoRequests) === 0, 'Mount and navigation initiate no writes or GPS'); await t.context.close();
  for (const anchor of ['protected-actions', 'qr-engagement']) { const h = await scenario('#' + anchor); await h.page.waitForFunction(id => document.querySelector(`[data-sun-deferred-tool="${id}"]`)?.getAttribute('data-tool-load-state') === 'ready', anchor); check(await h.page.locator(`[data-sun-deferred-tool="${anchor}"]`).getAttribute('aria-busy') === 'false', 'Direct hash loads ready region ' + anchor); check(h.state.writes.length === 0, 'Hash never initiates a write ' + anchor); await h.context.close(); }
  const h = await scenario(); await h.page.evaluate(() => { location.hash = '#qr-engagement'; }); await h.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="qr-engagement"]')?.getAttribute('data-tool-load-state') === 'ready'); check(true, 'Hash navigation after load reaches the brand tools'); await h.context.close();
  const e = await scenario('', false, true); await e.page.locator('[data-sun-deferred-tool="protected-actions"]').getByRole('button', { name: 'Ver opciones' }).click(); await e.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="protected-actions"]')?.getAttribute('data-tool-load-state') === 'error'); check(await e.page.locator('[data-sun-deferred-tool="protected-actions"]').getAttribute('aria-busy') === 'false', 'Chunk failure ends busy state and preserves the page'); check(await e.page.getByRole('button', { name: 'Volver a intentar', exact: true }).count() === 1, 'Chunk failure offers explicit retry'); await e.context.close();
  // Retry is checked against Turbopack's real chunk loader in the companion Next test.
  check(report.exceptions.length === 0, 'No browser exceptions');
} finally { await browser.close(); await new Promise(r => server.close(r)); for (const s of report.scenarios) delete s.held; await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ checks: report.checks.length, failed: report.checks.filter(c => !c.passed), chunks: report.chunks, exceptions: report.exceptions }, null, 2));
