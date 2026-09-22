import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { readCurrentPassportEditorial, projectCurrentPassportEditorial } from '../src/lib/current-passport-editorial.ts';
import { editorialContentDigest, parseEditorialDocument } from '../src/lib/passport-editorial-policy.ts';

const observed = '2026-09-21T23:00:00.000Z';
const publishedAt = '2026-09-20T12:34:56.000Z';
const document = () => parseEditorialDocument({ schemaVersion: 'nexid.passport-editorial.v1', template: 'general', locale: 'es-AR', identity: { product_name: 'Published QA product', public_lot_label: 'QA lot' }, agro_product_profile: null });
function row() {
  const doc = document(), digest = editorialContentDigest(doc);
  return { event_id: '715', tenant_id: '10000000-0000-4000-8000-000000000001', batch_id: '20000000-0000-4000-8000-000000000001',
    scope_valid: true, batch_status: 'active', editorial_managed: true, head_present: true, head_scope_valid: true,
    published: { version: 2, contentDigest: digest, document: doc }, published_version: 2, publication_count: 2, distinct_revisions: 2, valid_revisions: true,
    latest_publication: { revision: 10, content_digest: digest, document: doc, created_at: publishedAt }, live_projection_matches: true, observed_at: observed };
}
function empty(result, expected) {
  assert.equal(result.state, expected);
  assert.deepEqual(Object.keys(result).sort(), ['protocol', 'source', 'state', 'observedAt'].sort());
  assert.equal(result.protocol, 'nexid.current-editorial.v1');
  assert.equal(result.source, 'passport_studio');
}

test('published current editorial has only validated public document and real publication metadata', () => {
  const input = row(), before = structuredClone(input);
  const result = projectCurrentPassportEditorial(input);
  assert.equal(result.state, 'published'); assert.equal(result.version, 2);
  assert.equal(result.publishedAt, publishedAt); assert.equal(result.observedAt, observed);
  assert.deepEqual(result.document, document()); assert.deepEqual(input, before);
  assert.deepEqual(Object.keys(result).sort(), ['protocol', 'source', 'state', 'observedAt', 'version', 'publishedAt', 'contentDigest', 'document'].sort());
  result.document.identity.product_name = 'changed client object';
  assert.deepEqual(input, before);
});

test('scope, projection drift, incomplete versions and publication history fail closed', () => {
  for (const patch of [
    { scope_valid: false }, { head_scope_valid: false }, { batch_id: null }, { tenant_id: null }, { head_present: false }, { editorial_managed: false },
    { live_projection_matches: false }, { publication_count: 1 }, { publication_count: 3 }, { distinct_revisions: 1 }, { valid_revisions: false },
    { published_version: -1 }, { published_version: '2' }, { published_version: 1.5 }, { observed_at: null }, { batch_status: 'unknown' },
    { published: null }, { published: [] }, { published: { ...row().published, version: 1 } }, { published: { ...row().published, contentDigest: 'a'.repeat(64) } },
    { latest_publication: null }, { latest_publication: { ...row().latest_publication, created_at: '2026-09-22T00:00:00Z' } },
    { latest_publication: { ...row().latest_publication, created_at: 'not a date' } }, { latest_publication: { ...row().latest_publication, content_digest: 'b'.repeat(64) } },
    { latest_publication: { ...row().latest_publication, document: { ...document(), private_key: 'not-public' } } },
    { published: { ...row().published, document: { ...document(), identity: { ...document().identity, uid: 'not-public' } } } },
  ]) empty(projectCurrentPassportEditorial({ ...row(), ...patch }), 'invalid');
});

test('legacy, version-zero baseline, withdrawn batch and missing event are separate non-content states', () => {
  empty(projectCurrentPassportEditorial(null), 'unavailable');
  empty(projectCurrentPassportEditorial({ ...row(), editorial_managed: false, head_present: false, publication_count: 0 }), 'legacy');
  empty(projectCurrentPassportEditorial({ ...row(), published_version: 0, published: { ...row().published, version: 0 }, publication_count: 0, distinct_revisions: 0 }), 'unpublished');
  empty(projectCurrentPassportEditorial({ ...row(), published_version: 0, published: { ...row().published, version: 0 } }), 'invalid');
  for (const status of ['draft', 'revoked', 'deprecating', 'archived']) empty(projectCurrentPassportEditorial({ ...row(), batch_status: status }), 'withdrawn');
  for (const status of ['active', 'active_in_market', 'production_registered']) assert.equal(projectCurrentPassportEditorial({ ...row(), batch_status: status }).state, 'published');
});

