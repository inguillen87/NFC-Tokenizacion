import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const content = await readFile(new URL("../src/lib/landing-content.ts", import.meta.url), "utf8");
const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
const proofSection = await readFile(new URL("../src/components/landing-proof-section.tsx", import.meta.url), "utf8");

test("landing content scopes consultation results to message evidence and declared data in ES, EN and PT", () => {
  assert.match(content, /Cada toque muestra qué mensaje NFC\/SUN pasó la política, qué datos declaró la marca y qué puede hacer ahora el comprador/);
  assert.match(content, /A tela mostra mensagem válida, sinalizada ou bloqueada; não um veredito físico/);
  assert.match(content, /The phone shows a valid, flagged or blocked tag message—not a physical-product verdict/);
  assert.match(content, /No certifica por sí solo el envase, su contenido ni la custodia física/);
  assert.match(content, /A tela separa evidência digital de qualquer conclusão sobre o produto físico/);
  assert.match(content, /The UX separates digital tag evidence from any physical-product conclusion/);
  assert.match(content, /Mensaje válido/);
  assert.match(content, /Mensagem válida/);
  assert.match(content, /Valid message/);
  assert.doesNotMatch(content, /state: "Autêntico"|state: "Authentic"|title: "nexID valida el producto"/);
});

test("landing sections separate message, TT and declared data from physical proof", () => {
  assert.match(sections, /It does not prove the physical item, contents, origin, seal or custody/);
  assert.match(sections, /Não comprova item físico, conteúdo, origem, lacre ou custódia/);
  assert.match(sections, /No prueba objeto físico, contenido, origen, sello ni custodia/);
  assert.match(sections, /A tap or scan shows the available result, its source and its limits/);
  assert.match(sections, /Um toque ou leitura mostra o resultado disponivel, sua fonte e seus limites/);
  assert.match(sections, /Un toque o una lectura muestra el resultado disponible, su fuente y sus límites/);
  assert.match(sections, /no autenticidad física/);
  assert.match(sections, /TT reportado/);
  assert.match(sections, /not proof of physical contents/);

  assert.doesNotMatch(sections, /Know if it is real|Saiba se e real|Every validation can prove authenticity|cada unidade prova que e real/i);
  assert.doesNotMatch(sections, /valida (?:los|os) productos en el campo|AUTH_OK \/ OPENED|AUTENTICO \/ ABIERTO/i);
  assert.doesNotMatch(sections, /Strong cryptographic authenticity|Autenticidad criptográfica fuerte|physical opened\/closed seal/i);
});

test("landing proof labels demoMode as guided simulation and describes non-demo data by source", () => {
  assert.match(proofSection, /eyebrow=\{proof\.demoMode \? "Prueba guiada" : "Fuente operativa"\}/);
  assert.match(proofSection, /title=\{proof\.demoMode \? "Escenario simulado de validación" : "Eventos reportados por la API"\}/);
  assert.match(proofSection, /no representan actividad productiva/);
  assert.match(proofSection, /reportados por la fuente operativa/);
  assert.doesNotMatch(proofSection, /Prueba en vivo|Prueba operativa en tiempo real/);
});
