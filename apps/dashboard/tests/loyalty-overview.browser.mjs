import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { constants as fsConstants, existsSync } from 'node:fs';
import { mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Only the existing hosted CI runner may start the isolated Next process.
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.platform, 'linux');
assert.ok(process.env.GITHUB_WORKSPACE && process.env.PLAYWRIGHT_MODULE && process.env.AXE_MODULE_PATH && process.env.QA_OUTPUT);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axeSource = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
const root = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
assert.equal(root, await realpath(process.env.GITHUB_WORKSPACE), 'Loyalty QA must run from its owned CI checkout');
const dashboard = join(root, 'apps/dashboard');
assert.equal(await realpath(dashboard), dashboard, 'Dashboard path must not resolve outside its CI checkout');
const output = resolve(process.env.QA_OUTPUT);
for (const dir of [root, dashboard]) {
  for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    assert.ok(!existsSync(join(dir, file)), 'Refuse to load application env files in synthetic QA');
  }
}
const productionDist = join(dashboard, '.next');
assert.equal(await realpath(productionDist), productionDist, 'Earlier Next build must use the checkout production dist');
const typeFiles = await Promise.all(['next-env.d.ts', 'tsconfig.json'].map(name => snapshotFile(dashboard, name)));
const productionMarkers = await Promise.all(['BUILD_ID', 'required-server-files.json'].map(name => snapshotFile(productionDist, name)));

async function snapshotFile(directory, name) {
  const file = await open(join(directory, name), fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const metadata = await file.stat();
    assert.ok(metadata.isFile() && metadata.nlink === 1 && metadata.size > 0 && metadata.size <= 8_388_608, 'Invalid QA snapshot file: ' + name);
    return { directory, name, mode: metadata.mode, bytes: await file.readFile() };
  } finally {
    await file.close();
  }
}

async function restoreTypeFiles() {
  assert.equal(await realpath(dashboard), dashboard, 'Dashboard path changed while Next was running');
  const restored = [];
  for (const saved of typeFiles) {
    const file = await open(join(saved.directory, saved.name), fsConstants.O_RDWR | fsConstants.O_NOFOLLOW);
    try {
      const metadata = await file.stat();
      assert.ok(metadata.isFile() && metadata.nlink === 1 && metadata.mode === saved.mode && metadata.size <= 8_388_608, 'Generated file changed type or mode: ' + saved.name);
      if ((await file.readFile()).equals(saved.bytes)) continue;
      const { bytesWritten } = await file.write(saved.bytes, 0, saved.bytes.length, 0);
      assert.equal(bytesWritten, saved.bytes.length, 'Incomplete generated type restoration: ' + saved.name);
      await file.truncate(saved.bytes.length);
      restored.push(saved.name);
    } finally {
      await file.close();
    }
  }
  for (const saved of typeFiles) {
    const current = await snapshotFile(saved.directory, saved.name);
    assert.ok(current.mode === saved.mode && current.bytes.equals(saved.bytes), 'Generated type did not return to its original bytes: ' + saved.name);
  }
  return restored;
}

