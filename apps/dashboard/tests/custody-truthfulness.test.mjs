import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/blockchain-hsm-health.tsx", import.meta.url), "utf8");

test("custody dashboard states the software envelope boundary and never fabricates HSM health", () => {
  assert.match(source, /KMS-wrapped SOFTWARE · NO VERIFICADO/);
  assert.match(source, /Arquitectura piloto prevista/);
  assert.match(source, /Esta tarjeta no consulta configuración ni demuestra/);
  assert.match(source, /Sin HSM declarado/);
  assert.match(source, /no es Cloud HSM ni una clave asimétrica no exportable/);
  assert.match(source, /no inventa salud ni rendimiento/);
  assert.doesNotMatch(source, /42ms|45,000 mints|Faucet Ficticio|HSM Minter|Las llaves nunca salen del HSM/);
});
