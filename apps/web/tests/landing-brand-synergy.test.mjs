import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function relativeLuminance(hex) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test("brand synergy uses a truthful, reduced-motion-safe mobile decision flow", async () => {
  const source = await readFile(new URL("../src/components/brand-synergy-simulator.tsx", import.meta.url), "utf8");

  assert.match(source, /type MobilePane = "business" \| "activation"/);
  assert.match(source, /brand-synergy-mobile-view-switch/);
  assert.match(source, /data-mobile-active=\{mobilePane === "business"/);
  assert.match(source, /data-mobile-active=\{mobilePane === "activation"/);
  assert.match(source, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(source, /if \(isPaused\) return/);
  assert.match(source, /aria-live="off"/);
  assert.match(source, /HYPOTHETICAL SCENARIO/);
  assert.match(source, /They are not customers, partners or measured performance/);
  assert.match(source, /Generic brands, benefits and outcomes/);
  assert.match(source, /Guided offer model/);
  assert.doesNotMatch(source, /Partner matching live/);
  assert.doesNotMatch(source, /Patagonia Beer Gardens|Combi VIP Traslados|Club 146 Lounge VIP/);
  assert.doesNotMatch(source, /conversionEst|Risk score: 0\.01|Riesgo: 0\.01|Risco: 0\.01/);
  assert.doesNotMatch(source, /(?:89|94|97)%/);
});

test("landing claims qualify technical security and commercial outcomes", async () => {
  const content = await readFile(new URL("../src/lib/landing-content.ts", import.meta.url), "utf8");
  const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(content, /asegura recompras|sees if the product is real/);
  assert.doesNotMatch(sections, /impossible to clone or replay|imposible de clonar o copiar/);
  assert.match(sections, /lectura no confirma por sí sola el producto físico/);
  assert.match(sections, /leitura não confirma sozinha o produto físico/);
  assert.match(sections, /reading does not confirm the physical product by itself/);
  assert.doesNotMatch(content, /(?:garantiza|garante|guarantees) (?:la |a )?(?:conversión|conversão|conversion|recompra|repeat purchase)/i);
  assert.match(sections, /designed to resist message copying and replay when keys, counters and server validation are correctly configured/);
});

test("brand synergy remains a reusable truthful surface but does not crowd the home", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../src/components/marketing-mega-nav.tsx", import.meta.url), "utf8");
  const navigationCss = await readFile(new URL("../src/components/marketing-mega-nav.module.css", import.meta.url), "utf8");
  const themeToggle = await readFile(new URL("../../../packages/ui/src/theme-toggle.tsx", import.meta.url), "utf8");
  const localeSwitcher = await readFile(new URL("../../../packages/ui/src/locale-switcher.tsx", import.meta.url), "utf8");

  assert.ok(contrastRatio("#ffffff", "#155e75") >= 4.5);
  assert.ok(contrastRatio("#ffffff", "#0f766e") >= 4.5);
  assert.match(css, /\.landing-brand-synergy-band\s*\{[\s\S]*background:\s*#07111f/);
  assert.match(css, /html\.theme-light \.landing-brand-synergy-band,[\s\S]*background:\s*#eef5f8/);
  assert.match(css, /\.brand-synergy-scenario-pill\.is-active\s*\{[\s\S]*#155e75[\s\S]*#0f766e/);
  assert.match(css, /\.brand-synergy-mobile-view-switch button\s*\{[\s\S]*min-height:\s*2\.75rem/);
  assert.match(css, /\.brand-synergy-business-pane\[data-mobile-active="false"\],[\s\S]*display:\s*none !important/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.brand-synergy-terminal-row[\s\S]*transition-duration:\s*0\.01ms/);
  assert.match(navigationCss, /\.mobileMenuButton\s*\{[\s\S]*min-height:\s*2\.65rem/);
  assert.doesNotMatch(page, /BrandSynergySimulator|brand-synergy/);
  assert.match(page, /initialTheme=\{initialTheme\}/);
  assert.match(navigation, /<ThemeToggle initialTheme=\{initialTheme\} locale=\{locale\} \/>/);
  assert.match(navigation, /role="dialog" aria-modal="true"/);
  assert.match(themeToggle, /ThemeToggle\(\{ initialTheme = "light", locale = "en" \}/);
  assert.match(themeToggle, /useState<Theme>\(initialTheme\)/);
  assert.ok(
    themeToggle.indexOf('document.documentElement.getAttribute("data-theme")') < themeToggle.indexOf('localStorage.getItem("theme")'),
    "the server-rendered light default must win over stale browser storage",
  );
  assert.match(localeSwitcher, /locale-switcher inline-flex min-h-11/);
  assert.match(localeSwitcher, /className="min-h-11 bg-transparent/);
});
