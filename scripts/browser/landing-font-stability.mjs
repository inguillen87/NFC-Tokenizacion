import assert from 'node:assert/strict';

async function heroPositions(page) {
  return page.locator('section[aria-labelledby="home-title"]').evaluate(hero => {
    const actions = hero.querySelector('[role="group"]');
    const elements = [
      hero.querySelector('h1'),
      hero.querySelector('p'),
      actions,
      ...actions.querySelectorAll('a'),
      hero.querySelector('img'),
    ];
    return elements.map(element => element.getBoundingClientRect().top);
  });
}

export async function checkDelayedLandingFonts(browser, origin, locale) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  let releaseFonts;
  const waiting = new Promise(resolve => { releaseFonts = resolve; });
  try {
    await context.addCookies([{ name: 'locale', value: locale, url: origin }]);
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin || request.method() !== 'GET' || url.pathname.startsWith('/api/')) {
        return route.abort();
      }
      if (request.resourceType() === 'font') {
        await waiting;
      }
      return route.continue();
    });
    const page = await context.newPage();
    const editorialFont = page.waitForRequest(request =>
      request.resourceType() === 'font' && new URL(request.url()).pathname.startsWith('/fonts/fraunces/'));
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    const fontPath = new URL((await editorialFont).url()).pathname;
    assert.ok(await page.locator('link[rel="preload"][as="font"]').evaluateAll(
      (links, path) => links.some(link => new URL(link.href).pathname === path), fontPath
    ), 'The landing should request its editorial font early');
    await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    const before = await heroPositions(page);
    releaseFonts();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const after = await heroPositions(page);
    assert.ok(after.every((top, index) => Math.abs(top - before[index]) <= 1),
      `Late fonts moved the ${locale} hero: ${before} → ${after}`);
    if (locale === 'es-AR') {
      const cachedFont = await context.request.head(origin + fontPath);
      assert.ok(cachedFont.ok(), 'The versioned editorial font is available');
      assert.match(cachedFont.headers()['cache-control'] || '', /\bimmutable\b/);
      await page.goto(origin + '/sun?demo=1', { waitUntil: 'networkidle' });
      const sunRequestedFont = await page.evaluate(path => performance.getEntriesByType('resource')
        .some(resource => new URL(resource.name).pathname === path), fontPath);
      assert.equal(sunRequestedFont, false, 'SUN should not request the landing headline font');
    }
    return { locale, viewport: 390, before, after };
  } finally {
    releaseFonts();
    await context.close();
  }
}
