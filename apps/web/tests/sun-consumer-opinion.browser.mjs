// Real local Next production styles with the existing synthetic SUN contract.
// No physical NFC URL, capability, production API response, GPS or submission.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const web = fileURLToPath(new URL('../', import.meta.url)), repo = resolve(web, '../..');
const output = resolve(process.env.QA_OUTPUT || 'artifacts/sun-consumer-opinion');
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = process.env.AXE_MODULE_PATH ? await readFile(process.env.AXE_MODULE_PATH, 'utf8') : null;
const report = {
  realProductionBuild: true, actualNextStyles: true, syntheticContract: true,
  physicalTapMeasured: false, gpsMeasured: false, businessSubmissionTested: false,
  fabricatedBusinessApiResponses: false,
  matrix: { widths: [320, 390, 768, 1440], themes: ['light', 'dark'], height: 844 },
  contrastMethod: 'Focus outline ink compared with actual rendered pixels along its four straight edges. Only that outline is temporarily hidden to expose its backdrop; the exact inline style is restored. Rounded corners and every possible animation frame are outside this sampled proof.',
  axeAvailable: Boolean(axe), checks: [], views: [], errors: [],
  blockedWrites: [], blockedExternalReads: [], blockedApiReads: [],
  browserClosed: false, serverClosed: false,
};
const check = (passed, name, details) => report.checks.push({ name, passed: Boolean(passed), ...(details === undefined ? {} : { details }) });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const luminance = rgb => rgb.slice(0, 3).map(value => {
  value /= 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);

async function outlineContrast(page, button, name) {
  await button.scrollIntoViewIfNeeded();
  await button.focus();
  await settle(page);
  const data = await button.evaluate(element => {
    const cs = getComputedStyle(element), rect = element.getBoundingClientRect();
    const outlineWidth = parseFloat(cs.outlineWidth), outlineOffset = parseFloat(cs.outlineOffset);
    const margin = Math.ceil(outlineWidth + outlineOffset + 1);
    return { color: cs.outlineColor, foreground: cs.outlineColor.match(/[\d.]+/g)?.map(Number),
      style: cs.outlineStyle, width: outlineWidth, offset: outlineOffset,
      focusVisible: element.matches(':focus-visible'), originalStyle: element.getAttribute('style'),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      clip: { x: Math.floor(rect.x) - margin, y: Math.floor(rect.y) - margin,
        width: Math.ceil(rect.right) - Math.floor(rect.x) + 2 * margin,
        height: Math.ceil(rect.bottom) - Math.floor(rect.y) + 2 * margin },
      viewport: { width: innerWidth, height: innerHeight } };
  });
  const supported = data.focusVisible && data.style === 'solid' && data.width >= 2 && data.offset >= 0
    && data.foreground?.length >= 3 && data.clip.x >= 0 && data.clip.y >= 0
    && data.clip.x + data.clip.width <= data.viewport.width && data.clip.y + data.clip.height <= data.viewport.height;
  if (!supported) return { ...data, supported: false, minimumRequired: 3 };
  let screenshot;
  try {
    await button.evaluate(element => element.style.setProperty('outline', 'none', 'important'));
    await settle(page);
    screenshot = await page.screenshot({ clip: data.clip });
    await writeFile(join(output, name + '-focus-backdrop.png'), screenshot);
  } finally {
    await button.evaluate((element, original) => {
      if (original === null) element.removeAttribute('style');
      else element.setAttribute('style', original);
    }, data.originalStyle);
    await settle(page);
  }
  const { data: pixels, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const distance = data.offset + data.width / 2;
  const rect = { x: data.rect.x - data.clip.x, y: data.rect.y - data.clip.y,
    width: data.rect.width, height: data.rect.height };
  const points = [];
  // Avoid rounded corners while sampling the actual surroundings on every side.
  for (let x = Math.ceil(rect.x + 10); x < rect.x + rect.width - 10; x++) {
    points.push([x, Math.round(rect.y - distance)], [x, Math.round(rect.y + rect.height + distance)]);
  }
  for (let y = Math.ceil(rect.y + 10); y < rect.y + rect.height - 10; y++) {
    points.push([Math.round(rect.x - distance), y], [Math.round(rect.x + rect.width + distance), y]);
  }
  let minimumRatio = Infinity, worstBackdrop = null;
  const alpha = data.foreground[3] ?? 1;
  for (const [x, y] of points) {
    const index = (y * info.width + x) * info.channels, background = [...pixels.subarray(index, index + 3)];
    const ink = background.map((value, channel) => data.foreground[channel] * alpha + value * (1 - alpha));
    const a = luminance(ink), b = luminance(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (ratio < minimumRatio) { minimumRatio = ratio; worstBackdrop = background; }
  }
  return { color: data.color, style: data.style, width: data.width, offset: data.offset,
    focusVisible: data.focusVisible, supported: points.length > 0, minimumRatio, minimumRequired: 3,
    worstBackdrop, sampledPixels: points.length, inlineStyleRestored: true, clip: data.clip };
}

const reserve = createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
Object.assign(env, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' });
const next = spawn(process.execPath, ['--import', pathToFileURL(join(web, 'tests/sun-mobile-local-fetch.mjs')).href,
  join(repo, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: web, env, windowsHide: true });
let log = '', browser;
next.stdout.on('data', data => { log += data; });
next.stderr.on('data', data => { log += data; });
next.on('error', error => { report.errors.push({ phase: 'server', message: error.message }); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (next.exitCode !== null || next.signalCode !== null) break;
    try { ready = (await fetch(origin + '/release.json', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* startup */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'isolated_production_server_ready');
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  for (const theme of report.matrix.themes) for (const width of report.matrix.widths) {
    const name = `opinion-${width}-${theme}`, view = { name, width, theme, enabled: false, axe: null };
    report.views.push(view);
    const context = await browser.newContext({ viewport: { width, height: report.matrix.height }, locale: 'es-AR', reducedMotion: 'reduce', serviceWorkers: 'block' });
    context.setDefaultTimeout(15000);
    let page;
    const phase = value => { view.phase = value; console.log(name + ': ' + value); };
    try {
      await context.addCookies([{ name: 'theme', value: theme, url: origin }, { name: 'nexid_theme_version', value: 'white-first-v2', url: origin }]);
      await context.addInitScript(() => {
        window.__geoCalls = 0;
        Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__geoCalls++; }, watchPosition() { window.__geoCalls++; } } });
      });
      page = await context.newPage();
      page.on('pageerror', error => report.errors.push({ view: name, message: error.message }));
      let viewWrites = 0;
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() !== 'GET') {
          viewWrites++;
          report.blockedWrites.push({ view: name, method: request.method(), path: url.pathname });
          return route.abort();
        }
        if (url.origin !== origin) { report.blockedExternalReads.push({ view: name, origin: url.origin, path: url.pathname }); return route.abort(); }
        if (url.pathname.startsWith('/api/')) { report.blockedApiReads.push({ view: name, path: url.pathname }); return route.abort(); }
        if (url.pathname === '/qa-product.svg') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="92" height="128"><rect width="92" height="128" fill="#147d83"/></svg>' });
        return route.continue();
      });
      phase('navigate');
      await page.goto(origin + '/sun?snapshot=qa-opinion&trace=synthetic&access=invalid', { waitUntil: 'networkidle', timeout: 30000 });
      await page.getByTestId('sun-summary-product').waitFor();
      phase('summary ready');
      check(await page.locator('html').getAttribute('data-theme') === theme, 'Requested real theme ' + name);
      const region = page.locator('[data-sun-deferred-tool="qr-engagement"]');
      view.enabled = await region.count() === 1;
      check(view.enabled, 'Existing synthetic contract enables opinion region ' + name);
      if (!view.enabled) { view.limitation = 'The real page did not expose engagement; no enabling policy was fabricated.'; continue; }
      // Approach the real deferred region; its observer/button, not a mock module, mounts the suite.
      await region.scrollIntoViewIfNeeded();
      phase('mount deferred suite');
      await page.waitForFunction(() => document.querySelector('[data-sun-deferred-tool="qr-engagement"]')?.getAttribute('data-tool-load-state') === 'ready', null, { timeout: 15000 });
      check(await region.getAttribute('aria-busy') === 'false', 'Deferred options reach ready ' + name);
      const suite = region.locator('.sun-engagement-suite');
      await suite.getByRole('button', { name: 'Calificar', exact: true }).click();
      phase('opinion open');
      const tabs = suite.locator('.sun-engagement-tabs button');
      const tabGeometry = await tabs.evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect(), span = element.querySelector('span'), text = [...span.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        const range = document.createRange();
        if (text) range.selectNodeContents(text);
        const label = text ? range.getBoundingClientRect() : null;
        return { name: span.textContent.trim(), width: box.width, height: box.height, left: box.left, right: box.right,
          labelLeft: label?.left, labelRight: label?.right, fontSize: parseFloat(getComputedStyle(span).fontSize),
          iconHiddenFromAT: span.querySelector('svg')?.getAttribute('aria-hidden') === 'true', pressed: element.getAttribute('aria-pressed') };
      }));
      check(tabGeometry.length === 4 && tabGeometry.every(tab => tab.height >= 44 && tab.left >= 0 && tab.right <= width
        && tab.fontSize >= 11 && tab.labelLeft >= tab.left - 1 && tab.labelRight <= tab.right + 1 && tab.iconHiddenFromAT),
        'Four named tabs, icons and 44px targets fit without clipping ' + name, tabGeometry);
      check(tabGeometry.filter(tab => tab.pressed === 'true').length === 1 && tabGeometry.find(tab => tab.name === 'Calificar')?.pressed === 'true',
        'Opinion tab exposes the selected state ' + name);
      const stars = suite.getByRole('button', { name: /^Calificar con \d estrellas?$/ });
      check(await stars.count() === 5 && await stars.evaluateAll(elements => elements.every(element => element.getAttribute('aria-pressed') === 'false')), 'Five named stars have no preselection ' + name);
      check(await suite.getByRole('button', { name: 'Enviar opinión', exact: true }).isDisabled(), 'Explicit rating remains required ' + name);
      const third = suite.getByRole('button', { name: 'Calificar con 3 estrellas', exact: true });
      await page.mouse.move(1, 1);
      await third.focus();
      await page.keyboard.press('Enter');
      check(await third.getAttribute('aria-pressed') === 'true' && await stars.evaluateAll(elements => elements.filter(element => element.getAttribute('aria-pressed') === 'true').length) === 1, 'Keyboard exposes exactly one selected star ' + name);
      const targets = await stars.evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height, left: rect.left, right: rect.right }; }));
      check(targets.every(rect => rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= width), 'All five real CSS targets fit and are at least 44px ' + name, targets);
      view.focusContrast = await outlineContrast(page, third, name);
      check(view.focusContrast.supported && view.focusContrast.minimumRatio >= 3, 'Rendered focus outline reaches 3:1 ' + name, view.focusContrast);
      const comment = suite.getByRole('textbox', { name: 'Comentario corto', exact: true });
      const commentTypography = await comment.evaluate(element => ({ fontSize: parseFloat(getComputedStyle(element).fontSize), lineHeight: parseFloat(getComputedStyle(element).lineHeight) }));
      check(commentTypography.fontSize >= (width <= 760 ? 16 : 14) && commentTypography.lineHeight >= commentTypography.fontSize * 1.5,
        'Comment uses readable scoped typography ' + name, commentTypography);
      await suite.locator('label').filter({ hasText: 'Comentario corto' }).click();
      check(await comment.evaluate(element => element === document.activeElement), 'Visible label focuses comment ' + name);
      const draft = 'Opinión sintética: conservar este borrador sin enviarlo.';
      await comment.fill(draft);
      const optionalLocation = suite.getByRole('checkbox');
      check(!await optionalLocation.isChecked(), 'Approximate zone starts unchecked ' + name);
      await optionalLocation.check();
      await optionalLocation.uncheck();
      await suite.getByRole('button', { name: 'Novedades', exact: true }).click();
      await suite.getByRole('button', { name: 'Calificar', exact: true }).click();
      check(await comment.inputValue() === draft, 'Changing panels retains comment draft ' + name);
      check(await third.getAttribute('aria-pressed') === 'true', 'Changing panels retains rating ' + name);
      await third.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await settle(page);
      check(await third.evaluate(element => element === document.activeElement && element.matches(':focus-visible')), 'Tab order returns to the selected star with visible focus ' + name);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No document overflow after opinion interaction ' + name);
      const geometry = await suite.evaluate(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width, viewport: innerWidth, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }; });
      check(geometry.left >= -1 && geometry.right <= width + 1 && geometry.scrollWidth <= geometry.clientWidth + 1, 'Opinion panel fits real viewport ' + name, geometry);
      check(viewWrites === 0 && await page.evaluate(() => window.__geoCalls) === 0, 'No submit or GPS before explicit delivery ' + name, { attemptedWrites: viewWrites });
      if (axe) {
        await page.addScriptTag({ content: axe });
        view.axe = await page.evaluate(async () => {
          const result = await window.axe.run('.sun-engagement-suite', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
          const simplify = item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) });
          return { violations: result.violations.map(simplify), incomplete: result.incomplete.map(simplify), passes: result.passes.length };
        });
        check(view.axe.violations.length === 0, 'Opinion scoped WCAG automated violations zero ' + name, view.axe.violations);
      }
      await suite.screenshot({ path: join(output, name + '-panel.png') });
      await page.screenshot({ path: join(output, name + '-viewport.png'), fullPage: false });
      phase('complete');
    } catch (error) {
      report.errors.push({ view: name, phase: view.phase, message: error.message });
      check(false, 'Scenario completed ' + name, error.message);
      if (page) {
        view.failedRegion = await page.locator('[data-sun-deferred-tool="qr-engagement"]').evaluateAll(elements => elements.map(element => ({ state: element.getAttribute('data-tool-load-state'), text: element.textContent }))).catch(() => null);
        await page.screenshot({ path: join(output, name + '-failure.png'), fullPage: false }).catch(() => {});
      }
    } finally {
      await context.close();
      await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
      await writeFile(join(output, 'server.log'), log);
    }
  }
  check(report.views.length === 8 && report.views.every(view => view.enabled), 'All eight real opinion contexts were enabled');
  check(report.errors.length === 0, 'No runtime or harness errors', report.errors);
} catch (error) { report.errors.push({ phase: 'suite', message: error.message }); }
finally {
  if (browser) { await browser.close(); report.browserClosed = !browser.isConnected(); }
  if (next.exitCode === null && next.signalCode === null) next.kill();
  for (let attempt = 0; attempt < 40 && next.exitCode === null && next.signalCode === null; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  report.serverClosed = next.exitCode !== null || next.signalCode !== null;
  check(report.browserClosed && report.serverClosed, 'Owned browser and ephemeral server closed');
  await writeFile(join(output, 'server.log'), log);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
}
const failures = report.checks.filter(check => !check.passed);
console.log(JSON.stringify({ checks: report.checks.length, failed: failures, views: report.views.length,
  axeIncomplete: report.views.map(view => ({ name: view.name, incomplete: view.axe?.incomplete.length ?? null })),
  errors: report.errors, blockedWrites: report.blockedWrites.length, browserClosed: report.browserClosed, serverClosed: report.serverClosed }, null, 2));
assert.ok(report.errors.length === 0 && failures.length === 0, 'sun_consumer_opinion_acceptance_failed');
