import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
import ts from 'typescript';
import { createMemberTimelineReader } from '../src/lib/customer-member-timeline-reader.ts';
import * as timeline from '../src/lib/customer-member-timeline.ts';
import * as scopePolicy from '../src/lib/dashboard-tenant-scope-policy.ts';
import * as permissions from '../src/lib/permission-policy.ts';
import { readTicketResponse } from '../src/lib/ticket-request-deadline.ts';

const ID = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';
const SCOPE = { tenant: 'qa-only', consumerId: ID };
const entry = (sourceId = 'row-1') => ({ sourceKind: 'consumer_tap', sourceId, occurredAt: '2026-09-22T12:00:00.000Z', dataMode: 'production', provenance: { persistence: 'durable', relation: 'consumer_tap_history', dataModeField: 'events.source' }, correlation: { consumerId: ID, tapEventId: '42', basis: ['consumer_id', 'tap_event_id'] }, data: { verdict: 'VALID', city: 'Synthetic city' } });
const payload = (patch = {}) => ({ ok: true, ...SCOPE, order: 'desc', items: [entry()], page: { hasMore: false, nextCursor: null }, partial: false, sourceErrors: [], ...patch });
const response = (body = payload(), status = 200) => Response.json(body, { status, headers: { 'x-nexid-data-mode': 'production' } });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function tracked(promise) { const state = { settled: false }; promise.then(value => Object.assign(state, { settled: true, value }), error => Object.assign(state, { settled: true, error })); return state; }

for (const stage of ['headers', 'body']) {
  test(`manual pagination settles after one deadline even with noncooperative ${stage}`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = deferred(); let signal;
    const reader = createMemberTimelineReader(SCOPE, (_, options) => {
      signal = options.signal;
      if (stage === 'headers') return pending.promise;
      const value = response(); value.json = () => pending.promise; return Promise.resolve(value);
    });
    const result = tracked(reader.read('page-a')); await nextTurn();
    t.mock.timers.tick(14999); await nextTurn(); assert.equal(result.settled, false);
    t.mock.timers.tick(1); await nextTurn();
    assert.equal(signal.aborted, true); assert.equal(reader.isBusy(), false);
    assert.deepEqual(result.value, { status: 'unavailable' });
    pending.resolve(stage === 'headers' ? response() : payload()); await nextTurn();
    assert.deepEqual(result.value, { status: 'unavailable' }); assert.equal(result.error, undefined);
  });
}

test('only manual GET with fixed member, tenant and cursor is requested and overlapping clicks are ignored', async () => {
  const pending = deferred(); const calls = [];
  const reader = createMemberTimelineReader(SCOPE, (url, options) => { calls.push({ url, options }); return pending.promise; });
  assert.equal(calls.length, 0);
  const first = reader.read('page-a'); assert.equal(reader.isBusy(), true);
  assert.equal(await reader.read('page-a'), null); assert.equal(calls.length, 1);
  const { url, options } = calls[0];
  assert.equal(url, `/api/customer-member-timeline/${ID}?tenant=qa-only&cursor=page-a`);
  for (const [key, value] of Object.entries({ method: 'GET', cache: 'no-store', credentials: 'same-origin', redirect: 'error' })) assert.equal(options[key], value);
  pending.resolve(response()); assert.equal((await first).status, 'ready'); assert.equal(reader.isBusy(), false);
});

test('cancel frees the control immediately; late completion cannot steal the retry or its page', async () => {
  const waiting = [deferred(), deferred()]; const calls = [];
  const reader = createMemberTimelineReader(SCOPE, (url, options) => { calls.push({ url, options }); return waiting[calls.length - 1].promise; });
  const old = tracked(reader.read('page-a')); reader.cancel(); await nextTurn();
  assert.equal(old.value, null); assert.equal(reader.isBusy(), false);
  const fresh = tracked(reader.read('page-a')); waiting[0].resolve(response()); await nextTurn();
  assert.equal(fresh.settled, false); assert.equal(reader.isBusy(), true);
  assert.equal(calls[0].url, calls[1].url);
  waiting[1].resolve(response(payload({ items: [entry('current-page')] }))); await nextTurn();
  assert.equal(fresh.value.page.items[0].sourceId, 'current-page'); assert.equal(reader.isBusy(), false);
});

for (const [status, expected] of [[401, 'access_denied'], [403, 'access_denied'], [404, 'member_not_found'], [400, 'invalid_payload'], [422, 'invalid_payload'], [502, 'unavailable'], [503, 'unavailable']]) {
  test(`pagination classifies HTTP ${status} without fabricating an empty page`, async () => {
    const reader = createMemberTimelineReader(SCOPE, async () => response({ privateDetails: 'never display upstream body' }, status));
    assert.deepEqual(await reader.read('page-a'), { status: expected });
  });
}

