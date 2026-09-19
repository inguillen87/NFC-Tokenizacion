import assert from 'node:assert/strict';
import test from 'node:test';
import { planNoticeReview, parseNoticeReviewCommand, noticeReviewDigest, NoticeReviewError } from '../src/lib/recall-notice-review.mjs';

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  foreign: '10000000-0000-4000-8000-000000000002',
  batch: '20000000-0000-4000-8000-000000000001',
  case: '30000000-0000-4000-8000-000000000001',
  proposal: '40000000-0000-4000-8000-000000000001',
  operation: '50000000-0000-4000-8000-000000000001',
  editor: '60000000-0000-4000-8000-000000000001',
  otherEditor: '60000000-0000-4000-8000-000000000002',
  reviewer: '60000000-0000-4000-8000-000000000003',
};
const now = '2026-09-18T18:00:00.000Z';
const actor = (user = ids.editor, extra = {}) => ({ id: user, role: 'tenant-admin', tenantId: ids.tenant,
  canRead: true, canWrite: true, canPublish: true, mfaVerified: true, ...extra });
const current = (extra = {}) => ({ tenantId: ids.tenant, batchId: ids.batch, caseId: ids.case,
  caseVersion: 8, noticeVersion: 1, trackingState: 'active', noticeState: 'active', publishedAt: '2026-09-17T18:00:00Z',
  notice: { title: 'Aviso de retiro QA', publicMessage: 'No utilizar el producto de este lote de prueba.',
    instructions: 'Inmovilizar las unidades y contactar al responsable.', contact: 'Responsable de calidad QA' }, ...extra });
const corrected = () => ({ ...current().notice, instructions: 'Mantener las unidades inmovilizadas y consultar el expediente QA.' });
function body(action, review = null, changes = {}) {
  const base = { caseId: ids.case, proposalId: ids.proposal, operationId: ids.operation,
    expectedReviewVersion: review?.version || 0, expectedCaseVersion: 8, expectedNoticeVersion: 1 };
  if (action.startsWith('create_') || action.startsWith('save_')) {
    base.reason = 'Corrección respaldada por el expediente interno QA.';
    base.evidenceReference = 'EXP-QA-2026-001';
    if (action.endsWith('_correction')) base.notice = corrected();
    else base.resolutionMessage = 'Se levanta este aviso tras la revisión del expediente; consulte las restricciones restantes.';
  }
  if (['cancel', 'return_for_changes'].includes(action)) base.reason = 'Se solicita una corrección documentada antes de continuar.';
  return { ...base, ...changes };
}
function act(action, review = null, options = {}) {
  const { user = ids.editor, source = current(), principal = actor(user), changes = {}, time = now } = options;
  return planNoticeReview({ current: source, review, actor: principal, action, body: body(action, review, changes), now: time });
}
function correction() { return act('create_correction').review; }
function submitted() { return act('submit', correction()).review; }
function errorCode(fn, expected) { assert.throws(fn, error => error instanceof NoticeReviewError && error.code === expected); }
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

