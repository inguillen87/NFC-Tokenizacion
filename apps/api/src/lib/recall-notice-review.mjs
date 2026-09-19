/**
 * Pure decision policy for correcting or lifting an already published recall
 * notice. This module does NOT persist, publish, release stock or authenticate NFC.
 *
 * Trusted arguments (actor/current/review) must come from the authenticated
 * server and committed database rows, never from the request body. The caller
 * must persist review + audit + any effect in one idempotent, version-checked
 * transaction. The old published notice remains effective until that commits.
 */
import { createHash } from 'node:crypto';

export const NOTICE_REVIEW_PROTOCOL = 'nexid.recall-notice-review.v1';
export const NOTICE_REVIEW_ACTIONS = Object.freeze([
  'create_correction', 'create_lift', 'save_correction', 'save_lift',
  'submit', 'return_for_changes', 'approve', 'cancel',
]);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WRITE_ROLES = new Set(['super-admin', 'tenant-owner', 'tenant-admin', 'operations-manager', 'security-operator']);
const REVIEW_ROLES = new Set(['super-admin', 'tenant-owner', 'tenant-admin']);
const LIVE_CASES = new Set(['active', 'closing', 'closed']);
const PUBLIC_FIELDS = ['title', 'publicMessage', 'instructions', 'contact'];
const COMMON_FIELDS = ['caseId', 'proposalId', 'operationId', 'expectedReviewVersion', 'expectedCaseVersion', 'expectedNoticeVersion'];

export class NoticeReviewError extends Error {
  constructor(code, status = 409) { super(code); this.name = 'NoticeReviewError'; this.code = code; this.status = status; }
}
const fail = (code, status = 400) => { throw new NoticeReviewError(code, status); };
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('notice_review_invalid_object');
  if (Object.keys(value).some(key => !allowed.includes(key))) fail('notice_review_field_not_allowed');
  return value;
}
function id(value) { if (typeof value !== 'string' || !ID.test(value)) fail('notice_review_invalid_id'); return value.toLowerCase(); }
function version(value, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum || value > 1000000) fail('notice_review_invalid_version');
  return value;
}
function text(value, minimum, maximum) {
  if (typeof value !== 'string' || value.length > maximum || value.trim().length < minimum ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail('notice_review_invalid_text');
  return value.trim();
}
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) ||
      !Number.isFinite(Date.parse(value))) fail('notice_review_invalid_time');
  const normalized = new Date(value).toISOString();
  if (normalized.slice(0,19) !== value.slice(0,19)) fail('notice_review_invalid_time');
  return normalized;
}
function publicText(value) {
  const input = object(value, PUBLIC_FIELDS);
  return { title: text(input.title, 5, 160), publicMessage: text(input.publicMessage, 10, 600),
    instructions: text(input.instructions, 10, 1000), contact: text(input.contact, 3, 200) };
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key)+':'+canonical(value[key])).join(',') + '}';
}
export function noticeReviewDigest(value) { return createHash('sha256').update(canonical(value)).digest('hex'); }
function content(review) {
  const { id: proposalId, tenantId, batchId, caseId, kind, baseCaseVersion, baseNoticeVersion,
    baseNotice, requestedNotice, resolutionMessage, reason, evidenceReference, contributorIds } = review;
  return { proposalId, tenantId, batchId, caseId, kind, baseCaseVersion, baseNoticeVersion,
    baseNotice, requestedNotice, resolutionMessage, reason, evidenceReference, contributorIds };
}

export function parseNoticeReviewCommand(action, raw) {
  if (!NOTICE_REVIEW_ACTIONS.includes(action)) fail('notice_review_action_invalid');
  const editing = action.startsWith('create_') || action.startsWith('save_');
  const correction = action.endsWith('_correction');
  const allowed = [...COMMON_FIELDS];
  if (editing) allowed.push('reason', 'evidenceReference', correction ? 'notice' : 'resolutionMessage');
  if (['return_for_changes','cancel'].includes(action)) allowed.push('reason');
  const input = object(raw, allowed);
  const result = { action, caseId: id(input.caseId), proposalId: id(input.proposalId), operationId: id(input.operationId),
    expectedReviewVersion: version(input.expectedReviewVersion, 0),
    expectedCaseVersion: version(input.expectedCaseVersion), expectedNoticeVersion: version(input.expectedNoticeVersion) };
  if (action.startsWith('create_') && result.expectedReviewVersion !== 0) fail('notice_review_invalid_version');
  if (!action.startsWith('create_') && result.expectedReviewVersion === 0) fail('notice_review_invalid_version');
  if (editing) {
    result.reason = text(input.reason, 10, 1000);
    result.evidenceReference = text(input.evidenceReference, 5, 400);
    if (correction) result.notice = publicText(input.notice);
    else result.resolutionMessage = text(input.resolutionMessage, 10, 1000);
  } else if (allowed.includes('reason')) result.reason = text(input.reason, 10, 1000);
  return result;
}

