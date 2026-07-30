import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/app/investor-snapshot/investor-snapshot-client.tsx", import.meta.url),
  "utf8",
);

test("investor snapshot models ROI with visible editable assumptions", () => {
  assert.match(source, /const \[protectionRate, setProtectionRate\] = useState\(50\)/);
  assert.match(source, /const \[engagementRate, setEngagementRate\] = useState\(15\)/);
  assert.match(source, /id="investor-protection-rate"/);
  assert.match(source, /id="investor-engagement-rate"/);
  assert.match(source, /Escenario de Pérdidas y ROI Hipotético/);
  assert.match(source, /no son ahorro observado, predicción ni garantía/i);
  assert.match(source, /Fórmulas determinísticas sobre las variables visibles/);
  assert.match(source, /SUPUESTO REGIONAL/);
  assert.match(source, /style=\{\{ width: `\$\{engagementRate\}%` \}\}/);

  assert.doesNotMatch(source, /grossLoss \* 0\.98/);
  assert.doesNotMatch(source, /volume \* 0\.35/);
  assert.doesNotMatch(source, /Evita rellenado, copias y fugas al 98%/);
  assert.doesNotMatch(source, /Tasa de contacto directo post-compra del 35%/);
  assert.doesNotMatch(source, /amortización directa e inmediata/i);
  assert.doesNotMatch(source, /se autofinancia de inmediato/i);
  assert.doesNotMatch(source, /CAME \(Cámara Argentina/);
  assert.doesNotMatch(source, /OIV \(Organización Internacional/);
  assert.doesNotMatch(source, /APEC \/ WIPO/);
});

test("deterministic calculator is not presented as live AI", () => {
  assert.match(source, /Explicador de Escenario Financiero/);
  assert.match(source, /Modelo editable · sin datos observados/);
  assert.match(source, /Explicación del modelo:/);

  assert.doesNotMatch(source, /Diagnóstico Financiero nexID AI/);
  assert.doesNotMatch(source, /Modelo Cognitivo v4\.2 Activo/);
  assert.doesNotMatch(source, /Estudio predictivo de retorno/);
  assert.doesNotMatch(source, /Respuesta nexID AI:/);
});

test("investor snapshot treats deployment evidence as dated and does not invent current runtime health", () => {
  assert.match(source, /snapshot de despliegue fechado 2026-07-26 documentó Vercel/);
  assert.match(source, /Neon para datos operativos/);
  assert.match(source, /no acredita por sí solo el estado del deploy actual/);
  assert.match(source, /value: "Vercel \+ Neon"/);

  assert.doesNotMatch(source, /runtime verificado hoy/);
  assert.doesNotMatch(source, /Render\/AWS/);
  assert.doesNotMatch(source, /AWS \/ Render/);
  assert.doesNotMatch(source, /servidor Render/);
  assert.doesNotMatch(source, /Redundancia multinodo/);
});

test("investor snapshot does not present NFC as a universal regulatory requirement", () => {
  assert.match(source, /NFC tampoco es un requisito automático/);
  assert.match(source, /asesoría legal o regulatoria/);
  assert.doesNotMatch(source, /no adoptarla es un riesgo existencial/i);
  assert.doesNotMatch(source, /quedarán fuera del mercado internacional/i);
  assert.doesNotMatch(source, /llave de entrada obligatoria al mercado de exportación global/i);
});

test("investor FAQ gates materials, customs and risk claims behind evidence and pilots", () => {
  assert.match(source, /compatibilidad química no se puede asumir/i);
  assert.match(source, /solo debe mostrar una certificación si corresponde al SKU adquirido/i);
  assert.match(source, /ninguna solución es universal/i);
  assert.match(source, /No existe telemetría continua ni un porcentaje exacto de llegada/i);
  assert.match(source, /No identifica una fuga de inmediato ni de forma universal/i);

  assert.doesNotMatch(source, /todos nuestros adhesivos acrílicos son inertes/i);
  assert.doesNotMatch(source, /estricto cumplimiento de la normativa REACH y ANMAT/i);
  assert.doesNotMatch(source, /inlays nexID tienen un grosor de solo 150 micras/i);
  assert.doesNotMatch(source, /reduce los tiempos de aduana e inspección/i);
  assert.doesNotMatch(source, /sabe exactamente qué porcentaje del lote llegó/i);
  assert.doesNotMatch(source, /identifica de inmediato la fuga al mercado gris/i);
  assert.doesNotMatch(source, /Ã|Â|�/);
});
