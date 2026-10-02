import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { translateSunUiText } from "../src/app/sun/sun-locale.ts";

const [page, sectionNav, css, experienceCss] = await Promise.all([
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-section-nav.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-passport-experience.module.css", import.meta.url), "utf8"),
]);

function firstViewportSummary() {
  const start = page.indexOf('id="sun-summary"');
  const end = page.indexOf('id="product-info"', start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return page.slice(start, end);
}

test("SUN first viewport presents product, result and actions before optional reading evidence", () => {
  const summary = firstViewportSummary();
  const orderedTestIds = [
    "sun-summary-product",
    "sun-summary-status",
    "sun-summary-actions",
    "sun-summary-evidence",
    "sun-summary-facts",
    "sun-summary-location-disclosure",
    "sun-summary-location",
  ];

  let cursor = -1;
  for (const testId of orderedTestIds) {
    const next = summary.indexOf(testId === "sun-summary-facts" ? "<PassportEssentialSignals" : `data-testid="${testId}"`);
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
  assert.match(summary, /tone=\{consumerStatus\.tone\}/);
  assert.match(summary, /\{consumerStatus\.label\}/);
  assert.match(summary, /\{consumerStatus\.headline\}/);
  assert.match(summary, /\{consumerStatus\.copy\}/);
  assert.doesNotMatch(summary, /ALERTA DE SEGURIDAD|\{rightsTitle\}/);
  assert.doesNotMatch(summary, /w-20 h-20|text-3xl|border-4/);
});

test("SUN optional location preserves its source while the contextual actions remain touch-safe", () => {
  const summary = firstViewportSummary();
  const locationStart = summary.indexOf('data-testid="sun-summary-location"');
  const actionsStart = summary.indexOf('data-testid="sun-summary-actions"');
  const evidenceStart = summary.indexOf('data-testid="sun-summary-evidence"');
  const location = summary.slice(locationStart);
  const actions = summary.slice(actionsStart, evidenceStart);

  assert.match(location, /whitespace-normal break-words/);
  assert.doesNotMatch(location, /truncate/);
  assert.match(location, /Fuente \/ precisión:/);
  assert.match(location, /Hora del tap:/);
  assert.match(location, /summaryLocationFriendlyCopy/);
  assert.match(summary, /<SunLocationQuickAction/);
  assert.ok(summary.indexOf("<SunLocationQuickAction") < summary.indexOf('<PassportEssentialSignals'));
  assert.match(location, /href="#share-phone-location"/);
  assert.match(summary, /canRequestBrowserLocation && !hasConfirmedBrowserLocation/);
  assert.match(location, /Ver fuente y horario/);

  assert.match(actions, /href=\{primaryPostTapAction\.href\}[\s\S]*?data-testid="sun-summary-primary"[\s\S]*?\{primaryPostTapAction\.label\}/);
  assert.match(actions, /!isDemoPreview && isVerifiedOpenedState && isTechnicallyAuthentic[\s\S]*?\? "#sun-condition"/);
  assert.match(actions, /"Entender apertura"[\s\S]*?"Ver origen y mapa"/);
  assert.equal((actions.match(/min-h-11/g) || []).length, 2);
});

test("SUN native disclosures preserve evidence in the DOM without hiding the result or manual opening warning", () => {
  const summary = firstViewportSummary();
  const actions = summary.indexOf('data-testid="sun-summary-actions"');
  const visibleResult = summary.slice(summary.indexOf('data-testid="sun-summary-status"'), actions);
  assert.doesNotMatch(visibleResult, /<details\b/);
  assert.match(visibleResult, /\{consumerStatus\.copy\}/);
  assert.match(visibleResult, /isManualOpenedState \? <aside[^>]*data-testid="sun-summary-manual-opening"[\s\S]*?\{friendlyStageBody\}/);
  for (const testId of ["sun-summary-evidence", "sun-summary-location-disclosure"]) {
    const opening = summary.match(new RegExp(`<details[^>]*data-testid="${testId}"[^>]*>`));
    assert.ok(opening, `${testId} must be native details`);
    assert.doesNotMatch(opening[0], /\bopen(?:\s|=|>)/);
  }
  assert.match(summary, /data-testid="sun-summary-evidence"[\s\S]*?data-sun-server-evidence="true">\{batchDisplay\}[\s\S]*?<PassportEssentialSignals/);
  assert.match(summary, /data-testid="sun-summary-location-disclosure"[\s\S]*?data-sun-server-evidence="true"[^>]*>\s*\{summaryLocationDisplay\}/);
  assert.match(page, /<details[^>]*data-testid="sun-product-reading-details"[\s\S]*?<ol className="sun-result-journey"[\s\S]*?data-sun-datetime=\{localTapTimeIso/);
});

test("SUN disclosure labels and the non-fresh fallback localize without adding a freshness claim", () => {
  const messages = [
    ["Qué informa esta lectura", "O que esta leitura informa", "What this reading tells you"],
    ["Ubicación y horario", "Localização e horário", "Location and time"],
    ["Ficha y datos de esta lectura", "Ficha e dados desta leitura", "Product and reading details"],
    ["Podés conocer el producto. Las opciones de la marca requieren sus validaciones y son voluntarias.", "Você pode conhecer o produto. As opções da marca exigem suas validações e são voluntárias.", "You can learn about the product. The brand's options require their own checks and are optional."],
    ["Un operador registró una apertura", "Um operador registrou uma abertura", "An operator recorded an opening"],
    ["La apertura fue declarada por un operador. No fue detectada automáticamente por el sello; si no la reconocés o el envase está dañado, no uses el producto y avisá para revisión.", "A abertura foi declarada por um operador. Não foi detectada automaticamente pelo lacre; se você não a reconhecer ou a embalagem estiver danificada, não use o produto e avise para revisão.", "The opening was declared by an operator. It was not automatically detected by the seal; if you do not recognize it or the package is damaged, do not use the product and report it for review."],
  ];
  for (const [es, pt, en] of messages) {
    assert.equal(translateSunUiText(es, "pt-BR"), pt);
    assert.equal(translateSunUiText(es, "en"), en);
    assert.equal(translateSunUiText(en, "es-AR"), es);
    assert.equal(translateSunUiText(pt, "es-AR"), es);
  }
  assert.doesNotMatch(page, /: "La lectura es fresca\. Primero lees la ficha/);
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

test("SUN summary uses its existing state for every visual tone and labels the product region", () => {
  const summary = firstViewportSummary();
  assert.match(summary, /aria-labelledby="sun-summary-product-title"/);
  assert.match(summary, /<h1 id="sun-summary-product-title"/);
  assert.match(summary, /data-status-tone=\{consumerStatus\.tone\}/);
  for (const tone of ["closed", "opened", "review", "verified", "info", "risk"]) {
    assert.ok(experienceCss.includes(`[data-status-tone="${tone}"]`), `${tone} must have a presentation`);
  }
});

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const linear = hex.slice(1).match(/../g).map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("SUN scoped status palettes provide at least 4.5:1 text contrast in both themes", () => {
  const themeBlocks = [
    experienceCss.match(/^\.passport\s*\{([^}]+)\}/)?.[1],
    experienceCss.match(/:global\(html:is\(\.theme-light, \[data-theme="light"\]\)\) \.passport\s*\{([^}]+)\}/)?.[1],
  ];
  for (const [index, block] of themeBlocks.entries()) {
    assert.ok(block, `theme ${index} must declare a palette`);
    const palette = Object.fromEntries([...block.matchAll(/--passport-([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((match) => [match[1], match[2]]));
    for (const tone of ["closed", "attention", "info", "risk"]) {
      assert.ok(contrastRatio(palette[tone], palette[`${tone}-bg`]) >= 4.5, `${tone} accent in theme ${index}`);
      assert.ok(contrastRatio(palette.ink, palette[`${tone}-bg`]) >= 4.5, `${tone} body in theme ${index}`);
    }
  }
});

test("SUN summary motion is finite, reduced-motion safe and leaves touch controls usable", () => {
  assert.doesNotMatch(experienceCss, /animation[^;]*infinite/);
  assert.match(experienceCss, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(experienceCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important;[\s\S]*?transition: none !important;/);
  assert.match(experienceCss, /:global\(\.sun-summary-location-details\) summary\s*\{[^}]*min-height: 2\.75rem;/);
  assert.match(experienceCss, /:global\(\.sun-mobile-dock\) a\s*\{[^}]*min-height: 2\.75rem;/);
  assert.match(experienceCss, /:is\(a, button, select, summary\):focus-visible/);
});
