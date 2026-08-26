import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  modelPricingScenario,
  normalizePricingInput,
  parsePricingDraftInput,
} = await import("../src/components/pricing-roi-model.ts");

test("pricing model rounds IOTA cadence and keeps chain writes separate from NFC events", () => {
  assert.equal(normalizePricingInput("iotaAnchorEvery", 49.6, 0, 1_000), 50);
  assert.equal(normalizePricingInput("annualUnits", 1_000.6, 1_000, 2_000_000), 1_001);
  assert.equal(normalizePricingInput("tagUnitCost", 0.555, 0.01, 2.5), 0.555);

  const modeled = modelPricingScenario({
    annualUnits: 10_000,
    tagUnitCost: 0.5,
    platformBudget: 2_500,
    incidentRate: 2,
    incidentCost: 100,
    addressableRate: 50,
    traceEventsPerUnit: 1.25,
    iotaAnchorEvery: 49.6,
    polygonActionRate: 2.5,
  });

  assert.equal(modeled.totalFirstYearInvestment, 7_500);
  assert.equal(modeled.addressableValue, 10_000);
  assert.equal(modeled.netModeledValue, 2_500);
  assert.equal(modeled.paybackMonths, 9);
  assert.equal(modeled.annualTraceEvents, 12_500);
  assert.equal(modeled.annualIotaAnchors, 250);
  assert.equal(modeled.annualPolygonActions, 250);
  assert.equal(modeled.annualAnchors, 500);
  assert.equal(modeled.offChainEvents, 12_500);
  assert.equal(modeled.costPerUnit, 0.75);
});

test("pricing number drafts update valid zero values immediately without corrupting state on empty input", () => {
  assert.equal(parsePricingDraftInput("iotaAnchorEvery", "0", 0, 1_000), 0);
  assert.equal(parsePricingDraftInput("iotaAnchorEvery", "49.6", 0, 1_000), 50);
  assert.equal(parsePricingDraftInput("iotaAnchorEvery", "", 0, 1_000), null);
  assert.equal(parsePricingDraftInput("iotaAnchorEvery", "invalid", 0, 1_000), null);

  const disabledIotaCadence = parsePricingDraftInput("iotaAnchorEvery", "0", 0, 1_000);
  assert.notEqual(disabledIotaCadence, null);
  const modeled = modelPricingScenario({
    annualUnits: 180_000,
    tagUnitCost: 0.65,
    platformBudget: 12_500,
    incidentRate: 0.9,
    incidentCost: 65,
    addressableRate: 40,
    traceEventsPerUnit: 0.25,
    iotaAnchorEvery: disabledIotaCadence,
    polygonActionRate: 0,
  });

  assert.equal(modeled.annualTraceEvents, 45_000);
  assert.equal(modeled.annualIotaAnchors, 0);
  assert.equal(modeled.offChainEvents, 45_000);
});

