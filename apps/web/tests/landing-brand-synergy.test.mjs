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

test("marketing navigation is user-triggered and reduced-motion safe", async () => {
  const [home, navigation, css] = await Promise.all([
    readFile(new URL("../src/components/marketing-clear/clear-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/marketing-clear/clear-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/marketing-clear/marketing-clear.module.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(`${home}\n${navigation}`, /setInterval|autoPlay|BrandSynergySimulator/);
  assert.match(navigation, /onClick=\{\(\) => setOpenMenu\(expanded \? null : group\.id\)\}/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(css, /@keyframes menuEnter/);
  assert.match(css, /@keyframes drawerEnter/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0\.01ms !important/);
});

test("marketing copy keeps commercial outcomes measurable and evidence bounded", async () => {
  const content = await readFile(new URL("../src/components/marketing-clear/marketing-clear.content.ts", import.meta.url), "utf8");

  assert.match(content, /Pilotos medibles/);
  assert.match(content, /Measurable pilots/);
  assert.match(content, /Digital evidence does not by itself prove the physical object/);
  assert.match(content, /Commercial results are measurable pilot objectives, not automatic promises of conversion or repurchase/);
  assert.doesNotMatch(content, /asegura recompras|sees if the product is real|impossible to clone|(?:89|94|97)%/i);
});

test("clear-mode shell owns contrast, touch targets and explicit dark opt-in", async () => {
  const [context, navigation, css, themeToggle, localeSwitcher] = await Promise.all([
    readFile(new URL("../src/components/marketing-clear/marketing-page-context.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/marketing-clear/clear-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/marketing-clear/marketing-clear.module.css", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/ui/src/theme-toggle.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/ui/src/locale-switcher.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(contrastRatio("#ffffff", "#075f5e") >= 4.5);
  assert.match(context, /get\("theme"\)\?\.value === "dark" \? "dark" : "light"/);
  assert.match(navigation, /<ThemeToggle initialTheme=\{initialTheme\} locale=\{locale\} \/>/);
  assert.match(navigation, /<LocaleSwitcher value=\{locale\}/);
  assert.match(css, /--clear-bg: #f7f9fc/);
  assert.match(css, /\.navGroupButton,[\s\S]*min-height: 2\.75rem/);
  assert.match(css, /\.mobileDialogHead button[\s\S]*width: 2\.8rem[\s\S]*height: 2\.8rem/);
  assert.match(css, /:focus-visible[\s\S]*outline: 3px solid/);
  assert.match(themeToggle, /useState<Theme>\(initialTheme\)/);
  assert.match(localeSwitcher, /locale-switcher inline-flex min-h-11/);
});
