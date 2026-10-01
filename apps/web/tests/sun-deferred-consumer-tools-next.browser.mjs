// Actual Next/Turbopack recovery under a synthetic persistent chunk outage.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
const web = fileURLToPath(new URL('../', import.meta.url)), repo = resolve(web, '../..'), output = resolve(process.env.QA_OUTPUT || 'artifacts/performance/deferred-tools-next');
await mkdir(output, { recursive: true });
const chunkFolder = join(web, '.next/static/chunks');
const candidates = (await readdir(chunkFolder)).filter(name => name.endsWith('.js'));
let ctaChunk;
for (const name of candidates) if ((await readFile(join(chunkFolder, name), 'utf8')).includes('/api/public-cta/receipt-ocr')) { ctaChunk = name; break; }
assert.ok(ctaChunk, 'Built CtaActions chunk exists');
const reserve = createServer(); await new Promise(r => reserve.listen(0, '127.0.0.1', r)); const port = reserve.address().port; await new Promise(r => reserve.close(r));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
Object.assign(env, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' });
const server = spawn(process.execPath, ['--import', pathToFileURL(join(web, 'tests/sun-mobile-local-fetch.mjs')).href, join(repo, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: web, env, windowsHide: true });
let serverLog = ''; server.stdout.on('data', data => serverLog += data); server.stderr.on('data', data => serverLog += data);
const origin = 'http://127.0.0.1:' + port;
for (let n = 0; n < 80; n++) { try { if ((await fetch(origin + '/release.json')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); if (n === 79) { server.kill(); throw Error('local_server_not_ready'); } }
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const report = { actualNextBuild: true, syntheticContract: true, physicalTapMeasured: false, chunkAttempts: 0, writes: [], errors: [], checks: [] };
let failEnabled = true;
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', serviceWorkers: 'block', reducedMotion: 'reduce' }), page = await context.newPage();
  await context.addInitScript(() => { window.__geoRequests = 0; Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__geoRequests++; } } }); });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.route('**/*', route => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() !== 'GET') { report.writes.push(u.pathname); return route.abort(); }
    if (u.origin !== origin) return route.abort();
    if (u.pathname === '/qa-product.svg') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="92" height="128"><rect width="92" height="128" fill="#147d83"/></svg>' });
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false}' });
    if (u.pathname.endsWith('/' + ctaChunk)) { report.chunkAttempts++; if (failEnabled) return route.fulfill({ status: 503, contentType: 'text/javascript', body: '' }); }
    return route.continue();
  });
  await page.goto(origin + '/sun?snapshot=qa-replay&trace=synthetic&access=invalid', { waitUntil: 'networkidle' });
  const cta = page.locator('[data-sun-deferred-tool="protected-actions"]');
  check(report.chunkAttempts === 0, 'Actual Next does not download offscreen action chunk');
  await cta.getByRole('button', { name: 'Ver opciones' }).evaluate(el => el.focus({ preventScroll: true })); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="protected-actions"]')?.getAttribute('data-tool-load-state') === 'error');
  check(await cta.getAttribute('aria-busy') === 'false', 'Persistent chunk outage releases busy state');
  check(await page.getByTestId('sun-summary-product').count() === 1, 'Chunk outage retains product information');
  const requestsAtFailure = report.chunkAttempts; failEnabled = false;
  await cta.getByRole('button', { name: 'Volver a intentar' }).click();
  await page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="protected-actions"]')?.getAttribute('data-tool-load-state') === 'ready', null, { timeout: 10000 });
  check(report.chunkAttempts > requestsAtFailure, 'Explicit retry retrieves the failed chunk again');
  check(await cta.getAttribute('aria-busy') === 'false', 'Successful retry clears busy state');
  check(await cta.evaluate(el => el === document.activeElement), 'Retry restores focus into the ready region');
  check(await cta.getByText('Necesito una nueva lectura NFC', { exact: true }).count() === 1, 'Recovery retains blocked action policy');
  check(report.writes.length === 0 && await page.evaluate(() => window.__geoRequests) === 0, 'Retry initiates no business write or geolocation');
  check(report.errors.length === 0, 'Chunk failure is handled without browser exceptions'); await context.close();
} finally { await browser.close(); server.kill(); await writeFile(join(output, 'server.log'), serverLog); await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ checks: report.checks.length, failed: report.checks.filter(c => !c.passed), chunkAttempts: report.chunkAttempts, errors: report.errors }, null, 2));
