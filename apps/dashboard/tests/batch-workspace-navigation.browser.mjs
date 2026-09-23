import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.AXE_MODULE_PATH, 'Use installed browser tools, never download from this harness');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
const directory = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.env.QA_OUTPUT || 'artifacts/batch-workspace-navigation');
await mkdir(output, { recursive: true });
const bid = 'QA-TRACE:2026 + ñ';
const views = ['overview', 'passport', 'production', 'channels', 'traceability', 'intake', 'recalls'];
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BatchWorkspaceNavigation} from './src/components/batch-workspace-navigation';
import {buildBatchWorkspaceNavigation} from './src/lib/batch-workspace-navigation';
const view=location.pathname.split('/')[3]||'overview';
const bid=decodeURIComponent(location.pathname.split('/')[2]||'');
const tenant=new URLSearchParams(location.search).get('tenant')||'';
function Fixture(){
 const [scenario,setScenario]=React.useState('operator'); window.__qaNavigationScenario=setScenario;
 const base={role:'tenant-admin',tenantSlug:'qa-only',permissions:['batches:read','logistics:read','incidents:read'],deniedPermissions:[],isDemo:false};
 const session=scenario==='viewer'?{...base,role:'viewer',permissions:['batches:read']}:scenario==='denied'?{...base,deniedPermissions:['batches:read']}:scenario==='demo'?{...base,isDemo:true}:base;
 const selectedTenant=scenario==='foreign'?'other-company':tenant;
 const model=buildBatchWorkspaceNavigation(bid,selectedTenant,view,session);
 return <main><h1>Synthetic batch navigation QA</h1><p className="qa">No customer, physical NFC, database or authenticated session is tested.</p>
   <BatchWorkspaceNavigation model={model} locale={document.documentElement.lang}/><section aria-label="Synthetic destination"><h2>{view}</h2><p>Destination content is synthetic; the navigation and access projection are actual application modules.</p></section>
 </main>;
} createRoot(document.getElementById('root')).render(<Fixture/>);`;
const result = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: directory }, bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', plugins: [{ name: 'native-links-only', setup(builder) {
  builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'qa' }));
  builder.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: `import React from 'react';export default function Link({prefetch,children,...props}){return <a {...props} data-prefetch={String(prefetch)}>{children}</a>}`, loader: 'jsx', resolveDir: directory }));
} }] });
const js = result.outputFiles.find(file => file.path.endsWith('.js')).contents;
const css = result.outputFiles.find(file => file.path.endsWith('.css')).text;
const requests = [];
const server = createServer((req, res) => {
  requests.push({ method: req.method, url: req.url });
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  const url = new URL(req.url, 'http://qa.invalid');
  if (url.pathname === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return; }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (!url.pathname.startsWith('/batches')) { res.writeHead(404); res.end(); return; }
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(pair => pair.trim().split('=')));
  const locale = ['es-AR', 'en', 'pt-BR'].includes(cookies.qa_locale) ? cookies.qa_locale : 'es-AR';
  const theme = cookies.qa_theme === 'dark' ? 'dark' : 'light';
  res.setHeader('content-type', 'text/html;charset=utf-8');
  res.end(`<!doctype html><html lang="${locale}" class="theme-${theme}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Batch navigation QA</title><style>body{margin:0;background:${theme==='dark'?'#061221':'#f5f9fc'};color:${theme==='dark'?'#eaf5fe':'#19354a'};font-family:Arial,sans-serif}main{max-width:1400px;margin:auto;padding:16px;box-sizing:border-box}h1{font-size:22px}.qa{font-size:13px;line-height:1.5}section{padding:16px;border:1px dashed currentColor;border-radius:14px} ${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
});
for (let port = 34120; ; port++) {
  try { await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); }); server.removeAllListeners('error'); break; }
  catch (error) { server.removeAllListeners('error'); if (error.code !== 'EADDRINUSE' || port >= 34129) throw error; }
}
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { syntheticData: true, actualNavigation: true, nextLinkSubstitutedByNativeAnchor: true, destinationBodiesSynthetic: true, productionTested: false, authenticatedSession: false, views: 0, routeHops: 0, checks: 0, errors: [] };
function check(value, message) { report.checks++; assert.ok(value, message); }
try {
  for (const locale of ['es-AR','en','pt-BR']) for (const theme of ['light','dark']) for (const width of [320,375,768,1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1050 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addCookies([{ name: 'qa_locale', value: locale, url: origin }, { name: 'qa_theme', value: theme, url: origin }]);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || url.pathname.startsWith('/api/') || request.method() !== 'GET') { report.errors.push('Unexpected request'); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/batches/${encodeURIComponent(bid)}?tenant=qa-only&cursor=discard-this&token=synthetic-token`);
    const nav = page.getByTestId('batch-workspace-navigation');
    for (const view of views) {
      if (view !== 'overview') {
        const link = nav.locator(`[data-destination="${view}"] a`);
        await link.focus(); await page.keyboard.press('Enter');
        await page.waitForURL(url => url.pathname.endsWith('/'+view)); report.routeHops++;
      }
      await nav.locator('[aria-current="page"]').waitFor();
      check(await nav.locator(`[data-destination="${view}"] [aria-current="page"]`).count() === 1, 'correct current page');
      check((await nav.innerText()).includes('qa-only') && (await nav.innerText()).includes(bid), 'exact batch and company visible');
      const links = await nav.locator('a').evaluateAll(nodes => nodes.map(a => ({ href: a.getAttribute('href'), height: a.getBoundingClientRect().height, prefetch: a.dataset.prefetch, target: a.target })));
      check(links.length === 7, 'available destinations plus scoped batch list');
      check(links.every(link => link.height >= 44 && link.prefetch === 'false' && !link.target), 'touch targets and no new windows');
      check(links.every(link => { const u = new URL(link.href, origin); return u.origin === origin && JSON.stringify([...u.searchParams]) === JSON.stringify([['tenant','qa-only']]); }), 'only authoritative context carried');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
      await page.addScriptTag({ content: axe });
      const violations = await nav.evaluate(async node => (await axe.run(node, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } })).violations);
      check(violations.length === 0, JSON.stringify(violations)); report.views++;
      if (view === 'overview' && locale === 'es-AR' && ((width===375&&theme==='light')||(width===1440&&theme==='dark'))) await nav.screenshot({ path: join(output, `navigation-${width}-${theme}.png`) });
    }
    for (const scenario of ['viewer','demo','denied','foreign']) {
      await page.evaluate(name => window.__qaNavigationScenario(name), scenario);
      await page.waitForTimeout(30);
      if (scenario==='denied'||scenario==='foreign') check(await nav.locator('a').count() === 0, `${scenario} has no available links`);
      else if (scenario==='demo') check(await nav.locator('a').count() === 2, 'demo only opens dossier and scoped list');
      else { check(await nav.locator('[data-destination="intake"] a, [data-destination="recalls"] a').count()===0, 'viewer cannot enter operations'); check(await nav.locator('a').count()===6, 'viewer keeps permitted pages'); }
    }
    await context.close();
  }
  check(report.errors.length===0, JSON.stringify(report.errors));
  check(requests.every(request => request.method==='GET'), 'no business writes');
  report.status='passed'; console.log(JSON.stringify(report));
} catch (error) { report.status='failed'; throw error; }
finally { await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)); await browser.close(); await new Promise(done=>server.close(done)); }
