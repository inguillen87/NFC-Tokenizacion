import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('readonly_demo scope only permits allowlisted reads and non-persistent simulations', async () => {
  const src = await readFile(new URL('../src/app/api/admin/[...path]/route.ts', import.meta.url), 'utf8');
  assert.match(src, /canDemoSandboxAccess\(req\.method, normalizedPath\)/);
  assert.match(src, /readonly_demo scope only allows demo-safe reads and explicit non-persistent simulations/);
  assert.match(src, /status: 403/);
});

test('production admin proxy requires a dashboard session before forwarding its opaque bearer', async () => {
  const src = await readFile(new URL('../src/app/api/admin/[...path]/route.ts', import.meta.url), 'utf8');
  assert.match(src, /isProduction && !scopedRole/);
  assert.match(src, /Dashboard session required for admin proxy access/);
  assert.match(src, /getDashboardSessionCredential\(\{ persistRotation: true \}\)/);
  assert.match(src, /Authorization: `Bearer \$\{credential\?\.bearerToken \|\| ""\}`/);
  assert.doesNotMatch(src, /process\.env\.ADMIN_API_KEY|x-nexid-admin-scope|x-nexid-permissions|x-nexid-actor/);
});

test('proxy derives local UI policy from the validated session but never serializes authority headers', async () => {
  const src = await readFile(new URL('../src/app/api/admin/[...path]/route.ts', import.meta.url), 'utf8');
  assert.match(src, /dashboardRoleToScope/);
  assert.match(src, /resolveDashboardTenantScope\(dashboardSession/);
  assert.doesNotMatch(src, /"x-nexid-(?:admin-scope|tenant-slug|permissions|actor|actor-id)"/);
});

test('SSE and tenant setup forward only validated session bearers and keep demo sessions local', async () => {
  const [stream, setup, internalDemo, clerk] = await Promise.all([
    readFile(new URL('../src/app/api/admin/events/stream/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/api/tenant/setup/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/api/internal/demo/[...path]/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/auth/clerk/super-admin/route.ts', import.meta.url), 'utf8'),
  ]);
  for (const source of [stream, setup, internalDemo]) {
    assert.match(source, /getDashboardSessionCredential\(\{ persistRotation: true \}\)/);
    assert.doesNotMatch(source, /process\.env\.ADMIN_API_KEY/);
  }
  assert.match(stream, /if \(session\.isDemo\)/);
  assert.match(internalDemo, /if \(credential\.session\.isDemo\)/);
  assert.match(setup, /"Authorization": `Bearer \$\{credential\.bearerToken\}`/);
  assert.match(clerk, /clerkAuth\.getToken\(\)/);
  assert.doesNotMatch(clerk, /ADMIN_API_KEY/);
});
