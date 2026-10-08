// Actual Next.js UI. No customer session, NFC payload, GPS or simulated response.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF = fileURLToPath(import.meta.url), WEB = resolve(SELF, '../..'), ROOT = resolve(WEB, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const BEACON = 'https://static.cloudflareinsights.com/beacon.min.js/v4bc70e2c01a94c73b74392e4234840661791215815920';
const TOOLBAR = 'https://vercel.live/_next-live/feedback/feedback.js';
const PRODUCT = 'https://www.syngenta.com.ar/product/crop-protection/fungicida/amistar-xtra';
const LABEL = 'https://www.syngenta.com.ar/sites/g/files/kgtney396/files/media/document/2016/08/16/amistar20xtra_etiqueta_4541.pdf';
const SAFETY = 'https://www.syngenta.com.ar/sites/g/files/kgtney396/files/media/document/2024/02/28/AMISTAR%20XTRA_hoja_de_seguridad.pdf';
const LOCALES = ['es-AR', 'en', 'pt-BR'];
const SYSTEM = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|USERPROFILE|APPDATA|LOCALAPPDATA|CI)$/i;

async function runInternal({ origin, phase = 'local', source = git('rev-parse', 'HEAD'), tree = git('rev-parse', 'HEAD^{tree}'), deploymentId = null, runtimeSHA = null, protectionHeader = null, protectionValue = '', output } = {}) {
  assert.equal(new URL(origin).origin, origin);
  assert(['local', 'preview', 'stage', 'public'].includes(phase));
  assert(/^[a-f0-9]{40}$/.test(source) && /^[a-f0-9]{40}$/.test(tree));
  assert.equal(git('rev-parse', 'HEAD'), source);
  assert.equal(git('rev-parse', 'HEAD^{tree}'), tree);
  assert.equal(git('status', '--porcelain'), '');
  if (phase === 'local') assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) && !protectionHeader);
  else {
    assert(/^dpl_[A-Za-z0-9]+$/.test(deploymentId) && /^[a-f0-9]{64}$/.test(runtimeSHA));
    assert(phase === 'public' ? origin === 'https://nexid.lat' : /^https:\/\/nexid-[a-z0-9]+-marcelos-projects-c26aa499\.vercel\.app$/.test(origin));
    assert(phase === 'public' ? !protectionHeader : ['x-vercel-trusted-oidc-idp-token', 'x-vercel-protection-bypass'].includes(protectionHeader) && protectionValue.length > 0);
  }
  await mkdir(output, { recursive: true });
  const report = { schema: 'nexid.syngenta-actual-next-qa/v1', phase, origin, source, tree, deploymentId, actualNextServer: true, syntheticResponses: false, customerAuthenticationProven: false, physicalTapMeasured: false, customerWrites: 0, apiRequests: 0, gpsCalls: 0, checks: [], views: [], stateRoutes: [], accessibility: [], requests: [], excludedTelemetry: [], failures: [], accepted: false, startedAt: new Date().toISOString() };
  const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert(value, name); };
  const headers = path => ({ accept: path.startsWith('/sun') ? 'text/html' : '*/*', 'user-agent': USER_AGENT, 'cache-control': 'no-cache', ...(protectionHeader ? { [protectionHeader]: protectionValue } : {}) });
  const get = async path => { const response = await fetch(origin + path, { headers: headers(path), redirect: 'manual', signal: AbortSignal.timeout(20000) }); assert.equal(response.status, 200, 'own_preflight_http'); const bytes = Buffer.from(await response.arrayBuffer()); assert(bytes.length <= 8 * 1024 * 1024); return bytes; };
  const runtime = await get('/release.json');
  if (phase !== 'local') { check(sha(runtime) === runtimeSHA, 'Runtime manifest exact bytes'); const release = JSON.parse(runtime); check(release.commit === source && release.tree === tree && release.release === '2026.10.08-web-syngenta.1', 'Runtime belongs to exact source and tree'); }
  report.runtimeSha256 = sha(runtime);
  const galleryHtml = (await get('/sun?lang=es-AR')).toString();
  const demoHtml = (await get('/sun?demo=1&profile=syngenta&scenario=closed&lang=es-AR')).toString();
  check(/AMISTAR XTRA/.test(demoHtml) && /_next\/static/.test(demoHtml), 'Real Next document contains product');
  const declaredTelemetry = new Set();
  if ((galleryHtml + demoHtml).includes(BEACON)) declaredTelemetry.add(BEACON);
  const scriptPaths = [...new Set([...`${galleryHtml}${demoHtml}`.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&')).filter(path => path.startsWith('/_next/static/')))];
  for (const path of scriptPaths) { const code = (await get(path)).toString(); if (code.includes(TOOLBAR)) declaredTelemetry.add(TOOLBAR); }
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
  const axe = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  let active = null;
  try {
    for (const locale of LOCALES) for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) {
      const view = `${locale}/${theme}/${width}`;
      const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width, height: 884 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      active = { context, page: null };
      await context.addCookies([{ name: 'theme', value: theme, url: origin }, { name: 'nexid_theme_version', value: 'white-first-v2', url: origin }]);
      await context.addInitScript(() => { window.__qaGps = 0; Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { window.__qaGps++; }, watchPosition() { window.__qaGps++; }, clearWatch() {} } }); });
      const page = await context.newPage(); active.page = page; page.setDefaultTimeout(20000);
      const excluded = new Set();
      page.on('pageerror', () => report.failures.push({ view, kind: 'pageerror' }));
      page.on('console', message => { if (message.type() === 'error') report.failures.push({ view, kind: 'consoleerror' }); });
      page.on('requestfailed', request => { if (!(excluded.has(request.url()) && request.failure()?.errorText === 'net::ERR_BLOCKED_BY_CLIENT')) report.failures.push({ view, kind: 'requestfailed', path: new URL(request.url()).pathname, code: request.failure()?.errorText || 'unknown' }); });
      page.on('response', response => { if (response.status() >= 400) report.failures.push({ view, kind: 'http', status: response.status(), path: new URL(response.url()).pathname }); });
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) {
          if (declaredTelemetry.has(url.href) && request.method() === 'GET' && request.resourceType() === 'script') { excluded.add(url.href); report.excludedTelemetry.push({ view, href: url.href }); return route.abort('blockedbyclient'); }
          report.failures.push({ view, kind: 'external_request', origin: url.origin, path: url.pathname }); return route.abort('blockedbyclient');
        }
        if (request.method() !== 'GET' || url.pathname.startsWith('/api/')) { report.apiRequests++; report.failures.push({ view, kind: 'unexpected_api_or_write', path: url.pathname }); return route.abort('blockedbyclient'); }
        const ownedAsset = /^\/_next\/static\/[A-Za-z0-9_./-]+\.(?:js|css|woff2?|png|webp|svg)$/.test(url.pathname) || /^\/(?:sun|brand|assets|images|fonts|icons|landing|demo|maplibre)\/[A-Za-z0-9_./-]+\.(?:svg|gif|png|jpe?g|webp|avif|woff2?|geojson|mjs|mp4|webm)$/.test(url.pathname) || ['/favicon.ico', '/nexid-favicon.svg', '/release.json', '/_next/image', '/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js'].includes(url.pathname);
        let allowedDocument = false;
        if (url.pathname === '/sun') {
          const params = url.searchParams;
          allowedDocument = [...params.keys()].every(key => ['demo', 'profile', 'scenario', 'source', 'lang', '_rsc'].includes(key) && params.getAll(key).length === 1) && (!params.has('demo') || params.get('demo') === '1') && (!params.has('profile') || ['syngenta', 'valle-secreto', 'agrochem', 'fragrance', 'perfume'].includes(params.get('profile'))) && (!params.has('scenario') || ['closed', 'opened', 'invalid'].includes(params.get('scenario'))) && (!params.has('lang') || LOCALES.includes(params.get('lang'))) && (!params.has('source') || params.get('source') === 'demo-lab');
        }
        if (!ownedAsset && !allowedDocument) { report.failures.push({ view, kind: 'unexpected_owned_path', path: url.pathname }); return route.abort('blockedbyclient'); }
        report.requests.push({ view, path: url.pathname, type: request.resourceType() });
        await route.continue({ headers: { ...request.headers(), ...(protectionHeader ? { [protectionHeader]: protectionValue } : {}) } });
      });
      const goto = path => page.goto(origin + path, { waitUntil: 'networkidle' });
      const noOverflow = async name => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${view}/${name}: no horizontal overflow`);
      await goto(`/sun?lang=${locale}`);
      const gallery = page.getByTestId('sun-demo-gallery'); await gallery.waitFor();
      check(await gallery.locator('a[data-demo-profile]').count() === 4, view + ': four curated profiles');
      const card = gallery.locator('a[data-demo-profile="syngenta"]');
      check((await card.innerText()).includes('AMISTAR XTRA'), view + ': Syngenta product card');
      await noOverflow('gallery'); await card.press('Enter');
      for (const scenario of ['closed', 'opened', 'invalid']) {
        if (scenario !== 'closed') await page.getByTestId('sun-demo-scenario-selector').locator(`a[data-demo-scenario="${scenario}"]`).press('Enter');
        await page.getByTestId('syngenta-demo-experience').waitFor(); await page.waitForLoadState('networkidle');
        const status = page.getByTestId('sun-summary-status');
        check((await page.locator('#sun-summary').innerText()).includes('AMISTAR XTRA'), `${view}/${scenario}: correct product`);
        check(await status.getAttribute('data-demo-scenario') === scenario, `${view}/${scenario}: selected state`);
        check(await status.getAttribute('data-demo-product-state') === ({ closed: 'VALID_CLOSED', opened: 'VALID_OPENED', invalid: 'INVALID' })[scenario], `${view}/${scenario}: state semantics`);
        if (scenario === 'invalid') check(await status.getAttribute('data-demo-protected-actions') === 'blocked', view + ': invalid protected actions blocked');
        const controls = page.getByTestId('sun-demo-scenario-selector');
        check(await controls.locator(`a[data-demo-scenario="${scenario}"]`).getAttribute('aria-current') === 'page', `${view}/${scenario}: state selection reflected`);
        check(await page.locator('html').getAttribute('data-theme') === theme, `${view}/${scenario}: exact theme`);
        check(await page.getByTestId('syngenta-demo-experience').getAttribute('lang') === ({ 'es-AR': 'es', en: 'en', 'pt-BR': 'pt' })[locale], `${view}/${scenario}: exact language`);
        check(await page.getByTestId('valle-secreto-experience').count() === 0 && await page.locator('#qr-engagement').count() === 0, `${view}/${scenario}: no wine tools inherited`);
        check(await page.getByTestId('syngenta-demo-origin').count() === 1 && await page.getByTestId('syngenta-demo-services').count() === 1, `${view}/${scenario}: contextual sections`);
        const image = page.getByTestId('sun-product-image').first(); await image.waitFor();
        await page.waitForFunction(() => { const image = document.querySelector('[data-testid="sun-product-image"]'); return image?.complete && image.naturalWidth > 0; });
        const logo = page.getByTestId('syngenta-demo-experience').locator('img'); await logo.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => { const image = document.querySelector('[data-testid="syngenta-demo-experience"] img'); return image?.complete && image.naturalWidth > 0; });
        check(await image.getAttribute('src')?.then(src => src.includes('/sun/syngenta/amistar-xtra-5l.webp')), `${view}/${scenario}: real commercial reference canister`);
        const sealDetails = page.getByTestId('syngenta-seal-details');
        check(!(await sealDetails.evaluate(el => el.open)), `${view}/${scenario}: technical seal details start collapsed`);
        await sealDetails.locator('summary').press('Enter');
        check(await sealDetails.evaluate(el => el.open), `${view}/${scenario}: keyboard opens seal explanation`);
        check((await sealDetails.innerText()).includes('NTAG 424 DNA TagTamper'), `${view}/${scenario}: concrete seal proposal`);
        const tagSource = sealDetails.locator('[data-syngenta-tag-source]');
        check(await tagSource.getAttribute('href') === 'https://www.nxp.com/docs/en/application-note/AN12196.pdf', `${view}/${scenario}: official chip documentation`);
        await sealDetails.locator('summary').press('Enter');
        check(!(await sealDetails.evaluate(el => el.open)), `${view}/${scenario}: keyboard closes technical detail`);
        const links = page.locator('[data-syngenta-document]');
        check(await links.count() === 5, `${view}/${scenario}: five official document actions`);
        for (const link of await links.all()) {
          check([PRODUCT, LABEL, SAFETY].includes(await link.getAttribute('href')), `${view}/${scenario}: exact official destination`);
          check(await link.getAttribute('rel') === 'noopener noreferrer' && await link.getAttribute('referrerpolicy') === 'no-referrer', `${view}/${scenario}: safe external document action`);
          await link.scrollIntoViewIfNeeded(); const box = await link.boundingBox(); check(box && box.width >= 44 && box.height >= 44, `${view}/${scenario}: document touch target`);
        }
        await noOverflow(scenario);
        const body = await page.locator('body').innerText();
        check(!/15\.2\s?°|62%|Rutini|Profundo|Valle Secreto|CampoNexo|Cachapoal|Pergamino/.test(body), `${view}/${scenario}: no unrelated readings or product identity`);
        report.stateRoutes.push({ view, scenario, route: new URL(page.url()).pathname + new URL(page.url()).search });
        if (width === 390 && locale === 'es-AR') { await page.locator('#sun-summary').scrollIntoViewIfNeeded(); await page.screenshot({ path: join(output, `${theme}-${scenario}-summary.png`) }); }
      }
      await page.getByTestId('syngenta-checklist-start').click();
      for (let step = 0; step < 3; step++) {
        const next = page.getByTestId('syngenta-checklist-next'); check(await next.isDisabled(), `${view}/step${step}: cannot skip unanswered step`);
        await page.getByTestId('syngenta-checklist-option').nth((step + 1) % 3).click(); check(await next.isDisabled(), `${view}/step${step}: wrong answer does not advance`);
        await page.getByTestId('syngenta-checklist-option').nth(step).click(); check(await next.isEnabled(), `${view}/step${step}: useful answer enables next step`);
        await next.click();
      }
      check(await page.getByTestId('syngenta-checklist-complete').isVisible(), view + ': three steps complete');
      await page.getByTestId('syngenta-checklist-restart').click(); check(await page.getByTestId('syngenta-checklist-next').isDisabled(), view + ': restart clears progress');
      await page.keyboard.press('Tab'); await page.getByTestId('syngenta-checklist-option').first().focus();
      check(await page.getByTestId('syngenta-checklist-option').first().evaluate(el => parseFloat(getComputedStyle(el).outlineWidth) >= 2), view + ': visible keyboard focus');
      await noOverflow('checklist');
      await page.addScriptTag({ content: axe });
      const ax = await page.evaluate(async () => { const result = await axe.run('main', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }); return { violations: result.violations.map(rule => ({ id: rule.id, targets: rule.nodes.map(node => node.target) })), incomplete: result.incomplete.map(rule => ({ id: rule.id, targets: rule.nodes.map(node => node.target) })) }; });
      report.accessibility.push({ view, ...ax }); check(ax.violations.length === 0, view + ': AXE automatic checks pass');
      report.gpsCalls += await page.evaluate(() => window.__qaGps);
      await page.waitForTimeout(150); check(report.failures.length === 0, view + ': no unexpected request or runtime failure');
      report.views.push({ view, width, theme, locale, states: 3, checklistCompleted: true });
      await context.close(); active = null;
    }
    check(report.views.length === 18 && report.stateRoutes.length === 54, 'Eighteen contexts and fifty-four state routes complete');
    check(report.apiRequests === 0 && report.gpsCalls === 0 && report.failures.length === 0, 'No business API, geolocation or unexpected failure');
    check(sha(await get('/release.json')) === report.runtimeSha256, 'Runtime remains stable');
    check(git('rev-parse', 'HEAD') === source && git('rev-parse', 'HEAD^{tree}') === tree && git('status', '--porcelain') === '', 'Source remains exact and clean');
    report.accepted = true;
  } catch (error) {
    report.failures.push({ kind: 'gate', name: error?.name || 'unknown', check: report.checks.findLast(check => !check.passed)?.name || null });
    if (active?.page) await active.page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
    if (active?.context) await active.context.close();
  } finally {
    await browser.close(); protectionValue = ''; report.finishedAt = new Date().toISOString();
    await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  const descriptor = { path: join(output, 'report.json'), sha256: sha(await readFile(join(output, 'report.json'))) };
  console.log(JSON.stringify({ accepted: report.accepted, phase, views: report.views.length, stateRoutes: report.stateRoutes.length, checks: report.checks.length, report: descriptor }));
  assert(report.accepted, 'syngenta_actual_next_qa_failed');
  return { report, descriptor };
}

export async function run(options = {}) {
  const output = options.output || process.env.QA_OUTPUT || join(ROOT, 'artifacts/syngenta-' + randomUUID());
  try { return await runInternal({ ...options, output }); }
  catch {
    const reportPath = join(output, 'report.json');
    let exists = false; try { await access(reportPath); exists = true; } catch {}
    if (!exists) {
      await mkdir(output, { recursive: true });
      await writeFile(reportPath, JSON.stringify({ schema: 'nexid.syngenta-actual-next-qa/v1', phase: options.phase || 'local', source: options.source || null, accepted: false, preflightFailed: true, rawErrorStored: false, failures: [{ kind: 'preflight_gate' }], checks: [], views: [], stateRoutes: [], finishedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
      console.log(JSON.stringify({ accepted: false, preflightFailed: true, report: { path: reportPath, sha256: sha(await readFile(reportPath)) } }));
    }
    throw new Error('syngenta_actual_next_qa_failed');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SELF)) {
  const reserve = createServer(); await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve)); const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => SYSTEM.test(key))), NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
  const next = spawn(process.execPath, [join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: WEB, env, windowsHide: true, stdio: 'ignore' });
  const origin = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) { try { ready = (await fetch(origin + '/release.json')).ok; } catch {} if (ready) break; await new Promise(resolve => setTimeout(resolve, 250)); }
    assert(ready, 'actual_next_server_unavailable'); await run({ origin });
  } finally { next.kill(); }
}