const tenant = 'qa-loyalty-layout';
const credential = 'qa-loyalty-' + randomUUID();
const session = {
  id: 'qa-loyalty-session', userId: 'qa-loyalty-user', tenantId: 'qa-loyalty-tenant',
  tenantSlug: tenant, email: 'loyalty-layout@example.invalid', label: 'Operación QA',
  role: 'tenant-admin', permissions: ['crm:read', 'rewards:read'], deniedPermissions: [],
  mfaVerified: true, setupCompleted: true, isDemo: false,
};
const consumerOverview = {
  ok: true,
  tenant,
  overview: {
    totalActivity: 90, totalTaps: 60, customerActions: 30,
    activityWithKnownActor: 45, activityWithoutActor: 45, actorLinkedActivityRate: 50,
    recognizedUnits: 15, knownActors: 20, verifiedIdentityActors: 10, activeTenantMembers: 20,
    consentPurpose: 'marketing', consentedActorsByChannel: { email: 0, phone: 2 },
    savedProducts: 8, riskBlockedClaims: 7,
  },
  provenance: {
    contractVersion: 'consumer-network-event-provenance/v1', state: 'classified',
    primaryScope: 'operational_tap', timezone: 'UTC', physicalPresenceClaim: 'not_asserted',
    counts: { operationalTap: 60, declaredDemo: 0, imported: 0, legacyUnclassified: 0, mixed: 0 },
    hasIsolatedRecords: false, latestOperationalAt: '2026-11-01T11:00:00.000Z',
    observedAt: '2026-11-01T12:00:00.000Z',
    evidenceBasis: {
      operationalTap: 'Registros sintéticos de QA', declaredDemo: 'Sin registros demo',
      legacyUnclassified: 'Sin registros anteriores',
    },
  },
  identityBoundary: 'Datos sintéticos, sin evidencia física.',
  topProductsByClaims: [],
};
const readModels = {
  '/admin/loyalty/overview': { active_programs: 2, total_members: 123, points_issued: 456, points_redeemed: 78 },
  '/admin/consumer-network/overview': consumerOverview,
  '/admin/loyalty/rewards': { ok: true, tenant, scope: 'tenant', rewards: [] },
  '/admin/engagement': {
    ok: true,
    scope: { tenant: { id: session.tenantId, slug: tenant, name: 'Empresa QA' }, range: '24h', domain: 'all', stage: 'all', source: 'all', limit: 120 },
    taxonomy: { version: 'nexid-post-tap-engagement-v1' },
    totals: { matched: 0, returned: 0, truncated: false },
    items: [],
    boundaries: { actor: 'Sin actores reales', source: 'Datos sintéticos', confirmed: 'Sin confirmaciones reales' },
  },
};
const requiredReads = ['/admin/loyalty/overview', '/admin/consumer-network/overview', '/admin/loyalty/rewards'];
const counts = Object.fromEntries(['/auth/session', ...Object.keys(readModels)].map(path => [path, 0]));
let rejectedFixtureRequests = 0;
const upstream = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'GET' || req.headers.authorization !== 'Bearer ' + credential) {
    rejectedFixtureRequests++;
    send(403, { ok: false });
    return;
  }
  if (url.pathname === '/auth/session' && !url.search) {
    counts[url.pathname]++;
    send(200, { ok: true, session });
    return;
  }
  const tenants = url.searchParams.getAll('tenant');
  if (Object.hasOwn(readModels, url.pathname) && tenants.length === 1 && tenants[0] === tenant) {
    counts[url.pathname]++;
    send(200, readModels[url.pathname]);
    return;
  }
  rejectedFixtureRequests++;
  send(404, { ok: false });
});

const origin = 'http://127.0.0.1:3482';
const guard = join(root, 'scripts/qa/recall-loopback-only.cjs');
const nextBin = join(root, 'node_modules/next/dist/bin/next');
const report = {
  route: '/loyalty/overview', mode: 'actual-next-synthetic-upstream', productionTested: false,
  views: [], nextGracefulClose: false, restoredTypeFiles: [], productionMarkersPreserved: false,
};
let browser;
let next;
let nextClosed;
let spawnFailed = false;
let checksCompleted = false;
let phase = 'start-fixture';

