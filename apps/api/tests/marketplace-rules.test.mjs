import test from 'node:test';
import assert from 'node:assert/strict';

const {
  evaluateMarketplaceCheckoutAccess,
  normalizeMarketplaceTenantSlug,
  parseRequestToBuyPayload,
  shouldListMarketplaceProduct,
} = await import('../src/lib/marketplace-policy.ts');

test('tenant filter normalization is consistent', () => {
  assert.equal(normalizeMarketplaceTenantSlug(' DemoBodega '), 'demobodega');
  assert.equal(normalizeMarketplaceTenantSlug(''), '');
});

test('network listing requires active product + active visible brand', () => {
  assert.equal(shouldListMarketplaceProduct({ productStatus: 'active', brandStatus: 'active', brandVisible: true }), true);
  assert.equal(shouldListMarketplaceProduct({ productStatus: 'draft', brandStatus: 'active', brandVisible: true }), false);
  assert.equal(shouldListMarketplaceProduct({ productStatus: 'active', brandStatus: 'draft', brandVisible: true }), false);
  assert.equal(shouldListMarketplaceProduct({ productStatus: 'active', brandStatus: 'active', brandVisible: false }), false);
});

test('tenant filter must match when provided', () => {
  assert.equal(shouldListMarketplaceProduct({ productStatus: 'active', brandStatus: 'active', brandVisible: true, tenantSlug: 'demobodega', tenantFilter: 'demobodega' }), true);
  assert.equal(shouldListMarketplaceProduct({ productStatus: 'active', brandStatus: 'active', brandVisible: true, tenantSlug: 'demo-perfume', tenantFilter: 'demobodega' }), false);
});

test('request-to-buy payload validates quantity and age gate ack', () => {
  const valid = parseRequestToBuyPayload({ quantity: 2, message: ' hola ', ageGateAccepted: true });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, { quantity: 2, message: 'hola', ageGateAccepted: true });

  const invalidQty = parseRequestToBuyPayload({ quantity: 0 });
  assert.equal(invalidQty.ok, false);
  assert.equal(invalidQty.error, 'invalid_quantity');

  const tooLong = parseRequestToBuyPayload({ quantity: 1, message: 'x'.repeat(501) });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.error, 'message_too_long');
});

test('request-to-buy requires passport context unless explicitly public/demo', () => {
  assert.equal(evaluateMarketplaceCheckoutAccess({}).ok, false);
  assert.equal(evaluateMarketplaceCheckoutAccess({}).error, 'passport_context_required');
  assert.deepEqual(evaluateMarketplaceCheckoutAccess({ claimedOwnership: true }), { ok: true, mode: 'claimed_owner' });
  assert.deepEqual(evaluateMarketplaceCheckoutAccess({ activeMembership: true }), { ok: true, mode: 'tenant_member' });
  assert.deepEqual(evaluateMarketplaceCheckoutAccess({ verifiedTap: true }), { ok: true, mode: 'verified_tapper' });
  assert.deepEqual(evaluateMarketplaceCheckoutAccess({ demoOverride: true }), { ok: true, mode: 'demo_passport_context' });
  assert.deepEqual(evaluateMarketplaceCheckoutAccess({ publicNetworkCheckout: true }), { ok: true, mode: 'public_network_checkout' });
});
