import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const content = await readFile(new URL("../src/lib/landing-content.ts", import.meta.url), "utf8");
const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
const proofSection = await readFile(new URL("../src/components/landing-proof-section.tsx", import.meta.url), "utf8");

test("landing content scopes tap validation to digital evidence in ES, EN and PT", () => {
  assert.match(content, /Con NFC o QR, tus clientes conocen el producto/);
  assert.match(content, /Com NFC ou QR, seus clientes conhecem o produto/);
  assert.match(content, /With NFC or QR, customers discover the product/);
  assert.doesNotMatch(content, /hero:[\s\S]{0,420}(?:SUN|\bTT\b|hash-only|producto físico|produto físico|physical product)/i);
  assert.match(content, /Mensaje válido/);
  assert.match(content, /Mensagem válida/);
  assert.match(content, /Valid message/);
  assert.doesNotMatch(content, /state: "Autêntico"|state: "Authentic"|title: "nexID valida el producto"/);
});

test("landing sections separate tag, TT and declared data from physical proof", () => {
  assert.match(sections, /nexID checks the digital label and shows a clear result[^.]*\. To validate the physical product as well[^.]*specific controls/);
  assert.match(sections, /A nexID verifica a etiqueta digital e mostra um resultado claro[^.]*\. Para validar também o produto físico[^.]*controles específicos/);
  assert.match(sections, /nexID verifica la etiqueta digital y muestra un resultado claro[^.]*\. Para validar también el producto físico[^.]*controles específicos/);
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
