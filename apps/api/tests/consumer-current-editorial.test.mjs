import assert from 'node:assert/strict';
import test from 'node:test';
import { withConsumerCurrentEditorial } from '../src/lib/consumer-current-editorial.ts';
import { parseEditorialDocument } from '../src/lib/passport-editorial-policy.ts';

const row = { product_name: 'Saved name', brand_name: 'Saved producer', image_url: 'https://example.invalid/old.jpg',
  latest_verdict: 'VALID_OPENED', ownership_status: 'viewed', latest_tap_at: '2026-09-01T00:00:00Z', editorial_tenant_id: 'private-scope' };
const publication = { protocol: 'nexid.current-editorial.v1', source: 'passport_studio', state: 'published',
  document: parseEditorialDocument({ schemaVersion: 'nexid.passport-editorial.v1', template: 'general', locale: 'es-AR',
    identity: { product_name: 'Current name', winery: 'Published producer', public_lot_label: 'Lot', image_url: 'https://example.invalid/new.jpg' }, agro_product_profile: null }) };

test('published identity updates the collection while preserving historical evidence and saved identity', () => {
  const result = withConsumerCurrentEditorial(row, publication);
  assert.equal(result.product_name, 'Current name'); assert.equal(result.brand_name, 'Published producer');
  assert.equal(result.image_url, 'https://example.invalid/new.jpg'); assert.equal(result.historical_product_name, 'Saved name');
  assert.equal(result.historical_brand_name, row.brand_name); assert.equal(result.historical_image_url, row.image_url);
  for (const key of ['latest_verdict', 'ownership_status', 'latest_tap_at']) assert.equal(result[key], row[key]);
  assert.equal('editorial_tenant_id' in result, false);
  assert.equal(row.product_name, 'Saved name');
});

test('unpublished, withdrawn, invalid and unavailable content never replaces the saved copy', () => {
  for (const state of ['legacy', 'unpublished', 'withdrawn', 'invalid', 'unavailable']) {
    const current = { protocol: publication.protocol, source: publication.source, state, observedAt: null };
    const result = withConsumerCurrentEditorial(row, current);
    for (const key of ['product_name', 'brand_name', 'image_url']) assert.equal(result[key], row[key]);
    assert.deepEqual(result.currentEditorial, current);
    assert.equal('document' in result.currentEditorial, false);
  }
});
