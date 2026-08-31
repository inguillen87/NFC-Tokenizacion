import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sun web page maps tag_tamper status to explicit consumer UX', async () => {
  const [page, statusModel] = await Promise.all([
    readFile(new URL('../src/app/sun/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/sun/sun-consumer-status.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(page, /ttStatus === "closed"/);
  assert.match(page, /ttStatus === "opened"/);
  assert.match(page, /const isInvalidSealState = ttStatus === "invalid"/);
  assert.match(statusModel, /El tag informa: sello cerrado/);
  assert.match(statusModel, /El tag informa: sello abierto/);
  assert.match(statusModel, /No pudimos validar el estado del sello/);
  assert.match(statusModel, /Esto no certifica por sí solo el contenido ni una inspección física del envase\./);
});
