import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { platformVerticals } from "../src/lib/platform-verticals.ts";

const verticalLibrary = await readFile(new URL("../src/components/vertical-demo-library.tsx", import.meta.url), "utf8");
const processSimulator = await readFile(new URL("../src/components/demo-process-simulator.tsx", import.meta.url), "utf8");
const brandSynergy = await readFile(new URL("../src/components/brand-synergy-simulator.tsx", import.meta.url), "utf8");

test("events copy conditions replay and copy controls on the carrier and tenant policy", () => {
  const events = platformVerticals.find((vertical) => vertical.id === "events");
  assert.ok(events);

  assert.match(events.body, /controles de replay o copia según el portador y la política configurada/);
  assert.match(events.bodyEn, /replay or copy controls subject to the carrier and configured policy/);
  assert.match(events.bodyPt, /controles de replay ou cópia conforme o portador e a política configurada/);
  assert.doesNotMatch([events.body, events.bodyEn, events.bodyPt].join("\n"), /con bloqueo de copia|with replay blocking|com bloqueio de copia/i);
});

test("vertical demo library presents NTAG424 as message and reported tamper evidence", () => {
  assert.match(verticalLibrary, /mensaje dinámico, control de replay y estado de tamper reportado/);
  assert.match(verticalLibrary, /dynamic message, replay controls and reported tamper state/);
  assert.match(verticalLibrary, /does not authenticate the physical product by itself/);
  assert.match(verticalLibrary, /Bottle passport, reported uncork or tamper events and NFC message evidence/);
  assert.match(verticalLibrary, /Reported chain events, batch evidence and anti-replay checks/);
  assert.doesNotMatch(verticalLibrary, /anti-clone, tamper (?:y|e|and) (?:autenticidad|autenticidade|premium authenticity)|authenticity state|Luxury item authentication|Chain-of-custody verification and anti-counterfeit/i);
});

test("desktop process simulator separates NFC evidence from physical authenticity", () => {
  assert.match(processSimulator, /Evidencia NFC y origen declarado por botella/);
  assert.match(processSimulator, /Evidência NFC e origem declarada por garrafa/);
  assert.match(processSimulator, /NFC evidence \+ declared origin per bottle/);
  assert.match(processSimulator, /Digital tag evidence at point of sale/);
  assert.doesNotMatch(processSimulator, /Origen y autenticidad por botella|Origem e autenticidade por garrafa|Origin \+ authenticity per bottle|Producto genuino al consumidor|Produto genuíno ao consumidor|Genuine product at point of sale/);
});

test("brand synergy presents an illustrative message-and-rules consultation instead of physical authentication", () => {
  assert.match(brandSynergy, /validate NFC\/SUN message evidence/);
  assert.match(brandSynergy, /Cada consulta puede mostrar información aprobada, aplicar reglas definidas y habilitar una acción útil/);
  assert.match(brandSynergy, /Cada consulta pode mostrar informações aprovadas, aplicar regras definidas e habilitar uma ação útil/);
  assert.match(brandSynergy, /Resultado de demostración según las reglas configuradas/);
  assert.match(brandSynergy, /Resultado de demonstração conforme as regras configuradas/);
  assert.match(brandSynergy, /Mensaje y reglas del producto/);
  assert.match(brandSynergy, /HYPOTHETICAL SCENARIO/);
  assert.match(brandSynergy, /They are not customers, partners or measured performance/);
  assert.doesNotMatch(brandSynergy, /Authenticity check|Chequeo de autenticidad|Checagem de autenticidade|nexID can prove the product|nexID prueba el producto|nexID prova o produto/);
});
