import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public Polygon certificate explains proof boundaries and preserves exits", async () => {
  const page = await readFile(new URL("../src/app/proof/ownership/page.tsx", import.meta.url), "utf8");

  assert.match(page, /\/public\/polygon\/ownership/);
  assert.match(page, /Emision testnet confirmada/);
  assert.match(page, /custodia de plataforma/);
  assert.match(page, /buyer ownership exige firma de wallet/i);
  assert.match(page, /Aporta el contexto del producto/);
  assert.match(page, /Comprobaciones del certificado/);
  assert.match(page, /Metadata/);
  assert.match(page, /Privado dentro de nexID/);
  assert.match(page, /\/demo-lab\?scenario=polygon-ownership/);
  assert.match(page, /\/proof\/verify\?layer=iota#iota-proof/);
  assert.match(page, /ThemeToggle/);
  assert.match(page, /dark:/);
});

test("event certificate does not present invalid events as authentic", async () => {
  const page = await readFile(new URL("../src/app/certificado/[eventId]/page.tsx", import.meta.url), "utf8");

  assert.match(page, /verification\?\.authentic/);
  assert.match(page, /no confirma autenticidad/);
  assert.match(page, /Ownership.*Bloqueado/s);
  assert.doesNotMatch(page, /confirma autenticidad y origen/);
});
