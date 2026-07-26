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

test("brand synergy validates NFC and SUN evidence instead of claiming physical authenticity", () => {
  assert.match(brandSynergy, /NFC\/SUN message evidence check/);
  assert.match(brandSynergy, /Chequeo de evidencia del mensaje NFC\/SUN/);
  assert.match(brandSynergy, /Checagem da evidencia da mensagem NFC\/SUN/);
  assert.match(brandSynergy, /validate NFC\/SUN message evidence/);
  assert.match(brandSynergy, /NFC evidence/);
  assert.doesNotMatch(brandSynergy, /Authenticity check|Chequeo de autenticidad|Checagem de autenticidade|nexID can prove the product|nexID prueba el producto|nexID prova o produto/);
});
