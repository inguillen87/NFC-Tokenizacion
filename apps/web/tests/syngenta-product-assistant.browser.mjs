// Actual Next UI with explicit deterministic transport and GPS fixtures.
// This suite never contacts an LLM provider and does not certify physical taps,
// customer sessions, production delivery, agronomic advice or brand acceptance.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expectedTelemetryFailure, expectedTelemetryConsole, currentSyngentaRscPrefetch } from './syngenta-demo.browser.mjs';

const SELF = fileURLToPath(import.meta.url), WEB = resolve(SELF, '../..'), ROOT = resolve(WEB, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const SESSION = '/api/sommelier/demo/session', CHAT = '/api/sommelier/chat';
const BEACON = 'https://static.cloudflareinsights.com/beacon.min.js/v4bc70e2c01a94c73b74392e4234840661791215815920';
const TOOLBAR = 'https://vercel.live/_next-live/feedback/feedback.js';
const LOCALES = ['es-AR', 'en', 'pt-BR'], WIDTHS = [320, 390, 768];
const FIXTURE = {
  'es-AR': { answer: 'Respuesta sintética de QA. Consultá la ficha oficial y a tu asesor técnico antes de decidir una aplicación.', follow: '¿Dónde consulto la etiqueta oficial?', fallback: 'Información oficial · IA no disponible', live: 'Respuesta IA · fuentes oficiales', retry: 'Reintentar esta pregunta', reset: 'Nueva conversación', error: 'Tu pregunta se conserva', later: '¿Y qué documentos conviene comparar?' },
  en: { answer: 'Synthetic QA answer. Read the official sheet and consult your technical adviser before making an application decision.', follow: 'Where can I find the official label?', fallback: 'Official information · AI unavailable', live: 'AI response · official sources', retry: 'Retry this question', reset: 'New conversation', error: 'Your question is preserved', later: 'Which documents should I compare?' },
  'pt-BR': { answer: 'Resposta sintética de QA. Consulte a ficha oficial e seu assessor técnico antes de decidir uma aplicação.', follow: 'Onde consultar o rótulo oficial?', fallback: 'Informação oficial · IA indisponível', live: 'Resposta IA · fontes oficiais', retry: 'Tentar esta pergunta novamente', reset: 'Nova conversa', error: 'Sua pergunta foi preservada', later: 'Quais documentos devo comparar?' },
};
const SOURCE = { id: 'amistar_xtra', label: 'AMISTAR XTRA · Syngenta Argentina', url: 'https://www.syngenta.com.ar/product/crop-protection/fungicida/amistar-xtra' };
const SAFE_SOURCE_PATHS = [
  'apps/web/src/app/sun/syngenta-demo.ts', 'apps/web/src/app/sun/syngenta-demo-experience.tsx',
  'apps/web/src/app/sun/syngenta-demo-experience.module.css', 'apps/web/src/app/sun/syngenta-demo-map.tsx',
  'apps/web/src/app/sun/syngenta-demo-map.module.css', 'apps/web/src/app/sun/sun-passport-map.tsx',
  'apps/web/src/app/sun/syngenta-product-assistant.tsx', 'apps/web/src/app/sun/syngenta-product-assistant.module.css',
  'apps/web/src/app/sun/page.tsx', 'apps/web/src/app/sun/sun-passport-experience.module.css',
  'apps/web/src/lib/managed-sommelier.ts', 'apps/web/src/app/api/_lib/sommelier-proxy.ts',
];
const SYSTEM = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|USERPROFILE|APPDATA|LOCALAPPDATA|CI)$/i;
const snapshot = async () => Object.fromEntries(await Promise.all(SAFE_SOURCE_PATHS.map(async path => [path, sha(await readFile(join(ROOT, path)))])));

