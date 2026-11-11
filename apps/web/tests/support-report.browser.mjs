import assert from 'node:assert/strict';

export async function checkReportNavigation({ page, base, api, state, report }) {
  const form = page.getByTestId('report-problem-form');
  const summary = form.getByTestId('report-problem-summary');
  const description = form.locator('#report-description');
  const reportCalls = async () => (await state()).calls.filter(call => call.path === '/public/cta/report-problem').length;
  const countBefore = await reportCalls();
  const originalViewport = page.viewportSize();
  const scenarios = [
    { trace: 'report-opened', width: 320, theme: 'dark', entry: page.getByTestId('sun-summary-primary') },
    { trace: 'agro', width: 390, theme: 'light', entry: page.getByRole('link', { name: 'Reportar un problema', exact: true }) },
  ];
  try {
    for (const { trace, width, theme, entry } of scenarios) {
      await page.setViewportSize({ width, height: 844 });
      const issued = await (await fetch(api + '/qa-issue')).json();
      const search = new URLSearchParams({ snapshot: issued.eventId, trace, access: 'qa-only', fresh: issued.token });
      await page.goto(base + '/sun?' + search, { waitUntil: 'load', timeout: 90_000 });
      await page.locator('[data-testid="report-problem-form"][data-report-ready="true"]').waitFor();
      await page.waitForFunction(() => !new URLSearchParams(location.search).has('fresh'));
      await page.evaluate(theme => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.classList.toggle('theme-light', theme === 'light');
        document.documentElement.classList.toggle('theme-dark', theme === 'dark');
      }, theme);
      assert.equal(await entry.getAttribute('href'), '#report-problem');
      assert.equal(await description.isVisible(), false, 'Report starts closed on an ordinary passport visit');
      const originalUrl = page.url();
      const historyLength = await page.evaluate(() => history.length);
      const modifiedClickPreserved = await entry.evaluate(anchor => {
        let handledNatively = false;
        anchor.addEventListener('click', event => {
          handledNatively = !event.defaultPrevented;
          event.preventDefault();
        }, { once: true });
        anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
        return handledNatively;
      });
      assert.ok(modifiedClickPreserved, 'The report leaves the modified anchor click to the browser');
      assert.equal(await description.isVisible(), false);
      assert.equal(page.url(), originalUrl);

      await entry.focus();
      await page.keyboard.press('Enter');
      await page.waitForURL(originalUrl + '#report-problem');
      await description.waitFor({ state: 'visible' });
      assert.equal(await summary.evaluate(element => element === document.activeElement), true, 'First activation focuses the report summary');
      assert.equal(await page.evaluate(() => history.length), historyLength + 1);

      await page.keyboard.press('Enter');
      await description.waitFor({ state: 'hidden' });
      assert.equal(page.url(), originalUrl + '#report-problem');
      await entry.click();
      await description.waitFor({ state: 'visible' });
      assert.equal(await summary.evaluate(element => element === document.activeElement), true, 'Repeat activation focuses the report summary');
      assert.equal(page.url(), originalUrl + '#report-problem');
      assert.equal(await page.evaluate(() => history.length), historyLength + 1, 'Reopening does not add a duplicate history entry');
      if (trace === 'report-opened') {
        await page.keyboard.press('Enter');
        await description.waitFor({ state: 'hidden' });
        const tools = page.locator('[data-sun-deferred-tool="protected-actions"]');
        await tools.scrollIntoViewIfNeeded();
        await tools.getByRole('button', { name: 'Describir el problema', exact: true }).click();
        await description.waitFor({ state: 'visible' });
        assert.equal(await summary.evaluate(element => element === document.activeElement), true, 'The post-sale report button reopens with focus');
        assert.equal(page.url(), originalUrl + '#report-problem');
        assert.equal(await page.evaluate(() => history.length), historyLength + 1);
      }
      assert.equal(await reportCalls(), countBefore, 'Report navigation never submits a report');
      report.checks.push(`${trace}: keyboard and pointer reopen the report with focus, one fragment entry and no write`);
    }
  } finally {
    if (originalViewport) await page.setViewportSize(originalViewport);
  }
}

