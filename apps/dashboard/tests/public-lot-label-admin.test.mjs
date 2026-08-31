import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, form] = await Promise.all([
  readFile(new URL("../src/app/(app)/batches/[bid]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(app)/batches/[bid]/batch-config-form-client.tsx", import.meta.url), "utf8"),
]);

test("batch page exposes the configured public lot independently from the technical BID", () => {
  assert.match(page, /sdmConfig\.public_lot_label[\s\S]*?sdmConfig\.lot[\s\S]*?sdmConfig\.batch_lot[\s\S]*?sdmConfig\.lot_number/);
  assert.match(page, /public_lot_label:\s*publicLotLabel/);
  assert.match(page, /<Fact label="Lote comercial visible" value=\{publicLotLabel \|\| "No configurado"\}/);
  assert.doesNotMatch(page, /const bid\s*=\s*publicLotLabel/);
});

test("batch form edits and saves the bounded public lot label with truthful copy", () => {
  assert.match(form, /public_lot_label\?:\s*string \| null/);
  assert.match(form, /public_lot_label:\s*initialData\.public_lot_label \|\| ""/);
  assert.match(form, /name="public_lot_label"/);
  assert.match(form, /maxLength=\{160\}/);
  assert.match(form, /Lote comercial visible/);
  assert.match(form, /No modifica el BID técnico/);
  assert.match(form, /body:\s*JSON\.stringify\(payload\)/);
});