test('preparing a correction leaves the effective notice unchanged and cannot report persistence', () => {
  const before = current(), result = act('create_correction', null, { source: freeze(before) });
  assert.equal(result.effect, null); assert.equal(result.persisted, false); assert.equal(result.requiresAtomicPersistence, true);
  assert.deepEqual(result.review.baseNotice, before.notice); assert.deepEqual(before, current());
  assert.equal(result.review.state, 'draft'); assert.equal(result.review.version, 1);
});
test('a submitted correction creates an effect only after independent approval', () => {
  const pending = submitted(); assert.equal(pending.state, 'in_review');
  const result = act('approve', pending, { user: ids.reviewer });
  assert.equal(result.review.state, 'applied'); assert.equal(result.effect.kind, 'replace_notice');
  assert.deepEqual(result.effect.notice, corrected()); assert.equal(result.effect.noticeState, 'active');
  assert.equal(result.effect.expectedCaseVersion, 8); assert.equal(result.effect.expectedNoticeVersion, 1);
  assert.equal(result.effect.nextNoticeVersion, 2); assert.equal(result.persisted, false);
});
test('lifting requires closed tracking and preserves the previous notice as history', () => {
  const source = current({ trackingState: 'closed' });
  const draft = act('create_lift', null, { source }).review;
  const pending = act('submit', draft, { source }).review;
  const result = act('approve', pending, { user: ids.reviewer, source });
  assert.equal(result.effect.kind, 'lift_notice'); assert.equal(result.effect.noticeState, 'lifted');
  assert.deepEqual(result.effect.notice, source.notice);
  assert.equal(result.effect.doesNotReleaseProduct, true); assert.equal(result.effect.doesNotDetermineNfcAuthenticity, true);
  assert.ok(result.effect.resolutionMessage.length > 10);
});
for (const state of ['active', 'closing']) test(`cannot request lifting while tracking is ${state}`, () => {
  errorCode(() => act('create_lift', null, { source: current({ trackingState: state }) }), 'notice_review_close_tracking_first');
});
test('an original author cannot approve their own proposal', () => {
  errorCode(() => act('approve', submitted()), 'notice_review_independent_approval_required');
});
test('all contributing editors remain excluded even after another person edits last', () => {
  const updated = act('save_correction', correction(), { user: ids.otherEditor }).review;
  const pending = act('submit', updated, { user: ids.otherEditor }).review;
  assert.deepEqual(new Set(pending.contributorIds), new Set([ids.editor, ids.otherEditor]));
  for (const user of [ids.editor, ids.otherEditor]) errorCode(() => act('approve', pending, { user }), 'notice_review_independent_approval_required');
});
test('a submitter who did not edit is also excluded from approval', () => {
  const pending = act('submit', correction(), { user: ids.otherEditor }).review;
  errorCode(() => act('approve', pending, { user: ids.otherEditor }), 'notice_review_independent_approval_required');
});
test('a global administrator retains scope access but not a self-approval bypass', () => {
  const admin = actor(ids.editor, { role: 'super-admin', tenantId: null });
  const created = act('create_correction', null, { principal: admin }).review;
  const pending = act('submit', created, { principal: admin }).review;
  errorCode(() => act('approve', pending, { principal: admin }), 'notice_review_independent_approval_required');
});
for (const patch of [{ mfaVerified: false }, { canPublish: false }, { role: 'operations-manager' }]) {
  test('approval requires an authorized reviewer and MFA: ' + JSON.stringify(patch), () => {
    errorCode(() => act('approve', submitted(), { principal: actor(ids.reviewer, patch) }), 'notice_review_approval_forbidden');
  });
}
for (const patch of [{ canRead: false }, { canWrite: false }, { role: 'viewer' }, { role: 'marketing-manager' }]) {
  test('cannot begin a proposal with insufficient authority: ' + JSON.stringify(patch), () => {
    errorCode(() => act('create_correction', null, { principal: actor(ids.editor, patch) }), 'notice_review_forbidden');
  });
}
test('tenant mismatch is refused before creating or reviewing a proposal', () => {
  errorCode(() => act('create_correction', null, { principal: actor(ids.editor, { tenantId: ids.foreign }) }), 'notice_review_tenant_forbidden');
  const pending = submitted(); pending.tenantId = ids.foreign;
  errorCode(() => act('approve', pending, { user: ids.reviewer }), 'notice_review_scope_mismatch');
});
for (const field of ['canPublish', 'mfaVerified', 'actorId', 'noticeState', 'status', 'sdm_config', 'ttstatus', 'returnedUnits']) {
  test('request body cannot inject authority, stock or NFC fields: ' + field, () => {
    errorCode(() => parseNoticeReviewCommand('create_correction', { ...body('create_correction'), [field]: true }), 'notice_review_field_not_allowed');
  });
}
test('an approval body cannot smuggle new public text past independent review', () => {
  errorCode(() => act('approve', submitted(), { user: ids.reviewer, changes: { notice: corrected() } }), 'notice_review_field_not_allowed');
});
test('public correction cannot change recall kind, destinations or internal rationale', () => {
  for (const field of ['kind', 'destinations', 'reason']) {
    errorCode(() => act('create_correction', null, { changes: { notice: { ...corrected(), [field]: 'extra' } } }), 'notice_review_field_not_allowed');
  }
});
test('an empty or unchanged correction cannot progress as meaningful work', () => {
  errorCode(() => act('create_correction', null, { changes: { notice: current().notice } }), 'notice_review_no_public_change');
  errorCode(() => act('create_correction', null, { changes: { evidenceReference: '' } }), 'notice_review_invalid_text');
});
test('oversized notice and missing evidence are rejected', () => {
  errorCode(() => act('create_correction', null, { changes: { notice: { ...corrected(), publicMessage: 'x'.repeat(601) } } }), 'notice_review_invalid_text');
  errorCode(() => act('create_lift', null, { source: current({ trackingState: 'closed' }), changes: { evidenceReference: undefined } }), 'notice_review_invalid_text');
});
test('negative, fractional and excessive expected versions are invalid', () => {
  for (const n of [-1, 1.1, 1000001, NaN, '8']) errorCode(() => act('create_correction', null, { changes: { expectedCaseVersion: n } }), 'notice_review_invalid_version');
});
test('case version drift invalidates pending approval', () => {
  errorCode(() => act('approve', submitted(), { user: ids.reviewer, source: current({ caseVersion: 9 }) }), 'notice_review_source_changed');
});
test('notice version drift cannot silently rebase a pending proposal', () => {
  errorCode(() => act('approve', submitted(), { user: ids.reviewer, source: current({ noticeVersion: 2 }), changes: { expectedNoticeVersion: 2 } }), 'notice_review_source_changed');
});
test('changed public text is detected even if a caller failed to increment notice version', () => {
  errorCode(() => act('approve', submitted(), { user: ids.reviewer, source: current({ notice: { ...current().notice, contact: 'Another authorized contact' } }) }), 'notice_review_source_changed');
});
test('stale review versions cannot replace a more recent edit', () => {
  const review = correction();
  errorCode(() => act('save_correction', review, { changes: { expectedReviewVersion: 2 } }), 'notice_review_revision_conflict');
});
test('tampered persisted proposal content fails its integrity guard', () => {
  const review = submitted(); review.requestedNotice.contact = 'Unreviewed contact';
  errorCode(() => act('approve', review, { user: ids.reviewer }), 'notice_review_integrity_error');
});
test('return for changes requires independent review and preserves contributor history', () => {
  const pending = submitted();
  errorCode(() => act('return_for_changes', pending), 'notice_review_independent_approval_required');
  const result = act('return_for_changes', pending, { user: ids.reviewer });
  assert.equal(result.review.state, 'changes_requested'); assert.equal(result.effect, null);
  assert.deepEqual(result.review.contributorIds, pending.contributorIds); assert.ok(result.audit.reason);
  const saved = act('save_correction', result.review, { user: ids.otherEditor }).review;
  assert.equal(saved.state, 'draft'); assert.equal(saved.submittedAt, null);
});
test('while in review, editing and a second submit are rejected', () => {
  const pending = submitted();
  for (const action of ['save_correction', 'submit']) errorCode(() => act(action, pending), 'notice_review_transition_invalid');
});
test('correction and lifting proposals cannot change kind during editing', () => {
  errorCode(() => act('save_lift', correction()), 'notice_review_transition_invalid');
});
test('cancelling a stale proposal is permitted but never alters public state', () => {
  const result = act('cancel', submitted(), { source: current({ caseVersion: 12, noticeVersion: 2 }) });
  assert.equal(result.review.state, 'cancelled'); assert.equal(result.effect, null);
});
test('terminal proposals require a new identity, never reopen or approval replay', () => {
  const applied = act('approve', submitted(), { user: ids.reviewer }).review;
  errorCode(() => act('approve', applied, { user: ids.reviewer }), 'notice_review_terminal_state');
  const cancelled = act('cancel', correction()).review;
  errorCode(() => act('save_correction', cancelled), 'notice_review_terminal_state');
});
test('lifting an already-lifted notice is not permission to release stock', () => {
  errorCode(() => act('create_lift', null, { source: current({ noticeState: 'lifted', trackingState: 'closed' }) }), 'notice_review_already_lifted');
});
test('a draft or unpublished case cannot issue a public correction', () => {
  errorCode(() => act('create_correction', null, { source: current({ trackingState: 'draft' }) }), 'notice_review_requires_published_case');
  errorCode(() => act('create_correction', null, { source: current({ publishedAt: null }) }), 'notice_review_invalid_time');
});
test('unknown actions, invalid IDs and prototype properties fail closed', () => {
  errorCode(() => act('release_stock'), 'notice_review_action_invalid');
  errorCode(() => act('create_correction', null, { changes: { operationId: 'invalid' } }), 'notice_review_invalid_id');
  const polluted = JSON.parse(JSON.stringify(body('create_correction')).slice(0, -1) + ',"__proto__":{"canPublish":true}}');
  errorCode(() => parseNoticeReviewCommand('create_correction', polluted), 'notice_review_field_not_allowed');
  assert.equal({}.canPublish, undefined);
});
test('timestamps cannot move behind publication or the last proposal version', () => {
  errorCode(() => act('create_correction', null, { time: '2026-09-01T18:00:00Z' }), 'notice_review_invalid_time');
  errorCode(() => act('submit', correction(), { time: '2026-09-18T17:59:59Z' }), 'notice_review_invalid_time');
  errorCode(() => act('create_correction', null, { time: '2026-09-18T18:00:00' }), 'notice_review_invalid_time');
});
test('checksums are deterministic despite property ordering and no mutation is persisted by the reducer', () => {
  const command = body('create_correction');
  const reordered = Object.fromEntries(Object.entries(command).reverse());
  assert.equal(noticeReviewDigest(parseNoticeReviewCommand('create_correction', command)), noticeReviewDigest(parseNoticeReviewCommand('create_correction', reordered)));
  const source = freeze(current()), review = freeze(submitted());
  const before = JSON.stringify({ source, review });
  const plan = act('approve', review, { user: ids.reviewer, source });
  assert.equal(JSON.stringify({ source, review }), before);
  assert.equal(plan.idempotency.actorId, ids.reviewer);
  assert.equal(plan.requiresAtomicPersistence, true); assert.equal(plan.persisted, false);
  assert.ok(!['sdm_config','ttstatus','tagStatus','stockStatus'].some(key => key in plan.effect));
});

test('a tenant-bound claim of super-administration is not accepted as a global session', () => {
  errorCode(() => act('create_correction', null, { principal: actor(ids.editor, { role: 'super-admin', tenantId: ids.tenant }) }), 'notice_review_tenant_forbidden');
});
