import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { setTimeout as pause } from 'node:timers/promises';
import pg from 'pg';

function qaTarget(value) {
  const target = new URL(value || 'http://missing.invalid');
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Loopback only');
  assert.equal(decodeURIComponent(target.pathname), '/nexid_e2e_s9');
  assert.equal(decodeURIComponent(target.username), 'nexid_e2e');
  assert.equal(target.search, ''); assert.equal(target.hash, '');
  return target.toString();
}

test('ticket workflow PostgreSQL harness rejects remote, production and unapproved connection targets', () => {
  for (const target of [null, 'postgres://nexid_e2e@remote.invalid/nexid_e2e_s9', 'postgres://postgres@localhost/nexid_e2e_s9', 'postgres://nexid_e2e@localhost/production', 'postgres://nexid_e2e@localhost/nexid_e2e_s9?options=x']) assert.throws(() => qaTarget(target));
});

test('actual 0112 ticket workflow is scoped, atomic, append-only and safe under concurrent retries', {
  skip: !process.env.NEXID_S9_QA_DATABASE_URL, timeout: 60000,
}, async t => {
  const connectionString = qaTarget(process.env.NEXID_S9_QA_DATABASE_URL);
  const schema = `qa_ticket_workflow_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^qa_ticket_workflow_[a-f0-9]{32}$/);
  const clients = [new pg.Client({ connectionString }), new pg.Client({ connectionString }), new pg.Client({ connectionString })];
  const [observer, first, second] = clients;
  const tenantA = '10000000-0000-4000-8000-000000000001', tenantB = '10000000-0000-4000-8000-000000000002';
  const actorA = '20000000-0000-4000-8000-000000000001', actorB = '20000000-0000-4000-8000-000000000002', globalActor = '20000000-0000-4000-8000-000000000003';
  const operationTable = 'support_ticket_workflow_operations';
  let schemaCreated = false;

  async function createTicket(patch = {}) {
    const row = { id: randomUUID(), tenantId: tenantA, status: 'open', source: 'sun_public_report', updatedAt: '2026-01-01T00:00:00.123456Z', ...patch };
    await observer.query('INSERT INTO tickets(id,tenant_id,status,source,updated_at,title) VALUES($1,$2,$3,$4,$5,\'Synthetic support ticket\')', [row.id, row.tenantId, row.status, row.source, row.updatedAt]);
    return row.id;
  }
  async function read(id, options = {}, client = observer) {
    const args = [id, options.tenantId === undefined ? tenantA : options.tenantId, options.tenantSlug === undefined ? 'qa-a' : options.tenantSlug, options.cursor ?? null];
    return (await client.query(`SELECT "${schema}".nexid_read_support_ticket_workflow_v1($1::uuid,$2::uuid,$3::text,$4::bigint) AS result`, args)).rows[0].result;
  }
  async function mutate(id, revision, patch = {}, client = observer) {
    const args = [id, patch.tenantId === undefined ? tenantA : patch.tenantId, patch.tenantSlug === undefined ? 'qa-a' : patch.tenantSlug,
      patch.actorId === undefined ? actorA : patch.actorId, patch.actorLabel === undefined ? 'Synthetic operator' : patch.actorLabel,
      revision, patch.status === undefined ? 'pending' : patch.status, patch.reason === undefined ? 'Synthetic support review' : patch.reason, patch.requestId === undefined ? randomUUID() : patch.requestId];
    return (await client.query(`SELECT "${schema}".nexid_transition_support_ticket_v1($1::uuid,$2::uuid,$3::text,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::uuid) AS result`, args)).rows[0].result;
  }
  async function counts(id) {
    return (await observer.query(`SELECT (SELECT count(*)::int FROM ${operationTable} WHERE ticket_id=$1) AS operations,(SELECT count(*)::int FROM audit_logs WHERE resource_id=$1::text) AS audits`, [id])).rows[0];
  }
  function failed(value, reason) { assert.deepEqual(value, { ok: false, reason }); }
  async function waitForLock(client) {
    for (let iteration = 0; iteration < 250; iteration++) {
      const row = (await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [client.processID])).rows[0];
      if (row?.wait_event_type === 'Lock') return;
      await pause(10);
    }
    assert.fail('The competing operation must be observed waiting on a real PostgreSQL lock');
  }
  async function settle(promise) { const result = await promise; if (result.error) throw result.error; return result.value; }

  try {
    for (const client of clients) {
      await client.connect();
      const identity = (await client.query('SELECT current_database() AS db,current_user AS role')).rows[0];
      assert.equal(identity.db, 'nexid_e2e_s9'); assert.equal(identity.role, 'nexid_e2e');
      await client.query("SET statement_timeout='15000'; SET lock_timeout='10000'; SET timezone='UTC'");
    }
    await observer.query(`CREATE SCHEMA "${schema}"`); schemaCreated = true;
    for (const client of clients) await client.query(`SET search_path TO "${schema}",pg_catalog`);
    await observer.query(`CREATE TABLE tenants(id uuid PRIMARY KEY,slug text NOT NULL UNIQUE);
      CREATE TABLE users(id uuid PRIMARY KEY,admin_status text NOT NULL DEFAULT 'active');
      CREATE TABLE memberships(user_id uuid NOT NULL REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),role text NOT NULL);
      CREATE TABLE tickets(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),status text NOT NULL,source text NOT NULL,updated_at timestamptz NOT NULL,title text);
      CREATE TABLE event_incidents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL UNIQUE REFERENCES tickets(id));
      CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),action text NOT NULL,resource_type text NOT NULL,resource_id text,before_hash text,after_hash text,ip_address inet,user_agent text,request_id text,created_at timestamptz NOT NULL DEFAULT now());`);
    await observer.query("INSERT INTO tenants VALUES($1,'qa-a'),($2,'qa-b');", [tenantA, tenantB]);
    await observer.query('INSERT INTO users(id) VALUES($1),($2),($3)', [actorA, actorB, globalActor]);
    await observer.query("INSERT INTO memberships VALUES($1,$2,'tenant_admin'),($3,$2,'tenant_admin'),($4,NULL,'super_admin')", [actorA, tenantA, actorB, globalActor]);
    // Apply the actual additive migration inside this uniquely named local schema.
    // Only schema qualification/search_path changes; SQL logic is not replaced.
    const original = await readFile(new URL('../db/migrations/20260922100000_0112_support_ticket_workflow.sql', import.meta.url), 'utf8');
    const migration = original.replace(/\bpublic\./g, `${schema}.`).replace(/pg_catalog\s*,\s*public/g, `pg_catalog,${schema}`);
    assert.doesNotMatch(migration, /\bpublic\./);
    await observer.query(migration);

    await t.test('new functions run as invoker, revoke PUBLIC and use a consistent stable history snapshot', async () => {
      const functions = (await observer.query(`SELECT p.proname,p.prosecdef,p.provolatile,p.proconfig,
        EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_execute
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1`, [schema])).rows;
      assert.ok(functions.length >= 5);
      for (const fn of functions) { assert.equal(fn.prosecdef, false); assert.equal(fn.public_execute, false); assert.ok(fn.proconfig.some(item => item.startsWith('search_path='))); }
      assert.equal(functions.find(fn => fn.proname === 'nexid_read_support_ticket_workflow_v1').provolatile, 's');
      assert.equal(functions.find(fn => fn.proname === 'nexid_transition_support_ticket_v1').provolatile, 'v');
    });

    await t.test('exact tenant identity is mandatory for tenant requests and selected global scope stays restricted', async () => {
      const local = await createTicket(), foreign = await createTicket({ tenantId: tenantB });
      const initial = await read(local); assert.equal(initial.ok, true); assert.equal(initial.current.tenantId, tenantA); assert.equal(initial.current.tenantSlug, 'qa-a');
      for (const result of [await read(foreign), await read(randomUUID()), await read(local, { tenantSlug: 'qa-b' }), await read(local, { tenantId: tenantB })]) failed(result, 'ticket_not_found');
      failed(await mutate(foreign, initial.current.revision), 'ticket_not_found');
      failed(await mutate(local, initial.current.revision, { tenantSlug: 'qa-b' }), 'ticket_not_found');
      const global = await read(foreign, { tenantId: null, tenantSlug: null }); assert.equal(global.current.tenantId, tenantB);
      failed(await read(foreign, { tenantId: null, tenantSlug: 'qa-a' }), 'ticket_not_found');
      assert.equal((await read(foreign, { tenantId: null, tenantSlug: 'qa-b' })).ok, true);
      assert.deepEqual(await counts(local), { operations: 0, audits: 0 }); assert.deepEqual(await counts(foreign), { operations: 0, audits: 0 });
    });

    await t.test('state, audit and receipt persist together with microsecond precision and no internal data in public projections', async () => {
      const id = await createTicket({ updatedAt: '2099-01-01T00:00:00.123456Z' });
      const initial = await read(id), requestId = randomUUID();
      const result = await mutate(id, initial.current.revision, { requestId });
      assert.equal(result.ok, true); assert.equal(result.outcome, 'updated'); assert.equal(result.current.status, 'pending');
      assert.notEqual(result.current.revision, initial.current.revision); assert.equal(result.receipt.revision, result.current.revision);
      assert.equal(result.receipt.requestId, requestId); assert.equal(result.receipt.fromStatus, 'open'); assert.equal(result.receipt.toStatus, 'pending');
      assert.deepEqual(result.receipt.actor, { id: actorA, label: 'Synthetic operator' });
      assert.deepEqual(await counts(id), { operations: 1, audits: 1 });
      const stored = (await observer.query(`SELECT to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US') AS precise FROM tickets WHERE id=$1`, [id])).rows[0];
      assert.equal(stored.precise, '2099-01-01 00:00:00.123457');
      const audit = (await observer.query('SELECT actor_id::text,tenant_id::text,before_hash,after_hash,request_id,action,resource_type FROM audit_logs WHERE resource_id=$1', [id])).rows[0];
      assert.deepEqual(audit, { actor_id: actorA, tenant_id: tenantA, before_hash: initial.current.revision, after_hash: result.current.revision, request_id: requestId, action: 'support_ticket_status_changed', resource_type: 'ticket' });
      const history = await read(id); assert.equal(history.current.revision, result.current.revision); assert.deepEqual(history.items, [result.receipt]);
      assert.doesNotMatch(JSON.stringify(history), /fingerprint|expected_revision|before_hash|after_hash|ip_address|user_agent|email|audit_id/);
    });

    await t.test('identical retries preserve the first actor label and changed commands or actors conflict', async () => {
      const id = await createTicket(), initial = await read(id), requestId = randomUUID();
      const winner = await mutate(id, initial.current.revision, { requestId });
      const replay = await mutate(id, initial.current.revision, { requestId, actorLabel: 'Changed current profile label' });
      assert.equal(replay.outcome, 'replayed'); assert.deepEqual(replay.receipt, winner.receipt);
      for (const patch of [{ status: 'closed' }, { reason: 'Different intention' }, { actorId: actorB }]) failed(await mutate(id, initial.current.revision, { requestId, ...patch }), 'ticket_workflow_conflict');
      failed(await mutate(id, winner.current.revision, { requestId }), 'ticket_workflow_conflict');
      assert.deepEqual(await counts(id), { operations: 1, audits: 1 });
    });

    await t.test('retry after a later transition returns the original receipt and the current state without reverting it', async () => {
      const id = await createTicket(), initial = await read(id), requestId = randomUUID();
      const firstResult = await mutate(id, initial.current.revision, { requestId });
      const later = await mutate(id, firstResult.current.revision, { status: 'closed', reason: 'Synthetic follow-up resolution' });
      const replay = await mutate(id, initial.current.revision, { requestId });
      assert.equal(replay.outcome, 'replayed'); assert.deepEqual(replay.receipt, firstResult.receipt);
      assert.equal(replay.current.status, 'closed'); assert.equal(replay.current.revision, later.current.revision);
      assert.deepEqual(await counts(id), { operations: 2, audits: 2 });
    });

    await t.test('legacy, unassigned and incident-managed tickets stay read-only without invented workflow states', async () => {
      const cases = [[{ status: 'legacy_review' }, 'legacy_status'], [{ tenantId: null }, 'tenant_unassigned'], [{ source: 'event_incident' }, 'incident_managed'], [{}, 'incident_managed']];
      for (let index = 0; index < cases.length; index++) {
        const [patch, reason] = cases[index], id = await createTicket(patch);
        if (index === 3) await observer.query('INSERT INTO event_incidents(ticket_id) VALUES($1)', [id]);
        const scope = patch.tenantId === null ? { tenantId: null, tenantSlug: null } : {};
        const current = (await read(id, scope)).current;
        assert.equal(current.canUpdate, false); assert.equal(current.blockedReason, reason);
        assert.equal(current.status, patch.status || 'open');
        failed(await mutate(id, current.revision, { ...scope, ...(patch.tenantId === null ? { actorId: globalActor } : {}) }), 'ticket_workflow_blocked');
        assert.deepEqual(await counts(id), { operations: 0, audits: 0 });
      }
    });

    await t.test('invalid commands and no-change submissions do not create operations or audit rows', async () => {
      const id = await createTicket(), current = (await read(id)).current;
      for (const patch of [{ status: 'unexpected' }, { status: null }, { reason: '' }, { reason: ' padded ' }, { reason: 'x'.repeat(1001) }, { reason: 'unsafe\ncontrol' }, { actorId: null }, { requestId: null }]) failed(await mutate(id, current.revision, patch), 'ticket_workflow_invalid_request');
      failed(await mutate(id, 'malformed-revision'), 'ticket_workflow_invalid_request');
      failed(await mutate(id, current.revision, { status: 'open' }), 'ticket_workflow_no_change');
      failed(await read(id, { cursor: '0' }), 'ticket_workflow_invalid_request');
      assert.deepEqual(await counts(id), { operations: 0, audits: 0 });
    });

    await t.test('audit failure rolls back the ticket and operation; same request can succeed after recovery', async () => {
      const id = await createTicket(), current = (await read(id)).current, requestId = randomUUID();
      await observer.query(`ALTER TABLE audit_logs ADD CONSTRAINT qa_injected_audit_failure CHECK(resource_id <> '${id}') NOT VALID`);
      try { await assert.rejects(mutate(id, current.revision, { requestId }), error => error.code === '23514'); }
      finally { await observer.query('ALTER TABLE audit_logs DROP CONSTRAINT qa_injected_audit_failure'); }
      assert.equal((await read(id)).current.status, 'open'); assert.equal((await read(id)).current.revision, current.revision);
      assert.deepEqual(await counts(id), { operations: 0, audits: 0 });
      assert.equal((await mutate(id, current.revision, { requestId })).outcome, 'updated');
      assert.deepEqual(await counts(id), { operations: 1, audits: 1 });
    });

    await t.test('operation persistence failure rolls back both the ticket and already inserted audit', async () => {
      const id = await createTicket(), current = (await read(id)).current, requestId = randomUUID();
      await observer.query(`ALTER TABLE ${operationTable} ADD CONSTRAINT qa_injected_operation_failure CHECK(ticket_id <> '${id}'::uuid) NOT VALID`);
      try { await assert.rejects(mutate(id, current.revision, { requestId }), error => error.code === '23514'); }
      finally { await observer.query(`ALTER TABLE ${operationTable} DROP CONSTRAINT qa_injected_operation_failure`); }
      assert.equal((await read(id)).current.status, 'open'); assert.equal((await read(id)).current.revision, current.revision);
      assert.deepEqual(await counts(id), { operations: 0, audits: 0 });
      assert.equal((await mutate(id, current.revision, { requestId })).outcome, 'updated');
    });

    await t.test('a concurrent identical request really waits and observes the committed receipt after its lock', async () => {
      const id = await createTicket(), current = (await read(id)).current, requestId = randomUUID();
      await first.query('BEGIN');
      const winner = await mutate(id, current.revision, { requestId }, first);
      const waiting = mutate(id, current.revision, { requestId }, second).then(value => ({ value }), error => ({ error }));
      try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const replay = await settle(waiting);
      assert.equal(replay.outcome, 'replayed'); assert.deepEqual(replay.receipt, winner.receipt);
      assert.equal(replay.current.revision, winner.current.revision); assert.deepEqual(await counts(id), { operations: 1, audits: 1 });
    });

    await t.test('concurrent independent commands with one revision yield one winner without overwriting it', async () => {
      const id = await createTicket(), current = (await read(id)).current;
      await first.query('BEGIN'); const winner = await mutate(id, current.revision, {}, first);
      const waiting = mutate(id, current.revision, { status: 'closed' }, second).then(value => ({ value }), error => ({ error }));
      try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      failed(await settle(waiting), 'ticket_workflow_conflict');
      assert.equal((await read(id)).current.revision, winner.current.revision); assert.equal((await read(id)).current.status, 'pending');
      assert.deepEqual(await counts(id), { operations: 1, audits: 1 });
    });

    await t.test('external updates preserving updated_at invalidate the revision, including a concurrent update', async () => {
      const id = await createTicket(), current = (await read(id)).current;
      await first.query('BEGIN'); await first.query("UPDATE tickets SET title='Changed externally without a timestamp update' WHERE id=$1", [id]);
      const waiting = mutate(id, current.revision, {}, second).then(value => ({ value }), error => ({ error }));
      try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      failed(await settle(waiting), 'ticket_workflow_conflict');
      const after = (await read(id)).current;
      assert.equal(after.status, current.status); assert.equal(after.updatedAt, current.updatedAt); assert.notEqual(after.revision, current.revision);
      assert.deepEqual(await counts(id), { operations: 0, audits: 0 });
    });

    await t.test('actor and tenant membership revocation racing the writer are rechecked after real lock waits', async () => {
      const id = await createTicket(), current = (await read(id)).current;
      failed(await mutate(id, current.revision, { actorId: randomUUID() }), 'forbidden');
      failed(await mutate(id, current.revision, { tenantId: null, tenantSlug: null }), 'forbidden');
      await first.query('BEGIN'); await first.query("UPDATE users SET admin_status='suspended' WHERE id=$1", [actorB]);
      const actorWait = mutate(id, current.revision, { actorId: actorB }, second).then(value => ({ value }), error => ({ error }));
      try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      failed(await settle(actorWait), 'forbidden');
      await observer.query("UPDATE users SET admin_status='active' WHERE id=$1", [actorB]);
      await first.query('BEGIN'); await first.query('DELETE FROM memberships WHERE user_id=$1', [actorB]);
      const memberWait = mutate(id, current.revision, { actorId: actorB }, second).then(value => ({ value }), error => ({ error }));
      try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      failed(await settle(memberWait), 'forbidden');
      await observer.query("INSERT INTO memberships VALUES($1,$2,'tenant_admin')", [actorB, tenantA]);
      assert.equal((await read(id)).current.revision, current.revision); assert.deepEqual(await counts(id), { operations: 0, audits: 0 });
      assert.equal((await mutate(id, current.revision, { tenantId: null, tenantSlug: 'qa-a', actorId: globalActor })).outcome, 'updated');
    });

    await t.test('reader observes coherent old state during an uncommitted transition and new state after commit', async () => {
      const id = await createTicket(), initial = await read(id);
      await first.query('BEGIN'); const next = await mutate(id, initial.current.revision, {}, first);
      try { const during = await read(id); assert.deepEqual(during.current, initial.current); assert.deepEqual(during.items, []); }
      finally { await first.query('COMMIT'); }
      const after = await read(id); assert.equal(after.current.revision, next.current.revision); assert.deepEqual(after.items, [next.receipt]);
    });

    await t.test('bounded history pages return all committed operations exactly once and append-only rows resist modification', async () => {
      const id = await createTicket(); let current = (await read(id)).current;
      for (let index = 0; index < 53; index++) {
        const result = await mutate(id, current.revision, { status: current.status === 'open' ? 'pending' : 'open', reason: `Synthetic history operation ${index}` });
        assert.equal(result.outcome, 'updated'); current = result.current;
      }
      const firstPage = await read(id); assert.equal(firstPage.items.length, 50); assert.equal(firstPage.page.hasMore, true);
      assert.equal(firstPage.page.nextCursor, firstPage.items.at(-1).sequence); assert.equal(firstPage.current.revision, current.revision);
      const secondPage = await read(id, { cursor: firstPage.page.nextCursor }); assert.equal(secondPage.items.length, 3);
      assert.deepEqual(secondPage.page, { hasMore: false, nextCursor: null });
      const items = [...firstPage.items, ...secondPage.items]; assert.equal(new Set(items.map(item => item.operationId)).size, 53);
      for (let index = 1; index < items.length; index++) assert.ok(BigInt(items[index - 1].sequence) > BigInt(items[index].sequence));
      await assert.rejects(observer.query(`UPDATE ${operationTable} SET reason='Attempted history rewrite' WHERE id=$1`, [items[0].operationId]), error => error.code === '55000');
      await assert.rejects(observer.query(`DELETE FROM ${operationTable} WHERE id=$1`, [items[0].operationId]), error => error.code === '55000');
      assert.deepEqual(await counts(id), { operations: 53, audits: 53 });
    });
  } finally {
    for (const client of [first, second]) { await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}); }
    if (schemaCreated) await observer.query(`DROP SCHEMA "${schema}" CASCADE`);
    await observer.end().catch(() => {});
  }
});
