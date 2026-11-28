import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const tap = read("src/components/hero-tap-demo.tsx");
const motion = read("src/components/landing-motion.tsx");
const css = read("src/components/home-enhancements.module.css");
const sections = read("src/components/home-extra-sections.tsx");
const home = read("src/app/page.tsx");

test("the simulated hero tap is labelled as sample data and never calls an API", () => {
  assert.match(tap, /Demo · datos de ejemplo/);
  assert.match(tap, /Demo · sample data/);
  assert.match(tap, /Demo · dados de exemplo/);
  assert.match(tap, /no certifica por sí sola el producto físico/);
  assert.doesNotMatch(tap, /fetch\(|auténtic|authentic|autêntic|original/i);
  assert.match(tap, /href="\/demo-lab" prefetch=\{false\} className=\{styles\.tapLink\}/);
});

test("the simulated tap is operable by keyboard and announced", () => {
  assert.match(tap, /aria-expanded=\{phase === "open"\}/);
  assert.match(tap, /role="status" aria-live="polite"/);
  assert.match(tap, /event\.key === "Escape"/);
  assert.match(tap, /triggerRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(tap, /clearTimeout\(timer\.current\)/);
});

test("landing motion is progressive and honours reduced motion", () => {
  assert.match(tap, /useReducedMotion\(\)/);
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /if \(reducedMotion\.matches\) return;/);
  assert.match(motion, /root\.setAttribute\("data-reveal-ready", ""\)/);
  assert.match(css, /\.landing-root\[data-reveal-ready\]\) \.reveal:not\(\[data-revealed\]\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test("the home offers the account and the business entrances after the demos", () => {
  assert.match(sections, /export function AudienceSection/);
  assert.match(sections, /<Link href="\/me" prefetch=\{false\} className=\{fx\.audiencePrimary\}/);
  assert.match(sections, /<a href=\{loginHref\} className=\{fx\.audienceSecondary\}/);
  assert.match(home, /<DemoLauncherSection locale=\{locale\} \/>\s*<AudienceSection locale=\{locale\} loginHref=\{loginHref\} \/>/);
});
