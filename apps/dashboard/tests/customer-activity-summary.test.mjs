import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildCustomerActivitySummary, customerActivityDestination } from '../src/lib/customer-activity-summary.ts';
import { customerActivityCopy } from '../src/lib/customer-activity-copy.ts';

const ready = () => ({ availability: 'ready', source: 'production' });
const row = (id = 'same-reference', patch = {}) => ({ id, tenant_slug: 'qa-only', status: 'open', ...patch });
const input = (patch = {}) => ({ leads: [], tickets: [], orders: [], tenantScope: 'qa-only', demoMode: false,
  collections: { leads: ready(), tickets: ready(), orders: ready() }, ...patch });
const build = patch => buildCustomerActivitySummary(input(patch));
const card = (summary, kind = 'leads') => summary.cards.find(value => value.kind === kind);

test('confirmed empty sources have independent explicit zero counts', () => {
  assert.deepEqual(build().cards.map(value => value.count), [0, 0, 0]);
  assert.ok(build().cards.every(value => value.availability === 'ready' && value.source === 'production'));
});

test('a closed prospect is not a won sale and different domains are not a conversion funnel', () => {
  const value = build({ leads: [row('a', { status: 'closed' }), row('b', { status: 'converted' })], tickets: [row()], orders: [row('c', { status: 'completed' })] });
  assert.deepEqual(value.cards.map(value => value.count), [2, 1, 1]);
  assert.deepEqual(card(value).statuses.map(value => value.value), ['closed', 'converted']);
  assert.deepEqual(Object.keys(value).sort(), ['cards', 'demo', 'scope']);
  assert.ok(!/won|revenue|funnel|conversionRate|meetingCount/.test(JSON.stringify(value)));
});

test('meeting and sales words in free text cannot become activity metrics or channels', () => {
  const value = build({ leads: [row('a', { notes: 'not a meeting; no llamada, private sale or call', message: 'sin reunion', source: null })] });
  assert.equal(card(value).count, 1);
  const serialized = JSON.stringify(value);
  for (const field of ['notes', 'message', 'web_bot', 'assistant', 'contact', 'meeting', 'llamada']) assert.equal(serialized.includes(field), false);
});

for (const availability of ['access_denied', 'upstream_error', 'unreachable', 'invalid_payload']) {
  test(`${availability} withholds the count and states without hiding another healthy source`, () => {
    const value = build({ leads: [row()], tickets: [row()], collections: { leads: { availability, source: 'unavailable' }, tickets: ready(), orders: ready() } });
    assert.deepEqual(card(value), { kind: 'leads', availability, source: 'unavailable', count: null, statuses: [] });
    assert.equal(card(value, 'tickets').count, 1);
  });
}

test('unknown or missing collection metadata is not confirmed production', () => {
  for (const state of [undefined, null, {}, { availability: 'ready' }, { availability: 'ready', source: 'unavailable' }, { availability: 'ready', source: 'declared' }, { availability: 'true', source: 'production' }]) {
    assert.equal(card(build({ collections: { leads: state, tickets: ready(), orders: ready() } })).count, null);
  }
});

test('a foreign tenant or absent assignment cannot populate a tenant summary', () => {
  for (const tenant_slug of ['other-company', null, undefined, {}, 42]) {
    assert.equal(card(build({ leads: [row('a', { tenant_slug })] })).count, null);
  }
  assert.equal(card(build({ leads: [row('a', { tenant_slug: ' QA-ONLY ' })] })).count, 1);
});

test('a context change cannot reuse the previous company sample', () => {
  const leads = [row()];
  assert.equal(card(build({ leads })).count, 1);
  assert.equal(card(build({ leads, tenantScope: 'other-company' })).count, null);
  assert.equal(card(build({ leads: [row('new', { tenant_slug: 'other-company' })], tenantScope: 'other-company' })).count, 1);
});

test('global identity keeps identical references from different tenants distinct', () => {
  const value = build({ tenantScope: '', leads: [row(), row('same-reference', { tenant_slug: 'other-company' }), row('historical', { tenant_slug: null })] });
  assert.equal(card(value).count, 3);
  assert.equal(card(build({ leads: [row()], tickets: [row()] }), 'tickets').count, 1);
});

test('duplicate identities make the source unconfirmed rather than inflate a count', () => {
  const value = build({ leads: [row(), row('same-reference', { status: 'closed' })] });
  assert.equal(card(value).count, null);
  assert.equal(card(value).statuses.length, 0);
});

test('demo requires both explicit session mode and matching collection provenance', () => {
  const demo = { availability: 'ready', source: 'demo' };
  const collections = { leads: demo, tickets: demo, orders: demo };
  assert.equal(card(build({ leads: [row()], collections })).count, null);
  const illustrated = build({ leads: [row()], collections, demoMode: true });
  assert.equal(illustrated.demo, true); assert.equal(card(illustrated).source, 'demo'); assert.equal(card(illustrated).count, 1);
  assert.equal(card(build({ leads: [row()], demoMode: true })).count, null);
});

for (const marker of [{ demoMode: true }, { dataSource: 'demo' }, { is_demo: true }]) {
  test(`an explicit illustrative row ${Object.keys(marker)[0]} cannot enter production counts`, () => {
    assert.equal(card(build({ leads: [row('a', marker)] })).count, null);
  });
}

test('demo in a tenant or channel name never changes authoritative provenance', () => {
  const value = build({ tenantScope: 'customer-demo-lab', leads: [row('a', { tenant_slug: 'customer-demo-lab', source: 'demo_lab' })] });
  assert.equal(card(value).source, 'production'); assert.equal(card(value).count, 1);
});

