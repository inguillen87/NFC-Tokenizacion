import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [page, sectionNav, css] = await Promise.all([
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-section-nav.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);

function firstViewportSummary() {
  const start = page.indexOf('id="sun-summary"');
  const end = page.indexOf('id="product-info"', start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return page.slice(start, end);
}

test("SUN first viewport presents product, result, facts, location and actions in that order", () => {
  const summary = firstViewportSummary();
  const orderedTestIds = [
    "sun-summary-product",
    "sun-summary-status",
    "sun-summary-facts",
    "sun-summary-location",
    "sun-summary-actions",
  ];

  let cursor = -1;
  for (const testId of orderedTestIds) {
    const next = summary.indexOf(`data-testid="${testId}"`);
    assert.ok(next > cursor, `${testId} should follow the preceding first-viewport block`);
    cursor = next;
  }

  assert.match(summary, /<h1[^>]*>[\s\S]*?\{productDisplayName\}[\s\S]*?<\/h1>/);
  assert.match(summary, /src=\{productHeroImageUrl\}[\s\S]*?alt=\{productDisplayName\}/);
  assert.match(summary, /\{tenantDisplayName\}/);
  assert.match(summary, /\{SUN_DEMO_BADGE\}/);
});

test("SUN first viewport keeps the result compact and preserves every risk state", () => {
  const summary = firstViewportSummary();

  assert.match(summary, /<PackageCheck[^>]*h-5 w-5/);
  assert.match(summary, /<PackageOpen[^>]*h-5 w-5/);
  assert.match(summary, /<ShieldCheck[^>]*h-5 w-5/);
  assert.match(summary, /<ShieldAlert[^>]*h-5 w-5/);
  assert.match(summary, /consumerStatus\.tone === "closed"/);
  assert.match(summary, /consumerStatus\.tone === "opened"/);
  assert.match(summary, /consumerStatus\.tone === "risk"/);
  assert.match(summary, /\{consumerStatus\.label\}/);
  assert.match(summary, /\{consumerStatus\.headline\}/);
  assert.match(summary, /\{consumerStatus\.copy\}/);
  assert.doesNotMatch(summary, /ALERTA DE SEGURIDAD|\{rightsTitle\}/);
  assert.doesNotMatch(summary, /w-20 h-20|text-3xl|border-4/);
});

test("SUN location wraps and the two first actions are touch-safe", () => {
  const summary = firstViewportSummary();
  const locationStart = summary.indexOf('data-testid="sun-summary-location"');
  const actionsStart = summary.indexOf('data-testid="sun-summary-actions"');
  const location = summary.slice(locationStart, actionsStart);
  const actions = summary.slice(actionsStart);

  assert.match(location, /whitespace-normal break-words/);
  assert.doesNotMatch(location, /truncate/);
  assert.match(location, /Fuente \/ precisión:/);
  assert.match(location, /Hora del tap:/);
  assert.match(location, /summaryLocationFriendlyCopy/);
  assert.match(location, /<SunLocationRequestButton/);
  assert.match(location, /Compartir ubicación aproximada del teléfono/);
  assert.match(location, />Opcional · con permiso</);
  assert.match(location, /Ver fuente y horario/);

  assert.match(actions, /href="#product-info"[\s\S]*?Ver producto/);
  assert.match(actions, /!isDemoPreview && isVerifiedOpenedState && isTechnicallyAuthentic[\s\S]*?\? "#sun-condition"/);
  assert.match(actions, /"Entender apertura"[\s\S]*?"Ver origen y mapa"/);
  assert.equal((actions.match(/min-h-11/g) || []).length, 2);
});

test("SUN identity and state never wait for location permission and clear the bottom navigation", () => {
  const summary = firstViewportSummary();
  const identity = summary.indexOf('data-testid="sun-summary-product"');
  const status = summary.indexOf('data-testid="sun-summary-status"');
  const location = summary.indexOf('data-testid="sun-summary-location"');

  assert.ok(identity < status && status < location);
  assert.doesNotMatch(summary, /<TapPrecisionTelemetry/);
  assert.match(page, /pb-\[calc\(env\(safe-area-inset-bottom\)\+8\.5rem\)\]/);
  assert.match(sectionNav, /bottom-\[calc\(env\(safe-area-inset-bottom\)\+0\.5rem\)\]/);
  assert.match(sectionNav, /const isMobileDockVisible = showMobileNav && !isScrollingDown && !isDockAvoided/);
  assert.match(sectionNav, /aria-hidden=\{!isMobileDockVisible\}/);
});

test("SUN stacks product media and copy only in narrow containers", () => {
  const summary = firstViewportSummary();

  assert.match(page, /sun-tap-shell/);
  assert.match(summary, /sun-summary-product grid grid-cols-\[92px_minmax\(0,1fr\)\]/);
  assert.match(summary, /sun-summary-product__visual/);
  assert.match(summary, /sun-summary-product__copy/);
  assert.match(summary, /sun-summary-product__title/);
  assert.match(css, /@container \(max-width: 320px\)[\s\S]*?\.sun-summary-product \{[\s\S]*?grid-template-columns:\s*76px minmax\(0, 1fr\) !important;/);
  assert.match(css, /@container \(max-width: 220px\)[\s\S]*?\.sun-summary-product \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
  assert.match(css, /@container \(max-width: 220px\)[\s\S]*?\.sun-summary-actions \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
});

test("SUN light mode moves dark passport surfaces and status accents to an accessible light palette", () => {
  const summary = firstViewportSummary();

  assert.match(page, /<main className="sun-tap-experience /);
  assert.match(summary, /sun-summary-panel/);
  assert.match(css, /html\.theme-light \.sun-tap-experience,[\s\S]*?linear-gradient\(180deg, #f8fcff/);
  assert.match(css, /html\.theme-light \.sun-tap-experience \.sun-summary-panel,[\s\S]*?rgba\(255, 255, 255, 0\.98\)/);
  assert.match(css, /html\.theme-light \.sun-tap-experience \[class\*="text-amber-"\],[\s\S]*?color: #92400e !important;/);
  assert.match(css, /html\.theme-light \.sun-tap-experience \.sun-summary-actions a:first-child,[\s\S]*?color: #ffffff !important;/);
});
