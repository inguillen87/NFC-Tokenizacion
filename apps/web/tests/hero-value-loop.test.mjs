import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8");
const hero = home.slice(home.indexOf("export function HeroSection"), home.indexOf("export function SimpleTrustFlowSection"));
const styles = await readFile(new URL("../src/components/home-sections.module.css", import.meta.url), "utf8");

test("one local, responsive delivery photograph is prioritised on the landing", async () => {
  const asset = await stat(new URL("../public/landing/parcel-in-hand.webp", import.meta.url));
  assert.ok(asset.size < 90_000);
  assert.equal((hero.match(/<Image/g) ?? []).length, 1);
  assert.match(hero, /src=\{parcelInHand\}/);
  assert.match(hero, /\bfill\b/);
  assert.match(hero, /\bpriority\b/);
  assert.match(hero, /sizes="\(min-width: 768px\) 52vw, 100vw"/);
  assert.match(hero, /alt=\{isEn/);
  assert.doesNotMatch(hero, /aria-hidden="true"[^>]*>\s*<Image/);
});

test("hero content is complete at first paint without an animated client overlay", () => {
  assert.doesNotMatch(hero, /HeroImmersiveSignal|HeroValueLoop|framer-motion|setInterval|IntersectionObserver/);
  assert.doesNotMatch(styles, /sceneBreathe|animation-play-state|\binfinite\b/);
  assert.match(styles, /\.media\s*\{[^}]*min-height: 200px/);
  assert.match(styles, /\.hero a:focus-visible/);
});

test("the first decision offers the general demo and the commercial enquiry", () => {
  assert.equal((hero.match(/<Link\s/g) ?? []).length, 2);
  assert.match(hero, /className=\{styles\.actions\} role="group" aria-label=/);
  assert.match(hero, /href="\/demo-lab"/);
  assert.match(hero, /href="\/\?contact=demo#contact-modal"/);
});
