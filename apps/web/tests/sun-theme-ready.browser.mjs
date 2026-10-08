// Production ThemeToggle, real SSR and hydrateRoot; a held HTTP script makes
// the pre-hydration boundary observable. This is not actual-Next acceptance.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const files = ['packages/ui/src/theme-toggle.tsx', 'packages/ui/src/theme-preference.ts', 'apps/web/src/app/sun/sun-passport-header.tsx', 'apps/web/tests/sun-passport-header.test.mjs', 'apps/web/tests/sun-theme-ready.browser.mjs', '.github/workflows/sun-first-paint-acceptance.yml'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async path => [path, createHash('sha256').update(await readFile(join(root, path))).digest('hex')])));
const sourceHashesStart = await hashes();
const outputParent = resolve(process.env.QA_OUTPUT || join(root, 'artifacts/sun-theme-ready'));
await mkdir(outputParent, { recursive: true });
const output = await mkdtemp(join(outputParent, 'run-'));
const themePath = join(root, 'packages/ui/src/theme-toggle.tsx');
const serverBundle = await build({ entryPoints: [themePath], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/*'], logLevel: 'silent' });
const module = { exports: {} };
new Function('require', 'module', 'exports', serverBundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { ThemeToggle } = module.exports;
const clientBundle = await build({ stdin: { contents: `import React from 'react'; import {hydrateRoot} from 'react-dom/client'; import {ThemeToggle} from ${JSON.stringify(themePath.replaceAll('\\', '/'))}; hydrateRoot(document.getElementById('theme-root'), <ThemeToggle locale={document.documentElement.lang} waitForClientReady />);`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
const clientBytes = clientBundle.outputFiles[0].contents;
const pending = new Map(), arrivals = new Map();
const report = { schema: 'nexid.sun-theme-ready-browser/v1', actualNextServer: false, fixtureHtml: true, realProductionComponent: true, realSsrHydration: true, scriptResponseHeld: true, sourceHashesStart, checks: [], views: [], requests: [], errors: [], apiRequests: [], gpsCalls: 0, providerMutations: 0, customerWrites: 0, browserClosed: false, serverClosed: false };
const check = (passed, name, detail) => { report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) }); assert.ok(passed, name); };
const copy = { 'es-AR': { dark: 'Cambiar a modo oscuro', light: 'Cambiar a modo claro' }, en: { dark: 'Switch to dark mode', light: 'Switch to light mode' }, 'pt-BR': { dark: 'Mudar para o modo escuro', light: 'Mudar para o modo claro' } };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture.invalid');
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (/^\/client-[a-f0-9-]+\.js$/.test(url.pathname) && !url.search) {
    const id = url.pathname.slice(8, -3);
    pending.set(id, res); arrivals.get(id)?.(); arrivals.delete(id);
    return;
  }
  if (url.pathname !== '/fixture') { res.writeHead(404); return res.end(); }
  const locale = url.searchParams.get('locale'), theme = url.searchParams.get('theme'), id = url.searchParams.get('id');
  if (!copy[locale] || !['light', 'dark'].includes(theme) || !/^[a-f0-9-]{36}$/.test(id)) { res.writeHead(400); return res.end(); }
  const html = renderToString(React.createElement(ThemeToggle, { locale, waitForClientReady: true }));
  res.setHeader('content-type', 'text/html;charset=utf-8');
  res.end(`<!doctype html><html lang="${locale}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Theme hydration boundary</title><style>body{font:16px sans-serif;padding:24px;margin:0}button{min-height:44px;max-width:100%;font:inherit}html[data-theme=dark]{color-scheme:dark;background:#020617;color:#eee}html[data-theme=light]{color-scheme:light;background:white;color:#123}</style></head><body><div id="theme-root">${html}</div><script src="/client-${id}.js"></script></body></html>`);
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright-core');
let browser;
async function awaitScript(id) {
  if (pending.has(id)) return;
  let timer;
  await Promise.race([new Promise(ok => arrivals.set(id, ok)), new Promise((_, fail) => { timer = setTimeout(() => fail(new Error('held_script_not_requested')), 5000); })]).finally(() => clearTimeout(timer));
}
async function settled(page, theme, locale) {
  await page.waitForFunction(({ theme, label }) => { const button = document.querySelector('#theme-root button'); return document.documentElement.dataset.theme === theme && button?.querySelector(`.theme-toggle__glyph--${theme}`) && button.getAttribute('aria-label') === label && !button.disabled; }, { theme, label: copy[locale][theme === 'dark' ? 'light' : 'dark'] });
}
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  for (const locale of ['es-AR', 'en', 'pt-BR']) for (const width of [320, 390]) for (const theme of ['light', 'dark']) {
    const name = `${locale}/${width}/${theme}`, id = randomUUID();
    const context = await browser.newContext({ viewport: { width, height: 500 }, serviceWorkers: 'block' });
    await context.addCookies([{ name: 'theme', value: theme, url: origin }, { name: 'nexid_theme_version', value: 'white-first-v2', url: origin }]);
    await context.addInitScript(theme => { localStorage.setItem('theme', theme); localStorage.setItem('nexid-theme-version', 'white-first-v2'); Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { throw new Error('gps_forbidden'); }, watchPosition() { throw new Error('gps_forbidden'); } } }); }, theme);
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const allowed = request.method() === 'GET' && url.origin === origin && ((url.pathname === '/fixture' && url.searchParams.get('id') === id) || (url.pathname === `/client-${id}.js` && !url.search) || (url.pathname === '/favicon.ico' && !url.search));
      report.requests.push({ view: name, path: url.pathname, method: request.method(), allowed });
      if (!allowed) { report.errors.push({ view: name, kind: 'unexpected_request' }); await route.abort('blockedbyclient'); return; }
      await route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ view: name, kind: 'pageerror', name: error.name }));
    page.on('console', message => { if (message.type() === 'error') report.errors.push({ view: name, kind: 'console_error' }); });
    page.on('requestfailed', request => report.errors.push({ view: name, kind: 'requestfailed', path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
    const view = { locale, width, theme, completed: false }; report.views.push(view);
    try {
      const response = await page.goto(`${origin}/fixture?locale=${locale}&theme=${theme}&id=${id}`, { waitUntil: 'commit' });
      check(response.status() === 200, `${name}: SSR document 200`);
      const button = page.locator('#theme-root button'); await button.waitFor({ state: 'visible' }); await awaitScript(id);
      check(await button.isDisabled(), `${name}: SSR control disabled while its real script is held`);
      const box = await button.boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      check(await page.evaluate(() => document.documentElement.dataset.theme) === theme, `${name}: pre-hydration pointer click cannot change theme`);
      const held = pending.get(id); pending.delete(id); held.setHeader('content-type', 'text/javascript'); held.end(clientBytes);
      await settled(page, theme, locale);
      check(await button.isEnabled(), `${name}: ready only after mounted preference has been applied`);
      const opposite = theme === 'light' ? 'dark' : 'light';
      await button.click(); await settled(page, opposite, locale);
      check(await page.evaluate(() => document.documentElement.dataset.theme) === opposite, `${name}: first enabled user click changes theme`);
      const twice = await button.evaluate(node => { const before = document.documentElement.dataset.theme; node.click(); const first = document.documentElement.dataset.theme; node.click(); return { before, first, second: document.documentElement.dataset.theme }; });
      check(twice.first === theme && twice.second === opposite, `${name}: two native activations in one task each toggle current theme`, twice);
      await settled(page, opposite, locale);
      const stored = await page.evaluate(() => ({ theme: localStorage.getItem('theme'), version: localStorage.getItem('nexid-theme-version') }));
      check(stored.theme === opposite && stored.version === 'white-first-v2', `${name}: existing theme persistence is retained`, stored);
      const cookies = await context.cookies();
      check(cookies.find(row => row.name === 'theme')?.value === opposite && cookies.find(row => row.name === 'nexid_theme_version')?.value === 'white-first-v2', `${name}: existing versioned theme cookies are retained`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal overflow`);
      await page.screenshot({ path: join(output, `${locale}-${width}-${theme}.png`) });
      check(report.errors.length === 0, `${name}: no unexpected errors or request failures`);
      view.completed = true;
    } catch (error) { report.errors.push({ view: name, kind: 'assertion', name: error.name, message: error.message }); await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {}); throw error; }
    finally { for (const [key, response] of pending) { response.setHeader('content-type', 'text/javascript'); response.end(clientBytes); pending.delete(key); } await context.close(); }
  }
  check(report.views.length === 12 && report.views.every(row => row.completed), 'all twelve locale/theme/mobile cases are complete');
  report.status = 'passed';
} catch (error) { report.status = 'failed'; process.exitCode = 1; }
finally {
  if (browser) { await browser.close(); report.browserClosed = true; }
  await new Promise(ok => server.close(ok)); report.serverClosed = true;
  report.sourceHashesEnd = await hashes(); report.sourceStable = JSON.stringify(report.sourceHashesStart) === JSON.stringify(report.sourceHashesEnd);
  if (!report.sourceStable || report.errors.length) { report.status = 'failed'; process.exitCode = 1; }
  report.accepted = report.status === 'passed';
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, status: report.status, views: report.views.length, checks: report.checks.length, errors: report.errors.length, sourceStable: report.sourceStable, browserClosed: report.browserClosed, serverClosed: report.serverClosed }));
}
