import assert from 'node:assert/strict';
import test from 'node:test';
import { assignedWorkbenchState, assignedWorkbenchActivity, assignedWorkbenchNextStep, buildAssignedWorkbench, createAssignedReadScope, assignedReadDenialScope } from '../src/lib/supplier-assigned-workbench.ts';

const row = (n, state = 'pending', patch = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  tenant_id: '10000000-0000-4000-8000-000000000001', tenant_slug: 'bodega-demo',
  title: `Solicitud ${n}`, construction_id: 'tt_bridge', quantity: 100,
  pack_purpose: 'production', notes: 'Texto privado no indexado',
  status: state === 'provisioned' ? 'provisioned' : 'submitted', revision: 1,
  created_at: '2026-09-22T10:00:00Z', updated_at: '2026-09-23T10:00:00Z', submitted_at: '2026-09-22T11:00:00Z',
  order_id: state === 'provisioned' ? '90000000-0000-4000-8000-000000000001' : null,
  review_summary: state === 'unknown' ? undefined : { state: state === 'provisioned' ? 'pending' : state, revision: state === 'pending' ? 0 : 2, updated_at: state === 'pending' ? null : '2026-09-23T11:00:00Z' },
  assignment: { operator_id: '20000000-0000-4000-8000-000000000001', revision: 1, updated_at: '2026-09-23T12:00:00Z' },
  ...patch,
});

test('empty loaded set has no invented metrics or rows', () => {
  assert.deepEqual(buildAssignedWorkbench([]), { visible: [], counts: { all: 0, actionable: 0, pending: 0, answered: 0, needs_information: 0, provisioned: 0, unknown: 0 } });
});
test('counters describe loaded records, independent of search and filter', () => {
  const items = ['pending', 'answered', 'needs_information', 'provisioned', 'unknown'].map((state, i) => row(i + 1, state));
  const result = buildAssignedWorkbench(items, 'no coincide', 'answered');
  assert.equal(result.visible.length, 0);
  assert.deepEqual(result.counts, { all: 5, actionable: 2, pending: 1, answered: 1, needs_information: 1, provisioned: 1, unknown: 1 });
});
for (const state of ['pending', 'answered', 'needs_information', 'provisioned', 'unknown']) {
  test(`preserves management state ${state} and filters exactly`, () => {
    const selected = row(1, state);
    assert.equal(assignedWorkbenchState(selected), state);
    assert.deepEqual(buildAssignedWorkbench([selected, row(2, state === 'pending' ? 'answered' : 'pending')], '', state).visible, [selected]);
  });
}
test('unconfirmed or invalid states never become actionable', () => {
  const items = [row(1, 'unknown'), row(2, 'pending', { status: 'draft' }), row(3, 'pending', { review_summary: { state: 'approved' } })];
  assert.equal(buildAssignedWorkbench(items).counts.unknown, 3);
  assert.equal(buildAssignedWorkbench(items, '', 'actionable').visible.length, 0);
});
test('actionable means pending or answered, not technical authorization', () => {
  const items = ['needs_information', 'pending', 'answered', 'provisioned', 'unknown'].map((s, i) => row(i, s));
  assert.deepEqual(buildAssignedWorkbench(items, '', 'actionable').visible.map(assignedWorkbenchState), ['answered', 'pending']);
});
test('search is accent-insensitive and matches terms across authorized fields', () => {
  const a = row(1, 'pending', { title: 'Edición Única', tenant_slug: 'bodega-mendoza' });
  assert.deepEqual(buildAssignedWorkbench([a, row(2)], '  MENDOZA unica  ').visible, [a]);
  assert.equal(buildAssignedWorkbench([a], 'unica ausente').visible.length, 0);
});
test('complete references and construction identifiers remain searchable', () => {
  const a = row(1), b = row(2);
  assert.deepEqual(buildAssignedWorkbench([a, b], a.id).visible, [a]);
  assert.equal(buildAssignedWorkbench([a, b], 'tt_bridge').visible.length, 2);
});
test('search does not index notes or introduce additional tenant records', () => {
  const a = row(1);
  assert.deepEqual(buildAssignedWorkbench([a], 'privado').visible, []);
  assert.deepEqual(buildAssignedWorkbench([a]).visible, [a]);
});
test('review-first groups unknown, answered, pending, waiting, prepared', () => {
  const items = ['provisioned', 'needs_information', 'pending', 'answered', 'unknown'].map((s, i) => row(i + 1, s));
  assert.deepEqual(buildAssignedWorkbench(items).visible.map(assignedWorkbenchState), ['unknown', 'answered', 'pending', 'needs_information', 'provisioned']);
});
test('activity falls back to submission, not unrelated assignment timestamps', () => {
  const a = row(1);
  assert.equal(assignedWorkbenchActivity(a), a.submitted_at);
  assert.equal(assignedWorkbenchActivity({ ...a, submitted_at: null }), a.updated_at);
  const b = row(2, 'answered');
  assert.equal(assignedWorkbenchActivity(b), b.review_summary.updated_at);
});
test('oldest and recent sorts are deterministic and do not mutate records or array', () => {
  const old = row(2, 'answered', { review_summary: { state: 'answered', revision: 2, updated_at: '2026-09-22T10:00:00Z' } });
  const newer = row(1, 'pending', { submitted_at: '2026-09-23T10:00:00Z' });
  const input = Object.freeze([Object.freeze(newer), Object.freeze(old)]);
  assert.deepEqual(buildAssignedWorkbench(input, '', 'all', 'oldest_activity').visible, [old, newer]);
  assert.deepEqual(buildAssignedWorkbench(input, '', 'all', 'recent_activity').visible, [newer, old]);
  assert.equal(input[0], newer);
});
test('equal timestamps use reference for stable ordering across refreshes', () => {
  const a = row(1), b = row(2);
  for (const sort of ['review_first', 'oldest_activity', 'recent_activity']) {
    assert.deepEqual(buildAssignedWorkbench([b, a], '', 'all', sort).visible, [a, b]);
  }
});
test('invalid dates remain deterministic rather than producing NaN comparisons', () => {
  const a = row(1, 'pending', { submitted_at: 'invalid' }), b = row(2);
  assert.deepEqual(buildAssignedWorkbench([b, a], '', 'all', 'oldest_activity').visible, [a, b]);
});
for (const state of ['pending', 'answered']) {
  test(`read-only next action for ${state} never promises a mutation`, () => {
    assert.match(assignedWorkbenchNextStep(row(1, state), false), /modo lectura/);
    assert.doesNotMatch(assignedWorkbenchNextStep(row(1, state), false), /pedir|enviar|programar|reservar/i);
  });
}
test('waiting and prepared copy do not promise manufacture or delivery', () => {
  assert.match(assignedWorkbenchNextStep(row(1, 'needs_information'), true), /corresponde a la empresa/);
  assert.match(assignedWorkbenchNextStep(row(1, 'provisioned'), true), /No confirma fabricación ni entrega/);
  assert.match(assignedWorkbenchNextStep(row(1, 'unknown'), true), /antes de actuar/);
});

