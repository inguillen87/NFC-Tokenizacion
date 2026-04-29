import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('web proxy endpoints for sun consumer/mobile runtime exist', async () => {
  const required = [
    '../src/app/api/consumer/auth/start/route.ts',
    '../src/app/api/consumer/auth/verify/route.ts',
    '../src/app/api/consumer/auth/logout/route.ts',
    '../src/app/api/consumer/me/route.ts',
    '../src/app/api/mobile/passport/[eventId]/consumer/join-tenant/route.ts',
    '../src/app/api/mobile/passport/[eventId]/consumer/save-product/route.ts',
    '../src/app/api/mobile/passport/[eventId]/consumer/claim/route.ts',
    '../src/app/api/mobile/passport/[eventId]/loyalty/enroll/route.ts',
  ];
  for (const rel of required) {
    const content = await readFile(new URL(rel, import.meta.url), 'utf8');
    assert.match(content, /proxyToApi/);
  }
});

test('runtime proxy propagates correlation id header', async () => {
  const source = await readFile(new URL('../src/app/api/_lib/runtime-proxy.ts', import.meta.url), 'utf8');
  assert.match(source, /x-correlation-id/);
  assert.match(source, /crypto\.randomUUID/);
});
