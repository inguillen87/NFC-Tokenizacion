import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { setTimeout as pause } from 'node:timers/promises';
import pg from 'pg';
import { createSupportReportCapability, loadSupportReportScope, signSupportReportCapability } from '../src/lib/support-report-capability.ts';
import { handleSupportReport } from '../src/lib/support-report-http.ts';
import { parseSupportReportInput, supportReportIdentity, writeSupportReport } from '../src/lib/support-report-service.ts';

function qaTarget(value) {
  const target = new URL(value || 'http://missing.invalid');
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Loopback only');
  assert.equal(decodeURIComponent(target.pathname), '/nexid_e2e_s9');
  assert.equal(decodeURIComponent(target.username), 'nexid_e2e');
  assert.equal(target.search, ''); assert.equal(target.hash, '');
  return target.toString();
}

test('support PostgreSQL harness refuses every target outside the explicit isolated S9 database', () => {
  for (const value of [null, 'postgres://nexid_e2e@remote.invalid/nexid_e2e_s9', 'postgres://postgres@localhost/nexid_e2e_s9', 'postgres://nexid_e2e@localhost/production', 'postgres://nexid_e2e@localhost/nexid_e2e_s9?options=x']) assert.throws(() => qaTarget(value));
});

test('actual support SQL persists scoped tickets, survives retries and serializes conflicting writes', {
  skip: !process.env.NEXID_S9_QA_DATABASE_URL, timeout: 45000,
}, async t => {
  process.env.SUN_HANDOFF_SECRET = 'SYNTHETIC-S9-POSTGRES-ONLY-SECRET-NEVER-PRODUCTION-12345';
  delete process.env.SUN_HANDOFF_SECRET_PREVIOUS;
  const url = qaTarget(process.env.NEXID_S9_QA_DATABASE_URL);
  const schema = `qa_support_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^qa_support_[a-f0-9]{32}$/);
  const clients = [new pg.Client({ connectionString: url }), new pg.Client({ connectionString: url }), new pg.Client({ connectionString: url })];
  const [observer, first, second] = clients;
  const tenantA = '10000000-0000-4000-8000-000000000001', tenantB = '10000000-0000-4000-8000-000000000002';
  const batchA = '20000000-0000-4000-8000-000000000001', batchB = '20000000-0000-4000-8000-000000000002';
  const actor = { source: 'sun_public_report', consumerId: null };
  const input = (patch = {}) => parseSupportReportInput({ request_id: randomUUID(), category: 'tap_review', description: 'Synthetic PostgreSQL report only', contact: 'qa@example.invalid', locale: 'es-AR', ...patch });
  const execute = client => async (strings, ...values) => {
    const query = strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, '');
    assert.doesNotMatch(query, /\bpublic\s*\./i, 'Runtime SQL uses only the isolated search path');
    return (await client.query(query, values)).rows;
  };
  const query = execute(observer), queryFirst = execute(first), querySecond = execute(second);
  const count = async id => Number((await observer.query('SELECT count(*) AS count FROM tickets WHERE id=$1', [id])).rows[0].count);
  const unavailable = error => error.code === 'ticket_persistence_unavailable' && error.status === 503;
  const conflict = error => error.code === 'report_request_conflict' && error.status === 409;
  async function waitForLock(client) {
    for (let n = 0; n < 200; n++) {
      const row = (await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [client.processID])).rows[0];
      if (row?.wait_event_type === 'Lock') return;
      await pause(10);
    }
    assert.fail('The competing writer must actually wait on PostgreSQL, not merely run sequentially');
  }
  let schemaCreated = false;
  try {
    for (const client of clients) {
      await client.connect();
      const identity = (await client.query('SELECT current_database() AS db,current_user AS role')).rows[0];
      assert.equal(identity.db, 'nexid_e2e_s9'); assert.equal(identity.role, 'nexid_e2e');
      await client.query("SET statement_timeout='15000'; SET lock_timeout='10000'");
    }
    await observer.query(`CREATE SCHEMA "${schema}"`); schemaCreated = true;
    for (const client of clients) await client.query(`SET search_path TO "${schema}", pg_catalog`);
    // Fixtures are committed in a uniquely named local schema so separate real
    // connections can contend for the same row. No production table is touched.
    await observer.query(`
      CREATE TABLE tenants(id uuid PRIMARY KEY,slug text NOT NULL);
      CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid,bid text);
      CREATE TABLE events(id bigint PRIMARY KEY,tenant_id uuid,batch_id uuid,bid text,uid_hex text,sdm_read_ctr integer,event_type text);
      CREATE TABLE tickets(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),bid text,uid_hex text,tap_event_id bigint REFERENCES events(id),category text,locale text,contact text,title text,detail text,status text,source text,created_at timestamptz NOT NULL DEFAULT now());
    `);
    await observer.query("INSERT INTO tenants VALUES($1,'qa-a'),($2,'qa-b')", [tenantA, tenantB]);
    await observer.query("INSERT INTO batches VALUES($1,$2,'SAME-BID'),($3,$4,'SAME-BID')", [batchA, tenantA, batchB, tenantB]);
    await observer.query(`INSERT INTO events VALUES
      (715,$1,$2,'SAME-BID','04AABBCCDDEEFF',107,'TAP_VALID'),
      (716,$3,$4,'SAME-BID','04AABBCCDDEEFF',107,'TAP_REPLAY'),
      (717,$1,NULL,'SAME-BID','04AABBCCDDEEFF',107,'TAP_INVALID'),
      (718,$3,$2,'SAME-BID','04AABBCCDDEEFF',107,'TAP_INVALID'),
      (719,$1,$2,'WRONG-BID','04AABBCCDDEEFF',107,'TAP_VALID'),
      (720,$1,$2,'SAME-BID',NULL,NULL,'QR_VIEW'),
      (721,$1,$2,'SAME-BID','04AABBCCDDEEFF',108,'TAP_INVALID'),
      (722,$1,$2,'SAME-BID','04AABBCCDDEEFF',109,'TAP_VALID')`, [tenantA, batchA, tenantB, batchB]);
    const scope = await loadSupportReportScope('715', query);
    const other = await loadSupportReportScope('716', query);
    assert.ok(scope); assert.ok(other);

    await t.test('identity comes only from persisted event tenant/batch; QR and risk support remain available', async () => {
      assert.equal(scope.tenantId, tenantA); assert.equal(other.tenantId, tenantB);
      assert.equal(scope.batchId, batchA); assert.equal(other.batchId, batchB);
      for (const event of ['717', '718', '719', '999']) {
        assert.equal(await loadSupportReportScope(event, query), null);
        assert.equal(await createSupportReportCapability(event, query), null);
      }
      for (const event of ['716', '720', '721']) {
        const current = await loadSupportReportScope(event, query);
        assert.ok(await createSupportReportCapability(event, query));
        const result = await writeSupportReport(current, actor, input(), query);
        assert.equal(result.ticket.tenant_assigned, true); assert.equal(result.eventId, event);
        assert.doesNotMatch(JSON.stringify(result), /cmac|authentic|physical|ownership|04AABB|qa@example|fingerprint|Synthetic PostgreSQL/);
      }
    });

    await t.test('retry preserves one ticket and its administrative status; changed payload is a conflict', async () => {
      const intent = input(), created = await writeSupportReport(scope, actor, intent, query);
      const retry = await writeSupportReport(scope, actor, intent, query);
      assert.equal(created.outcome, 'ticket_created'); assert.equal(retry.outcome, 'ticket_existing');
      assert.equal(retry.ticket.id, created.ticket.id); assert.equal(await count(created.ticket.id), 1);
      await observer.query("UPDATE tickets SET status='closed' WHERE id=$1", [created.ticket.id]);
      assert.equal((await writeSupportReport(scope, actor, intent, query)).ticket.status, 'closed');
      for (const patch of [{ description: 'Changed intention' }, { contact: 'changed@example.invalid' }, { category: 'other' }, { locale: 'en' }]) await assert.rejects(writeSupportReport(scope, actor, { ...intent, ...patch }, query), conflict);
      const stored = (await observer.query('SELECT detail,contact FROM tickets WHERE id=$1', [created.ticket.id])).rows[0];
      assert.equal(JSON.parse(stored.detail).description, intent.description); assert.equal(stored.contact, intent.contact);
      assert.equal(JSON.parse(stored.detail).batch_id, batchA);
    });

    await t.test('the same form UUID cannot merge another event, tenant or authenticated actor', async () => {
      const intent = input();
      const results = [];
      for (const [current, identity] of [[scope, actor], [other, actor], [scope, { source: 'consumer_portal_report', consumerId: '40000000-0000-4000-8000-000000000001' }], [scope, { source: 'consumer_portal_report', consumerId: '40000000-0000-4000-8000-000000000002' }]]) results.push(await writeSupportReport(current, identity, intent, query));
      assert.equal(new Set(results.map(result => result.ticket.id)).size, 4);
      assert.equal((await observer.query('SELECT tenant_id::text FROM tickets WHERE id=$1', [results[1].ticket.id])).rows[0].tenant_id, tenantB);
    });

    await t.test('a concurrent identical request waits and reads the committed winning ticket', async () => {
      const intent = input();
      await first.query('BEGIN');
      const winner = await writeSupportReport(scope, actor, intent, queryFirst);
      const waiting = writeSupportReport(scope, actor, intent, querySecond).then(value => ({ value }), error => ({ error }));
      await waitForLock(second); await first.query('COMMIT');
      const settled = await waiting; if (settled.error) throw settled.error;
      assert.equal(settled.value.outcome, 'ticket_existing'); assert.equal(settled.value.ticket.id, winner.ticket.id);
      assert.equal(await count(winner.ticket.id), 1);
    });

    await t.test('a concurrent changed request returns 409 after the winning transaction commits', async () => {
      const intent = input();
      await first.query('BEGIN');
      const winner = await writeSupportReport(scope, actor, intent, queryFirst);
      const waiting = writeSupportReport(scope, actor, { ...intent, description: 'Conflicting intention' }, querySecond).then(value => ({ value }), error => ({ error }));
      await waitForLock(second); await first.query('COMMIT');
      const settled = await waiting; assert.ok(settled.error); assert.ok(conflict(settled.error));
      assert.equal(await count(winner.ticket.id), 1);
    });

    await t.test('a rolled-back insert leaves no ticket and the same request can be retried', async () => {
      const intent = input(); await first.query('BEGIN');
      const uncommitted = await writeSupportReport(scope, actor, intent, queryFirst);
      await first.query('ROLLBACK'); assert.equal(await count(uncommitted.ticket.id), 0);
      const persisted = await writeSupportReport(scope, actor, intent, query);
      assert.equal(persisted.outcome, 'ticket_created'); assert.equal(persisted.ticket.id, uncommitted.ticket.id);
    });

    await t.test('a changed event identity cannot create an orphan, including an update concurrent with the insert', async () => {
      const stale = await loadSupportReportScope('722', query), intent = input();
      await first.query('BEGIN');
      await first.query("UPDATE events SET uid_hex='CHANGED-BY-QA' WHERE id=722");
      const waiting = writeSupportReport(stale, actor, intent, querySecond).then(value => ({ value }), error => ({ error }));
      await waitForLock(second); await first.query('COMMIT');
      const settled = await waiting; assert.ok(settled.error); assert.ok(unavailable(settled.error));
      assert.equal(await count(supportReportIdentity(stale, actor, intent).id), 0);
      await assert.rejects(writeSupportReport({ ...scope, batchId: batchB }, actor, input(), query), unavailable);
      await assert.rejects(writeSupportReport({ ...scope, eventId: '999' }, actor, input(), query), unavailable);
    });

    await t.test('real handler does not claim success on failed SQL, and token renewal or failed analytics cannot duplicate a ticket', async () => {
      const intent = input(), cap = signSupportReportCapability(scope);
      const body = { bid: scope.bid, event_id: scope.eventId, support_token: cap.token, request_id: intent.requestId, category: intent.category, description: intent.description, contact: intent.contact, locale: intent.locale };
      const request = value => new Request('https://qa.example.invalid/public/cta/report-problem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
      let companions = 0;
      const dependencies = { limit: async () => null, load: event => loadSupportReportScope(event, query), write: (current, identity, data) => writeSupportReport(current, identity, data, query), companions: async () => { companions++; throw Error('Synthetic unavailable companion'); } };
      await observer.query("ALTER TABLE tickets ADD CONSTRAINT qa_injected_failure CHECK(category <> 'tap_review') NOT VALID");
      const failed = await handleSupportReport(request(body), undefined, dependencies);
      assert.equal(failed.status, 503); assert.equal((await failed.json()).ok, false); assert.equal(companions, 0);
      assert.equal(await count(supportReportIdentity(scope, actor, intent).id), 0);
      await observer.query('ALTER TABLE tickets DROP CONSTRAINT qa_injected_failure');
      const created = await handleSupportReport(request(body), undefined, dependencies);
      assert.equal(created.status, 201); const ticket = await created.json(); assert.equal(ticket.ticket_created, true); assert.equal(companions, 1);
      const renewed = signSupportReportCapability(scope, Date.now() + 1000);
      assert.notEqual(renewed.token, cap.token);
      const retry = await handleSupportReport(request({ ...body, support_token: renewed.token }), undefined, dependencies);
      assert.equal(retry.status, 200); assert.equal((await retry.json()).ticket.id, ticket.ticket.id); assert.equal(companions, 1);
      assert.equal(await count(ticket.ticket.id), 1);
      assert.doesNotMatch(JSON.stringify(ticket), /qa@example|fingerprint|support_token|Synthetic PostgreSQL|04AABB/);
      const denied = await handleSupportReport(request({ ...body, event_id: '716' }), undefined, dependencies);
      assert.equal(denied.status, 403);
      assert.equal(await count(supportReportIdentity(other, actor, intent).id), 0);
    });
  } finally {
    for (const client of [first, second]) { await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}); }
    if (schemaCreated) await observer.query(`DROP SCHEMA "${schema}" CASCADE`);
    await observer.end().catch(() => {});
  }
});
