import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  describeCognitiveSummary,
  resolveCognitiveSummaryDelivery,
} = await import("../src/lib/cognitive-summary-contract.ts");

const panels = await readFile(new URL("../src/components/analytics-panels.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/api/cognitive-ai/route.ts", import.meta.url), "utf8");

test("HF 402 response is presented as deterministic fallback, never live AI", () => {
  const delivery = resolveCognitiveSummaryDelivery({
    optimizedText: "Resumen local",
    fallback: true,
    reason: "hugging_face_402",
    model: "zai-org/GLM-5.2:together",
  });
  const truth = describeCognitiveSummary(delivery);

  assert.equal(delivery.mode, "deterministic_fallback");
  assert.match(truth.subtitle, /determinístico/);
  assert.match(truth.badge, /HTTP 402/);
  assert.doesNotMatch(`${truth.subtitle} ${truth.badge}`, /Proveedor confirmado/);
});

test("live provider label requires explicit provider, model and non-fallback response", () => {
  const confirmed = resolveCognitiveSummaryDelivery({
    optimizedText: "Resumen remoto",
    fallback: false,
    provider: "huggingface-router",
    model: "zai-org/GLM-5.2:together",
  });
  const unconfirmed = resolveCognitiveSummaryDelivery({
    optimizedText: "Texto sin procedencia",
    fallback: false,
    model: "zai-org/GLM-5.2:together",
  });

  assert.equal(confirmed.mode, "live_provider");
  assert.match(describeCognitiveSummary(confirmed).badge, /Proveedor confirmado/);
  assert.equal(unconfirmed.mode, "deterministic_fallback");
});

test("both analytics copilot branches use the same truth state and no hardcoded live claim", () => {
  assert.equal((panels.match(/subtitle=\{summaryTruth\.subtitle\}/g) || []).length, 2);
  assert.equal((panels.match(/\{summaryTruth\.badge\}/g) || []).length, 2);
  assert.doesNotMatch(panels, /Hugging Face GLM-5\.2 en tiempo real/);
  assert.match(panels, /deterministicCognitiveSummary\("not_requested"\)/);
  assert.doesNotMatch(panels, /fetch\("\/api\/cognitive-ai"/);
});

test("cognitive route confirms provider on success and logs expected 402 without provider body", () => {
  assert.match(route, /provider: "huggingface-router"[\s\S]*fallback: false/);
  assert.match(route, /response\.status === 402[\s\S]*console\.info/);
  assert.doesNotMatch(route, /console\.error\("HF Router chat error/);
  assert.doesNotMatch(route, /errText|await response\.text\(\)/);
});

test("executive fallback is neutral and never invents favorable health or risk claims", () => {
  assert.match(route, /Resumen determinístico local/);
  assert.match(route, /no confirmó un análisis/);
  assert.doesNotMatch(route, /alta tasa de lecturas originales|riesgo se mantienen en niveles bajos|valida la robustez del sellado/);
});

test("marketing fallbacks require evidence instead of inventing wine or phygital verification", () => {
  assert.match(route, /origen, crianza, notas y premios requieren una ficha verificada/);
  assert.match(route, /no implica autenticidad física ni ownership/);
  assert.doesNotMatch(route, /botella verificada|con origen claro, notas de cata, crianza/i);
});
