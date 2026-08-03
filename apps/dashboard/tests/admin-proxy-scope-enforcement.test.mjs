import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  isSupplierManifestQuantityOverrideRequest,
  requiredPermissionForAdminResource,
  requiresSuperAdminForAdminResource,
} from '../src/lib/permission-policy.ts';

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

test('supplier creation, key-pack export and lifecycle keep distinct authority boundaries', async () => {
  for (const path of [
    'supplier-orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/lifecycle',
    'tenant-vault/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/artifacts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download',
  ]) {
    assert.equal(requiresSuperAdminForAdminResource('POST', path), true);
  }
  assert.equal(requiresSuperAdminForAdminResource('POST', 'supplier-orders'), false);
  assert.equal(requiresSuperAdminForAdminResource('POST', 'supplier-orders/order-1/export'), false);
  assert.equal(requiresSuperAdminForAdminResource('POST', 'supplier-orders/order-1/export-pack'), false);
  assert.equal(requiresSuperAdminForAdminResource('GET', 'supplier-orders'), false);
  assert.equal(requiredPermissionForAdminResource('POST', 'supplier-orders'), 'supplier_order.create');
  assert.equal(requiredPermissionForAdminResource('POST', 'supplier-orders/order-1/export'), 'supplier_pack.export');
  assert.equal(requiredPermissionForAdminResource('POST', 'supplier-orders/order-1/export-pack'), 'supplier_pack.export');

  const src = await readFile(new URL('../src/app/api/admin/[...path]/route.ts', import.meta.url), 'utf8');
  assert.match(src, /requiresSuperAdminForAdminResource\(req\.method, normalizedPath\)/);
  assert.match(src, /dashboardSession\?\.role !== "super-admin"/);
  assert.match(src, /reason: "super_admin_required"/);
});

test('Vault delivery receipts and filenames survive the authenticated BFF boundary', async () => {
  const src = await readFile(new URL('../src/app/api/admin/[...path]/route.ts', import.meta.url), 'utf8');
  for (const header of [
    'content-disposition',
    'x-nexid-artifact-sha256',
    'x-nexid-audit-receipt',
    'x-nexid-download-count',
    'x-nexid-idempotent-replay',
  ]) {
    assert.match(src, new RegExp(`"${header}"`));
  }
});

test('tenant quantity-override payloads are detected before the BFF forwards a manifest mutation', async () => {
  const path = 'batches/SYG-2026-A/import-manifest';
  assert.equal(isSupplierManifestQuantityOverrideRequest('POST', path, JSON.stringify({ overrideReason: 'approved exception with evidence' })), true);
  assert.equal(isSupplierManifestQuantityOverrideRequest('POST', path, JSON.stringify({ override_reason: 'approved exception with evidence' })), true);
  assert.equal(isSupplierManifestQuantityOverrideRequest('POST', path, JSON.stringify({ csv: 'uid_hex,bid' })), false);
  assert.equal(isSupplierManifestQuantityOverrideRequest('GET', path, JSON.stringify({ overrideReason: 'ignored' })), false);

  const src = await readFile(new URL('../src/app/api/admin/[...path]/route.ts', import.meta.url), 'utf8');
  assert.match(src, /isSupplierManifestQuantityOverrideRequest\(req\.method, normalizedPath, body \|\| ""\)/);
  assert.match(src, /supplier_manifest_quantity_override_forbidden/);
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
