// Real Next production build, local contract fixture and a synthetic SVG only.
// This checks presentation and interaction; it never certifies a physical TAP.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const web = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(web, '../..');
const phase = process.env.QA_PHASE || 'candidate';
assert.ok(['baseline', 'candidate'].includes(phase), 'QA_PHASE must be baseline or candidate');
assert.ok(process.env.PLAYWRIGHT_MODULE, 'An explicit Playwright module is required');
const output = resolve(process.env.QA_OUTPUT || join(repo, 'artifacts', `sun-visual-refinement-${phase}`));
await mkdir(dirname(output), { recursive: true });
await mkdir(output); // One execution per directory. Never replace earlier evidence.
const { chromium } = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const sharp = (await import('sharp')).default;
const axe = process.env.AXE_MODULE_PATH ? await readFile(process.env.AXE_MODULE_PATH, 'utf8') : null;
const widths = [320, 390, 430, 768, 1440];
const themes = ['light', 'dark'];
const locales = ['es-AR', 'en', 'pt-BR'];
const longProduct = { name: 'Gran Reserva Malbec de Altura · Edición Especial de Ensayo', winery: 'Marca de ensayo · Colección Valle de las Montañas' };
const bottleSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480"><defs><linearGradient id="glass" x1="0" x2="1"><stop stop-color="#15362e"/><stop offset=".5" stop-color="#42705b"/><stop offset="1" stop-color="#102b24"/></linearGradient></defs><rect width="320" height="480" rx="22" fill="#f5f2e9"/><ellipse cx="160" cy="439" rx="61" ry="13" fill="#cad0c3"/><path d="M142 40h36v90c0 29 43 48 43 85v201c0 16-13 27-28 27h-66c-15 0-28-11-28-27V215c0-37 43-56 43-85V40Z" fill="url(#glass)"/><rect x="139" y="27" width="42" height="49" rx="7" fill="#b39a68"/><rect x="110" y="232" width="100" height="128" rx="6" fill="#faf7ed"/><path d="M125 247h70M125 341h70" stroke="#a28957" stroke-width="2"/><text x="160" y="278" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="#233c32">NEXID</text><text x="160" y="304" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#435b50">ENSAYO VISUAL</text><text x="160" y="326" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#435b50">SIN TAP FÍSICO</text><path d="M120 214V393" stroke="#94b29b" stroke-width="5" opacity=".35" stroke-linecap="round"/></svg>';
const cases = [
  ...locales.flatMap(locale => themes.flatMap(theme => widths.map(width => ({ locale, theme, width, state: 'closed', motion: 'reduce', screenshots: true, kind: 'visual' })))),
  ...locales.flatMap(locale => themes.map(theme => ({ locale, theme, width: 390, state: 'closed', motion: 'no-preference', screenshots: false, kind: 'finite-motion' }))),
  ...locales.flatMap(locale => themes.flatMap(theme => ['seal-unknown', 'replay', 'manual-opened'].map(state => ({ locale, theme, width: 390, state, motion: 'reduce', screenshots: false, kind: 'truth' })))),
];
const report = {
  phase, realProductionBuild: true, syntheticContract: true,
  syntheticPhoto: { path: '/qa-product.svg', sha256: createHash('sha256').update(bottleSvg).digest('hex'), description: 'Synthetic bottle, supplied only by the local browser route' },
  syntheticLongProduct: { ...longProduct, states: ['closed'], description: 'Only name and winery in the existing local closed fixture are replaced; no capability, authentication or NFC evidence is added' },
  physicalTapMeasured: false, performanceMeasured: false, buildSourceCorrespondence: 'not_verified_by_this_harness',
  expectedViews: 54, expectedVisualViews: 30, expectedMotionViews: 6, expectedTruthViews: 18,
  checks: [], views: [], errors: [], blockedRequests: [], contextsClosed: 0, browserClosed: false, serverClosed: false,
};
const check = (passed, name, details = undefined) => report.checks.push({ name, passed: Boolean(passed), ...(details === undefined ? {} : { details }) });
const twoFrames = page => page.evaluate(() => new Promise(resolveFrames => requestAnimationFrame(() => requestAnimationFrame(resolveFrames))));
let next, browser, serverLog = '', serverExit;
try {
  report.buildId = (await readFile(join(web, '.next/BUILD_ID'), 'utf8')).trim();
  const reserve = createServer();
  await new Promise(resolveListen => reserve.listen(0, '127.0.0.1', resolveListen));
  const port = reserve.address().port;
  await new Promise(resolveClose => reserve.close(resolveClose));
  const origin = `http://127.0.0.1:${port}`;
  report.origin = origin;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
  Object.assign(env, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' });
  // A per-execution preload changes only presentational text in the closed
  // synthetic fixture, while retaining its original single server read.
  const preload = join(output, 'long-product-fixture.mjs');
  await writeFile(preload, `import ${JSON.stringify(pathToFileURL(join(web, 'tests/sun-mobile-local-fetch.mjs')).href)};
const fixtureFetch = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const response = await fixtureFetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== 'api.nexid.lat' || url.pathname !== '/sun/snapshot/qa-closed' || url.searchParams.get('trace') !== 'synthetic' || url.searchParams.get('access') !== 'invalid') return response;
  const body = await response.json();
  Object.assign(body.contract.product, ${JSON.stringify(longProduct)});
  return Response.json(body, { status: response.status, headers: response.headers });
};
`, { flag: 'wx' });
  next = spawn(process.execPath, ['--import', pathToFileURL(preload).href, join(repo, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: web, env, windowsHide: true });
  next.stdout.on('data', data => { serverLog += data; });
  next.stderr.on('data', data => { serverLog += data; });
  next.once('exit', (code, signal) => { serverExit = { code, signal }; });
  let started = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { const response = await fetch(`${origin}/release.json`); if (response.ok) { report.servedRelease = await response.json(); started = true; break; } } catch {}
    if (serverExit) break;
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  assert.ok(started, 'Local production server must start');
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  report.browserVersion = browser.version();
  for (const entry of cases) {
    const name = `${entry.kind}-${entry.state}-${entry.width}-${entry.theme}-${entry.locale}`;
    const view = { ...entry, name, checksStart: report.checks.length, productRequests: 0, contextClosed: false };
    report.views.push(view);
    let context;
    try {
      context = await browser.newContext({ viewport: { width: entry.width, height: 844 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, locale: entry.locale, reducedMotion: entry.motion, serviceWorkers: 'block' });
      await context.addCookies([{ name: 'theme', value: entry.theme, url: origin }, { name: 'nexid_theme_version', value: 'white-first-v2', url: origin }, { name: 'locale', value: entry.locale, url: origin }]);
      await context.addInitScript(() => { window.__sunVisualGeoCalls = 0; Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__sunVisualGeoCalls++; }, watchPosition() { window.__sunVisualGeoCalls++; } } }); });
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() !== 'GET' || url.origin !== origin) {
          const blocked = { view: name, method: request.method(), origin: url.origin, path: url.pathname, queryKeys: [...url.searchParams.keys()].sort(), abortFulfilled: false };
          report.blockedRequests.push(blocked);
          try { await route.abort(); blocked.abortFulfilled = true; } catch (error) { blocked.error = error.message; }
          return;
        }
        if (url.pathname === '/qa-product.svg') { view.productRequests++; return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: bottleSvg }); }
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"syntheticOnly":true}' });
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      page.on('pageerror', error => report.errors.push({ view: name, message: error.message }));
      const sourceReadsBefore = (serverLog.match(/SUN_QA_READ /g) || []).length;
      await page.goto(`${origin}/sun?snapshot=qa-${entry.state}&trace=synthetic&access=invalid&lang=${entry.locale}`, { waitUntil: 'networkidle' });
      const header = page.getByTestId('sun-passport-header'), summary = page.getByTestId('sun-summary-product');
      await summary.waitFor();
      await page.waitForFunction(() => { const image = document.querySelector('[data-testid="sun-summary-product"] img'); return image && image.complete && image.naturalWidth > 0; });
      await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
      await twoFrames(page);
      check((serverLog.match(/SUN_QA_READ /g) || []).length - sourceReadsBefore === 1, `One synthetic server read ${name}`);
      const observed = await page.evaluate(() => {
        const header = document.querySelector('[data-testid="sun-passport-header"]'), summary = document.querySelector('[data-testid="sun-summary-product"]');
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        const image = summary.querySelector('img'), title = summary.querySelector('h1'), imageCss = getComputedStyle(image), titleCss = getComputedStyle(title);
        const identity = header.querySelector('[data-sun-brand-identity]');
        const mark = identity?.querySelector('svg[viewBox="0 0 160 160"]');
        const primary = document.querySelector('[data-testid="sun-summary-primary"]');
        const disclosures = ['sun-summary-evidence', 'sun-summary-location-disclosure'].map(id => {
          const detail = document.querySelector(`[data-testid="${id}"]`);
          const control = detail?.querySelector(':scope > summary');
          return { id, found: Boolean(detail), native: detail instanceof HTMLDetailsElement, open: detail?.open ?? null, label: control?.textContent.trim() || null, control: control ? rect(control) : null };
        });
        const status = document.querySelector('[data-testid="sun-summary-status"]');
        const controls = [...header.querySelectorAll('a,button,select')].filter(element => element.getClientRects().length).map(element => ({ tag: element.tagName, label: element.getAttribute('aria-label') || element.textContent.trim(), rect: rect(element) }));
        const animations = [...header.getAnimations({ subtree: true }), ...summary.getAnimations({ subtree: true })].map(animation => ({ playState: animation.playState, timing: animation.effect?.getTiming(), target: animation.effect?.target?.className?.baseVal || animation.effect?.target?.className || null }));
        const declarations = [header, ...header.querySelectorAll('*'), summary, ...summary.querySelectorAll('*')].map(element => ({ tag: element.tagName, className: element.className?.baseVal || element.className, visible: element.getClientRects().length > 0, name: getComputedStyle(element).animationName, iterations: getComputedStyle(element).animationIterationCount, duration: getComputedStyle(element).animationDuration })).filter(value => value.name !== 'none');
        return { scroll: { x: scrollX, y: scrollY }, locale: document.documentElement.lang, theme: document.documentElement.dataset.theme, overflow: document.documentElement.scrollWidth > innerWidth, header: rect(header), summary: rect(summary), controls, brand: { variant: identity?.dataset.sunBrandVariant || null, markFrame: mark ? rect(mark.parentElement) : null }, primary: primary ? { rect: rect(primary), text: primary.textContent.trim(), href: primary.getAttribute('href') } : null, disclosures, status: { rect: rect(status), headline: status.querySelector('h2')?.textContent.trim(), copy: status.querySelector('.sun-summary-status__copy')?.textContent.trim(), insideClosedDetails: Boolean(status.closest('details:not([open])')) }, title: { text: title.textContent.trim(), rect: rect(title), fontSize: parseFloat(titleCss.fontSize), lineHeight: parseFloat(titleCss.lineHeight), family: titleCss.fontFamily, weight: titleCss.fontWeight }, image: { rect: rect(image), src: image.getAttribute('src'), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, loading: image.loading, priority: image.fetchPriority, objectFit: imageCss.objectFit, filter: imageCss.filter, clipPath: imageCss.clipPath, maskImage: imageCss.maskImage, state: image.dataset.imageState || null }, animations, declarations, geoCalls: window.__sunVisualGeoCalls };
      });
      view.observed = observed;
      check(observed.scroll.x === 0 && observed.scroll.y === 0, `Top viewport ${name}`, observed.scroll);
      check(observed.theme === entry.theme, `Requested theme ${name}`, observed.theme);
      check(observed.locale === entry.locale, `Requested language ${name}`, observed.locale);
      check(!observed.overflow, `No viewport overflow ${name}`);
      check(observed.geoCalls === 0, `No location request ${name}`);
      check(observed.controls.length >= 3 && observed.controls.every(control => control.rect.width >= 44 && control.rect.height >= 44 && control.rect.x >= 0 && control.rect.right <= entry.width), `Header targets at least 44px and within viewport ${name}`, observed.controls);
      // Compare resolved CSS lengths at the browser's 1/64px layout resolution.
      // Dividing 24.192 by 21.6 produces 1.1199999999999999 in JavaScript.
      check(observed.title.fontSize >= 21 && observed.title.lineHeight + 1 / 64 >= observed.title.fontSize * 1.12, `Readable product heading ${name}`, { ...observed.title, requiredLineHeight: observed.title.fontSize * 1.12, cssLengthResolutionPx: 1 / 64 });
      check(observed.image.objectFit === 'contain' && observed.image.clipPath === 'none' && observed.image.maskImage === 'none', `Complete product photograph ${name}`, observed.image);
      check(observed.image.loading === 'eager' && observed.image.priority === 'high', `Main photo priority ${name}`);
      if (phase === 'candidate') {
        const expectedMarkSize = entry.width >= 390 ? 80 : 72;
        check(observed.brand.variant === 'passport' && observed.brand.markFrame?.width === expectedMarkSize && observed.brand.markFrame?.height === expectedMarkSize, `Large reserved Ni header ${name}`, { observed: observed.brand, expectedMarkSize });
        check(observed.image.filter === 'none', `Photo colours are not filtered ${name}`, observed.image.filter);
        check(observed.image.state === 'ready', `Decoded main image has ready state ${name}`, observed.image.state);
        check(observed.disclosures.every(detail => detail.found && detail.native && detail.open === false), `Supporting details are closed by default ${name}`, observed.disclosures);
        check(await page.getByTestId('sun-summary-status').isVisible() && !observed.status.insideClosedDetails && Boolean(observed.status.headline) && Boolean(observed.status.copy), `Reading result stays visible outside supporting details ${name}`, observed.status);
        if (entry.state === 'closed') {
          check(observed.title.text === longProduct.name, `Long synthetic product text is retained ${name}`, observed.title.text);
          const primary = observed.primary?.rect;
          check(await page.getByTestId('sun-summary-primary').isVisible() && primary && primary.width >= 44 && primary.height >= 44 && primary.x >= 0 && primary.y >= 0 && primary.right <= entry.width && primary.bottom <= 844, `Primary action fully visible in first viewport ${name}`, observed.primary);
        }
      }
      if (entry.motion === 'reduce') check(observed.animations.every(animation => !['running', 'pending'].includes(animation.playState)), `Reduced motion has no active decoration ${name}`, observed.animations);
      if (entry.kind === 'finite-motion') {
        check(observed.declarations.length > 0 && observed.declarations.every(animation => animation.visible && !animation.iterations.split(',').some(value => value.trim() === 'infinite')), `Visible decoration is finite ${name}`, observed.declarations);
        await page.evaluate(async () => { const roots = [document.querySelector('[data-testid="sun-passport-header"]'), document.querySelector('[data-testid="sun-summary-product"]')]; const animations = roots.flatMap(root => root.getAnimations({ subtree: true })); await Promise.race([Promise.all(animations.map(animation => animation.finished.catch(() => {}))), new Promise((_, reject) => setTimeout(() => reject(new Error('finite_animation_did_not_finish')), 2000))]); });
        check(await page.evaluate(() => [document.querySelector('[data-testid="sun-passport-header"]'), document.querySelector('[data-testid="sun-summary-product"]')].flatMap(root => root.getAnimations({ subtree: true })).every(animation => animation.playState !== 'running')), `Finite decoration finishes ${name}`);
      }
      const tone = await page.getByTestId('sun-summary-status').getAttribute('data-status-tone');
      check(tone === (entry.state === 'closed' ? 'closed' : ['replay', 'manual-opened'].includes(entry.state) ? 'risk' : 'verified'), `Reported NFC state is retained ${name}`, tone);
      if (entry.state === 'seal-unknown') check(await page.getByTestId('sun-summary-facts').getByText(entry.locale === 'en' ? 'Not provided' : entry.locale === 'pt-BR' ? 'Não informado' : 'No informado', { exact: true }).count() === 1, `Unknown seal does not become closed ${name}`);
      if (entry.state === 'replay') check(await page.locator('a[href="#fresh-tap-required"]').count() > 0 && await page.getByTestId('sun-summary-primary').isVisible(), `Replay recovery remains available ${name}`);
      if (entry.state === 'manual-opened') {
        const manual = page.getByTestId('sun-summary-manual-opening');
        const manualObservation = await manual.evaluate(element => ({ text: element.textContent.trim(), insideClosedDetails: Boolean(element.closest('details:not([open])')) }));
        const phrases = entry.locale === 'en' ? [/\boperator\b/i, /not automatically detected/i, /do not use the product/i] : entry.locale === 'pt-BR' ? [/\boperador\b/i, /não foi detectada automaticamente/i, /não use o produto/i] : [/\boperador\b/i, /no fue detectada automáticamente/i, /no uses el producto/i];
        view.manualOpening = manualObservation;
        check(await manual.isVisible() && !manualObservation.insideClosedDetails && phrases.every(phrase => phrase.test(manualObservation.text)), `Manual opening warning is visible and localized ${name}`, manualObservation);
        const brandLabel = entry.locale === 'en' ? /\b(?:notify|contact|inform|report to) (?:the )?brand\b/i : entry.locale === 'pt-BR' ? /\b(?:avisar|notificar|contatar) (?:a )?marca\b/i : /\bavisar a la marca\b/i;
        check(await page.getByTestId('sun-summary-primary').isVisible() && observed.primary?.href === '#report-problem' && brandLabel.test(observed.primary.text), `Manual opening offers the existing brand report ${name}`, observed.primary);
      }
      // One native initial viewport, before image interaction changes focus.
      // Header/summary crops derive from that same bitmap, not another frame.
      if (entry.screenshots) {
        check(await page.evaluate(() => scrollX === 0 && scrollY === 0), `Screenshot remains at top ${name}`);
        const png = await page.screenshot({ path: join(output, `${name}-viewport.png`), fullPage: false });
        const crop = async (kind, rect) => {
          const left = Math.max(0, Math.floor(rect.x)), top = Math.max(0, Math.floor(rect.y));
          const right = Math.min(entry.width, Math.ceil(rect.right)), bottom = Math.min(844, Math.ceil(rect.bottom));
          if (right <= left || bottom <= top) return null;
          const path = `${name}-${kind}.png`;
          await sharp(png).extract({ left, top, width: right - left, height: bottom - top }).png().toFile(join(output, path));
          return { path, derivedFromViewport: true, entireElementVisible: rect.x >= 0 && rect.y >= 0 && rect.right <= entry.width && rect.bottom <= 844 };
        };
        view.screenshots = { stage: 'initial-entry-before-any-interaction', viewport: `${name}-viewport.png`, header: await crop('header', observed.header), summary: await crop('summary', observed.summary) };
      }
      if (phase === 'candidate' && entry.kind === 'visual') {
        const trigger = summary.getByTestId('sun-image-zoom');
        const box = await trigger.boundingBox();
        check(box && box.width >= 44 && box.height >= 44, `Image enlargement target at least 44px ${name}`, box);
        const requestsBefore = view.productRequests;
        await trigger.click();
        const dialog = page.getByTestId('sun-image-dialog');
        await dialog.waitFor({ state: 'visible' });
        check(await dialog.evaluate(element => element instanceof HTMLDialogElement && element.open && element.matches(':modal')), `Image dialog is native modal ${name}`);
        const close = dialog.getByTestId('sun-image-close');
        check(await close.evaluate(element => document.activeElement === element), `Image dialog receives focus ${name}`);
        await page.keyboard.press('Tab');
        check(await dialog.evaluate(element => element.contains(document.activeElement)), `Image dialog contains keyboard focus ${name}`);
        await page.keyboard.press('Shift+Tab');
        check(await dialog.evaluate(element => element.contains(document.activeElement)), `Reverse tab remains in image dialog ${name}`);
        const bitmap = dialog.getByTestId('sun-image-expanded');
        check(await bitmap.evaluate(element => element instanceof HTMLCanvasElement && element.width === 320 && element.height === 480), `Enlargement reuses supplied image dimensions ${name}`);
        if (axe && entry.width === 390) {
          await page.addScriptTag({ content: axe });
          view.dialogViolations = await page.evaluate(async () => (await axe.run('[data-testid="sun-image-dialog"]', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(value => ({ id: value.id, targets: value.nodes.map(node => node.target) })));
          check(!view.dialogViolations.length, `Open image dialog accessibility ${name}`, view.dialogViolations);
        }
        if (entry.width === 390 && entry.locale === 'es-AR') {
          view.dialogScreenshot = { stage: 'interaction-image-dialog-open', path: `${name}-image-dialog-open.png`, initialViewportComparison: false };
          await page.screenshot({ path: join(output, view.dialogScreenshot.path), fullPage: false });
        }
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        check(await trigger.evaluate(element => document.activeElement === element), `Escape returns focus to image action ${name}`);
        await page.waitForLoadState('networkidle');
        check(view.productRequests === requestsBefore, `Enlargement makes no second photo request ${name}`, { before: requestsBefore, after: view.productRequests });
        await page.evaluate(() => window.scrollTo(0, 0));
        await twoFrames(page);
      }
      if (phase === 'candidate') {
        view.disclosureInteractions = [];
        for (const id of ['sun-summary-evidence', 'sun-summary-location-disclosure']) {
          const detail = page.getByTestId(id), control = detail.locator(':scope > summary'), body = detail.locator(':scope > div');
          check(!await body.isVisible(), `Collapsed ${id} hides supporting body ${name}`);
          await control.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(id => document.querySelector(`[data-testid="${id}"]`)?.open === true, id);
          const opened = await detail.evaluate(element => ({ open: element.open, text: element.querySelector(':scope > div').textContent.trim(), controlFocused: document.activeElement === element.querySelector(':scope > summary') }));
          view.disclosureInteractions.push({ id, opened });
          check(opened.open && opened.controlFocused && opened.text.length > 0 && await body.isVisible(), `Enter opens ${id} with visible content and retained focus ${name}`, opened);
          await page.keyboard.press('Enter');
          await page.waitForFunction(id => document.querySelector(`[data-testid="${id}"]`)?.open === false, id);
          check(!await body.isVisible() && await control.evaluate(element => document.activeElement === element), `Enter closes ${id} and keeps its control reachable ${name}`);
        }
      }
      if (axe && entry.width === 390 && entry.kind === 'visual') {
        await page.addScriptTag({ content: axe });
        view.violations = await page.evaluate(async () => (await axe.run('[data-testid="sun-passport-header"],#sun-summary', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(value => ({ id: value.id, targets: value.nodes.map(node => node.target) })));
        check(!view.violations.length, `Header and summary accessibility ${name}`, view.violations);
      }
      if (phase === 'candidate' && entry.kind === 'visual' && entry.width === 390) {
        // A 195x422 CSS viewport represents the reflow space of this 390x844
        // window at 200%. It is a responsive reflow test, not browser zoom.
        await page.setViewportSize({ width: 195, height: 422 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await twoFrames(page);
        const reflow = await page.evaluate(() => {
          const header = document.querySelector('[data-testid="sun-passport-header"]');
          const title = document.querySelector('[data-testid="sun-summary-product"] h1');
          const titleCss = getComputedStyle(title);
          const mark = header.querySelector('[data-sun-brand-identity] svg[viewBox="0 0 160 160"]');
          const markRect = mark?.parentElement.getBoundingClientRect();
          const controls = [...header.querySelectorAll('a,button,select')].filter(element => element.getClientRects().length).map(element => { const rect = element.getBoundingClientRect(); return { tag: element.tagName, x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right }; });
          return { viewport: { width: innerWidth, height: innerHeight }, scroll: { x: scrollX, y: scrollY }, scrollWidth: document.documentElement.scrollWidth, controls, markFrame: markRect ? { width: markRect.width, height: markRect.height } : null, title: { fontSize: parseFloat(titleCss.fontSize), lineHeight: parseFloat(titleCss.lineHeight), text: title.textContent }, language: document.documentElement.lang, theme: document.documentElement.dataset.theme };
        });
        view.reflow200PercentEquivalent = { simulation: 'CSS viewport halved in both dimensions', nativeBrowserZoomChanged: false, originalViewport: { width: 390, height: 844 }, observed: reflow, screenshot: `${name}-reflow200-equivalent.png` };
        check(reflow.viewport.width === 195 && reflow.viewport.height === 422 && reflow.scroll.x === 0 && reflow.scroll.y === 0, `200 percent equivalent reflow at top ${name}`, reflow);
        check(reflow.scrollWidth <= reflow.viewport.width, `200 percent equivalent has no horizontal overflow ${name}`, reflow.scrollWidth);
        check(reflow.markFrame?.width === 56 && reflow.markFrame?.height === 56, `200 percent equivalent keeps reserved Ni identity ${name}`, reflow.markFrame);
        check(reflow.title.fontSize >= 21 && reflow.title.lineHeight + 1 / 64 >= reflow.title.fontSize * 1.12, `200 percent equivalent retains readable title ${name}`, reflow.title);
        check(reflow.controls.length >= 3 && reflow.controls.every(control => control.width >= 44 && control.height >= 44 && control.x >= 0 && control.right <= reflow.viewport.width), `200 percent equivalent keeps header controls reachable ${name}`, reflow.controls);
        check(reflow.language === entry.locale && reflow.theme === entry.theme, `200 percent equivalent preserves language and theme ${name}`);
        await page.screenshot({ path: join(output, view.reflow200PercentEquivalent.screenshot), fullPage: false });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await twoFrames(page);
      }
      view.sourceReadCount = (serverLog.match(/SUN_QA_READ /g) || []).length - sourceReadsBefore;
      check(view.sourceReadCount === 1, `Visual actions do not reconsume source ${name}`, view.sourceReadCount);
      check(await page.evaluate(() => window.__sunVisualGeoCalls) === 0, `Visual actions do not request location ${name}`);
    } catch (error) {
      view.failure = error.message;
      check(false, `Visual observation completed ${name}`, error.message);
    } finally {
      if (context) { try { await context.close(); view.contextClosed = true; report.contextsClosed++; } catch (error) { view.closeError = error.message; check(false, `Context closed ${name}`, error.message); } }
      view.checksEnd = report.checks.length;
      await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ view: name, completed: report.views.length, total: cases.length, failed: report.checks.filter(value => !value.passed).length, contextClosed: view.contextClosed }));
    }
  }
  check(report.views.length === 54 && report.contextsClosed === 54 && report.views.filter(view => view.kind === 'visual').length === 30 && report.views.filter(view => view.kind === 'finite-motion').length === 6 && report.views.filter(view => view.kind === 'truth').length === 18, 'All declared contexts completed and closed');
  check(!report.errors.length, 'No browser errors', report.errors);
  check(report.blockedRequests.every(request => request.abortFulfilled), 'All forbidden requests were actually aborted');
} catch (error) {
  report.fatal = error.message;
  check(false, 'Production visual suite completed', error.message);
} finally {
  if (browser) { try { await browser.close(); report.browserClosed = true; } catch (error) { report.browserCloseError = error.message; } }
  if (next) {
    if (!serverExit) next.kill();
    for (let attempt = 0; attempt < 50 && !serverExit; attempt++) await new Promise(resolveWait => setTimeout(resolveWait, 100));
    report.serverClosed = Boolean(serverExit);
    report.serverExit = serverExit || null;
  }
  check(report.browserClosed && report.serverClosed, 'Owned browser and server are closed');
  await writeFile(join(output, 'server.log'), serverLog);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ phase, views: report.views.length, checks: report.checks.length, failed: report.checks.filter(value => !value.passed), errors: report.errors.length, browserClosed: report.browserClosed, serverClosed: report.serverClosed, output }, null, 2));
assert.ok(report.checks.every(value => value.passed), 'Production visual checks must all pass');
