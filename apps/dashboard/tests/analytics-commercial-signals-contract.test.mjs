import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panels = await readFile(new URL("../src/components/analytics-panels.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/(app)/analytics/page.tsx", import.meta.url), "utf8");

test("analytics dashboard consumes the aggregate commercial signal contract", () => {
  for (const source of [panels, page]) {
    assert.match(source, /commercialSignals/);
    assert.match(source, /reportedModel/);
    assert.match(source, /deviceCapability/);
    assert.match(source, /effectiveTypes/);
    assert.match(source, /locationSource/);
  }
  assert.match(panels, /data-commercial-signals-aggregate-only="true"/);
  assert.match(panels, /Señales comerciales agregadas/);
  assert.match(panels, /no identifica personas ni estima ingresos/);
  assert.match(panels, /No representan poder adquisitivo ni nivel socioeconómico/);
  assert.match(panels, /sin coordenadas exactas ni contexto técnico individual/);
});

test("signal cards communicate coverage and permission instead of asserting device truth", () => {
  assert.match(panels, /Cobertura \{formatAnalyticsPercentage\(coverage \* 100\)\}/);
  assert.match(panels, /con aceptación explícita/);
  assert.match(panels, /depende de la muestra, no valida el modelo informado/);
  assert.doesNotMatch(panels, /nivel económico|poder adquisitivo alto|ingresos estimados/);
});
