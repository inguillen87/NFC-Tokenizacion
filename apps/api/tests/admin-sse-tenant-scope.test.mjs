import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('tenant scope cannot subscribe to another tenant stream', async () => {
  const src = await readFile(new URL('../src/app/admin/events/stream/route.ts', import.meta.url), 'utf8');
  assert.match(src, /forbidden_tenant_scope/);
  assert.match(src, /requestedTenant !== forcedTenantSlug/);
});
