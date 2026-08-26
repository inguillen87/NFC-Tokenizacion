import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [navigation, content, types, css] = await Promise.all([
  readFile(new URL("../src/components/marketing-v4/nexid-navigation-v4.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/marketing-v4/nexid-navigation-v4.content.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/marketing-v4/nexid-navigation-v4.types.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/marketing-v4/nexid-navigation-v4.module.css", import.meta.url), "utf8"),
]);

test("navigation v4 exposes exactly five top-level categories and honest actions", () => {
  const categoryBlock = types.match(/NEXID_NAVIGATION_V4_CATEGORY_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? "";
  assert.deepEqual([...categoryBlock.matchAll(/"([a-z]+)"/g)].map((match) => match[1]), [
    "product",
    "solutions",
    "demo",
    "resources",
    "developers",
  ]);
  assert.match(content, /demoCta:\s*"\/demo-lab"/);
  assert.match(content, /salesCta:\s*"\/\?contact=sales#contact-modal"/);
  assert.match(content, /resources:\s*"\/proof\/verify"/);
  assert.match(content, /developers:\s*"\/sdk"/);
});

test("navigation v4 supports keyboard, focus containment and focus restoration", () => {
  assert.match(navigation, /aria-expanded=\{open\}/);
  assert.match(navigation, /aria-controls=\{panelId\}/);
  assert.match(navigation, /event\.key === "ArrowRight" \|\| event\.key === "ArrowLeft"/);
  assert.match(navigation, /event\.key === "Home" \|\| event\.key === "End"/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /event\.key !== "Tab"/);
  assert.match(navigation, /element\.inert = true/);
  assert.match(navigation, /mobileCloseRef\.current\?\.focus\(\)/);
  assert.match(navigation, /mobileTriggerRef\.current\?\.focus\(\)/);
  assert.match(navigation, /document\.body\.style\.overflow = "hidden"/);
});

test("navigation v4 keeps preferences, touch targets and reduced motion", () => {
  assert.match(navigation, /<LocaleSwitcher value=\{locale\}/);
  assert.match(navigation, /<ThemeToggle initialTheme=\{initialTheme\} locale=\{locale\}/);
  assert.match(css, /\.iconButton\s*\{[\s\S]*width:\s*2\.75rem[\s\S]*height:\s*2\.75rem/);
  assert.match(css, /@media \(min-width: 86rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
});