// Actual Next/BFF interaction; the upstream deliberately models synthetic
// tickets. PostgreSQL atomicity is separately exercised by the API CI suite.
export async function checkSupportReports({ page, base, api, state, mode, assess, report }) {
  const calls = async () => (await state()).calls.filter(x => x.path === '/public/cta/report-problem');
  const form = page.getByTestId('report-problem-form');
  const description = 'La etiqueta indica abierto y necesito que revisen este envase QA.';
  const contact = 'support-qa@example.invalid';
  let visitNumber = 0;
  async function visit(trace = 'qa-only', lang = 'es-AR') {
    await page.goto(base + '/sun?snapshot=900001&trace=' + trace + '&access=qa-only&lang=' + lang + '&qa_case=' + (++visitNumber) + '#report-problem', { waitUntil: 'load', timeout: 90000 });
    await page.locator('[data-testid="report-problem-form"][data-report-ready="true"]').waitFor();
  }
  async function review() {
    await form.locator('#report-description').fill(description);
    await form.locator('#report-contact').fill(contact);
    await form.getByRole('button', { name: 'Revisar reporte', exact: true }).click();
    await page.locator('[data-testid="report-problem-form"][data-report-step="review"]').waitFor();
  }
  await mode('normal');
  await checkReportNavigation({ page, base, api, state, report });
  const initial = (await calls()).length;
  await visit();
  assert.equal((await calls()).length, initial, 'Opening a report never submits it');
  await review();
  assert.match(await form.innerText(), /QA-ONLY/);
  assert.ok((await form.innerText()).includes(description));
  assert.equal((await calls()).length, initial, 'Review remains read-only');
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
    await assess(page, '#report-problem', 'support-review', width, theme);
  }
  let sentToken = '';
  const capture = request => {
    if (new URL(request.url()).pathname === '/api/public-cta/report-problem' && request.method() === 'POST') sentToken = request.postDataJSON().support_token || '';
  };
  page.on('request', capture);
  await form.getByRole('button', { name: 'Confirmar reporte', exact: true }).evaluate(button => { button.click(); button.click(); });
  await form.getByTestId('report-problem-receipt').waitFor();
  const completed = await calls();
  assert.equal(completed.length, initial + 1, 'Double click produces one submitted report');
  assert.ok(sentToken);
  assert.ok(!page.url().includes(sentToken));
  assert.ok(!(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).includes(sentToken));
  assert.match(await form.getByTestId('report-problem-receipt').innerText(), /[a-f0-9]{8}-[a-f0-9-]{27}/i);
  assert.equal(completed.at(-1).hasSupport, true);
  assert.equal(completed.at(-1).hasShare, false);
  assert.equal(completed.at(-1).forwardedSession, false);
  assert.equal(completed.at(-1).keys.includes('uid'), false);
  page.off('request', capture);
  report.checks.push('Support requires review and explicit confirmation; double-click sends once, with a real response reference and no capability in URL/storage or unrelated credentials upstream');

  await mode('report-lost-response'); await visit(); await review();
  await form.getByRole('button', { name: 'Confirmar reporte', exact: true }).click();
  await form.getByRole('button', { name: 'Reintentar el mismo reporte', exact: true }).waitFor();
  assert.ok((await form.innerText()).includes(description));
  const failedAttempt = (await calls()).at(-1);
  await form.getByRole('button', { name: 'Reintentar el mismo reporte', exact: true }).click();
  await form.getByTestId('report-problem-receipt').waitFor();
  assert.equal((await calls()).at(-1).requestId, failedAttempt.requestId);
  report.checks.push('A lost acknowledgement preserves the reviewed report and retries with the same operation identity');

  for (const testMode of ['report-invalid', 'report-expired', 'report-conflict']) {
    await mode(testMode); await visit(); await review();
    await form.getByRole('button', { name: 'Confirmar reporte', exact: true }).click();
    await form.getByRole('alert').waitFor();
    assert.equal(await form.getByTestId('report-problem-receipt').count(), 0);
    assert.ok((await form.innerText()).includes(description));
  }
  report.checks.push('Missing ticket data, expired authorization and conflicting retry identity keep the report unconfirmed and preserve its content');
  await mode('normal');
  await visit('agro');
  const beforeAgro = (await calls()).length;
  await page.getByRole('link', { name: 'Reportar un problema', exact: true }).click();
  assert.equal((await calls()).length, beforeAgro);
  assert.ok(!page.url().includes('contact=sales'));
  await form.locator('#report-description').waitFor();
  await visit('no-support');
  assert.equal(await form.locator('textarea').count(), 0);
  await page.goto(base + '/sun#report-problem', { waitUntil: 'load' });
  assert.equal(await form.locator('textarea').count(), 0);
  assert.equal((await calls()).length, beforeAgro);
  report.checks.push('Agro opens the same report form; demo and missing authorization disclose unavailability without manufacturing a report');
  for (const lang of ['en', 'pt-BR']) {
    await visit('qa-only', lang);
    assert.equal(await form.locator('#report-description').count(), 1);
    assert.doesNotMatch(await form.innerText(), /Revisar reporte/);
    await assess(page, '#report-problem', 'support-' + lang, 390, 'light');
  }
  const beforeRejected = (await calls()).length;
  const rejected = await page.request.post(base + '/api/public-cta/report-problem', { headers: { origin: base, 'sec-fetch-site': 'same-origin' }, data: { bid: 'QA-ONLY', event_id: '900001' } });
  assert.equal(rejected.status(), 403);
  const crossOrigin = await page.request.post(base + '/api/public-cta/report-problem', { headers: { origin: 'https://untrusted.example.invalid', 'sec-fetch-site': 'cross-site' }, data: { bid: 'QA-ONLY', event_id: '900001', support_token: 'forged' } });
  assert.equal(crossOrigin.status(), 403);
  assert.equal((await calls()).length, beforeRejected);
  report.checks.push('Localized support remains accessible; the real BFF rejects missing capability and cross-origin writes before contacting the API');
}
