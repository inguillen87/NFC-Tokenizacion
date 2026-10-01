// Real client components; local HTTP fixtures only. No account, NFC, GPS or backend writes.
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
const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{SunLocaleProvider}from'./src/app/sun/sun-locale-provider';import{VerifiedExperienceForm}from'./src/app/me/experiences/verified-experience-form';import{CtaActions}from'./src/app/sun/cta-actions';import{ReportProblemForm}from'./src/app/sun/report-problem-form';function App(){return <SunLocaleProvider initialLocale='es-AR'><h1>Ensayo local de formularios</h1>{location.pathname==='/experience'?<VerifiedExperienceForm initialEventId='900001' initialProductName='Producto de ensayo' tenant='qa-only'/>:location.pathname==='/claim'?<CtaActions bid='QA-ONLY' eventId='900001' uid='synthetic' freshToken='qa-only' canExecute={true} tapState='valid' rightsPolicy={{claimMode:'receipt_required'}} allowedActions={['claim','warranty','report']}/>:<ReportProblemForm bid='QA-ONLY' eventId='900001' supportToken='qa-only-support' locale='es-AR' productName='Producto de ensayo'/>}</SunLocaleProvider>};createRoot(document.getElementById('app')).render(<App/>);`;
const bundle = await build({ stdin: { contents: fixture, resolveDir: web, loader: 'tsx' }, bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'css-host', setup(b) { b.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: 'export default new Proxy({}, {get:(_,key)=>String(key)});', loader: 'js' })); } }], logLevel: 'error' });
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
const report = { localOnly: true, actualClientComponents: true, syntheticHttpResponses: true, backendWrites: 0, gpsRequests: 0, checks: [], exceptions: [] };
const check = (condition, name) => { report.checks.push({ name, passed: Boolean(condition) }); assert.ok(condition, name); };
const receipt = { ok: true, item: { id: '43123123-1234-4234-8234-123456789012', event_id: '900001', visibility: 'private', moderation_status: 'pending', trust_score: null, trust_score_status: 'not_computed' } };
async function open(path, handler = () => ({ ok: true })) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', serviceWorkers: 'block' });
  const page = await context.newPage(), calls = [];
  page.setDefaultTimeout(10_000);
  page.on('pageerror', e => report.exceptions.push(e.message));
  await page.addInitScript(() => { window.__geoRequests = 0; Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__geoRequests++; throw Error('Unexpected GPS'); } } }); });
  await page.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin !== origin) return route.abort();
    if (u.pathname.startsWith('/api/')) {
      calls.push({ path: u.pathname, method: req.method(), body: req.postDataJSON() });
      const result = await handler(u.pathname, req);
      return route.fulfill({ status: result?.status || 200, contentType: 'application/json', body: typeof result === 'string' ? result : JSON.stringify(result?.payload || result) });
    }
    return route.continue();
  });
  await page.goto(origin + path);
  const close = async () => { report.gpsRequests += await page.evaluate(() => window.__geoRequests); await context.close(); };
  return { context, page, calls, close };
}
async function draft(page) {
  await page.getByLabel('Titulo corto').fill('Titulo de ensayo');
  await page.getByLabel('Comentario', { exact: true }).fill('Comentario sintetico que debe conservarse.');
  await page.getByLabel('Link de la foto (opcional)').fill('https://images.example.invalid/photo.jpg');
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

  let verifyCount = 0;
  const claim = await open('/claim', path => path === '/api/consumer/session' ? { status: 401, payload: { ok: false, authenticated: false } } : path.endsWith('/start') ? { ok: true, mode: 'otp', delivery: { channel: 'email', status: 'accepted' }, deliveryChannel: 'email' } : path.endsWith('/verify') ? (++verifyCount === 1 ? { status: 401, payload: { ok: false, error: 'invalid_code' } } : { ok: true, consumer: { id: 'qa-only' } }) : { ok: true });
  await claim.page.locator('.sun-public-cta > div').getByRole('button').filter({ hasText: /Iniciar|Activar|Validar|Continuar/ }).first().click();
  const contact = claim.page.getByLabel('Email o celular', { exact: true });
  await contact.waitFor(); check(await contact.evaluate(el => el === document.activeElement), 'Opening buyer contact focuses the first field');
  await contact.fill('persona@example.invalid'); await contact.press('Enter');
  const code = claim.page.getByLabel('Codigo recibido', { exact: true }); await code.waitFor();
  check(await code.evaluate(el => el === document.activeElement) && await code.getAttribute('autocomplete') === 'one-time-code', 'Accepted code request focuses a labelled autofill-enabled code field');
  check(await claim.page.getByRole('button', { name: 'Confirmar', exact: true }).isDisabled(), 'Confirm stays disabled for a missing code');
  check((await claim.page.getByRole('status').innerText()).includes('no confirma todavía su entrega'), 'Accepted OTP request does not claim delivery');
  await code.fill('1234'); await code.press('Enter'); await claim.page.getByRole('alert').waitFor();
  check(await code.inputValue() === '1234' && await code.evaluate(el => el === document.activeElement), 'Rejected code stays available with focus and announced recovery');
  await code.fill('5678'); await code.press('Enter'); const heading = claim.page.getByRole('heading', { name: 'Comprobante de Compra (Ticket/Factura)', exact: true }); await heading.waitFor();
  check(await heading.evaluate(el => el === document.activeElement), 'Contact confirmation focuses purchase proof instead of claiming ownership');
  check(!claim.calls.some(c => /\/public-cta\/claim|\/register-warranty/.test(c.path)), 'OTP alone sends no purchase or warranty mutation');
  await claim.close();

  const error = await open('/claim', path => path === '/api/consumer/session' ? { status: 401, payload: { ok: false, authenticated: false } } : { status: 503, payload: { ok: false, error: 'resend_api_key_missing' } });
  await error.page.locator('.sun-public-cta > div').getByRole('button').filter({ hasText: /Iniciar|Activar|Validar|Continuar/ }).first().click();
  await error.page.getByLabel('Email o celular', { exact: true }).fill('persona@example.invalid'); await error.page.getByRole('button', { name: 'Enviar codigo', exact: true }).click(); await error.page.getByRole('alert').waitFor();
  check(!(await error.page.getByRole('alert').innerText()).includes('RESEND_API_KEY') && await error.page.getByLabel('Email o celular', { exact: true }).inputValue() === 'persona@example.invalid', 'Provider failure gives a human message and preserves the contact'); await error.close();

  const unknown = await open('/claim', path => path === '/api/consumer/session' ? { status: 401, payload: { ok: false, authenticated: false } } : {});
  await unknown.page.getByRole('button', { name: 'Activar garantía o beneficios', exact: true }).click();
  await unknown.page.getByLabel('Email o celular', { exact: true }).fill('persona@example.invalid'); await unknown.page.getByRole('button', { name: 'Enviar codigo', exact: true }).click(); await unknown.page.getByRole('alert').waitFor();
  check(await unknown.page.getByLabel('Codigo recibido', { exact: true }).count() === 0, 'A generic 200 envelope cannot advance contact confirmation'); await unknown.close();

  const support = await open('/report'); await support.page.locator('summary').click();
  await support.page.getByLabel('Describí lo que pasó', { exact: true }).fill('Descripción de ensayo con el producto.');
  await support.page.locator('#report-contact').fill('bad\u0000contact');
  await support.page.locator('form').evaluate(form => form.requestSubmit());
  await support.page.waitForFunction(() => document.getElementById('report-contact')?.getAttribute('aria-invalid') === 'true');
  check(await support.page.locator('#report-contact').evaluate(el => el === document.activeElement), 'Support review focuses the invalid optional contact instead of the valid description');
  check(support.calls.length === 0, 'Support validation and review preparation perform no request'); await support.close();
  check(report.gpsRequests === 0 && report.exceptions.length === 0, 'No geolocation or browser exceptions');
} finally {
  await browser.close(); await new Promise(done => server.close(done));
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ checks: report.checks.length, failures: report.checks.filter(c => !c.passed), gpsRequests: report.gpsRequests, exceptions: report.exceptions, evidence: output }, null, 2));
