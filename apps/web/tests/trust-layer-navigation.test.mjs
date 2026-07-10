import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("docs trust layer notes are actionable links to proof and scenario demos", async () => {
  const page = await readFile(new URL("../src/app/docs/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(page, /const trustLayerDocLinks/);
  assert.match(page, /"iota-proof-audit-layer\.md": \{ href: "\/proof\/verify"/);
  assert.match(page, /"polygon-ownership-layer\.md": \{ href: "\/demo-lab\?scenario=polygon-ownership"/);
  assert.match(page, /"offline-verifier-architecture\.md": \{ href: "\/demo-lab\?scenario=offline-verifier"/);
  assert.match(page, /"dpp-event-model\.md": \{ href: "\/demo-lab\?scenario=dual-proof"/);
  assert.match(page, /href="\/proof\/verify"/);
  assert.match(page, /href="\/demo-lab\?scenario=iota-proof"/);
  assert.match(page, /href="\/demo-lab\?scenario=polygon-ownership"/);
  assert.match(page, /docs-mobile-trust-rail/);
  assert.match(page, /Verify a public hash/);
  assert.match(page, /Audit hash-only evidence/);
  assert.match(page, /Ownership and resale flow/);
  assert.match(page, /Run the guided pilot/);
  assert.match(css, /Docs mobile trust rail/);
  assert.match(css, /\.docs-mobile-trust-rail\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.docs-mobile-trust-rail__item\s*\{[\s\S]*grid-template-columns:\s*2rem minmax\(0,\s*1fr\) auto/);
  assert.match(css, /html\.theme-light \.docs-mobile-trust-rail__item,[\s\S]*rgba\(255,\s*255,\s*255,\s*0\.88\)/);
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

test("sdk mobile hero surfaces the proof system before becoming a long text stack", async () => {
  const sdk = await readFile(new URL("../src/app/sdk/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const finalSdkPass = css.slice(
    css.indexOf("SDK final clarity pass"),
    css.indexOf("/* Demo Lab enterprise discovery"),
  );

  assert.match(sdk, /id="sdk-proof-hero"/);
  assert.match(sdk, /className="sdk-premium-hero"/);
  assert.match(sdk, /Proof Verify & Decoder/);
  assert.match(sdk, /ThemeToggle/);
  assert.match(sdk, /className="sdk-theme-toggle"/);
  assert.match(css, /SDK mobile first-viewport pass/);
  assert.match(css, /SDK final clarity pass/);
  assert.match(css, /Public platform sweep: canonical landing, SDK theme control and readable/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.sdk-premium-copy[\s\S]*display:\s*flex !important/);
  assert.match(css, /\.sdk-premium-copy h1\s*\{[\s\S]*font-size:\s*clamp\(1\.95rem,\s*8\.3vw,\s*2\.28rem\) !important/);
  assert.match(css, /\.sdk-trust-rail\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\) !important/);
  assert.match(css, /\.sdk-trust-rail div\s*\{[\s\S]*background:\s*rgba\(2,\s*8,\s*23,\s*0\.64\) !important/);
  assert.match(css, /html\.theme-light \.sdk-trust-rail div,[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.66\) !important/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.sdk-trust-rail span\s*\{[\s\S]*display:\s*-webkit-box !important/);
  assert.match(css, /html\.theme-light \.sdk-trust-rail span,[\s\S]*color:\s*#475569 !important/);
  assert.match(css, /\.sdk-theme-toggle \.theme-toggle span:not\(\.theme-toggle__glyph\)\s*\{[\s\S]*text-overflow:\s*ellipsis/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.sdk-theme-toggle\s*\{[\s\S]*grid-column:\s*2 !important/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.sdk-mobile-primary-action\s*\{[\s\S]*grid-row:\s*1 !important/);
  assert.match(css, /\.sdk-proof-hero-system \.sdk-global-hero-globe\s*\{[\s\S]*min-height:\s*clamp\(17\.5rem,\s*70vw,\s*22rem\) !important/);
  assert.match(css, /\.sdk-proof-live-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(6\.2rem,\s*0\.86fr\) minmax\(0,\s*1fr\) !important/);
  assert.match(css, /\.sdk-proof-phone small\s*\{[\s\S]*display:\s*none !important/);
  assert.match(finalSdkPass, /\.sdk-trust-rail span\s*\{[\s\S]*display:\s*-webkit-box !important/);
  assert.doesNotMatch(finalSdkPass, /display:\s*none !important/);
});
