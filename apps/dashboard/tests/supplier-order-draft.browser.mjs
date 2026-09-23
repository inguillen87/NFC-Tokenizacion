import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.AXE_MODULE_PATH, 'Use installed Playwright and axe; this harness never downloads tools');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axeSource = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
const dashboard = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(dashboard, '../..');
const output = resolve(process.env.QA_OUTPUT || 'artifacts/supplier-order-draft-browser');
await mkdir(output, { recursive: true });

const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import CreateSupplierOrderPage from './src/app/(app)/supplier-orders/create/page';
createRoot(document.getElementById('root')).render(<div className="dashboard-main mx-auto w-full max-w-7xl min-w-0 p-4 md:p-8">
  <aside aria-label="Alcance de la prueba" className="mb-4 text-sm">Prueba local con datos sintéticos. No crea pedidos, lotes ni claves reales.</aside>
  <CreateSupplierOrderPage/>
</div>);
`;
const nextNavigation = `
const router={push(url){(window.__qaNavigations ||= []).push(url)},replace(url){(window.__qaNavigations ||= []).push(url)},refresh(){window.__qaRefreshes=(window.__qaRefreshes||0)+1},back(){throw Error('Unexpected QA back navigation')}};
export const useRouter=()=>router;
export const usePathname=()=>'/supplier-orders/create';
export const useSearchParams=()=>new URLSearchParams(location.search);
`;
// The page, permission policy, draft policy, UI primitives and CSS are actual
// application source. Only Next navigation and the HTTP boundary are synthetic.
const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: dashboard }, bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'synthetic-next-navigation', setup(builder) {
  builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'qa-navigation' }));
  builder.onLoad({ filter: /.*/, namespace: 'qa-navigation' }, () => ({ contents: nextNavigation, loader: 'js' }));
} }] });
const globalCss = await readFile(join(dashboard, 'src/app/globals.css'), 'utf8');
const content = [join(dashboard, 'src/**/*.{ts,tsx}').replaceAll('\\', '/'), join(root, 'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\', '/'), { raw: fixture, extension: 'tsx' }];
const css = (await postcss([tailwindcss({ content, darkMode: ['selector', '[data-theme="dark"]'], theme: { extend: { colors: { brand: { dark: '#020617', card: '#0f172a', border: '#1e293b', cyan: '#06b6d4', blue: '#3b82f6' } } } }, plugins: [] })]).process(globalCss, { from: undefined })).css
  + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).contents;
const server = createServer((req, res) => {
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  const url = new URL(req.url, 'http://qa.invalid');
  if (url.pathname === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return; }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (url.pathname !== '/') { res.writeHead(404); res.end(); return; }
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  res.setHeader('content-type', 'text/html;charset=utf-8');
  res.end(`<!doctype html><html lang="es-AR" class="theme-${theme}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preparación de pedido · QA sintética local</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
});
for (let port = 34420; ; port++) {
  try { await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); }); server.removeAllListeners('error'); break; }
  catch (error) { server.removeAllListeners('error'); if (error.code !== 'EADDRINUSE' || port >= 34429) throw error; }
}
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { localOnly: true, syntheticData: true, actualComponents: ['CreateSupplierOrderPage'], actualDraftPolicy: true, sessionTransportMocked: true, supplierOrderTransportMocked: true, navigationStubbed: true, realNextServer: false, realDatabase: false, realKeysGenerated: false, productionTested: false, checks: [], views: [], clientErrors: [], blockedRequests: [] };
const profileIds = ['pet_wet', 'white_wet', 'dry_inlay', 'tt_bridge', 'tt_void', 'uhf_label', 'uhf_metal'];
const orderId = '91000000-0000-4000-8000-000000000001';
const principal = { id: '91000000-0000-4000-8000-000000000002', role: 'tenant-owner', tenantId: '91000000-0000-4000-8000-000000000003', tenantSlug: 'qa-only', label: 'Operador sintético QA', permissions: ['supplier_order.create', 'batch.keys.generate'], deniedPermissions: [], mfaVerified: true, isDemo: false };
const data = { order_name: 'Pedido sintético para conservar', base_batch_id: 'QA-BROWSER-SUPPLIER', total_quantity: '125', sub_batch_size: '50', notes: 'Conservar esta nota sintética al cambiar la construcción. <b>Texto literal</b>' };
const fields = { order_name: '#supplier-order-name', base_batch_id: '#supplier-order-base-batch-id', total_quantity: '#supplier-order-total-quantity', sub_batch_size: '#supplier-order-sub-batch-size', notes: '#supplier-order-notes' };
function check(condition, description) { report.checks.push({ description, passed: Boolean(condition) }); }
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function waitForTransport(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate() && Date.now() < deadline) await new Promise(done => setTimeout(done, 20));
  assert.ok(predicate(), 'Expected synthetic transport request was observed');
}
async function inspect(page, name, width, theme) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await axe.run('main', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  const clipped = await page.locator('main').evaluate(element => { const box = element.getBoundingClientRect(); return box.left < -1 || box.right > document.documentElement.clientWidth + 1; });
  // globals.css clips body overflow. Check actual visible controls as well so
  // a cropped field cannot pass merely because document.scrollWidth is bounded.
  const clippedControls = await page.locator('main input, main textarea, main select, main button, main fieldset, [data-testid="supplier-order-draft-summary"]').evaluateAll(nodes => nodes.filter(node => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > document.documentElement.clientWidth + 1);
  }).map(node => node.id || node.getAttribute('data-testid') || node.tagName));
  const screenshot = `${name}-${width}-${theme}.png`;
  await page.screenshot({ path: join(output, screenshot), fullPage: true });
  report.views.push({ name, width, theme, dimensions, clipped, clippedControls, violations, screenshot });
  check(!violations.some(v => v.impact === 'serious' || v.impact === 'critical'), `${name} ${width} ${theme}: axe serious/critical zero`);
  check(dimensions.scrollWidth <= dimensions.width + 1 && !clipped && clippedControls.length === 0, `${name} ${width} ${theme}: no page overflow or clipped form`);
}
async function launchScenario(width, theme, sessionScenario = 'operator') {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.clientErrors.push({ width, theme, scenario: sessionScenario, message: error.message }));
  const state = { writes: [], sessionReads: 0, mode: 'success', delayed: [] };
  const session = sessionScenario === 'viewer' ? { ...principal, role: 'viewer' }
    : sessionScenario === 'denied' ? { ...principal, deniedPermissions: ['supplier_order.create'] }
      : sessionScenario === 'demo' ? { ...principal, isDemo: true }
        : sessionScenario === 'no-keys' ? { ...principal, permissions: ['supplier_order.create'] }
          : sessionScenario === 'no-mfa' ? { ...principal, mfaVerified: false } : principal;
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { report.blockedRequests.push({ method: request.method(), url: url.origin + url.pathname }); return route.abort(); }
    if (request.method() === 'GET' && url.pathname === '/api/session/current') {
      state.sessionReads++;
      // A valid-looking JSON body on HTTP 500 must never authorize the form.
      return route.fulfill({ status: sessionScenario === 'session-500' ? 500 : 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session }) });
    }
    if (request.method() === 'POST' && url.pathname === '/api/admin/supplier-orders') {
      state.writes.push(request.postDataJSON());
      if (state.mode === 'delayed' || state.mode === 'hang') { state.delayed.push(route); return; }
      if (state.mode === 'network') return route.abort('failed');
      if (state.mode === 'unavailable') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'synthetic_service_unavailable' }) });
      if (state.mode === 'rejected') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'invalid_payload' }) });
      if (state.mode === 'timeout-status') return route.fulfill({ status: 408, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'request_timeout' }) });
      if (state.mode === 'non-json') return route.fulfill({ status: 400, contentType: 'text/html', body: '<p>Synthetic intermediary response, not an authoritative API rejection.</p>' });
      if (state.mode === 'contradictory') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: true, order: { id: orderId, tenant_slug: 'qa-only' } }) });
      if (state.mode === 'malformed') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, order: { id: 'not-a-real-order-id', tenant_slug: 'qa-only' } }) });
      if (state.mode === 'missing-tenant') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, order: { id: orderId } }) });
      if (state.mode === 'foreign-tenant') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, order: { id: orderId, tenant_slug: 'foreign-company' } }) });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, order: { id: orderId, tenant_slug: 'qa-only' } }) });
    }
    if (request.method() === 'GET' && ['/', '/fixture.js', '/favicon.ico'].includes(url.pathname)) return route.continue();
    report.blockedRequests.push({ method: request.method(), url: url.origin + url.pathname });
    return route.abort();
  });
  await page.goto(`${origin}/?theme=${theme}&tenant=foreign-company&pack_purpose=production`, { waitUntil: 'networkidle' });
  await page.getByTestId('supplier-order-submit').waitFor();
  return { context, page, state };
}
async function fillDraft(page) {
  const advanced = page.locator('details').filter({ has: page.locator('#supplier-order-sub-batch-size') });
  if (!(await advanced.evaluate(node => node.open))) await advanced.locator('summary').click();
  for (const [field, value] of Object.entries(data)) await page.locator(fields[field]).fill(value);
}
async function applyProfile(page, id) {
  await page.getByTestId('supplier-construction-select').selectOption(id);
  await page.getByTestId('supplier-construction-apply').click();
}
async function assertPreserved(page, prefix) {
  for (const [field, value] of Object.entries(data)) check(await page.locator(fields[field]).inputValue() === value, `${prefix}: preserves ${field}`);
}
async function readyDraft(page, profile = 'pet_wet') {
  await fillDraft(page);
  await applyProfile(page, profile);
  if (profile.startsWith('uhf_')) await page.locator('#supplier-order-chip-model').fill('UCODE_9');
  await page.locator('input[name="pack_purpose"][value="trial_integration"]').check();
}