export async function run({ origin, output = join(ROOT, 'artifacts/syngenta-client-experience-20261009/qa', `fixtures-${randomUUID()}`), frozen = false, phase = 'local', deploymentId = null, runtimeSHA = null, source = null, tree: expectedTree = null, protectionHeader = null, protectionValue = '' } = {}) {
  assert(['local', 'preview', 'stage', 'public'].includes(phase), 'known_fixture_phase');
  if (phase === 'local') assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) && !protectionHeader, 'local_fixture_server_only');
  else {
    assert(phase === 'public' ? origin === 'https://nexid.lat' : /^https:\/\/nexid-[a-z0-9]+-marcelos-projects-c26aa499\.vercel\.app$/.test(origin), 'bounded_readonly_fixture_target');
    assert(/^dpl_[A-Za-z0-9]+$/.test(deploymentId) && /^[a-f0-9]{64}$/.test(runtimeSHA) && /^[a-f0-9]{40}$/.test(source) && /^[a-f0-9]{40}$/.test(expectedTree), 'exact_remote_source_and_runtime_required');
    assert(phase === 'public' ? !protectionHeader : ['x-vercel-trusted-oidc-idp-token', 'x-vercel-protection-bypass'].includes(protectionHeader) && protectionValue.length > 0, 'existing_readonly_protection_only');
  }
  await mkdir(output, { recursive: true });
  const sourceBefore = await snapshot(), commit = git('rev-parse', 'HEAD'), tree = git('rev-parse', 'HEAD^{tree}');
  if (frozen) assert.equal(git('status', '--porcelain'), '', 'source_must_be_clean');
  if (phase !== 'local') assert(commit === source && tree === expectedTree, 'local_source_matches_remote_fixture_target');
  const buildId = phase === 'local' ? await readFile(join(WEB, '.next/BUILD_ID'), 'utf8') : null;
  const driverSHA = sha(await readFile(SELF));
  const report = { schema: 'nexid.syngenta-client-ui-fixtures/v1', phase, origin, deploymentId, runtimeSHA, actualNextServer: true, syntheticResponses: true, syntheticTransport: true, syntheticGeolocation: true, realProviderCalls: 0, customerWrites: 0, customerAuthenticationProven: false, physicalTapProven: false, releaseAcceptance: false, accepted: false, commit, tree, sourceBefore, driverSHA, buildId: buildId?.trim() ?? null, frozen, checks: [], views: [], states: [], apiFixtures: [], geolocation: [], requests: [], expectedCancellations: [], expectedHTTP: [], excludedTelemetry: [], accessibility: [], failures: [], startedAt: new Date().toISOString() };
  const check = (value, name) => { report.checks.push({ name, passed: Boolean(value) }); assert(value, name); };
  const get = async path => { const response = await fetch(origin + path, { headers: { accept: path.startsWith('/sun') ? 'text/html' : '*/*', 'user-agent': USER_AGENT, ...(protectionHeader ? { [protectionHeader]: protectionValue } : {}) }, redirect: 'manual', signal: AbortSignal.timeout(20000) }); assert.equal(response.status, 200); return Buffer.from(await response.arrayBuffer()); };
  const runtime = await get('/release.json'); report.runtimeSha256 = sha(runtime);
  if (phase !== 'local') { const parsed = JSON.parse(runtime); check(sha(runtime) === runtimeSHA && parsed.commit === source && parsed.tree === expectedTree, 'Remote served runtime matches the exact fixture target'); }
  const declaration = (await get('/sun?demo=1&profile=syngenta&scenario=closed&lang=es-AR')).toString();
  const declaredTelemetry = new Set(declaration.includes(BEACON) ? [BEACON] : []);
  for (const path of [...new Set([...declaration.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]).filter(path => path.startsWith('/_next/static/')))]) if ((await get(path)).toString().includes(TOOLBAR)) declaredTelemetry.add(TOOLBAR);
  const playwrightModule = process.env.PLAYWRIGHT_MODULE || (process.platform === 'win32' ? 'C:/Users/guill/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs' : null);
  const { chromium } = await import(playwrightModule ? pathToFileURL(playwrightModule).href : 'playwright');
  const axe = await readFile(process.env.AXE_MODULE_PATH || (process.platform === 'win32' ? 'C:/Temp/nexid-qa-deps-20260927/node_modules/axe-core/axe.min.js' : join(ROOT, 'node_modules/axe-core/axe.min.js')), 'utf8');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) });
  let active;
  try {
    for (const locale of LOCALES) for (const theme of ['light', 'dark']) for (const width of WIDTHS) {
      const view = `${locale}/${theme}/${width}`, copy = FIXTURE[locale];
      const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width, height: 884 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.addCookies([{ name: 'theme', value: theme, url: origin }, { name: 'nexid_theme_version', value: 'white-first-v2', url: origin }]);
      await context.addInitScript(() => {
        const calls = [];
        window.__qaGeo = { calls, allow: false, release(index, mode) { const call = calls[index]; if (mode === 'success') call.success({ coords: { latitude: -32.891234567, longitude: -68.843456789, accuracy: 8 } }); else call.failure({ code: mode === 'denied' ? 1 : mode === 'timeout' ? 3 : 2 }); } };
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success, failure, options) { if (!window.__qaGeo.allow) throw new Error('geolocation_without_user_intent'); calls.push({ success, failure, options }); }, watchPosition() { throw new Error('continuous_tracking_forbidden'); }, clearWatch() {} } });
      });
      const page = await context.newPage(); page.setDefaultTimeout(12000); active = { context, page };
      let plan = null, currentScenario = 'closed';
      const excluded = new Set(), cases = [], expectedHTTP = new WeakSet(), expectedCancellation = new WeakSet();
      page.on('pageerror', error => report.failures.push({ view, kind: 'pageerror', name: error.name }));
      page.on('console', message => {
        if (message.type() !== 'error') return;
        const url = message.location().url, text = message.text();
        if (expectedTelemetryConsole({ url, text, declared: declaredTelemetry.has(url), excluded: excluded.has(url) })) return;
        if (/^Failed to load resource: the server responded with a status of 503/.test(text) && [SESSION, CHAT].some(path => url === origin + path) && cases.some(item => item.mode === 'reject-session' || item.mode === 'reject-chat')) return;
        report.failures.push({ view, kind: 'consoleerror', url: new URL(url || origin).pathname });
      });
      page.on('response', response => { if (response.status() >= 400 && !expectedHTTP.has(response.request())) report.failures.push({ view, kind: 'unexpected_http', status: response.status(), path: new URL(response.url()).pathname }); });
      page.on('requestfailed', request => {
        const url = request.url(), code = request.failure()?.errorText || 'unknown';
        if (expectedTelemetryFailure({ url, code, declared: declaredTelemetry.has(url), excluded: excluded.has(url), method: request.method(), resourceType: request.resourceType() })) return;
        if (expectedCancellation.has(request) && request.method() === 'POST' && [SESSION, CHAT].includes(new URL(url).pathname) && code === 'net::ERR_ABORTED') { report.expectedCancellations.push({ view, path: new URL(url).pathname, code }); return; }
        report.failures.push({ view, kind: 'requestfailed', path: new URL(url).pathname, code });
      });
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (url.origin !== origin) {
          if (declaredTelemetry.has(url.href) && request.method() === 'GET' && request.resourceType() === 'script') { excluded.add(url.href); report.excludedTelemetry.push({ view, href: url.href }); return route.abort('blockedbyclient'); }
          report.failures.push({ view, kind: 'external_request', origin: url.origin, path }); return route.abort('blockedbyclient');
        }
        if (path.startsWith('/api/') || request.method() !== 'GET') {
          if (request.method() !== 'POST' || ![SESSION, CHAT].includes(path) || url.search || !plan) { report.failures.push({ view, kind: 'unauthorized_api_or_write', path, method: request.method() }); return route.abort('blockedbyclient'); }
          const current = plan, body = request.postDataJSON();
          current.requests.push(path); report.apiFixtures.push({ view, scenario: currentScenario, case: current.mode, path, body, synthetic: true });
          if (path === SESSION) {
            check(current.requests.length === 1 && Object.keys(body).sort().join(',') === 'locale,profile' && body.profile === 'syngenta' && body.locale === locale, `${view}/${current.mode}: restricted explicit demo session`);
            if (current.mode === 'reject-session') { expectedHTTP.add(request); report.expectedHTTP.push({ view, path, status: 503, case: current.mode }); return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'qa_fixture_unavailable' }) }); }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, profile: 'syngenta', expiresIn: 900 }) });
          }
          check(current.requests.length === 2 && current.requests[0] === SESSION && Object.keys(body).sort().join(',') === 'demoProfile,history,locale,mode,question' && body.demoProfile === 'syngenta' && body.mode === 'demo' && body.locale === locale && typeof body.question === 'string' && body.question.length > 0 && body.question.length <= 1500, `${view}/${current.mode}: explicit bounded demo chat`);
          check(Array.isArray(body.history) && body.history.length <= 6 && Buffer.byteLength(JSON.stringify(body.history)) <= 6000 && body.history.every(turn => ['user', 'assistant'].includes(turn.role) && typeof turn.content === 'string' && turn.content.length <= 1000), `${view}/${current.mode}: bounded conversation without injected roles`);
          current.body = body;
          if (current.mode === 'reject-chat') { expectedHTTP.add(request); report.expectedHTTP.push({ view, path, status: 503, case: current.mode }); return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'qa_fixture_unavailable' }) }); }
          if (current.mode === 'hold-chat') { current.heldRequest = request; await new Promise(resolve => { current.release = resolve; }); }
          const fallback = current.mode === 'fallback';
          const response = { ok: true, answer: copy.answer, source: fallback ? 'fallback' : 'live', fallback, provider: fallback ? undefined : 'qa-fixture-no-provider', model: fallback ? undefined : 'deterministic-browser-fixture', demo: true, demoProfile: 'syngenta', contextSource: 'syngenta_demo', sources: current.mode === 'invalid-source' ? [{ ...SOURCE, url: 'https://untrusted.invalid/claim' }] : [SOURCE], suggestedQuestions: [copy.follow] };
          try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) }); }
          catch { if (!current.cancelled) throw new Error('fixture_fulfill_failed'); }
        } else {
          const headers = request.headers();
          if (currentSyngentaRscPrefetch({ origin, currentUrl: page.url(), requestUrl: request.url(), rsc: headers.rsc === '1', routerPrefetch: headers['next-router-prefetch'] === '1', segmentPrefetch: typeof headers['next-router-segment-prefetch'] === 'string' })) { report.failures.push({ view, kind: 'unexpected_rsc_prefetch', path }); return route.abort('blockedbyclient'); }
          const document = path === '/sun' && [...url.searchParams.keys()].every(key => ['demo', 'profile', 'scenario', 'lang', '_rsc'].includes(key)) && url.searchParams.get('demo') === '1' && url.searchParams.get('profile') === 'syngenta' && ['closed', 'opened', 'invalid'].includes(url.searchParams.get('scenario')) && LOCALES.includes(url.searchParams.get('lang'));
          const asset = /^\/_next\/static\/[A-Za-z0-9_./-]+\.(?:js|css|woff2?|png|webp|svg)$/.test(path) || /^\/(?:sun|brand|assets|images|fonts|icons|landing|demo|maplibre)\/[A-Za-z0-9_./-]+\.(?:svg|gif|png|jpe?g|webp|avif|woff2?|geojson|mjs|mp4|webm)$/.test(path) || ['/favicon.ico', '/nexid-favicon.svg', '/release.json', '/_next/image', '/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js'].includes(path);
          if (!document && !asset) { report.failures.push({ view, kind: 'unexpected_owned_path', path }); return route.abort('blockedbyclient'); }
          report.requests.push({ view, path, method: request.method(), type: request.resourceType() }); return route.continue({ headers: { ...request.headers(), ...(protectionHeader ? { [protectionHeader]: protectionValue } : {}) } });
        }
      });
      const noOverflow = async name => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${view}/${name}: no horizontal overflow`);
      const assistant = () => page.getByTestId('syngenta-product-assistant'), input = () => page.getByTestId('syngenta-assistant-input'), send = () => page.getByTestId('syngenta-assistant-send');
      const resetConversation = async () => { await assistant().getByRole('button', { name: copy.reset, exact: true }).click(); check(await page.getByTestId('syngenta-assistant-answer').count() === 0 && await page.getByTestId('syngenta-assistant-question').count() === 0 && await input().inputValue() === '', `${view}: new conversation clears visible history and input`); };
      const beginCase = mode => { assert.equal(plan, null); const item = { mode, requests: [], cancelled: false }; cases.push(item); plan = item; return item; };
      const finishCase = async (item, count = 2) => { await page.waitForFunction(() => document.querySelector('[data-testid="syngenta-product-assistant"]')?.getAttribute('data-assistant-pending') === 'false'); check(item.requests.length === count, `${view}/${item.mode}: only expected fixture requests`); plan = null; };
      const ask = async (mode, question, method = 'click') => { const item = beginCase(mode); await input().fill(question); if (method === 'keyboard') await send().press('Enter'); else await send().click(); await finishCase(item, mode === 'reject-session' ? 1 : 2); return item; };
      for (const scenario of ['closed', 'opened', 'invalid']) {
        currentScenario = scenario;
        await page.goto(`${origin}/sun?demo=1&profile=syngenta&scenario=${scenario}&lang=${locale}`, { waitUntil: 'networkidle' });
        await assistant().waitFor(); await page.getByTestId('syngenta-demo-map').waitFor();
        check(await page.locator('html').getAttribute('data-theme') === theme, `${view}/${scenario}: exact theme`);
        check(await page.getByTestId('syngenta-demo-experience').getAttribute('lang') === ({ 'es-AR': 'es', en: 'en', 'pt-BR': 'pt' })[locale], `${view}/${scenario}: exact locale`);
        const status = page.getByTestId('sun-summary-status');
        check(await status.getAttribute('data-demo-scenario') === scenario && await status.getAttribute('data-demo-product-state') === ({ closed: 'VALID_CLOSED', opened: 'VALID_OPENED', invalid: 'INVALID' })[scenario], `${view}/${scenario}: truthful selected seal state`);
        if (scenario === 'invalid') check(await status.getAttribute('data-demo-protected-actions') === 'blocked', `${view}: invalid cannot enable protected actions`);
        check(await page.locator('#qr-engagement').count() === 0 && await page.getByTestId('valle-secreto-experience').count() === 0 && await page.getByTestId('agro-dpp-experience').count() === 0, `${view}/${scenario}: no wine or live agro writer inherited`);
        check(await page.locator('[data-sun-passport-map]').getAttribute('data-route-mode') === 'no-route' && await page.locator('[data-sun-passport-map]').getAttribute('data-basemap') === 'local-reference', `${view}/${scenario}: offline map without a fabricated route`);
        check(await page.getByTestId('syngenta-office-reference').innerText().then(text => text.includes('1855') && text.includes('Vicente López')), `${view}/${scenario}: public office address separate from lot origin`);
        check(await page.locator('#syngenta-assistant').count() === 1, `${view}/${scenario}: unique assistant anchor`);
        check(cases.reduce((sum, item) => sum + item.requests.length, 0) === report.apiFixtures.filter(item => item.view === view).length && !plan, `${view}/${scenario}: no API request outside explicit intent`);
        check(await page.evaluate(() => window.__qaGeo.calls.length) === 0, `${view}/${scenario}: no automatic geolocation`);
        check(await send().isDisabled(), `${view}/${scenario}: empty question cannot submit`);
        check(await send().evaluate(el => el.getBoundingClientRect().height >= 44), `${view}/${scenario}: submit has a mobile touch target`);
        await input().fill('   '); check(await send().isDisabled(), `${view}/${scenario}: whitespace does not submit`); await input().fill('');
        await noOverflow(scenario);
        await ask('live', `QA ${locale} ${scenario}: ${copy.later}`, 'keyboard');
        const answer = page.getByTestId('syngenta-assistant-answer').last();
        check((await answer.innerText()).includes(copy.answer) && (await answer.innerText()).includes(copy.live), `${view}/${scenario}: explicit live-shaped fixture renders answer and provenance`);
        const source = answer.locator('a');
        check(await source.count() === 1 && await source.getAttribute('href') === SOURCE.url && await source.getAttribute('target') === '_blank' && (await source.getAttribute('rel')).split(' ').includes('noreferrer') && await source.getAttribute('referrerpolicy') === 'no-referrer', `${view}/${scenario}: official source opens safely without NFC data`);
        check(await input().inputValue() === '', `${view}/${scenario}: successful answer clears input`);
        await noOverflow('answered');
        report.states.push({ view, scenario, assistantFixtureChecked: true });
        if (scenario !== 'closed') continue;
        const follow = beginCase('live'); await page.getByTestId('syngenta-assistant-suggestion').first().click(); await finishCase(follow);
        check(follow.body.history.length === 2 && follow.body.history[0].role === 'user' && follow.body.history[1].role === 'assistant' && follow.body.history[1].content === copy.answer, `${view}: follow-up retains the conversation context`);
        await resetConversation();
        await ask('fallback', `QA ${locale}: fallback`);
        check((await page.getByTestId('syngenta-assistant-answer').innerText()).includes(copy.fallback) && !(await page.getByTestId('syngenta-assistant-answer').innerText()).includes(copy.live) && await input().inputValue() === `QA ${locale}: fallback`, `${view}: fallback is clearly labeled and preserves question`);
        await resetConversation();
        await ask('reject-session', `QA ${locale}: session failure`);
        check(await assistant().getByRole('button', { name: copy.retry, exact: true }).isVisible() && await input().inputValue() === `QA ${locale}: session failure`, `${view}: failed grant preserves input and offers retry without chat`);
        const retry = beginCase('live'); await assistant().getByRole('button', { name: copy.retry, exact: true }).click(); await finishCase(retry);
        check(await page.getByTestId('syngenta-assistant-answer').count() === 1, `${view}: retry recovers a failed question`);
        await resetConversation();
        await ask('reject-chat', `QA ${locale}: chat failure`);
        check(await assistant().getByRole('button', { name: copy.retry, exact: true }).isVisible() && await input().inputValue() === `QA ${locale}: chat failure`, `${view}: failed response preserves input and offers recovery`); await resetConversation();
        await ask('invalid-source', `QA ${locale}: untrusted source`);
        check(await page.getByTestId('syngenta-assistant-answer').count() === 0 && await assistant().getByRole('button', { name: copy.retry, exact: true }).isVisible() && await assistant().locator('a[href*="untrusted.invalid"]').count() === 0, `${view}: unsupported source fails closed without presenting evidence`); await resetConversation();
        const held = beginCase('hold-chat'); await input().fill(`QA ${locale}: cancel delayed answer`); await send().click();
        await page.waitForFunction(() => document.querySelector('[data-testid="syngenta-product-assistant"]')?.getAttribute('data-assistant-pending') === 'true');
        for (let tries = 0; tries < 100 && !held.release; tries++) await page.waitForTimeout(20);
        check(Boolean(held.release), `${view}: delayed chat fixture has entered pending`);
        check(await input().isDisabled() && await send().isDisabled(), `${view}: pending response blocks duplicate submission`);
        held.cancelled = true; expectedCancellation.add(held.heldRequest); await resetConversation(); held.release(); plan = null;
        await page.waitForTimeout(100); check(await page.getByTestId('syngenta-assistant-answer').count() === 0 && await page.getByTestId('syngenta-assistant-question').count() === 0, `${view}: cancelled delayed response cannot restore a conversation`);
        const location = page.getByTestId('syngenta-demo-map'), requestLocation = page.getByTestId('syngenta-demo-location-request'), resetLocation = page.getByTestId('syngenta-demo-location-reset');
        await page.evaluate(() => { window.__qaGeo.allow = true; });
        await requestLocation.click(); check(await requestLocation.isDisabled() && await resetLocation.isVisible(), `${view}: location pending prevents duplicate requests but allows cancel`);
        check(await page.evaluate(() => window.__qaGeo.calls.length) === 1, `${view}: one explicit location request`);
        await page.evaluate(() => window.__qaGeo.release(0, 'success'));
        await page.waitForFunction(() => document.querySelector('[data-testid="syngenta-demo-map"]')?.getAttribute('data-demo-location-state') === 'shared');
        const text = await location.innerText(); check(text.includes('-32.8900') && text.includes('-68.8400') && !text.includes('-32.891234567'), `${view}: browser coordinates are publicly rounded`);
        await resetLocation.click(); check(await location.getAttribute('data-demo-location-state') === 'idle', `${view}: reset restores Mendoza sample`);
        await requestLocation.click(); await page.evaluate(() => window.__qaGeo.release(1, 'denied'));
        await page.waitForFunction(() => document.querySelector('[data-testid="syngenta-demo-map"]')?.getAttribute('data-demo-location-state') === 'denied'); check(await requestLocation.isEnabled(), `${view}: denied location allows a retry`);
        await requestLocation.click(); await page.evaluate(() => window.__qaGeo.release(2, 'timeout'));
        await page.waitForFunction(() => document.querySelector('[data-testid="syngenta-demo-map"]')?.getAttribute('data-demo-location-state') === 'timeout'); check(await requestLocation.isEnabled(), `${view}: native timeout allows retry`);
        await requestLocation.click(); await resetLocation.click(); await page.evaluate(() => window.__qaGeo.release(3, 'success'));
        check(await location.getAttribute('data-demo-location-state') === 'idle', `${view}: cancelled location callback cannot restore coordinates`);
        const geoOptions = await page.evaluate(() => window.__qaGeo.calls.map(call => call.options)); check(geoOptions.length === 4 && geoOptions.every(options => options.enableHighAccuracy === false && options.timeout === 8000 && options.maximumAge === 300000), `${view}: location requests stay bounded and low accuracy`);
        report.geolocation.push({ view, calls: 4, synthetic: true, scenarios: ['rounded-success', 'denied', 'native-timeout', 'reset-late-callback'], options: geoOptions });
        await requestLocation.focus(); check(await requestLocation.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth) >= 2), `${view}: location has visible keyboard focus`);
        await noOverflow('location');
        if (locale === 'es-AR') { await assistant().scrollIntoViewIfNeeded(); await page.screenshot({ path: join(output, `${theme}-${width}-assistant.png`), fullPage: true }); }
      }
      await page.addScriptTag({ content: axe });
      const ax = await page.evaluate(async () => { const result = await axe.run('main', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }); return { violations: result.violations.map(rule => ({ id: rule.id, targets: rule.nodes.map(node => node.target) })), incomplete: result.incomplete.map(rule => ({ id: rule.id, targets: rule.nodes.map(node => node.target) })) }; });
      report.accessibility.push({ view, state: 'invalid', ...ax }); check(ax.violations.length === 0, `${view}: AXE automatic checks pass`);
      await page.waitForTimeout(100); check(report.failures.length === 0, `${view}: no unexpected network or runtime failure`);
      report.views.push({ view, locale, theme, width, states: 3 }); await context.close(); active = null;
    }
    check(report.views.length === 18 && report.states.length === 54, 'All eighteen contexts and fifty-four state routes complete');
    check(report.geolocation.length === 18 && report.geolocation.every(item => item.calls === 4), 'All deterministic geolocation flows complete');
    check(report.realProviderCalls === 0 && report.customerWrites === 0 && report.failures.length === 0, 'No real provider, customer writes or unexpected failures');
    const sourceAfter = await snapshot(); report.sourceAfter = sourceAfter;
    check(JSON.stringify(sourceAfter) === JSON.stringify(sourceBefore) && git('rev-parse', 'HEAD') === commit && git('rev-parse', 'HEAD^{tree}') === tree && sha(await readFile(SELF)) === driverSHA && (phase !== 'local' || (await readFile(join(WEB, '.next/BUILD_ID'), 'utf8')) === buildId), 'Tested source and actual Next build remain stable');
    check(sha(await get('/release.json')) === report.runtimeSha256, 'Served runtime remains stable');
    if (frozen) check(git('status', '--porcelain') === '', 'Frozen source remains clean');
    report.accepted = true;
  } catch (error) {
    report.failures.push({ kind: 'gate', name: error?.name || 'unknown', failedCheck: report.checks.findLast(item => !item.passed)?.name || null });
    if (active?.page) await active.page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
    if (active?.context) await active.context.close();
  } finally {
    await browser.close(); protectionValue = ''; report.finishedAt = new Date().toISOString(); await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  const descriptor = { path: join(output, 'report.json'), sha256: sha(await readFile(join(output, 'report.json'))) };
  console.log(JSON.stringify({ accepted: report.accepted, releaseAcceptance: false, syntheticTransport: true, views: report.views.length, states: report.states.length, checks: report.checks.length, report: descriptor }));
  assert(report.accepted, 'syngenta_client_fixture_ui_qa_failed');
  return { report, descriptor };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SELF)) {
  if (process.env.QA_ORIGIN) { assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.QA_ORIGIN), 'CLI_fixtures_are_local_only'); await run({ origin: process.env.QA_ORIGIN, output: process.env.QA_OUTPUT, frozen: process.env.QA_FROZEN === '1' }); }
  else {
    const reserve = createServer(); await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve)); const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
    const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => SYSTEM.test(key))), NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
    const next = spawn(process.execPath, [join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: WEB, env, windowsHide: true, stdio: 'ignore' });
    const origin = `http://127.0.0.1:${port}`;
    try { let ready = false; for (let attempt = 0; attempt < 120; attempt++) { try { ready = (await fetch(origin + '/release.json')).ok; } catch {} if (ready) break; await new Promise(resolve => setTimeout(resolve, 250)); } assert(ready, 'actual_next_server_unavailable'); await run({ origin, output: process.env.QA_OUTPUT, frozen: process.env.QA_FROZEN === '1' }); }
    finally { next.kill(); }
  }
}
