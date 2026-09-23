import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolveClerkSupplierOperator } from '../src/lib/clerk-supplier-operator.ts';

const email = 'operator@offline.invalid';
const user = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email, label: 'Offline operator',
  admin_status: 'active', role: 'supplier_operator', tenant_id: null,
  password_hash: 'unused', permissions: ['supplier_request.assigned.read'],
  deniedPermissions: [], mfa_enabled: false,
};
function fixture(rows = [{ id: user.id }]) {
  const calls = [];
  const sql = async (strings, ...values) => { calls.push({ query: strings.join('?'), values }); return rows; };
  return { sql, calls };
}

test('verified operator resolution only reads persisted membership and preserves its restricted role', async () => {
  const f = fixture();
  let loads = 0;
  const result = await resolveClerkSupplierOperator(f.sql, email, async (sql, foundEmail) => {
    loads++; assert.equal(sql, f.sql); assert.equal(foundEmail, email); return user;
  });
  assert.deepEqual(result, { kind: 'operator', user });
  assert.equal(loads, 1); assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].values, [email]);
  assert.match(f.calls[0].query, /m.role::text = 'supplier_operator'/);
  assert.doesNotMatch(f.calls[0].query, /INSERT|UPDATE|DELETE|GRANT|ALTER/);
});

test('missing membership stays unmanaged without creating a user or loading the company directory', async () => {
  const f = fixture([]);
  assert.deepEqual(await resolveClerkSupplierOperator(f.sql, email, async () => { throw new Error('unexpected load'); }), { kind: 'unmanaged' });
});

test('revoked, ambiguous, swapped and company-bound operator identities deny instead of falling through to founder provisioning', async () => {
  for (const invalid of [null, { ...user, admin_status: 'disabled' }, { ...user, admin_status: 'invited' },
    { ...user, role: 'super_admin' }, { ...user, tenant_id: user.id }, { ...user, id: 'other' }, { ...user, email: 'other@offline.invalid' }]) {
    assert.deepEqual(await resolveClerkSupplierOperator(fixture().sql, email, async () => invalid), {
      kind: 'denied', status: 403, reason: 'clerk_operator_access_denied',
    });
  }
  assert.equal((await resolveClerkSupplierOperator(fixture([{ id: user.id }, { id: 'other' }]).sql, email, async () => { throw new Error('unexpected load'); })).kind, 'denied');
});

test('operator SSO preserves the existing MFA gate and fails closed on unavailable identity storage', async () => {
  assert.deepEqual(await resolveClerkSupplierOperator(fixture().sql, email, async () => ({ ...user, mfa_enabled: true })), {
    kind: 'denied', status: 503, reason: 'mfa_login_temporarily_unavailable',
  });
  await assert.rejects(resolveClerkSupplierOperator(async () => { throw new Error('unavailable'); }, email), /unavailable/);
  await assert.rejects(resolveClerkSupplierOperator(fixture().sql, email, async () => { throw new Error('unavailable'); }), /unavailable/);
});

test('route verifies Clerk claims before operator lookup and terminates that branch before founder provisioning', async () => {
  const src = await readFile(new URL('../src/app/auth/clerk-sync/route.ts', import.meta.url), 'utf8');
  const verify = src.indexOf('const clerkAuth = await resolveVerifiedClerkAdminIdentity(req)');
  const mismatch = src.indexOf('claimedEmail !== clerkAuth.identity.email');
  const lookup = src.indexOf('await resolveClerkSupplierOperator(sql as any, email)');
  const deny = src.indexOf("if (existingOperator.kind === 'denied')");
  const allowed = src.indexOf("if (existingOperator.kind === 'operator')");
  const founder = src.indexOf('const isSuperAdmin = isClerkSuperAdminEmailAllowed(email)');
  assert.ok(verify >= 0 && verify < mismatch && mismatch < lookup && lookup < deny && deny < allowed && allowed < founder);
  const operatorBranch = src.slice(allowed, founder);
  assert.match(operatorBranch, /return json\(/);
  assert.doesNotMatch(operatorBranch, /INSERT INTO|resource_permissions|superPermissions|super_admin/);
  assert.match(src.slice(lookup, deny), /503/);
});
