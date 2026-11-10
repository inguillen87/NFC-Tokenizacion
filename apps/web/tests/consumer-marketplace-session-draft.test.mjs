import test from 'node:test';
import assert from 'node:assert/strict';
import { clearMarketplaceSessionDraft, storeMarketplaceSessionDraft, takeMarketplaceSessionDraft } from '../src/app/me/marketplace/marketplace-session-draft.ts';

const scope = 'a'.repeat(43);
const other = 'b'.repeat(43);
const now = 1_790_000_000_000;
const listing = (id, enabled = true) => ({id, status: 'active', request_to_buy_enabled: enabled});
function memory() {
  let raw = null;
  return {getItem: () => raw, setItem: (_key, value) => { raw = value; }, removeItem: () => { raw = null; }};
}

test('only unattempted eligible IDs and quantities are restored once', () => {
  const storage = memory();
  assert.equal(storeMarketplaceSessionDraft(scope, {sent: 1, unknown: 3, ready: 2, removed: 1, invalid: 25}, new Set(['sent', 'unknown']), storage, now), 2);
  assert.deepEqual(JSON.parse(storage.getItem()), {scope, expiresAt: now + 900_000, lines:[['ready', 2], ['removed', 1]]});
  assert.deepEqual(takeMarketplaceSessionDraft(scope, [listing('ready'), listing('removed', false)], storage, now + 10_000), {ready: 2});
  assert.equal(takeMarketplaceSessionDraft(scope, [listing('ready')], storage, now + 10_000), null);
});

test('another account or catalog consumes the slot without revealing the draft', () => {
  const storage = memory();
  storeMarketplaceSessionDraft(scope, {ready: 2}, new Set(), storage, now);
  assert.equal(takeMarketplaceSessionDraft(other, [listing('ready')], storage, now + 100), null);
  assert.equal(storage.getItem(), null);
});

test('expired, oversized, corrupted, and ambiguous stored data fail closed', () => {
  const storage = memory();
  storeMarketplaceSessionDraft(scope, {ready: 2}, new Set(), storage, now);
  assert.equal(takeMarketplaceSessionDraft(scope, [listing('ready')], storage, now + 900_000), null);
  const malformed = ['{', ' '.repeat(20_001), ...[
    [['ready', 2], ['ready', 2]], [['ready', 1.5]], [['__proto__', 1]], Array.from({length:101}, (_, i) => [`p${i}`, 1]),
  ].map(lines => JSON.stringify({scope, expiresAt: now + 100, lines}))];
  for (const raw of malformed) {
    storage.setItem('', raw);
    assert.equal(takeMarketplaceSessionDraft(scope, [listing('ready')], storage, now), null);
    assert.equal(storage.getItem(), null);
  }
  storeMarketplaceSessionDraft(scope, {ready: 2}, new Set(), storage, now);
  assert.deepEqual(takeMarketplaceSessionDraft(scope, [listing('ready'), listing('ready')], storage, now), {});
});

test('explicit logout clears the slot and blocked storage remains optional', () => {
  const storage = memory();
  storeMarketplaceSessionDraft(scope, {ready: 1}, new Set(), storage, now);
  clearMarketplaceSessionDraft(storage);
  assert.equal(storage.getItem(), null);
  const denied = () => { throw Error('storage denied'); };
  const blocked = {getItem: denied, setItem: denied, removeItem: denied};
  assert.equal(storeMarketplaceSessionDraft(scope, {ready: 1}, new Set(), blocked, now), null);
  assert.equal(takeMarketplaceSessionDraft(scope, [listing('ready')], blocked, now), null);
  assert.doesNotThrow(() => clearMarketplaceSessionDraft(blocked));
});

test('a list above the storage bound is rejected rather than silently truncated', () => {
  const storage = memory();
  storeMarketplaceSessionDraft(scope, {previous:1}, new Set(), storage, now);
  const cart = Object.fromEntries(Array.from({length:101}, (_, index) => [`p${index}`, 1]));
  assert.equal(storeMarketplaceSessionDraft(scope, cart, new Set(), storage, now), null);
  assert.equal(storage.getItem(), null);
});
