import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sun html runtime script targets same-origin API routes for consumer/mobile CTAs', async () => {
  const source = await readFile(new URL('../src/app/sun/route.ts', import.meta.url), 'utf8');
  assert.match(source, /\/consumer\/auth\/start/);
  assert.match(source, /\/consumer\/auth\/verify/);
  assert.match(source, /\/consumer\/me/);
  assert.match(source, /\/mobile\/passport\/.+join-tenant/);
  assert.match(source, /\/mobile\/passport\/.+save-product/);
  assert.match(source, /\/mobile\/passport\/.+loyalty\/enroll/);
  assert.doesNotMatch(source, /\/api\/consumer/);
  assert.doesNotMatch(source, /\/api\/mobile/);
});
