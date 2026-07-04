import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("proof verifier keeps the enterprise decoder readable and non-trapped", async () => {
  const page = await readFile(new URL("../src/app/proof/verify/page.tsx", import.meta.url), "utf8");

  assert.match(page, /proof-secondary-cta/);
  assert.match(page, /Que entiende un gerente sin leer blockchain/);
  assert.match(page, /Decodificar Raw input/);
  assert.match(page, /Abrir tx con memo/);
  assert.match(page, /Traducir Raw input a negocio/);
  assert.match(page, /Raw input visible en IOTA Explorer/);
  assert.match(page, /Mismo contenido decodificado por nexID/);
  assert.match(page, /Abrir memo real en IOTA Explorer/);
  assert.match(page, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(page, /proof-workstation-grid\s*>\s*\*/);
  assert.match(page, /min-width:\s*0/);
  assert.match(page, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(460px,\s*500px\)/);
  assert.doesNotMatch(page, /proof-workstation-sidebar\s*\{[^}]*max-height/s);
  assert.doesNotMatch(page, /proof-workstation-sidebar\s*\{[^}]*overflow:\s*auto/s);
});