test('missing and literal status values are preserved without default open/new', () => {
  const leads = [row('a', { status: null }), row('b', { status: '' }), row('c', { status: undefined }), row('d', { status: 'awaiting_supplier' }), row('e', { status: 'CLOSED' }), row('f', { status: ' closed ' })];
  const statuses = card(build({ leads })).statuses;
  assert.equal(statuses.find(value => value.value === null).count, 3);
  for (const literal of ['awaiting_supplier', 'CLOSED', ' closed ']) assert.equal(statuses.find(value => value.value === literal).count, 1);
  assert.equal(statuses.some(value => value.value === 'open'), false);
});

test('malformed records and invalid status types are rejected, not partly counted', () => {
  for (const invalid of [null, [], {}, row('', {}), row(33), row('a', { status: 1 }), row('a', { status: 'a'.repeat(65) }), row('a', { status: 'open\u0000closed' })]) {
    assert.equal(card(build({ leads: [row('valid'), invalid] })).count, null);
  }
  for (const leads of [null, {}, 'rows']) assert.equal(card(build({ leads })).count, null);
});

test('a complete loaded collection is not truncated to the eighty-item signal timeline', () => {
  const leads = Array.from({ length: 200 }, (_, index) => row(String(index)));
  assert.equal(card(build({ leads })).count, 200);
  assert.equal(card(build({ leads })).statuses[0].count, 200);
  assert.equal(card(build({ leads: Array.from({ length: 5001 }, (_, index) => row(String(index))) })).count, null);
});

test('status buckets always reconcile and handle prototype-like literal keys safely', () => {
  const leads = ['__proto__', 'constructor', null, 'open', 'open'].map((status, index) => row(String(index), { status }));
  const value = card(build({ leads }));
  assert.equal(value.statuses.reduce((sum, item) => sum + item.count, 0), value.count);
  assert.equal(value.statuses[0].value, 'open');
});

test('projection is deterministic, does not mutate input and excludes customer detail and contact', () => {
  const supplied = input({ leads: [row('a', { contact: 'qa@example.invalid', detail: 'not for metric output', uid_hex: 'private-value', meta: { meeting: true } })] });
  const before = structuredClone(supplied);
  Object.freeze(supplied.leads[0]); Object.freeze(supplied.leads);
  assert.deepEqual(buildCustomerActivitySummary(supplied), buildCustomerActivitySummary(supplied));
  assert.deepEqual(supplied, before);
  assert.ok(!/qa@example|uid_hex|private-value|meta|detail/.test(JSON.stringify(buildCustomerActivitySummary(supplied))));
});

test('invalid context fails closed and does not broaden the request scope', () => {
  for (const context of [{ tenantScope: null }, { tenantScope: {} }, { tenantScope: 'a'.repeat(129) }, { tenantScope: 'qa-only\nother' }, { demoMode: 'false' }]) {
    assert.ok(build(context).cards.every(value => value.count === null));
  }
});

test('actions resolve only existing local inboxes and translated copy has identical keys', () => {
  assert.deepEqual(['leads', 'tickets', 'orders'].map(customerActivityDestination), ['prospects', 'tickets', 'orders']);
  for (const copy of Object.values(customerActivityCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(customerActivityCopy['es-AR']).sort());
    assert.ok(Object.values(copy).every(value => typeof value === 'string' && value.trim()));
    assert.notEqual(copy.empty, copy.access_denied);
  }
});

test('real workspace removes inferred meetings, the mixed funnel and invented acquisition defaults', async () => {
  const source = await readFile(new URL('../src/app/(app)/leads-tickets/leads-tickets-client.tsx', import.meta.url), 'utf8');
  for (const obsolete of ['pipelineStages', 'allSources', 'totalSourcesCount', 'CRM Pipeline & Funnel', 'Cerrado / Ganado', 'Distribución de Canales de Adquisición', 'label: "Reuniones"']) assert.equal(source.includes(obsolete), false);
  assert.match(source, /<CustomerActivitySummary summary=\{activitySummary\}/);
  assert.match(source, /collections: signalCollections, tenantScope, demoMode/);
  assert.match(source, /setActiveTab\(customerActivityDestination\(kind\)\)/);
  assert.match(source, /setSearchTerm\(""\)/);
  assert.match(source, /contentRef\.current\?\.focus\(\)/);
  assert.match(source, /<TicketReferenceLookup key=/);
});

test('summary exposes no fetch, browser storage, external links or business mutations', async () => {
  const source = await readFile(new URL('../src/components/customer-activity-summary.tsx', import.meta.url), 'utf8');
  assert.ok(!/\bfetch\(|localStorage|sessionStorage|setInterval|dangerouslySetInnerHTML|href=/.test(source));
  assert.match(source, /disabled=\{card.count === null\}/);
  assert.match(source, /aria-controls=\{controls\}/);
  assert.match(source, /bucket.value \?\? copy.missing/);
});

test('local theme tokens keep text and focus contrast in light and dark with touch-safe controls', async () => {
  const css = await readFile(new URL('../src/components/customer-activity-summary.module.css', import.meta.url), 'utf8');
  const lum = hex => {
    const rgb = hex.match(/\w\w/g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
  for (const block of css.matchAll(/--ca-bg: #(\w+); --ca-border: #(\w+); --ca-text: #(\w+); --ca-muted: #(\w+); --ca-accent: #(\w+);/g)) {
    for (const foreground of [block[3], block[4], block[5]]) assert.ok(contrast(foreground, block[1]) >= 4.5);
    assert.ok(contrast(block[2], block[1]) >= 3);
  }
  assert.match(css, /min-height: 44px/); assert.match(css, /focus-visible/); assert.match(css, /grid-template-columns: 1fr/);
  assert.ok(!/animation:|transition:/.test(css));
});
