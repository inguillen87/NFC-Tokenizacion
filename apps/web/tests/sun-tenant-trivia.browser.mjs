// Production components and styles; every API response and submission is local synthetic QA.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const web = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.env.QA_OUTPUT || 'artifacts/sun-tenant-trivia');
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
const publication = { protocol: 'nexid.current-editorial.v1', source: 'passport_studio', state: 'published', observedAt: '2026-10-05T15:00:00Z', version: 3,
  publishedAt: '2026-10-04T15:00:00Z', contentDigest: 'a'.repeat(64), document: { schemaVersion: 'nexid.passport-editorial.v1', template: 'agro', locale: 'es-AR',
    identity: { product_name: 'Producto publicado de ensayo', public_lot_label: 'QA-3', sku: null, winery: 'Empresa de ensayo', region: null, image_url: null },
    agro_product_profile: { technicalSheetUrl: 'https://docs.example.test/current.pdf', safetySheetUrl: null } } };
const quiz = { ok: true, quiz: { id: '10000000-0000-4000-8000-000000000001', revision: 'a'.repeat(64), questions: [{ id: 'q1', prompt: 'Pregunta publicada de ensayo', options: ['Respuesta de ensayo uno', 'Respuesta de ensayo dos'] }] }, previousAttempt: null };
const configuration = { version: 'nexid.tenant-actions.v1', status: 'published', allowedActions: [], catalogAvailable: false, program: { id: '10000000-0000-4000-8000-000000000002', name: 'Programa de ensayo', pointsName: 'Puntos', pointsPerValidTap: 0 }, trivia: { id: quiz.quiz.id, revision: quiz.quiz.revision, title: 'Trivia de ensayo', pointsPerCorrect: 0, completionBonus: 0 } };
const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{SunLocaleProvider}from'./src/app/sun/sun-locale-provider';import{QREngagementSuite}from'./src/app/sun/qr-engagement-suite';import{CurrentEditorialResourcesView}from'./src/app/sun/current-editorial-resources-view';import shell from'./src/app/me/_components/portal-shell.module.css';const p=new URLSearchParams(location.search),editorial=${JSON.stringify(publication)};editorial.state=p.get('editorial')||'published';createRoot(document.getElementById('app')).render(<SunLocaleProvider initialLocale='es-AR'><main className={shell.portal} style={{padding:16,boxSizing:'border-box'}}><h1>Sincronización del tenant · ensayo local</h1><p>Datos sintéticos. Sin tap físico ni operaciones reales.</p><CurrentEditorialResourcesView currentEditorial={editorial}/><section className="sun-tap-experience"><QREngagementSuite wineryName='Empresa de ensayo' productName='Producto de ensayo' tenantSlug='tenant-qa' eventId='715' freshToken={p.has('noCapability')?'':'synthetic-verified-capability'} initialTab='trivia' allowedActions={['rewards']} configuration={${JSON.stringify(configuration)}}/></section></main></SunLocaleProvider>);`;
const bundled = await build({ stdin: { contents: fixture, resolveDir: web, loader: 'tsx' }, bundle: true, write: false, outfile: 'fixture.js', format: 'esm', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'inert-fixture-navigation', setup(b) { b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'navigation' })); b.onLoad({ filter: /.*/, namespace: 'navigation' }, () => ({ contents: "import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>}", loader: 'tsx', resolveDir: web })); } }], logLevel: 'error' });
const globalCss = await postcss([tailwind()]).process(await readFile(join(web, 'src/app/globals.css'), 'utf8'), { from: join(web, 'src/app/globals.css') });
const js = bundled.outputFiles.find(file => file.path.endsWith('.js'));
const css = (bundled.outputFiles.find(file => file.path.endsWith('.css'))?.text || '') + '\n' + globalCss.css;
const server = createServer((req, res) => {
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  const path = new URL(req.url, 'http://fixture.invalid').pathname;
  if (path === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); return res.end(js.contents); }
  if (path === '/fixture.css') { res.setHeader('content-type', 'text/css'); return res.end(css); }
  if (path === '/favicon.ico') { res.writeHead(204); return res.end(); }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang='es-AR'><head><title>Tenant · ensayo local</title><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='stylesheet' href='/fixture.css'><style>body{margin:0;font:16px/1.5 system-ui}h1{font-size:24px}button,a{overflow-wrap:anywhere}</style></head><body><div id='app'></div><script type='module' src='/fixture.js'></script></body></html>`);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { localOnly: true, actualProductionComponentsAndCss: true, actualNextServer: false, nextLinkReplacedWithNativeAnchor: true, syntheticQuizApi: true, physicalTapMeasured: false, realBusinessWrites: 0, externalRequestsBlocked: [], geolocationCalls: 0, errors: [], checks: [], views: [] };
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
async function scenario({ width = 390, theme = 'light', read = { status: 404, payload: { ok: false, error: 'quiz_not_configured' } }, submit = { status: 200, payload: { ok: true, score: 1, total: 1, pointsAwarded: 10, requiresLogin: false, alreadyCompleted: false } }, query = '' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage(), calls = [];
  page.setDefaultTimeout(10_000);
  page.on('pageerror', e => report.errors.push(e.message));
  await page.addInitScript(theme => { document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', theme), { once: true }); window.__gpsCalls = 0; Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__gpsCalls++; } } }); }, theme);
  await page.route('**/*', async route => {
    const request = route.request(), u = new URL(request.url());
    if (u.origin !== origin) { report.externalRequestsBlocked.push(u.hostname); return route.abort(); }
    if (u.pathname.startsWith('/api/')) {
      calls.push({ path: u.pathname, method: request.method(), body: request.method() === 'POST' ? request.postDataJSON() : null });
      const response = request.method() === 'POST' ? submit : read;
      return route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.payload) });
    }
    return route.continue();
  });
  await page.goto(origin + '/?' + query, { waitUntil: 'networkidle' });
  return { page, calls, close: async () => { report.geolocationCalls += await page.evaluate(() => window.__gpsCalls); await context.close(); } };
}
async function assess(page, width, theme, name) {
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}/${theme}/${name}: no overflow`);
  const smallTargets = await page.locator('[data-testid="current-editorial-resources"] a,[data-testid="current-editorial-resources"] summary,.sun-engagement-suite button,.sun-engagement-suite a').evaluateAll(elements => elements.filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 44).map(e => ({ text: e.textContent, height: e.getBoundingClientRect().height })));
  check(smallTargets.length === 0, `${width}/${theme}/${name}: visible touch targets ${JSON.stringify(smallTargets)}`);
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async () => (await axe.run('main', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })));
  report.views.push({ width, theme, name, violations });
  check(violations.length === 0, `${width}/${theme}/${name}: zero axe violations`);
  await page.screenshot({ path: join(output, `${name}-${width}-${theme}.png`), fullPage: true });
}
try {
  for (const width of [320, 390, 768, 1280]) for (const theme of ['light', 'dark']) {
    const t = await scenario({ width, theme });
    await t.page.getByTestId('sun-trivia-unavailable').waitFor();
    check(!(await t.page.locator('.sun-engagement-suite').innerText()).includes('Cata, visita o voucher'), `${width}/${theme}: no local quiz on unconfigured tenant`);
    check(await t.page.getByTitle('Elegir respuesta 1').count() === 0, `${width}/${theme}: no playable unconfigured question`);
    await t.page.getByTestId('current-editorial-summary').click();
    check(await t.page.locator('[data-current-resource-kind="technical"]').getAttribute('href') === 'https://docs.example.test/current.pdf', `${width}/${theme}: current document only`);
    await assess(t.page, width, theme, 'unconfigured-current');
    check(t.calls.every(c => c.method === 'GET'), `${width}/${theme}: opening is read-only`);
    await t.close();
    const configured = await scenario({ width, theme, read: { status: 200, payload: quiz }, query: 'editorial=withdrawn' });
    await configured.page.getByTitle('Elegir respuesta 1').waitFor();
    check(await configured.page.locator('[data-current-resource-kind]').count() === 0, `${width}/${theme}: withdrawn document stays absent`);
    await assess(configured.page, width, theme, 'configured-withdrawn');
    await configured.page.getByTitle('Elegir respuesta 1').click();
    await configured.page.getByRole('button', { name: 'Finalizar trivia' }).click();
    await configured.page.getByText('Se confirmaron 10 puntos.').waitFor();
    check(configured.calls.filter(c => c.method === 'POST').length === 1, `${width}/${theme}: exactly one explicit submission`);
    const posted = configured.calls.find(c => c.method === 'POST').body;
    check(posted.fresh_token === 'synthetic-verified-capability' && posted.tenantSlug === 'tenant-qa' && posted.expectedQuizId === quiz.quiz.id && posted.expectedQuizRevision === quiz.quiz.revision && !('brandName' in posted), `${width}/${theme}: scoped capability and quiz publication in body without guessed product context`);
    check(await configured.page.getByRole('button', { name: 'Intentar de nuevo' }).count() === 0, `${width}/${theme}: no replay action after completion`);
    await configured.close();
  }
  for (const [name, read, submit, query] of [
    ['unauthorized', { status: 401, payload: { ok: false, error: 'unauthorized' } }, undefined, ''],
    ['invalid-quiz', { status: 200, payload: { ok: true, quiz: { id: 'qa', questions: [] } } }, undefined, ''],
    ['missing-capability', undefined, undefined, 'noCapability=1'],
    ['not-enrolled-get', { status: 409, payload: { ok: false, error: 'consumer_not_enrolled' } }, undefined, ''],
    ['not-enrolled-submit', { status: 200, payload: quiz }, { status: 409, payload: { ok: false, error: 'consumer_not_enrolled' } }, ''],
    ['expired-capability', { status: 200, payload: quiz }, { status: 403, payload: { ok: false, error: 'fresh_tap_capability_required' } }, ''],
    ['uncertain-submit', { status: 200, payload: quiz }, { status: 503, payload: { ok: false, error: 'backend_unavailable' } }, ''],
  ]) {
    const t = await scenario({ read, submit, query });
    if (submit) { await t.page.getByTitle('Elegir respuesta 1').click(); await t.page.getByRole('button', { name: 'Finalizar trivia' }).click(); }
    await t.page.getByTestId('sun-trivia-unavailable').waitFor();
    if (name.startsWith('not-enrolled-')) await t.page.getByText('La participación de tu cuenta no está habilitada para esta trivia. Consultá tus beneficios o contactá a la marca.', { exact: true }).waitFor();
    const text = await t.page.locator('.sun-engagement-suite').innerText();
    check(!/Resultado educativo local|Trivia completada|Puntos guardados|Cata, visita o voucher/.test(text), `${name}: no invented score, question or award`);
    check(await t.page.getByTitle('Elegir respuesta 1').count() === 0, `${name}: recovery prevents repeat submission`);
    if (name === 'missing-capability') check(t.calls.length === 0, 'missing capability makes no API request');
    if (submit) check(t.calls.filter(c => c.method === 'POST').length === 1, `${name}: one attempt only`);
    if (name.startsWith('not-enrolled-')) {
      check(text.includes('La participación de tu cuenta no está habilitada para esta trivia. Consultá tus beneficios o contactá a la marca.'), `${name}: definitive participation recovery`);
      check(!/No pudimos confirmar|Acercá de nuevo|bloqueada|eliminada/.test(text), `${name}: no uncertain result or private account reason`);
      check(await t.page.getByTestId('sun-trivia-unavailable').getByRole('link', { name: 'Consultar mis beneficios', exact: true }).getAttribute('href') === '/me/rewards', `${name}: existing benefits recovery link`);
      check(t.calls.filter(c => c.method === 'GET').length === 1, `${name}: one bounded quiz read`);
      if (submit) {
        check((await t.page.getByTestId('sun-trivia-saved-answers').innerText()).includes('Respuesta de ensayo uno'), `${name}: selected answer stays available`);
        check(await t.page.getByRole('button', { name: 'Finalizar trivia', exact: true }).count() === 0, `${name}: send lock remains closed`);
      } else {
        check(t.calls.filter(c => c.method === 'POST').length === 0, `${name}: denied setup submits nothing`);
        check(await t.page.getByTestId('sun-trivia-saved-answers').count() === 0, `${name}: no fabricated answer draft`);
      }
      await assess(t.page, 390, 'light', name);
    }
    await t.close();
  }
  check(report.geolocationCalls === 0, 'zero GPS calls');
  check(report.errors.length === 0, 'zero browser exceptions');
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(r => server.close(r));
}
console.log(JSON.stringify({ checks: report.checks.length, views: report.views.length, output, passed: report.checks.every(c => c.passed) }));
