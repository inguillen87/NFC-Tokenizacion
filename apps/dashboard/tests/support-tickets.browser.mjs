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
createRoot(document.getElementById('root')).render(<main className="dashboard-main mx-auto w-full max-w-7xl min-w-0 space-y-6 p-4 md:p-8">
  <header><h1 className="text-2xl font-bold">Prueba local de tickets de soporte</h1><p className="mt-2 text-sm">Datos sintéticos: esta pantalla no demuestra tickets, clientes ni actividad productiva.</p></header>
  <LeadsTicketsClient initialLeads={[]} initialTickets={tickets} initialOrders={[]} filteredOpportunities={[]} tenantScope="qa-only" sessionFilter="" tenantFilter="qa-only"
    copy={{shell:{loading:'Cargando',all:'Todos',refresh:'Actualizar'},statuses:{OPEN:'Abierto',PENDING:'Pendiente',CLOSED:'Cerrado'}}}
    labels={{leads:'Prospectos',tickets:'Tickets',orders:'Pedidos',hot:'Oportunidades',aiQueries:'Consultas IA'}} demoMode={false} leadsSource="demo"
    signalCollections={{leads:demo,tickets:demo,orders:demo}} members={[]} memberDirectory={demo} selectedMemberId=""
    memberTimeline={{availability:'not_selected',items:[],partial:false,sourceErrors:[],hasMore:false,nextCursor:null}} />
</main>);
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
const report = { localOnly: true, syntheticData: true, actualComponents: ['LeadsTicketsClient', 'DataTable', 'CustomerSignalTimeline', 'CustomerMemberTimeline'], navigationStubbed: true, realNextServer: false, realDatabase: false, productionTested: false, checks: [], views: [], clientErrors: [], blockedRequests: [] };
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
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || request.method() !== 'GET') { report.blockedRequests.push({ method: request.method(), url: url.origin + url.pathname }); return route.abort(); }
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
