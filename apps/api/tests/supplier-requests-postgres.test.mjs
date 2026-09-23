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
test('supplier request PostgreSQL harness rejects remote, production and unapproved targets', () => {
  for (const target of [null, 'postgres://nexid_e2e@remote.invalid/nexid_e2e_s9', 'postgres://postgres@localhost/nexid_e2e_s9', 'postgres://nexid_e2e@localhost/production', 'postgres://nexid_e2e@localhost/nexid_e2e_s9?options=x']) assert.throws(() => qaTarget(target));
});

test('actual 0113 commercial request migration is scoped, atomic and safe under concurrent writes', {
  skip: !process.env.NEXID_S9_QA_DATABASE_URL, timeout: 90000,
}, async t => {
  const connectionString = qaTarget(process.env.NEXID_S9_QA_DATABASE_URL), schema = `qa_supplier_requests_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^qa_supplier_requests_[a-f0-9]{32}$/);
  const clients = [new pg.Client({ connectionString }), new pg.Client({ connectionString }), new pg.Client({ connectionString })];
  const [observer, first, second] = clients;
  const tenantA = randomUUID(), tenantB = randomUUID(), actorA = randomUUID(), actorB = randomUUID(), globalActor = randomUUID();
  const sessionA = randomUUID(), sessionB = randomUUID(), globalSession = randomUUID();
  const partial = { title: 'Solicitud sintética', construction_id: '', quantity: null, pack_purpose: null, notes: 'Pendiente de acuerdo comercial' };
  const complete = { ...partial, construction_id: 'pet_wet', quantity: 125, pack_purpose: 'trial_integration' };
  let createdSchema = false;
  const scoped = source => source.replace(/\bpublic\./g, `${schema}.`).replace(/pg_catalog\s*,\s*public/g, `pg_catalog,${schema}`);
  function command(action = 'create', overrides = {}) {
    return { action, tenant_id: tenantA, actor_id: actorA, auth_session_id: sessionA, request_id: null,
      idempotency_key: randomUUID(), expected_revision: null, content: partial, ...overrides };
  }
  async function mutate(input, client = observer) {
    return (await client.query(`SELECT ${schema}.nexid_mutate_supplier_request_v1($1::jsonb) AS result`, [JSON.stringify(input)])).rows[0].result;
  }
  async function read(id) { return (await observer.query(`SELECT ${schema}.nexid_supplier_request_current_v1($1::uuid,$2::uuid) AS result`, [id, tenantA])).rows[0].result; }
  async function prepared(content = complete) {
    const created = await mutate(command('create', { content })); assert.equal(created.ok, true);
    const sent = await mutate(command('submit', { request_id: created.request.id, expected_revision: 1, content: null })); assert.equal(sent.ok, true);
    return sent.request;
  }
  function technical(request, overrides = {}) {
    const constructions = {
      pet_wet: ['NTAG424_DNA', 'ntag424_dna', 'transparent_pet_wet_inlay'],
      white_wet: ['NTAG424_DNA', 'ntag424_dna', 'white_wet_inlay'],
      dry_inlay: ['NTAG424_DNA', 'ntag424_dna', 'dry_inlay'],
      tt_bridge: ['NTAG424_DNA_TT', 'ntag424_dna_tt', 'tagtamper_tail'],
      tt_void: ['NTAG424_DNA_TT', 'ntag424_dna_tt', 'tagtamper_void_destructible'],
      uhf_label: ['UCODE_9', 'uhf_rfid', 'uhf_logistics_label'],
      uhf_metal: ['UCODE_9', 'uhf_rfid', 'uhf_on_metal'],
    };
    const [chip_model, carrier_profile_code, material_type] = constructions[request.construction_id];
    return { supplier_order_id: randomUUID(), tenant_id: tenantA, actor_id: globalActor, auth_session_id: globalSession,
      total_quantity: request.quantity, pack_purpose: request.pack_purpose, chip_model, carrier_profile_code, material_type, request_id: randomUUID(), ...overrides };
  }
  async function convert(request, input = technical(request), client = observer, revision = request.revision) {
    return (await client.query(`SELECT * FROM ${schema}.nexid_convert_supplier_request_v1($1::uuid,$2::integer,$3::jsonb)`, [request.id, revision, JSON.stringify(input)])).rows[0];
  }
  async function counts(id) {
    return (await observer.query(`SELECT (SELECT count(*)::integer FROM supplier_request_operations WHERE request_id=$1) AS operations,
      (SELECT count(*)::integer FROM audit_logs WHERE resource_id=$1::text) AS audits`, [id])).rows[0];
  }
  async function graphCounts() {
    return (await observer.query(`SELECT (SELECT count(*)::int FROM supplier_orders) AS orders,(SELECT count(*)::int FROM batches) AS batches,(SELECT count(*)::int FROM batch_keys) AS keys`)).rows[0];
  }
  async function waitForLock(client) {
    for (let i = 0; i < 250; i++) { if ((await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [client.processID])).rows[0]?.wait_event_type === 'Lock') return; await pause(10); }
    assert.fail('The contender must wait on an observed PostgreSQL lock');
  }
  const settle = promise => promise.then(value => ({ value }), error => ({ error }));
  try {
    for (const client of clients) {
      await client.connect();
      const identity = (await client.query('SELECT current_database() AS db,current_user AS role')).rows[0];
      assert.deepEqual(identity, { db: 'nexid_e2e_s9', role: 'nexid_e2e' });
      await client.query("SET statement_timeout='15000'; SET lock_timeout='10000'; SET timezone='UTC'");
    }
    await observer.query(`CREATE SCHEMA "${schema}"`); createdSchema = true;
    for (const client of clients) await client.query(`SET search_path TO "${schema}",pg_catalog`);
    await observer.query(`CREATE TABLE tenants(id uuid PRIMARY KEY,slug text UNIQUE NOT NULL);
      CREATE TABLE users(id uuid PRIMARY KEY,admin_status text NOT NULL DEFAULT 'active');
      CREATE TABLE memberships(user_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),role text NOT NULL);
      CREATE TABLE auth_sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),role text NOT NULL,revoked_at timestamptz,expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day');
      CREATE TABLE enterprise_role_profiles(code text PRIMARY KEY,active boolean NOT NULL,human_session_allowed boolean NOT NULL,tenant_bound boolean NOT NULL,default_permissions jsonb NOT NULL);
      CREATE TABLE resource_permissions(user_id uuid,tenant_id uuid,resource text,action text,effect text);
      CREATE TABLE supplier_orders(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),pack_purpose text NOT NULL);
      CREATE TABLE batches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES supplier_orders(id),status text NOT NULL DEFAULT 'draft');
      CREATE TABLE batch_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES supplier_orders(id));
      CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),action text NOT NULL,resource_type text NOT NULL,resource_id text,before_hash text,after_hash text,request_id text,created_at timestamptz NOT NULL DEFAULT now());`);
    await observer.query("INSERT INTO tenants VALUES($1,'qa-a'),($2,'qa-b')", [tenantA, tenantB]);
    await observer.query('INSERT INTO users(id) VALUES($1),($2),($3)', [actorA, actorB, globalActor]);
    await observer.query("INSERT INTO memberships VALUES($1,$2,'operations_manager'),($3,$2,'operations_manager'),($4,NULL,'super_admin')", [actorA, tenantA, actorB, globalActor]);
    await observer.query("INSERT INTO auth_sessions(id,user_id,tenant_id,role) VALUES($1,$2,$3,'operations_manager'),($4,$5,$3,'operations_manager'),($6,$7,NULL,'super_admin')", [sessionA, actorA, tenantA, sessionB, actorB, globalSession, globalActor]);
    await observer.query(`INSERT INTO enterprise_role_profiles VALUES('operations_manager',true,true,true,'["supplier_order.create"]'),('super_admin',true,true,false,'["supplier_order.create","batch.keys.generate"]')`);
    const rbac = await readFile(new URL('../db/migrations/20260802310000_0096_enterprise_rbac_risk_truth.sql', import.meta.url), 'utf8');
    const helper = rbac.match(/CREATE OR REPLACE FUNCTION public\.nexid_actor_has_enterprise_capability_v1\([\s\S]*?\$enterprise_capability\$;/)?.[0];
    assert.ok(helper, 'Use the actual 0096 capability function, not a permission stub'); await observer.query(scoped(helper));
    // Narrow fixture boundary: the established order core is a transactional
    // stand-in. These tests certify the actual 0113 wrapper, not the full 0079
    // graph nor cryptographic generation, which have separate existing suites.
    await observer.query(`CREATE FUNCTION ${schema}.nexid_create_supplier_order_v2(p_input jsonb) RETURNS TABLE(supplier_order jsonb,sub_batches jsonb)
      LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,${schema} AS $core$
      DECLARE v_order ${schema}.supplier_orders%ROWTYPE; BEGIN
        INSERT INTO ${schema}.supplier_orders(id,tenant_id,pack_purpose) VALUES((p_input->>'supplier_order_id')::uuid,(p_input->>'tenant_id')::uuid,p_input->>'pack_purpose') RETURNING * INTO v_order;
        INSERT INTO ${schema}.batches(order_id) VALUES(v_order.id);
        IF p_input->>'carrier_profile_code' IN ('ntag424_dna','ntag424_dna_tt') THEN INSERT INTO ${schema}.batch_keys(order_id) VALUES(v_order.id); END IF;
        IF p_input->>'qa_fail_core'='true' THEN RAISE EXCEPTION 'synthetic_core_failure'; END IF;
        RETURN QUERY SELECT to_jsonb(v_order),'[]'::jsonb;
      END; $core$;`);
    const original = await readFile(new URL('../db/migrations/20260923120000_0113_supplier_requests.sql', import.meta.url), 'utf8');
    await observer.query(scoped(original));

    await t.test('functions are invokers with fixed search paths and no PUBLIC execution', async () => {
      const rows = (await observer.query(`SELECT p.proname,p.prosecdef,p.proconfig,EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND (p.proname LIKE 'nexid_supplier_request_%' OR p.proname IN ('nexid_mutate_supplier_request_v1','nexid_convert_supplier_request_v1'))`, [schema])).rows;
      assert.equal(rows.length, 7);
      for (const row of rows) { assert.equal(row.prosecdef, false); assert.equal(row.public_execute, false); assert.ok(row.proconfig.some(value => value.startsWith('search_path='))); }
    });
    await t.test('partial save, edit and explicit submit create no orders, batches or key records', async () => {
      const create = command(), firstResult = await mutate(create); assert.equal(firstResult.ok, true); assert.equal(firstResult.request.status, 'draft'); assert.equal(firstResult.request.quantity, null);
      assert.equal(firstResult.request.pack_purpose, null); assert.equal(firstResult.request.revision, 1);
      const id = firstResult.request.id;
      assert.equal((await mutate(command('submit', { request_id: id, expected_revision: 1, content: null }))).reason, 'supplier_request_incomplete');
      const patch = command('patch', { request_id: id, expected_revision: 1, content: complete });
      const edited = await mutate(patch); assert.equal(edited.request.revision, 2);
      const submit = command('submit', { request_id: id, expected_revision: 2, content: null });
      const sent = await mutate(submit); assert.equal(sent.request.status, 'submitted'); assert.equal(sent.request.revision, 3); assert.equal(sent.request.submitted_by, actorA);
      const replay = await mutate(patch); assert.equal(replay.idempotent_replay, true); assert.equal(replay.receipt.revision, 2); assert.equal(replay.request.revision, 3); assert.equal(replay.request.status, 'submitted');
      assert.equal((await mutate(submit)).idempotent_replay, true);
      assert.equal((await mutate(create)).request.id, id);
      assert.deepEqual(await counts(id), { operations: 3, audits: 3 });
      assert.deepEqual(await graphCounts(), { orders: 0, batches: 0, keys: 0 });
      assert.equal((await mutate(command('patch', { request_id: id, expected_revision: 3, content: complete }))).reason, 'supplier_request_not_draft');
      await assert.rejects(observer.query('UPDATE supplier_requests SET notes=$2,revision=revision+1 WHERE id=$1', [id, 'Cannot alter submitted content']), /supplier_request_immutable/);
      await assert.rejects(observer.query('DELETE FROM supplier_request_operations WHERE request_id=$1', [id]), /supplier_request_operation_append_only/);
    });
    await t.test('same idempotency key rejects changed actors and content without changing the original', async () => {
      const input = command(), created = await mutate(input);
      for (const change of [{ content: { ...partial, title: 'Different request' } }, { actor_id: actorB, auth_session_id: sessionB }]) assert.equal((await mutate({ ...input, ...change })).reason, 'supplier_request_idempotency_conflict');
      assert.deepEqual(await counts(created.request.id), { operations: 1, audits: 1 });
    });
    await t.test('actor, tenant, membership, deny and revocable session gates apply even on replay', async () => {
      const input = command(), created = await mutate(input);
      assert.equal((await mutate(command('create', { tenant_id: tenantB }))).reason, 'supplier_request_scope_forbidden');
      assert.equal((await mutate(command('patch', { request_id: created.request.id, tenant_id: tenantB, actor_id: globalActor, auth_session_id: globalSession, expected_revision: 1, content: complete }))).reason, 'supplier_request_not_found');
      await observer.query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1', [sessionA]);
      assert.equal((await mutate(input)).reason, 'supplier_request_scope_forbidden'); await observer.query('UPDATE auth_sessions SET revoked_at=NULL WHERE id=$1', [sessionA]);
      await observer.query("UPDATE users SET admin_status='suspended' WHERE id=$1", [actorA]);
      assert.equal((await mutate(input)).reason, 'supplier_request_scope_forbidden'); await observer.query("UPDATE users SET admin_status='active' WHERE id=$1", [actorA]);
      await observer.query("INSERT INTO resource_permissions VALUES($1,$2,'supplier_orders','write','deny')", [actorA, tenantA]);
      assert.equal((await mutate(input)).reason, 'supplier_request_scope_forbidden'); await observer.query('DELETE FROM resource_permissions');
      await observer.query('DELETE FROM memberships WHERE user_id=$1', [actorA]);
      assert.equal((await mutate(input)).reason, 'supplier_request_scope_forbidden'); await observer.query("INSERT INTO memberships VALUES($1,$2,'operations_manager')", [actorA, tenantA]);
    });
    await t.test('audit and operation failures each roll back the request edit and permit the same command after recovery', async () => {
      const created = await mutate(command()), id = created.request.id;
      const edit = command('patch', { request_id: id, expected_revision: 1, content: complete });
      for (const [table, clause] of [['audit_logs', `resource_id<>'${id}'`], ['supplier_request_operations', `request_id<>'${id}'::uuid`]]) {
        await observer.query(`ALTER TABLE ${table} ADD CONSTRAINT injected_failure CHECK(${clause}) NOT VALID`);
        try { await assert.rejects(mutate(edit), error => error.code === '23514'); }
        finally { await observer.query(`ALTER TABLE ${table} DROP CONSTRAINT injected_failure`); }
        assert.equal((await read(id)).revision, 1); assert.deepEqual(await counts(id), { operations: 1, audits: 1 });
      }
      assert.equal((await mutate(edit)).request.revision, 2);
    });
    await t.test('two concurrent creates with one key wait and commit exactly one request and receipt', async () => {
      const input = command(); await first.query('BEGIN'); const winner = await mutate(input, first);
      const pending = settle(mutate(input, second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const replay = await pending; assert.ifError(replay.error); assert.equal(replay.value.idempotent_replay, true); assert.equal(replay.value.request.id, winner.request.id);
      assert.deepEqual(await counts(winner.request.id), { operations: 1, audits: 1 });
    });
    await t.test('concurrent independent edits have one revision winner and never overwrite it', async () => {
      const created = await mutate(command()), id = created.request.id;
      await first.query('BEGIN'); const winner = await mutate(command('patch', { request_id: id, expected_revision: 1, content: complete }), first);
      const pending = settle(mutate(command('patch', { request_id: id, expected_revision: 1, content: { ...complete, title: 'Losing editor' } }), second));
      try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const loser = await pending; assert.ifError(loser.error); assert.equal(loser.value.reason, 'supplier_request_revision_conflict'); assert.equal(loser.value.current_revision, 2);
      assert.equal((await read(id)).title, winner.request.title); assert.deepEqual(await counts(id), { operations: 2, audits: 2 });
    });
    await t.test('conversion requires global operator, submitted revision and exact tenant/construction/quantity/purpose', async () => {
      const request = await prepared(), initial = await graphCounts();
      for (const [changes, reason] of [[{ actor_id: actorA, auth_session_id: sessionA }, 'operator_required'], [{ tenant_id: tenantB }, 'not_found'], [{ total_quantity: 126 }, 'order_mismatch'], [{ pack_purpose: 'production' }, 'order_mismatch'], [{ chip_model: 'NTAG424_DNA_TT' }, 'order_mismatch'], [{ carrier_profile_code: 'ntag424_dna_tt' }, 'order_mismatch'], [{ material_type: 'white_wet_inlay' }, 'order_mismatch']]) {
        await assert.rejects(convert(request, technical(request, changes)), new RegExp(`supplier_request_${reason}`));
      }
      await assert.rejects(convert(request, technical(request), observer, 1), /supplier_request_revision_conflict/);
      assert.deepEqual(await graphCounts(), initial); assert.equal((await read(request.id)).status, 'submitted');
      const draft = (await mutate(command('create', { content: complete }))).request;
      await assert.rejects(convert(draft), /supplier_request_not_submitted/);
    });
    await t.test('all seven constructions bind their own carrier/material and UHF does not invent NFC acceptance', async () => {
      for (const construction_id of ['pet_wet','white_wet','dry_inlay','tt_bridge','tt_void','uhf_label','uhf_metal']) {
        const request = await prepared({ ...complete, construction_id }), payload = technical(request);
        if (construction_id.startsWith('uhf_')) await assert.rejects(convert(request, { ...payload, chip_model: 'NXP NTAG213' }), /supplier_request_order_mismatch/);
        const result = await convert(request, payload); assert.equal(result.supplier_order.id, payload.supplier_order_id);
        const stored = await read(request.id); assert.equal(stored.status, 'provisioned'); assert.equal(stored.order_id, payload.supplier_order_id); assert.equal(stored.revision, 3);
        assert.equal((await observer.query('SELECT status FROM batches WHERE order_id=$1', [stored.order_id])).rows[0].status, 'draft');
        assert.deepEqual(await counts(request.id), { operations: 2, audits: 3 });
      }
    });
    await t.test('core failure and final audit failure roll back the entire graph and source link together', async () => {
      const request = await prepared(), before = await graphCounts();
      await assert.rejects(convert(request, technical(request, { qa_fail_core: true })), /synthetic_core_failure/);
      assert.deepEqual(await graphCounts(), before); assert.equal((await read(request.id)).status, 'submitted');
      await observer.query(`ALTER TABLE audit_logs ADD CONSTRAINT injected_failure CHECK(action<>'supplier_request_provisioned') NOT VALID`);
      try { await assert.rejects(convert(request), error => error.code === '23514'); }
      finally { await observer.query('ALTER TABLE audit_logs DROP CONSTRAINT injected_failure'); }
      assert.deepEqual(await graphCounts(), before); assert.equal((await read(request.id)).order_id, null); assert.deepEqual(await counts(request.id), { operations: 2, audits: 2 });
    });
    await t.test('concurrent manual conversions hold the source lock and create exactly one linked order', async () => {
      const request = await prepared(), before = await graphCounts();
      await first.query('BEGIN'); const winner = await convert(request, technical(request), first);
      const pending = settle(convert(request, technical(request), second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const loser = await pending; assert.match(loser.error?.message || '', /supplier_request_already_provisioned/);
      assert.equal((await read(request.id)).order_id, winner.supplier_order.id);
      const after = await graphCounts(); assert.deepEqual(after, { orders: before.orders + 1, batches: before.batches + 1, keys: before.keys + 1 });
      await assert.rejects(convert(request), /supplier_request_already_provisioned/);
      assert.deepEqual(await graphCounts(), after);
    });
    await t.test('the actual list store excludes internal drafts from global inbox and filters tenant queries', async () => {
      const { listSupplierRequests } = await import('../src/lib/supplier-request-store.ts');
      const query = async (strings, ...values) => { let text = ''; for (let i = 0; i < strings.length; i++) text += strings[i] + (i < values.length ? `$${i+1}` : ''); return (await observer.query(scoped(text), values)).rows; };
      const global = await listSupplierRequests({ mode: 'global', tenant_id: null, tenant_slug: null }, { limit: 100, status: 'all' }, query);
      assert.ok(global.items.length > 0); assert.ok(global.items.every(item => item.status !== 'draft')); assert.equal(global.count, global.items.length);
      const company = await listSupplierRequests({ mode: 'tenant', tenant_id: tenantA, tenant_slug: 'qa-a' }, { limit: 2, status: 'all' }, query);
      assert.equal(company.count, 2); assert.equal(company.truncated, true); assert.ok(company.items.every(item => item.tenant_id === tenantA));
      const absent = await listSupplierRequests({ mode: 'tenant', tenant_id: tenantB, tenant_slug: 'qa-b' }, { limit: 100, status: 'all' }, query); assert.deepEqual(absent.items, []);
    });
  } finally {
    for (const client of clients) await client.query('ROLLBACK').catch(() => {});
    if (createdSchema) { assert.match(schema, /^qa_supplier_requests_[a-f0-9]{32}$/); await observer.query(`DROP SCHEMA "${schema}" CASCADE`); }
    await Promise.all(clients.map(client => client.end()));
  }
});
