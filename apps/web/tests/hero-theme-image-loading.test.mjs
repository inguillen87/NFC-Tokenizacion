import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/hero-scene.tsx", import.meta.url), "utf8");
const imageComponent = source.slice(source.indexOf("function HeroThemeImage"), source.indexOf("function HeroPrimeProduct"));
const themeImageCalls = [...source.matchAll(/<HeroThemeImage[\s\S]*?\/>/g)].map(([call]) => call);

test("hero renders one normal image for the active theme", () => {
  assert.equal((imageComponent.match(/<img\b/g) || []).length, 1);
  assert.match(imageComponent, /src=\{theme === "light" \? lightSrc : darkSrc\}/);
  assert.match(imageComponent, /nexid-premium-image--\$\{theme\}/);
  assert.match(imageComponent, /alt=\{alt\}/);

  assert.doesNotMatch(source, /customElements|attachShadow|shadowRoot/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|heroThemeImageBootstrap/);
  assert.doesNotMatch(source, /createElement/);
  assert.doesNotMatch(source, /<img[^>]+nexid-premium-image--(?:dark|light)/);
});

test("server theme prop initializes state and follows document theme changes", () => {
  assert.match(source, /export function HeroScene\(\{ locale, initialTheme = "light" \}/);
  assert.match(source, /initialTheme\?: HeroTheme/);
  assert.match(source, /useState<HeroTheme>\(initialTheme\)/);
  assert.match(source, /root\.getAttribute\("data-theme"\) === "light"/);
  assert.match(source, /new MutationObserver\(syncTheme\)/);
  assert.match(source, /attributeFilter: \["class", "data-theme"\]/);
  assert.match(source, /return \(\) => observer\.disconnect\(\)/);
});

test("only the primary product image receives LCP priority", () => {
  assert.equal(themeImageCalls.length, 3, "expected product, phone and modal theme images");
  for (const call of themeImageCalls) {
    assert.match(call, /darkSrc=\{asset\.imageUrl\}/);
    assert.match(call, /lightSrc=\{asset\.imageLightUrl\}/);
    assert.match(call, /theme=\{theme\}/);
  }

  const priorityCalls = themeImageCalls.filter((call) => /\n\s+priority\s*\n/.test(call));
  assert.equal(priorityCalls.length, 1);
  assert.match(priorityCalls[0], /nexid-hero-product-card__photo/);
  assert.match(imageComponent, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(imageComponent, /fetchPriority=\{priority \? "high" : undefined\}/);
  assert.doesNotMatch(source, /<img[^>]+loading="eager"/);
});