/** Validate current committed source without accepting a claim of authenticity. */
function source(raw) {
  const value = object(raw, ['tenantId','batchId','caseId','caseVersion','noticeVersion','trackingState','publishedAt','noticeState','notice']);
  if (!LIVE_CASES.has(value.trackingState) || !['active','lifted'].includes(value.noticeState)) fail('notice_review_requires_published_case', 409);
  return { tenantId: id(value.tenantId), batchId: id(value.batchId), caseId: id(value.caseId),
    caseVersion: version(value.caseVersion), noticeVersion: version(value.noticeVersion),
    trackingState: value.trackingState, publishedAt: instant(value.publishedAt), noticeState: value.noticeState, notice: publicText(value.notice) };
}
export function authorizeNoticeReview(actor, current, action) {
  if (!actor || !WRITE_ROLES.has(actor.role) || actor.canRead !== true || actor.canWrite !== true) fail('notice_review_forbidden', 403);
  const actorId = id(actor.id);
  if (actor.role === 'super-admin' && actor.tenantId !== null) fail('notice_review_tenant_forbidden', 403);
  const global = actor.role === 'super-admin' && actor.tenantId === null;
  if (!global && id(actor.tenantId) !== current.tenantId) fail('notice_review_tenant_forbidden', 403);
  // canPublish must include the application's explicit deny resolution.
  if (['approve','return_for_changes'].includes(action) &&
      (!REVIEW_ROLES.has(actor.role) || actor.canPublish !== true || actor.mfaVerified !== true)) fail('notice_review_approval_forbidden', 403);
  return actorId;
}
function assertStoredReview(review, command, current) {
  if (!review || review.protocol !== NOTICE_REVIEW_PROTOCOL || review.id !== command.proposalId ||
      review.tenantId !== current.tenantId || review.batchId !== current.batchId || review.caseId !== current.caseId) fail('notice_review_scope_mismatch', 403);
  if (review.version !== command.expectedReviewVersion) fail('notice_review_revision_conflict', 409);
  if (!['correction','lift'].includes(review.kind) || !['draft','in_review','changes_requested','applied','cancelled'].includes(review.state) ||
      !Array.isArray(review.contributorIds) || !review.contributorIds.length || review.contributorIds.length > 100 ||
      review.contributorIds.some(value => typeof value !== 'string' || !ID.test(value)) ||
      !review.contributorIds.includes(review.createdBy) || review.contentDigest !== noticeReviewDigest(content(review))) fail('notice_review_integrity_error', 409);
}
function fresh(current, command, review) {
  if (current.caseVersion !== command.expectedCaseVersion || current.noticeVersion !== command.expectedNoticeVersion ||
      (review && (review.baseCaseVersion !== current.caseVersion || review.baseNoticeVersion !== current.noticeVersion ||
       noticeReviewDigest(review.baseNotice) !== noticeReviewDigest(current.notice)))) fail('notice_review_source_changed', 409);
  if (current.noticeState !== 'active') fail('notice_review_already_lifted', 409);
}

/**
 * Returns a commit plan, NOT a durable receipt. No I/O and no request retries.
 * Approval effects may be exposed publicly only after the repository transaction.
 */
