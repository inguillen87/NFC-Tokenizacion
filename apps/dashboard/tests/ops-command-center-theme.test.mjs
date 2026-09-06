import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const source = await readFile(new URL("../src/components/ops-command-center.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/components/ops-command-center.module.css", import.meta.url), "utf8");

function contrast(a, b) {
  const luminance = (hex) => {
    const channels = hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255)
      .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + .05) / (low + .05);
}

test("operation surfaces and status chips no longer depend on hardcoded dark global utilities", () => {
  assert.match(source, /import styles from "\.\/ops-command-center\.module\.css"/);
  assert.match(source, /data-testid="ops-command-center" className=\{`\$\{styles\.workspace\}/);
  assert.match(source, /styles\.hero/);
  assert.match(source, /function StatusChip\(/);
  assert.doesNotMatch(source, /<Card|dashboard-hero-panel|bg-\[(?:linear|radial)-gradient|bg-slate-\d|text-white|text-(?:cyan|emerald|amber|rose|slate)-\d|opacity-(?:75|85)/);
  assert.match(css, /:global\(html\.theme-light\) \.workspace/);
  assert.match(css, /:global\(html\[data-theme="light"\]\) \.workspace/);
});

test("both themes maintain readable text and status tones without opacity reductions", () => {
  const themes = [...css.matchAll(/--ops-text: #[a-f\d]+;[\s\S]+?--ops-base: #[a-f\d]+;/g)];
  assert.equal(themes.length, 2);
  for (const [index, match] of themes.entries()) {
    const tokens = Object.fromEntries([...match[0].matchAll(/--ops-([\w-]+): (#[a-f\d]+);/g)].map((entry) => [entry[1], entry[2]]));
    for (const [foreground, background] of [
      ["text", "base"], ["text", "surface"], ["muted", "base"], ["muted", "surface"], ["muted", "surface-strong"],
      ["accent", "accent-bg"], ["success", "success-bg"], ["warning", "warning-bg"], ["danger", "danger-bg"],
      ["on-accent", "accent"], ["on-accent", "success"],
    ]) assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5, `theme ${index}: ${foreground} / ${background}`);
    for (const series of ["accent", "success", "warning"]) {
      assert.ok(contrast(tokens[series], tokens.surface) >= 3, `theme ${index}: ${series} chart / surface`);
    }
  }
});

test("links have 44px targets, keyboard focus and bounded mobile layouts", () => {
  assert.match(css, /\.workspace a \{[\s\S]*?display: block;[\s\S]*?min-height: 2\.75rem;[\s\S]*?touch-action: manipulation/);
  assert.match(css, /\.workspace td a \{[\s\S]*?display: inline-flex;[\s\S]*?min-width: 2\.75rem/);
  assert.match(css, /\.workspace a:focus-visible \{[\s\S]*?outline: 3px solid var\(--ops-accent\)/);
  assert.match(css, /\.iconRail \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(source, /text-\[(?:10|11)px\]|md:grid-cols-5/);
});

test("compiled utilities and chart styling resolve theme variables without changing graph data", async () => {
  const compiled = (await postcss([tailwindcss({ content: [{ raw: source, extension: "tsx" }], theme: { extend: {} }, plugins: [] })])
    .process("@tailwind utilities;", { from: undefined })).css;
  for (const token of ["text", "muted", "accent", "danger"]) assert.ok(compiled.includes(`color: var(--ops-${token})`));
  assert.ok(compiled.includes("background-color: var(--ops-surface)"));
  assert.match(source, /stroke="var\(--ops-muted\)"/);
  assert.match(source, /fontSize=\{12\}/);
  assert.match(source, /AreaChart data=\{normalizedFunnel\}/);
  assert.match(source, /BarChart data=\{normalizedReadiness\}/);
  assert.match(source, /background: "var\(--dashboard-chart-tooltip-bg\)"/);
  assert.match(css, /--dashboard-chart-tooltip-bg: var\(--ops-surface\)/);
  assert.doesNotMatch(source, /stroke="#|fill="#|stopColor="#/);
});
