import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.AXE_MODULE_PATH, 'Installed browser tools are required; this harness never downloads them');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
const dashboard = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(dashboard, '../..');
const output = resolve(process.env.QA_OUTPUT || 'artifacts/customer-activity-summary-browser');
await mkdir(output, { recursive: true });
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import LeadsTicketsClient from './src/app/(app)/leads-tickets/leads-tickets-client';
const row=(id,status)=>({id,tenant_slug:'qa-only',status,created_at:'2026-09-22T12:00:00.000Z',contact:'synthetic@example.invalid'});
const leads=[{...row('lead-1','closed'),name:'Prospecto sintético',notes:'No meeting, no llamada; text is not a booked meeting'},row('lead-2','closed'),row('lead-3','converted')];
const tickets=[{...row('81000000-0000-8000-8000-000000000001','open'),title:'Ticket sintético',detail:'Reporte sintético'}, {...row('81000000-0000-8000-8000-000000000002','pending'),title:'Consulta sintética',detail:'Sin operación productiva'}];
const orders=[{...row('order-1','completed'),company:'Organización sintética',volume:1}];
function Fixture(){
const [scenario,setScenario]=React.useState('normal'); window.__qaSetActivityScenario=setScenario;
const locale=new URLSearchParams(location.search).get('locale')||'es-AR';
const source=scenario==='demo'||scenario==='untrusted-demo'?'demo':'production';
const ready={availability:'ready',source};
const collections={leads:scenario==='denied'?{availability:'access_denied',source:'unavailable'}:ready,tickets:ready,orders:ready};
return <main className="dashboard-main mx-auto w-full max-w-7xl min-w-0 space-y-6 p-4 md:p-8">
<header><h1>Prueba local de actividad CRM</h1><p>Datos y transportes sintéticos. No se verifican clientes, autenticación ni producción.</p></header>
<LeadsTicketsClient initialLeads={scenario==='empty'?[]:leads} initialTickets={scenario==='empty'?[]:tickets} initialOrders={scenario==='empty'?[]:orders}
filteredOpportunities={[]} tenantScope={scenario==='foreign'?'other-company':'qa-only'} tenantFilter="qa-only" sessionFilter="" demoMode={scenario==='demo'} locale={locale} canLookupTickets={false}
leadsSource={source} signalCollections={collections} members={[]} memberDirectory={{availability:'ready',source}}
selectedMemberId="" memberTimeline={{availability:'not_selected',items:[],partial:false,sourceErrors:[],hasMore:false,nextCursor:null}}
copy={{shell:{loading:'Cargando',all:'Todos',refresh:'Actualizar'},statuses:{OPEN:'Abierto',PENDING:'Pendiente',CLOSED:'Cerrado'}}}
labels={{leads:'Prospectos',tickets:'Tickets',orders:'Pedidos',aiQueries:'Consultas IA'}} />
</main>;
} createRoot(document.getElementById('root')).render(<Fixture/>);`;
const navigation = `const router={refresh(){window.__qaRefreshes=(window.__qaRefreshes||0)+1},push(){throw Error('Unexpected navigation')},replace(){throw Error('Unexpected navigation')}}; export const useRouter=()=>router; export const usePathname=()=>'/leads-tickets'; export const useSearchParams=()=>new URLSearchParams(location.search);`;
const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: dashboard }, bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'navigation-only', setup(builder) {
  builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'qa' }));
  builder.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: navigation, loader: 'js' }));
} }] });
const content = [join(dashboard, 'src/**/*.{ts,tsx}').replaceAll('\\', '/'), join(root, 'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\', '/'), { raw: fixture, extension: 'tsx' }];
const css = (await postcss([tailwindcss({ content, darkMode: ['selector', '[data-theme="dark"]'], theme: { extend: { colors: { brand: { dark: '#020617', card: '#0f172a', border: '#1e293b', cyan: '#06b6d4', blue: '#3b82f6' } } } }, plugins: [] })]).process(await readFile(join(dashboard, 'src/app/globals.css'), 'utf8'), { from: undefined })).css + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).contents;
const server = createServer((req, res) => {
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  const url = new URL(req.url, 'http://qa.invalid');
  if (url.pathname === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return; }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (url.pathname !== '/') { res.writeHead(404); res.end(); return; }
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const locale = ['es-AR', 'en', 'pt-BR'].includes(url.searchParams.get('locale')) ? url.searchParams.get('locale') : 'es-AR';
  res.setHeader('content-type', 'text/html;charset=utf-8');
  res.end(`<!doctype html><html lang="${locale}" class="theme-${theme}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CRM activity · synthetic QA</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { syntheticData: true, actualComponent: 'LeadsTicketsClient', navigationStubbed: true, productionTested: false, checks: 0, views: 0, errors: [] };