export function planNoticeReview({ current: rawCurrent, review: stored = null, actor, action, body, now }) {
  const current = source(rawCurrent);
  const actorId = authorizeNoticeReview(actor, current, action);
  const command = parseNoticeReviewCommand(action, body);
  const timestamp = instant(now);
  if (Date.parse(timestamp) < Date.parse(current.publishedAt)) fail('notice_review_invalid_time');
  if (command.caseId !== current.caseId) fail('notice_review_scope_mismatch', 403);
  const creating = action.startsWith('create_');
  if (creating && stored !== null) fail('notice_review_already_exists', 409);
  if (!creating) {
    assertStoredReview(stored, command, current);
    if (Date.parse(timestamp) < Date.parse(instant(stored.updatedAt))) fail('notice_review_invalid_time');
    if (['applied','cancelled'].includes(stored.state)) fail('notice_review_terminal_state', 409);
  }
  // A stale proposal can be explicitly cancelled, but cannot be approved or rebased silently.
  if (action !== 'cancel') fresh(current, command, stored);
  let next = creating ? {
    protocol: NOTICE_REVIEW_PROTOCOL, id: command.proposalId, tenantId: current.tenantId,
    batchId: current.batchId, caseId: current.caseId, kind: action === 'create_correction' ? 'correction' : 'lift',
    state: 'draft', version: 1, baseCaseVersion: current.caseVersion, baseNoticeVersion: current.noticeVersion,
    baseNotice: structuredClone(current.notice), createdBy: actorId, contributorIds: [actorId],
    createdAt: timestamp, updatedAt: timestamp, submittedAt: null, approvedBy: null, approvedAt: null,
    requestedNotice: null, resolutionMessage: null, reason: '', evidenceReference: '', contentDigest: '',
  } : structuredClone(stored);
  let effect = null;
  const editable = ['draft','changes_requested'].includes(next.state);
  if (creating || action.startsWith('save_')) {
    if (!editable || (action.endsWith('_correction') ? next.kind !== 'correction' : next.kind !== 'lift')) fail('notice_review_transition_invalid', 409);
    if (next.kind === 'lift' && current.trackingState !== 'closed') fail('notice_review_close_tracking_first', 409);
    next.requestedNotice = next.kind === 'correction' ? command.notice : null;
    next.resolutionMessage = next.kind === 'lift' ? command.resolutionMessage : null;
    next.reason = command.reason; next.evidenceReference = command.evidenceReference;
    next.state = 'draft'; next.submittedAt = null;
    next.contributorIds = [...new Set([...next.contributorIds, actorId])].sort();
    if (next.contributorIds.length > 100) fail('notice_review_contributor_limit', 409);
    if (next.kind === 'correction' && noticeReviewDigest(next.requestedNotice) === noticeReviewDigest(next.baseNotice)) fail('notice_review_no_public_change', 409);
  } else if (action === 'submit') {
    if (!editable) fail('notice_review_transition_invalid', 409);
    if (next.kind === 'lift' && current.trackingState !== 'closed') fail('notice_review_close_tracking_first', 409);
    next.contributorIds = [...new Set([...next.contributorIds, actorId])].sort();
    if (next.contributorIds.length > 100) fail('notice_review_contributor_limit', 409);
    next.state = 'in_review'; next.submittedAt = timestamp;
  } else if (action === 'return_for_changes' || action === 'approve') {
    if (next.state !== 'in_review') fail('notice_review_transition_invalid', 409);
    if (next.contributorIds.includes(actorId)) fail('notice_review_independent_approval_required', 403);
    if (action === 'return_for_changes') next.state = 'changes_requested';
    else {
      if (next.kind === 'lift' && current.trackingState !== 'closed') fail('notice_review_close_tracking_first', 409);
      next.state = 'applied'; next.approvedBy = actorId; next.approvedAt = timestamp;
      effect = { kind: next.kind === 'correction' ? 'replace_notice' : 'lift_notice',
        scope: { tenantId: current.tenantId, batchId: current.batchId, caseId: current.caseId },
        expectedCaseVersion: current.caseVersion, expectedNoticeVersion: current.noticeVersion,
        nextNoticeVersion: current.noticeVersion + 1,
        notice: structuredClone(next.requestedNotice || next.baseNotice),
        noticeState: next.kind === 'lift' ? 'lifted' : 'active', resolutionMessage: next.resolutionMessage,
        issuedAt: timestamp, approvedBy: actorId, doesNotDetermineNfcAuthenticity: true, doesNotReleaseProduct: true };
    }
  } else if (action === 'cancel') next.state = 'cancelled';
  if (!creating) next.version++;
  if (next.version > 1000000 || (effect && effect.nextNoticeVersion > 1000000)) fail('notice_review_version_limit', 409);
  next.updatedAt = timestamp; next.contentDigest = noticeReviewDigest(content(next));
  return { protocol: NOTICE_REVIEW_PROTOCOL, review: next, effect,
    audit: { action, actorId, operationId: command.operationId, proposalId: next.id,
      tenantId: current.tenantId, batchId: current.batchId, caseId: current.caseId,
      previousState: stored?.state || null, nextState: next.state, version: next.version,
      contentDigest: next.contentDigest, at: timestamp, reason: command.reason || null },
    idempotency: { operationId: command.operationId, actorId, tenantId: current.tenantId,
      batchId: current.batchId, commandDigest: noticeReviewDigest(command) },
    requiresAtomicPersistence: true, persisted: false };
}
