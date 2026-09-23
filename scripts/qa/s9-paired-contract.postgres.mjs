import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import pg from 'pg';
import { handleAdminTicketWorkflowHistory, handleAdminTicketWorkflowTransition } from '../../apps/api/src/lib/admin-ticket-workflow.ts';

const UI_SHA = '702829269506758dbf1f969d0627a71083a80c87';
const hashes = {
  'ticket-workflow': 'a01d5714b0c1f5cef7bca33d48164e5b2c87024e5029b564eaf630e6568fb9c5',
  'ticket-reference-lookup': '009d938e28696ee1f77b5bd99d1858482051e8319548b6007705707320080fb5',
  'ticket-request-deadline': 'a6e0bf6fb1587ac409de0e8d572beb6f2e7ed62a2244c1e57fd53236753731f1',
};
// Mandatory opt-in test target: never fall back to an application DATABASE_URL.
function localTarget(value) {
  const target = new URL(value || 'http://missing.invalid');
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
  assert.equal(target.pathname, '/nexid_e2e_s9'); assert.equal(target.username, 'nexid_e2e');
  assert.equal(target.search, ''); assert.equal(target.hash, ''); return target.href;
}

test('paired source contract: real SQL, API handler and pinned dashboard model', { timeout: 60_000 }, async t => {
  assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.VERCEL_ENV, 'test');
  assert.ok(process.env.NEXID_S9_DASHBOARD_DIR, 'The exact paired dashboard source is required');
  const ui = resolve(process.env.NEXID_S9_DASHBOARD_DIR, 'apps/dashboard/src/lib');
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update((await readFile(resolve(ui, `${name}.ts`), 'utf8')).replaceAll('\r\n', '\n')).digest('hex'), hash, `${name} must match ${UI_SHA}`);
  }
  const model = await import(pathToFileURL(resolve(ui, 'ticket-workflow.ts')).href);
  const client = new pg.Client({ connectionString: localTarget(process.env.NEXID_S9_QA_DATABASE_URL) });
  const schema = `qa_paired_${randomUUID().replaceAll('-', '')}`;
  const tenant = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
  const actor = '20000000-0000-4000-8000-000000000001'; let created = false;
  const execute = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + part + (index < values.length ? `$${index + 1}` : ''), '').replaceAll('public.', `${schema}.`);
    return (await client.query(query, values)).rows;
  };
  // Session resolution and the BFF provenance header are explicit test doubles.
  // SQL, API parsing/projection, commands, readers and writers are actual code.
  const dependencies = { authorize: async (_req, permission) => { assert.equal(permission, 'leads.manage'); return null; },
    principal: () => ({ scope: 'tenant', tenantId: tenant, tenantSlug: 'qa-a', userId: actor, label: 'Synthetic paired operator' }), execute };
  const read = (id, deps = dependencies) => handleAdminTicketWorkflowHistory(new Request(`http://localhost/api/admin/tickets/${id}/history?tenant=qa-a`), id, deps);
  const fetcher = (id, loseReceipt = false) => async (url, options) => {
    assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'same-origin');
    const request = new Request(new URL(url, 'http://localhost'), options);
    const response = options.method === 'PATCH' ? await handleAdminTicketWorkflowTransition(request, id, dependencies) : await handleAdminTicketWorkflowHistory(request, id, dependencies);
    if (loseReceipt && response.ok && options.method === 'PATCH') throw Error('Synthetic response loss after SQL commit');
    response.headers.set('x-nexid-data-mode', 'production'); return response;
  };
  const history = async id => model.parseWorkflowHistory(await (await read(id)).json(), id, 'qa-a');
  const create = async (tenantId = tenant) => { const id = randomUUID(); await client.query("INSERT INTO tickets(id,tenant_id,status,source,updated_at) VALUES($1,$2,'open','sun_public_report','2026-01-01T00:00:00.123456Z')", [id, tenantId]); return id; };
  const counts = async id => (await client.query('SELECT (SELECT count(*)::int FROM support_ticket_workflow_operations WHERE ticket_id=$1) operations,(SELECT count(*)::int FROM audit_logs WHERE resource_id=$1::text) audits', [id])).rows[0];
  const prepare = (writer, current, status = 'pending') => assert.ok(writer.prepare(current, status, 'Synthetic paired review', randomUUID()));
  try {
    await client.connect();
    assert.deepEqual((await client.query('SELECT current_database() db,current_user role')).rows[0], { db: 'nexid_e2e_s9', role: 'nexid_e2e' });
    await client.query(`CREATE SCHEMA "${schema}"`); created = true;
    await client.query(`SET search_path TO "${schema}",pg_catalog; SET statement_timeout='15000'; SET lock_timeout='5000'; SET timezone='UTC'`);
    await client.query(`CREATE TABLE tenants(id uuid PRIMARY KEY,slug text NOT NULL UNIQUE);
      CREATE TABLE users(id uuid PRIMARY KEY,admin_status text NOT NULL DEFAULT 'active');
      CREATE TABLE memberships(user_id uuid NOT NULL REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),role text NOT NULL);
      CREATE TABLE tickets(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),status text NOT NULL,source text NOT NULL,updated_at timestamptz NOT NULL,title text);
      CREATE TABLE event_incidents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL UNIQUE REFERENCES tickets(id));
      CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),action text NOT NULL,resource_type text NOT NULL,resource_id text,before_hash text,after_hash text,ip_address inet,user_agent text,request_id text,created_at timestamptz NOT NULL DEFAULT now());`);
    await client.query("INSERT INTO tenants VALUES($1,'qa-a'),($2,'qa-b')", [tenant, other]);
    await client.query('INSERT INTO users(id) VALUES($1)', [actor]);
    await client.query("INSERT INTO memberships VALUES($1,$2,'tenant_admin')", [actor, tenant]);
    const migration = await readFile(new URL('../../apps/api/db/migrations/20260922100000_0112_support_ticket_workflow.sql', import.meta.url), 'utf8');
    await client.query(migration.replace(/\bpublic\./g, `${schema}.`).replace(/pg_catalog\s*,\s*public/g, `pg_catalog,${schema}`));

    await t.test('initial SQL state passes API projection and dashboard history parser without invented history', async () => {
      const id = await create(), response = await read(id), body = await response.json();
      assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private, no-store/);
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      const parsed = model.parseWorkflowHistory(body, id, 'qa-a');
      assert.ok(parsed); assert.equal(parsed.current.status, 'open'); assert.deepEqual(parsed.items, []);
      assert.equal(model.parseWorkflowHistory(body, id, 'qa-b'), null);
    });
    await t.test('reviewed command produces exactly one SQL operation and one audit and a matching UI receipt', async () => {
      const id = await create(), writer = model.createTicketWorkflowWriter(id, 'qa-a', fetcher(id));
      prepare(writer, (await history(id)).current); const result = await writer.submit();
      assert.equal(result.status, 'saved'); assert.equal(result.current.status, 'pending');
      assert.equal(result.receipt.requestId, writer.getAttempt().command.request_id);
      assert.deepEqual(await counts(id), { operations: 1, audits: 1 }); writer.dispose();
    });
    await t.test('a lost response after persistence stays uncertain and retry recovers the same SQL receipt', async () => {
      const id = await create(); let calls = 0;
      const writer = model.createTicketWorkflowWriter(id, 'qa-a', (...args) => fetcher(id, ++calls === 1)(...args));
      prepare(writer, (await history(id)).current); const original = writer.getAttempt().command;
      assert.equal((await writer.submit()).status, 'uncertain'); assert.equal(writer.canEdit(), false);
      assert.deepEqual(await counts(id), { operations: 1, audits: 1 });
      assert.equal(writer.prepare((await history(id)).current, 'closed', 'Changed intention', randomUUID()), null);
      const result = await writer.submit(); assert.equal(result.status, 'saved');
      assert.equal(result.receipt.requestId, original.request_id); assert.equal(writer.isUnresolved(), false);
      assert.deepEqual(await counts(id), { operations: 1, audits: 1 }); writer.dispose();
    });
    await t.test('history can reconcile a persisted uncertain operation without a second mutation', async () => {
      const id = await create(), writer = model.createTicketWorkflowWriter(id, 'qa-a', fetcher(id, true));
      prepare(writer, (await history(id)).current); assert.equal((await writer.submit()).status, 'uncertain');
      const reader = model.createTicketWorkflowReader(id, 'qa-a', fetcher(id));
      const result = await reader.read(); assert.equal(result.status, 'ready');
      assert.ok(writer.reconcile(result.history)); assert.equal(writer.canEdit(), true);
      assert.deepEqual(await counts(id), { operations: 1, audits: 1 }); reader.cancel(); writer.dispose();
    });
    await t.test('competing reviewed revisions become a UI conflict without overwriting the winner', async () => {
      const id = await create(), current = (await history(id)).current;
      const first = model.createTicketWorkflowWriter(id, 'qa-a', fetcher(id)), second = model.createTicketWorkflowWriter(id, 'qa-a', fetcher(id));
      prepare(first, current, 'pending'); prepare(second, current, 'closed');
      assert.equal((await first.submit()).status, 'saved'); assert.equal((await second.submit()).status, 'conflict');
      assert.equal((await history(id)).current.status, 'pending'); assert.deepEqual(await counts(id), { operations: 1, audits: 1 });
      first.dispose(); second.dispose();
    });
    await t.test('an old idempotent replay confirms the original operation without rewinding a later status', async () => {
      const id = await create(), old = model.createTicketWorkflowWriter(id, 'qa-a', fetcher(id));
      prepare(old, (await history(id)).current); const original = await old.submit();
      const next = model.createTicketWorkflowWriter(id, 'qa-a', fetcher(id));
      prepare(next, (await history(id)).current, 'closed'); assert.equal((await next.submit()).status, 'saved');
      const replay = await old.submit(); assert.equal(replay.status, 'saved'); assert.equal(replay.current.status, 'closed');
      assert.deepEqual(replay.receipt, original.receipt); assert.deepEqual(await counts(id), { operations: 2, audits: 2 });
      old.dispose(); next.dispose();
    });
    await t.test('foreign and nonexistent tickets share absence and cannot appear in the paired reader', async () => {
      const id = await create(other), absent = randomUUID();
      const a = await read(id), b = await read(absent); assert.equal(a.status, 404); assert.equal(b.status, 404);
      assert.deepEqual(await a.json(), await b.json());
      const reader = model.createTicketWorkflowReader(id, 'qa-a', fetcher(id));
      assert.equal((await reader.read()).status, 'unavailable'); assert.deepEqual(await counts(id), { operations: 0, audits: 0 }); reader.cancel();
    });
    await t.test('SQL membership revocation prevents a prepared UI command despite the injected session fixture', async () => {
      const id = await create(), writer = model.createTicketWorkflowWriter(id, 'qa-a', fetcher(id)); prepare(writer, (await history(id)).current);
      await client.query('DELETE FROM memberships WHERE user_id=$1', [actor]);
      assert.equal((await writer.submit()).status, 'forbidden'); assert.deepEqual(await counts(id), { operations: 0, audits: 0 });
      await client.query("INSERT INTO memberships VALUES($1,$2,'tenant_admin')", [actor, tenant]); writer.dispose();
    });
    await t.test('an API permission denial does not read SQL or expose a confirmed history', async () => {
      const id = await create(); let called = false;
      const response = await read(id, { ...dependencies, authorize: async () => new Response(null, { status: 403 }), execute: async () => { called = true; throw Error('must not execute'); } });
      assert.equal(response.status, 403); assert.equal(called, false); assert.equal(model.parseWorkflowHistory(await response.json(), id, 'qa-a'), null);
    });
    await t.test('database unavailability remains unavailable, never an empty or successful response', async () => {
      const id = await create();
      const response = await read(id, { ...dependencies, execute: async () => { throw Error('Synthetic database outage'); } });
      assert.equal(response.status, 503); assert.equal(model.parseWorkflowHistory(await response.json(), id, 'qa-a'), null);
      assert.deepEqual(await counts(id), { operations: 0, audits: 0 });
    });
    console.log(JSON.stringify({ pairedDashboardSource: UI_SHA, realSql: true, realApiHandler: true, realDashboardModels: true,
      sessionResolverInjected: true, bffHeaderSimulated: true, authenticatedProduction: false, physicalTap: false }));
  } finally {
    if (created) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
});
