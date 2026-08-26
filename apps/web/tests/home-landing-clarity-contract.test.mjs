import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start > -1, `missing ${startMarker}`);
  assert.ok(end > start, `missing ${endMarker} after ${startMarker}`);
  return source.slice(start, end);
}

test("home hero is large, friendly and truthful without becoming a technical dashboard", async () => {
  const [sections, content, css] = await Promise.all([
    readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/landing-content.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  const hero = sliceBetween(sections, "export function HeroSection", "export function SimpleTrustFlowSection");
  const h1Class = hero.match(/<h1 className="([^"]+)"/)?.[1];

  assert.ok(h1Class, "hero H1 must keep an explicit responsive type scale");
  const remSizes = [...h1Class.matchAll(/(\d+(?:\.\d+)?)rem/g)].map((match) => Number(match[1]));
  assert.ok(remSizes.length > 0, "hero H1 must expose auditable rem-based responsive sizes");
  assert.ok(Math.max(...remSizes) >= 4, "desktop hero H1 must reach at least 4rem");
  assert.match(css, /\.landing-hero-section h1 \{[\s\S]{0,260}font-size:\s*clamp\(2\.85rem, 4\.5vw, 4\.25rem\) !important/);
  assert.match(css, /\.landing-hero-section \.hero-subtitle \{[\s\S]{0,260}font-size:\s*clamp\(1rem, 1\.25vw, 1\.15rem\) !important/);
  assert.match(hero, /<InstitutionalVideoPanel locale=\{locale\} variant="landing" initialTheme=\{initialTheme\} \/>/);
  assert.doesNotMatch(hero, /HeroScene|heroStats|nexid-hero-atlas|nexid-hero-board/);

  const heroBodies = [...content.matchAll(/hero:\s*\{[\s\S]*?\bbody:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(heroBodies.length, 3, "Spanish, Portuguese and English need friendly hero copy");
  for (const body of heroBodies) {
    assert.ok(body.trim().split(/\s+/).length <= 55, "hero body must stay scannable");
    assert.doesNotMatch(body, /SUN|tenant|replay|hash-only|TagTamper|custod|\bTT\b/i);
  }
  assert.match(heroBodies[0], /autenticidad[^.]{0,80}producto físico[^.]{0,80}controles adicionales/i);
  assert.match(heroBodies[1], /autenticidade[^.]{0,80}produto físico[^.]{0,80}controles adicionais/i);
  assert.match(heroBodies[2], /physical product authenticity[^.]{0,80}additional checks/i);
});

test("SimpleTrustFlow is three plain-language steps, one action and one physical-limit note", async () => {
  const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
  const flow = sliceBetween(sections, "export function SimpleTrustFlowSection", "function TrustLayerMiniSimulation");

  assert.equal((flow.match(/\{\s*label:/g) ?? []).length, 9, "each of the three locales must expose exactly three steps");
  assert.match(flow, /copy\.steps\.map/);
  assert.equal((flow.match(/<Link href=/g) ?? []).length, 1, "the compact flow must have one primary action");
  assert.match(flow, /<Link href="\/demo-lab(?:\?[^\"]*)?"/);
  assert.doesNotMatch(flow, /href="\/sun"|audiences:|rubros:|claimTitle:|claimBody:|NFT|tenant|replay|SUN|\bTT\b|custod/i);
  assert.doesNotMatch(flow, /md:grid-cols-4/);
  assert.match(flow, /\["discover", "signal", "aftercare"\]/);
  assert.match(flow, /<SimpleTrustFlowMotion>/);
  assert.match(flow, /<SimpleTrustStepVisual kind=\{visualKinds\[index\] \?\? "discover"\} locale=\{locale\} \/>/);

  assert.match(flow, /autenticidad[^.]{0,80}producto físico[^.]{0,80}requiere controles adicionales/i);
  assert.match(flow, /autenticidade[^.]{0,80}produto físico[^.]{0,80}exige controles adicionais/i);
  assert.match(flow, /physical product authenticity[^.]{0,80}requires additional checks/i);
});