test('event references stay exact and invalid references never reach SQL', async () => {
  let calls = 0;
  const execute = async (strings, ...values) => {
    calls++; assert.equal(values.length, 1); assert.equal(values[0], '9223372036854775807');
    const query = strings.join('?'); assert.match(query, /batch\.id = event\.batch_id AND batch\.tenant_id = event\.tenant_id/);
    assert.doesNotMatch(query, /\bdraft\b|\bbid\b|\buid_hex\b|\b(?:INSERT|UPDATE|CREATE|ALTER|DELETE)\b/i);
    return [row()];
  };
  for (const value of [null, 715, '0', '-1', '01', '1.2', '1e2', '9223372036854775808', '715 OR 1=1']) empty(await readCurrentPassportEditorial(value, execute), 'unavailable');
  assert.equal(calls, 0);
  assert.equal((await readCurrentPassportEditorial('9223372036854775807', execute)).state, 'published');
  assert.equal(calls, 1);
});

test('source failures, absent events and duplicate rows cannot produce current content', async () => {
  empty(await readCurrentPassportEditorial('715', async () => { throw new Error('SQL secret detail'); }), 'unavailable');
  empty(await readCurrentPassportEditorial('715', async () => []), 'unavailable');
  empty(await readCurrentPassportEditorial('715', async () => [row(), row()]), 'invalid');
});

function functionFrom(source, name, bindings) {
  const ast = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const node = ast.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
  assert.ok(node, name);
  const code = ts.transpileModule(node.getText(ast).replace(/^export\s+/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(bindings), `${code}\nreturn ${name};`)(...Object.values(bindings));
}

test('actual snapshot reader adds current projection without changing historical contract or fresh decision', async () => {
  const source = await readFile(new URL('../src/lib/sun-diagnostics.ts', import.meta.url), 'utf8');
  const historical = { eventId: '715', identity: { eventId: '715', bid: 'QA' }, product: { agro: { technicalSheetUrl: 'https://example.invalid/historical.pdf' } },
    status: { code: 'VALID_OPENED' }, tapContext: { utcTime: '2026-09-19T00:00:00Z' }, ttStatus: 'opened' };
  let fresh = false, lookups = [], editorial = projectCurrentPassportEditorial(row());
  const reader = functionFrom(source, 'getSunDiagnosticSnapshot', {
    sql: async () => [{ id: 510, trace_id: 'trace', created_at: '2026-09-19T00:00:00Z', bid: 'QA', uid_hex: 'QA_ONLY', result_json: { contract: structuredClone(historical) } }],
    ensureTable: async () => {}, asRecord: value => value || {}, resolveCurrentSnapshotIdentity: async () => null, resolveCurrentSnapshotTapLocation: async () => null,
    readCurrentPassportEditorial: async eventId => { lookups.push(eventId); return { ...editorial }; },
    createSupportReportCapability: async () => null,
    normalizeSnapshotContractFromCurrentIdentity: value => value, sanitizeSnapshotPublicCoordinates: value => value,
    normalizeSunProfileMismatchContract: value => value, normalizeSnapshotContractFromCurrentTap: value => value,
    verifySunFreshHandoffToken: () => fresh ? { ok: true, payload: { exp: 1790100000 } } : { ok: false },
    markFreshHandoffContract: value => ({ ...value, mode: 'fresh' }), markHistoricalSnapshotContract: value => ({ ...value, mode: 'historical' }),
    withContractSummaryFields: value => ({ ...value }), createPublicCertificateShareToken: () => 'qa-share',
  });
  for (const state of [false, true]) {
    fresh = state;
    const result = await reader('510', 'trace');
    assert.equal(result.contract.currentEditorial.state, 'published');
    assert.equal(result.snapshot_access, state ? 'fresh_handoff' : 'historical');
    for (const key of ['product', 'status', 'tapContext', 'ttStatus']) assert.deepEqual(result.contract[key], historical[key]);
  }
  assert.deepEqual(lookups, ['715', '715']);
  for (const state of ['invalid', 'unavailable', 'legacy', 'withdrawn', 'unpublished']) {
    editorial = { protocol: 'nexid.current-editorial.v1', source: 'passport_studio', state, observedAt: null };
    const result = await reader('510', 'trace');
    assert.equal(result.contract.currentEditorial.state, state);
    assert.deepEqual(result.contract.product, historical.product);
    assert.deepEqual(result.contract.status, historical.status);
  }
});

test('actual snapshot route denies missing access before calling the reader', async () => {
  const source = await readFile(new URL('../src/app/sun/snapshot/[diagnosticId]/route.ts', import.meta.url), 'utf8');
  let calls = 0;
  const route = functionFrom(source, 'GET', { json: (body, status, headers) => Response.json(body, { status, headers }),
    verifySunSnapshotAccessToken: () => ({ ok: false }), getSunDiagnosticSnapshot: () => { calls++; throw new Error('not authorized'); } });
  const response = await route(new Request('https://api.example/sun/snapshot/510?trace=trace'), { params: Promise.resolve({ diagnosticId: '510' }) });
  assert.equal(response.status, 404); assert.equal(calls, 0);
});
