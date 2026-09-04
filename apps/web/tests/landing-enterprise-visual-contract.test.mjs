import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const [home, content, signal, journey, visuals, css, ...packagingAssets] = await Promise.all([
  readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/landing-content.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/hero-immersive-signal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/simple-trust-industry-journey.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/simple-trust-step-visual.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  stat(new URL("../public/landing/connected-journey/packaging-journey-01.webp", import.meta.url)),
  stat(new URL("../public/landing/connected-journey/packaging-journey-02.webp", import.meta.url)),
  stat(new URL("../public/landing/connected-journey/packaging-journey-03.webp", import.meta.url)),
]);

test("the home hero is white-first and uses explicit semantic theme surfaces", () => {
  const hero = home.slice(home.indexOf("export function HeroSection"), home.indexOf("export function SimpleTrustFlowSection"));
  const enterpriseHero = css.slice(css.indexOf("/* Enterprise DPP hero:"));

  assert.match(hero, /className="landing-hero-section relative overflow-hidden border-b/);
  assert.doesNotMatch(hero, /bg-slate-950|border-white\/5|text-slate-400|text-white/);
  assert.match(hero, /hero-eyebrow-chip/);
  assert.match(hero, /hero-primary-action/);
  assert.match(hero, /hero-secondary-action/);
  assert.match(hero, /hero-proof-chip/);
  assert.match(enterpriseHero, /\.landing-hero-section \{[\s\S]{0,520}linear-gradient\(180deg, #fbfeff/);
  assert.match(enterpriseHero, /html:is\(\.theme-dark, \[data-theme="dark"\]\) \.landing-hero-section \{[\s\S]{0,520}linear-gradient\(180deg, #04101f/);
  assert.match(enterpriseHero, /html:is\(\.theme-dark, \[data-theme="dark"\]\) \.hero-immersive-image \{[\s\S]{0,180}brightness\(0\.68\)/);
});

test("the hero names both physical anchors and animates a bidirectional multicolor exchange", () => {
  const enterpriseHero = css.slice(css.indexOf("/* Enterprise DPP hero:"));

  assert.match(signal, /data-hero-object="device"/);
  assert.match(signal, /data-hero-object="product"/);
  assert.match(signal, /Celular · Pasaporte Digital/);
  assert.match(signal, /Packaging · NFC/);
  assert.match(signal, /id="hero-signal-spectrum"/);
  assert.match(signal, /data-signal-role="request"/);
  assert.match(signal, /data-signal-role="response"/);
  assert.equal(signal.match(/data-signal-packet=/g)?.length, 4);
  assert.match(enterpriseHero, /@keyframes hero-signal-spectrum-flow/);
  assert.match(enterpriseHero, /data-motion-active="true"[\s\S]{0,180}hero-immersive-link-spectrum/);
  assert.match(enterpriseHero, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hero-immersive-link-spectrum[\s\S]*animation: none !important/);
  assert.match(enterpriseHero, /@media \(min-width: 561px\) and \(max-width: 1200px\)[\s\S]{0,180}hero-immersive-object-label[\s\S]{0,160}display: inline-flex/);
  assert.match(enterpriseHero, /@media \(max-width: 560px\)[\s\S]{0,1400}hero-immersive-object-label--device[\s\S]{0,260}hero-immersive-object-label--product/);
});

test("DPP copy stays concise while the three-step section owns the explanation", () => {
  assert.match(content, /Pasaporte Digital de Producto · Trazabilidad conectada/);
  assert.match(content, /nexID conecta cada producto con su Pasaporte Digital: identidad, información, historia y trazabilidad declaradas/);
  assert.match(home, /Del producto a su pasaporte, en tres momentos/);
  assert.match(home, /seguí un único producto/);
  assert.doesNotMatch(home, /venta|conversión|funnel|recompra/i);
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
