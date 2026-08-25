import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [page, home, css, helpbot] = await Promise.all([
  read("../src/app/page.tsx"),
  read("../src/components/marketing-v4/nexid-home-v4.tsx"),
  read("../src/components/marketing-v4/nexid-home-v4.module.css"),
  read("../src/components/contextual-helpbot.tsx"),
]);

test("home v4 is a server-first five-section composition with one commercial modal", () => {
  assert.match(page, /<NexidHomeV4/);
  assert.match(page, /<Suspense fallback=\{null\}>[\s\S]*<CommercialContactModal initialLocale=\{locale\}/);
  assert.doesNotMatch(page, /"use client"|HeroSection|HeroScene|BrandSynergySimulator|SalesChatWidget|DemoRequestSection|PwaInstallPrompt/);

  assert.match(home, /data-nexid-home="v4"/);
  assert.equal((home.match(/<section\b/g) ?? []).length, 5);
  assert.equal((home.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((home.match(/<main\b/g) ?? []).length, 1);
  assert.match(home, /id="how-it-works"/);
  assert.match(home, /id="solutions"/);
  assert.match(home, /id="product"/);
  assert.match(home, /id="evidence"/);

  const flow = home.indexOf('id="how-it-works"');
  const roles = home.indexOf('id="solutions"');
  const product = home.indexOf('id="product"');
  const evidence = home.indexOf('id="evidence"');
  assert.ok(flow > -1 && flow < roles && roles < product && product < evidence);
});

test("home v4 keeps the hero light and progressive", () => {
  assert.match(home, /import Image from "next\/image"/);
  assert.equal((home.match(/\bpriority\b/g) ?? []).length, 1);
  assert.match(home, /loading="eager"/);
  assert.match(home, /sizes="\(max-width: 900px\) 100vw, 48vw"/);
  assert.match(home, /copy\.hero\.primary/);
  assert.match(home, /copy\.hero\.secondary/);
  assert.match(home, /href="#evidence"/);
  assert.match(home, /real-seed-packet-pexels\.jpg/);
  assert.match(home, /copy\.hero\.sectors\.map/);
  assert.match(home, /data-guided-case="agro"/);
  assert.match(home, /href="\/demo-lab\?vertical=seeds"/);
  assert.doesNotMatch(home, /wine-secure|Gran Reserva|Malbec/i);
  assert.doesNotMatch(home, /<video|react-globe|three|framer-motion|canvas|BrandSynergy|SalesChat|landing-mobile-action-dock/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|backdrop-filter/);
  assert.match(css, /content-visibility:\s*auto/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("home v4 removes competing assistants but preserves a working sales handoff", () => {
  assert.match(home, /contact=sales&intent=company_rollout#contact-modal/);
  assert.match(helpbot, /pathname === "\/"/);
  assert.match(helpbot, /return null/);
  assert.doesNotMatch(home, /SalesChatWidget|DemoRequestSection|HelpBot/);
});
