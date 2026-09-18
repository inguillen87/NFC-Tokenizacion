import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss from "postcss";

const source = await readFile(new URL("../src/components/ops-command-center.tsx", import.meta.url), "utf8");
const css = (await readFile(new URL("../src/components/ops-command-center.module.css", import.meta.url), "utf8")).replace(/\r\n/g, "\n");

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
  assert.match(source, /data-testid="ops-command-center" className=\{styles\.workspace\}/);
  assert.match(source, /styles\.header/);
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
      ["text", "base"], ["text", "surface"], ["text", "surface-strong"], ["muted", "base"], ["muted", "surface"], ["muted", "surface-strong"],
      ["text", "success-bg"], ["muted", "success-bg"],
      ["accent", "accent-bg"], ["success", "success-bg"], ["warning", "warning-bg"], ["danger", "danger-bg"],
      ["on-accent", "accent"], ["on-accent", "success"],
    ]) assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5, `theme ${index}: ${foreground} / ${background}`);
    assert.ok(contrast(tokens.accent, tokens.surface) >= 3, `theme ${index}: focus outline / surface`);
    assert.ok(contrast(tokens.success, tokens.track) >= 3, `theme ${index}: readiness progress / track`);
  }
});

test("links and disclosures have 44px targets, keyboard focus and bounded mobile layouts", () => {
  for (const selector of [".actionCard", ".tableLink", ".disclosure summary"]) {
    const rule = postcss.parse(css).nodes.find((node) => node.type === "rule" && node.selector === selector);
    assert.ok(rule, selector);
    assert.ok(rule.nodes.some((node) => node.prop === "min-height" && node.value === "2.75rem"), `${selector} 44px target`);
    assert.ok(rule.nodes.some((node) => node.prop === "touch-action" && node.value === "manipulation"), selector);
  }
  assert.match(css, /\.workspace a:focus-visible,[\s\S]*?\.workspace summary:focus-visible,[\s\S]*?\.tableScroll:focus-visible \{ outline: 3px solid var\(--ops-accent\); outline-offset: 3px/);
  assert.match(css, /\.tableScroll \{[^}]*max-width: 100%;[^}]*overflow-x: auto;[^}]*overscroll-behavior-x: contain/);
  assert.match(css, /\.table \{[^}]*min-width: 46rem/);
  assert.match(source, /className=\{styles\.tableScroll\} role="region" aria-label="[^"]+" tabIndex=\{0\}/);
  assert.match(source, /<caption>/);
  assert.match(source, /<th scope="col">/);
  assert.match(source, /<th scope="row">/);
  assert.match(css, /\.actionGrid \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.metrics \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.workspace a \{ transition: none;/);
  assert.doesNotMatch(css, /overflow: hidden|opacity:|translate|animation:/);
  assert.doesNotMatch(source, /text-\[(?:10|11)px\]|md:grid-cols-5/);
});

test("scoped styles compile with no missing classes or external theme side effects", () => {
  const parsed = postcss.parse(css);
  const classNames = new Set([...css.matchAll(/\.([A-Za-z][A-Za-z\d]*)\b/g)].map((match) => match[1]));
  for (const [, className] of source.matchAll(/styles\.([A-Za-z\d]+)/g)) assert.ok(classNames.has(className), className);
  parsed.walkDecls((declaration) => {
    if (declaration.prop.startsWith("--")) assert.ok(declaration.prop.startsWith("--ops-"), declaration.prop);
    if (["color", "background", "background-color", "border-color", "outline", "accent-color"].includes(declaration.prop)) {
      assert.match(declaration.value, /var\(--ops-/, `${declaration.prop}: ${declaration.value}`);
    }
  });
  parsed.walkRules((rule) => {
    if (rule.selector.includes(":global")) assert.equal(rule.selector, ':global(html.theme-light) .workspace,\n:global(html[data-theme="light"]) .workspace');
  });
});

test("overview progress and mixed-volume charts are removed while caller props remain compatible", () => {
  assert.match(source, /steps: OpsCommandStep\[\]/);
  assert.match(source, /funnel: Array<\{ stage: string; value: number \}>/);
  assert.doesNotMatch(source, /from "recharts"|AreaChart|BarChart|stepCompletion|readySteps|normalizedMetrics|normalizedFunnel|normalizedReadiness|MiniIconRail/);
  assert.doesNotMatch(source, /Camino guiado|Volúmenes por etapa|Estado orientativo de etapas|steps\.length.*listo|\}%/);
  assert.match(source, /Number\.isFinite\(item\.ready\).*Number\.isFinite\(item\.pending\)/);
  assert.match(source, /hasBase \? <progress[^>]*value=\{item\.ready\} max=\{total\}/);
  assert.match(source, /Sin base para calcular/);
  assert.match(css, /\.progress::-webkit-progress-value \{[^}]*background: var\(--ops-success\)/);
  assert.match(css, /\.progress::-moz-progress-bar \{[^}]*background: var\(--ops-success\)/);
});
