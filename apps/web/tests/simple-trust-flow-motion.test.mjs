import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [motion, visuals, css] = await Promise.all([
  readFile(new URL("../src/components/simple-trust-flow-motion.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/simple-trust-step-visual.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);

test("trust journey motion runs only while visible and allowed by user preferences", () => {
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(motion, /visibilitychange/);
  assert.match(motion, /addEventListener\("change", handleReducedMotionChange\)/);
  assert.match(motion, /removeEventListener\("change", handleReducedMotionChange\)/);
  assert.match(motion, /intersectionObserver\?\.disconnect\(\)/);
  assert.match(motion, /data-motion-active=\{motionActive \? "true" : "false"\}/);
  assert.doesNotMatch(motion, /setInterval|requestAnimationFrame|framer-motion|lottie/i);
});

test("three decorative vector scenes add no media request or interactive control", () => {
  for (const kind of ["discover", "signal", "aftercare"]) {
    assert.match(visuals, new RegExp(`kind === "${kind}"|SimpleTrustVisualKind = [^\\n]*"${kind}"`));
  }
  assert.match(visuals, /aria-hidden="true"/);
  assert.match(visuals, /focusable="false"/);
  assert.match(visuals, /<svg/g);
  assert.match(visuals, /MUESTRA ILUSTRATIVA/);
  assert.match(visuals, /Reserva Andina/);
  assert.match(visuals, /RA-2407/);
  assert.match(visuals, /MENDOZA, AR/);
  assert.match(visuals, /CONTROLES  3 DE 3/);
  assert.match(visuals, /RESULTADO DE LA ETIQUETA DIGITAL/);
  assert.doesNotMatch(visuals, /<img|<video|\.gif|https?:\/\/|onClick|tabIndex/i);
});

test("trust visuals reserve layout, pause offscreen and become static with reduced motion", () => {
  assert.match(css, /\.simple-trust-flow-visual \{[\s\S]{0,1200}height:\s*clamp\(/);
  assert.match(css, /contain:\s*paint/);
  assert.match(css, /animation-play-state:\s*running/);
  assert.match(css, /1 both paused/);
  assert.doesNotMatch(css, /trust-visual[^;\n]*infinite/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.simple-trust-flow-visual \*/);
  assert.match(css, /\.simple-trust-flow-visual \.trust-visual__animated[\s\S]{0,220}opacity:\s*1 !important/);
});
