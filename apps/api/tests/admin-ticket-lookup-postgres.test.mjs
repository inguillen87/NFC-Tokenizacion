import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { checkAdminWithPermission } from '../src/lib/auth.ts';
import { handleAdminTicketLookup } from '../src/lib/admin-ticket-lookup.ts';

function qaTarget(value) {
  const target = new URL(value || 'http://missing.invalid');
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Loopback only');
  assert.equal(decodeURIComponent(target.pathname), '/nexid_e2e_s9');
  assert.equal(decodeURIComponent(target.username), 'nexid_e2e');
  assert.equal(target.search, ''); assert.equal(target.hash, '');
  return target.toString();
}
test('ticket lookup PostgreSQL harness refuses non-loopback or unapproved database targets', () => {
  for (const value of [null, 'postgres://nexid_e2e@remote.invalid/nexid_e2e_s9', 'postgres://postgres@localhost/nexid_e2e_s9', 'postgres://nexid_e2e@localhost/production', 'postgres://nexid_e2e@localhost/nexid_e2e_s9?options=x']) assert.throws(() => qaTarget(value));
});

test('actual authorized ticket lookup finds historical rows independently of latest 300 and enforces SQL tenant scope', { skip: !process.env.NEXID_S9_QA_DATABASE_URL }, async t => {
  const client = new pg.Client({ connectionString: qaTarget(process.env.NEXID_S9_QA_DATABASE_URL) });
  const schema = `qa_ticket_lookup_${randomUUID().replaceAll('-', '')}`;
  const tenantA = '10000000-0000-4000-8000-000000000001', tenantB = '10000000-0000-4000-8000-000000000002';
  const old = '81000000-0000-8000-8000-000000000001', foreign = '81000000-0000-8000-8000-000000000002', orphan = '81000000-0000-8000-8000-000000000003', absent = '81000000-0000-8000-8000-000000000099';
  const detail = JSON.stringify({ protocol: 'nexid.support-report.v1', category: 'seal_opened', description: 'Synthetic old report older than the latest 300', fingerprint: 'a'.repeat(64), request_id: randomUUID(), consumer_id: 'PRIVATE_CONSUMER', uid_hex: 'PRIVATE_UID', support_token: 'PRIVATE_TOKEN' });
  let queries = 0;
  const execute = async (strings, ...values) => {
    const sql = strings.reduce((query, part, i) => query + (i ? `$${i}` : '') + part, '');
    assert.match(sql.trim(), /^SELECT\b/); assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|ALTER|CREATE|DROP|DELETE)\b|\bpublic\s*\./i);
    queries++;
    return (await client.query(sql, values)).rows;
  };
  const session = (patch = {}) => ({ id: randomUUID(), userId: randomUUID(), email: 'qa@example.invalid', label: 'Synthetic QA', role: 'tenant-admin', tenantId: tenantA, tenantSlug: 'marca.ar', permissions: ['leads.manage'], deniedPermissions: [], mfaVerified: true, expiresAt: new Date(Date.now() + 60000).toISOString(), rotatedCookieValue: null, setupCompleted: true, ...patch });
  async function lookup(id = old, query = '', patch = {}) {
    const req = new Request(`https://api.example.invalid/admin/tickets/${id}${query}`, { headers: { authorization: 'Bearer synthetic-local-session', 'x-admin-tenant': 'qa-b', 'x-admin-scope': 'super_admin' } });
    const response = await handleAdminTicketLookup(req, id, { authorize: (req, permission) => checkAdminWithPermission(req, permission, async () => session(patch)), execute });
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    return { status: response.status, body: await response.json() };
  }
  const superadmin = { role: 'super-admin', tenantId: null, tenantSlug: null, permissions: [] };
  try {
    await client.connect();
    const identity = (await client.query('SELECT current_database() AS db,current_user AS role')).rows[0];
    assert.equal(identity.db, 'nexid_e2e_s9'); assert.equal(identity.role, 'nexid_e2e');
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
    await client.query("SET LOCAL statement_timeout='10000'");
    await client.query(`CREATE TABLE tenants(id uuid PRIMARY KEY,slug text NOT NULL,name text);
      CREATE TABLE tickets(id uuid PRIMARY KEY,tenant_id uuid,title text,detail text,status text,contact text,created_at timestamptz,source text,category text,locale text,bid text,tap_event_id bigint,uid_hex text);`);
    await client.query("INSERT INTO tenants VALUES($1,'marca.ar','Synthetic A'),($2,'qa-b','Synthetic B')", [tenantA, tenantB]);
    await client.query("INSERT INTO tickets VALUES($1,$2,'Old synthetic report',$3,'closed','qa@example.invalid','2020-01-02T03:04:05Z','sun_public_report','seal_opened','es-AR','SAME-BID',715,'PRIVATE_UID'),($4,$5,'Foreign synthetic report','Historical text B','pending','qb@example.invalid','2020-01-01Z','legacy','other','es-AR','SAME-BID',716,'PRIVATE_UID'),($6,NULL,'Unassigned legacy','Historical unassigned','open','legacy@example.invalid','2019-01-01Z','legacy',NULL,'es-AR',NULL,NULL,NULL)", [old, tenantA, detail, foreign, tenantB, orphan]);
    await client.query("INSERT INTO tickets(id,tenant_id,title,detail,status,contact,created_at) SELECT ('82000000-0000-8000-8000-'||lpad(n::text,12,'0'))::uuid,$1,'New synthetic ticket '||n,'Newer fixture only','open','qa-new@example.invalid','2026-01-01'::timestamptz+n*interval '1 minute' FROM generate_series(1,305) n", [tenantA]);

    await t.test('an exact old UUID resolves beyond the recent collection without leaking internal fields', async () => {
      const recent = await client.query('SELECT id::text FROM tickets WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 300', [tenantA]);
      assert.equal(recent.rows.length, 300); assert.ok(!recent.rows.some(row => row.id === old));
      const result = await lookup(); assert.equal(result.status, 200); assert.equal(result.body.ticket.id, old);
      assert.equal(result.body.ticket.created_at, '2020-01-02T03:04:05.000Z'); assert.equal(result.body.ticket.status, 'closed');
      assert.equal(JSON.parse(result.body.ticket.detail).description, 'Synthetic old report older than the latest 300');
      assert.deepEqual(result.body.scope, { mode: 'tenant', tenantId: tenantA, tenantSlug: 'marca.ar' });
      assert.doesNotMatch(JSON.stringify(result.body), /PRIVATE_|fingerprint|consumer_id|uid_hex|support_token|request_id/);
    });

    await t.test('same BID and UID never bypass exact tenant scope; absent and foreign tickets share one 404', async () => {
      const wrongTenant = await lookup(foreign), missing = await lookup(absent), selector = await lookup(old, '?tenant=qa-b');
      assert.equal(wrongTenant.status, 404); assert.deepEqual(wrongTenant, missing); assert.deepEqual(selector, missing);
      assert.deepEqual(wrongTenant.body, { ok: false, reason: 'ticket_not_found' });
      assert.equal((await lookup(orphan)).status, 404);
    });

    await t.test('superadmin selection narrows global authority and tenant ownership is projected from database', async () => {
      const global = await lookup(foreign, '', superadmin); assert.equal(global.status, 200);
      assert.deepEqual(global.body.scope, { mode: 'global', tenantId: null, tenantSlug: null });
      assert.equal(global.body.ticket.tenant_id, tenantB); assert.equal(global.body.ticket.tenant_slug, 'qa-b');
      assert.equal((await lookup(foreign, '?tenant=marca.ar', superadmin)).status, 404);
      const selected = await lookup(foreign, '?tenant=qa-b', superadmin); assert.equal(selected.status, 200);
      assert.deepEqual(selected.body.scope, { mode: 'tenant', tenantId: tenantB, tenantSlug: 'qa-b' });
      const legacy = await lookup(orphan, '', superadmin); assert.equal(legacy.status, 200); assert.equal(legacy.body.ticket.tenant_id, null);
      assert.equal((await lookup(orphan, '?tenant=marca.ar', superadmin)).status, 404);
    });

    await t.test('permission denial and invalid input execute no ticket query', async () => {
      const before = queries;
      assert.equal((await lookup(old, '', { permissions: [] })).status, 403);
      assert.equal((await lookup(old, '', { ...superadmin, deniedPermissions: ['leads.manage'] })).status, 403);
      assert.equal((await lookup('bad-id')).status, 400);
      assert.equal((await lookup(old, '?tenant=qa-b&tenant=marca.ar')).status, 400);
      assert.equal(queries, before);
    });

    await t.test('missing storage returns a private 503 without runtime DDL or a fake empty result', async () => {
      await client.query('SAVEPOINT storage_failure');
      await client.query('DROP TABLE tickets');
      const result = await lookup(); assert.equal(result.status, 503); assert.deepEqual(result.body, { ok: false, reason: 'ticket_lookup_unavailable' });
      await client.query('ROLLBACK TO SAVEPOINT storage_failure');
      assert.equal((await lookup()).status, 200);
    });

    await t.test('legacy detail remains literal and incompatible report data is labelled unavailable', async () => {
      assert.equal((await lookup(foreign, '', superadmin)).body.ticket.detail, 'Historical text B');
      await client.query('SAVEPOINT incompatible_detail');
      await client.query('UPDATE tickets SET detail=$1 WHERE id=$2', [JSON.stringify({ protocol: 'nexid.support-report.v1', fingerprint: 'PRIVATE_FINGERPRINT' }), old]);
      const result = await lookup(); assert.equal(result.status, 200); assert.equal(result.body.ticket.detail_state, 'unavailable'); assert.equal(result.body.ticket.detail, null);
      assert.doesNotMatch(JSON.stringify(result.body), /PRIVATE_FINGERPRINT/);
      await client.query('ROLLBACK TO SAVEPOINT incompatible_detail');
    });
  } finally { await client.query('ROLLBACK').catch(() => {}); await client.end(); }
});
