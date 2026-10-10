// Actual Next portal component with explicit, intercepted loopback decisions.
// These advisory receipts never certify a physical NFC read, tenant data,
// authentication acceptance, persistence or digital ownership.
import assert from 'node:assert/strict';

export function tapEligibilityFixture(eventId, overrides = {}) {
  return {
    ok: true, schema: 'nexid.consumer-tap-eligibility/v1', eventId,
    actions: {
      save: { allowed: true, reason: 'allowed', freshTapRequired: false },
      join: { allowed: true, reason: 'allowed', freshTapRequired: false },
      rewards: { allowed: true, reason: 'allowed', freshTapRequired: false },
      claim: { allowed: true, reason: 'allowed', freshTapRequired: false, nextStep: 'enter_pin' },
      ...overrides,
    },
  };
}

export function assertTapEligibilityRequest(request, base, { eventId, tenant, bid }) {
  const url = new URL(request.url()), headers = request.headers();
  assert.equal(url.origin, base);
  assert.equal(request.method(), 'GET');
  assert.equal(url.pathname, '/api/consumer/tap-eligibility');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['bid', 'eventId', 'tenant']);
  assert.equal(url.searchParams.get('eventId'), eventId);
  assert.equal(url.searchParams.get('tenant'), tenant);
  assert.equal(url.searchParams.get('bid'), bid);
  assert.equal(headers['x-nexid-consumer-tap-eligibility'], '1');
  assert.equal(headers.authorization, undefined);
  assert.equal(headers['x-nexid-fresh-tap'], undefined);
  assert.equal(headers['x-nexid-tap-capability'], undefined);
  assert.equal(headers['x-nexid-consumer-tap-capability'], undefined);
  assert.equal(request.postData(), null);
}

const deny = (reason = 'tap_action_not_allowed') => ({ allowed: false, reason, freshTapRequired: reason === 'fresh_tap_required' });
const claimDeny = reason => ({ ...deny(reason), nextStep: 'blocked' });
const allDenied = reason => ({ save: deny(reason), join: deny(reason), rewards: deny(reason), claim: claimDeny(reason) });
const allowedClaim = nextStep => ({ allowed: true, reason: 'allowed', freshTapRequired: false, nextStep });
const query = (eventId = '900001', action = 'save') => `/me/products?fromTap=1&eventId=${eventId}&tenant=consumer-qa&bid=LOT-WINE-QA&action=${action}`;
const ready = (page, state = 'ready') => page.waitForFunction(expected => document.querySelector('[data-testid="tap-association-eligibility"]')?.getAttribute('data-state') === expected, state);
const tick = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

