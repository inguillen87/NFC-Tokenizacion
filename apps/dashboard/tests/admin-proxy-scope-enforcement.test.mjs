import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as permissions from '../src/lib/permission-policy.ts';
import * as scopePolicy from '../src/lib/dashboard-tenant-scope-policy.ts';
import * as proxyPolicy from '../src/lib/admin-proxy-policy.ts';
import * as runtimeRbac from '../src/lib/enterprise-runtime-rbac.ts';

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

test('strict reward creation uses the existing exact write permission without widening routes or methods', () => {
  assert.equal(requiredPermissionForAdminResource('POST', 'loyalty/rewards/create'), 'rewards:write');
  assert.equal(requiredPermissionForAdminResource('post', 'loyalty/rewards/create'), 'rewards:write');
  assert.equal(requiredPermissionForAdminResource('GET', 'loyalty/rewards'), 'rewards:read');
  assert.equal(requiredPermissionForAdminResource('POST', 'loyalty/rewards'), 'rewards:write');
  for (const [method, resource] of [['GET', 'loyalty/rewards/create'], ['POST', 'loyalty/rewards/create/other'], ['POST', 'loyalty/rewards/create-extra']]) assert.equal(requiredPermissionForAdminResource(method, resource), null);
  assert.equal(requiresSuperAdminForAdminResource('POST', 'loyalty/rewards/create'), false);
});

test('program options keep the same rewards read permission on the exact GET route', () => {
  assert.equal(requiredPermissionForAdminResource('GET', 'loyalty/programs'), 'rewards:read');
  for (const method of ['POST', 'PATCH', 'DELETE', 'HEAD']) {
    assert.equal(requiredPermissionForAdminResource(method, 'loyalty/programs'), null);
  }
  assert.equal(requiredPermissionForAdminResource('GET', 'loyalty/programs/other'), null);
});

test('the real BFF handler only forwards enabled, exact-tenant program reads with a server credential', async t => {
  const source = await readFile(new URL('../src/app/api/admin/[...path]/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const nativeRequire = createRequire(import.meta.url);
  const session = { role: 'tenant-admin', tenantSlug: 'qa-a', permissions: ['rewards:read'], deniedPermissions: [] };
  const credential = { session, bearerToken: 'synthetic-session-bearer' };
  const cases = [
    { name: 'flag disabled', enabled: false, status: 404 },
    { name: 'method unsupported', method: 'POST', status: 405 },
    { name: 'global scope rejected', query: '?scope=global', status: 400 },
    { name: 'duplicate tenant rejected', query: '?tenant=qa-a&tenant=qa-a', status: 400 },
    { name: 'sandbox control rejected', query: '?tenant=qa-a&sandbox=true', status: 400 },
    { name: 'noncanonical tenant rejected', query: '?tenant=QA-A', status: 403 },
    { name: 'cross-tenant rejected', query: '?tenant=qa-b', status: 403 },
    { name: 'anonymous rejected', credential: null, status: 401 },
    { name: 'demo rejected', credential: { ...credential, session: { ...session, isDemo: true } }, status: 403 },
    { name: 'write-only grant rejected', credential: { ...credential, session: { ...session, permissions: ['rewards:write'] } }, status: 403 },
    { name: 'explicit denial wins', credential: { ...credential, session: { ...session, deniedPermissions: ['rewards:read'] } }, status: 403 },
    { name: 'tenant reader permitted', status: 200 },
    { name: 'super-admin explicitly selects a tenant', query: '?tenant=qa-b', credential: { ...credential, session: { ...session, role: 'super-admin' } }, status: 200 },
    { name: 'upstream absence stays unavailable', status: 404, upstreamStatus: 404 },
    { name: 'upstream service unavailable is not replaced by a demo', status: 503, upstreamStatus: 503 },
  ];
  for (const testCase of cases) await t.test(testCase.name, async () => {
    const method = testCase.method ?? 'GET';
    const query = testCase.query ?? '?tenant=qa-a';
    const calls = [];
    const request = new Request('https://dashboard.example.invalid/api/admin/loyalty/programs' + query, {
      method,
      headers: { authorization: 'Bearer browser-placeholder', 'x-nexid-trace-id': 'synthetic-browser-trace', 'x-nexid-permissions': 'rewards:read' },
    });
    const module = { exports: {} };
    const imports = {
      'next/server': nativeRequire('next/server'),
      '@product/config': { productUrls: { api: 'https://api.example.invalid' } },
      '../../../../lib/session': {
        getDashboardSessionCredential: async () => Object.hasOwn(testCase, 'credential') ? testCase.credential : credential,
        isDashboardSessionUpstreamUnavailable: () => false,
      },
      '../../../../lib/permission-policy': permissions,
      '../../../../lib/dashboard-tenant-scope-policy': scopePolicy,
      '../../../../lib/admin-proxy-policy': proxyPolicy,
      '../../../../lib/enterprise-runtime-rbac': runtimeRbac,
    };
    const env = { NODE_ENV: 'production', DASHBOARD_REWARD_PROGRAM_SELECTION_ENABLED: testCase.enabled === false ? undefined : 'true' };
    const tenant = new URLSearchParams(query).get('tenant');
    const payload = { ok: true, version: 'admin-loyalty-program-options.v1', tenant, limit: 100, truncated: false, programs: [] };
    new Function('require', 'module', 'exports', 'process', 'fetch', compiled)(
      name => imports[name] ?? {}, module, module.exports, { env }, async (target, init) => {
        calls.push({ target, init });
        return Response.json(testCase.upstreamStatus ? { ok: false } : payload, { status: testCase.upstreamStatus ?? 200 });
      },
    );
    const response = await module.exports[method](request, { params: Promise.resolve({ path: ['loyalty', 'programs'] }) });
    assert.equal(response.status, testCase.status);
    if (testCase.status !== 200 && !testCase.upstreamStatus) {
      assert.equal(calls.length, 0);
      return;
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].target, 'https://api.example.invalid/admin/loyalty/programs' + query);
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.redirect, 'error');
    assert.deepEqual(Object.fromEntries(calls[0].init.headers), {
      authorization: 'Bearer synthetic-session-bearer', 'content-type': 'application/json',
    });
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-nexid-data-mode'), 'production');
    if (testCase.status === 200) assert.deepEqual(await response.json(), payload);
  });
});
