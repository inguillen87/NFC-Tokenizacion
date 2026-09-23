import assert from 'node:assert/strict';
import test from 'node:test';
import {
  currentRolePermissions, hasPermission, isEnterpriseRoleProfileTenantBindingValid,
  isSessionPrincipalCurrent, normalizeRole, roleTenantBindingValid,
} from '../src/lib/iam.ts';
import { checkAdmin, checkAdminPermission, getAdminPrincipal } from '../src/lib/auth.ts';
import { roleMayUseEnterpriseCapability } from '../src/lib/enterprise-capability-policy.ts';
import { resolveAdminUserDelegation } from '../src/lib/admin-user-management-policy.ts';

// Offline identities only. No persisted account, grant, session or external call.
const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const operator = (overrides = {}) => ({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  email: 'assigned-operator@offline.invalid', label: 'Assigned operator',
  role: 'supplier-operator', tenantId: null, tenantSlug: null,
  permissions: ['supplier_request.assigned.read', 'supplier_request.assigned.review'],
  deniedPermissions: [], mfaVerified: false,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  rotatedCookieValue: null, setupCompleted: true, ...overrides,
});
const request = () => new Request('https://api.offline.invalid/admin/supplier-requests/assigned', {
  headers: { authorization: 'Bearer offline-test-session' },
});
const forbidden = [
  '*', 'supplier_request.assign', 'supplier_requests:assign',
  'supplier_order.create', 'supplier_orders:write', 'batch.keys.generate',
  'supplier_pack.export', 'manifest.import', 'qa.approve', 'batch.activate',
  'users:manage', 'consumers.read_pii', 'events.read_sensitive', 'reports.export',
  'audit.read', 'api_keys.manage', 'webhooks.manage', 'batches:read',
  'tenants:read', 'unknown_namespace:new_action', 'supplier_request.assigned.export',
];

test('assigned operator has a distinct global identity and rejects tenant-bound or unknown identities', async () => {
  assert.equal(normalizeRole('supplier_operator'), 'supplier-operator');
  assert.equal(roleTenantBindingValid('supplier_operator', null), true);
  for (const invalid of [tenantId, '', undefined]) {
    assert.equal(roleTenantBindingValid('supplier_operator', invalid), false);
  }
  assert.equal(isEnterpriseRoleProfileTenantBindingValid({
    role: 'supplier_operator', tenant_id: null, role_profile_tenant_bound: false,
  }), true);
  assert.equal(isEnterpriseRoleProfileTenantBindingValid({
    role: 'supplier_operator', tenant_id: null, role_profile_tenant_bound: true,
  }), false);
  const req = request();
  assert.equal(await checkAdmin(req, ['supplier_operator'], async () => operator()), null);
  assert.equal(getAdminPrincipal(req).scope, 'supplier_operator');
  assert.notEqual(getAdminPrincipal(req).scope, 'super_admin');
  for (const overrides of [
    { tenantId }, { tenantSlug: 'another-company' }, { role: 'unknown-global-role' },
  ]) {
    assert.equal((await checkAdmin(request(), ['supplier_operator'], async () => operator(overrides)))?.status, 403);
  }
});

test('legacy admin routes deny the operator even with inherited wildcard grants', async () => {
  assert.equal((await checkAdmin(request(), undefined, async () => operator({ permissions: ['*'] })))?.status, 403);
  assert.equal((await checkAdmin(request(), ['super_admin', 'tenant_admin', 'tenant_operator', 'reseller'], async () => operator({ permissions: ['*'] })))?.status, 403);
});

