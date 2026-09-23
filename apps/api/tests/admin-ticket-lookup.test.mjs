import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { checkAdminWithPermission } from '../src/lib/auth.ts';
import { handleAdminTicketLookup, projectTicketLookupDetail } from '../src/lib/admin-ticket-lookup.ts';

const id = '81000000-0000-8000-8000-000000000001';
const tenantId = '10000000-0000-4000-8000-000000000001';
const sourceDetail = JSON.stringify({ protocol: 'nexid.support-report.v1', category: 'seal_opened', description: 'Synthetic reported problem', fingerprint: 'a'.repeat(64), consumer_id: 'PRIVATE_CONSUMER', uid_hex: 'PRIVATE_UID', support_token: 'PRIVATE_TOKEN' });
const row = { id, title: 'Synthetic ticket', detail: sourceDetail, status: 'open', contact: 'qa@example.invalid', created_at: '2020-01-02T03:04:05.000Z', source: 'sun_public_report', category: 'seal_opened', locale: 'es-AR', bid: 'QA-ONLY', tap_event_id: '715', tenant_id: tenantId, tenant_slug: 'qa-a', tenant_name: 'QA tenant', uid_hex: 'PRIVATE_UID', unexpected: 'PRIVATE_EXTRA' };
const request = (query = '', bearer = true) => new Request(`https://api.example.invalid/admin/tickets/${id}${query}`, { headers: { ...(bearer ? { authorization: 'Bearer synthetic-test-session' } : {}), 'x-admin-tenant': 'qa-b' } });
function session(patch = {}) { return { id: '20000000-0000-4000-8000-000000000001', userId: '30000000-0000-4000-8000-000000000001', email: 'qa@example.invalid', label: 'QA', role: 'tenant-admin', tenantId, tenantSlug: 'qa-a', permissions: ['leads.manage'], deniedPermissions: [], mfaVerified: true, expiresAt: new Date(Date.now() + 60000).toISOString(), rotatedCookieValue: null, setupCompleted: true, ...patch }; }
function dependencies(patch = {}, result = [row]) { const state = { queries: 0, resolutions: 0 }; return { state, value: { authorize: (req, permission) => checkAdminWithPermission(req, permission, async () => { state.resolutions++; return session(patch); }), execute: async () => { state.queries++; return result; } } }; }
function privateResponse(response) { assert.match(response.headers.get('cache-control'), /private.*no-store/); assert.equal(response.headers.get('referrer-policy'), 'no-referrer'); }

test('actual admin authorization enforces capability, role deny and revocable session before ticket SQL', async () => {
  for (const [patch, expected] of [
    [{ permissions: [] }, 403], [{ deniedPermissions: ['leads.manage'] }, 403],
    [{ role: 'super-admin', tenantId: null, tenantSlug: null, permissions: [], deniedPermissions: ['leads.manage'] }, 403],
    [{ role: 'security-operator', permissions: ['leads.manage'] }, 403],
    [{ role: 'api-integration', permissions: ['leads.manage'] }, 403],
    [{ role: 'reseller-admin', permissions: [] }, 403],
    [{ tenantId: null, tenantSlug: null }, 403],
  ]) {
    const deps = dependencies(patch); const response = await handleAdminTicketLookup(request(), id, deps.value);
    assert.equal(response.status, expected); assert.equal(deps.state.queries, 0); privateResponse(response);
  }
  const noBearer = dependencies(); const missing = await handleAdminTicketLookup(request('', false), id, noBearer.value);
  assert.equal(missing.status, 401); assert.equal(noBearer.state.resolutions, 0); assert.equal(noBearer.state.queries, 0); privateResponse(missing);
  for (const resolver of [async () => null, async () => { throw Error('private session failure'); }]) {
    let queries = 0; const response = await handleAdminTicketLookup(request(), id, { authorize: (req, permission) => checkAdminWithPermission(req, permission, resolver), execute: async () => { queries++; return [row]; } });
    assert.ok([401, 503].includes(response.status)); assert.equal(queries, 0); privateResponse(response);
  }
  const reseller = dependencies({ role: 'reseller-admin' }); assert.equal((await handleAdminTicketLookup(request(), id, reseller.value)).status, 200); assert.equal(reseller.state.queries, 1);
});

