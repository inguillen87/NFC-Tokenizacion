import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const content = await readFile(new URL("../src/lib/landing-content.ts", import.meta.url), "utf8");
const sections = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
const homeSections = await readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8");
const proofSection = await readFile(new URL("../src/components/landing-proof-section.tsx", import.meta.url), "utf8");

test("landing content scopes tap validation to digital evidence in ES, EN and PT", () => {
  const heroBodies = [...content.matchAll(/hero:\s*\{[^{}]*badge:\s*"[^"]+"[^{}]*body:\s*"([^"]+)"[^{}]*\}/g)].map((match) => match[1]);
  assert.match(content, /Con un toque NFC o un escaneo QR/);
  assert.match(content, /Com um toque NFC ou uma leitura de QR/);
  assert.match(content, /With an NFC tap or QR scan/);
  assert.equal(heroBodies.length, 3);
  for (const heroBody of heroBodies) {
    assert.doesNotMatch(heroBody, /SUN|\bTT\b|hash-only|producto físico|produto físico|physical product/i);
  }
  assert.match(content, /Mensaje válido/);
  assert.match(content, /Mensagem válida/);
  assert.match(content, /Valid message/);
  assert.doesNotMatch(content, /state: "Autêntico"|state: "Authentic"|title: "nexID valida el producto"/);
});

test("landing sections separate tag, TT and declared data from physical proof", () => {
  assert.match(homeSections, /answer comes from the digital tag[^.]*\. If a brand[^.]*assess the physical product[^.]*separate checks/);
  assert.match(homeSections, /resposta vem da etiqueta digital[^.]*\. Caso a marca[^.]*avaliar o produto físico[^.]*controles específicos/);
  assert.match(homeSections, /respuesta viene de la etiqueta digital[^.]*\. Si una marca[^.]*evaluar el producto físico[^.]*controles específicos/);
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
