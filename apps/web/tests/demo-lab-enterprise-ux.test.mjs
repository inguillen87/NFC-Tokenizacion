import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("demo lab theme toggle changes theme client-side before falling back to SSR", async () => {
  const source = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-hub-theme.tsx", import.meta.url), "utf8");

  assert.match(source, /function applyTheme\(theme: Theme\)/);
  assert.match(source, /function syncDemoLabRootTheme\(theme: Theme\)/);
  assert.match(source, /localStorage\.getItem\("theme"\)/);
  assert.match(source, /localStorage\.setItem\("theme", theme\)/);
  assert.match(source, /querySelectorAll<HTMLElement>\("\.demo-lab-hub-root"\)/);
  assert.match(source, /querySelectorAll<HTMLElement>\("\.demo-lab-fullscreen-root"\)/);
  assert.match(source, /classList\.toggle\("demo-lab-hub-root--light", theme === "light"\)/);
  assert.match(source, /classList\.toggle\("demo-lab-fullscreen-root--light", theme === "light"\)/);
  assert.match(source, /onClick=\{onToggle\}/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /applyTheme\(next\)/);
});

test("web pwa fallback stays production-gated and mobile-safe", async () => {
  const setup = await readFile(new URL("../src/components/pwa-setup.tsx", import.meta.url), "utf8");
  const sw = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(setup, /process\.env\.NEXT_PUBLIC_ENABLE_PWA === "true"/);
  assert.match(setup, /process\.env\.NODE_ENV === "production"/);
  assert.match(sw, /\*\{box-sizing:border-box\}/);
  assert.match(sw, /overflow-x:hidden/);
  assert.match(sw, /width:min\(34rem,100%\)/);
  assert.match(sw, /font-size:clamp\(1\.75rem,9vw,2\.5rem\)/);
});

test("demo lab mobile wizard shows four steps without horizontal scrolling", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-steps\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.doesNotMatch(css, /demo-lab-fullscreen-root \.demo-lab-wizard-steps\s*\{[^}]*display:\s*flex/s);
  assert.doesNotMatch(css, /demo-lab-fullscreen-root \.demo-lab-wizard-steps\s*\{[^}]*overflow-x:\s*auto/s);
  assert.doesNotMatch(css, /dueÃ|dueÃƒ|Ã±o/);
});