try {
  for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
    const tag = `${width} ${theme}`;
    const { context, page, state } = await launchScenario(width, theme);
    check(await page.locator('#supplier-order-tenant-slug').inputValue() === 'qa-only', `${tag}: tenant comes from session, never query string`);
    check(await page.locator('#supplier-order-tenant-slug').evaluate(node => node.readOnly || node.disabled), `${tag}: tenant-bound principal cannot edit company`);
    check(await page.locator('input[name="pack_purpose"]:checked').count() === 0, `${tag}: URL never preauthorizes purpose`);
    check(await page.locator('#supplier-order-total-quantity').inputValue() === '', `${tag}: sample-email quantity is not silently applied`);
    check(await page.getByTestId('supplier-order-submit').isDisabled(), `${tag}: incomplete draft cannot submit`);
    const options = await page.getByTestId('supplier-construction-select').locator('option').evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean));
    check(JSON.stringify(options) === JSON.stringify(profileIds), `${tag}: all seven supported constructions are offered`);
    await inspect(page, 'empty-draft', width, theme);
    await fillDraft(page);
    for (const id of profileIds) {
      const chipBeforeSelection = await page.locator('#supplier-order-chip-model').inputValue();
      await page.getByTestId('supplier-construction-select').selectOption(id);
      check(await page.locator('#supplier-order-chip-model').inputValue() === chipBeforeSelection, `${tag} ${id}: selecting alone does not apply preset`);
      await page.getByTestId('supplier-construction-apply').click();
      await assertPreserved(page, `${tag} ${id}`);
      check(await page.locator('input[name="pack_purpose"]:checked').count() === 0, `${tag} ${id}: preset preserves explicit purpose requirement`);
      check(Boolean(await page.locator('#supplier-order-material-type').inputValue()), `${tag} ${id}: applies material suggestion`);
      if (id.startsWith('uhf_')) {
        check(await page.locator('#supplier-order-chip-model').inputValue() === '', `${tag} ${id}: unknown UHF model is never invented`);
      } else {
        const expectedChip = id.startsWith('tt_') ? 'NTAG424_DNA_TT' : 'NTAG424_DNA';
        check(await page.locator('#supplier-order-chip-model').inputValue() === expectedChip, `${tag} ${id}: chip matches secure construction`);
      }
    }
    check(state.writes.length === 0, `${tag}: choosing and applying all presets performs no writes`);
    await page.locator('input[name="pack_purpose"][value="trial_integration"]').check();
    for (const id of ['uhf_label', 'uhf_metal']) {
      await applyProfile(page, id);
      await page.locator('form').evaluate(form => form.requestSubmit());
      await tick(page);
      check(state.writes.length === 0 && !(await page.locator('#supplier-order-chip-model').evaluate(node => node.checkValidity())), `${tag} ${id}: missing UHF model blocks submission even with explicit purpose`);
      await page.locator('#supplier-order-chip-model').fill('UCODE_9');
      check(!await page.getByTestId('supplier-order-submit').isDisabled(), `${tag} ${id}: explicit UHF model makes draft valid`);
    }
    await page.locator('#supplier-order-carrier-profile').selectOption('ntag213');
    await page.locator('form').evaluate(form => form.requestSubmit());
    await tick(page);
    check(state.writes.length === 0 && await page.getByRole('alert').count() > 0, `${tag}: UHF chip cannot silently become static NFC through advanced carrier selection`);
    await applyProfile(page, 'tt_bridge');
    await page.locator('input[name="pack_purpose"][value="trial_integration"]').check();
    const summary = await page.getByTestId('supplier-order-draft-summary').innerText();
    check(/3\s+(?:sub)?lotes/i.test(summary) && await page.getByTestId('supplier-order-draft-summary').getAttribute('data-sub-batch-count') === '3', `${tag}: split summary reports 125 / 50 as three sub-batches`);
    await inspect(page, 'review-draft', width, theme);
    const expectedPayload = { tenant_slug: 'qa-only', customer_slug: (await page.locator('#supplier-order-customer-slug').inputValue()).trim() || 'qa-only', order_name: data.order_name, base_batch_id: data.base_batch_id, total_quantity: 125, sub_batch_size: 50, chip_model: await page.locator('#supplier-order-chip-model').inputValue(), carrier_profile_code: await page.locator('#supplier-order-carrier-profile').inputValue(), material_type: await page.locator('#supplier-order-material-type').inputValue(), notes: data.notes, pack_purpose: 'trial_integration' };
    state.mode = 'delayed';
    // Dispatch same-tick submissions to exercise the synchronous in-flight guard,
    // beyond the visual disabled button applied after React's render.
    await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await page.waitForFunction(() => document.querySelector('[data-testid="supplier-order-submit"]')?.disabled);
    await waitForTransport(() => state.delayed.length > 0);
    await tick(page);
    check(state.writes.length === 1 && state.delayed.length === 1, `${tag}: duplicate submit produces one POST while pending`);
    check(isDeepStrictEqual(state.writes[0], expectedPayload), `${tag}: POST contains only selected tenant and exact reviewed API fields`);
    for (const route of state.delayed.splice(0)) await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, order: { id: orderId, tenant_slug: 'qa-only' } }) });
    await page.waitForFunction(() => (window.__qaNavigations || []).length > 0);
    check(JSON.stringify(await page.evaluate(() => window.__qaNavigations)) === JSON.stringify([`/supplier-orders/${orderId}?tenant=qa-only`]), `${tag}: confirmed valid response opens exact order with tenant context`);
    await context.close();

    for (const denied of ['viewer', 'denied', 'demo', 'session-500', 'no-keys', 'no-mfa']) {
      const test = await launchScenario(width, theme, denied);
      if (denied === 'no-keys' || denied === 'no-mfa') await readyDraft(test.page);
      check(await test.page.getByTestId('supplier-order-submit').isDisabled(), `${tag} ${denied}: session cannot authorize a write`);
      await test.page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await tick(test.page);
      check(test.state.writes.length === 0, `${tag} ${denied}: form submission cannot bypass authority`);
      await inspect(test.page, `authority-${denied}`, width, theme);
      if (denied === 'no-keys' || denied === 'no-mfa') {
        await applyProfile(test.page, 'uhf_label');
        await test.page.locator('#supplier-order-chip-model').fill('UCODE_9');
        check(!await test.page.getByTestId('supplier-order-submit').isDisabled(), `${tag} ${denied}: UHF does not inherit secure NFC prerequisites`);
        await test.page.getByTestId('supplier-order-submit').click();
        await test.page.waitForFunction(() => (window.__qaNavigations || []).length > 0);
        check(test.state.writes.length === 1 && test.state.writes[0].carrier_profile_code === 'uhf_rfid' && test.state.writes[0].chip_model === 'UCODE_9', `${tag} ${denied}: explicit UHF payload can be submitted without batch-key authority`);
      }
      await test.context.close();
    }
    for (const failure of ['rejected', 'unavailable', 'network', 'malformed', 'missing-tenant', 'foreign-tenant', 'timeout-status', 'non-json', 'contradictory']) {
      const test = await launchScenario(width, theme);
      await readyDraft(test.page);
      test.state.mode = failure;
      await test.page.getByTestId('supplier-order-submit').click();
      await test.page.getByRole('alert').first().waitFor();
      await tick(test.page);
      await assertPreserved(test.page, `${tag} ${failure}`);
      check(test.state.writes.length === 1 && !(await test.page.evaluate(() => window.__qaNavigations?.length)), `${tag} ${failure}: no automatic retry or fabricated success navigation`);
      if (failure !== 'rejected') {
        check(await test.page.getByTestId('supplier-order-submit').isDisabled(), `${tag} ${failure}: uncertain result locks repeat submission`);
        check(await test.page.getByRole('link', { name: /Consultar pedidos/i }).count() === 1, `${tag} ${failure}: uncertain result offers existing order consultation`);
        await test.page.locator('form').evaluate(form => form.requestSubmit());
        await tick(test.page);
        check(test.state.writes.length === 1, `${tag} ${failure}: programmatic resubmit also preserves uncertain lock`);
        if (failure === 'unavailable') {
          await test.page.getByTestId('supplier-order-review-uncertain').click();
          await tick(test.page);
          check(test.state.writes.length === 1, `${tag} ${failure}: explicit review acknowledgement never submits automatically`);
          await assertPreserved(test.page, `${tag} ${failure} acknowledged`);
        }
      }
      if (failure === 'unavailable' || failure === 'rejected') await inspect(test.page, `write-${failure}`, width, theme);
      await test.context.close();
    }
  }
  // One real client deadline, without fake timers or shorter test-only runtime
  // settings. The route stays intercepted; no supplier API ever receives it.
  const timed = await launchScenario(390, 'light');
  await readyDraft(timed.page);
  timed.state.mode = 'hang';
  const startedAt = Date.now();
  await timed.page.getByTestId('supplier-order-submit').click();
  await timed.page.getByTestId('supplier-order-uncertain').waitFor({ timeout: 45000 });
  const elapsedMs = Date.now() - startedAt;
  check(elapsedMs >= 15000 && elapsedMs < 45000, 'Unresponsive POST becomes uncertain within the actual bounded client deadline');
  check(timed.state.writes.length === 1 && await timed.page.getByTestId('supplier-order-submit').isDisabled(), 'Timed out POST stays single and requires review before another attempt');
  await assertPreserved(timed.page, 'actual-deadline');
  await inspect(timed.page, 'write-client-deadline', 390, 'light');
  await timed.context.close();
  assert.deepEqual(report.clientErrors, [], 'No client exceptions');
  assert.deepEqual(report.blockedRequests, [], 'No external calls or unexpected writes');
  assert.deepEqual(report.checks.filter(item => !item.passed), [], 'Every behavior, accessibility and layout check must pass');
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = String(error.stack || error); throw error; }
finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(done => server.close(done));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failed: report.checks.filter(item => !item.passed), views: report.views.length, output }, null, 2));
}
