import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const content = await readFile(new URL("../src/lib/landing-content.ts", import.meta.url), "utf8");
const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
const proofSection = await readFile(new URL("../src/components/landing-proof-section.tsx", import.meta.url), "utf8");

test("landing content scopes tap validation to NFC/SUN evidence in ES, EN and PT", () => {
  assert.match(content, /nexID verifica la etiqueta digital; por sí sola, la lectura no confirma que el producto físico sea auténtico/);
  assert.match(content, /A nexID verifica a etiqueta digital; por si só, a leitura não confirma que o produto físico seja autêntico/);
  assert.match(content, /nexID checks the digital label; by itself, the reading does not confirm that the physical product is authentic/);
  assert.match(content, /Mensaje válido/);
  assert.match(content, /Mensagem válida/);
  assert.match(content, /Valid message/);
  assert.doesNotMatch(content, /state: "Autêntico"|state: "Authentic"|title: "nexID valida el producto"/);
});

test("landing sections separate tag, TT and declared data from physical proof", () => {
  assert.match(sections, /The reading checks the digital label; by itself, it does not confirm that the physical product is authentic/);
  assert.match(sections, /A leitura verifica a etiqueta digital; por si só, não confirma que o produto físico seja autêntico/);
  assert.match(sections, /La lectura verifica la etiqueta digital; por sí sola, no confirma que el producto físico sea auténtico/);
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