test('read scope starts idle and current ticket settles once', () => {
  const scope = createAssignedReadScope(); assert.equal(scope.pending(), false);
  const ticket = scope.begin('list'); assert.equal(scope.pending(), true); assert.equal(scope.isCurrent(ticket), true);
  assert.equal(scope.finish(ticket), true); assert.equal(scope.finish(ticket), false); assert.equal(scope.pending(), false);
});
test('superseded reads abort and cannot finish the newer request', () => {
  const scope = createAssignedReadScope(), old = scope.begin('list'), newer = scope.begin('list');
  assert.equal(old.controller.signal.aborted, true); assert.equal(scope.isCurrent(old), false);
  assert.equal(scope.finish(old), false); assert.equal(scope.isCurrent(newer), true); assert.equal(scope.pending(), true);
});
test('list and detail tickets are independent until scope revocation', () => {
  const scope = createAssignedReadScope(), list = scope.begin('list'), detail = scope.begin('detail');
  assert.equal(scope.isCurrent(list), true); assert.equal(scope.isCurrent(detail), true);
  scope.invalidate();
  for (const ticket of [list, detail]) { assert.equal(ticket.controller.signal.aborted, true); assert.equal(scope.isCurrent(ticket), false); assert.equal(scope.finish(ticket), false); }
  assert.equal(scope.pending(), false);
});
test('invalidation clears identity before synchronous abort callbacks run', () => {
  const scope = createAssignedReadScope(), ticket = scope.begin('list');
  let currentOnAbort = true;
  ticket.controller.signal.addEventListener('abort', () => { currentOnAbort = scope.isCurrent(ticket); });
  scope.invalidate(); assert.equal(currentOnAbort, false);
});
test('a transport ignoring abort cannot restore revoked data', async () => {
  const scope = createAssignedReadScope(), ticket = scope.begin('list');
  let resolve, displayed = null;
  const delayed = new Promise(done => { resolve = done; }).then(value => { if (scope.isCurrent(ticket)) displayed = value; });
  scope.invalidate(); resolve([row(1)]); await delayed;
  assert.equal(displayed, null);
});
test('scope A -> B -> A and strict effect cleanup cannot revive an old read', () => {
  const scope = createAssignedReadScope(), firstA = scope.begin('list'); scope.invalidate();
  const b = scope.begin('list'); scope.invalidate(); const secondA = scope.begin('list');
  assert.equal(scope.isCurrent(firstA), false); assert.equal(scope.isCurrent(b), false); assert.equal(scope.isCurrent(secondA), true);
});
for (const kind of ['list', 'detail']) {
  for (const status of [401, 403]) {
    test(`${kind} ${status} invalidates the whole visible scope`, () => assert.equal(assignedReadDenialScope(status, kind), 'all'));
  }
}
test('list-level 404 is not an empty inbox; detail 404 only withdraws that record', () => {
  assert.equal(assignedReadDenialScope(404, 'list'), 'all');
  assert.equal(assignedReadDenialScope(404, 'detail'), 'record');
});
for (const status of [0, 200, 408, 409, 429, 500, 503]) {
  test(`status ${status} does not invent an authorization revocation`, () => {
    assert.equal(assignedReadDenialScope(status, 'list'), null);
    assert.equal(assignedReadDenialScope(status, 'detail'), null);
  });
}
