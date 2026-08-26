import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("vertical-only Demo Lab deep links start ready and never inherit the valid-result beat", async () => {
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");
  const scenarioStart = client.match(/function getScenarioStart[\s\S]*?\r?\n\}/)?.[0] ?? "";
  const initialStateEffect = client.match(/useEffect\(\(\) => \{\r?\n\s*setVertical\(initialVertical[\s\S]*?\r?\n\s*\}, \[initialVertical, scenarioStart\.beat, scenarioStart\.key, scenarioStart\.vertical\]\);/)?.[0] ?? "";

  assert.match(scenarioStart, /return \{ key: null, beat: 0, vertical: "wine" \};/);
  assert.doesNotMatch(scenarioStart, /return \{ key: null, beat: 1/);
  assert.match(initialStateEffect, /setVertical\(initialVertical \? normalizeDemoVertical\(initialVertical\) : scenarioStart\.vertical\)/);
  assert.match(initialStateEffect, /setBeat\(scenarioStart\.beat\)/);
  assert.match(initialStateEffect, /setWizardStep\(initialWizardStep\)/);
  assert.match(initialStateEffect, /setWizardMaxStep\(initialWizardStep\)/);
  assert.match(initialStateEffect, /setSimulationReceipt\(null\)/);
});

test("the ready beat drives preview-ready product and mobile copy", async () => {
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");

  assert.match(client, /tone === "ok"[\s\S]*?"RESULTADO VALIDO"[\s\S]*?: "LISTO"/);
  assert.match(client, /beat === 0 \? "Acercar telefono"/);
  assert.match(client, /0:\s*\{[^}]*status:\s*"ORIGEN_LISTO"/);
  assert.match(client, /stateLabel: resolveDemoScenarioStateLabel\(baseScenario\.stateLabel, executionTruthState, locale\)/);
});

test("step zero visibly labels the product scene and guided-preview truth", async () => {
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");
  const stepZeroStart = client.indexOf("STEP 0: TOCA");
  const stepOneStart = client.indexOf("STEP 1:");
  const stepZero = client.slice(stepZeroStart, stepOneStart);

  assert.ok(stepZeroStart >= 0 && stepOneStart > stepZeroStart, "wizard step zero must be extractable");
  assert.match(client, /function getProductSceneBadge[\s\S]*return "Product scene";[\s\S]*return "Cena do produto";[\s\S]*return "Escena del producto";/);
  assert.doesNotMatch(client, /Real product|Produto real|Producto real/);
  assert.match(stepZero, /badge=\{getProductSceneBadge\(locale\)\}/);
  assert.match(stepZero, /data-demo-truth-state=\{executionTruthState\}/);
  assert.match(stepZero, /\{executionTruthCopy\.badge\}/);
  assert.match(stepZero, /\{executionTruthCopy\.explanation\}/);
});
