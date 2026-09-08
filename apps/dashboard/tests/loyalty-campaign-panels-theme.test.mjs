import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss from "postcss";

const client = await readFile(new URL("../src/app/(app)/loyalty/campaigns/loyalty-campaigns-client.tsx", import.meta.url), "utf8");
const globals = postcss.parse(await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"));
const lightTheme = 'html:is(.theme-light, [data-theme="light"])';
const neutralTriviaSelector = `${lightTheme} .loyalty-campaign-trivia-panel .bg-slate-800.text-slate-400`;

function rule(root, selector) {
  let found;
  root.walkRules((candidate) => {
    if (candidate.selectors.includes(selector)) found = candidate;
  });
  assert.ok(found, `Missing style rule: ${selector}`);
  return found;
}

function value(rule, property) {
  return rule.nodes.find((node) => node.type === "decl" && node.prop === property)?.value;
}

function channels(hex) {
  return hex.slice(1).match(/../g).map((channel) => Number.parseInt(channel, 16));
}

function luminance(rgb) {
  const [red, green, blue] = rgb.map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first, second) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

test("campaign circuit and trivia use only their own panel backgrounds", () => {
  for (const panel of ["circuit", "trivia"]) {
    assert.equal((client.match(new RegExp(`loyalty-campaign-${panel}-panel`, "g")) || []).length, 1);
  }
  assert.doesNotMatch(client, /bg-\[radial-gradient/);
  const panelRules = [];
  globals.walkRules((candidate) => {
    if (candidate.selector.includes("loyalty-campaign-")) panelRules.push(candidate);
  });
  assert.equal(panelRules.length, 5);
  assert.ok(panelRules.every((candidate) => candidate.selectors.every((selector) => /^\.(?:loyalty-campaign-circuit-panel|loyalty-campaign-trivia-panel)$/.test(selector)
    || selector === `${lightTheme} .loyalty-campaign-circuit-panel`
    || selector === `${lightTheme} .loyalty-campaign-trivia-panel`
    || selector === neutralTriviaSelector)), "Panel fixes must not recolor unrelated dashboard surfaces");
});

test("dark panel gradients preserve the existing composition and opacity", () => {
  const compact = (text) => text.replace(/\s+/g, "");
  assert.equal(compact(value(rule(globals, ".loyalty-campaign-circuit-panel"), "background")), "radial-gradient(circleat12%0%,rgba(34,211,238,0.16),transparent36%),linear-gradient(135deg,rgba(2,6,23,0.92),rgba(8,47,73,0.36))");
  assert.equal(compact(value(rule(globals, ".loyalty-campaign-trivia-panel"), "background")), "radial-gradient(circleat0%0%,rgba(168,85,247,0.16),transparent38%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(30,41,59,0.52))");
});

test("light panel rules replace background images instead of painting behind the dark gradient", () => {
  for (const panel of ["loyalty-campaign-circuit-panel", "loyalty-campaign-trivia-panel"]) {
    const lightRule = rule(globals, `${lightTheme} .${panel}`);
    const background = value(lightRule, "background");
    assert.match(background, /^linear-gradient\(135deg, #[a-f\d]{6}, #[a-f\d]{6}\)$/i);
    assert.equal(value(lightRule, "background-color"), undefined, "A background-color override alone leaves the old dark image visible");
    assert.ok(globals.nodes.indexOf(lightRule) > globals.nodes.indexOf(rule(globals, `.${panel}`)));
  }
});

test("existing title, body and accent colors remain readable across each light gradient", () => {
  for (const [panel, accent] of [["loyalty-campaign-circuit-panel", "cyan"], ["loyalty-campaign-trivia-panel", "violet"]]) {
    const background = value(rule(globals, `${lightTheme} .${panel}`), "background");
    const [start, end] = background.match(/#[a-f\d]{6}/gi).map(channels);
    for (const selector of ["html.theme-light .text-white", "html.theme-light .text-slate-400", `html.theme-light .text-${accent}-200`]) {
      const foreground = channels(value(rule(globals, selector), "color"));
      for (let step = 0; step <= 20; step += 1) {
        const surface = start.map((channel, index) => channel + (end[index] - channel) * step / 20);
        const ratio = contrast(foreground, surface);
        assert.ok(ratio >= 4.5, `${panel}, ${selector}, gradient step ${step}: ${ratio.toFixed(2)}:1`);
      }
    }
  }
});

test("neutral trivia chips stay readable in light mode without changing other panels or dark mode", () => {
  const neutralRule = rule(globals, neutralTriviaSelector);
  const background = channels(value(neutralRule, "background"));
  const foreground = channels(value(neutralRule, "color"));
  assert.ok(contrast(foreground, background) >= 4.5);
  // globals.css already gives this utility an important foreground in light mode.
  const inheritedForeground = channels(value(rule(globals, "html.theme-light .text-slate-400"), "color"));
  assert.ok(contrast(inheritedForeground, background) >= 4.5);
  const neutralRules = [];
  globals.walkRules((candidate) => {
    if (candidate.selector.includes("loyalty-campaign-") && candidate.selector.includes(".bg-slate-800")) neutralRules.push(candidate);
  });
  assert.equal(neutralRules.length, 1);
  assert.deepEqual(neutralRules[0].selectors, [neutralTriviaSelector]);
});