test('canonical UUID and tenant selector validation cannot become SQL or broaden tenant scope', async () => {
  for (const bad of [null, 715, '', '715', id.replaceAll('-', ''), ' ' + id, "' OR true --", '00000000-0000-0000-0000-000000000000']) {
    const deps = dependencies(); const response = await handleAdminTicketLookup(request(), bad, deps.value);
    assert.equal(response.status, 400); assert.equal((await response.json()).reason, 'ticket_id_invalid'); assert.equal(deps.state.queries, 0); privateResponse(response);
  }
  for (const query of ['?tenant=qa-a&tenant=qa-a', '?tenant=invalid%2Fslug', '?tenant=' + 'a'.repeat(129)]) {
    const deps = dependencies(); const response = await handleAdminTicketLookup(request(query), id, deps.value);
    assert.equal(response.status, 400); assert.equal((await response.json()).reason, 'ticket_tenant_invalid'); assert.equal(deps.state.queries, 0); privateResponse(response);
  }
  const conflict = dependencies(); const denied = await handleAdminTicketLookup(request('?tenant=qa-b'), id, conflict.value);
  assert.equal(denied.status, 404); assert.equal(conflict.state.queries, 0);
  const missing = dependencies({}, []); const notFound = await handleAdminTicketLookup(request(), id, missing.value);
  assert.equal(notFound.status, 404); assert.deepEqual(await denied.json(), await notFound.json()); privateResponse(denied); privateResponse(notFound);
});

test('lookup binds exact ticket and principal scope and only projects the approved ticket fields', async () => {
  const deps = dependencies(); let statement, values;
  const response = await handleAdminTicketLookup(request('?tenant=QA-A'), id.toUpperCase(), { ...deps.value, execute: async (strings, ...bound) => { statement = strings.join('?'); values = bound; return [row]; } });
  assert.equal(response.status, 200); privateResponse(response);
  assert.deepEqual(values, [id, tenantId, tenantId, 'qa-a', 'qa-a']);
  assert.match(statement, /WHERE ticket\.id=\?::uuid/); assert.match(statement, /ticket\.tenant_id=\?::uuid/);
  assert.doesNotMatch(statement, /SELECT\s+(?:ticket\.)?\*|uid_hex|\b(?:INSERT|UPDATE|ALTER|CREATE|DELETE)\b|LIMIT 300|ORDER BY/i);
  const payload = await response.json(); assert.equal(payload.protocol, 'nexid.support-ticket-lookup.v1');
  assert.deepEqual(payload.scope, { mode: 'tenant', tenantId, tenantSlug: 'qa-a' });
  assert.deepEqual(Object.keys(payload.ticket).sort(), ['id', 'title', 'detail', 'detail_state', 'status', 'contact', 'created_at', 'source', 'category', 'locale', 'bid', 'tap_event_id', 'tenant_id', 'tenant_slug', 'tenant_name'].sort());
  assert.equal(payload.ticket.detail_state, 'available');
  assert.deepEqual(JSON.parse(payload.ticket.detail), { protocol: 'nexid.support-report.v1', category: 'seal_opened', description: 'Synthetic reported problem' });
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_|fingerprint|consumer_id|uid_hex|support_token|unexpected/);
});

test('authorized superadmin keeps global access but an explicit selector restricts the same SQL', async () => {
  const deps = dependencies({ role: 'super-admin', tenantId: null, tenantSlug: null, permissions: [] });
  for (const [query, expectedValues, mode] of [['', [id, null, null, null, null], 'global'], ['?tenant=qa-a', [id, null, null, 'qa-a', 'qa-a'], 'tenant']]) {
    const response = await handleAdminTicketLookup(request(query), id, { ...deps.value, execute: async (_, ...values) => { assert.deepEqual(values, expectedValues); return [row]; } });
    assert.equal(response.status, 200); const payload = await response.json(); assert.equal(payload.scope.mode, mode);
    assert.equal(payload.scope.tenantId, mode === 'global' ? null : tenantId);
  }
});

