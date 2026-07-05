import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("demo lab theme toggle changes theme client-side before falling back to SSR", async () => {
  const source = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-hub-theme.tsx", import.meta.url), "utf8");

  assert.match(source, /function applyTheme\(theme: Theme\)/);
  assert.match(source, /localStorage\.setItem\("theme", theme\)/);
  assert.match(source, /onClick=\{onToggle\}/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /applyTheme\(next\)/);
});

test("demo lab mobile wizard shows four steps without horizontal scrolling", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-steps\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.doesNotMatch(css, /demo-lab-fullscreen-root \.demo-lab-wizard-steps\s*\{[^}]*display:\s*flex/s);
  assert.doesNotMatch(css, /demo-lab-fullscreen-root \.demo-lab-wizard-steps\s*\{[^}]*overflow-x:\s*auto/s);
  assert.doesNotMatch(css, /dueÃ|dueÃƒ|Ã±o/);
});

test("demo lab fullscreen mobile keeps CTAs inside viewport and light mode visible", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");

  assert.match(css, /Demo Lab enterprise closure/);
  assert.match(page, /const requestedTheme = firstParam\(params\.theme\) === "light"/);
  assert.match(page, /demo-lab-fullscreen-root--light/);
  assert.match(css, /html\.theme-light \.demo-lab-fullscreen-stage[\s\S]*#f8fbff/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-fullscreen-stage[\s\S]*#f8fbff/);
  assert.match(css, /html\.theme-light \.demo-lab-fullscreen-stage \.demo-lab-studio[\s\S]*rgba\(255,\s*255,\s*255,\s*0\.98\)/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-wizard-nav/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-mode-bar--compact/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-mode-tab\.is-active/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-wizard-brief__proof span[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.86\)/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-infobar__right\s*\{[\s\S]*grid-template-columns:\s*2\.65rem minmax\(0,\s*1fr\)/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-infobar__cta\s*\{[\s\S]*width:\s*100%/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-cta-full\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-cta-short\s*\{[\s\S]*display:\s*inline/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-nav\s*\{[\s\S]*width:\s*calc\(100% - 1\.24rem\)/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-scene\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-scene > \*\s*\{[\s\S]*max-width:\s*100%/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-verticals\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-vertical-btn\s*\{[\s\S]*min-width:\s*0/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-brief__copy strong\s*\{[\s\S]*font-size:\s*1\.05rem/);
  assert.match(css, /demo-lab-fullscreen-stage,\s*\n\s*\.demo-lab-fullscreen-stage \.demo-lab-studio\s*\{[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-actions\s*\{[\s\S]*grid-template-columns:\s*2\.45rem minmax\(0,\s*1fr\)/);
  assert.match(page, /demo-lab-cta-full/);
  assert.match(page, /demo-lab-cta-short/);
  assert.match(client, /demo-lab-cta-full/);
  assert.match(client, /demo-lab-cta-short/);
});

test("demo lab hub keeps C-level contrast across cards, filters and theme controls", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");

  assert.match(css, /Demo Lab hub C-level contrast closure/);
  assert.match(page, /demo-lab-hub-root--light/);
  assert.match(page, /demo-lab-hub-card__icon/);
  assert.match(page, /demo-lab-hub-pill__icon/);
  assert.match(page, /demo-lab-hub-card-grid/);
  assert.match(page, /demo-lab-hub-vertical-grid/);
  assert.match(page, /href="\/proof\/verify"/);
  assert.match(css, /\.demo-lab-hub-root--light\s*\{[\s\S]*color:\s*#0f172a !important/);
  assert.match(css, /\.demo-lab-hub-root \.demo-lab-hub-card__icon,[\s\S]*color:\s*#bae6fd !important/);
  assert.match(css, /\.demo-lab-hub-root--light \.demo-lab-hub-card__icon,[\s\S]*color:\s*#075985 !important/);
  assert.match(css, /\.demo-lab-hub-root \.demo-lab-hub-card h3,[\s\S]*color:\s*#f8fafc !important/);
  assert.match(css, /\.demo-lab-hub-root \.demo-lab-hub-card p,[\s\S]*color:\s*#dbeafe !important/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-root \.demo-lab-hub-card h3,[\s\S]*color:\s*#0f172a !important/);
  assert.match(css, /\.demo-lab-hub-root--light \.demo-lab-hub-card h3,[\s\S]*color:\s*#0f172a !important/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-root \.demo-lab-hub-card p,[\s\S]*color:\s*#334155 !important/);
  assert.match(css, /\.demo-lab-hub-root--light \.demo-lab-hub-card p,[\s\S]*color:\s*#334155 !important/);
  assert.match(css, /\.demo-lab-hub-root \.theme-toggle,[\s\S]*\.demo-lab-hub-nav a\[href="\/proof\/verify"\]/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-root \.theme-toggle,[\s\S]*color:\s*#075985 !important/);
  assert.match(css, /\.demo-lab-hub-root--light \.theme-toggle,[\s\S]*color:\s*#075985 !important/);
});

test("landing hero stats use real configured fields and no old cost placeholder", async () => {
  const hero = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
  const i18n = await readFile(new URL("../../../packages/config/src/i18n.ts", import.meta.url), "utf8");

  assert.match(hero, /const heroStats = \[/);
  assert.match(hero, /stats\?\.latencyDelta/);
  assert.doesNotMatch(hero, /stats\.scanSpeed|stats\.uptime|stats\.crypto|stats\.global/);
  assert.doesNotMatch(i18n, /10k (botellas|garrafas|bottles) × USD 0\.02/);
  assert.match(i18n, /Sin app para el comprador/);
  assert.match(i18n, /No buyer app required/);
});

test("brand synergy simulator is readable, auto-cycles and stays mobile-safe", async () => {
  const source = await readFile(new URL("../src/components/brand-synergy-simulator.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /Ã|Â|â|ð/);
  assert.match(source, /window\.setInterval\(\(\) => \{/);
  assert.match(source, /\},\s*4000\)/);
  assert.match(source, /setIsPaused\(true\)/);
  assert.match(source, /brand-synergy-proof-grid/);
  assert.match(source, /hash-only/);
  assert.match(source, /Consent and PII stay inside nexID/);
  assert.match(css, /brand-synergy-proof-grid > div/);
  assert.match(css, /brand-synergy-flow\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /brand-synergy-scenario-pill\s*\{[\s\S]*flex:\s*1 1 100%/);
});
