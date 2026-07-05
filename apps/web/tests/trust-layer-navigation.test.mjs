import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("docs trust layer notes are actionable links to proof and scenario demos", async () => {
  const page = await readFile(new URL("../src/app/docs/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const trustLayerDocLinks/);
  assert.match(page, /"iota-proof-audit-layer\.md": \{ href: "\/proof\/verify"/);
  assert.match(page, /"polygon-ownership-layer\.md": \{ href: "\/demo-lab\?scenario=polygon-ownership"/);
  assert.match(page, /"offline-verifier-architecture\.md": \{ href: "\/demo-lab\?scenario=offline-verifier"/);
  assert.match(page, /"dpp-event-model\.md": \{ href: "\/demo-lab\?scenario=dual-proof"/);
  assert.match(page, /href="\/proof\/verify"/);
  assert.match(page, /href="\/demo-lab\?scenario=iota-proof"/);
  assert.match(page, /href="\/demo-lab\?scenario=polygon-ownership"/);
  assert.doesNotMatch(page, /cursor-default rounded-full border border-white\/10 bg-slate-900/);
});

test("landing trust layer cards open related proof experiences", async () => {
  const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(sections, /const href = item\.title === "IOTA"/);
  assert.match(sections, /\? "\/proof\/verify"/);
  assert.match(sections, /\? "\/demo-lab\?scenario=polygon-ownership"/);
  assert.match(sections, /\? "\/demo-lab\?scenario=offline-verifier"/);
  assert.match(sections, /\? "\/demo-lab\?scenario=qr-gs1"/);
  assert.match(sections, /aria-label=\{`\$\{item\.title\}: /);
  assert.match(sections, /TrustLayerMiniSimulation/);
  assert.match(css, /\.enterprise-trust-layer-card\s*\{[\s\S]*display:\s*block/);
  assert.match(css, /\.enterprise-trust-layer-card\s*\{[\s\S]*text-decoration:\s*none/);
});

test("home quick navigation exposes Proof Verify on desktop, footer and mobile", async () => {
  const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Proof Verify/);
  assert.match(page, /href="\/proof\/verify"/);
  assert.match(page, /Verificar evidencia/);
  assert.match(page, /grid-cols-5/);
  assert.match(page, />Proof<\/Link>/);
  assert.doesNotMatch(page, /grid-cols-4 items-center gap-2 rounded-2xl border border-white\/10 bg-slate-950\/85/);
});

test("pricing mobile comparison is readable without horizontal table scrolling", async () => {
  const pricing = await readFile(new URL("../src/app/pricing/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(pricing, /nexid-pricing-mobile-compare/);
  assert.match(pricing, /aria-label="Feature comparison mobile"/);
  assert.match(pricing, /<dt>\{tierName\}<\/dt>/);
  assert.match(pricing, /<dd>\{value\}<\/dd>/);
  assert.match(pricing, /nexid-pricing-compare[^"]*hidden[^"]*md:block/);
  assert.match(css, /Pricing mobile clarity pass/);
  assert.match(css, /html\.theme-light \.nexid-pricing-page \.nexid-pricing-back[\s\S]*color:\s*#334155 !important/);
  assert.match(css, /\.nexid-pricing-mobile-compare__card div\s*\{[\s\S]*grid-template-columns:\s*minmax\(5\.8rem,\s*0\.42fr\) minmax\(0,\s*1fr\)/);
  assert.match(css, /html\.theme-light \.nexid-pricing-mobile-compare__card dd[\s\S]*color:\s*#475569 !important/);
});
