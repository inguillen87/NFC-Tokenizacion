import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const story = read("src/components/scroll-story.tsx");
const css = read("src/components/scroll-story.module.css");
const home = read("src/app/page.tsx");

test("the scroll story is labelled as sample data and keeps the evidence boundary", () => {
  assert.match(story, /Demo · datos de ejemplo/);
  assert.match(story, /Te dice qué se comprobó y qué no/);
  assert.doesNotMatch(story, /fetch\(|auténtic|authentic|autêntic|garantiz/i);
});

test("the scroll story degrades to a static list under reduced motion", () => {
  assert.match(story, /useReducedMotion\(\)/);
  assert.match(story, /data-static=\{isStatic \|\| undefined\}/);
  assert.match(css, /\.story\[data-static\] \{ height: auto; \}/);
  assert.match(css, /\.story\[data-static\] \.sticky \{ position: relative;/);
  assert.match(css, /\.story\[data-static\] \.viewPassport \{ opacity: 1 !important; \}/);
});

test("the scroll story sits right after the hero and keeps its decoration out of the accessibility tree", () => {
  assert.match(home, /<HeroSection content=\{content\} locale=\{locale\} \/>\s*<ScrollStory locale=\{locale\} \/>/);
  assert.match(story, /className=\{styles\.stage\}[^>]*aria-hidden="true"/);
  assert.match(story, /event\.pointerType !== "mouse"/);
});
