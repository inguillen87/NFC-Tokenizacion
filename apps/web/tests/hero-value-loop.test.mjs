import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const [home, signal, css, asset] = await Promise.all([
  readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/hero-immersive-signal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  stat(new URL("../public/landing/nexid-dpp-hero-v3.webp", import.meta.url)),
]);

test("the hero uses the approved NFC artwork without loading an interactive explainer", () => {
  assert.match(home, /import Image from "next\/image"/);
  assert.match(home, /import nexIdDppHero from "\.\.\/\.\.\/public\/landing\/nexid-dpp-hero-v3\.webp"/);
  assert.match(home, /src=\{nexIdDppHero\}/);
  assert.match(home, /placeholder="blur"/);
  assert.match(home, /className="hero-immersive-image"/);
  assert.match(home, /<HeroImmersiveSignal locale=\{locale\} \/>/);
  assert.match(home, /aria-hidden="true"/);
  assert.doesNotMatch(home, /HeroValueLoop|framer-motion|setInterval|IntersectionObserver/);
  assert.ok(asset.size < 90_000, "hero artwork should stay lightweight after visual review");
});

test("the immersive hero motion is short, decorative and reduced-motion safe", () => {
  const start = css.indexOf(".hero-immersive-media");
  const end = css.indexOf("/* Calm three-step landing narrative", start);
  const heroStyles = css.slice(start, end);

  assert.ok(start > -1 && end > start, "immersive hero styles must be present");
  assert.match(heroStyles, /animation:\s*hero-immersive-enter 1\.15s/);
  assert.match(heroStyles, /html:is\(\.theme-dark, \[data-theme="dark"\]\) \.hero-immersive-image \{[\s\S]{0,220}opacity:\s*0\.72[\s\S]{0,160}contrast\(1\.4\)/);
  assert.match(heroStyles, /animation:\s*hero-immersive-pulse 1\.35s ease-out 2 both/);
  assert.match(heroStyles, /hero-immersive-breathe 9s ease-in-out 1\.15s infinite alternate/);
  assert.match(heroStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hero-immersive-ring[\s\S]*animation:\s*none !important/);
  assert.match(heroStyles, /\.hero-immersive-ring \{[\s\S]*display:\s*none/);
  assert.match(signal, /IntersectionObserver/);
  assert.match(signal, /visibilitychange/);
  assert.match(signal, /prefers-reduced-motion: reduce/);
  assert.match(signal, /hero-immersive-packet--return/);
  assert.match(signal, /Etiqueta vinculada/);
  assert.match(signal, /Pasaporte disponible/);
  assert.match(heroStyles, /@keyframes hero-signal-packet-return/);
  assert.match(heroStyles, /@keyframes hero-signal-packet-return-live/);
  assert.match(heroStyles, /data-motion-active="true"/);
});

test("the hero keeps a concise DPP journey and two clear actions", () => {
  assert.match(home, /Identidad por modelo, lote o unidad/);
  assert.match(home, /Información e historia disponibles/);
  assert.match(home, /NFC \+ QR, sin app/);
  assert.doesNotMatch(home, /InstitutionalVideoPanel/);
  assert.match(home, /role="group" aria-label=/);
});
