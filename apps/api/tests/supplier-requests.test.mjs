import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { checkAdminWithPermission } from '../src/lib/auth.ts';
import { makeSupplierRequestHandlers } from '../src/lib/supplier-request-http.ts';
import { SUPPLIER_REQUEST_PROTOCOL, SUPPLIER_REQUEST_MAX_BODY_BYTES, parseSupplierRequestCreate, parseSupplierRequestPatch, parseSupplierRequestSubmit, parseSupplierRequestId, supplierRequestFromRow } from '../src/lib/supplier-request-contract.ts';
import { parseSupplierRequestSource, validateSupplierRequestConversion } from '../src/lib/supplier-request-store.ts';

const tenantId = '10000000-0000-4000-8000-000000000001', otherTenant = '10000000-0000-4000-8000-000000000002';
const actorId = '20000000-0000-4000-8000-000000000001', sessionId = '30000000-0000-4000-8000-000000000001';
const id = '40000000-0000-4000-8000-000000000001', key = '50000000-0000-4000-8000-000000000001', orderId = '60000000-0000-4000-8000-000000000001';
const content = { title: 'Solicitud sintética', construction_id: '', quantity: null, pack_purpose: null, notes: 'Borrador parcial\nSin cantidad confirmada' };
const complete = { ...content, construction_id: 'tt_bridge', quantity: 125, pack_purpose: 'trial_integration' };
function row(patch = {}) { return { ...content, id, tenant_id: tenantId, tenant_slug: 'qa-a', status: 'draft', revision: 1, created_by: actorId, updated_by: actorId, submitted_by: null, created_at: '2026-09-23T12:00:00.000Z', updated_at: '2026-09-23T12:00:00.000Z', submitted_at: null, order_id: null, ...patch }; }
function session(patch = {}) { return { id: sessionId, userId: actorId, email: 'qa@example.invalid', label: 'Synthetic operator', role: 'operations-manager', tenantId, tenantSlug: 'qa-a', permissions: ['supplier_order.create'], deniedPermissions: [], mfaVerified: false, expiresAt: new Date(Date.now() + 60000).toISOString(), rotatedCookieValue: null, setupCompleted: true, ...patch }; }
function request(action, body, query = '?tenant=qa-a', headers = {}) {
  const method = action === 'patch' ? 'PATCH' : ['create', 'submit'].includes(action) ? 'POST' : 'GET';
  const path = `/admin/supplier-requests${['get', 'patch', 'submit'].includes(action) ? `/${id}` : ''}${action === 'submit' ? '/submit' : ''}`;
  return new Request(`http://localhost${path}${query}`, { method, headers: { authorization: 'Bearer synthetic-local-session', 'x-admin-tenant': 'qa-b', ...(method !== 'GET' ? { 'content-type': 'application/json', 'idempotency-key': key } : {}), ...headers }, ...(method !== 'GET' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
}
function dependencies(action = 'create', patch = {}, options = {}) {
  const calls = [], queries = [];
  const result = options.result ?? { ok: true, request: row(options.row), idempotent_replay: false, receipt: { idempotency_key: key, action, revision: options.row?.revision || 1 } };
  const value = {
    authorize: (req, permission) => { calls.push(permission); return checkAdminWithPermission(req, permission, options.resolver || (async () => session(patch))); },
    query: async (strings, ...values) => {
      const statement = strings.join('?'); queries.push({ statement, values });
      if (/FROM public\.tenants/.test(statement)) return options.tenantRows ?? [{ id: patch.tenantId || tenantId, slug: patch.tenantSlug || 'qa-a' }];
      if (/nexid_mutate_supplier_request_v1/.test(statement)) { if (options.throwSql) throw Error('PRIVATE_SQL_CREDENTIAL'); return [{ result }]; }
      return options.rows ?? [row(options.row)];
    },
  };
  return { handlers: makeSupplierRequestHandlers(value), calls, queries };
}
async function call(deps, action, body = content, query, reference = id, headers) {
  const response = await deps.handlers[action](request(action, body, query, headers), reference);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  return { status: response.status, body: await response.text().then(text => { try { return JSON.parse(text); } catch { return { text }; } }) };
}

test('partial draft preserves commercial input without inventing purpose, quantity or construction', () => {
  assert.deepEqual(parseSupplierRequestCreate(content), content);
  assert.deepEqual(parseSupplierRequestPatch({ ...content, expected_revision: 2 }), { ...content, expected_revision: 2 });
  assert.deepEqual(parseSupplierRequestSubmit({ expected_revision: 2 }), { expected_revision: 2 });
  assert.equal(SUPPLIER_REQUEST_PROTOCOL, 'nexid.supplier-request.v1');
  assert.equal(SUPPLIER_REQUEST_MAX_BODY_BYTES, 32 * 1024);
  for (const candidate of [null, [], {}, { ...content, title: ' ' }, { ...content, title: 'x'.repeat(201) }, { ...content, notes: 'x'.repeat(4001) }, { ...content, notes: 'bad\u0000text' }, { ...content, notes: 'api_key=synthetic-confidential-value' }, { ...content, construction_id: 'invented' }, { ...content, quantity: '125' }, { ...content, quantity: 1.5 }, { ...content, quantity: 0 }, { ...content, quantity: 100000001 }, { ...content, pack_purpose: 'trial' }, { ...content, tenant_id: otherTenant }, { ...content, batch_keys: [] }, { ...content, order_id: orderId }]) assert.throws(() => parseSupplierRequestCreate(candidate));
  for (const revision of [null, '1', 0, -1, 1.5, 2147483647]) assert.throws(() => parseSupplierRequestSubmit({ expected_revision: revision }));
  assert.throws(() => parseSupplierRequestSubmit({ expected_revision: 1, notes: 'cannot mutate during submit' }));
  for (const candidate of ['715', ' ' + id, '00000000-0000-0000-0000-000000000000']) assert.throws(() => parseSupplierRequestId(candidate));
});

test('real auth role, deny, service-account and revoked-session gates run before queries', async () => {
  for (const action of ['list', 'get', 'create', 'patch', 'submit']) {
    for (const patch of [{ permissions: [] }, { deniedPermissions: ['supplier_order.create'] }, { deniedPermissions: ['supplier_orders:write'] }, { role: 'viewer' }, { role: 'security-operator' }, { role: 'api-integration' }, { role: 'super-admin', permissions: [], tenantId: null, tenantSlug: null, deniedPermissions: ['supplier_order.create'] }]) {
      const deps = dependencies(action, patch); assert.ok([401, 403].includes((await call(deps, action)).status)); assert.equal(deps.queries.length, 0);
    }
    for (const resolver of [async () => null, async () => { throw Error('PRIVATE_SESSION_CREDENTIAL'); }]) {
      const deps = dependencies(action, {}, { resolver }); const result = await call(deps, action);
      assert.ok([401, 503].includes(result.status)); assert.equal(deps.queries.length, 0); assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
    }
  }
});

test('tenant_operator can save own partial request without MFA or key-generation permission', async () => {
  const deps = dependencies(); const result = await call(deps, 'create');
  assert.equal(result.status, 201); assert.equal(result.body.request.tenant_id, tenantId);
  assert.deepEqual(deps.calls, ['supplier_order.create']); assert.equal(deps.queries.length, 2);
  const input = JSON.parse(deps.queries[1].values[0]);
  assert.deepEqual(input, { action: 'create', tenant_id: tenantId, actor_id: actorId, auth_session_id: sessionId, request_id: null, idempotency_key: key, expected_revision: null, content });
  assert.doesNotMatch(deps.queries.map(q => q.statement).join('\n'), /nexid_create_supplier_order|batch_keys|supplier_sub_batches|manifest|INSERT INTO.*batches/i);
  assert.equal(result.body.request.quantity, null); assert.equal(result.body.request.pack_purpose, null);
});

test('tenant scope cannot be broadened by selectors, headers or a mismatched tenant row', async () => {
  for (const action of ['list', 'get', 'create', 'patch', 'submit']) {
    const foreign = dependencies(action); assert.equal((await call(foreign, action, content, '?tenant=qa-b')).status, 403); assert.equal(foreign.queries.length, 0);
    const unbound = dependencies(action, { tenantId: null, tenantSlug: null }); assert.equal((await call(unbound, action)).status, 403); assert.equal(unbound.queries.length, 0);
    const wrongId = dependencies(action, {}, { tenantRows: [{ id: otherTenant, slug: 'qa-a' }] }); assert.equal((await call(wrongId, action)).status, 403); assert.equal(wrongId.queries.length, 1);
  }
  for (const query of ['?tenant=qa-a&tenant=qa-a', '?tenant=qa-a&tenant=qa-b', '?tenant=qa-a&limit=1&limit=2', '?tenant=qa-a&status=draft&status=submitted', '?tenant=qa-a&unexpected=true']) {
    const deps = dependencies('list'); const result = await call(deps, 'list', content, query); assert.equal(result.status, 400, query); assert.equal(deps.queries.length, 0);
  }
  const dotted = dependencies('create', { tenantSlug: 'marca.ar' }, { row: { tenant_slug: 'marca.ar' } }); assert.equal((await call(dotted, 'create', content, '?tenant=marca.ar')).status, 201);
  const missing = await call(dependencies('get', {}, { rows: [] }), 'get'); assert.equal(missing.status, 404); assert.equal(missing.body.reason, 'supplier_request_not_found');
});

test('global inbox is superadmin-only, bounded, excludes drafts and returns no internal fields', async () => {
  const submitted = row({ ...complete, status: 'submitted', submitted_at: '2026-09-23T12:01:00.000Z', submitted_by: actorId, revision: 2, private: 'PRIVATE' });
  const global = dependencies('list', { role: 'super-admin', permissions: [], tenantId: null, tenantSlug: null }, { rows: [submitted] });
  const result = await call(global, 'list', content, ''); assert.equal(result.status, 200);
  assert.deepEqual(result.body.scope, { mode: 'global', tenant_id: null, tenant_slug: null }); assert.equal(result.body.items.length, 1);
  assert.equal(global.queries.length, 1); assert.match(global.queries[0].statement, /status IN \('submitted','provisioned'\)/);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  const polluted = dependencies('list', { role: 'super-admin', permissions: [], tenantId: null, tenantSlug: null }); assert.equal((await call(polluted, 'list', content, '')).status, 503);
  for (const query of ['?tenant=qa-a&limit=0', '?tenant=qa-a&limit=101', '?tenant=qa-a&status=unknown']) assert.equal((await call(dependencies('list'), 'list', content, query)).status, 400);
});

test('PATCH and submit bind expected revision and stable operation identity without generating an order', async () => {
  for (const action of ['patch', 'submit']) {
    const next = action === 'submit' ? { ...complete, status: 'submitted', submitted_by: actorId, submitted_at: '2026-09-23T12:01:00.000Z', revision: 2 } : { ...complete, revision: 2 };
    const deps = dependencies(action, {}, { row: next }); const body = action === 'submit' ? { expected_revision: 1 } : { ...complete, expected_revision: 1 };
    const result = await call(deps, action, body); assert.equal(result.status, 200);
    const input = JSON.parse(deps.queries.at(-1).values[0]); assert.equal(input.request_id, id); assert.equal(input.expected_revision, 1); assert.equal(input.idempotency_key, key);
    assert.deepEqual(input.content, action === 'submit' ? null : complete); assert.equal(result.body.request.order_id, null);
  }
  const evolved = row({ ...complete, revision: 4, status: 'submitted', submitted_at: '2026-09-23T12:01:00.000Z', submitted_by: actorId });
  const replay = dependencies('create', {}, { result: { ok: true, request: evolved, idempotent_replay: true, receipt: { idempotency_key: key, action: 'create', revision: 1 } } });
  const result = await call(replay, 'create'); assert.equal(result.status, 200); assert.equal(result.body.receipt.revision, 1); assert.equal(result.body.request.revision, 4); assert.equal(result.body.request.status, 'submitted');
});

test('write validation and provider failures cannot become success or expose untrusted details', async () => {
  for (const headers of [{ 'idempotency-key': '' }, { 'idempotency-key': 'not-uuid' }, { 'content-type': 'text/plain' }]) {
    const deps = dependencies(); assert.ok([400, 415].includes((await call(deps, 'create', content, undefined, id, headers)).status)); assert.equal(deps.queries.filter(q => /nexid_mutate/.test(q.statement)).length, 0);
  }
  for (const raw of ['{malformed', JSON.stringify({ ...content, notes: 'x'.repeat(40000) })]) {
    const deps = dependencies(); assert.ok([400, 413].includes((await call(deps, 'create', raw)).status)); assert.equal(deps.queries.length, 1);
  }
  for (const reason of ['supplier_request_revision_conflict', 'supplier_request_idempotency_conflict', 'supplier_request_not_draft', 'supplier_request_incomplete']) {
    const result = await call(dependencies('create', {}, { result: { ok: false, reason, current_revision: 4 } }), 'create'); assert.equal(result.status, 409); assert.equal(result.body.current_revision, 4);
  }
  for (const result of [{}, { ok: false, reason: 'PRIVATE_SQL' }, { ok: true, request: row({ tenant_id: otherTenant }), idempotent_replay: false, receipt: { idempotency_key: key, action: 'create', revision: 1 } }, { ok: true, request: row(), idempotent_replay: false, receipt: { idempotency_key: id, action: 'create', revision: 1 } }, { ok: true, request: row(), idempotent_replay: false, receipt: { idempotency_key: key, action: 'submit', revision: 1 } }, { ok: true, request: row(), idempotent_replay: false, receipt: { idempotency_key: key, action: 'create', revision: 2 } }]) {
    const response = await call(dependencies('create', {}, { result }), 'create'); assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(response), /PRIVATE/);
  }
  const thrown = await call(dependencies('create', {}, { throwSql: true }), 'create'); assert.equal(thrown.status, 503); assert.doesNotMatch(JSON.stringify(thrown), /PRIVATE/);
});

test('row projection rejects impossible lifecycle claims and strips unknown metadata', () => {
  assert.deepEqual(supplierRequestFromRow({ ...row(), fingerprint: 'PRIVATE' }), row());
  for (const patch of [{ status: 'invented' }, { status: 'submitted' }, { status: 'provisioned' }, { order_id: orderId }, { submitted_at: '2026-09-23T12:00:00.000Z' }, { revision: 0 }, { updated_at: 'bad-date' }]) assert.throws(() => supplierRequestFromRow(row(patch)));
});

test('malformed post-commit readback is unavailable, never a confirmed input rejection that permits a new create', async () => {
  for (const patch of [{ title: '' }, { quantity: -1 }, { notes: null }, { construction_id: 'unknown' }, { pack_purpose: 'unknown' }, { updated_at: 'bad-date' }]) {
    const deps = dependencies('create', {}, { result: { ok: true, request: row(patch), idempotent_replay: false, receipt: { idempotency_key: key, action: 'create', revision: 1 } } });
    const result = await call(deps, 'create');
    assert.equal(result.status, 503, JSON.stringify(patch));
    assert.equal(result.body.ok, false);
    assert.equal(deps.queries.filter(query => /nexid_mutate_supplier_request_v1/.test(query.statement)).length, 1);
  }
});

test('conversion preflight requires superadmin, submitted revision and exact commercial-to-technical binding', async () => {
  assert.equal(parseSupplierRequestSource({}), null);
  assert.deepEqual(parseSupplierRequestSource({ source_request_id: id, source_request_revision: 2 }), { id, revision: 2 });
  for (const candidate of [{ source_request_id: id }, { source_request_revision: 2 }, { source_request_id: id, source_request_revision: 0 }]) assert.throws(() => parseSupplierRequestSource(candidate));
  const submitted = row({ ...complete, revision: 2, status: 'submitted', submitted_at: '2026-09-23T12:01:00.000Z', submitted_by: actorId });
  const technical = { quantity: 125, purpose: 'trial_integration', carrier: 'ntag424_dna_tt', chip: 'NTAG424_DNA_TT', material: 'tagtamper_tail' };
  const principal = { scope: 'super_admin' }, tenant = { id: tenantId, slug: 'qa-a' };
  let queries = 0; const query = async () => { queries++; return [submitted]; };
  await assert.rejects(validateSupplierRequestConversion({ id, revision: 2 }, { scope: 'tenant_operator' }, tenant, technical, query), error => error.status === 403); assert.equal(queries, 0);
  assert.equal((await validateSupplierRequestConversion({ id, revision: 2 }, principal, tenant, technical, query)).id, id);
  for (const change of [{ quantity: 126 }, { purpose: 'production' }, { carrier: 'ntag424_dna' }, { chip: 'NTAG424_DNA' }, { material: 'white_wet_inlay' }]) await assert.rejects(validateSupplierRequestConversion({ id, revision: 2 }, principal, tenant, { ...technical, ...change }, query), error => error.message === 'supplier_request_order_mismatch');
  await assert.rejects(validateSupplierRequestConversion({ id, revision: 1 }, principal, tenant, technical, query), error => error.message === 'supplier_request_revision_conflict');
  for (const next of [row(), row({ ...submitted, status: 'provisioned', order_id: orderId })]) await assert.rejects(validateSupplierRequestConversion({ id, revision: 2 }, principal, tenant, technical, async () => [next]), error => error.status === 409);
});

test('routes expose only the intended read/create/patch/submit handlers', async () => {
  for (const [path, mapping] of [['../src/app/admin/supplier-requests/route.ts', ['handlers.list', 'handlers.create']], ['../src/app/admin/supplier-requests/[requestId]/route.ts', ['handlers.get', 'handlers.patch']], ['../src/app/admin/supplier-requests/[requestId]/submit/route.ts', ['handlers.submit']]]) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    for (const expected of mapping) assert.ok(source.includes(expected));
    assert.doesNotMatch(source, /ensureSchema|generateBatch|createSupplierOrder|manifestImport/);
  }
});