test("demo lab fullscreen mobile keeps CTAs inside viewport and light mode visible", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");

  assert.match(css, /Demo Lab enterprise closure/);
  assert.match(page, /const requestedThemeParam = firstParam\(params\.theme\)/);
  assert.match(page, /const cookieTheme = \(await cookies\(\)\)\.get\("theme"\)\?\.value/);
  assert.match(page, /requestedThemeParam === "light" \|\| requestedThemeParam === "dark"/);
  assert.match(page, /demo-lab-fullscreen-root--light/);
  assert.match(css, /html\.theme-light \.demo-lab-fullscreen-stage[\s\S]*#f8fbff/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-fullscreen-stage[\s\S]*#f8fbff/);
  assert.match(css, /html\.theme-light \.demo-lab-fullscreen-stage \.demo-lab-studio[\s\S]*rgba\(255,\s*255,\s*255,\s*0\.98\)/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-wizard-nav/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-mode-bar--compact/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-mode-tab\.is-active/);
  assert.match(css, /demo-lab-fullscreen-root--light \.demo-lab-wizard-brief__proof span[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.86\)/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-infobar__right\s*\{[\s\S]*grid-template-columns:\s*2\.65rem minmax\(0,\s*1fr\)/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-infobar__cta\s*\{[\s\S]*width:\s*100%/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-cta-full\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-cta-short\s*\{[\s\S]*display:\s*inline/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-nav\s*\{[\s\S]*width:\s*calc\(100% - 1\.24rem\)/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-scene\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-scene > \*\s*\{[\s\S]*max-width:\s*100%/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-verticals\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-vertical-btn\s*\{[\s\S]*min-width:\s*0/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-brief__copy strong\s*\{[\s\S]*font-size:\s*1\.05rem/);
  assert.match(css, /demo-lab-fullscreen-stage,\s*\n\s*\.demo-lab-fullscreen-stage \.demo-lab-studio\s*\{[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /demo-lab-fullscreen-root \.demo-lab-wizard-actions\s*\{[\s\S]*grid-template-columns:\s*2\.45rem minmax\(0,\s*1fr\)/);
  assert.match(page, /demo-lab-cta-full/);
  assert.match(page, /demo-lab-cta-short/);
  assert.match(client, /demo-lab-cta-full/);
  assert.match(client, /demo-lab-cta-short/);
  assert.match(css, /Demo Lab mobile cockpit/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.demo-lab-fullscreen-root \.demo-lab-context-strip\s*\{[\s\S]*display:\s*none !important/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.demo-lab-fullscreen-root \.demo-lab-mode-bar--compact > div:last-child\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.demo-lab-fullscreen-root \.demo-lab-shell\s*\{[\s\S]*padding-top:\s*0\.55rem/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.demo-lab-fullscreen-root \.demo-lab-wizard-gano-lede\s*\{[\s\S]*-webkit-line-clamp:\s*2/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.demo-lab-fullscreen-root \.demo-lab-wizard-gano-grid\s*\{[\s\S]*margin-top:\s*0\.72rem/);
});

test("demo lab hub keeps C-level contrast across cards, filters and theme controls", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");

  assert.match(css, /Demo Lab hub C-level contrast closure/);
  assert.match(page, /demo-lab-hub-root--light/);
  assert.match(page, /demo-lab-hub-card__icon/);
  assert.match(page, /demo-lab-hub-pill__icon/);
  assert.match(page, /demo-lab-hub-card-grid/);
  assert.match(page, /demo-lab-hub-vertical-grid/);
  assert.match(page, /HUB_EXECUTIVE_PATHS/);
  assert.match(page, /HUB_PROOF_STACK/);
  assert.match(page, /demo-lab-hub-executive-path/);
  assert.match(page, /demo-lab-hub-proof-stack/);
  assert.match(page, /Ruta enterprise/);
  assert.match(page, /IOTA \/ hash-only/);
  assert.match(page, /Polygon ready/);
  assert.match(page, /API \/ webhooks/);
  assert.match(page, /href:\s*"\/sdk"/);
  assert.match(page, /CRM, recall, garantia, loyalty o webhook/);
  assert.match(page, /volvés al Hub desde la barra superior/);
  assert.match(page, /const cookieTheme = \(await cookies\(\)\)\.get\("theme"\)\?\.value/);
  assert.match(page, /La demo separa negocio, privacidad y blockchain/);
  assert.match(page, /nexID opera la identidad del producto/);
  assert.match(page, /Recibo publico hash-only/);
  assert.match(page, /Propiedad, garantia y reventa/);
  assert.match(page, /Conexion con ERP, CRM y portal/);
  assert.match(page, /href="\/proof\/verify"/);
  assert.match(page, /href:\s*"\/demo-lab\?scenario=qr-gs1"/);
  assert.match(page, /href:\s*"\/demo-lab\?scenario=polygon-ownership"/);
  assert.match(css, /\.demo-lab-hub-root--light\s*\{[\s\S]*color:\s*#0f172a !important/);
  assert.match(css, /\.demo-lab-hub-root \.demo-lab-hub-card__icon,[\s\S]*color:\s*#bae6fd !important/);
  assert.match(css, /\.demo-lab-hub-root--light \.demo-lab-hub-card__icon,[\s\S]*color:\s*#075985 !important/);
  assert.match(css, /\.demo-lab-hub-root \.demo-lab-hub-card h3,[\s\S]*color:\s*#f8fafc !important/);
  assert.match(css, /\.demo-lab-hub-root \.demo-lab-hub-card p,[\s\S]*color:\s*#dbeafe !important/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-root \.demo-lab-hub-card h3,[\s\S]*color:\s*#0f172a !important/);
  assert.match(css, /\.demo-lab-hub-root--light \.demo-lab-hub-card h3,[\s\S]*color:\s*#0f172a !important/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-root \.demo-lab-hub-card p,[\s\S]*color:\s*#334155 !important/);
  assert.match(css, /\.demo-lab-hub-root--light \.demo-lab-hub-card p,[\s\S]*color:\s*#334155 !important/);
  assert.match(css, /\.demo-lab-hub-root \.theme-toggle,[\s\S]*\.demo-lab-hub-nav a\[href="\/proof\/verify"\]/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-root \.theme-toggle,[\s\S]*color:\s*#075985 !important/);
  assert.match(css, /\.demo-lab-hub-root--light \.theme-toggle,[\s\S]*color:\s*#075985 !important/);
  assert.match(css, /Demo Lab hub enterprise path/);
  assert.match(css, /\.demo-lab-hub-title-gradient\s*\{[\s\S]*background-image:\s*linear-gradient\(90deg,\s*#22d3ee,\s*#f8fafc/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-title-gradient,[\s\S]*\.demo-lab-hub-root--light \.demo-lab-hub-title-gradient/);
  assert.match(css, /\.demo-lab-hub-root a:focus-visible,[\s\S]*outline:\s*3px solid rgba\(103,\s*232,\s*249,\s*0\.9\)/);
  assert.match(css, /\.demo-lab-hub-executive-path\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.82fr\)\s*minmax\(0,\s*1\.48fr\)/);
  assert.match(css, /\.demo-lab-hub-executive-path__grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.demo-lab-hub-executive-path__note\s*\{[\s\S]*background:\s*rgba\(8,\s*145,\s*178,\s*0\.12\)/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-executive-path,[\s\S]*\.demo-lab-hub-root--light \.demo-lab-hub-executive-path/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-executive-path__card,[\s\S]*\.demo-lab-hub-root--light \.demo-lab-hub-executive-path__card/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-executive-path__note,[\s\S]*\.demo-lab-hub-root--light \.demo-lab-hub-executive-path__note/);
  assert.match(css, /\.demo-lab-hub-root--light \[class~="text-cyan-100"\],[\s\S]*\.demo-lab-hub-root--light \[class~="text-cyan-400"\]/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.demo-lab-hub-executive-path\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.demo-lab-hub-proof-stack\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.86fr\)\s*minmax\(0,\s*1\.24fr\)/);
  assert.match(css, /\.demo-lab-hub-proof-stack__grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-proof-stack,[\s\S]*\.demo-lab-hub-root--light \.demo-lab-hub-proof-stack/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-proof-stack__head,[\s\S]*\.demo-lab-hub-root--light \.demo-lab-hub-proof-stack__card/);
  assert.match(css, /html\.theme-light \.demo-lab-hub-proof-stack__head strong,[\s\S]*\.demo-lab-hub-root--light \.demo-lab-hub-proof-stack__card strong/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.demo-lab-hub-proof-stack\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("demo lab trust scenario deep links open contextual wizard proof layers", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");

  assert.match(client, /type DemoWizardStep = 0 \| 1 \| 2 \| 3/);
  assert.match(client, /type DemoTrustScenarioStep = \{/);
  assert.match(client, /type DemoTrustScenarioLabels = \{/);
  assert.match(client, /labels: DemoTrustScenarioLabels/);
  assert.match(client, /decisionPath: DemoTrustScenarioStep\[\]/);
  assert.match(client, /businessOutcome: string/);
  assert.match(client, /const DEMO_PUBLIC_PROOF_URL = "\/proof\/verify\?event_hash=/);
  assert.match(client, /function getTrustScenarioInitialStep\(key: DemoTrustScenarioKey \| null\): DemoWizardStep/);
  assert.match(client, /key === "iota-proof" \|\| key === "sensor-evidence" \|\| key === "dual-proof"\) return 2/);
  assert.match(client, /key === "polygon-ownership"\) return 3/);
  assert.match(client, /DemoTrustScenarioContextCard/);
  assert.match(client, /demo-lab-trust-context/);
  assert.match(client, /demo-lab-trust-context__decision/);
  assert.match(client, /demo-lab-trust-context__steps/);
  assert.match(client, /demo-lab-trust-context__outcome/);
  assert.match(client, /demo-lab-trust-switcher/);
  assert.match(client, /<DemoTrustScenarioRail[\s\S]*variant="wizard"/);
  assert.match(client, /window\.history\.replaceState\(null, "", href\)/);
  assert.match(client, /setTrustScenario\(null\)/);
  assert.match(client, /IOTA prueba evidencia logistica/);
  assert.match(client, /Evento canonico/);
  assert.match(client, /Polygon es el certificado de propiedad/);
  assert.match(client, /Owner record/);
  assert.match(client, /context\.labels\.publicProof/);
  assert.match(client, /context\.labels\.businessOutcome/);
  assert.doesNotMatch(client, /<span>Publico verificable<\/span>/);
  assert.match(css, /\.demo-lab-trust-context\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.15fr\)\s*minmax\(18rem,\s*0\.85fr\)/);
  assert.match(css, /\.demo-lab-trust-context__decision,[\s\S]*\.demo-lab-trust-context__outcome\s*\{[\s\S]*border:\s*1px solid rgba\(103,\s*232,\s*249,\s*0\.16\)/);
  assert.match(css, /\.demo-lab-trust-context__step\s*\{[\s\S]*grid-template-columns:\s*2rem minmax\(0,\s*1fr\)/);
  assert.match(css, /\.demo-lab-trust-context__outcome\s*\{[\s\S]*radial-gradient\(circle at 100% 0%/);
  assert.match(css, /\.demo-lab-trust-switcher > summary\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(css, /\.demo-lab-trust-scenarios--wizard \.demo-lab-trust-scenario\s*\{[\s\S]*min-height:\s*124px/);
  assert.match(css, /html\.theme-light \.demo-lab-trust-context,[\s\S]*html\[data-theme="light"\] \.demo-lab-trust-switcher/);
  assert.match(css, /html\.theme-light \.demo-lab-trust-context__step strong,[\s\S]*html\[data-theme="light"\] \.demo-lab-trust-context__outcome strong/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*\.demo-lab-trust-context__primary,[\s\S]*width:\s*100%/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*\.demo-lab-trust-context__step\s*\{[\s\S]*grid-template-columns:\s*1\.8rem minmax\(0,\s*1fr\)/);
});

test("demo lab wizard explains proof and business outcome for enterprise buyers", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");

  assert.match(client, /const traceProofCards = locale === "en"/);
  assert.match(client, /const executiveOutcomeCards = locale === "en"/);
  assert.match(client, /What this map proves/);
  assert.match(client, /Recibo publico hash-only/);
  assert.match(client, /Board-ready outcome from one verified tap/);
  assert.match(client, /Resultado ejecutivo de un tap verificado/);
  assert.match(client, /nexID keeps private data, IOTA can anchor audit receipts, and Polygon is reserved/);
  assert.match(client, /href=\{DEMO_PUBLIC_PROOF_URL\}/);
  assert.match(client, /demo-lab-wizard-proof-decoder/);
  assert.match(client, /demo-lab-wizard-proof-grid/);
  assert.match(client, /demo-lab-wizard-map-proof-strip/);
  assert.match(client, /Mapa para personas\. Recibo hash para auditoria\. Datos privados quedan en nexID/);
  assert.match(client, /demo-lab-wizard-gano-lede/);
  assert.match(client, /executiveOutcomeCards\.map/);
  assert.match(css, /\.demo-lab-wizard-proof-decoder\s*\{[\s\S]*grid/);
  assert.match(css, /\.demo-lab-wizard-proof-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.demo-lab-wizard-proof-link\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(css, /\.demo-lab-wizard-map-container\s*\{[\s\S]*position:\s*relative/);
  assert.match(css, /\.demo-lab-wizard-map-proof-strip\s*\{[\s\S]*position:\s*absolute/);
  assert.match(css, /html\.theme-light \.demo-lab-wizard-proof-decoder,[\s\S]*html\[data-theme="light"\] \.demo-lab-wizard-proof-card/);
  assert.match(css, /html\.theme-light \.demo-lab-wizard-map-proof-strip,[\s\S]*html\[data-theme="light"\] \.demo-lab-wizard-map-proof-strip/);
  assert.match(css, /\.demo-lab-fullscreen-root--light \.demo-lab-wizard-proof-decoder,[\s\S]*\.demo-lab-fullscreen-root--light \.demo-lab-wizard-proof-card/);
  assert.match(css, /\.demo-lab-fullscreen-root--light \.demo-lab-wizard-map-proof-strip/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.demo-lab-fullscreen-root \.demo-lab-wizard-proof-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.demo-lab-fullscreen-root \.demo-lab-wizard-map-proof-strip\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.demo-lab-fullscreen-root \.demo-lab-wizard-proof-decoder/);
});

test("landing hero stats use real configured fields and no old cost placeholder", async () => {
  const hero = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
  const i18n = await readFile(new URL("../../../packages/config/src/i18n.ts", import.meta.url), "utf8");

  assert.match(hero, /const heroStats = \[/);
  assert.match(hero, /stats\?\.latencyDelta/);
  assert.doesNotMatch(hero, /stats\.scanSpeed|stats\.uptime|stats\.crypto|stats\.global/);
  assert.doesNotMatch(i18n, /10k (botellas|garrafas|bottles) × USD 0\.02/);
  assert.match(i18n, /Sin app para el comprador/);
  assert.match(i18n, /No buyer app required/);
});

test("brand synergy simulator is readable, auto-cycles and stays mobile-safe", async () => {
  const source = await readFile(new URL("../src/components/brand-synergy-simulator.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /Ã|Â|â|ð/);
  assert.match(source, /window\.setInterval\(\(\) => \{/);
  assert.match(source, /\},\s*4000\)/);
  assert.match(source, /setIsPaused\(true\)/);
  assert.match(source, /brand-synergy-proof-grid/);
  assert.match(source, /brand-synergy-live-panel/);
  assert.match(source, /brand-synergy-outcome-grid/);
  assert.match(source, /hash-only/);
  assert.match(source, /Consent and PII stay inside nexID/);
  assert.match(css, /brand-synergy-proof-grid > div/);
  assert.match(css, /brand-synergy-live-panel\s*\{/);
  assert.match(css, /brand-synergy-outcome-grid > article/);
  assert.match(css, /html\.theme-light \.brand-synergy-live-panel/);
  assert.match(css, /brand-synergy-flow\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /brand-synergy-scenario-pill\s*\{[\s\S]*flex:\s*1 1 100%/);
  assert.match(css, /brand-synergy-outcome-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});
