import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [component, styles, home] = await Promise.all([
  readFile(new URL("../src/components/hero-value-loop.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/hero-value-loop.module.css", import.meta.url), "utf8"),
  readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
]);

test("home motion explains the product-to-action loop without loading decorative animation stacks", () => {
  assert.match(home, /<HeroValueLoop locale=\{locale\} \/>/);
  assert.match(component, /LazyMotion, domAnimation, m, useReducedMotion/);
  assert.match(component, /Producto conectado/);
  assert.match(component, /Experiencia sin app/);
  assert.match(component, /Resultado para tu marca/);
  assert.doesNotMatch(component, /gsap|three|canvas/i);
});

test("hero motion pauses offscreen, in hidden tabs and for reduced-motion users", () => {
  assert.match(component, /IntersectionObserver/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /!isAutoAdvancing \|\| !inView \|\| !pageVisible/);
  assert.match(component, /setAutoAdvance\(false\)/);
  assert.match(component, /const motionEnabled = mounted && !reduceMotion/);
  assert.match(component, /disabled=\{!motionEnabled\}/);
  assert.match(component, /copy\.pause/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(max-width: 360px\)/);
});

test("the animated stages remain directly operable and truthfully scoped", () => {
  assert.match(component, /role="group" aria-label=\{copy\.controls\}/);
  assert.match(component, /aria-pressed=\{activeIndex === index\}/);
  assert.match(component, /aria-label=\{`\$\{stage\.short\}\. \$\{stage\.title\}\. \$\{stage\.body\}/);
  assert.match(component, /cada control físico requiere evidencia adicional/);
  assert.match(component, /every physical control requires additional evidence/);
});