test('failed page stays retryable without changing member, company or cursor', async () => {
  const calls = [];
  const reader = createMemberTimelineReader(SCOPE, async url => { calls.push(url); return calls.length === 1 ? response({}, 503) : response(); });
  assert.equal((await reader.read('page-a')).status, 'unavailable');
  assert.equal((await reader.read('page-a')).status, 'ready'); assert.equal(calls[0], calls[1]);
});

test('foreign tenant, foreign member, foreign correlation and malformed bodies never confirm a page', async () => {
  for (const body of [payload({ tenant: 'other' }), payload({ consumerId: OTHER }), payload({ items: [{ ...entry(), correlation: { ...entry().correlation, consumerId: OTHER } }] }), null, {}, { ok: true, items: [] }]) {
    assert.deepEqual(await createMemberTimelineReader(SCOPE, async () => response(body)).read('page-a'), { status: 'invalid_payload' });
  }
});

test('repeated or cycling cursors stop pagination instead of reopening old pages', async () => {
  const repeated = createMemberTimelineReader(SCOPE, async () => response(payload({ page: { hasMore: true, nextCursor: 'page-a' } })));
  assert.equal((await repeated.read('page-a')).status, 'invalid_payload');
  let calls = 0;
  const cycling = createMemberTimelineReader(SCOPE, async () => response(payload({ page: { hasMore: true, nextCursor: ++calls === 1 ? 'page-b' : 'page-a' } })));
  assert.equal((await cycling.read('page-a')).status, 'ready');
  assert.equal((await cycling.read('page-b')).status, 'invalid_payload');
  assert.equal((await cycling.read('page-a')).status, 'invalid_payload'); assert.equal(calls, 2);
});

test('partial sources preserve confirmed entries but cannot advance beyond missing history', async () => {
  const reader = createMemberTimelineReader(SCOPE, async () => response(payload({ partial: false, sourceErrors: [{ sourceKind: 'incident', code: 'unavailable', retryable: true }], page: { hasMore: true, nextCursor: 'page-b' } })));
  const result = await reader.read('page-a');
  assert.equal(result.status, 'ready'); assert.equal(result.page.items.length, 1);
  assert.equal(result.page.partial, true); assert.equal(result.page.hasMore, false); assert.equal(result.page.nextCursor, null);
});

test('invalid scope or cursor causes no network request', async () => {
  for (const scope of [{ ...SCOPE, tenant: '' }, { ...SCOPE, tenant: 'qa&tenant=other' }, { ...SCOPE, consumerId: 'other' }, { tenant: null, consumerId: ID }]) {
    const reader = createMemberTimelineReader(scope, async () => assert.fail('Unexpected network request'));
    assert.equal((await reader.read('page-a')).status, 'invalid_payload');
  }
  assert.equal((await createMemberTimelineReader(SCOPE, async () => assert.fail('Unexpected network')).read('unsafe cursor')).status, 'invalid_payload');
});

test('success removes its deadline and late errors after cancellation are consumed', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let signal;
  const reader = createMemberTimelineReader(SCOPE, async (_, options) => { signal = options.signal; return response(); });
  assert.equal((await reader.read('page-a')).status, 'ready'); t.mock.timers.tick(30000); assert.equal(signal.aborted, false);
  const pending = deferred(); const slow = createMemberTimelineReader(SCOPE, () => pending.promise);
  const state = tracked(slow.read('page-a')); slow.cancel(); await nextTurn(); pending.reject(Error('synthetic failure')); await nextTurn();
  assert.equal(state.value, null); assert.equal(state.error, undefined);
});

