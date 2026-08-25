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
  assert.match(content, /Conversion and repeat purchase are measured in each pilot, not promised/);
  assert.match(content, /Conversión y recompra se miden en cada piloto; no se prometen/);
  assert.match(sections, /designed to resist message copying and replay when keys, counters and server validation are correctly configured/);
});

test("home v4 light mode and navigation controls keep enterprise contrast", async () => {
  const css = await readFile(new URL("../src/components/marketing-v4/nexid-home-v4.module.css", import.meta.url), "utf8");
  const navCss = await readFile(new URL("../src/components/marketing-v4/nexid-navigation-v4.module.css", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../src/components/marketing-v4/nexid-navigation-v4.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const themeToggle = await readFile(new URL("../../../packages/ui/src/theme-toggle.tsx", import.meta.url), "utf8");
  const localeSwitcher = await readFile(new URL("../../../packages/ui/src/locale-switcher.tsx", import.meta.url), "utf8");

  assert.ok(contrastRatio("#ffffff", "#087f6f") >= 4.5);
  assert.match(css, /:global\(html\[data-theme="light"\]\) \.root/);
  assert.match(css, /--v4-ink:\s*#13211d/);
  assert.match(navCss, /:global\(html\[data-theme="light"\]\) \.header/);
  assert.match(navCss, /\.iconButton\s*\{[\s\S]*min-width:\s*2\.75rem/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(page, /BrandSynergySimulator|landing-brand-synergy-band/);
  assert.match(navigation, /<ThemeToggle initialTheme=\{initialTheme\}/);
  assert.match(navigation, /<LocaleSwitcher value=\{locale\}/);
  assert.match(page, /initialTheme=\{initialTheme\}/);
  assert.match(themeToggle, /ThemeToggle\(\{ initialTheme = "dark" \}/);
  assert.match(themeToggle, /useState<Theme>\(initialTheme\)/);
  assert.match(localeSwitcher, /locale-switcher inline-flex min-h-11/);
  assert.match(localeSwitcher, /className="min-h-11 bg-transparent/);
});
