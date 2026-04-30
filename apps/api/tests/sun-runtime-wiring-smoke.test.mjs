import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sun html runtime script targets web /api proxies for consumer/mobile CTAs', async () => {
  const source = await readFile(new URL('../src/app/sun/route.ts', import.meta.url), 'utf8');
  assert.match(source, /\/api\/consumer\/auth\/start/);
  assert.match(source, /\/api\/consumer\/auth\/verify/);
  assert.match(source, /\/api\/consumer\/me/);
  assert.match(source, /\/api\/mobile\/passport\/.+join-tenant/);
  assert.match(source, /\/api\/mobile\/passport\/.+save-product/);
  assert.match(source, /\/api\/mobile\/passport\/.+loyalty\/enroll/);
});
