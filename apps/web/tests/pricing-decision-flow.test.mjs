import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("pricing exposes an editable, bounded and truthful decision model", async () => {
  const page = await readFile(new URL("../src/app/pricing/page.tsx", import.meta.url), "utf8");
  const calculator = await readFile(new URL("../src/components/pricing-roi-calculator.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(page, /import \{ PricingRoiCalculator \}/);
  assert.match(page, /<PricingRoiCalculator locale=\{locale\} \/>[\s\S]*nexid-pricing-grid/);
  assert.match(calculator, /type ScenarioKey = "wine" \| "pharma" \| "agro"/);
  assert.match(calculator, /demoScenario: "qr-gs1"/);
  assert.match(calculator, /demoScenario: "nfc-424"/);
  assert.match(calculator, /demoScenario: "sensor-evidence"/);
  assert.match(calculator, /This calculator does not promise savings/);
  assert.match(calculator, /Esta calculadora no promete ahorros/);
  assert.match(calculator, /Planning aid only/);
  assert.match(calculator, /Herramienta de planificacion/);
  assert.match(calculator, /const annualExposure = inputs\.annualUnits \* \(inputs\.incidentRate \/ 100\) \* inputs\.incidentCost/);
  assert.match(calculator, /const addressableValue = annualExposure \* \(inputs\.addressableRate \/ 100\)/);
  assert.match(calculator, /const netModeledValue = addressableValue - inputs\.firstYearBudget/);
  assert.match(calculator, /type="range"/);
  assert.match(calculator, /type="number"/);
  assert.match(calculator, /aria-live="polite"/);
  assert.match(calculator, /intent=pricing_roi/);
  assert.match(calculator, /volume=\$\{Math\.round\(inputs\.annualUnits\)\}/);
  assert.match(calculator, /message=\$\{encodeURIComponent\(leadMessage\)\}/);
  assert.match(calculator, /\/demo-lab\?scenario=\$\{activePreset\.demoScenario\}/);
  assert.doesNotMatch(calculator, /guaranteed|garantizado|garantido/i);

  assert.match(css, /Pricing decision model/);
  assert.match(css, /\.nexid-pricing-roi__workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.08fr\) minmax\(20rem,\s*0\.92fr\)/);
  assert.match(css, /html\.theme-light \.nexid-pricing-roi__inputs,[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.92\)/);
  assert.match(css, /html\.theme-light \.nexid-pricing-roi__actions a:not\(\.is-primary\),[\s\S]*color:\s*#155e75 !important/);
  assert.match(css, /@media \(max-width:\s*920px\)[\s\S]*\.nexid-pricing-roi__workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.nexid-pricing-roi__actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("pricing intents preserve tier and modeled scenario through the commercial handoff", async () => {
  const modal = await readFile(new URL("../src/components/commercial-contact-modal.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.equal((modal.match(/pricing_starter:\s*\{/g) ?? []).length, 3);
  assert.equal((modal.match(/pricing_pro:\s*\{/g) ?? []).length, 3);
  assert.equal((modal.match(/pricing_enterprise:\s*\{/g) ?? []).length, 3);
  assert.equal((modal.match(/pricing_roi:\s*\{/g) ?? []).length, 3);
  assert.equal((modal.match(/source: "pricing_roi_model"/g) ?? []).length, 3);
  assert.match(modal, /const volume = search\.get\("volume"\) \|\| intentCopy\.volume/);
  assert.match(modal, /const message = search\.get\("message"\) \|\| intentCopy\.message/);
  assert.match(modal, /role="dialog" aria-modal="true" aria-labelledby="contact-modal-title"/);
  assert.match(modal, /function getLocale\(fallback: AppLocale\): AppLocale/);
  assert.match(home, /<CommercialContactModal initialLocale=\{locale\} \/>/);
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modal, /element\.setAttribute\("inert", ""\)/);
  assert.match(modal, /element\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(modal, /if \(!inert\) element\.removeAttribute\("inert"\)/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /restoreFocusRef\.current\?\.isConnected/);
  assert.doesNotMatch(modal, /setTimeout\(close,\s*700\)/);
  assert.match(modal, /status === "loading" \|\| status === "ok"/);
  assert.match(modal, /respond within 1 business day/);
});
