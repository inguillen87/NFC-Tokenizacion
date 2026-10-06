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
const fixture = `import React from 'react';import{hydrateRoot}from'react-dom/client';import{SunLocaleProvider}from'./src/app/sun/sun-locale-provider';import{DeferredCtaActions,DeferredQREngagementSuite}from'./src/app/sun/sun-deferred-consumer-tools';const configuration={version:'nexid.tenant-actions.v1',status:'published',allowedActions:['lead','feedback','sommelier'],program:{id:'synthetic-program',name:'Programa de ensayo',pointsName:'Puntos',pointsPerValidTap:0},trivia:{id:'11111111-1111-4111-8111-111111111111',title:'Trivia de ensayo',revision:'a'.repeat(64),pointsPerCorrect:0,completionBonus:0},catalogAvailable:false,tenantSlug:'synthetic'};export function App({locale='es-AR'}={}){return <SunLocaleProvider initialLocale={locale}><h1>Ensayo de opciones SUN</h1><p>Datos de prueba. Sin tap físico ni operaciones reales.</p><section id='information'><input aria-label='Otra consulta de prueba'/><a href='#information'>Seguir leyendo el producto</a></section><div style={{height:2000}} aria-hidden='true'/><div id='protected-actions'><DeferredCtaActions bid='synthetic-bid' uid='synthetic-uid' eventId='0' freshToken='' canExecute={false} tapState='blocked' allowedActions={['report']} blockedActions={['claimOwnership','registerWarranty','tokenization']}/></div><div style={{height:1500}} aria-hidden='true'/><div id='qr-engagement'><DeferredQREngagementSuite wineryName='Marca de ensayo' productName='Producto de ensayo' tenantSlug='synthetic' eventId='0' bid='synthetic-bid' initialTab='contact' allowedActions={['lead','feedback','sommelier','rewards']} configuration={configuration}/></div><div style={{height:1800}} aria-hidden='true'/></SunLocaleProvider>};`;
const plugin = { name: 'consumer-tool-hosts', setup(b) {
  b.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: join(repo, 'node_modules/next/dist/shared/lib/app-dynamic.js') }));
  // PreloadChunks is server-only, never reached by these ssr:false tools.
  b.onLoad({ filter: /[\\/]lazy-dynamic[\\/]preload-chunks\.js$/ }, () => ({ contents: 'exports.PreloadChunks=function(){return null;};', loader: 'js' }));
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'inert-navigation-link', namespace: 'tool-fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'tool-fixture' }, () => ({ contents: `import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}`, loader: 'js', resolveDir: web }));
  b.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: 'export default new Proxy({}, {get:(_,key)=>String(key)});', loader: 'js' }));
} };
const browserBundle = await build({ stdin: { contents: fixture + "const requested=new URLSearchParams(location.search).get('locale');const locale=['en','pt-BR'].includes(requested)?requested:'es-AR';hydrateRoot(document.getElementById('app'),<App locale={locale}/>);", resolveDir: web, loader: 'tsx' }, bundle: true, write: false, minify: true, splitting: true, format: 'esm', platform: 'browser', jsx: 'automatic', outdir: join(output, 'bundles'), entryNames: 'fixture', chunkNames: 'chunks/[name]-[hash]', plugins: [plugin], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' });
const ssr = await build({ stdin: { contents: fixture + "import{renderToString}from'react-dom/server';export const render=(locale)=>renderToString(<App locale={locale}/>);", resolveDir: web, loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', plugins: [plugin], external: ['react', 'react-dom/server'], logLevel: 'error' });
const module = { exports: {} }; new Function('module', 'exports', 'require', ssr.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
const html = new Map(['es-AR', 'en', 'pt-BR'].map(locale => [locale, module.exports.render(locale)]));
const css = (await readFile(join(web, 'src/app/sun/sun-deferred-consumer-tools.module.css'), 'utf8')).replace(/:global\(([^)]+)\)/g, '$1')
  + await readFile(join(web, 'src/app/sun/qr-engagement-suite.module.css'), 'utf8');
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
  const locale = html.has(u.searchParams.get('locale')) ? u.searchParams.get('locale') : 'es-AR';
  res.end(`<!doctype html><html lang='${locale}' data-theme='light'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Opciones SUN sintéticas</title><style>${css}body{margin:0;padding:16px;font:14px/1.5 system-ui;color:#334155;background:white}*{box-sizing:border-box}button,input,textarea{font:inherit}button{min-height:44px}section{padding:12px;border:1px solid #ddd}input{display:block;max-width:100%}</style></head><body><div id='app'>${html.get(locale)}</div><script type='module' src='/fixture.js'></script></body></html>`);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const report = { actualConsumerWidgets: true, actualNextAppDynamicRuntime: true, navigationAndServerPreloadHostsInert: true, syntheticData: true, physicalTapMeasured: false, checks: [], chunks: tools.map(([path, bytes]) => ({ path, decodedBytes: bytes.length, gzipBytes: gzipSync(bytes).length })), scenarios: [], exceptions: [] };
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
async function scenario(hash = '', hold = false, failOnce = false, locale = 'es-AR', width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await context.newPage();
  const state = { requests: [], writes: [], held: [], hold, failOnce, geo: 0 };
  await page.addInitScript(() => { window.__geoRequests = 0; Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__geoRequests++; } } }); });
  page.on('pageerror', e => report.exceptions.push(e.message));
  await page.route('**/*', route => { const request = route.request(), u = new URL(request.url()); state.requests.push(u.pathname); if (request.method() !== 'GET') { state.writes.push(u.pathname); return route.abort(); } if (u.origin !== origin) return route.abort(); if (state.failOnce && /\/chunks\/cta-actions-/.test(u.pathname)) { state.failOnce = false; return route.fulfill({ status: 503, contentType: 'text/javascript', body: '' }); } if (state.hold && /\/chunks\/cta-actions-/.test(u.pathname)) { state.held.push(route); return; } return route.continue(); });
  await page.goto(origin + '/' + (locale === 'es-AR' ? '' : '?locale=' + locale) + hash); await page.waitForTimeout(350);
  report.scenarios.push(state); return { context, page, state };
}
try {
  const ssrOnly = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } }), ssrPage = await ssrOnly.newPage();
  await ssrPage.goto(origin); check(await ssrPage.getByRole('heading', { name: 'Postventa y garantía', exact: true }).count() === 1, 'Useful post-sale fallback is server-rendered'); check(await ssrPage.getByRole('heading', { name: 'Novedades y experiencias', exact: true }).count() === 1, 'Useful brand fallback is server-rendered'); check((await ssrPage.locator('noscript').allTextContents()).every(t => t.includes('información del producto')), 'JavaScript-free fallback explains how to keep reading'); await ssrOnly.close();
  const t = await scenario('', true), cta = t.page.locator('[data-sun-deferred-tool="protected-actions"]'), qr = t.page.locator('[data-sun-deferred-tool="qr-engagement"]');
  check(await cta.getAttribute('data-tool-load-state') === 'waiting' && await qr.getAttribute('data-tool-load-state') === 'waiting', 'Offscreen tools remain waiting'); check(!t.state.requests.some(p => /\/chunks\/(cta-actions|qr-engagement-suite)-/.test(p)), 'Neither tool chunk downloads offscreen');
  await cta.getByRole('button', { name: 'Ver opciones' }).evaluate(el => el.focus({ preventScroll: true })); await t.page.keyboard.press('Enter'); await t.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="protected-actions"]')?.getAttribute('aria-busy') === 'true');
  check(await cta.getAttribute('data-tool-load-state') === 'loading', 'Keyboard action reports pending chunk download'); check(await cta.getByRole('status').innerText() === 'Preparando las opciones…', 'Chunk loading exposes clear status');
  check(await cta.getByRole('heading', { name: 'Postventa y garantía', exact: true }).count() === 1, 'Loading retains the requested tool title');
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
  const e = await scenario('', false, true); await e.page.locator('[data-sun-deferred-tool="protected-actions"]').getByRole('button', { name: 'Ver opciones' }).evaluate(el => el.focus({ preventScroll: true })); await e.page.keyboard.press('Enter'); await e.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="protected-actions"]')?.getAttribute('data-tool-load-state') === 'error'); check(await e.page.locator('[data-sun-deferred-tool="protected-actions"]').getAttribute('aria-busy') === 'false', 'Chunk failure ends busy state and preserves the page'); check(await e.page.getByRole('button', { name: 'Volver a intentar', exact: true }).count() === 1, 'Chunk failure offers explicit retry'); check(await e.page.getByRole('button', { name: 'Volver a intentar', exact: true }).evaluate(el => el === document.activeElement), 'A failed keyboard request hands focus to retry'); await e.context.close();
  for (const newerAction of ['focus-and-type', 'scroll', 'history']) {
    const next = await scenario('', true), region = next.page.locator('[data-sun-deferred-tool="protected-actions"]');
    await region.getByRole('button', { name: 'Ver opciones' }).evaluate(el => el.focus({ preventScroll: true })); await next.page.keyboard.press('Enter');
    await next.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="protected-actions"]')?.getAttribute('data-tool-load-state') === 'loading');
    if (newerAction === 'focus-and-type') await next.page.getByRole('textbox', { name: 'Otra consulta de prueba' }).fill('Conservar esta interacción');
    if (newerAction === 'scroll') {
      await next.page.evaluate(() => { window.__wheelDelivered = false; document.addEventListener('wheel', () => { window.__wheelDelivered = true; }, { once: true }); });
      await next.page.mouse.wheel(0, 150);
      await next.page.waitForFunction(() => window.__wheelDelivered === true);
    }
    if (newerAction === 'history') { await next.page.getByRole('link', { name: 'Seguir leyendo el producto' }).click(); await next.page.goBack(); }
    await next.page.evaluate(() => { window.__focusBeforeChunk = document.activeElement; });
    next.state.focusBefore = await next.page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id }));
    next.state.hold = false; for (const route of next.state.held) await route.continue();
    await next.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="protected-actions"]')?.getAttribute('data-tool-load-state') === 'ready');
    next.state.focusAfter = await next.page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id, isTool: document.activeElement?.hasAttribute('data-sun-deferred-tool') }));
    check(await next.page.evaluate(() => window.__focusBeforeChunk === document.activeElement), 'A newer ' + newerAction + ' retains focus after the download');
    check(!await region.evaluate(el => el === document.activeElement), 'The late tool does not steal focus after ' + newerAction);
    if (newerAction === 'focus-and-type') check(await next.page.getByRole('textbox', { name: 'Otra consulta de prueba' }).inputValue() === 'Conservar esta interacción', 'Typing elsewhere keeps the new input unchanged');
    check(next.state.writes.length === 0 && await next.page.evaluate(() => window.__geoRequests) === 0, 'Delayed focus handling never sends data or asks for GPS ' + newerAction);
    await next.context.close();
  }
  for (const width of [320, 390, 768, 1440]) for (const theme of ['light', 'dark']) {
    const visual = await scenario('', true, false, 'es-AR', width), region = visual.page.locator('[data-sun-deferred-tool="protected-actions"]');
    await visual.page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await region.getByRole('button', { name: 'Ver opciones' }).evaluate(el => el.focus({ preventScroll: true })); await visual.page.keyboard.press('Enter');
    await region.getByTestId('sun-tool-loading').waitFor();
    const loading = region.getByTestId('sun-tool-loading');
    check(await loading.getByRole('heading', { name: 'Postventa y garantía' }).count() === 1, 'Tool title remains readable while waiting ' + width + ' ' + theme);
    check(await loading.evaluate(el => el.scrollWidth <= el.clientWidth), 'The progressive card has no horizontal overflow ' + width + ' ' + theme);
    check(await loading.locator('.loadingSignal').evaluate(el => getComputedStyle(el).animationName === 'none'), 'Reduced motion keeps the loading signal still ' + width + ' ' + theme);
    await loading.screenshot({ path: join(output, 'loading-' + width + '-' + theme + '.png') });
    check(visual.state.writes.length === 0 && await visual.page.evaluate(() => window.__geoRequests) === 0, 'Progressive display never submits or asks for GPS ' + width + ' ' + theme);
    await visual.context.close();
  }
  // Retry is checked against Turbopack's real chunk loader in the companion Next test.
  for (const copy of [
    { locale: 'es-AR', star: 'Calificar con 3 estrellas', otherStar: 'Calificar con 4 estrellas', comment: 'Comentario corto', send: 'Enviar opinión', explanation: 'Tu opinión se envía a la marca junto con esta lectura.' },
    { locale: 'en', star: 'Rate 3 stars', otherStar: 'Rate 4 stars', comment: 'Short comment', send: 'Send opinion', explanation: 'Your opinion is sent to the brand with this reading.' },
    { locale: 'pt-BR', star: 'Avaliar com 3 estrelas', otherStar: 'Avaliar com 4 estrelas', comment: 'Comentário curto', send: 'Enviar opinião', explanation: 'Sua opinião é enviada à marca junto com esta leitura.' },
  ]) {
    const f = await scenario('#qr-engagement', false, false, copy.locale, 320), widget = f.page.locator('[data-sun-deferred-tool="qr-engagement"]');
    await f.page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="qr-engagement"]')?.getAttribute('data-tool-load-state') === 'ready');
    await widget.locator('.sun-engagement-tabs button').nth(2).click();
    check(await widget.getByText(copy.explanation, { exact: true }).count() === 1, 'Opinion explanation uses customer language ' + copy.locale);
    const rating = widget.getByRole('button', { name: copy.star, exact: true });
    check(await rating.getAttribute('aria-pressed') === 'false', 'A rating is not preselected ' + copy.locale);
    check(await widget.getByRole('button', { name: copy.send, exact: true }).isDisabled(), 'Sending still requires an explicit rating ' + copy.locale);
    await rating.focus(); await f.page.keyboard.press('Enter');
    check(await rating.getAttribute('aria-pressed') === 'true' && await widget.locator('button[aria-pressed="true"][aria-label]').count() === 1, 'Keyboard selection exposes exactly one selected rating ' + copy.locale);
    const bounds = await rating.boundingBox();
    check(bounds.width >= 44 && bounds.height >= 44, 'Star target is at least 44px using the scoped CSS ' + copy.locale);
    check(await rating.evaluate(el => getComputedStyle(el).outlineStyle !== 'none' && Number.parseFloat(getComputedStyle(el).outlineWidth) >= 2), 'Keyboard rating has a visible focus outline ' + copy.locale);
    await widget.locator('label').filter({ hasText: copy.comment }).click();
    const comment = widget.getByRole('textbox', { name: copy.comment, exact: true });
    check(await comment.evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16), 'Mobile comment uses readable 16px typography ' + copy.locale);
    check(await comment.evaluate(el => el === document.activeElement), 'Visible comment label focuses its associated textarea ' + copy.locale);
    await comment.fill('Comentario sintético que debe conservarse');
    const nextRating = widget.getByRole('button', { name: copy.otherStar, exact: true });
    await nextRating.focus(); await f.page.keyboard.press('Space');
    check(await nextRating.getAttribute('aria-pressed') === 'true' && await rating.getAttribute('aria-pressed') === 'false', 'Space changes the selected rating ' + copy.locale);
    const locationChoice = widget.getByRole('checkbox');
    check(!await locationChoice.isChecked(), 'Sharing a zone is still optional and unchecked ' + copy.locale);
    await locationChoice.check(); await locationChoice.uncheck();
    check(f.state.writes.length === 0 && await f.page.evaluate(() => window.__geoRequests) === 0, 'Changing optional consent alone never submits or requests GPS ' + copy.locale);
    await widget.locator('.sun-engagement-tabs button').nth(3).click();
    await widget.locator('.sun-engagement-tabs button').nth(2).click();
    check(await widget.getByRole('textbox', { name: copy.comment, exact: true }).inputValue() === 'Comentario sintético que debe conservarse', 'Changing panels preserves the comment draft ' + copy.locale);
    check(await widget.getByRole('button', { name: copy.otherStar, exact: true }).getAttribute('aria-pressed') === 'true', 'Changing panels preserves the selected rating ' + copy.locale);
    check(f.state.writes.length === 0 && await f.page.evaluate(() => window.__geoRequests) === 0, 'Rating, label and panel changes never send data or request GPS ' + copy.locale);
    await f.page.screenshot({ path: join(output, 'opinion-' + copy.locale + '-320.png'), fullPage: false });
    await f.context.close();
  }
  check(report.exceptions.length === 0, 'No browser exceptions');
} finally { await browser.close(); await new Promise(r => server.close(r)); for (const s of report.scenarios) delete s.held; await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ checks: report.checks.length, failed: report.checks.filter(c => !c.passed), chunks: report.chunks, exceptions: report.exceptions }, null, 2));
