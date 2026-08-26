import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("docs trust layer notes are actionable links to proof and scenario demos", async () => {
  const page = await readFile(new URL("../src/app/docs/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(page, /const trustLayerDocLinks/);
  assert.match(page, /"iota-proof-audit-layer\.md": \{ href: "\/proof\/verify"/);
  assert.match(page, /"polygon-ownership-layer\.md": \{ href: "\/demo-lab\?scenario=polygon-ownership"/);
  assert.match(page, /display: "Proof IOTA"/);
  assert.match(page, /display: "Ownership Polygon"/);
  assert.match(page, /display: "DPP event model"/);
  assert.match(page, /<span>\{target\.display\}<\/span>/);
  assert.doesNotMatch(page, /<span>\{item\}<\/span>/);
  assert.match(page, /"offline-verifier-architecture\.md": \{ href: "\/demo-lab\?scenario=offline-verifier"/);
  assert.match(page, /"dpp-event-model\.md": \{ href: "\/demo-lab\?scenario=dual-proof"/);
  assert.match(page, /href="\/proof\/verify"/);
  assert.match(page, /href="\/demo-lab\?scenario=iota-proof"/);
  assert.match(page, /href="\/demo-lab\?scenario=polygon-ownership"/);
  assert.match(page, /docs-trust-layer-actions/);
  assert.match(page, /docs-trust-layer-action--proof/);
  assert.match(page, /docs-trust-layer-action--iota/);
  assert.match(page, /docs-trust-layer-action--polygon/);
  assert.match(page, /docs-mobile-trust-rail/);
  assert.match(page, /Verify a public hash/);
  assert.match(page, /Audit hash-only evidence/);
  assert.match(page, /Ownership and resale flow/);
  assert.match(page, /Run the guided pilot/);
  assert.match(css, /Docs mobile trust rail/);
  assert.match(css, /\.docs-mobile-trust-rail\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.docs-mobile-trust-rail__item\s*\{[\s\S]*grid-template-columns:\s*2rem minmax\(0,\s*1fr\) auto/);
  assert.match(css, /html\.theme-light \.docs-mobile-trust-rail__item,[\s\S]*rgba\(255,\s*255,\s*255,\s*0\.88\)/);
  assert.match(css, /Docs trust-layer CTA contrast/);
  assert.match(css, /html\.theme-light \.docs-trust-layer-action--iota[\s\S]*color:\s*#3730a3 !important/);
  assert.match(css, /html\.theme-light \.docs-trust-layer-action--polygon[\s\S]*color:\s*#6b21a8 !important/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.docs-trust-layer-actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(page, /cursor-default rounded-full border border-white\/10 bg-slate-900/);
});

test("landing trust layer cards open related proof experiences", async () => {
  const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(sections, /const href = item\.title === "IOTA"/);
  assert.match(sections, /\? "\/proof\/verify"/);
  assert.match(sections, /\? "\/demo-lab\?scenario=polygon-ownership"/);
  assert.match(sections, /\? "\/demo-lab\?scenario=offline-verifier"/);
  assert.match(sections, /item\.title\.includes\("NFC"\)[\s\S]*\? "\/demo-lab\?scenario=nfc-424"/);
  assert.match(sections, /\? "\/demo-lab\?scenario=qr-gs1"/);
  assert.doesNotMatch(sections, /item\.title\.includes\("NFC"\)[\s\S]{0,80}\? "\/demo-lab\?scenario=qr-gs1"/);
  assert.match(sections, /aria-label=\{`\$\{item\.title\}: /);
  assert.match(sections, /TrustLayerMiniSimulation/);
  assert.match(sections, /enterprise-trust-layer-card--phase/);
  assert.match(sections, /enterprise-trust-layer-card--capability/);
  assert.match(sections, /enterprise-trust-layer-card--mobile-sim/);
  assert.match(sections, /const keepMobileSimulation = item\.title\.includes\("NFC"\) \|\| item\.title === "Polygon" \|\| item\.title === "IOTA"/);
  assert.match(css, /\.enterprise-trust-layer-card\s*\{[\s\S]*display:\s*block/);
  assert.match(css, /\.enterprise-trust-layer-card\s*\{[\s\S]*text-decoration:\s*none/);
  assert.match(css, /Trust layers mobile executive pass/);
  assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*\.enterprise-trust-layers__grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.enterprise-trust-layer-card--phase p\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.enterprise-trust-layer-card--capability:not\(\.enterprise-trust-layer-card--mobile-sim\) \.trust-layer-sim\s*\{[\s\S]*display:\s*none/);
});

test("landing hero uses one commercial CTA and one in-page discovery CTA", async () => {
  const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
  const hero = await readFile(new URL("../src/components/hero-scene.tsx", import.meta.url), "utf8");

  assert.match(sections, /href="#como-funciona"[^>]*>[\s\S]*\{secondaryCta\}/);
  assert.doesNotMatch(sections, /href="\/docs"[^>]*>[\s\S]{0,100}\{secondaryCta\}/);
  assert.match(hero, /routeTitle: "RUTA DECLARADA · DEMO"/);
  assert.match(hero, /routeSubtitle: "Recorrido ilustrativo; no prueba custodia"/);
  assert.match(hero, /live: "Simulación"/);
  assert.match(hero, /const routeHeadline = txt\.routeTitle === "Declared demo route"/);
  assert.match(hero, /const evidenceCopy = routeEvidenceSentenceFromTitle\(txt\.routeTitle\)/);
  assert.match(hero, /Escenario ilustrativo; sin evidencia de tap físico ni custodia/);
  assert.doesNotMatch(hero, /routeTitle: "RUTA VIVA"/);
  assert.doesNotMatch(hero, /RUTA DEMO VERIFICADA|Audited case|Caso auditado|demo custody \+ physical tap/);
  assert.doesNotMatch(hero, /const routeLabel = isEnglish \? "Active route"/);
});

test("home mega navigation exposes product depth without duplicating a technical hub", async () => {
  const [page, navigation, css] = await Promise.all([
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/marketing-mega-nav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/marketing-mega-nav.module.css", import.meta.url), "utf8"),
  ]);

  for (const group of ["solutions", "industries", "platform", "resources"]) {
    assert.match(navigation, new RegExp(`id: "${group}"`));
  }
  assert.doesNotMatch(navigation, /id: "plans"/);
  assert.match(navigation, /label: "Verify public evidence"[\s\S]*href: "\/proof\/verify"/);
  assert.match(navigation, /label: "NFC security"[\s\S]*href: "\/sun"/);
  assert.match(navigation, /href: "\/offline"/);
  assert.match(navigation, /label: "Documentation"[\s\S]*href: "\/docs"/);
  assert.match(navigation, /label: "SDK and APIs"[\s\S]*href: "\/sdk"/);
  assert.doesNotMatch(page, /OfflineFieldOperationsSection|BrandSynergySimulator|DemoRequestSection|offline-field-operations|brand-synergy/);
  assert.ok((navigation.match(/copy\.groups\.map\(\(group/g) ?? []).length >= 2, "desktop and mobile must share the same groups");
  assert.match(navigation, /label: "Plans and pilots"[\s\S]*href: "\/pricing"/);
  assert.doesNotMatch(navigation, /className=\{styles\.navDirectLink\}/);
  assert.match(navigation, /role="dialog" aria-modal="true"/);
  assert.match(css, /\.navGroupButton,[\s\S]*min-height: 2\.65rem/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(`${page}\n${navigation}`, /landing-mobile-action-dock|nexid-quick-hub-card/);
});

test("landing hero exposes two business actions and one institutional video", async () => {
  const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  const mobileActionsIndex = sections.indexOf("landing-mobile-hero-actions");
  const videoIndex = sections.indexOf("<InstitutionalVideoPanel");

  assert.ok(mobileActionsIndex > -1, "expected mobile hero actions");
  assert.ok(videoIndex > -1, "expected institutional video");
  assert.ok(mobileActionsIndex > videoIndex, "mobile actions should appear after the institutional video");
  assert.match(sections, /<InstitutionalVideoPanel[\s\S]*hero-post-video-actions/);
  assert.doesNotMatch(sections, /<HeroScene|const heroStats = \[/);
  assert.match(sections, /href="\/\?contact=demo#contact-modal" className="landing-mobile-hero-actions__primary"/);
  assert.match(sections, /href="#como-funciona" className="landing-mobile-hero-actions__secondary"/);
  assert.doesNotMatch(sections, /landing-mobile-hero-actions[\s\S]{0,800}href="\/(?:proof\/verify|pricing|docs)"/);
  assert.doesNotMatch(sections, /mobileDocsCta|landing-mobile-hero-actions__muted/);
  assert.match(css, /\.landing-mobile-hero-actions a\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(css, /\.landing-mobile-hero-actions__primary\s*\{[\s\S]*background:\s*linear-gradient\(135deg,\s*#22d3ee,\s*#14b8a6\)/);
  assert.match(css, /html\.theme-light \.landing-mobile-hero-actions__secondary,[\s\S]*color:\s*#0f172a !important/);
});

test("docs code console wraps long environment and hash lines on mobile", async () => {
  const consoleComponent = await readFile(new URL("../src/app/docs/docs-integration-console.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(consoleComponent, /className="docs-code-pre/);
  assert.match(consoleComponent, /className="docs-code-line"/);
  assert.match(consoleComponent, /className="docs-code-line-content"/);
  assert.doesNotMatch(consoleComponent, /min-w-\[680px\]/);
  assert.match(css, /\.docs-code-pre\s*\{[\s\S]*min-width:\s*680px/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*\.docs-code-pane\s*\{[\s\S]*overflow-x:\s*hidden !important/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*\.docs-code-pre\s*\{[\s\S]*min-width:\s*0 !important[\s\S]*white-space:\s*pre-wrap[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.docs-code-line-content,[\s\S]*\.docs-code-line-content span\s*\{[\s\S]*word-break:\s*break-word/);
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
  assert.match(sdk, /className="sdk-brand-lockup"/);
  assert.match(sdk, /className="sdk-brand-badge"/);
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
  assert.match(css, /\.sdk-brand-link > \.sdk-brand-badge\s*\{[\s\S]*border:\s*1px solid rgba\(34,\s*211,\s*238,\s*0\.4\)/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.sdk-brand-link \.brand-mark\s*\{[\s\S]*display:\s*inline-flex !important/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.sdk-brand-link \.brand-wordmark-svg\s*\{[\s\S]*width:\s*5\.35rem !important/);
  assert.match(css, /html\.theme-light \.sdk-hero-actions \.ui-btn--secondary,[\s\S]*color:\s*#0f172a !important/);
  assert.doesNotMatch(css, /\.sdk-brand-link span,[\s\S]*\.sdk-api-status/);
  assert.match(css, /\.sdk-theme-toggle \.theme-toggle span:not\(\.theme-toggle__glyph\)\s*\{[\s\S]*text-overflow:\s*ellipsis/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.sdk-theme-toggle\s*\{[\s\S]*grid-column:\s*2 !important/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.sdk-mobile-primary-action\s*\{[\s\S]*grid-row:\s*1 !important/);
  assert.match(css, /\.sdk-proof-hero-system \.sdk-global-hero-globe\s*\{[\s\S]*min-height:\s*clamp\(17\.5rem,\s*70vw,\s*22rem\) !important/);
  assert.match(css, /\.sdk-proof-live-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(6\.2rem,\s*0\.86fr\) minmax\(0,\s*1fr\) !important/);
  assert.match(css, /\.sdk-proof-phone small\s*\{[\s\S]*display:\s*none !important/);
  assert.match(finalSdkPass, /\.sdk-trust-rail span\s*\{[\s\S]*display:\s*-webkit-box !important/);
  assert.doesNotMatch(finalSdkPass, /display:\s*none !important/);
});
