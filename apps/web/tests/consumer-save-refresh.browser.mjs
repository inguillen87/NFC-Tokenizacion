// Real production Next pages/router; synthetic local save receipts and account
// projections. This does not prove API persistence, a physical TAP or delivery.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const web = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(web, '../..');
const output = resolve(process.env.QA_OUTPUT || 'artifacts/consumer-save-refresh');
assert.ok(!process.env.QA_BASE_URL, 'save feedback uses its dedicated loopback fixture');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright-core');
const axe = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });

let next = null, serverFailed = false, base = '';
const eventId = '900101';
const target = `/me?fromTap=1&eventId=${eventId}&tenant=save-feedback-qa&bid=SAVE-FEEDBACK-QA&action=save`;
const savePath = `/api/mobile/passport/${eventId}/consumer/save-product`;
const productName = 'Producto nuevo de ensayo QA';
const report = {
  localOnly: true, actualProductionBuild: true, actualNextRouterAndPages: true,
  syntheticSaveReceipts: true, syntheticReadOnlyAccountProjections: true,
  apiPersistenceVerified: false, physicalTapVerified: false, backendWrites: 0,
  browser: browser.version(), checks: [], views: [], viewportEvidence: [], cases: [], errors: [], unexpectedWrites: [], geolocationCalls: 0,
};
const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };

async function viewportHitTest(target) {
  return target.evaluate(element => {
    const bounds = rect => ({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height });
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const hits = document.elementsFromPoint(x, y);
    const header = document.querySelector('.consumer-portal-root > header');
    const navigation = document.querySelector('nav[aria-label="Navegación del portal"]');
    const headerRect = header?.getBoundingClientRect();
    return {
      target: bounds(rect), viewport: { width: innerWidth, height: innerHeight }, center: { x, y },
      centerHitsTarget: Boolean(hits[0] && (hits[0] === element || element.contains(hits[0]))),
      completelyInViewport: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth + 1,
      belowHeader: !headerRect || rect.top >= headerRect.bottom,
      hitStack: hits.slice(0, 5).map(hit => ({ tag: hit.tagName.toLowerCase(), id: hit.id || null, role: hit.getAttribute('role'), label: hit.getAttribute('aria-label') })),
      header: header ? { position: getComputedStyle(header).position, bounds: bounds(headerRect) } : null,
      navigation: navigation ? { position: getComputedStyle(navigation).position, bounds: bounds(navigation.getBoundingClientRect()) } : null,
    };
  });
}

