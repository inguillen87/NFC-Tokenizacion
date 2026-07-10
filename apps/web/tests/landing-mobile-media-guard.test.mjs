import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("legacy public landing route redirects to the canonical home landing", async () => {
  const legacy = await readFile(new URL("../src/app/(public)/landing/page.tsx", import.meta.url), "utf8");

  assert.match(legacy, /from "next\/navigation"/);
  assert.match(legacy, /function buildCanonicalLandingHref/);
  assert.match(legacy, /redirect\(buildCanonicalLandingHref\(params\)\)/);
  assert.match(legacy, /query\.append\(key, entry\)/);
  assert.doesNotMatch(legacy, /bg-neutral-950/);
  assert.doesNotMatch(legacy, /Tus productos/);
});

test("landing mobile media guard wins after hero closures", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  const heroClosure = css.indexOf("Absolute enterprise hero closure v2");
  const custodyClosure = css.indexOf("Mobile custody atlas closure");
  const mobileGuard = css.indexOf("Landing mobile media containment closure");
  const demoLabPass = css.indexOf("Demo Lab final enterprise pass");

  assert.ok(heroClosure > -1, "expected the final hero closure to exist");
  assert.ok(custodyClosure > -1, "expected the custody mobile closure to exist");
  assert.ok(mobileGuard > heroClosure, "mobile guard must override final hero sizing");
  assert.ok(mobileGuard > custodyClosure, "mobile guard must override custody atlas sizing");
  assert.ok(demoLabPass > mobileGuard, "mobile guard should stay in the landing section before demo lab");

  const guard = css.slice(mobileGuard, demoLabPass);

  assert.match(guard, /@media \(max-width:\s*720px\)/);
  assert.match(guard, /body \.landing-root \.landing-hero-section \.hero-demo-shell,[\s\S]*overflow-x:\s*clip !important/);
  assert.match(guard, /body \.landing-root \.landing-hero-section \.nexid-hero-board\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) !important/);
  assert.match(guard, /body \.landing-root \.landing-hero-section \.nexid-hero-atlas-card__map\s*\{[\s\S]*height:\s*clamp\(13\.75rem,\s*58vw,\s*16\.75rem\) !important/);
  assert.match(guard, /body \.landing-root \.landing-hero-section \.nexid-hero-atlas-card__viewport\[data-zoom-level="2"\]\s*\{[\s\S]*transform:\s*scale\(1\.08\) !important/);
  assert.match(guard, /body \.landing-root \.landing-hero-section \.nexid-hero-atlas-card__ops\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\) !important/);
  assert.match(guard, /body \.landing-root \.landing-hero-section \.nexid-hero-product-card__media\s*\{[\s\S]*contain:\s*layout paint !important/);
  assert.match(guard, /body \.landing-root \.landing-hero-section \.nexid-hero-product-card__photo,[\s\S]*transform:\s*none !important/);
  assert.match(guard, /nexid-hero-product-card__photo\.nexid-premium-image--dark/);
  assert.match(guard, /nexid-hero-product-card__photo\.nexid-premium-image--light/);
  assert.match(guard, /body \.landing-root \.institutional-video-panel--landing\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) !important/);
  assert.match(guard, /body \.landing-root \.institutional-video-panel--landing \.institutional-video-frame\s*\{[\s\S]*min-height:\s*clamp\(10\.5rem,\s*50vw,\s*13\.5rem\) !important/);
  assert.doesNotMatch(guard, /scale\(1\.12\)/);
});