test('operator role is a terminal capability allowlist including aliases and unknown namespaces', async () => {
  const req = request();
  assert.equal(await checkAdmin(req, ['supplier_operator'], async () => operator({ permissions: ['*'] })), null);
  for (const capability of forbidden) {
    assert.equal(roleMayUseEnterpriseCapability('supplier-operator', capability), false, capability);
    assert.equal(hasPermission(operator({ permissions: ['*', capability] }), capability), false, capability);
    assert.equal(checkAdminPermission(req, capability)?.status, 403, capability);
  }
  for (const capability of ['supplier_request.assigned.read', 'supplier_request.assigned.review']) {
    assert.equal(roleMayUseEnterpriseCapability('supplier_operator', capability), true);
    assert.equal(hasPermission(operator(), capability), true);
    assert.equal(hasPermission(operator({ permissions: [] }), capability), false);
    assert.equal(hasPermission(operator({ deniedPermissions: [capability] }), capability), false);
    assert.equal(hasPermission(operator({ deniedPermissions: ['*'] }), capability), false);
  }
  assert.equal(hasPermission(operator({ deniedPermissions: ['supplier_requests:assigned_read'] }), 'supplier_request.assigned.read'), false);
  assert.equal(hasPermission(operator({ deniedPermissions: ['supplier_request.assigned.review'] }), 'supplier_requests:assigned_review'), false);
});

test('assignment authority stays exclusive to superadmin even for tenant owners with wildcard permissions', () => {
  for (const role of ['tenant-owner', 'tenant-admin', 'operations-manager', 'reseller-admin', 'supplier-operator', 'viewer']) {
    assert.equal(hasPermission({ role, permissions: ['*'] }, 'supplier_request.assign'), false, role);
  }
  assert.equal(hasPermission({ role: 'super-admin', permissions: [] }, 'supplier_request.assign'), true);
  assert.equal(hasPermission({ role: 'super-admin', permissions: [], deniedPermissions: ['supplier_requests:assign'] }, 'supplier_request.assign'), false);
});

test('login and live session permission projection never publishes inherited operator wildcards', () => {
  assert.deepEqual(currentRolePermissions({ role: 'supplier_operator', permissions: ['*', 'users:manage', 'supplier_requests:*'] }), []);
  assert.deepEqual(currentRolePermissions({ role: 'supplier_operator', permissions: [
    '*', 'users:manage', 'supplier_requests:assigned_read', 'supplier_request.assigned.review',
  ], deniedPermissions: ['supplier_requests:assigned_review'] }), ['supplier_request.assigned.read']);
  assert.deepEqual(currentRolePermissions({ role: 'supplier_operator', permissions: ['supplier_request.assigned.read'], deniedPermissions: ['*'] }), []);
});

test('operator session fails closed after membership, account or role profile revocation', () => {
  const current = {
    admin_status: 'active', membership_current: true, membership_scope_unambiguous: true,
    role: 'supplier_operator', tenant_id: null, role_profile_active: true,
    role_profile_human_session_allowed: true, role_profile_tenant_bound: false,
  };
  assert.equal(isSessionPrincipalCurrent(current, true), true);
  for (const invalid of [
    { membership_current: false }, { membership_scope_unambiguous: false },
    { admin_status: 'disabled' }, { role_profile_active: false },
    { role_profile_human_session_allowed: false }, { role_profile_tenant_bound: true },
    { tenant_id: tenantId },
  ]) assert.equal(isSessionPrincipalCurrent({ ...current, ...invalid }, true), false, JSON.stringify(invalid));
});

test('only superadmin can delegate the internal profile and operator cannot delegate any role', () => {
  const sa = { role: 'super-admin', tenantId: null, permissions: ['*'] };
  assert.equal(resolveAdminUserDelegation(sa, 'supplier_operator', []).ok, true);
  for (const role of ['tenant-owner', 'tenant-admin', 'operations-manager', 'supplier-operator']) {
    assert.equal(resolveAdminUserDelegation({ role, tenantId, permissions: ['*'] }, 'supplier_operator', []).ok, false, role);
  }
  for (const target of ['supplier_operator', 'super_admin', 'tenant_admin', 'viewer']) {
    assert.equal(resolveAdminUserDelegation(operator({ permissions: ['*'] }), target, []).ok, false, target);
  }
});