async function startLocalServer() {
  const reserve = createServer();
  await new Promise(done => reserve.listen(0, '127.0.0.1', done));
  const port = reserve.address().port;
  await new Promise(done => reserve.close(done));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
  Object.assign(env, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', CONSUMER_SAVE_REFRESH_QA: '1' });
  next = spawn(process.execPath, [
    '--import', pathToFileURL(join(web, 'tests/consumer-save-refresh-local-fetch.mjs')).href,
    join(repo, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1',
  ], { cwd: web, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  next.stdout.on('data', () => {});
  next.stderr.on('data', () => {});
  next.on('error', () => { serverFailed = true; });
  base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (serverFailed || next.exitCode !== null) break;
    try { if ((await fetch(base + '/release.json', { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await new Promise(done => setTimeout(done, 250));
  }
  throw Error('isolated production save test server did not become ready');
}

async function open(width, theme, scenario) {
  const confirmed = ['confirmed', 'confirmed-focus-moved', 'confirmed-scroll-moved'].includes(scenario);
  const lost = ['lost', 'lost-focus-moved'].includes(scenario);
  const focusMoved = scenario.endsWith('-focus-moved');
  const scrollMoved = scenario === 'confirmed-scroll-moved';
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'es-AR', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([
    { name: 'consumer_qa', value: 'local', url: base, httpOnly: true, sameSite: 'Lax' },
    { name: 'theme', value: theme, url: base },
    { name: 'nexid_theme_version', value: 'white-first-v2', url: base },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('pageerror', error => report.errors.push({ width, theme, scenario, message: error.message }));
  let postCount = 0, refreshCount = 0, releaseReceipt, markRequestStarted;
  const receiptReady = new Promise(done => { releaseReceipt = done; });
  const firstPostStarted = new Promise(done => { markRequestStarted = done; });
  page.on('request', request => {
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/me' && url.searchParams.get('fromTap') === '1'
      && url.searchParams.get('eventId') === eventId && request.headers().rsc === '1') refreshCount++;
  });
  await context.exposeBinding('__saveQaLocationCall', () => { report.geolocationCalls++; });
  await page.addInitScript(() => {
    // Observe the actual production feedback methods without changing their
    // behavior. Natural browser scroll anchoring is distinct from a forced jump.
    window.__saveFeedbackFocus = { focusCalls: 0, scrollCalls: 0 };
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (...args) {
      if (this.id === 'tap-association-results') window.__saveFeedbackFocus.focusCalls++;
      return Reflect.apply(originalFocus, this, args);
    };
    const originalScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      if (this.id === 'tap-association-results') window.__saveFeedbackFocus.scrollCalls++;
      return Reflect.apply(originalScroll, this, args);
    };
    Object.defineProperty(navigator, 'geolocation', { value: {
      getCurrentPosition() { void window.__saveQaLocationCall(); throw Error('Unexpected automatic location request'); },
      watchPosition() { void window.__saveQaLocationCall(); throw Error('Unexpected automatic location watch'); },
    } });
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === '/api/consumer/session' && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, authenticated: true }) });
    }
    if (url.pathname === savePath && request.method() === 'POST') {
      postCount++;
      assert.deepEqual(request.postDataJSON(), { tenantSlug: 'save-feedback-qa', bid: 'SAVE-FEEDBACK-QA' });
      markRequestStarted();
      await receiptReady;
      if (lost) return route.abort('failed');
      const response = confirmed ? { status: 200, payload: { ok: true, saved: true, eventId } }
        : scenario === 'expired' ? { status: 403, payload: { ok: false, error: 'fresh_tap_capability_required', fresh_token_status: 'fresh_token_expired' } }
          : scenario === 'used' ? { status: 403, payload: { ok: false, error: 'fresh_tap_capability_required', fresh_token_status: 'fresh_token_already_used' } }
            : scenario === 'foreign' ? { status: 200, payload: { ok: true, saved: true, eventId: '900102' } }
              : { status: 200, body: 'invalid JSON' };
      return route.fulfill({ status: response.status, contentType: 'application/json', body: response.body || JSON.stringify(response.payload),
        headers: confirmed ? { 'set-cookie': 'consumer_saved_qa=1; Path=/; HttpOnly; SameSite=Lax' } : {} });
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      report.unexpectedWrites.push({ path: url.pathname, method: request.method() });
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(base + target, { waitUntil: 'networkidle', timeout: 90_000 });
  const banner = page.getByTestId('tap-association');
  const confirm = page.getByTestId('tap-association-confirm');
  await confirm.waitFor();
  const home = page.getByTestId('consumer-home');
  await home.waitFor();
  check(await home.getByRole('heading', { name: productName, exact: true }).count() === 0, `${width}/${theme}/${scenario}: pre-save projection contains no new product`);
  check((await home.innerText()).includes('0 en tu cuenta'), `${width}/${theme}/${scenario}: initial saved-product count comes from the empty account projection`);
  check(postCount === 0, `${width}/${theme}/${scenario}: entering the portal sends no save`);
  const initialRefreshes = refreshCount;
  await confirm.click();
  await confirm.evaluate(button => button.click());
  await page.getByRole('button', { name: 'Esperando confirmación…', exact: true }).waitFor();
  let requestTimer;
  try {
    await Promise.race([firstPostStarted, new Promise((_, reject) => { requestTimer = setTimeout(() => reject(Error('synthetic save request did not start')), 5000); })]);
  } finally { clearTimeout(requestTimer); }
  check(postCount === 1, `${width}/${theme}/${scenario}: rapid confirmation sends exactly one intercepted POST`);
  check(await confirm.isDisabled(), `${width}/${theme}/${scenario}: pending action prevents duplicate submission`);
  const readingDetails = banner.locator('details').filter({ has: page.locator('summary', { hasText: 'Sobre esta lectura' }) }).locator('summary');
  let newerInteraction = null;
  if (focusMoved) {
    await readingDetails.click();
    check(await readingDetails.evaluate(element => document.activeElement === element), `${width}/${theme}/${scenario}: user can focus another real control while the receipt is pending`);
    newerInteraction = await readingDetails.evaluate(element => ({ scrollY, top: element.getBoundingClientRect().top }));
    check((await viewportHitTest(readingDetails)).target.height >= 44, `${width}/${theme}/${scenario}: pending alternative remains a 44px touch target`);
  } else if (scrollMoved) {
    await confirm.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await page.mouse.move(width / 2, 750);
    await page.mouse.wheel(0, 220);
    await page.waitForFunction(previous => scrollY > previous, before);
    newerInteraction = await page.evaluate(() => ({ scrollY, activeTag: document.activeElement?.tagName }));
    check(true, `${width}/${theme}/${scenario}: user scrolls while the receipt remains pending`);
  }
  releaseReceipt();
  const expectedOutcome = confirmed ? 'saved' : scenario === 'expired' ? 'fresh_expired' : scenario === 'used' ? 'fresh_used' : 'unconfirmed';
  const result = banner.locator(`[data-outcome="${expectedOutcome}"]`);
  await result.waitFor();
  if (confirmed) await home.getByRole('heading', { name: productName, exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (focusMoved || scrollMoved) {
    const focusObservation = await page.evaluate(() => ({ ...window.__saveFeedbackFocus, scrollY, resultFocused: document.activeElement?.id === 'tap-association-results' }));
    check(focusObservation.focusCalls === 0 && focusObservation.scrollCalls === 0 && !focusObservation.resultFocused,
      `${width}/${theme}/${scenario}: delayed feedback neither takes focus nor forces a scroll after newer user interaction`);
    if (focusMoved) check(await readingDetails.evaluate(element => document.activeElement === element), `${width}/${theme}/${scenario}: receipt preserves the user's newer control focus`);
    check(await result.locator('..').getAttribute('aria-live') === 'polite', `${width}/${theme}/${scenario}: result remains announced without taking focus`);
    newerInteraction = { ...newerInteraction, after: focusObservation };
  } else {
    await page.waitForFunction(() => document.activeElement?.id === 'tap-association-results');
    check(true, `${width}/${theme}/${scenario}: result heading receives and retains keyboard focus`);
  }
  // Locator screenshots can include sticky/fixed elements at misleading crop
  // positions. Capture the untouched viewport after focus before any locator
  // screenshot or additional scroll, then measure what is actually hit-testable.
  const headingHitTest = await viewportHitTest(page.locator('#tap-association-results'));
  const reviewLink = banner.getByRole('link', { name: 'Revisar mis productos', exact: true });
  const reviewBeforeScroll = await viewportHitTest(reviewLink);
  const focusedViewport = `${scenario}-${width}-${theme}-viewport-focused.png`;
  await page.screenshot({ path: join(output, focusedViewport) });
  await reviewLink.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const reviewAfterScroll = await viewportHitTest(reviewLink);
  const reviewViewport = `${scenario}-${width}-${theme}-viewport-review-action.png`;
  await page.screenshot({ path: join(output, reviewViewport) });
  report.viewportEvidence.push({ width, theme, scenario, focusedViewport, reviewViewport, headingHitTest, reviewBeforeScroll, reviewAfterScroll, newerInteraction });
  if (!focusMoved && !scrollMoved) check(headingHitTest.completelyInViewport && headingHitTest.centerHitsTarget && headingHitTest.belowHeader, `${width}/${theme}/${scenario}: focused result heading is visible and unobstructed below the sticky header`);
  check(reviewAfterScroll.completelyInViewport && reviewAfterScroll.centerHitsTarget, `${width}/${theme}/${scenario}: explicit collection-action scroll leaves its center unobstructed`);
  check(reviewAfterScroll.target.height >= 44, `${width}/${theme}/${scenario}: unobstructed collection action retains its 44px touch target`);
  check(postCount === 1, `${width}/${theme}/${scenario}: result does not automatically repeat the POST`);
  if (confirmed) {
    check(refreshCount - initialRefreshes === 1, `${width}/${theme}: definitive receipt performs exactly one Next RSC refresh`);
    check((await home.innerText()).includes('1 en tu cuenta'), `${width}/${theme}: refreshed account count reflects the synthetic new product`);
    check(await result.isVisible() && await confirm.isDisabled(), `${width}/${theme}: confirmed feedback survives refresh and stays terminal`);
    await confirm.evaluate(button => { button.click(); button.click(); });
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    check(postCount === 1 && refreshCount - initialRefreshes === 1, `${width}/${theme}: completed action cannot repeat its write or refresh`);
  } else {
    check(refreshCount === initialRefreshes, `${width}/${theme}/${scenario}: missing definitive receipt performs no automatic refresh`);
    check(await home.getByRole('heading', { name: productName, exact: true }).count() === 0, `${width}/${theme}/${scenario}: unconfirmed response never invents a saved product`);
    check(await banner.getByRole('link', { name: 'Revisar mis productos', exact: true }).isVisible(), `${width}/${theme}/${scenario}: read-only collection review remains available`);
    if (scenario === 'expired' || scenario === 'used') {
      check(await confirm.isDisabled(), `${width}/${theme}/${scenario}: rejected fresh capability cannot be replayed`);
      check((await result.innerText()).includes(scenario === 'expired' ? 'Acercá de nuevo el teléfono a la etiqueta' : 'para una acción nueva'), `${width}/${theme}/${scenario}: guidance requests a new physical TAP`);
    } else {
      check((await result.innerText()).includes('revisá tus productos antes de reintentar'), `${width}/${theme}/${scenario}: lost or malformed receipt directs collection review before deliberate retry`);
    }
  }
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}/${theme}/${scenario}: no horizontal overflow`);
  check(await banner.getByRole('link', { name: 'Revisar mis productos', exact: true }).evaluate(link => link.getBoundingClientRect().height >= 44), `${width}/${theme}/${scenario}: collection action has a 44px target`);
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async () => (await axe.run('[data-testid="tap-association"]', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(item => ({ id: item.id, impact: item.impact, targets: item.nodes.map(node => node.target) })));
  check(violations.length === 0, `${width}/${theme}/${scenario}: zero axe violations in action feedback`);
  await banner.screenshot({ path: join(output, `${scenario}-${width}-${theme}.png`) });
  report.views.push({ width, theme, scenario, violations });
  report.cases.push({ width, theme, scenario, interceptedSavePosts: postCount, automaticRscRefreshes: refreshCount - initialRefreshes, expectedOutcome,
    newerInteraction, feedbackFocus: await page.evaluate(() => ({ ...window.__saveFeedbackFocus })) });
  await context.close();
}

try {
  await startLocalServer();
  report.nextBuildId = (await readFile(join(web, '.next/BUILD_ID'), 'utf8')).trim();
  report.servedRelease = await (await fetch(base + '/release.json', { signal: AbortSignal.timeout(5000) })).json();
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 768, 1440]) await open(width, theme, 'confirmed');
  for (const theme of ['light', 'dark']) for (const scenario of ['lost', 'malformed', 'foreign', 'expired', 'used']) await open(390, theme, scenario);
  for (const theme of ['light', 'dark']) for (const width of [320, 390]) await open(width, theme, 'confirmed-focus-moved');
  for (const theme of ['light', 'dark']) for (const scenario of ['confirmed-scroll-moved', 'lost-focus-moved']) await open(390, theme, scenario);
  check(report.errors.length === 0, 'zero application runtime exceptions');
  check(report.unexpectedWrites.length === 0, 'zero account, OTP, telemetry or business writes outside intercepted synthetic save');
  check(report.geolocationCalls === 0, 'zero GPS requests');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = String(error.stack);
  const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page) {
    report.visible = (await page.locator('body').innerText()).slice(0, 10_000);
    await page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, views: report.views.length, cases: report.cases, errors: report.errors, unexpectedWrites: report.unexpectedWrites, geolocationCalls: report.geolocationCalls, output }, null, 2));
  await browser.close();
  if (next && next.exitCode === null) {
    next.kill();
    await Promise.race([new Promise(done => next.once('exit', done)), new Promise(done => setTimeout(done, 1500))]);
  }
}
