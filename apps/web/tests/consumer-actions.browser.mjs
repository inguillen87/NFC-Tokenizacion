import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const base = 'http://localhost:3188', api = 'http://127.0.0.1:4288', out = process.env.QA_OUTPUT;
assert.ok(out);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
await mkdir(out, { recursive: true });
const report = { localOnly: true, actualNextAndBff: true, syntheticApiAndIdentity: true, browser: browser.version(), checks: [], visual: [] };
const state = async () => (await fetch(api + '/qa-state')).json();
const mode = async value => fetch(api + '/qa-mode?value=' + value, { method: 'POST' });
const actions = s => s.calls.filter(x => /^\/mobile\/passport\//.test(x.path));
const issues = [];
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([{ name: 'consumer_qa', value: 'local', url: base, httpOnly: true, sameSite: 'Lax' }, { name: 'locale', value: 'es-AR', url: base }]);
  const page = await context.newPage();
  page.on('pageerror', error => issues.push(error.message));
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort();
  });
  await page.addInitScript(() => { window.__locationCalls = 0; Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__locationCalls++; throw Error('Unexpected automatic geolocation'); } } }); });
  return { context, page };
}
async function assess(page, selector, name, width, theme) {
  await page.setViewportSize({ width, height: 940 });
  await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.classList.toggle('theme-light', theme === 'light'); document.documentElement.classList.toggle('theme-dark', theme === 'dark'); }, theme);
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async selector => (await axe.run(selector, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })), selector);
  await page.screenshot({ path: join(out, `${name}-${width}-${theme}.png`) });
  report.visual.push({ name, width, theme, violations });
  assert.deepEqual(violations, []);
}
async function fresh(page, action = 'products') {
  const issued = await (await fetch(api + '/qa-issue')).json();
  await page.goto(`${base}/sun?snapshot=${issued.eventId}&trace=qa-only&access=qa-only&fresh=${encodeURIComponent(issued.token)}`, { waitUntil: 'load', timeout: 90000 });
  await page.getByTestId('consumer-passport-primary').getByRole('button').click();
  await page.waitForURL(u => u.pathname === '/me/products', { timeout: 60000 });
  assert.ok(!page.url().includes(issued.token) && !page.url().includes('fresh='));
  await page.getByTestId('tap-association-confirm').waitFor();
  if (action !== 'products') await page.locator(`input[name="tap-association-action"][value="${action}"]`).check();
  return issued;
}
async function confirm(page, outcome) {
  await page.getByTestId('tap-association-confirm').click();
  await page.locator(`[data-testid="tap-association"] [data-outcome="${outcome}"]`).waitFor();
}
try {
  // Hold application scripts to reproduce a slow phone before React hydration.
  // The rendered control must not accept a click which has no handler yet.
  const delayed = await open();
  let releaseScripts;
  const scriptsReady = new Promise(resolve => { releaseScripts = resolve; });
  const heldScripts = '**/_next/static/**/*.js*';
  let handoffs = 0;
  delayed.page.on('request', request => { if (new URL(request.url()).pathname === '/api/consumer/tap-handoff' && request.method() === 'POST') handoffs++; });
  await delayed.page.route(heldScripts, async route => { await scriptsReady; await route.continue(); });
  const slow = await (await fetch(api + '/qa-issue')).json();
  const beforeSlow = actions(await state()).length;
  try {
    await delayed.page.goto(`${base}/sun?snapshot=${slow.eventId}&trace=qa-only&access=qa-only&fresh=${encodeURIComponent(slow.token)}`, { waitUntil: 'commit', timeout: 90000 });
    const button = delayed.page.getByTestId('consumer-passport-primary').getByRole('button');
    await button.waitFor({ state: 'visible' });
    assert.equal(await button.isDisabled(), true);
    assert.equal(handoffs, 0);
    releaseScripts();
    await button.click();
    await delayed.page.waitForURL(u => u.pathname === '/me/products', { timeout: 60000 });
    assert.equal(handoffs, 1);
    assert.equal(actions(await state()).length, beforeSlow);
    report.checks.push('Slow hydration keeps the handoff disabled until ready, then one click navigates without a business mutation');
  } finally { releaseScripts(); await delayed.context.close(); }
  const { context, page } = await open();
  await page.goto(base + '/sun?snapshot=900001&trace=qa-only&access=qa-only', { waitUntil: 'load', timeout: 90000 });
  const evidence = page.getByTestId('passport-evidence-resources');
  await evidence.waitFor();
  assert.equal(await evidence.getAttribute('data-evidence-mode'), 'historical');
  assert.equal(await evidence.locator('[data-resource-kind="certificate"]').getAttribute('href'), '/certificado/900001?share=qa-only-public-share');
  assert.match(await evidence.innerText(), /UTC|histórico/);
  const beforeHistory = actions(await state()).length;
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) await assess(page, '[data-testid="passport-evidence-resources"]', 'historical-evidence', width, theme);
  assert.equal(actions(await state()).length, beforeHistory);
  report.checks.push('Historical reading certificate stays accessible without a fresh capability or commercial mutation');
  await evidence.locator('[data-resource-kind="certificate"]').click();
  await page.getByRole('heading', { name: 'No pudimos consultar el certificado #900001.' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Tocar de nuevo', exact: true }).count(), 0);
  assert.equal(actions(await state()).length, beforeHistory);
  report.checks.push('Unavailable certificate offers read-only recovery instead of treating a demo link as a new physical read');
  for (const [lang, title] of [['en', 'Evidence and resources'], ['pt-BR', 'Evidências e recursos'], ['es-AR', 'Evidencia y recursos']]) {
    await page.goto(base + `/sun?snapshot=900001&trace=qa-only&access=qa-only&lang=${lang}`, { waitUntil: 'load' });
    await evidence.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(await evidence.locator('[data-resource-kind="certificate"]').count(), 1);
  }
  await page.goto(base + '/sun?snapshot=900001&trace=no-certificate&access=qa-only', { waitUntil: 'load' });
  assert.equal(await evidence.locator('[data-resource-kind="certificate"]').count(), 0);
  await page.goto(base + '/sun?qr=1&bid=QA-ONLY', { waitUntil: 'load' });
  await evidence.waitFor(); assert.equal(await evidence.getAttribute('data-evidence-mode'), 'qr');
  assert.equal(await evidence.locator('[data-resource-kind="certificate"]').count(), 0);
  await page.goto(base + '/sun', { waitUntil: 'load' });
  await evidence.waitFor(); assert.equal(await evidence.getAttribute('data-evidence-mode'), 'demo');
  assert.equal(await evidence.locator('a').count(), 0);
  report.checks.push('Three languages retain the evidence reference; absent share tokens, QR and demo do not invent certificate access');
  await page.goto(base + '/sun?snapshot=900001&trace=agro&access=qa-only', { waitUntil: 'load' });
  await evidence.waitFor();
  assert.equal(await evidence.locator('[data-resource-kind="technical"]').getAttribute('href'), 'https://documents.example.invalid/technical.pdf');
  assert.match(await evidence.innerText(), /documents\.example\.invalid/);
  assert.equal(await evidence.locator('[data-resource-kind="safety"]').count(), 1);
  assert.match(await page.locator('body').innerText(), /22:42 UTC/);
  report.checks.push('Agro resources disclose the external document host without claiming publication date or validity');
  const before = actions(await state()).length;
  const issued = await fresh(page);
  assert.equal(actions(await state()).length, before, 'Entering the portal does not execute any action');
  const cookies = (await context.cookies()).filter(x => x.name.includes('nexid_tap_'));
  assert.ok(cookies.some(x => x.httpOnly && x.sameSite === 'Strict' && x.expires <= Date.now() / 1000 + 301));
  assert.ok(!(await page.evaluate(() => document.cookie)).includes(issued.token));
  assert.ok(!(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).includes(issued.token));
  await confirm(page, 'saved');
  const writes = actions(await state()).slice(before);
  assert.equal(writes.length, 1); assert.ok(writes[0].path.endsWith('/consumer/save-product')); assert.equal(writes[0].hasCapability, true); assert.equal(writes[0].leakedCookie, false);
  assert.equal(await page.getByTestId('tap-association-confirm').isDisabled(), true);
  for (const [action, outcome] of [['join', 'linked'], ['claim', 'claimed'], ['rewards', 'enrolled']]) {
    await page.locator(`input[name="tap-association-action"][value="${action}"]`).check();
    const count = actions(await state()).length; await confirm(page, outcome); assert.equal(actions(await state()).length, count + 1);
    assert.equal(await page.locator('[data-outcome="saved"]').count(), 1);
  }
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) await assess(page, '[data-testid="tap-association"]', 'explicit-actions', width, theme);
  report.checks.push('One explicit request per action; HttpOnly handoff reaches only the matching BFF action and completed results persist independently');
  const secondary = await (await fetch(api + '/qa-issue')).json();
  const beforeSecondary = actions(await state()).length;
  await page.goto(`${base}/sun?snapshot=${secondary.eventId}&trace=qa-only&access=qa-only&fresh=${encodeURIComponent(secondary.token)}`, { waitUntil: 'load' });
  await page.locator('summary').filter({ hasText: 'Como se protege cada accion' }).click();
  await page.getByTestId('post-tap-next-step').getByRole('button', { name: /Entrar al club de la marca/ }).click();
  await page.waitForURL(u => u.pathname === '/me/rewards', { timeout: 60000 });
  assert.equal(actions(await state()).length, beforeSecondary);
  await confirm(page, 'enrolled');
  assert.equal(actions(await state()).length, beforeSecondary + 1);
  report.checks.push('Secondary benefits navigation prepares the same handoff and waits for explicit enrollment');
  await mode('network-error'); await fresh(page); await confirm(page, 'unconfirmed');
  await mode('normal'); await confirm(page, 'saved');
  report.checks.push('An unconfirmed response preserves context and permits a deliberate retry without executing other actions');
  await mode('invalid-response'); await fresh(page); await confirm(page, 'unconfirmed');
  assert.equal(await page.locator('[data-outcome="saved"]').count(), 0);
  await mode('manual-review'); await fresh(page, 'claim'); await confirm(page, 'review_required');
  assert.equal(await page.locator('[data-outcome="claimed"]').count(), 0);
  await mode('committed'); await fresh(page, 'claim'); await confirm(page, 'recorded_pending');
  assert.equal(await page.getByTestId('tap-association-confirm').isDisabled(), true);
  report.checks.push('Malformed success, manual review without a submitted request, and committed-but-incomplete ownership remain distinct');
  await mode('expired-session'); await fresh(page); await confirm(page, 'session_required');
  assert.equal(await page.getByTestId('tap-association-confirm').count(), 0);
  assert.ok(await page.getByTestId('tap-association').locator('a[href^="/login?"]').count());
  await mode('normal'); await fresh(page);
  assert.ok((await context.cookies()).filter(c => c.name.includes('nexid_tap_')).length <= 3);
  await context.clearCookies({ name: /nexid_tap_/ }); await confirm(page, 'fresh_required');
  report.checks.push('Expired sessions return to login; missing capability asks for a fresh read without extending its lifetime');
  assert.equal(await page.evaluate(() => window.__locationCalls), 0);
  assert.deepEqual(issues, []);
  const finalState = await state(); assert.equal(finalState.calls.some(x => x.leakedCookie), false);
  assert.equal(finalState.calls.some(x => /auth\/(start|verify|logout)/.test(x.path)), false);
  report.checks.push('No OTP sending, logout, automatic location or capability-cookie forwarding to unrelated API readers');
  report.status = 'passed'; await context.close();
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page) { report.visible = (await page.locator('body').innerText()).slice(0, 10000); await page.screenshot({ path: join(out, 'failure.png'), fullPage: true }).catch(() => {}); }
  throw error;
} finally { await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); await browser.close(); }
