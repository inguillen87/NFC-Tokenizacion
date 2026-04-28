import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sun web page maps tag_tamper status to explicit UX copy', async () => {
  const src = await readFile(new URL('../src/app/sun/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /ttStatus === "closed"/);
  assert.match(src, /ttStatus === "opened"/);
  assert.match(src, /ttStatus === "invalid"/);
  assert.match(src, /Estado de apertura no disponible\./);
});