try {
  await mkdir(output, { recursive: true });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const api = 'http://127.0.0.1:' + upstream.address().port;
  const childEnv = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'CI'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const distDir = '.next-loyalty-layout-' + randomUUID();
  assert.ok(!existsSync(join(dashboard, distDir)), 'Isolated Next dev dist already exists');
  phase = 'start-next';
  next = spawn(process.execPath, [nextBin, 'dev', dashboard, '--hostname', '127.0.0.1', '--port', '3482'], {
    cwd: root,
    stdio: 'ignore',
    env: {
      ...childEnv,
      NODE_OPTIONS: '--max-old-space-size=4096 --require=' + JSON.stringify(guard),
      NEXT_DIST_DIR: distDir, NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_API_URL: api, NEXT_PUBLIC_API_BASE_URL: api,
      NEXT_PUBLIC_APP_URL: origin, NEXT_PUBLIC_DASHBOARD_URL: origin, NEXT_PUBLIC_ENABLE_PWA: 'false',
      REQUIRE_SCOPED_ADMIN_AUTH: 'true',
      DASHBOARD_BODEGA_DEMO_ACCESS: 'false', DASHBOARD_ONE_CLICK_ACCESS: 'false', DASHBOARD_AUTO_SESSION: 'false',
    },
  });
  next.once('error', () => { spawnFailed = true; });
  nextClosed = new Promise(done => next.once('close', (code, signal) => done({ code, signal })));
  const deadline = performance.now() + 45_000;
  let ready = false;
  while (!ready && performance.now() < deadline) {
    assert.ok(!spawnFailed && next.exitCode === null && next.signalCode === null, 'Owned Next process exited before readiness');
    try {
      const response = await fetch(origin + '/logo-mark.svg', { redirect: 'error', signal: AbortSignal.timeout(1_000) });
      ready = response.ok && response.headers.get('content-type')?.includes('image/svg+xml');
      await response.body?.cancel();
    } catch {
      // A cold Next dev server may not accept requests until compilation starts.
    }
    if (!ready) await delay(250);
  }
  assert.ok(ready, 'Isolated Next server did not serve its local readiness asset');

  phase = 'launch-browser';
  browser = await chromium.launch({ headless: true, timeout: 15_000 });
  for (const { width, height, split } of [{ width: 360, height: 780, split: false }, { width: 1100, height: 820, split: true }]) {
    for (const theme of ['light', 'dark']) {
      phase = 'browser-' + width + '-' + theme;
      const before = { ...counts };
      const context = await browser.newContext({ viewport: { width, height }, locale: 'es-AR', colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        await context.routeWebSocket('**/*', socket => {
          if (new URL(socket.url()).origin === origin.replace(/^http:/, 'ws:')) socket.connectToServer();
          else void socket.close();
        });
        await context.addCookies([
          { name: 'nexid_dashboard_session', value: credential, url: origin, httpOnly: true, sameSite: 'Lax' },
          { name: 'locale', value: 'es-AR', url: origin },
          { name: 'theme', value: theme, url: origin },
          { name: 'nexid_theme_version', value: 'white-first-v2', url: origin },
        ]);
        const page = await context.newPage();
        page.setDefaultTimeout(8_000);
        const pageErrors = [];
        page.on('pageerror', () => pageErrors.push('pageerror'));
        const response = await page.goto(origin + '/loyalty/overview', { waitUntil: 'load', timeout: 55_000 });
        assert.ok(response?.ok(), 'Actual loyalty overview did not load');
        assert.equal(new URL(page.url()).pathname, '/loyalty/overview');
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);

        const panel = page.getByRole('region', { name: 'Cobertura de relación y permisos', exact: true });
        const identity = panel.getByRole('region', { name: 'Vínculos e identidad', exact: true });
        const consent = panel.getByRole('region', { name: 'Consentimientos por canal', exact: true });
        await panel.waitFor();
        await panel.getByText('50%', { exact: true }).waitFor();
        const samples = [
          [identity, 'Actores conocidos', '20'],
          [identity, 'Identidad verificada', '10'],
          [consent, 'Email opt-in', '0'],
          [consent, 'WhatsApp opt-in', '—'],
          [consent, 'Teléfono opt-in', '2'],
        ];
        for (const [group, label, value] of samples) {
          const card = group.getByText(label, { exact: true }).locator('..');
          await card.getByText(value, { exact: true }).waitFor();
          const reason = card.getByText('No informado por la fuente', { exact: true });
          assert.equal(await reason.count(), value === '—' ? 1 : 0, label + ': missing and zero have distinct copy');
          if (value === '—') await reason.waitFor();
          assert.ok(await card.evaluate(node => {
            const bounds = node.getBoundingClientRect();
            const range = document.createRange();
            return node.scrollWidth <= node.clientWidth + 1 && [...node.querySelectorAll('p')].every(text => {
              range.selectNodeContents(text);
              const rects = [...range.getClientRects()];
              return rects.length > 0 && rects.every(rect =>
                rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 &&
                rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1);
            });
          }), label + ': visible text fits inside its card');
        }
        const layout = await panel.evaluate(node => {
          const bounds = node.getBoundingClientRect();
          const benefits = node.previousElementSibling?.getBoundingClientRect();
          return {
            withinViewport: bounds.left >= -1 && bounds.right <= innerWidth + 1,
            withinPanel: node.scrollWidth <= node.clientWidth + 1,
            noPageOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
            nextToBenefits: Boolean(benefits && Math.abs(benefits.top - bounds.top) < 2 && benefits.right <= bounds.left + 1),
            background: getComputedStyle(node).backgroundColor,
            foreground: getComputedStyle(node).color,
          };
        });
        assert.ok(layout.withinViewport && layout.withinPanel && layout.noPageOverflow, 'Coverage panel clips or overflows horizontally');
        assert.equal(layout.nextToBenefits, split, 'Exercise both stacked and split panel layouts');

        await page.addScriptTag({ content: axeSource });
        const accessibility = await panel.evaluate(async node => {
          const result = await window.axe.run(node, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
          return { violations: result.violations.map(rule => rule.id), incomplete: result.incomplete.map(rule => rule.id) };
        });
        assert.deepEqual(accessibility.violations, [], 'Coverage panel accessibility violations');
        assert.deepEqual(pageErrors, []);
        for (const path of ['/auth/session', ...requiredReads]) {
          assert.ok(counts[path] > before[path], 'Real Next did not read the loopback fixture for ' + path);
        }
        assert.equal(rejectedFixtureRequests, 0, 'Unexpected synthetic upstream request');
        await panel.screenshot({ path: join(output, 'coverage-' + width + '-' + theme + '.png'), timeout: 8_000 });
        report.views.push({ width, height, theme, layout, accessibility });
      } finally {
        await context.close();
      }
    }
    const [light, dark] = report.views.filter(view => view.width === width);
    assert.notEqual(light.layout.background, dark.layout.background, 'Rendered coverage background must follow the active theme');
    assert.notEqual(light.layout.foreground, dark.layout.foreground, 'Rendered coverage text must follow the active theme');
  }
  checksCompleted = true;
} finally {
  let browserClosed = !browser;
  try {
    if (browser) await browser.close();
    browserClosed = true;
  } finally {
    let cleanupPhase = 'stop-next';
    try {
      if (next) {
        assert.ok(next.pid && next.exitCode === null && next.signalCode === null && next.kill('SIGTERM'), 'Owned Next did not reach graceful shutdown');
        const closed = await Promise.race([nextClosed, delay(6_000, null, { ref: false })]);
        assert.ok(closed?.code === 0 && closed.signal === null, 'Owned Next graceful close was not confirmed; no type files restored');
        report.nextGracefulClose = true;
        cleanupPhase = 'restore-generated-types';
        report.restoredTypeFiles = await restoreTypeFiles();
      }
      cleanupPhase = 'verify-production-build';
      assert.equal(await realpath(productionDist), productionDist, 'Earlier Next build path changed');
      for (const saved of productionMarkers) {
        const current = await snapshotFile(saved.directory, saved.name);
        assert.ok(current.mode === saved.mode && current.bytes.equals(saved.bytes), 'Earlier Next build marker changed: ' + saved.name);
      }
      report.productionMarkersPreserved = true;
      if (!browserClosed) phase = 'browser-close';
      else if (checksCompleted) phase = 'layout-and-cleanup-passed';
    } catch (error) {
      phase = cleanupPhase;
      throw error;
    } finally {
      upstream.closeAllConnections();
      if (upstream.listening) await new Promise(done => upstream.close(done));
      const result = { ...report, phase, reads: counts, rejectedFixtureRequests };
      await writeFile(join(output, 'report.json'), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result));
    }
  }
}
