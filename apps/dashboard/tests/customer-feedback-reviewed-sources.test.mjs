import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CUSTOMER_FEEDBACK_BASE, CUSTOMER_FEEDBACK_CHANGED, CUSTOMER_FEEDBACK_ADDED, customerFeedbackPriorHash, customerFeedbackPriorInventory, assertCustomerFeedbackAdded } from './helpers/customer-feedback-reviewed-sources.mjs';
import { readHistoricalBaseline } from './helpers/tenant-sync-reviewed-sources.mjs';
import { ENGAGEMENT_GOVERNANCE_ADDED } from './helpers/engagement-governance-reviewed-sources.mjs';
import { TENANT_MARKETPLACE_ADDED } from './helpers/tenant-marketplace-reviewed-sources.mjs';
import { REWARD_NOTICE_ADDED } from './helpers/reward-notice-reviewed-sources.mjs';
import { CRM_ORDER_REQUEST_ADDED } from './helpers/crm-order-request-reviewed-sources.mjs';
import { TICKET_STATUS_SYNC_ADDED, ticketStatusSyncPriorInventory } from './helpers/ticket-status-sync-reviewed-sources.mjs';

// Independently derived normalized Git blobs from published 60d. Never reset the historical fixtures.
const productionBefore = {
  'apps/dashboard/src/app/(app)/events/page.tsx': 'b3477570ae24cedb9dbf8b802bb842bb6813a64dc85aede15a2c4d3c5339f1c6',
  'apps/dashboard/src/app/(app)/experiences/page.tsx': '4e11655297050125b467bc13bcf27cb2f0ad6c20cf7dd9c90e2ba1717773c04d',
  'apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx': '95c8b470a0524f94974820ddda512ab172a651ab10a8792fef7c47955f4a0638',
  'apps/dashboard/src/app/(app)/logistics/shipments/page.tsx': '30b03f3757d7125e0aa9b72cdcdceb70dda90ba9a2c644bee802851c47b97ef9',
  'apps/dashboard/src/app/(app)/loyalty/page.tsx': 'c9be7ca5b31580d4bfce54434c7863660bc1a6096b7a76fad5a9a95a2212241a',
  'apps/dashboard/src/app/(app)/resellers/page.tsx': 'ece898ab35b2221970e84693b4df498db0f5f794a83284c3b1e74452cbe26ae8',
  'apps/dashboard/src/app/(app)/subscriptions/page.tsx': '4c0d04f62c4db69eef963d7cfb3db79ce823c42b3cd6bb97a659db758bc608ff',
  'apps/dashboard/src/app/(app)/supplier-orders/[orderId]/page.tsx': 'e404683d8276dc0ed2cb50bf25025e547cc5753eafe281adcb1b99e7eee53cd1',
  'apps/dashboard/src/app/(app)/supplier-orders/page.tsx': 'd79036561103b90f8573a7174f4bc2506c1bc8becd1fa833dd0ed57462be824c',
  'apps/dashboard/src/app/(app)/tenants/page.tsx': '40022e569e003aff9e171927756b8bb4d9a3d2d24404be861b42450e1066e890',
  'apps/dashboard/src/components/dashboard-home-client.tsx': '60cba9ee134c49ce8bd28801c7497a1834f792984170af46fe7a8d26e5dcc387',
  'apps/dashboard/src/components/data-table.tsx': '3977c062764432b362e2ed91af95a9b4d4fafaa21980bf10a901bf82b91f7385',
  'apps/dashboard/src/components/tenant-marketplace-workspace.module.css': '4b732c4bc1473f4f562f578ceaf33cfaecdc266a4b9722031724668736298e71',
  'apps/dashboard/src/components/tenant-marketplace-workspace.tsx': '267e33fecb730b2449d73887ea1090a77b1db102e39010620908e1963109bcdb',
  'apps/dashboard/src/lib/dashboard-content.ts': 'a95691a875b962e2768375332cb2b8e229d69883be5f839b2460673009d7084d',
};
const hash = text => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex');
const readSource = name => readFile(new URL('../' + name.replace(/^apps\/dashboard\//, ''), import.meta.url), 'utf8');

test('customer feedback overlay pins exactly fifteen Production origins and one explicit addition', () => {
  assert.equal(CUSTOMER_FEEDBACK_BASE, '60d6827b890a332fb0269146a9eca09997c9dfd0');
  assert.deepEqual(Object.keys(CUSTOMER_FEEDBACK_CHANGED).sort(), Object.keys(productionBefore).sort());
  assert.deepEqual(Object.keys(CUSTOMER_FEEDBACK_ADDED), ['apps/dashboard/src/lib/data-table-copy.ts']);
  assert.ok(Object.isFrozen(CUSTOMER_FEEDBACK_CHANGED) && Object.isFrozen(CUSTOMER_FEEDBACK_ADDED));
  for (const [name, pin] of Object.entries(CUSTOMER_FEEDBACK_CHANGED)) {
    assert.deepEqual(Object.keys(pin).sort(), ['after', 'before']);
    assert.equal(pin.before, productionBefore[name], name + ' independently derived published origin');
    assert.match(pin.after, /^[a-f0-9]{64}$/);assert.notEqual(pin.after, pin.before);
  }
});

for (const [name, pin] of Object.entries(CUSTOMER_FEEDBACK_CHANGED)) {
  test('customer feedback accepts only reviewed successor bytes: ' + name, async () => {
    assert.equal(hash(await readSource(name)), pin.after);
    assert.equal(customerFeedbackPriorHash(name, pin.after), productionBefore[name]);
    for (const wrong of [pin.before, '0'.repeat(64), '', undefined]) {
      assert.throws(() => customerFeedbackPriorHash(name, wrong), /exact reviewed customer feedback increment/);
    }
  });
}

test('unknown source bytes pass through unchanged and cannot impersonate a reviewed origin', () => {
  const name = 'apps/dashboard/src/lib/future-unreviewed.ts', value = 'unknown-future-bytes';
  assert.equal(customerFeedbackPriorHash(name, value), value);
  assert.throws(() => assert.equal(customerFeedbackPriorHash(name, value), 'historical-origin'));
  assert.throws(() => assertCustomerFeedbackAdded(name, '0'.repeat(64)), /known customer feedback addition/);
});

test('new source has exact content identity and no alternate or previous hash is admitted', async () => {
  for (const [name, expected] of Object.entries(CUSTOMER_FEEDBACK_ADDED)) {
    assertCustomerFeedbackAdded(name, hash(await readSource(name)));
    for (const wrong of ['0'.repeat(64), productionBefore['apps/dashboard/src/components/data-table.tsx'], '', undefined]) {
      assert.throws(() => assertCustomerFeedbackAdded(name, wrong), /exact reviewed customer feedback addition/);
    }
    assert.equal(customerFeedbackPriorHash(name, expected), expected, 'added source is validated separately and never rewritten into an old source');
  }
});

test('inventory normalization preserves the complete historical guard and rejects unknown, missing and duplicate sources', async () => {
  const baseline = readHistoricalBaseline('release-convergence', await readFile(new URL('./fixtures/release-convergence-baseline.json', import.meta.url), 'utf8'));
  const prior = [...Object.keys(baseline.expected), ...Object.keys(ENGAGEMENT_GOVERNANCE_ADDED), ...Object.keys(TENANT_MARKETPLACE_ADDED), ...Object.keys(REWARD_NOTICE_ADDED), ...Object.keys(CRM_ORDER_REQUEST_ADDED), ...Object.keys(TICKET_STATUS_SYNC_ADDED)];
  const current = [...prior, ...Object.keys(CUSTOMER_FEEDBACK_ADDED)], original = [...current];
  assert.deepEqual(customerFeedbackPriorInventory(current), prior);assert.deepEqual(current, original);
  ticketStatusSyncPriorInventory(customerFeedbackPriorInventory(current), baseline.expected);
  assert.throws(() => customerFeedbackPriorInventory(prior), /exactly one reviewed addition/);
  for (const name of current) assert.throws(() => customerFeedbackPriorInventory([...current, name]), /no duplicate source paths/);
  for (const name of Object.keys(CUSTOMER_FEEDBACK_CHANGED)) {
    assert.throws(() => ticketStatusSyncPriorInventory(customerFeedbackPriorInventory(current.filter(value => value !== name)), baseline.expected));
  }
  const unknown = 'apps/dashboard/src/future-unreviewed.ts';
  assert.ok(customerFeedbackPriorInventory([...current, unknown]).includes(unknown), 'unknown additions are never silently discarded');
  assert.throws(() => ticketStatusSyncPriorInventory(customerFeedbackPriorInventory([...current, unknown]), baseline.expected));
});
