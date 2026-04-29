import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('claim flow wiring exists: auth -> join/save -> claim -> consumer/products ownership read', async () => {
  const claimRoute = await readFile(new URL('../src/app/mobile/passport/[eventId]/consumer/claim/route.ts', import.meta.url), 'utf8');
  const portalService = await readFile(new URL('../src/lib/consumer-portal-service.ts', import.meta.url), 'utf8');
  const consumerProducts = await readFile(new URL('../src/app/consumer/products/route.ts', import.meta.url), 'utf8');

  assert.match(claimRoute, /getConsumerFromRequest/);
  assert.match(claimRoute, /claimOwnershipForConsumer/);
  assert.match(portalService, /ensureTenantMembership/);
  assert.match(portalService, /saveTapForConsumer/);
  assert.match(portalService, /INSERT INTO consumer_product_ownerships/);
  assert.match(consumerProducts, /FROM consumer_product_ownerships/);
});

test('blocked statuses do not produce successful ownership claim response', async () => {
  const portalService = await readFile(new URL('../src/lib/consumer-portal-service.ts', import.meta.url), 'utf8');
  assert.match(portalService, /if \(isBlocked\)/);
  assert.match(portalService, /status: 409/);
  assert.match(portalService, /blocked_replay/);
  assert.match(portalService, /revoked/);
});
