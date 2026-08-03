import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  buildQuoteRecommendation,
  DEFAULT_QUOTE_INPUT,
  normalizeQuoteQuantity,
} = await import("../src/components/pricing-quote-model.ts");

test("quote model upgrades an incompatible public carrier for SUN without presenting a false security profile", () => {
  const recommendation = buildQuoteRecommendation({
    ...DEFAULT_QUOTE_INPUT,
    carrier: "qr-gs1",
    security: "sun",
    modules: ["core"],
  });

  assert.deepEqual(recommendation.effectiveCarriers, ["ntag424"]);
  assert.ok(recommendation.modules.includes("secure"));
  assert.ok(recommendation.warnings.includes("carrier-upgraded"));
  assert.ok(recommendation.hardware.min > 0);
  assert.ok(recommendation.hardware.max > recommendation.hardware.min);
});

test("quote model recommends a hybrid industrial and TT architecture when both workflows are required", () => {
  const recommendation = buildQuoteRecommendation({
    ...DEFAULT_QUOTE_INPUT,
    carrier: "uhf",
    security: "tamper",
    packaging: "tamper-seal",
    vertical: "logistics",
    modules: ["core"],
  });

  assert.deepEqual(recommendation.effectiveCarriers, ["uhf", "ntag424tt"]);
  assert.ok(recommendation.modules.includes("industrial"));
  assert.ok(recommendation.modules.includes("secure"));
  assert.ok(recommendation.modules.includes("seal"));
  assert.ok(recommendation.warnings.includes("hybrid-carrier"));
  assert.ok(recommendation.warnings.includes("tamper-packaging-validation"));
});

test("IOTA and Polygon remain optional event-driven add-ons and do not change carrier hardware", () => {
  const offChain = buildQuoteRecommendation({ ...DEFAULT_QUOTE_INPUT, proof: "none" });
  const dualProof = buildQuoteRecommendation({ ...DEFAULT_QUOTE_INPUT, proof: "both" });

  assert.deepEqual(dualProof.hardware, offChain.hardware);
  assert.ok(dualProof.setup.min > offChain.setup.min);
  assert.ok(dualProof.monthlySaas.min > offChain.monthlySaas.min);
  assert.ok(dualProof.modules.includes("proof"));
  assert.ok(dualProof.modules.includes("ownership"));
  assert.ok(dualProof.warnings.includes("iota-event-driven"));
  assert.ok(dualProof.warnings.includes("polygon-event-driven"));
  assert.ok(dualProof.warnings.includes("network-fees-excluded"));
});

test("quote quantity is integer-bounded and pilot recommendations cannot exceed rollout scope", () => {
  assert.equal(normalizeQuoteQuantity(99), 100);
  assert.equal(normalizeQuoteQuantity(10_000.6), 10_001);
  assert.equal(normalizeQuoteQuantity(9_000_000), 5_000_000);

  const smallPilot = buildQuoteRecommendation({ ...DEFAULT_QUOTE_INPUT, quantity: 250 });
  assert.equal(smallPilot.pilot.minUnits, 250);
  assert.equal(smallPilot.pilot.maxUnits, 250);
});

test("pricing page exposes every enterprise scope input, output and truthful carrier boundary", async () => {
  const page = await readFile(new URL("../src/app/pricing/page.tsx", import.meta.url), "utf8");
  const configurator = await readFile(new URL("../src/components/pricing-quote-configurator.tsx", import.meta.url), "utf8");
  const model = await readFile(new URL("../src/components/pricing-quote-model.ts", import.meta.url), "utf8");

  assert.match(page, /import \{ PricingQuoteConfigurator \}/);
  assert.match(page, /<PricingQuoteConfigurator locale=\{locale\} \/>/);
  assert.match(configurator, /QUOTE_VERTICALS/);
  assert.match(configurator, /QUOTE_CARRIERS/);
  assert.match(configurator, /QUOTE_SECURITY_LEVELS/);
  assert.match(configurator, /QUOTE_PACKAGING/);
  assert.match(configurator, /QUOTE_INTEGRATIONS/);
  assert.match(configurator, /QUOTE_OFFLINE_LEVELS/);
  assert.match(configurator, /QUOTE_PROOF_LAYERS/);
  assert.match(configurator, /QUOTE_MODULES/);
  assert.match(configurator, /Hardware \+ soporte convertido/);
  assert.match(configurator, /Discovery \+ implementación/);
  assert.match(configurator, /SaaS mensual \+ operación/);
  assert.match(configurator, /Piloto recomendado/);
  assert.match(configurator, /Solicitar cotización por alcance/);
  assert.match(configurator, /polygon_iota_event_driven=true/);
  assert.match(configurator, /intent=pricing_enterprise/);
  assert.match(configurator, /className="sr-only" role="status" aria-live="polite"/);
  assert.match(configurator, /grid gap-3 p-4 md:hidden/);
  assert.match(configurator, /hidden max-w-full overflow-x-auto md:block/);
  assert.match(configurator, /Una señal digital nunca prueba por sí sola el contenido físico ni la custodia/);
  assert.match(configurator, /IOTA es opcional y event-driven/);
  assert.match(configurator, /Polygon es opcional y event-driven/);
  assert.match(configurator, /no en cada tap/);

  for (const carrier of ["QR / GS1", "NFC básico", "NTAG 424 DNA", "NTAG 424 DNA TT", "UHF RFID", "IoT / sensor"]) {
    assert.match(configurator, new RegExp(carrier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(model, /hardware: BudgetRange/);
  assert.match(model, /setup: BudgetRange/);
  assert.match(model, /monthlySaas: BudgetRange/);
  assert.doesNotMatch(page, /Software (?:from|desde) (?:US)?\$/);
  assert.doesNotMatch(page, /(?:Pilot setup|Implementacion piloto|Setup do piloto) (?:from|desde)/);
});
