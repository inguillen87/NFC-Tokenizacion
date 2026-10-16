// Real client components on an inert fixture host; no actual Next router/BFF,
// account, NFC, GPS or backend writes are certified by this harness.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const web = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.env.QA_OUTPUT || 'artifacts/consumer-action-feedback');
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const claimHref = '/me?fromTap=1&eventId=900001&tenant=qa-only&bid=QA-ONLY&action=claim';
const freshToken = 'qa-only-handoff-capability';
const fixture = `import React,{useEffect}from'react';import{createRoot}from'react-dom/client';import{SunLocaleProvider}from'./src/app/sun/sun-locale-provider';import{VerifiedExperienceForm}from'./src/app/me/experiences/verified-experience-form';import{CtaActions}from'./src/app/sun/cta-actions';import{ReportProblemForm}from'./src/app/sun/report-problem-form';function App(){useEffect(()=>{window.__fixtureMounted=true;},[]);return <SunLocaleProvider initialLocale='es-AR'><h1>Ensayo local de formularios</h1>{location.pathname==='/experience'?<VerifiedExperienceForm initialEventId='900001' initialProductName='Producto de ensayo' tenant='qa-only'/>:location.pathname.startsWith('/claim')?<CtaActions bid='QA-ONLY' eventId='900001' uid='synthetic' freshToken=${JSON.stringify(freshToken)} canExecute={location.pathname!=='/claim-blocked'} tapState='valid' rightsPolicy={{claimMode:'receipt_required'}} allowedActions={['claim','warranty','report']} claimHref={location.pathname==='/claim-invalid'?${JSON.stringify(claimHref.replace('eventId=900001', 'eventId=900002'))}:${JSON.stringify(claimHref)}}/>:<ReportProblemForm bid='QA-ONLY' eventId='900001' supportToken='qa-only-support' locale='es-AR' productName='Producto de ensayo'/>}</SunLocaleProvider>};createRoot(document.getElementById('app')).render(<App/>);`;
const inertNext = {
  name: 'explicit-inert-next-navigation',
  setup(b) {
    b.onResolve({ filter: /^next\/(?:link|navigation)$/ }, args => ({ path: args.path, namespace: 'fixture-next' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture-next' }, args => ({
      contents: args.path === 'next/link'
        ? `import{createElement}from'react';export default function Link({href,children,prefetch,onClick,...props}){return createElement('a',{...props,href,onClick(event){onClick?.(event);if(!event.defaultPrevented){event.preventDefault();window.__fixtureNavigations.push({kind:'link',href});}}},children);}`
        : `export function useRouter(){return{push(href){window.__fixtureNavigations.push({kind:'router.push',href});}};}`,
      loader: 'js', resolveDir: web,
    }));
  },
};
const bundle = await build({ stdin: { contents: fixture, resolveDir: web, loader: 'tsx' }, bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', define: { 'process.env': '{}', 'process.env.NODE_ENV': '"production"' }, plugins: [inertNext, { name: 'css-host', setup(b) { b.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: 'export default new Proxy({}, {get:(_,key)=>String(key)});', loader: 'js' })); } }], logLevel: 'error' });
const server = createServer((req, res) => {
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); return res.end(bundle.outputFiles[0].contents); }
  if (req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang='es-AR'><head><title>Ensayo local de formularios</title><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{font:16px/1.5 system-ui;margin:16px}button,input,textarea,select{font:inherit}button{min-height:44px}input,textarea{display:block}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}fieldset{border:0;padding:0}svg{width:20px;height:20px}label{display:block}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const report = { status: 'failed', localOnly: true, actualClientComponents: true, syntheticHttpResponses: true, fixtureHost: 'inert-react-host', actualNextAndBff: false, nextNavigationAdapters: true, httpOnlyCookieCertified: false, realAuthenticationCertified: false, backendWrites: 0, gpsRequests: 0, checks: [], exceptions: [], mountFailures: [], forbiddenRequests: [], blockedExternalRequests: [], navigationIntents: [] };
const check = (condition, name) => { report.checks.push({ name, passed: Boolean(condition) }); assert.ok(condition, name); };
const receipt = { ok: true, item: { id: '43123123-1234-4234-8234-123456789012', event_id: '900001', visibility: 'private', moderation_status: 'pending', trust_score: null, trust_score_status: 'not_computed' } };
async function open(path, handler = () => ({ ok: true })) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', serviceWorkers: 'block' });
  const page = await context.newPage(), calls = [], pageErrors = [];
  page.setDefaultTimeout(10_000);
  let rejectMount;
  const mountFailure = new Promise((_, reject) => { rejectMount = reject; });
  page.on('pageerror', e => { report.exceptions.push(e.message); pageErrors.push(e.message); rejectMount?.(Error('Fixture startup exception: ' + e.message)); });
  await page.addInitScript(() => { window.__fixtureMounted = false; window.__fixtureNavigations = []; window.__geoRequests = 0; Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__geoRequests++; throw Error('Unexpected GPS'); } } }); });
  await page.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin !== origin) { report.blockedExternalRequests.push({ url: u.href, method: req.method(), resourceType: req.resourceType() }); return route.abort(); }
    if (u.pathname.startsWith('/api/')) {
      const call = { path: u.pathname, method: req.method(), body: req.postDataJSON() };
      calls.push(call);
      const allowed = req.method() === 'POST' && (path === '/experience' ? u.pathname === '/api/consumer/experiences' : path === '/claim' && u.pathname === '/api/consumer/tap-handoff');
      if (!allowed) { report.forbiddenRequests.push(call); return route.abort(); }
      const result = await handler(u.pathname, req);
      return route.fulfill({ status: result?.status || 200, contentType: 'application/json', body: typeof result === 'string' ? result : JSON.stringify(result?.payload || result) });
    }
    return route.continue();
  });
  try {
    await Promise.race([page.goto(origin + path).then(() => page.waitForFunction(() => window.__fixtureMounted === true, null, { timeout: 5000 })), mountFailure]);
    rejectMount = null;
    check(pageErrors.length === 0, path + ' mounts real client components on the inert host without startup exceptions');
  } catch (error) {
    rejectMount = null;
    report.mountFailures.push({ path, exceptions: pageErrors, message: error.message });
    await context.close();
    throw Error('Fixture failed to mount ' + path + ': ' + (pageErrors.join('; ') || error.message), { cause: error });
  }
  const navigation = () => page.evaluate(() => window.__fixtureNavigations);
  const close = async () => { report.gpsRequests += await page.evaluate(() => window.__geoRequests); report.navigationIntents.push({ path, intents: await navigation() }); await context.close(); };
  return { context, page, calls, navigation, close };
}
async function draft(page) {
  await page.getByLabel('Titulo corto').fill('Titulo de ensayo');
  await page.getByLabel('Comentario', { exact: true }).fill('Comentario sintetico que debe conservarse.');
  await page.getByLabel('Link de la foto (opcional)').fill('https://images.example.invalid/photo.jpg');
}
async function claimBoundary(t, name) {
  check(t.calls.every(call => call.path === '/api/consumer/tap-handoff' && call.method === 'POST'
    && JSON.stringify(Object.keys(call.body).sort()) === JSON.stringify(['eventId', 'freshToken'])
    && call.body.eventId === '900001' && call.body.freshToken === freshToken), name + ' sends only the exact event-scoped synthetic handoff');
  const urls = await t.page.evaluate(() => [location.href, ...[...document.querySelectorAll('[href]')].map(el => el.getAttribute('href')), ...window.__fixtureNavigations.map(row => row.href)]);
  check(urls.every(url => typeof url === 'string' && !url.includes(freshToken) && !/[?&](?:freshToken|token|capability)=/i.test(url)), name + ' keeps the capability out of document, link and intended navigation URLs');
  check(new URL(t.page.url()).pathname.startsWith('/claim'), name + ' records navigation intent without leaving the inert host');
}
try {
  for (const [name, response] of [['invalid JSON', 'not json'], ['empty envelope', {}], ['missing item', { ok: true }], ['foreign reading', { ...receipt, item: { ...receipt.item, event_id: '900002' } }], ['missing persistence reference', { ...receipt, item: { ...receipt.item, id: '' } }], ['unconfirmed publication state', { ...receipt, item: { ...receipt.item, visibility: 'public' } }]]) {
    const t = await open('/experience', () => response);
    await draft(t.page); await t.page.getByRole('button', { name: 'Enviar experiencia', exact: true }).click();
    await t.page.getByRole('alert').waitFor();
    check(await t.page.getByLabel('Titulo corto').inputValue() === 'Titulo de ensayo' && (await t.page.getByLabel('Comentario', { exact: true }).inputValue()).includes('conservarse') && (await t.page.getByLabel('Link de la foto (opcional)').inputValue()).includes('photo.jpg'), name + ' retains the complete experience draft');
    check(!(await t.page.locator('body').innerText()).includes('Quedo guardada'), name + ' never claims saved');
    await t.close();
  }
  let release;
  const held = new Promise(done => { release = done; });
  const t = await open('/experience', () => held);
  await draft(t.page);
  await t.page.getByRole('button', { name: 'Enviar experiencia', exact: true }).evaluate(el => { el.click(); el.click(); });
  await t.page.getByRole('button', { name: 'Enviando experiencia…' }).waitFor();
  check(t.calls.length === 1, 'Synchronous double submit initiates one experience request');
  check(await t.page.getByLabel('Comentario', { exact: true }).isDisabled() && await t.page.locator('form').getAttribute('aria-busy') === 'true', 'Submitted draft remains stable and busy state is exposed');
  release(receipt); await t.page.getByRole('status').filter({ hasText: 'Quedo guardada' }).waitFor();
  check(await t.page.getByLabel('Comentario', { exact: true }).inputValue() === '' && await t.page.getByLabel('Link de la foto (opcional)').inputValue() === '', 'Only a matching persisted private receipt clears the draft');
  check(!(await t.page.locator('body').innerText()).includes('Trust '), 'An uncomputed trust score is not fabricated');
  await t.page.getByRole('radio', { name: '3 estrellas', exact: true }).focus();
  await t.page.keyboard.press('Space');
  await t.page.keyboard.press('ArrowRight');
  check(await t.page.getByRole('radio', { name: '4 estrellas', exact: true }).isChecked(), 'Star rating supports native radio keyboard navigation');
  await t.close();

  let releaseTimeout;
  const pendingResponse = new Promise(done => { releaseTimeout = done; });
  const timeout = await open('/experience', () => pendingResponse);
  await draft(timeout.page); await timeout.page.getByRole('button', { name: 'Enviar experiencia', exact: true }).click();
  await timeout.page.getByRole('alert').waitFor({ timeout: 15_000 });
  check(timeout.calls.length === 1 && await timeout.page.locator('form').getAttribute('aria-busy') === 'false' && !await timeout.page.getByLabel('Comentario', { exact: true }).isDisabled(), 'A stalled experience request ends busy state after the shared deadline without automatic retry');
  check((await timeout.page.getByRole('alert').innerText()).includes('Revisa Mis experiencias') && (await timeout.page.getByLabel('Comentario', { exact: true }).inputValue()).includes('conservarse'), 'An interrupted write remains unconfirmed and preserves the draft for consultation');
  releaseTimeout(receipt); await timeout.page.waitForTimeout(100); await timeout.close();

  const photo = await open('/experience');
  await photo.page.evaluate(() => {
    const NativeImage = window.Image; window.__photoImages = []; window.__photoLoads = [];
    window.Image = class extends NativeImage { constructor() { super(); window.__photoImages.push(this); } set onload(fn) { window.__photoLoads.push(fn); } };
    window.__releasePhoto = async index => { await window.__photoImages[index].decode(); window.__photoLoads[index].call(window.__photoImages[index]); };
  });
  await photo.page.getByLabel('Comentario', { exact: true }).fill('Comentario sintetico con fotografia.');
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9kAAAAASUVORK5CYII=', 'base64');
  await photo.page.getByLabel('Foto del producto', { exact: true }).setInputFiles({ name: 'primera.png', mimeType: 'image/png', buffer: image });
  check(await photo.page.getByRole('button', { name: 'Enviar experiencia' }).isDisabled(), 'Experience waits for photo preparation');
  await photo.page.getByRole('button', { name: 'Quitar', exact: true }).click();
  await photo.page.evaluate(() => window.__releasePhoto(0)); await photo.page.waitForTimeout(100);
  check(!(await photo.page.locator('body').innerText()).includes('primera.png optimizada'), 'A removed photo cannot return after late preparation');
  await photo.page.getByLabel('Foto del producto', { exact: true }).setInputFiles({ name: 'segunda.png', mimeType: 'image/png', buffer: image });
  await photo.page.getByLabel('Foto del producto', { exact: true }).setInputFiles({ name: 'tercera.png', mimeType: 'image/png', buffer: image });
  await photo.page.evaluate(() => window.__releasePhoto(2)); await photo.page.waitForTimeout(100);
  await photo.page.evaluate(() => window.__releasePhoto(1)); await photo.page.waitForTimeout(100);
  check((await photo.page.locator('body').innerText()).includes('tercera.png optimizada') && !(await photo.page.locator('body').innerText()).includes('segunda.png optimizada'), 'Latest selected photo wins despite reversed completion order');
  await photo.close();

  let releaseHandoff;
  const heldHandoff = new Promise(done => { releaseHandoff = done; });
  const claim = await open('/claim', () => heldHandoff);
  const primary = claim.page.getByTestId('sun-claim-portal').getByRole('button', { name: 'Continuar en mi cuenta', exact: true });
  await primary.waitFor(); await claim.page.waitForFunction(() => { const button = document.querySelector('[data-testid="consumer-passport-handoff"] button'); return Boolean(button && !button.disabled); });
  check(claim.calls.length === 0 && (await claim.navigation()).length === 0, 'Mounting the ownership gateway does not prepare access or navigate');
  check(await claim.page.getByLabel('Email o celular', { exact: true }).count() === 0 && await claim.page.getByLabel('Codigo recibido', { exact: true }).count() === 0 && await claim.page.getByRole('heading', { name: 'Comprobante de Compra (Ticket/Factura)', exact: true }).count() === 0, 'The gateway does not render the retired contact, OTP or OCR flow');
  await primary.evaluate(el => { el.click(); el.click(); });
  await claim.page.getByRole('button', { name: 'Preparando acceso…', exact: true }).waitFor();
  check(claim.calls.length === 1 && (await claim.navigation()).length === 0, 'A deliberate synchronous double click prepares once and waits for the handoff receipt');
  await claimBoundary(claim, 'Pending ownership gateway');
  releaseHandoff({ ok: true, eventId: '900001' });
  await claim.page.waitForFunction(() => window.__fixtureNavigations.length === 1);
  check(JSON.stringify(await claim.navigation()) === JSON.stringify([{ kind: 'router.push', href: claimHref }]), 'Only an exact matching receipt records the canonical account destination');
  const opening = claim.page.getByRole('button', { name: 'Abriendo tu cuenta…', exact: true });
  check(await opening.isDisabled(), 'Prepared navigation cannot prepare the capability again');
  await opening.evaluate(el => { el.click(); el.click(); }); await claim.page.waitForTimeout(100);
  check(claim.calls.length === 1 && (await claim.navigation()).length === 1, 'A prepared handoff remains single-use while the inert destination stays open');
  await claimBoundary(claim, 'Confirmed ownership gateway'); await claim.close();

  for (const [name, response] of [['generic 200', { ok: true }], ['foreign-event 200', { ok: true, eventId: '900002' }]]) {
    const invalid = await open('/claim', () => response);
    await invalid.page.getByRole('button', { name: 'Continuar en mi cuenta', exact: true }).click();
    await invalid.page.getByRole('alert').waitFor(); await invalid.page.waitForTimeout(100);
    check(invalid.calls.length === 1 && (await invalid.navigation()).length === 0 && await invalid.page.getByRole('button', { name: 'Reintentar acceso', exact: true }).isEnabled(), name + ' cannot confirm access or navigate and never retries automatically');
    await claimBoundary(invalid, name); await invalid.close();
  }

  let retryRequests = 0;
  const retry = await open('/claim', () => ++retryRequests === 1 ? { status: 503, payload: { ok: false, error: 'synthetic_unavailable' } } : { ok: true, eventId: '900001' });
  await retry.page.getByRole('button', { name: 'Continuar en mi cuenta', exact: true }).click();
  await retry.page.getByRole('alert').waitFor(); await retry.page.waitForTimeout(100);
  check(retry.calls.length === 1 && (await retry.navigation()).length === 0 && await retry.page.getByRole('button', { name: 'Reintentar acceso', exact: true }).isEnabled(), 'A 503 preserves an explicit retry without another POST or navigation');
  check(await retry.page.getByRole('link', { name: 'Abrir mis productos guardados', exact: true }).getAttribute('href') === '/me/products', 'A recoverable handoff failure offers the read-only products destination');
  await retry.page.getByRole('button', { name: 'Reintentar acceso', exact: true }).click();
  await retry.page.waitForFunction(() => window.__fixtureNavigations.length === 1);
  check(retry.calls.length === 2 && JSON.stringify(await retry.navigation()) === JSON.stringify([{ kind: 'router.push', href: claimHref }]), 'Only a second deliberate click retries and a matching receipt permits account intent');
  await claimBoundary(retry, 'Explicit retry'); await retry.close();

  const expired = await open('/claim', () => ({ status: 400, payload: { ok: false, error: 'tap_handoff_invalid_or_expired' } }));
  await expired.page.getByRole('button', { name: 'Continuar en mi cuenta', exact: true }).click();
  await expired.page.getByRole('alert').waitFor();
  const newReading = expired.page.getByRole('button', { name: 'Nueva lectura necesaria', exact: true });
  check(await newReading.isDisabled() && (await expired.page.getByRole('alert').innerText()).includes('Acercá de nuevo el teléfono a la etiqueta'), 'An expired capability requires a new physical reading and disables retry');
  check(await expired.page.getByRole('link', { name: 'Abrir mis productos guardados', exact: true }).getAttribute('href') === '/me/products', 'An expired handoff preserves read-only account recovery');
  await newReading.evaluate(el => { el.click(); el.click(); }); await expired.page.waitForTimeout(100);
  check(expired.calls.length === 1 && (await expired.navigation()).length === 0 && await expired.page.getByRole('button', { name: 'Reintentar acceso', exact: true }).count() === 0, 'An expired capability never rePOSTs or navigates');
  await claimBoundary(expired, 'Expired ownership gateway'); await expired.close();

  for (const path of ['/claim-invalid', '/claim-blocked']) {
    const unavailable = await open(path);
    const action = unavailable.page.getByTestId('sun-claim-portal').getByRole('button', { name: 'Continuar en mi cuenta', exact: true });
    check(await action.isDisabled(), path + ' disables the canonical ownership gateway');
    await action.evaluate(el => el.click()); await unavailable.page.waitForTimeout(100);
    check(unavailable.calls.length === 0 && (await unavailable.navigation()).length === 0, path + ' cannot send a handoff or navigate');
    await claimBoundary(unavailable, path); await unavailable.close();
  }

  const support = await open('/report'); await support.page.locator('summary').click();
  await support.page.getByLabel('Describí lo que pasó', { exact: true }).fill('Descripción de ensayo con el producto.');
  await support.page.locator('#report-contact').fill('bad\u0000contact');
  await support.page.locator('form').evaluate(form => form.requestSubmit());
  await support.page.waitForFunction(() => document.getElementById('report-contact')?.getAttribute('aria-invalid') === 'true');
  check(await support.page.locator('#report-contact').evaluate(el => el === document.activeElement), 'Support review focuses the invalid optional contact instead of the valid description');
  check(support.calls.length === 0, 'Support validation and review preparation perform no request'); await support.close();
  check(report.forbiddenRequests.length === 0, 'No auth, claim, warranty, OCR, support or unknown API requests escape the explicit synthetic allowlist');
  check(report.blockedExternalRequests.every(row => row.method === 'GET' && row.resourceType === 'image' && row.url === 'https://images.example.invalid/photo.jpg'), 'Only the intentionally synthetic draft photo may attempt an external request, and it is blocked');
  check(report.gpsRequests === 0 && report.exceptions.length === 0 && report.mountFailures.length === 0, 'No geolocation, mount failures or browser exceptions');
  report.status = 'passed';
} finally {
  await browser.close(); await new Promise(done => server.close(done));
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ checks: report.checks.length, failures: report.checks.filter(c => !c.passed), gpsRequests: report.gpsRequests, exceptions: report.exceptions, evidence: output }, null, 2));