test("pricing exposes an editable, bounded and truthful decision model", async () => {
  const page = await readFile(new URL("../src/app/pricing/page.tsx", import.meta.url), "utf8");
  const calculator = await readFile(new URL("../src/components/pricing-roi-calculator.tsx", import.meta.url), "utf8");
  const model = await readFile(new URL("../src/components/pricing-roi-model.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(page, /import \{ PricingRoiCalculator \}/);
  assert.match(page, /<PricingRoiCalculator locale=\{locale\} \/>[\s\S]*nexid-pricing-grid/);
  assert.match(calculator, /type ScenarioKey = "wine" \| "pharma" \| "agro" \| "chemicals" \| "logistics"/);
  assert.match(calculator, /demoScenario: "qr-gs1"/);
  assert.match(calculator, /demoScenario: "nfc-424"/);
  assert.match(calculator, /demoScenario: "sensor-evidence"/);
  assert.match(calculator, /NFC verification is not a blockchain transaction/);
  assert.match(calculator, /Validar un NFC no es hacer una transaccion blockchain/);
  assert.match(calculator, /Planning aid only/);
  assert.match(calculator, /Herramienta de planificacion/);
  assert.match(calculator, /modelPricingScenario\(inputs\)/);
  assert.match(model, /const encodedCarrierCost = annualUnits \* inputs\.tagUnitCost/);
  assert.match(model, /const totalFirstYearInvestment = encodedCarrierCost \+ inputs\.platformBudget/);
  assert.match(model, /const annualExposure = annualUnits \* \(inputs\.incidentRate \/ 100\) \* inputs\.incidentCost/);
  assert.match(model, /const addressableValue = annualExposure \* \(inputs\.addressableRate \/ 100\)/);
  assert.match(model, /const netModeledValue = addressableValue - totalFirstYearInvestment/);
  assert.match(model, /const annualTraceEvents = Math\.ceil\(annualUnits \* inputs\.traceEventsPerUnit\)/);
  assert.match(model, /iotaAnchorEvery > 0[\s\S]*Math\.ceil\(annualTraceEvents \/ iotaAnchorEvery\)/);
  assert.match(model, /Math\.ceil\(annualUnits \* \(inputs\.polygonActionRate \/ 100\)\)/);
  assert.match(model, /const paybackMonths = netModeledValue >= 0/);
  assert.match(calculator, /Not reached in modeled year 1/);
  assert.match(calculator, /Operational events and public proofs are separate/);
  assert.match(calculator, /Los eventos operativos y las pruebas publicas se separan/);
  assert.match(calculator, /Preset ilustrativo y editable/);
  assert.match(calculator, /key: "iotaAnchorEvery", min: 0/);
  assert.match(model, /INTEGER_INPUTS = new Set<keyof PricingScenarioInputs>\(\["annualUnits", "iotaAnchorEvery"\]\)/);
  assert.match(model, /INTEGER_INPUTS\.has\(key\) \? Math\.round\(bounded\) : bounded/);
  assert.match(calculator, /function updateDraftInput[\s\S]*parsePricingDraftInput[\s\S]*setInputs/);
  assert.match(calculator, /onChange=\{\(event\) => updateDraftInput\(/);
  assert.doesNotMatch(calculator, /cadenceValue\(Math\.round\(inputs\.iotaAnchorEvery\)\)/);
  assert.match(calculator, /polygonActionRate: 0/);
  assert.match(calculator, /live-network gas/);
  assert.match(calculator, /type="range"/);
  assert.match(calculator, /type="number"/);
  assert.match(calculator, /<details className="nexid-pricing-roi__advanced">/);
  assert.doesNotMatch(calculator, /<aside[^>]*aria-live=/);
  assert.match(calculator, /aria-describedby=\{helpId\}/);
  assert.match(calculator, /intent=pricing_roi/);
  assert.match(calculator, /volume=\$\{Math\.round\(inputs\.annualUnits\)\}/);
  assert.match(calculator, /message=\$\{encodeURIComponent\(leadMessage\)\}/);
  assert.match(calculator, /incident_rate_pct=/);
  assert.match(calculator, /addressable_value_usd=/);
  assert.match(calculator, /iota_events_per_proof=/);
  assert.match(calculator, /polygon_action_rate_pct=/);
  assert.match(calculator, /\/demo-lab\?scenario=\$\{activePreset\.demoScenario\}/);
  assert.doesNotMatch(calculator, /guaranteed|garantizado|garantido/i);

  assert.match(css, /Pricing decision model/);
  assert.match(css, /\.nexid-pricing-roi__workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.08fr\) minmax\(20rem,\s*0\.92fr\)/);
  assert.match(css, /\.nexid-pricing-roi__architecture\s*\{/);
  assert.match(css, /\.nexid-pricing-roi__advanced\s*\{/);
  assert.match(css, /html\.theme-light \.nexid-pricing-roi__inputs,[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.92\)/);
  assert.match(css, /html\.theme-light \.nexid-pricing-roi__actions a:not\(\.is-primary\),[\s\S]*color:\s*#155e75 !important/);
  assert.match(css, /@media \(max-width:\s*920px\)[\s\S]*\.nexid-pricing-roi__workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.nexid-pricing-roi__actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("pricing intents preserve tier and modeled scenario through the commercial handoff", async () => {
  const modal = await readFile(new URL("../src/components/commercial-contact-modal.tsx", import.meta.url), "utf8");
  const frame = await readFile(new URL("../src/components/marketing-clear/clear-site-frame.tsx", import.meta.url), "utf8");

  assert.equal((modal.match(/pricing_starter:\s*\{/g) ?? []).length, 3);
  assert.equal((modal.match(/pricing_pro:\s*\{/g) ?? []).length, 3);
  assert.equal((modal.match(/pricing_enterprise:\s*\{/g) ?? []).length, 3);
  assert.equal((modal.match(/pricing_roi:\s*\{/g) ?? []).length, 3);
  assert.equal((modal.match(/source: "pricing_roi_model"/g) ?? []).length, 3);
  assert.match(modal, /const volume = search\.get\("volume"\) \|\| intentCopy\.volume/);
  assert.match(modal, /const message = search\.get\("message"\) \|\| intentCopy\.message/);
  assert.match(modal, /role="dialog" aria-modal="true" aria-labelledby="contact-modal-title"/);
  assert.match(modal, /function getLocale\(fallback: AppLocale\): AppLocale/);
  assert.match(frame, /<Suspense fallback=\{null\}>[\s\S]*<CommercialContactModal initialLocale=\{locale\} \/>[\s\S]*<\/Suspense>/);
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

test("public and admin pricing separate recurring software from pilot and SLA scope", async () => {
  const publicPricing = await readFile(new URL("../src/app/pricing/page.tsx", import.meta.url), "utf8");
  const planConfig = await readFile(new URL("../../../packages/config/src/pricing.ts", import.meta.url), "utf8");
  const legacyCalculator = await readFile(new URL("../src/components/calculator-section.tsx", import.meta.url), "utf8");
  const billing = await readFile(new URL("../../dashboard/src/app/(app)/billing/page.tsx", import.meta.url), "utf8");

  assert.match(publicPricing, /SLA sujeto a readiness review/);
  assert.match(publicPricing, /SLA after readiness review/);
  assert.match(publicPricing, /Banda de piloto en el configurador/);
  assert.match(publicPricing, /Cotizado por unidades, carrier y alcance/);
  assert.match(publicPricing, /SaaS, operacion y uso cotizados por separado/);
  assert.doesNotMatch(publicPricing, /Software (?:from|desde) (?:US)?\$/);
  assert.match(planConfig, /Software desde USD 99 \/ mes/);
  assert.match(planConfig, /Software desde USD 249 \/ mes/);
  assert.match(planConfig, /Software desde USD 499 \/ mes \+ uso/);
  assert.match(planConfig, /monthlyUsd: 99/);
  assert.match(planConfig, /monthlyUsd: 249/);
  assert.match(planConfig, /monthlyUsd: 499/);
  assert.doesNotMatch(planConfig, /Software desde USD 200 \/ mes/);
  assert.match(planConfig, /setup, tags, encoding y servicios se cotizan aparte/);
  assert.match(planConfig, /SLA y deployment quedan sujetos a readiness review/);
  assert.match(legacyCalculator, /pricingPlans\.find\(\(plan\) => plan\.slug === "basic"\)\?\.monthlyUsd/);
  assert.match(legacyCalculator, /Modelo únicamente en USD/);
  assert.match(legacyCalculator, /not settlement FX or an invoice/);
  assert.doesNotMatch(legacyCalculator, /const currencyRate|ARS:\s*1050|BRL:\s*5/);
  assert.doesNotMatch(legacyCalculator, /const currencies = \["USD", "ARS", "BRL"\]/);
  assert.doesNotMatch(legacyCalculator, /monthlySaas:\s*(?:199|690|1650)/);
  assert.match(billing, /Una suscripci[oó]n no es el costo total de un piloto/i);
  assert.match(billing, /hardware, encoding, rollout y gas se cotizan por alcance/i);
});
