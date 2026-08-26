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
    assert.ok(body.trim().split(/\s+/).length <= 36, "hero body must stay scannable");
    assert.doesNotMatch(body, /SUN|tenant|replay|hash-only|TagTamper|custod|\bTT\b/i);
    assert.doesNotMatch(body, /physical product|producto físico|produto físico/i);
  }
  assert.match(heroBodies[0], /medís qué funciona en cada piloto/i);
  assert.match(heroBodies[1], /mede o que funciona em cada piloto/i);
  assert.match(heroBodies[2], /measure what works in each pilot/i);
});

test("SimpleTrustFlow is three plain-language steps, one action and one physical-limit note", async () => {
  const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
  const flow = sliceBetween(sections, "export function SimpleTrustFlowSection", "export function CommercialValueSection");

  assert.equal((flow.match(/\{\s*label:/g) ?? []).length, 9, "each of the three locales must expose exactly three steps");
  assert.match(flow, /copy\.steps\.map/);
  assert.equal((flow.match(/<Link href=/g) ?? []).length, 1, "the compact flow must have one primary action");
  assert.match(flow, /<Link href="\/demo-lab(?:\?[^\"]*)?"/);
  assert.doesNotMatch(flow, /href="\/sun"|audiences:|rubros:|claimTitle:|claimBody:|NFT|tenant|replay|SUN|\bTT\b|custod/i);
  assert.doesNotMatch(flow, /md:grid-cols-4/);
  assert.match(flow, /\["discover", "signal", "aftercare"\]/);
  assert.match(flow, /<SimpleTrustFlowMotion id="simple-trust-rail" ariaLabel=\{copy\.railLabel\}>/);
  assert.match(flow, /<HorizontalRailControls[\s\S]*railId="simple-trust-rail"/);
  assert.match(flow, /<SimpleTrustStepVisual kind=\{visualKinds\[index\] \?\? "discover"\} locale=\{locale\} \/>/);

  assert.match(flow, /validar también el producto físico[^.]{0,80}controles específicos/i);
  assert.match(flow, /validar também o produto físico[^.]{0,80}controles específicos/i);
  assert.match(flow, /validate the physical product[^.]{0,80}specific controls/i);
  assert.match(flow, /id="como-funciona"/);
});

test("CommercialValue restores concise business substance without technical density", async () => {
  const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
  const value = sliceBetween(sections, "export function CommercialValueSection", "function TrustLayerMiniSimulation");

  assert.match(value, /Más valor, sin sumar complejidad/);
  assert.match(value, /Mais valor, sem mais complexidade/);
  assert.match(value, /More value, without more complexity/);
  assert.equal((value.match(/icon: (?:PackageCheck|BadgeCheck|RadioTower)/g) ?? []).length, 9);
  assert.match(value, /id="commercial-value-rail"/);
  assert.match(value, /<HorizontalRailControls[\s\S]*railId="commercial-value-rail"/);
  assert.doesNotMatch(value, /SUN|tenant|replay|hash-only|TagTamper|custod|\bTT\b/i);
});
