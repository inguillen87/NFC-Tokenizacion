import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { checkAdminWithPermission } from '../src/lib/auth.ts';
import { handleAdminTicketWorkflowHistory as history, handleAdminTicketWorkflowTransition as transition, parseTicketWorkflowCommand } from '../src/lib/admin-ticket-workflow.ts';

const id = '81000000-0000-8000-8000-000000000001', tenantId = '10000000-0000-4000-8000-000000000001';
const actorId = '30000000-0000-4000-8000-000000000001', requestId = '41000000-0000-4000-8000-000000000001';
const command = { status: 'pending', reason: 'Synthetic QA review started', request_id: requestId, expected_revision: 'a'.repeat(64) };
const current = { ticketId: id, tenantId, tenantSlug: 'marca.ar', status: 'pending', revision: 'b'.repeat(64), updatedAt: '2026-09-22T00:00:00.123456+00:00', canUpdate: true, blockedReason: null };
const receipt = { operationId: '51000000-0000-4000-8000-000000000001', requestId, sequence: '2', fromStatus: 'open', toStatus: 'pending', reason: command.reason, actor: { id: actorId, label: 'Synthetic operator' }, createdAt: '2026-09-22T00:00:00.123456+00:00', revision: current.revision };
const readResult = { ok: true, current, items: [receipt], page: { hasMore: false, nextCursor: null } };
const writeResult = { ok: true, current, receipt, outcome: 'updated' };
function request(write = false, body = command, query = '', headers = {}) { return new Request(`https://api.example.invalid/admin/tickets/${id}${write ? '' : '/history'}${query}`, { method: write ? 'PATCH' : 'GET', headers: { authorization: 'Bearer synthetic-local-session', ...(write ? { 'content-type': 'application/json' } : {}), 'x-admin-tenant': 'other', ...headers }, ...(write ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }); }
function session(patch = {}) { return { id: '20000000-0000-4000-8000-000000000001', userId: actorId, email: 'qa@example.invalid', label: 'Synthetic operator', role: 'tenant-admin', tenantId, tenantSlug: 'marca.ar', permissions: ['leads.manage'], deniedPermissions: [], mfaVerified: true, expiresAt: new Date(Date.now() + 60000).toISOString(), rotatedCookieValue: null, setupCompleted: true, ...patch }; }
function dependencies(result = readResult, patch = {}) { const state = { queries: 0, values: null, statement: null }; return { state, value: { authorize: (req, permission) => checkAdminWithPermission(req, permission, async () => session(patch)), execute: async (strings, ...values) => { state.queries++; state.statement = strings.join('?'); state.values = values; return [{ result }]; } } }; }
function privateResponse(response) { assert.match(response.headers.get('cache-control'), /private.*no-store/); assert.equal(response.headers.get('referrer-policy'), 'no-referrer'); }
async function call(write, deps, body = command, query = '', reference = id) { const response = await (write ? transition : history)(request(write, body, query), reference, deps.value); privateResponse(response); return { status: response.status, body: await response.json() }; }

test('actual role, deny and session gates run before any workflow SQL for both methods', async () => {
  for (const write of [false, true]) {
    for (const patch of [{ permissions: [] }, { deniedPermissions: ['leads.manage'] }, { role: 'super-admin', tenantId: null, tenantSlug: null, permissions: [], deniedPermissions: ['leads.manage'] }, { role: 'security-operator' }, { role: 'api-integration' }, { role: 'reseller-admin', permissions: [] }, { tenantId: null, tenantSlug: null }]) {
      const deps = dependencies(write ? writeResult : readResult, patch); const result = await call(write, deps);
      assert.equal(result.status, 403); assert.equal(deps.state.queries, 0);
    }
    for (const resolver of [async () => null, async () => { throw Error('PRIVATE_SESSION'); }]) {
      let queries = 0; const response = await (write ? transition : history)(request(write), id, { authorize: (req, permission) => checkAdminWithPermission(req, permission, resolver), execute: async () => { queries++; return []; } });
      assert.ok([401, 503].includes(response.status)); assert.equal(queries, 0); privateResponse(response); assert.doesNotMatch(await response.text(), /PRIVATE/);
    }
    const missing = dependencies(); const response = await (write ? transition : history)(request(write, command, '', { authorization: '' }), id, missing.value);
    assert.equal(response.status, 401); assert.equal(missing.state.queries, 0); privateResponse(response);
    assert.equal((await call(write, dependencies(write ? writeResult : readResult, { role: 'reseller-admin' }))).status, 200);
  }
});

test('command rejects unbounded, forged, secret-bearing or unrecognized fields without echo', async () => {
  assert.deepEqual(parseTicketWorkflowCommand({ ...command, reason: '  Valid reason  ', request_id: requestId.toUpperCase() }), { ...command, reason: 'Valid reason' });
  assert.equal(parseTicketWorkflowCommand({ ...command, reason: '  Natural\r\nmultiline\treason  ' }).reason, 'Natural multiline reason');
  for (const value of [null, [], {}, { ...command, status: 'legacy' }, { ...command, reason: ' ' }, { ...command, reason: 'x'.repeat(1001) }, { ...command, reason: 'control\u0001character' }, { ...command, reason: 'TOKEN=private-test-token' }, { ...command, reason: 'a'.repeat(64) }, { ...command, request_id: 'not-uuid' }, { ...command, expected_revision: 'B'.repeat(64) }, { ...command, actor_id: actorId }, { ...command, tenant: 'other' }]) {
    assert.equal(parseTicketWorkflowCommand(value), null);
    const deps = dependencies(writeResult); const result = await call(true, deps, value);
    assert.deepEqual(result, { status: 400, body: { ok: false, reason: 'ticket_workflow_invalid_request' } }); assert.equal(deps.state.queries, 0);
  }
  for (const body of ['{malformed', JSON.stringify({ ...command, reason: 'x'.repeat(9000) })]) {
    const deps = dependencies(writeResult); assert.equal((await call(true, deps, body)).status, 400); assert.equal(deps.state.queries, 0);
  }
  const deps = dependencies(writeResult); const response = await transition(request(true, command, '', { 'content-type': 'text/plain' }), id, deps.value);
  assert.equal(response.status, 400); assert.equal(deps.state.queries, 0);
  const mismatched = dependencies(writeResult); const keyResponse = await transition(request(true, command, '', { 'idempotency-key': id }), id, mismatched.value);
  assert.equal(keyResponse.status, 400); assert.equal(mismatched.state.queries, 0);
});

test('canonical reference, bounded cursor and tenant selectors cannot broaden authority', async () => {
  for (const write of [false, true]) {
    for (const reference of ['715', ' ' + id, '00000000-0000-0000-0000-000000000000', "' OR true --", null]) {
      const deps = dependencies(); assert.equal((await call(write, deps, command, '', reference)).status, 400); assert.equal(deps.state.queries, 0);
    }
    for (const query of ['?tenant=marca.ar&tenant=marca.ar', '?tenant=invalid%2Fslug', '?cursor=0', '?cursor=9223372036854775808', '?cursor=1&cursor=2', ...(write ? ['?cursor=1'] : [])]) {
      const deps = dependencies(); assert.equal((await call(write, deps, command, query)).status, 400); assert.equal(deps.state.queries, 0);
    }
    const scope = dependencies(); const foreign = await call(write, scope, command, '?tenant=other'); assert.equal(scope.state.queries, 0);
    const absent = await call(write, dependencies({ ok: false, reason: 'ticket_not_found' }));
    assert.deepEqual(foreign, absent); assert.equal(foreign.status, 404);
  }
});

test('SQL binds only session-derived tenant and actor and returns a minimal current plus immutable receipt', async () => {
  const deps = dependencies({ ...writeResult, private: 'PRIVATE', current: { ...current, contact: 'PRIVATE' }, receipt: { ...receipt, fingerprint: 'PRIVATE', actor: { ...receipt.actor, email: 'PRIVATE' } } });
  const result = await call(true, deps, { ...command, reason: '  ' + command.reason + '  ' });
  assert.equal(result.status, 200); assert.equal(deps.state.queries, 1);
  assert.match(deps.state.statement, /SELECT public\.nexid_transition_support_ticket_v1/);
  assert.deepEqual(deps.state.values, [id, tenantId, 'marca.ar', actorId, 'Synthetic operator', command.expected_revision, command.status, command.reason, requestId]);
  assert.equal(result.body.protocol, 'nexid.support-ticket-workflow.v1');
  assert.deepEqual(result.body.scope, { mode: 'tenant', tenantId, tenantSlug: 'marca.ar' });
  assert.equal(result.body.current.updatedAt, '2026-09-22T00:00:00.123Z');
  assert.equal(result.body.receipt.actor.id, actorId); assert.doesNotMatch(JSON.stringify(result.body), /PRIVATE|fingerprint|contact|email/);
});

test('replay of an old receipt leaves the latest current status authoritative', async () => {
  const result = await call(true, dependencies({ ...writeResult, outcome: 'replayed', current: { ...current, status: 'closed', revision: 'c'.repeat(64) } }));
  assert.equal(result.status, 200); assert.equal(result.body.receipt.toStatus, 'pending'); assert.equal(result.body.current.status, 'closed'); assert.equal(result.body.outcome, 'replayed');
  const impossibleUpdated = await call(true, dependencies({ ...writeResult, current: { ...current, status: 'closed' } })); assert.equal(impossibleUpdated.status, 503);
});

test('server refusal, unavailable storage and malformed commits never invent success', async () => {
  for (const [reason, status] of [['forbidden', 403], ['ticket_not_found', 404], ['ticket_workflow_invalid_request', 400], ['ticket_workflow_no_change', 400], ['ticket_workflow_conflict', 409], ['ticket_workflow_blocked', 409], ['PRIVATE_SQL', 503]]) {
    const result = await call(true, dependencies({ ok: false, reason })); assert.equal(result.status, status); assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  }
  for (const result of [null, {}, { ...writeResult, receipt: null }, { ...writeResult, receipt: { ...receipt, requestId: id } }, { ...writeResult, receipt: { ...receipt, actor: { ...receipt.actor, id } } }, { ...writeResult, current: { ...current, tenantId: id } }, { ...writeResult, current: { ...current, updatedAt: null } }, { ...writeResult, outcome: 'invented' }]) {
    assert.equal((await call(true, dependencies(result))).status, 503);
  }
  const deps = dependencies(); deps.value.execute = async () => { throw Error('PRIVATE_SQL credential'); };
  const unavailable = await call(true, deps); assert.deepEqual(unavailable, { status: 503, body: { ok: false, reason: 'ticket_workflow_unavailable' } });
});

test('history preserves legacy read-only states and validates the exact ordered page', async () => {
  for (const [status, blockedReason, scopedTenant] of [['pending', 'incident_managed', tenantId], ['legacy-resolved', 'legacy_status', tenantId], ['open', 'tenant_unassigned', null]]) {
    const deps = dependencies({ ...readResult, current: { ...current, status, canUpdate: false, blockedReason, tenantId: scopedTenant, tenantSlug: scopedTenant ? 'marca.ar' : null } }, scopedTenant ? {} : { role: 'super-admin', tenantId: null, tenantSlug: null, permissions: [] });
    const result = await call(false, deps); assert.equal(result.status, 200); assert.equal(result.body.current.status, status); assert.equal(result.body.current.canUpdate, false);
  }
  const deps = dependencies(); assert.equal((await call(false, deps, command, '?cursor=3')).status, 200);
  assert.deepEqual(deps.state.values, [id, tenantId, 'marca.ar', '3']);
  for (const result of [{ ...readResult, items: [receipt, receipt] }, { ...readResult, page: { hasMore: true, nextCursor: '2' } }, { ...readResult, page: { hasMore: false, nextCursor: '2' } }, { ...readResult, items: [{ ...receipt, sequence: '0' }] }]) assert.equal((await call(false, dependencies(result))).status, 503);
  assert.equal((await call(false, dependencies(), command, '?cursor=2')).status, 503);
  const items = Array.from({ length: 50 }, (_, n) => ({ ...receipt, sequence: String(100 - n) }));
  const valid = await call(false, dependencies({ ...readResult, items, page: { hasMore: true, nextCursor: '51' } })); assert.equal(valid.status, 200); assert.equal(valid.body.page.nextCursor, '51');
});

test('superadmin selected slug narrows SQL while global scope remains explicitly global', async () => {
  const principal = { role: 'super-admin', tenantId: null, tenantSlug: null, permissions: [] };
  for (const write of [true, false]) for (const selected of [false, true]) {
    const deps = dependencies(write ? writeResult : readResult, principal);
    const result = await call(write, deps, command, selected ? '?tenant=marca.ar' : '');
    assert.equal(result.status, 200); assert.deepEqual(deps.state.values.slice(0, 3), [id, null, selected ? 'marca.ar' : null]);
    assert.deepEqual(result.body.scope, { mode: selected ? 'tenant' : 'global', tenantId: selected ? tenantId : null, tenantSlug: selected ? 'marca.ar' : null });
  }
});

test('real Next routes delegate PATCH and GET history to authenticated workflow handlers', async () => {
  for (const [path, method, handler] of [['../src/app/admin/tickets/[id]/route.ts', 'PATCH', 'handleAdminTicketWorkflowTransition'], ['../src/app/admin/tickets/[id]/history/route.ts', 'GET', 'handleAdminTicketWorkflowHistory']]) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8'); const ast = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
    const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === method);
    const js = ts.transpileModule(node.getText(ast).replace(/^export\s+/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    let called; const route = new Function(handler, js + `;return ${method};`)((req, reference) => { called = { req, reference }; return Response.json({ ok: true }); });
    const req = request(method === 'PATCH'); assert.equal((await route(req, { params: Promise.resolve({ id }) })).status, 200); assert.deepEqual(called, { req, reference: id });
    assert.doesNotMatch(source, /ensure.*Schema|logAuditEvent/);
  }
});

test('release explicitly declares the required structural migration and compatible existing protocols', async () => {
  const release = JSON.parse(await readFile(new URL('../public/release.json', import.meta.url), 'utf8'));
  assert.equal(release.supportTicketWorkflowProtocol, 'nexid.support-ticket-workflow.v1'); assert.equal(release.databaseMigrationsIncluded, true);
  assert.match(JSON.stringify(release), /0112_support_ticket_workflow/);
  assert.equal(release.supportTicketLookupProtocol, 'nexid.support-ticket-lookup.v1'); assert.equal(release.supportReportProtocol, 'nexid.support-report.v1');
});