function check(condition, message) { report.checks++; assert.ok(condition, message); }
try {
  for (const locale of ['es-AR', 'en', 'pt-BR']) for (const theme of ['light', 'dark']) for (const width of [320, 375, 430, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => report.errors.push(error.message));
    const requests = [];
    await page.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin !== origin || url.pathname.startsWith('/api/') || request.method() !== 'GET') { requests.push(request.url()); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/?locale=${locale}&theme=${theme}`);
    const summary = page.getByTestId('customer-activity-summary');
    await summary.waitFor();
    for (const [kind, value] of [['leads', '3'], ['tickets', '2'], ['orders', '1']]) check(await page.getByTestId(`activity-count-${kind}`).textContent() === value, `${kind} count`);
    check(await summary.locator('article').count() === 3, 'independent collections');
    await summary.locator('details summary').first().click();
    check((await summary.innerText()).includes('closed'), 'literal closed status stays closed');
    check(await summary.locator('script').count() === 0, 'no executable status markup');
    const targets = await summary.locator('button, summary').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
    check(targets.every(height => height >= 44), 'touch targets');
    await page.addScriptTag({ content: axe });
    const violations = await summary.evaluate(async root => (await axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations);
    check(violations.length === 0, JSON.stringify(violations));
    check(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'no horizontal overflow');
    if (locale === 'es-AR' && ((width === 375 && theme === 'light') || (width === 1440 && theme === 'dark'))) await summary.screenshot({ path: join(output, `summary-${width}-${theme}.png`) });
    // Use the real parent callback, not a stubbed onOpen, and keyboard activation.
    await page.getByRole('textbox', { name: 'Buscar señales por referencia, contacto o detalle' }).fill('no-matching-text');
    const open = summary.locator('button').nth(1); await open.focus(); await page.keyboard.press('Enter');
    check(await page.getByTestId('ticket-reference-lookup').isVisible(), 'summary opens existing ticket inbox');
    check(await page.getByRole('textbox', { name: 'Buscar señales por referencia, contacto o detalle' }).inputValue() === '', 'local search cleared');
    check(await page.evaluate(() => document.activeElement?.getAttribute('tabindex') === '-1'), 'focus transferred within workspace');
    check(requests.length === 0, 'no business request on collection navigation');
    if (width === 375) {
      for (const scenario of ['denied', 'foreign', 'untrusted-demo', 'demo', 'empty', 'normal']) {
        await page.evaluate(value => window.__qaSetActivityScenario(value), scenario);
        const expected = ['denied', 'foreign', 'untrusted-demo'].includes(scenario) ? '—' : scenario === 'empty' ? '0' : '3';
        await page.waitForFunction(value => document.querySelector('[data-testid="activity-count-leads"]')?.textContent === value, expected);
        check(await page.getByTestId('activity-count-leads').textContent() === expected, `${scenario} count`);
        check(await summary.locator('button').first().isDisabled() === (expected === '—'), `${scenario} action availability`);
        if (scenario === 'denied') check(await page.getByTestId('activity-count-tickets').textContent() === '2', 'partial healthy source retained');
      }
    }
    report.views++; await page.close();
  }
  check(report.errors.length === 0, JSON.stringify(report.errors));
  console.log(JSON.stringify({ status: 'passed', ...report }));
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise(done => server.close(done));
}
