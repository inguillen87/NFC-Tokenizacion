import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const [home, content, journey, visuals, ...packagingAssets] = await Promise.all([
  readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/landing-content.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/simple-trust-industry-journey.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/simple-trust-step-visual.tsx", import.meta.url), "utf8"),
  stat(new URL("../public/landing/connected-journey/packaging-journey-01.webp", import.meta.url)),
  stat(new URL("../public/landing/connected-journey/packaging-journey-02.webp", import.meta.url)),
  stat(new URL("../public/landing/connected-journey/packaging-journey-03.webp", import.meta.url)),
]);

test("the home separates the editorial hero and audience actions from the participant details", () => {
  assert.match(home, /aria-labelledby="home-title"/);
  assert.match(home, /id="home-consumers"/);
  assert.match(home, /id="home-brands"/);
  assert.match(home, /<details className=\{styles\.participants\}/);
  assert.match(home, /href="\/me" prefetch=\{false\}/);
  assert.doesNotMatch(home, /HeroImmersiveSignal|data-hero-presentation="immersive"/);
  assert.match(journey, /activeIndustry === "bottles" && \([\s\S]*?data-demo-entry="valle-secreto"/);
});

test("product evidence stays attributed and the three-step section owns the explanation", () => {
  assert.match(content, /origen y los servicios que publica la marca/);
  assert.match(home, /Cómo funciona/);
  assert.match(home, /recorré los tres pasos de un producto/);
  assert.doesNotMatch(home, /conversión|funnel|recompra/i);
});

test("packaging is the visible industry and uses the sober Aurora identity assets", () => {
  assert.match(journey, /label: "Packaging"/);
  assert.doesNotMatch(journey, /label: "(?:Perfumería|Perfumaria|Perfumery)"/);
  assert.match(journey, /Estuche Aurora/);
  assert.match(visuals, /productId: "estuche-aurora"/);
  assert.match(visuals, /photoBase: "estuche-aurora-packaging"/);
  assert.equal(packagingAssets.length, 3);
  for (const asset of packagingAssets) {
    assert.ok(asset.size > 20_000, "reviewed packaging artwork must not collapse into a placeholder");
    assert.ok(asset.size < 100_000, "reviewed packaging artwork must remain web-sized");
  }
});
