import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss from "postcss";
import ts from "typescript";

const [source, css] = await Promise.all([
  readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);
const parsed = ts.createSourceFile("crm.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);

function actualCallback(name, dependencies) {
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(declaration, `exercise the actual ${name} callback`);
  const compiled = ts.transpileModule(declaration.getText(parsed), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}\nreturn ${name};`)(...Object.values(dependencies));
}

function fixture() {
  const state = { theme: "light", baseMap: "light", view: "points", zoom: 1.22 };
  const dependencies = {
    baseMapFollowsTheme: { current: true },
    preferredDashboardBaseMap: () => state.theme,
    setBaseMap: (value) => { state.baseMap = value; },
    setMapView: (value) => { state.view = value; },
    setMapZoom: (value) => { state.zoom = value; },
  };
  return {
    state,
    sync: actualCallback("syncBaseMapWithTheme", dependencies),
    select: actualCallback("selectBaseMap", dependencies),
    reset: actualCallback("resetMapPresentation", dependencies),
  };
}

test("automatic base maps follow both theme directions", () => {
  const { state, sync } = fixture();
  for (const theme of ["dark", "light", "dark", "light"]) {
    state.theme = theme;
    sync();
    assert.equal(state.baseMap, theme);
  }
});

test("every explicit base map survives theme changes, including an explicit match to the current theme", () => {
  for (const choice of ["light", "dark", "satellite", "terrain"]) {
    const { state, select, sync } = fixture();
    select(choice);
    for (const theme of ["dark", "light", "dark"]) {
      state.theme = theme;
      sync();
      assert.equal(state.baseMap, choice);
    }
  }
});

test("Reset restores density, zoom and automatic theme following after an explicit selection", () => {
  const { state, select, sync, reset } = fixture();
  select("satellite");
  state.theme = "dark";
  reset();
  assert.equal(state.baseMap, "dark");
  assert.equal(state.view, "heat");
  assert.equal(state.zoom, 1);
  state.theme = "light";
  sync();
  assert.equal(state.baseMap, "light");
  assert.match(source, /label: "Limpiar filtros"[^\n]+resetMapPresentation\(\)/);
  assert.match(source, /onClick=\{resetMapPresentation\}/);
});

test("the CRM header exposes the shared Spanish theme control without leaving the operational view", () => {
  assert.match(source, /import \{ ThemeToggle \} from "@product\/ui"/);
  const header = source.match(/<header data-testid="crm-responsive-header"[\s\S]*?<\/header>/)?.[0] || "";
  assert.equal((header.match(/<ThemeToggle\b/g) || []).length, 1);
  assert.match(header, /className="nexid-crm-theme-control shrink-0" data-testid="crm-theme-control">\s*<ThemeToggle locale="es-AR"\s*\/>/);
});

test("keyboard outlines stay inside all horizontally clipped map control groups", () => {
  const selectors = [".nexid-crm-map-actions", ".nexid-crm-map-view-controls", ".nexid-crm-map-base-controls"];
  let insetRule;
  postcss.parse(css).walkRules((rule) => {
    if (selectors.every((selector) => rule.selector.includes(selector)) && rule.selector.includes("button:focus-visible")) insetRule = rule;
  });
  assert.ok(insetRule, "every map toolbar group preserves a visible keyboard outline");
  const offset = insetRule.nodes.find((node) => node.type === "decl" && node.prop === "outline-offset");
  assert.equal(offset?.value, "-4px", "3px focus outline fits within the 44px control");
});

function contrast(first, second) {
  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("actual CRM palettes keep text at AA contrast and control boundaries distinguishable in both themes", () => {
  const palettes = [];
  postcss.parse(css).walkRules((rule) => {
    const values = Object.fromEntries(rule.nodes.filter((node) => node.type === "decl" && node.prop.startsWith("--crm-"))
      .map((node) => [node.prop.slice(6), node.value]));
    if (values.panel) palettes.push(values);
  });
  assert.equal(palettes.length, 2);
  for (const palette of palettes) {
    for (const [foreground, background] of [
      ["ink", "panel"], ["muted", "panel"], ["ink", "control"],
      ["ink", "control-hover"], ["accent", "active"], ["primary-ink", "primary"],
      ["disabled-ink", "disabled"],
    ]) {
      assert.ok(contrast(palette[foreground], palette[background]) >= 4.5, `${foreground} on ${background}: ${palette.panel}`);
    }
    assert.ok(contrast(palette["control-border"], palette.control) >= 3, "visible control boundary");
    for (const color of ["cyan", "green", "blue", "red"]) {
      assert.ok(contrast(palette[`chart-${color}`], palette.panel) >= 3, `visible ${color} chart stroke`);
    }
  }
});