export async function runTapEligibilityScenarios({ page, base, width, theme, report, check, assessment, noOverflow }) {
  if (![320, 390].includes(width)) return;
  const endpoint = '**/api/consumer/tap-eligibility?*';
  let current = null;
  const handler = async route => {
    const request = route.request(), url = new URL(request.url());
    const eventId = url.searchParams.get('eventId');
    assertTapEligibilityRequest(request, base, { eventId, tenant: 'consumer-qa', bid: 'LOT-WINE-QA' });
    const scenario = current;
    assert.ok(scenario && ['900001', '900002'].includes(eventId), 'only explicit synthetic reading contexts are accepted');
    scenario.reads.push({ eventId, method: request.method() });
    const index = scenario.reads.length;
    scenario.started?.();
    if ((scenario.kind === 'loading' || scenario.kind === 'timeout' || scenario.kind === 'stale') && eventId === '900001' && index === 1) await scenario.held;
    if (scenario.kind === 'withdrawn' && index === 2) await scenario.held;
    let status = 200, payload = tapEligibilityFixture(eventId);
    if (scenario.kind === 'fresh') payload = tapEligibilityFixture(eventId, allDenied('fresh_tap_required'));
    if (scenario.kind === 'fresh-boundary') { status = 403; payload = { ok: false, error: 'fresh_tap_required', freshTapRequired: true }; }
    if (scenario.kind === 'partial') payload = tapEligibilityFixture(eventId, { save: deny(), claim: claimDeny('ownership_manual_approval_required'), rewards: deny('program_unavailable') });
    if (scenario.kind === 'unavailable' && index === 1) { status = 503; payload = { ok: false, error: 'eligibility_unavailable' }; }
    if (scenario.kind === 'withdrawn' && index >= 2) payload = tapEligibilityFixture(eventId, { claim: claimDeny('tap_action_not_allowed') });
    if (scenario.kind === 'stale' && eventId === '900002') payload = tapEligibilityFixture(eventId, allDenied('event_security_blocked'));
    if (scenario.kind === 'confirm') payload = tapEligibilityFixture(eventId, { claim: allowedClaim('confirm') });
    if (scenario.kind === 'malformed') payload = tapEligibilityFixture(eventId, { claim: { ...claimDeny('tap_action_not_allowed'), nextStep: 'enter_pin' } });
    if (scenario.kind === 'timeout') { status = 503; payload = { ok: false, error: 'eligibility_unavailable' }; }
    try {
      await route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(payload) });
    } catch (error) {
      // These two reads are deliberately aborted by the component before the
      // held transport is released. Retain that observation, not its URL/body.
      if (['stale', 'timeout'].includes(scenario.kind)) scenario.cancelledTransport = true;
      else throw error;
    }
  };
  await page.route(endpoint, handler);
  const disabledChoices = panel => panel.locator('input[type="radio"]').evaluateAll(inputs => inputs.length === 4 && inputs.every(input => input.disabled));
  const expand = async panel => {
    const alternatives = panel.locator('details').filter({ has: page.getByTestId('tap-association-option-claim') });
    if (!await alternatives.evaluate(node => node.open)) await alternatives.locator('summary').click();
  };
  const capture = async (panel, locale, kind) => {
    const label = `${width}/${theme}/${locale}/${kind}`;
    await noOverflow(page, `${label}: options and feedback fit the viewport`);
    await assessment(page, '[data-testid="tap-association"]', `tap-eligibility-${kind}-${locale}`, width, theme);
    const status = panel.getByTestId('tap-association-eligibility');
    check(await panel.locator('label').evaluateAll(labels => labels.filter(label => label.querySelector('input[type="radio"]')).every(label => label.getBoundingClientRect().height >= 44)),
      `${label}: each action has a 44px label target even while unavailable`);
    check(await status.getAttribute('aria-live') === 'polite' && await status.getAttribute('aria-atomic') === 'true', `${label}: options feedback is announced without an intrusive alert`);
    report.tapEligibility ??= [];
    report.tapEligibility.push({ width, theme, locale, scenario: kind, actualNextComponent: true, syntheticAdvisory: true,
      state: await status.getAttribute('data-state'), reads: current.reads, submittedBusinessRequests: 0,
      ownershipCertified: false, cancelledTransport: current.cancelledTransport === true });
  };
  try {
    for (const locale of ['es-AR', 'en', 'pt-BR']) {
      for (const kind of ['loading', 'fresh', 'fresh-boundary', 'partial', 'unavailable', 'withdrawn', 'stale', 'confirm', 'malformed', ...(locale === 'es-AR' ? ['timeout'] : [])]) {
        let release, started;
        const held = new Promise(done => { release = done; });
        const readStarted = new Promise(done => { started = done; });
        current = { kind, reads: [], held, started, cancelledTransport: false };
        const label = `${width}/${theme}/${locale}/${kind}`;
        const requiresClaim = ['withdrawn', 'confirm', 'malformed'].includes(kind);
        const beforeWrites = report.blockedWrites.length;
        try {
          await page.goto(base + query('900001', requiresClaim ? 'claim' : 'save'), { waitUntil: 'domcontentloaded' });
          const panel = page.getByTestId('tap-association');
          await panel.waitFor();
          await page.evaluate(value => { document.documentElement.lang = value; }, locale);
          await page.waitForFunction(value => document.querySelector('[data-testid="tap-association"]')?.getAttribute('lang') === value, locale);
          await readStarted;
          const confirm = panel.getByTestId('tap-association-confirm');
          await confirm.waitFor();
          await expand(panel);
          if (kind === 'loading') {
            await ready(page, 'checking');
            check(await disabledChoices(panel) && await confirm.isDisabled() && await panel.getByTestId('tap-association-claim-pin').count() === 0,
              `${label}: pending advisory grants no selectable action, PIN input or confirmation`);
            await confirm.evaluate(node => node.click());
            await capture(panel, locale, kind);
            release(); await ready(page);
            check(current.reads.length === 1 && await confirm.isEnabled(), `${label}: one explicit advisory receipt enables the configured action`);
          } else if (kind === 'fresh') {
            await ready(page);
            check(await disabledChoices(panel) && await confirm.isDisabled(), `${label}: an expired or spent reading cannot expose an actionable choice`);
            check(await panel.locator('#tap-association-reason-save').innerText() !== '', `${label}: unavailable action has localized new-reading guidance`);
            await confirm.evaluate(node => node.click());
            await capture(panel, locale, kind);
          } else if (kind === 'fresh-boundary') {
            await ready(page, 'fresh_required');
            check(await disabledChoices(panel) && await confirm.isDisabled() && await panel.getByTestId('tap-association-eligibility-refresh').count() === 0,
              `${label}: missing capability requires a new physical reading instead of a renewal button`);
            await confirm.evaluate(node => node.click()); await tick(page);
            check(current.reads.length === 1, `${label}: expired capability has no automatic renewal or retry`);
            await capture(panel, locale, kind);
          } else if (kind === 'partial') {
            await ready(page);
            check(await panel.getByTestId('tap-association-option-save').isDisabled() && await panel.getByTestId('tap-association-option-claim').isDisabled()
              && await panel.getByTestId('tap-association-option-rewards').isDisabled() && await panel.getByTestId('tap-association-option-join').isEnabled(),
              `${label}: decisions stay specific to each action rather than granting the whole menu`);
            check(await confirm.isDisabled(), `${label}: a selected denied action stays blocked`);
            const join = panel.getByTestId('tap-association-option-join'), target = join.locator('..');
            await target.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' })); await tick(page);
            check(await target.evaluate(node => { const rect = node.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return Boolean(hit && (hit === node || node.contains(hit))) && rect.height >= 44; }),
              `${label}: the allowed action's pointer target is unobstructed by the mobile dock`);
            await target.click();
            check(await confirm.isEnabled() && await join.isChecked(), `${label}: the user can deliberately choose the allowed action`);
            await capture(panel, locale, kind);
          } else if (kind === 'unavailable') {
            await ready(page, 'unavailable');
            check(await disabledChoices(panel) && await confirm.isDisabled() && current.reads.length === 1, `${label}: unavailable GET blocks actions and does not poll`);
            await capture(panel, locale, kind);
            const retry = panel.getByTestId('tap-association-eligibility-refresh');
            check(await retry.evaluate(node => node.getBoundingClientRect().height >= 44), `${label}: explicit refresh is a 44px touch target`);
            await retry.click(); await ready(page);
            check(current.reads.length === 2 && await confirm.isEnabled(), `${label}: an explicit refresh makes one read and sends no POST`);
          } else if (kind === 'withdrawn') {
            await ready(page);
            const pin = panel.getByTestId('tap-association-claim-pin'); await pin.waitFor(); await pin.fill('Synthetic-Withdrawn-Code!2026');
            check(await confirm.isEnabled(), `${label}: configured PIN attempt can be prepared before a policy update`);
            await panel.getByTestId('tap-association-eligibility-refresh').click(); await ready(page, 'checking');
            check(await pin.count() === 0 && await confirm.isDisabled(), `${label}: refresh immediately withdraws action and transient PIN while pending`);
            release(); await ready(page);
            check(await pin.count() === 0 && await confirm.isDisabled() && await panel.getByTestId('tap-association-option-claim').isDisabled(),
              `${label}: a withdrawn brand policy cannot reuse the prepared PIN or keep claim actionable`);
            check(await panel.getByTestId('tap-association-option-claim').isChecked(), `${label}: policy updates do not choose another action on the customer's behalf`);
            check(!(await page.content()).includes('Synthetic-Withdrawn-Code!2026'), `${label}: withdrawn PIN is absent from rendered DOM`);
            await capture(panel, locale, kind);
          } else if (kind === 'stale') {
            await ready(page, 'checking');
            await page.evaluate(path => window.history.pushState(null, '', path), query('900002'));
            await ready(page);
            check(await disabledChoices(panel) && await confirm.isDisabled(), `${label}: the replacement reading has its own denied decisions`);
            release(); await page.waitForLoadState('networkidle'); await tick(page);
            check(await disabledChoices(panel) && await confirm.isDisabled() && current.reads.length === 2, `${label}: late allowed reply for the old reading cannot enable the replacement context`);
            await panel.locator('details').last().locator('summary').click();
            check((await panel.locator('details').last().innerText()).includes('900002'), `${label}: visible reading details belong to the current context`);
            await capture(panel, locale, kind);
          } else if (kind === 'confirm') {
            await ready(page);
            check(await panel.getByTestId('tap-association-option-claim').isEnabled() && await confirm.isEnabled()
              && await panel.getByTestId('tap-association-claim-pin').count() === 0, `${label}: the current policy permits a claim attempt without inventing a PIN requirement`);
            check(await panel.getByTestId('tap-association-result-claim').count() === 0, `${label}: an allowed advisory decision never reports confirmed ownership`);
            await capture(panel, locale, kind);
          } else if (kind === 'malformed') {
            await ready(page, 'unavailable');
            check(await disabledChoices(panel) && await confirm.isDisabled() && await panel.getByTestId('tap-association-claim-pin').count() === 0,
              `${label}: denied claim combined with an enabling next step fails closed`);
            await capture(panel, locale, kind);
          } else if (kind === 'timeout') {
            await ready(page, 'unavailable');
            check(await disabledChoices(panel) && await confirm.isDisabled() && current.reads.length === 1, `${label}: a stalled GET has bounded feedback without automatic retry`);
            release(); await tick(page);
            check(await confirm.isDisabled(), `${label}: late transport completion cannot undo the timeout feedback`);
            await capture(panel, locale, kind);
          }
          check(report.blockedWrites.length === beforeWrites, `${label}: inspecting, refreshing and choosing advisory options submits no business write`);
        } finally { release(); }
      }
    }
  } finally { await page.unroute(endpoint, handler); }
}
