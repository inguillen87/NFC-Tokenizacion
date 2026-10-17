import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSvgPaintSnapshot } from "./browser/svg-paint-reference.mjs";

const namespace = "http://www.w3.org/2000/svg";
const attribute = (name, value) => ({ name, namespace: null, value });
function sample(prefix = "server") {
  return {
    elements: [{ tag: "rect", classes: "plateFace", styles: { fill: `url("#${prefix}-face")`, stroke: "none", paddingTop: "16px", color: "rgb(1, 2, 3)" }, geometry: { x: 1, y: 2, width: 44, height: 44 }, svgScope: 0 }],
    svgScopes: [{ nodes: [
      { key: 1, tag: "linearGradient", namespace, attributes: [attribute("id", `${prefix}-face`), attribute("x1", "20"), attribute("gradientUnits", "userSpaceOnUse")], content: [{ node: 2 }] },
      { key: 2, tag: "stop", namespace, attributes: [attribute("offset", "0"), attribute("stop-color", "var(--identity-face-hi)")], content: [], stopStyle: { stopColor: "rgb(230, 240, 250)", stopOpacity: "1" } },
    ] }],
  };
}

test("regenerated ids compare equal only through equivalent captured SVG definitions", () => {
  assert.deepEqual(normalizeSvgPaintSnapshot(sample("server")), normalizeSvgPaintSnapshot(sample("client")));
  const uppercase = sample(); uppercase.elements[0].styles.fill = 'URL("#server-face")';
  assert.deepEqual(normalizeSvgPaintSnapshot(uppercase), normalizeSvgPaintSnapshot(sample()));
});

test("computed stop colors, opacity, definition attributes and tags remain material differences", () => {
  const baseline = normalizeSvgPaintSnapshot(sample());
  for (const change of [
    value => { value.svgScopes[0].nodes[1].stopStyle.stopColor = "rgb(1, 2, 3)"; },
    value => { value.svgScopes[0].nodes[1].stopStyle.stopOpacity = ".5"; },
    value => { value.svgScopes[0].nodes[0].attributes[1].value = "21"; },
    value => { value.svgScopes[0].nodes[0].tag = "radialGradient"; },
  ]) { const changed = sample(); change(changed); assert.notDeepEqual(normalizeSvgPaintSnapshot(changed), baseline); }
});

test("non-paint CSS and geometry are preserved exactly rather than normalized", () => {
  const input = sample(), before = structuredClone(input);
  const output = normalizeSvgPaintSnapshot(input);
  assert.deepEqual(input, before, "raw capture is not mutated");
  assert.equal(output[0].styles.paddingTop, "16px"); assert.deepEqual(output[0].geometry, input.elements[0].geometry);
  for (const change of [value => { value.elements[0].styles.paddingTop = "12px"; }, value => { value.elements[0].geometry.width = 48; }]) {
    const changed = sample(); change(changed); assert.notDeepEqual(normalizeSvgPaintSnapshot(changed), output);
  }
});

test("broken, ambiguous and cross-SVG paint references fail closed", () => {
  const broken = sample(); broken.elements[0].styles.fill = "url(#missing)";
  assert.throws(() => normalizeSvgPaintSnapshot(broken), /uniquely in the same SVG.*0 matches/);
  const ambiguous = sample(); ambiguous.svgScopes[0].nodes.push({ ...structuredClone(ambiguous.svgScopes[0].nodes[0]), key: 3 });
  assert.throws(() => normalizeSvgPaintSnapshot(ambiguous), /uniquely in the same SVG.*2 matches/);
  const crossSvg = sample(); crossSvg.svgScopes.push({ nodes: [] }); crossSvg.elements[0].svgScope = 1;
  assert.throws(() => normalizeSvgPaintSnapshot(crossSvg), /uniquely in the same SVG.*0 matches/);
});

test("local href dependencies are resolved recursively without preserving regenerated ids", () => {
  function inherited(prefix) {
    const value = sample(prefix);
    value.svgScopes[0].nodes.unshift({ key: 0, tag: "linearGradient", namespace, attributes: [attribute("id", `${prefix}-inherited`), attribute("href", `#${prefix}-face`)], content: [] });
    value.elements[0].styles.fill = `url(#${prefix}-inherited)`; return value;
  }
  assert.deepEqual(normalizeSvgPaintSnapshot(inherited("server")), normalizeSvgPaintSnapshot(inherited("client")));
  const broken = inherited("broken"); broken.svgScopes[0].nodes[0].attributes[1].value = "#absent";
  assert.throws(() => normalizeSvgPaintSnapshot(broken), /0 matches/);
});

test("cyclic href and child definitions, missing stop evidence and unsupported paints fail", () => {
  const cyclicHref = sample(); cyclicHref.svgScopes[0].nodes[0].attributes.push(attribute("href", "#server-face"));
  assert.throws(() => normalizeSvgPaintSnapshot(cyclicHref), /Cyclic/);
  const cyclicChild = sample(); cyclicChild.svgScopes[0].nodes[1].content.push({ node: 1 });
  assert.throws(() => normalizeSvgPaintSnapshot(cyclicChild), /Cyclic/);
  const missingStop = sample(); delete missingStop.svgScopes[0].nodes[1].stopStyle;
  assert.throws(() => normalizeSvgPaintSnapshot(missingStop), /computed paint evidence/);
  const unsupported = sample(); unsupported.svgScopes[0].nodes[0].tag = "pattern";
  assert.throws(() => normalizeSvgPaintSnapshot(unsupported), /Unsupported SVG paint server/);
  const external = sample(); external.elements[0].styles.fill = 'url("https://outside.invalid/paint.svg#face")';
  assert.throws(() => normalizeSvgPaintSnapshot(external), /not a local fragment/);
  const outside = sample(); outside.svgScopes[0].nodes[0].content.push({ outsideSvg: true });
  assert.throws(() => normalizeSvgPaintSnapshot(outside), /owning SVG scope/);
});
