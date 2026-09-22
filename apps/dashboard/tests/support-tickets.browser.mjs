import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.AXE_MODULE_PATH, 'Installed Playwright and axe paths are required; this harness never downloads tools');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
const out = resolve(process.env.QA_OUTPUT || 'artifacts/support-tickets-browser');
await mkdir(out, { recursive: true });
const dashboard = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(dashboard, '../..');
const ticketId = '81000000-0000-8000-8000-000000000001';
const legacyId = '81000000-0000-8000-8000-000000000002';
const legacyJsonId = '81000000-0000-8000-8000-000000000003';
const historicalId = '81000000-0000-8000-8000-000000000009';
const lookupId = suffix => `81000000-0000-8000-8000-${String(suffix).padStart(12, '0')}`;
const historicalDescription = 'Reporte histórico sintético fuera de los registros cargados. <script>Texto literal</script>';
function historicalPayload(id, tenant = 'qa-only') {
  return { ok: true, protocol: 'nexid.support-ticket-lookup.v1',
    scope: { mode: 'tenant', tenantId: '10000000-0000-4000-8000-000000000001', tenantSlug: tenant },
    ticket: { id, title: 'Reporte histórico sintético', detail: JSON.stringify({ protocol: 'nexid.support-report.v1', category: 'other', description: historicalDescription }), detail_state: 'available', status: 'pending', contact: null,
      created_at: '2025-01-02T12:30:00.000Z', bid: 'QA-HISTORICAL-ONLY', tap_event_id: '700', source: 'sun_public_report', category: 'other', locale: 'es-AR',
      tenant_id: '10000000-0000-4000-8000-000000000001', tenant_slug: tenant, tenant_name: 'Organización sintética QA' } };
}
const fingerprint = 'a'.repeat(64);
const description = 'Reporte sintético: el precinto llegó abierto y solicito revisión del lote de prueba.';
const legacyDescription = 'Consulta histórica sintética escrita antes del formato de reportes actual.';
const legacyJson = JSON.stringify({ motivo: 'Consulta JSON histórica sintética sin contrato v1', nota: '<b>texto literal</b>' });
const fixtureTickets = [
  { id: ticketId, title: 'Reporte sobre el producto · prueba sintética', contact: 'qa-support@example.invalid', status: 'open', source: 'sun_public_report', created_at: '2026-09-21T14:00:00.000Z', tenant_id: '10000000-0000-4000-8000-000000000001', bid: 'QA-SUPPORT-ONLY', tap_event_id: '715', category: 'seal_opened', detail: JSON.stringify({ protocol: 'nexid.support-report.v1', request_id: '30000000-0000-4000-8000-000000000001', fingerprint, tenant_id: '10000000-0000-4000-8000-000000000001', batch_id: '20000000-0000-4000-8000-000000000001', event_id: '715', consumer_id: null, category: 'seal_opened', description }) },
  { id: legacyId, title: 'Consulta histórica de prueba', contact: 'qa-legacy@example.invalid', status: 'closed', source: 'legacy_support', created_at: '2026-09-20T12:00:00.000Z', detail: legacyDescription },
  { id: legacyJsonId, title: 'Consulta JSON histórica · prueba sintética', contact: 'qa-legacy-json@example.invalid', status: 'pending', source: 'legacy_support', created_at: '2026-09-19T12:00:00.000Z', detail: legacyJson },
];
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import LeadsTicketsClient from './src/app/(app)/leads-tickets/leads-tickets-client';
const tickets=${JSON.stringify(fixtureTickets)};
const demo={availability:'ready',source:'demo'};
function Fixture() {
const [context,setContext]=React.useState({tenant:'qa-only',demo:false,canLookup:true});
window.__qaSetLookupContext=setContext;
const locale=new URLSearchParams(location.search).get('locale')||'es-AR';
return <main className="dashboard-main mx-auto w-full max-w-7xl min-w-0 space-y-6 p-4 md:p-8">
  <header><h1 className="text-2xl font-bold">Prueba local de tickets de soporte</h1><p className="mt-2 text-sm">Datos sintéticos: esta pantalla no demuestra tickets, clientes ni actividad productiva.</p></header>
  <LeadsTicketsClient initialLeads={[]} initialTickets={tickets} initialOrders={[]} filteredOpportunities={[]} tenantScope={context.tenant} sessionFilter="" tenantFilter={context.tenant} locale={locale} canLookupTickets={context.canLookup}
    copy={{shell:{loading:'Cargando',all:'Todos',refresh:'Actualizar'},statuses:{OPEN:'Abierto',PENDING:'Pendiente',CLOSED:'Cerrado'}}}
    labels={{leads:'Prospectos',tickets:'Tickets',orders:'Pedidos',hot:'Oportunidades',aiQueries:'Consultas IA'}} demoMode={context.demo} leadsSource="demo"
    signalCollections={{leads:demo,tickets:demo,orders:demo}} members={[]} memberDirectory={demo} selectedMemberId=""
    memberTimeline={{availability:'not_selected',items:[],partial:false,sourceErrors:[],hasMore:false,nextCursor:null}} />
</main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
// Only Next navigation is substituted: all ticket projections, search, table,
// timeline, shared UI primitives and application CSS are the actual source.
const nextNavigation = `
const router={refresh(){window.__qaRefreshes=(window.__qaRefreshes||0)+1},push(){throw Error('Unexpected QA navigation')},replace(){throw Error('Unexpected QA navigation')}};
export const useRouter=()=>router;
export const usePathname=()=>'/leads-tickets';
export const useSearchParams=()=>new URLSearchParams(location.search);
`;
const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: dashboard }, bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'local-next-navigation-only', setup(builder) {
  builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'qa' }));
  builder.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: nextNavigation, loader: 'js' }));
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
  res.end(`<!doctype html><html lang="es-AR" class="theme-${theme}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tickets de soporte · QA sintética local</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { localOnly: true, syntheticData: true, actualComponents: ['LeadsTicketsClient', 'DataTable', 'CustomerSignalTimeline', 'CustomerMemberTimeline', 'TicketReferenceLookup'], lookupApiMocked: true, navigationStubbed: true, realNextServer: false, realDatabase: false, productionTested: false, checks: [], views: [], clientErrors: [], blockedRequests: [] };
function check(condition, description) { report.checks.push({ description, passed: Boolean(condition) }); }
async function inspect(page, name, width, theme, target) {
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async () => (await axe.run('main', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  // The actual DataTable intentionally scrolls horizontally on narrow screens;
  // inspect its viewport rather than declaring that legitimate table scrolling is page overflow.
  const clipped = await page.locator(target).evaluate(element => {
    const box = element.getBoundingClientRect();
    return box.left < -1 || box.right > document.documentElement.clientWidth + 1;
  });
  const screenshot = `${name}-${width}-${theme}.png`;
  await page.locator(target).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(out, screenshot), fullPage: true });
  report.views.push({ name, width, theme, dimensions, clipped, violations, screenshot });
  check(violations.length === 0, `${name} ${width} ${theme}: axe zero violations`);
  check(dimensions.scrollWidth <= dimensions.width + 1 && !clipped, `${name} ${width} ${theme}: no page overflow or clipped report surface`);
}
try {
  for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => report.clientErrors.push({ width, theme, message: error.message, stack: error.stack }));
    const lookupCalls = [];
    const delayed = [];
    let retryCount = 0;
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || request.method() !== 'GET') { report.blockedRequests.push({ method: request.method(), url: url.origin + url.pathname }); return route.abort(); }
      if (url.pathname.startsWith('/api/admin/tickets/')) {
        const id = url.pathname.split('/').at(-1), tenant = url.searchParams.get('tenant');
        lookupCalls.push({ id, tenant });
        let status = 200, body = historicalPayload(id, tenant);
        if (id === lookupId(10)) { status = 404; body = { ok: false, reason: 'ticket_not_found' }; }
        if (id === lookupId(11)) { status = 403; body = { ok: false, reason: 'forbidden' }; }
        if (id === lookupId(12) && retryCount++ === 0) { status = 503; body = { ok: false, reason: 'ticket_lookup_unavailable' }; }
        if (id === lookupId(13)) body.scope.tenantSlug = 'other-tenant';
        if (id === lookupId(14)) await new Promise(resolve => delayed.push(resolve));
        if (id === lookupId(16)) { body.ticket.status = 'awaiting_supplier'; body.ticket.title = ' '; }
        if (id === lookupId(17)) { body.ticket.detail = null; body.ticket.detail_state = 'unavailable'; }
        await route.fulfill({ status, contentType: 'application/json', headers: { 'x-nexid-data-mode': 'production', 'cache-control': 'private, no-store' }, body: id === lookupId(15) ? '{invalid' : JSON.stringify(body) }).catch(() => {});
        return;
      }
      return route.continue();
    });
    await page.goto(`${origin}/?theme=${theme}`);
    await page.getByTestId('customer-signal-timeline').waitFor();
    const search = page.locator('input').first();
    const signals = page.getByTestId('customer-signal-timeline');
    check(/demo/i.test(await signals.innerText()), `${width} ${theme}: synthetic sources stay labelled demo`);
    await search.fill(ticketId);
    await page.waitForFunction(id => document.querySelector('[data-testid="customer-signal-timeline"]')?.textContent.includes(id), ticketId);
    check(await signals.locator('ol > li').count() === 1, `${width} ${theme}: Signals searches complete UUID`);
    check((await signals.innerText()).includes(description), `${width} ${theme}: Signals shows the confirmed readable description`);
    check(!(await signals.innerText()).includes(fingerprint), `${width} ${theme}: Signals never displays fingerprint`);
    await inspect(page, 'signals-reference', width, theme, '[data-testid="customer-signal-timeline"]');
    await page.getByRole('button', { name: /^Tickets de Soporte/ }).click();
    await page.locator('table').waitFor();
    check(await page.locator('tbody tr').count() === 1, `${width} ${theme}: tab change preserves reference search`);
    check((await page.locator('table').innerText()).includes(ticketId), `${width} ${theme}: Tickets exposes the complete reference`);
    check((await page.locator('table').innerText()).includes(description), `${width} ${theme}: Tickets projects the readable description`);
    check((await page.locator('table').innerText()).includes('QA-SUPPORT-ONLY') && (await page.locator('table').innerText()).includes('715'), `${width} ${theme}: Tickets retains batch and event context`);
    const downloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV', exact: true }).click();
    const download = await downloadReady, csvPath = join(out, `tickets-${width}-${theme}.csv`);
    await download.saveAs(csvPath);
    const csv = await readFile(csvPath, 'utf8');
    check(csv.includes(ticketId) && csv.includes(description) && !csv.includes(fingerprint), `${width} ${theme}: CSV preserves visible projection without raw metadata`);
    await search.fill('');
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3);
    const tableText = await page.locator('table').innerText();
    check(tableText.includes(legacyDescription), `${width} ${theme}: legacy free text remains readable`);
    check(!/fingerprint|nexid.support-report/.test(tableText), `${width} ${theme}: recognized support reports never show internal metadata`);
    check(tableText.includes(legacyJson) && await page.locator('table b').count() === 0, `${width} ${theme}: legacy JSON stays literal escaped text without inferred fields`);
    const tableRegion = page.locator('.data-table-shell');
    check(await tableRegion.getAttribute('tabindex') === '0' && await tableRegion.getAttribute('role') === 'region' && Boolean(await tableRegion.getAttribute('aria-label')), `${width} ${theme}: scrollable table is named and keyboard focusable`);
    if (await tableRegion.evaluate(element => element.scrollWidth > element.clientWidth)) {
      await tableRegion.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.data-table-shell').scrollLeft > 0);
      check(true, `${width} ${theme}: keyboard can reveal offscreen ticket columns`);
      await tableRegion.evaluate(element => { element.scrollLeft = 0; });
      await tableRegion.evaluate(element => element.blur());
    }
    await inspect(page, 'tickets-all', width, theme, '.data-table-card');
    await search.fill(legacyId);
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
    check((await page.locator('table').innerText()).includes(legacyDescription), `${width} ${theme}: legacy UUID search works`);
    await page.getByRole('button', { name: /^Señales de cliente/ }).click();
    await signals.waitFor();
    check(await signals.locator('ol > li').count() === 1 && (await signals.innerText()).includes(legacyDescription), `${width} ${theme}: Tickets to Signals preserves legacy reference search`);
    await search.fill(legacyJsonId);
    await page.waitForFunction(id => document.querySelector('[data-testid="customer-signal-timeline"]')?.textContent.includes(id), legacyJsonId);
    check((await signals.innerText()).includes(legacyJson) && await signals.locator('[data-detail-format="legacy"]').count() === 1 && await signals.locator('article b').count() === 0, `${width} ${theme}: Signals also preserves unknown JSON as escaped legacy text`);
    await search.fill('no-match-qa');
    await page.getByText('No hay señales que coincidan con este filtro.', { exact: true }).waitFor();
    check(await signals.locator('ol > li').count() === 0, `${width} ${theme}: unmatched reference is empty without fallback rows`);

    await search.fill('');
    await page.getByRole('button', { name: /^Tickets de Soporte/ }).click();
    const lookup = page.getByTestId('ticket-reference-lookup');
    const referenceInput = lookup.getByLabel('Referencia completa del ticket');
    const submitLookup = async id => { await referenceInput.fill(id); await lookup.getByRole('button', { name: /Buscar ticket|Reintentar búsqueda/ }).click(); };
    const lookupState = status => lookup.locator(`[data-lookup-state="${status}"]`).waitFor({ state: 'attached' });
    check(lookupCalls.length === 0, `${width} ${theme}: historical lookup never runs automatically`);
    await submitLookup('not-a-reference'); await lookupState('invalid');
    check(lookupCalls.length === 0, `${width} ${theme}: invalid reference never requests API`);
    await submitLookup(historicalId.toUpperCase()); await lookupState('found');
    const result = page.getByTestId('ticket-lookup-result');
    check((await result.innerText()).includes(historicalId) && (await result.innerText()).includes(historicalDescription), `${width} ${theme}: historical UUID outside recent list shows full reference and literal description`);
    check(await result.locator('script').count() === 0 && (await result.innerText()).includes('QA-HISTORICAL-ONLY') && (await result.innerText()).includes('700'), `${width} ${theme}: lookup escapes HTML and retains row batch/event`);
    check(lookupCalls.at(-1).tenant === 'qa-only' && lookupCalls.at(-1).id === historicalId, `${width} ${theme}: lookup sends canonical UUID and selected tenant`);
    check(await page.locator('tbody tr').count() === 3 && !(await page.locator('table').innerText()).includes(historicalId), `${width} ${theme}: lookup never changes the loaded ticket list`);
    const recentDownloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV', exact: true }).click();
    const recentDownload = await recentDownloadReady, recentPath = join(out, `after-lookup-${width}-${theme}.csv`);
    await recentDownload.saveAs(recentPath);
    check(!(await readFile(recentPath, 'utf8')).includes(historicalId), `${width} ${theme}: historical result stays outside recent CSV exports`);
    await inspect(page, 'historical-ticket-found', width, theme, '[data-testid="ticket-reference-lookup"]');
    await referenceInput.fill(lookupId(10));
    check(await result.count() === 0, `${width} ${theme}: editing reference immediately hides prior ticket`);
    await lookup.getByRole('button', { name: 'Buscar ticket', exact: true }).click(); await lookupState('not_found');
    check(await result.count() === 0, `${width} ${theme}: authorized absence never retains earlier details`);
    await submitLookup(lookupId(11)); await lookupState('forbidden');
    check(await result.count() === 0, `${width} ${theme}: forbidden response clears results`);
    await submitLookup(lookupId(12)); await lookupState('unconfirmed');
    check(await referenceInput.inputValue() === lookupId(12), `${width} ${theme}: unavailable response preserves entered reference`);
    await lookup.getByRole('button', { name: 'Reintentar búsqueda', exact: true }).click(); await lookupState('found');
    check((await result.innerText()).includes(lookupId(12)), `${width} ${theme}: retry can confirm same reference`);
    for (const id of [lookupId(13), lookupId(15)]) { await submitLookup(id); await lookupState('unconfirmed'); check(await result.count() === 0, `${width} ${theme}: scope mismatch or malformed response stays unconfirmed (${id})`); }
    await submitLookup(lookupId(16)); await lookupState('found');
    check((await result.innerText()).includes('awaiting_supplier') && (await result.innerText()).includes('Ticket registrado'), `${width} ${theme}: historical unknown status remains literal and blank title has neutral fallback`);
    await submitLookup(lookupId(17)); await lookupState('found');
    check((await result.innerText()).includes('El detalle registrado no está disponible en un formato compatible.'), `${width} ${theme}: unavailable detail is distinguished from no recorded detail`);
    await submitLookup(lookupId(14)); await lookupState('loading');
    await lookup.getByRole('button', { name: 'Cancelar búsqueda', exact: true }).click(); await lookupState('idle');
    delayed.splice(0).forEach(resolve => resolve());
    await submitLookup(historicalId); await lookupState('found');
    check((await result.innerText()).includes(historicalId) && !(await result.innerText()).includes(lookupId(14)), `${width} ${theme}: canceled older lookup cannot replace new result`);
    await submitLookup(lookupId(14)); await lookupState('loading');
    await page.evaluate(() => window.__qaSetLookupContext({ tenant: 'qa-second', demo: false, canLookup: true }));
    await lookupState('idle');
    delayed.splice(0).forEach(resolve => resolve());
    check(await result.count() === 0 && await referenceInput.inputValue() === '', `${width} ${theme}: tenant change clears old reference and result`);
    await submitLookup(historicalId); await lookupState('found');
    check(lookupCalls.at(-1).tenant === 'qa-second', `${width} ${theme}: next lookup uses new tenant only`);
    const beforeRestrictions = lookupCalls.length;
    await page.evaluate(() => window.__qaSetLookupContext({ tenant: 'qa-second', demo: true, canLookup: true }));
    await lookup.getByText('La búsqueda de tickets reales no está disponible en modo demo.', { exact: true }).waitFor();
    check(await lookup.locator('input').count() === 0 && await result.count() === 0, `${width} ${theme}: demo hides lookup form and prior result`);
    await page.evaluate(() => window.__qaSetLookupContext({ tenant: 'qa-second', demo: false, canLookup: false }));
    await lookup.getByText('Tu rol no tiene permiso para buscar tickets por referencia.', { exact: true }).waitFor();
    check(await lookup.locator('input').count() === 0 && lookupCalls.length === beforeRestrictions, `${width} ${theme}: missing capability never triggers lookup`);
    await context.close();
  }
  for (const variant of [
    { locale: 'en', theme: 'light', width: 390, label: 'Complete ticket reference', submit: 'Find ticket', status: 'Current status', reference: 'Ticket reference', reason: 'Other reason' },
    { locale: 'pt-BR', theme: 'dark', width: 1440, label: 'Referência completa do ticket', submit: 'Buscar ticket', status: 'Estado atual', reference: 'Referência do ticket', reason: 'Outro motivo' },
  ]) {
    const context = await browser.newContext({ viewport: { width: variant.width, height: 960 }, reducedMotion: 'reduce', serviceWorkers: 'block', locale: variant.locale });
    const page = await context.newPage();
    page.on('pageerror', error => report.clientErrors.push({ locale: variant.locale, message: error.message }));
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || request.method() !== 'GET') { report.blockedRequests.push({ method: request.method(), url: url.origin + url.pathname }); return route.abort(); }
      if (url.pathname.startsWith('/api/admin/tickets/')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-nexid-data-mode': 'production' }, body: JSON.stringify(historicalPayload(historicalId)) });
      return route.continue();
    });
    await page.goto(`${origin}/?theme=${variant.theme}&locale=${variant.locale}`);
    await page.getByRole('button', { name: /^Tickets de Soporte/ }).click();
    const lookup = page.getByTestId('ticket-reference-lookup');
    await lookup.getByLabel(variant.label).fill(historicalId);
    await lookup.getByRole('button', { name: variant.submit, exact: true }).click();
    await lookup.locator('[data-lookup-state="found"]').waitFor();
    const text = await page.getByTestId('ticket-lookup-result').innerText();
    check(text.includes(variant.status) && text.includes(variant.reference) && text.includes(variant.reason), `${variant.locale}: lookup labels, reason and status are localized`);
    check(text.includes(historicalDescription) && text.includes('UTC'), `${variant.locale}: customer text remains original and time explicitly UTC`);
    await inspect(page, `historical-ticket-${variant.locale}`, variant.width, variant.theme, '[data-testid="ticket-reference-lookup"]');
    await context.close();
  }
  assert.deepEqual(report.clientErrors, [], 'No client exceptions');
  assert.deepEqual(report.blockedRequests, [], 'Components must not attempt external requests or writes');
  assert.deepEqual(report.checks.filter(item => !item.passed), [], 'Every behavioral, accessibility and layout check must pass');
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = String(error.stack || error); throw error; }
finally {
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(done => server.close(done));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failed: report.checks.filter(item => !item.passed), views: report.views.length, output: out }, null, 2));
}
