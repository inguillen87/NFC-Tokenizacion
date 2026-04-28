import test from 'node:test';
import assert from 'node:assert/strict';

function normalizeTenantSlug(input) {
  return String(input || '').trim().toLowerCase();
}

function shouldListMarketplaceProduct(input) {
  const statusOk = String(input.productStatus || '').toLowerCase() === 'active';
  const brandStatusOk = String(input.brandStatus || '').toLowerCase() === 'active';
  const brandVisible = input.brandVisible === true;
  if (!statusOk || !brandStatusOk || !brandVisible) return false;

  const tenantFilter = normalizeTenantSlug(input.tenantFilter);
  if (!tenantFilter) return true;
  return normalizeTenantSlug(input.tenantSlug) === tenantFilter;
}

function parseRequestToBuyPayload(payload) {
  const quantity = Number.parseInt(String(payload?.quantity ?? 1), 10);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 24) {
    return { ok: false, error: 'invalid_quantity' };
  }

  const rawMessage = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (rawMessage.length > 500) {
    return { ok: false, error: 'message_too_long' };
  }

  return {
    ok: true,
    value: {
      quantity,
      message: rawMessage || null,
      ageGateAccepted: payload?.ageGateAccepted === true,
    },
  };
}

test('tenant filter normalization is consistent', () => {
  assert.equal(normalizeTenantSlug(' DemoBodega '), 'demobodega');
  assert.equal(normalizeTenantSlug(''), '');
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
