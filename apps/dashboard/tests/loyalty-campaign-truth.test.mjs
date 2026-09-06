import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  describeCampaignMeasurement,
  describeQuestionRate,
  describeTriviaSummary,
} = await import("../src/app/(app)/loyalty/campaigns/loyalty-campaign-truth.ts");

const source = await readFile(
  new URL("../src/app/(app)/loyalty/campaigns/loyalty-campaigns-client.tsx", import.meta.url),
  "utf8",
);

test("local copy rules are never presented as measured or calibrated CTR", () => {
  assert.match(source, /Heurísticas locales de copy/);
  assert.match(source, /No son CTR, conversión, sentimiento medido ni telemetría/);
  assert.match(source, /Heurística de acción del copy · 0–100/);
  assert.match(source, /Local copy heuristic\. It is not a calibrated CTR or conversion model/);
  assert.doesNotMatch(source, /Tasa Click-Through \(CTR\) Estimada|CTR probable|Conversión Estimada|CTR Elevado/);
});

test("zero trivia attempts remain unmeasured instead of becoming zero knowledge or a leading city", () => {
  const empty = describeTriviaSummary({
    attempts: 0,
    avgScorePct: 0,
    topCity: "Mendoza",
    topProduct: "Gran Reserva",
  });

  assert.equal(empty.hasMeasurements, false);
  assert.equal(empty.avgScoreLabel, "Sin base");
  assert.equal(empty.avgScoreHint, "no equivale a 0%");
  assert.equal(empty.topCityLabel, "Sin base");
  assert.equal(empty.topCityHint, "requiere intentos confirmados");
  assert.equal(describeQuestionRate(0, 0), "Sin base");
});

test("confirmed trivia measurements preserve reported zero rates and real source labels", () => {
  const measured = describeTriviaSummary({
    attempts: 12,
    avgScorePct: 0,
    topCity: "Rosario",
    topProduct: "Lote A",
  });

  assert.equal(measured.hasMeasurements, true);
  assert.equal(measured.avgScoreLabel, "0%");
  assert.equal(measured.topCityLabel, "Rosario");
  assert.equal(measured.topCityHint, "Lote A");
  assert.equal(describeQuestionRate(4, 0), "0%");
});

test("campaign conversion distinguishes confirmed measurements from demo models and drafts", () => {
  assert.deepEqual(describeCampaignMeasurement("confirmed", "18%"), {
    badge: "Medicion confirmada",
    conversion: "18%",
    conversionLabel: "Conversion medida",
  });
  assert.equal(describeCampaignMeasurement("demo_model", "18%").conversionLabel, "Conversion demo modelada");
  assert.equal(describeCampaignMeasurement("draft_unmeasured", "-").conversion, "Sin base");
});

test("loyalty campaign copy qualifies NFC, origin, templates and modeled outcomes", () => {
  assert.match(source, /mensaje NFC/i);
  assert.match(source, /origen declarado/i);
  assert.match(source, /Plantillas demo para configurar/);
  assert.match(source, /No describen beneficios activos ni resultados medidos/);
  assert.doesNotMatch(source, /modeledOutcome|\+14%|\+22%|-18%/);
  assert.match(source, /Sin ciudades con intentos confirmados/);
  assert.match(source, /Datos demo · no son audiencia real/);
  assert.doesNotMatch(source, /tu producto .*qued[oó] autenticado/i);
  assert.doesNotMatch(source, /Se[nñ]al f[ií]sica del producto/i);
  assert.doesNotMatch(source, /Origen verificado y lote/i);
  assert.doesNotMatch(source, /producto f[ií]sico en investigaci[oó]n de mercado/i);
  assert.doesNotMatch(source, /Gemelo digital verificado nexID/i);
  assert.doesNotMatch(source, /reclamar el certificado de propiedad de tu activo f[ií]sico/i);
});

test("demo counts have one explicit locale for server and browser hydration", () => {
  for (const field of ["sentCount", "clicksCount", "rewardsCount"]) {
    assert.ok(source.includes(`camp.${field}.toLocaleString("es-AR")`));
  }
  assert.doesNotMatch(source, /\.toLocaleString\(\)/);
});