test('unavailable and malformed readers fail closed without private errors or cacheable responses', async () => {
  const deps = dependencies();
  for (const execute of [async () => { throw Error('private SQL connection credentials'); }, async () => [row, row], async () => [{ ...row, id: 'other' }], async () => [{ ...row, created_at: 'invalid' }], async () => [{ ...row, tenant_id: 'other' }]]) {
    const response = await handleAdminTicketLookup(request(), id, { ...deps.value, execute });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { ok: false, reason: 'ticket_lookup_unavailable' }); privateResponse(response);
  }
  const malformedPrincipal = await handleAdminTicketLookup(request(), id, { ...deps.value, principal: () => ({ scope: 'tenant_admin', tenantId: null, tenantSlug: null }) });
  assert.equal(malformedPrincipal.status, 403); assert.equal(deps.state.queries, 0); privateResponse(malformedPrincipal);
});

test('legacy detail remains literal while known report envelopes omit operational bindings', () => {
  for (const legacy of ['Historical text', '{"legacy":"<b>literal</b>"}', '{malformed historical JSON']) assert.equal(projectTicketLookupDetail(legacy), legacy);
  assert.equal(projectTicketLookupDetail(null), null);
  assert.equal(projectTicketLookupDetail(JSON.stringify({ protocol: 'nexid.support-report.v1', category: 'other', fingerprint: 'private' })), null);
});

test('existing dotted and long tenant slugs are supported and unavailable detail is distinct from absent detail', async () => {
  for (const slug of ['marca.ar', 'a'.repeat(81), 'a'.repeat(128)]) {
    const deps = dependencies({ tenantSlug: slug }, [{ ...row, tenant_slug: slug }]);
    const response = await handleAdminTicketLookup(request('?tenant=' + slug), id, deps.value);
    assert.equal(response.status, 200); assert.equal((await response.json()).scope.tenantSlug, slug);
  }
  for (const [detail, expected] of [[null, 'not_recorded'], ['', 'not_recorded'], [JSON.stringify({ protocol: 'nexid.support-report.v1', fingerprint: 'private' }), 'unavailable']]) {
    const deps = dependencies({}, [{ ...row, detail }]);
    const response = await handleAdminTicketLookup(request(), id, deps.value); assert.equal(response.status, 200);
    const payload = await response.json(); assert.equal(payload.ticket.detail_state, expected); assert.doesNotMatch(JSON.stringify(payload), /fingerprint|private/);
  }
});

test('actual GET route preserves authenticated lookup and PATCH delegates only to the workflow', async () => {
  const source = await readFile(new URL('../src/app/admin/tickets/[id]/route.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true), node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'GET');
  const js = ts.transpileModule(node.getText(ast).replace(/^export\s+/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  let called; const route = new Function('handleAdminTicketLookup', js + ';return GET;')((req, reference) => { called = { req, reference }; return Response.json({ ok: true }); });
  const req = request(); assert.equal((await route(req, { params: Promise.resolve({ id }) })).status, 200); assert.deepEqual(called, { req, reference: id });
  assert.doesNotMatch(source, /export async function (?:POST|PUT|DELETE)|ensureTicketsSchema/);
  assert.match(source, /return handleAdminTicketWorkflowTransition\(req, id\)/);
});

test('release preserves the additive lookup and support contracts alongside the workflow', async () => {
  const release = JSON.parse(await readFile(new URL('../public/release.json', import.meta.url), 'utf8'));
  assert.equal(release.release, '2026.09.23-api-supplier-requests.1');
  assert.equal(release.supportTicketLookupProtocol, 'nexid.support-ticket-lookup.v1');
  assert.equal(release.supportReportProtocol, 'nexid.support-report.v1');
  assert.equal(release.requiredDashboardRelease, '2026.09.21-dashboard.30');
  assert.equal(release.databaseMigrationsIncluded, true);
});
