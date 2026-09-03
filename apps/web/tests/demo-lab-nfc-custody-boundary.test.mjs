import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");

test("Demo Lab describes NFC custody as nexID-managed without inventing tenant KMS", () => {
  assert.match(client, /NFC secret material and replay controls managed by nexID/);
  assert.match(client, /segredos NFC e controles de replay gerenciados pela nexID/);
  assert.match(client, /secretos NFC y controles de replay gestionados por nexID/);
  assert.match(client, /material de custodia NFC y la política del tenant/);
  assert.doesNotMatch(client, /tenant KMS|KMS del tenant|material KMS|chaves KMS cruas|claves KMS crudas/);
});

test("packaging and refill copy limits NFC evidence to the digital record and recorded-operation state", () => {
  assert.match(page, /La etiqueta identifica el registro digital/);
  assert.match(page, /no verifica por sí sola la composición ni el estado físico del packaging/);
  assert.match(page, /el tap aislado no demuestra limpieza, composición ni que la recarga física ocurrió/);
  assert.match(page, /métricas describen eventos persistidos/);
  assert.doesNotMatch(page, /verifica que el envase no fue rellenado|garantizando la integridad del contenido|refill verificado|Conocé exactamente cuántas veces se reutilizó/);
});
