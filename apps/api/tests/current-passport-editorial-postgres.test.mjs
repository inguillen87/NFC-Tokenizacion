import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { readCurrentPassportEditorial } from '../src/lib/current-passport-editorial.ts';
import { editorialContentDigest, parseEditorialDocument } from '../src/lib/passport-editorial-policy.ts';

function qaTarget(value) {
  const target = new URL(value || 'http://missing.invalid');
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Loopback only');
  assert.equal(decodeURIComponent(target.pathname), '/nexid_e2e_s8');
  assert.equal(decodeURIComponent(target.username), 'nexid_e2e');
  assert.equal(target.search, ''); assert.equal(target.hash, '');
  return target.toString();
}
test('current editorial PostgreSQL harness accepts only the explicit isolated S8 database', () => {
  for (const value of [null, 'postgres://nexid_e2e@remote.invalid/nexid_e2e_s8', 'postgres://postgres@localhost/nexid_e2e_s8', 'postgres://nexid_e2e@localhost/production', 'postgres://nexid_e2e@localhost/nexid_e2e_s8?options=x']) assert.throws(() => qaTarget(value));
});

test('actual PostgreSQL projection separates published content, history, scope, drift and unavailable states', { skip: !process.env.NEXID_S8_QA_DATABASE_URL }, async () => {
  const client = new pg.Client({ connectionString: qaTarget(process.env.NEXID_S8_QA_DATABASE_URL) });
  const schema = `qa_editorial_${randomUUID().replaceAll('-', '')}`;
  const tenantA = '10000000-0000-4000-8000-000000000001', tenantB = '10000000-0000-4000-8000-000000000002';
  const batchA = '20000000-0000-4000-8000-000000000001', batchB = '20000000-0000-4000-8000-000000000002';
  const at = '2020-01-02T03:04:05.000Z';
  const doc = name => parseEditorialDocument({ schemaVersion: 'nexid.passport-editorial.v1', template: 'general', locale: 'es-AR', identity: { product_name: name, public_lot_label: 'Shared lot' }, agro_product_profile: null });
  const publication = (document, version) => ({ version, document, contentDigest: editorialContentDigest(document) });
  const config = document => ({ ...document.identity, lot: document.identity.public_lot_label, batch_lot: document.identity.public_lot_label, lot_number: document.identity.public_lot_label,
    sun: { product: { name: document.identity.product_name, producer: document.identity.winery, sku: document.identity.sku, imageUrl: document.identity.image_url }, origin: { region: document.identity.region } },
    ...(document.agro_product_profile ? { agro_product_profile: document.agro_product_profile } : {}),
    private_key: 'QA_DO_NOT_PROJECT', diagnostic_fixture: 'QA_ONLY_NOT_PRODUCTION' });
  const old = doc('Historical v1'), current = doc('Current v2'), other = doc('Other tenant'), draft = doc('UNPUBLISHED_DRAFT_QA');
  let reads = 0;
  try {
    await client.connect();
    const identity = (await client.query('SELECT current_database() AS db,current_user AS role')).rows[0];
    assert.equal(identity.db, 'nexid_e2e_s8'); assert.equal(identity.role, 'nexid_e2e');
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
    await client.query("SET LOCAL statement_timeout='15000'; SET LOCAL lock_timeout='5000'");
    await client.query(`
      CREATE TABLE tenants(id uuid PRIMARY KEY);
      CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid,bid text,status text,editorial_managed boolean,sdm_config jsonb);
      CREATE TABLE events(id bigint PRIMARY KEY,tenant_id uuid,batch_id uuid,bid text);
      CREATE TABLE passport_editorial_heads(batch_id uuid PRIMARY KEY,tenant_id uuid,published jsonb,published_version integer,draft jsonb);
      CREATE TABLE passport_editorial_history(batch_id uuid,tenant_id uuid,revision integer,action text,content_digest text,document jsonb,created_at timestamptz,UNIQUE(batch_id,revision));
    `);
    await client.query('INSERT INTO tenants VALUES($1),($2)', [tenantA, tenantB]);
    for (const [batch, tenant, document, version] of [[batchA, tenantA, current, 2], [batchB, tenantB, other, 1]]) {
      await client.query("INSERT INTO batches VALUES($1,$2,'SAME-BID','active',true,$3)", [batch, tenant, JSON.stringify(config(document))]);
      await client.query('INSERT INTO passport_editorial_heads VALUES($1,$2,$3,$4,$5)', [batch, tenant, JSON.stringify(publication(document, version)), version, JSON.stringify(draft)]);
    }
    await client.query("INSERT INTO events VALUES(715,$1,$2,'SAME-BID'),(716,$3,$4,'SAME-BID'),(717,$1,NULL,'SAME-BID'),(718,$3,$2,'SAME-BID'),(9223372036854775807,$1,$2,'SAME-BID')", [tenantA, batchA, tenantB, batchB]);
    for (const [batch, tenant, revision, action, document] of [[batchA, tenantA, 4, 'publish', old], [batchA, tenantA, 9, 'publish', current], [batchA, tenantA, 12, 'save', draft], [batchB, tenantB, 4, 'publish', other]]) {
      await client.query('INSERT INTO passport_editorial_history VALUES($1,$2,$3,$4,$5,$6,$7)', [batch, tenant, revision, action, editorialContentDigest(document), JSON.stringify(document), at]);
    }
    const execute = async (strings, ...values) => {
      const query = strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, '');
      assert.match(query.trim(), /^SELECT\b/);
      assert.doesNotMatch(query, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|draft|bid|uid_hex)\b|\bpublic\s*\./i);
      reads++;
      return (await client.query(query, values)).rows;
    };
    const read = event => readCurrentPassportEditorial(event || '715', execute);
    const base = await read();
    assert.equal(base.state, 'published'); assert.equal(base.version, 2); assert.equal(base.publishedAt, at);
    assert.deepEqual(base.document, current); assert.equal(reads, 1);
    assert.doesNotMatch(JSON.stringify(base), /UNPUBLISHED|private_key|QA_DO_NOT_PROJECT|Historical v1|tenant_id|batch_id/);
    assert.equal((await read('716')).document.identity.product_name, 'Other tenant');
    assert.equal((await read('9223372036854775807')).document.identity.product_name, 'Current v2');
    assert.equal((await read('717')).state, 'invalid');
    assert.equal((await read('718')).state, 'invalid');
    assert.equal((await read('999')).state, 'unavailable');
    let cases = 0;
    async function scenario(name, mutate, expected, inspect) {
      await client.query('SAVEPOINT scenario');
      try {
        await mutate(); const value = await read();
        assert.equal(value.state, expected, name);
        if (expected !== 'published') assert.deepEqual(Object.keys(value).sort(), ['protocol', 'source', 'state', 'observedAt'].sort(), name);
        if (inspect) inspect(value);
        cases++;
      } finally { await client.query('ROLLBACK TO SAVEPOINT scenario'); }
    }
    await scenario('same digest republished at same timestamp retains its exact newer version', async () => {
      await client.query('UPDATE passport_editorial_heads SET published=$1,published_version=3 WHERE batch_id=$2', [JSON.stringify(publication(current, 3)), batchA]);
      await client.query("INSERT INTO passport_editorial_history VALUES($1,$2,13,'publish',$3,$4,$5)", [batchA, tenantA, editorialContentDigest(current), JSON.stringify(current), at]);
    }, 'published', value => { assert.equal(value.version, 3); assert.equal(value.publishedAt, at); });
    await scenario('later unpublished draft never becomes current', () => client.query('UPDATE passport_editorial_heads SET draft=$1 WHERE batch_id=$2', [JSON.stringify({ private: 'NEW_DRAFT' }), batchA]), 'published');
    await scenario('missing history invalidates claimed head version', () => client.query('DELETE FROM passport_editorial_history WHERE batch_id=$1 AND revision=4', [batchA]), 'invalid');
    await scenario('extra publication invalidates stale head even if latest digest matches', () => client.query("INSERT INTO passport_editorial_history VALUES($1,$2,13,'publish',$3,$4,$5)", [batchA, tenantA, editorialContentDigest(current), JSON.stringify(current), at]), 'invalid');
    await scenario('latest digest mismatch does not fall back to an earlier matching publication', () => client.query('UPDATE passport_editorial_history SET content_digest=$1 WHERE batch_id=$2 AND revision=9', [editorialContentDigest(old), batchA]), 'invalid');
    await scenario('history document digest must match', () => client.query('UPDATE passport_editorial_history SET document=$1 WHERE batch_id=$2 AND revision=9', [JSON.stringify(old), batchA]), 'invalid');
    await scenario('future publication does not become current', () => client.query("UPDATE passport_editorial_history SET created_at=now()+interval '1 day' WHERE batch_id=$1 AND revision=9", [batchA]), 'invalid');
    await scenario('other-tenant publication cannot back the head', () => client.query('UPDATE passport_editorial_history SET tenant_id=$1 WHERE batch_id=$2 AND revision=9', [tenantB, batchA]), 'invalid');
    await scenario('cross-tenant head is unavailable as a valid publication', () => client.query('UPDATE passport_editorial_heads SET tenant_id=$1 WHERE batch_id=$2', [tenantB, batchA]), 'invalid');
    await scenario('managed batch without head is integrity failure', () => client.query('DELETE FROM passport_editorial_heads WHERE batch_id=$1', [batchA]), 'invalid');
    await scenario('legacy remains distinct from unpublished', async () => {
      await client.query('DELETE FROM passport_editorial_heads WHERE batch_id=$1', [batchA]);
      await client.query('DELETE FROM passport_editorial_history WHERE batch_id=$1', [batchA]);
      await client.query('UPDATE batches SET editorial_managed=false WHERE id=$1', [batchA]);
    }, 'legacy');
    await scenario('studio version zero baseline is not a published document', async () => {
      await client.query('DELETE FROM passport_editorial_history WHERE batch_id=$1', [batchA]);
      await client.query('UPDATE passport_editorial_heads SET published=$1,published_version=0 WHERE batch_id=$2', [JSON.stringify(publication(old, 0)), batchA]);
    }, 'unpublished');
    for (const status of ['draft', 'revoked', 'archived', 'deprecating', 'unknown', 'active_in_market', 'production_registered']) {
      await scenario(`batch state ${status}`, () => client.query('UPDATE batches SET status=$1 WHERE id=$2', [status, batchA]), ['active_in_market', 'production_registered'].includes(status) ? 'published' : status === 'unknown' ? 'invalid' : 'withdrawn');
    }
    for (const malformed of [null, [], 'bad', { ...publication(current, 2), version: '2' }, { ...publication(current, 2), contentDigest: 'a'.repeat(64) }, { ...publication(current, 2), document: { ...current, secret: 'not-public' } }]) {
      await scenario('malformed published envelope', () => client.query('UPDATE passport_editorial_heads SET published=$1 WHERE batch_id=$2', [JSON.stringify(malformed), batchA]), 'invalid');
    }
    for (const path of ['{product_name}', '{lot}', '{batch_lot}', '{lot_number}', '{sun,product,name}', '{sun,product,producer}', '{sun,product,sku}', '{sun,product,imageUrl}', '{sun,origin,region}']) {
      await scenario(`published public projection drift ${path}`, () => client.query('UPDATE batches SET sdm_config=jsonb_set(sdm_config,$1::text[],\'"DRIFT"\') WHERE id=$2', [path, batchA]), 'invalid');
    }
    const agro = parseEditorialDocument({ ...current, template: 'agro', agro_product_profile: {
      productName: current.identity.product_name, batchLot: current.identity.public_lot_label, crop: 'QA crop',
      technicalSheetUrl: 'https://documents.example.invalid/current-v2.pdf', safetySheetUrl: 'https://documents.example.invalid/safety-v2.pdf',
    } });
    async function publishAgro() {
      await client.query('UPDATE batches SET sdm_config=$1 WHERE id=$2', [JSON.stringify(config(agro)), batchA]);
      await client.query('UPDATE passport_editorial_heads SET published=$1 WHERE batch_id=$2', [JSON.stringify(publication(agro, 2)), batchA]);
      await client.query('UPDATE passport_editorial_history SET content_digest=$1,document=$2 WHERE batch_id=$3 AND revision=9', [editorialContentDigest(agro), JSON.stringify(agro), batchA]);
    }
    await scenario('agro current documents come from the validated publication', publishAgro, 'published', value => {
      assert.equal(value.document.agro_product_profile.technicalSheetUrl, 'https://documents.example.invalid/current-v2.pdf');
      assert.equal(value.document.agro_product_profile.safetySheetUrl, 'https://documents.example.invalid/safety-v2.pdf');
    });
    await scenario('agro document drift cannot remain labelled current', async () => {
      await publishAgro();
      await client.query('UPDATE batches SET sdm_config=jsonb_set(sdm_config,\'{agro_product_profile,technicalSheetUrl}\',\'"https://documents.example.invalid/unpublished.pdf"\') WHERE id=$1', [batchA]);
    }, 'invalid');
    await scenario('unrelated private configuration does not invalidate public publication', () => client.query('UPDATE batches SET sdm_config=jsonb_set(sdm_config,\'{private_key}\',\'"other private value"\') WHERE id=$1', [batchA]), 'published');
    await scenario('missing editorial schema degrades only current content', () => client.query('DROP TABLE passport_editorial_heads'), 'unavailable');
    assert.equal(cases, 38, 'Database scenario matrix remains fully exercised');
  } finally { await client.query('ROLLBACK').catch(() => {}); await client.end(); }
});