const routeSource = await readFile(new URL('../src/app/api/customer-member-timeline/[consumerId]/route.ts', import.meta.url), 'utf8');
const session = () => ({ id: 'synthetic-session', role: 'tenant-admin', tenantSlug: 'qa-only', tenantId: '20000000-0000-4000-8000-000000000001', permissions: ['consumers.read_pii', 'incidents:read'], deniedPermissions: [], isDemo: false });
function routeHarness(fetcher, patch = {}, credentialPatch = {}) {
  const credential = { session: { ...session(), ...patch }, bearerToken: 'synthetic-test-bearer', ...credentialPatch };
  const imports = { 'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } }, '@product/config': { productUrls: { api: 'https://synthetic-upstream.invalid' } } };
  const module = { exports: {} };
  const require = name => {
    if (imports[name]) return imports[name];
    if (name.endsWith('ticket-request-deadline')) return { readTicketResponse };
    if (name.endsWith('dashboard-tenant-scope-policy')) return scopePolicy;
    if (name.endsWith('customer-member-timeline')) return timeline;
    if (name.endsWith('permission-policy')) return permissions;
    if (name.endsWith('/session')) return { getDashboardSessionCredential: async () => credential };
    throw Error(`Unexpected import ${name}`);
  };
  const js = ts.transpileModule(routeSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', 'fetch', js)(require, module, module.exports, fetcher);
  return (signal) => module.exports.GET(new Request(`https://synthetic-dashboard.invalid/api/customer-member-timeline/${ID}?tenant=qa-only&cursor=page-a`, { signal }), { params: Promise.resolve({ consumerId: ID }) });
}

test('actual BFF preserves credential authority, no-store, no redirects and sanitized output', async () => {
  const calls = []; const run = routeHarness(async (url, options) => { calls.push({ url, options }); return response(payload({ items: [{ ...entry(), data: { ...entry().data, contact: 'not-approved@example.invalid' } }] })); });
  const result = await run(); assert.equal(result.status, 200);
  assert.equal(calls[0].options.headers.authorization, 'Bearer synthetic-test-bearer');
  assert.equal(calls[0].options.redirect, 'error'); assert.equal(calls[0].options.cache, 'no-store');
  const url = new URL(calls[0].url); assert.equal(url.hostname, 'synthetic-upstream.invalid'); assert.equal(url.searchParams.get('tenant'), 'qa-only'); assert.equal(url.searchParams.get('cursor'), 'page-a');
  assert.match(result.headers.get('cache-control'), /private, no-store/);
  assert.doesNotMatch(await result.text(), /not-approved|synthetic-test-bearer/);
});

for (const patch of [{ permissions: ['consumers.read_pii'] }, { deniedPermissions: ['incidents:read'] }, { deniedPermissions: ['consumers.read_pii'] }, { tenantSlug: 'other-company' }, { isDemo: true }]) {
  test(`actual BFF rejects ${JSON.stringify(patch)} before contacting the API`, async () => {
    assert.equal((await routeHarness(async () => assert.fail('Unexpected upstream request'), patch)()).status, 403);
  });
}

for (const stage of ['headers', 'body']) {
  test(`actual BFF bounds stalled ${stage} and does not return raw data after expiration`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] }); const pending = deferred();
    const run = routeHarness(() => { if (stage === 'headers') return pending.promise; const value = response(); value.json = () => pending.promise; return Promise.resolve(value); });
    const state = tracked(run()); await nextTurn(); t.mock.timers.tick(15000); await nextTurn();
    assert.equal(state.settled, true); assert.equal(state.value.status, 503);
    assert.equal((await state.value.json()).reason, 'customer_timeline_unavailable');
    pending.resolve(stage === 'headers' ? response() : payload()); await nextTurn();
  });
}

test('actual BFF propagates caller abort and preserves the independently validated dashboard cookie', async () => {
  const pending = deferred(); const controller = new AbortController(); let signal;
  const state = tracked(routeHarness((_, options) => { signal = options.signal; return pending.promise; })(controller.signal));
  await nextTurn(); controller.abort(); await nextTurn();
  assert.equal(signal.aborted, true); assert.equal(state.value.status, 503); assert.equal(state.value.headers.has('set-cookie'), false);
  const unauthorized = await routeHarness(async () => response({}, 401))();
  assert.equal(unauthorized.status, 502); assert.equal(unauthorized.headers.has('set-cookie'), false);
});

const pageSource = await readFile(new URL('../src/app/(app)/leads-tickets/page.tsx', import.meta.url), 'utf8');
function pageLoader(fetcher) {
  const ast = ts.createSourceFile('page.tsx', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['adminMemberTimelineGet', 'unavailableMemberTimeline'].includes(node.name?.text));
  assert.equal(declarations.length, 2);
  const js = ts.transpileModule(declarations.map(node => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function('fetchAdminPage', 'readTicketResponse', 'parseCustomerMemberTimelinePayload', `${js};return adminMemberTimelineGet;`)(fetcher, readTicketResponse, timeline.parseCustomerMemberTimelinePayload);
}

test('actual initial loader is scoped, deadline-bound and rejects missing provenance', async () => {
  const calls = []; const load = pageLoader(async (context, path, init) => { calls.push({ context, path, init }); return response(); });
  const context = { tenantSlug: 'qa-only', cookie: 'synthetic-only' }; const value = await load(context, ID);
  assert.equal(value.availability, 'ready'); assert.equal(calls[0].context, context);
  assert.equal(calls[0].path, `/admin/consumer-network/member/${ID}/timeline`); assert.equal(calls[0].init.redirect, 'error');
  assert.equal((await pageLoader(async () => Response.json(payload()))(context, ID)).availability, 'invalid_payload');
});

for (const stage of ['headers', 'body']) {
  test(`actual initial loader settles a noncooperative ${stage} and preserves unavailable versus empty`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] }); const pending = deferred();
    const load = pageLoader(() => { if (stage === 'headers') return pending.promise; const value = response(); value.json = () => pending.promise; return Promise.resolve(value); });
    const state = tracked(load({ tenantSlug: 'qa-only' }, ID)); await nextTurn(); t.mock.timers.tick(15000); await nextTurn();
    assert.equal(state.settled, true); assert.equal(state.value.availability, 'unreachable'); assert.equal(state.value.items.length, 0);
    pending.resolve(stage === 'headers' ? response() : payload()); await nextTurn();
  });
}
