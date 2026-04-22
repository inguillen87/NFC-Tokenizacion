import test from 'node:test';
import assert from 'node:assert/strict';

function canAward(result) {
  return !['REPLAY_SUSPECT', 'INVALID', 'NOT_ACTIVE', 'NOT_REGISTERED', 'TAMPER', 'REVOKED', 'BROKEN'].includes(String(result || '').toUpperCase());
}

function canShareAcrossTenants({ consumerOptIn, tenantVisible }) {
  return Boolean(consumerOptIn && tenantVisible);
}

function networkCreditsEnabled(config) {
  return Boolean(config?.enabled === true);
}

test('replay/revoked/tampered never awards points', () => {
  assert.equal(canAward('REPLAY_SUSPECT'), false);
  assert.equal(canAward('REVOKED'), false);
  assert.equal(canAward('TAMPER'), false);
});

test('cross-tenant visibility requires explicit dual opt-in', () => {
  assert.equal(canShareAcrossTenants({ consumerOptIn: true, tenantVisible: true }), true);
  assert.equal(canShareAcrossTenants({ consumerOptIn: true, tenantVisible: false }), false);
  assert.equal(canShareAcrossTenants({ consumerOptIn: false, tenantVisible: true }), false);
});

test('network credits disabled by default', () => {
  assert.equal(networkCreditsEnabled({}), false);
  assert.equal(networkCreditsEnabled({ enabled: false }), false);
  assert.equal(networkCreditsEnabled({ enabled: true }), true);
});
