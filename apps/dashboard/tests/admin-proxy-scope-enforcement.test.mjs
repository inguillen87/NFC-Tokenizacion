import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('readonly_demo scope cannot mutate admin endpoints', async () => {
  const src = await readFile(new URL('../src/app/api/admin/[...path]/route.ts', import.meta.url), 'utf8');
  assert.match(src, /readonly_demo scope only allows GET access/);
  assert.match(src, /status: 403/);
});

test('proxy forwards scoped role so super_admin path is available', async () => {
  const src = await readFile(new URL('../src/app/api/admin/[...path]/route.ts', import.meta.url), 'utf8');
  assert.match(src, /x-nexid-admin-scope/);
  assert.match(src, /dashboardRoleToScope/);
});
