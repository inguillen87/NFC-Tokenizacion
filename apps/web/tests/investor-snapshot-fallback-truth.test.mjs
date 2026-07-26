import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/app/investor-snapshot/investor-snapshot-client.tsx", import.meta.url),
  "utf8",
);

test("investor demo and local fallbacks never invent product facts, telemetry or partnerships", () => {
  assert.match(source, /Mensaje NFC validado/);
  assert.match(source, /Escenario demo: SUN dinámico; no autentica el objeto físico/);
  assert.match(source, /ORIGEN: DEMO \/ SIN FUENTE/);
  assert.match(source, /Temp: DEMO \/ sin fuente/);
  assert.match(source, /DEMO · SIN FUENTE/);
  assert.match(source, /Dato demo no verificado: cargá la ficha enológica aprobada/);
  assert.match(source, /no hay hoteles, tarifas ni convenios verificados/i);
  assert.match(source, /Cargá el contrato o la fuente aprobada por el organizador/);
  assert.match(source, /no hay telemetría histórica cargada/i);
  assert.match(source, /Cargá la nota de cata aprobada por la bodega/);

  assert.doesNotMatch(source, /Autenticidad validada|Autenticidad de Origen|Autenticidad REACH|Autenticidad Agro|Autenticidad FDA \/ EMA/);
  assert.doesNotMatch(source, /Fórmula Inalterada|Fórmula Fitosanitaria Pura|Cadena de Frío Intacta|Sello Cerrado Original/);
  assert.doesNotMatch(source, /14\.2°C|18\.5°C|22\.1°C|4\.8°C|2°C - 8°C|16°C - 18°C/);
  assert.doesNotMatch(source, /96 pts Suckling|Malbec 100%|30% Aceites|99\.8% Activo|100 mg \/ Vial/);
  assert.doesNotMatch(source, /Hotel Hilton|Sheraton Buenos Aires|flores de jazmín y azafrán|notas a ciruelas negras|viñedo exclusivo a 1\.100/);
  assert.doesNotMatch(source, /Lote ON-88392-A sintetizado|marida de forma excepcional/);
});
