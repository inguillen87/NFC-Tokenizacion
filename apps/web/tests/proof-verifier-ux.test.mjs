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
  assert.match(page, /Explorer Decoder para C-level/);
  assert.match(page, /Raw input = memo publico/);
  assert.match(page, /nexID lo traduce a negocio/);
  assert.match(page, /Ver campos decodificados para auditoria/);
  assert.match(page, /Abrir memo real en IOTA Explorer/);
  assert.match(page, /proof-decoder-code/);
  assert.match(page, /proof-field-details/);
  assert.match(page, /proof-nav-cta/);
  assert.match(page, /max-w-\[1540px\]/);
  assert.match(page, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(page, /proof-workstation-grid\s*>\s*\*/);
  assert.match(page, /min-width:\s*0/);
  assert.match(page, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(480px,\s*540px\)/);
  assert.doesNotMatch(page, /proof-workstation-sidebar\s*\{[^}]*max-height/s);
  assert.doesNotMatch(page, /proof-workstation-sidebar\s*\{[^}]*overflow:\s*auto/s);
});
