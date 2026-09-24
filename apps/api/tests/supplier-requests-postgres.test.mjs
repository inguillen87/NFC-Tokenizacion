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

test('actual supplier request migrations are scoped, atomic and safe under concurrent writes', {
  skip: !process.env.NEXID_S9_QA_DATABASE_URL, timeout: 120000,
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
  function reviewCommand(request, action = 'request_information', revision = 0, changes = {}) {
    return { tenant_id: tenantA, actor_id: action === 'respond' ? actorA : globalActor, auth_session_id: action === 'respond' ? sessionA : globalSession,
      request_id: request.id, action, message: action === 'respond' ? 'La instalación será en la tapa.' : '¿Dónde se instalará la etiqueta?', expected_revision: revision,
      expected_request_revision: request.revision, idempotency_key: randomUUID(), ...changes };
  }
  async function reviewWrite(input, client = observer) { return (await client.query(`SELECT ${schema}.nexid_mutate_supplier_request_review_v1($1::jsonb) AS result`, [JSON.stringify(input)])).rows[0].result; }
  async function reviewRead(id, before = null) { return (await observer.query(`SELECT ${schema}.nexid_supplier_request_review_current_v1($1::uuid,$2::uuid,$3::integer) AS result`, [id, tenantA, before])).rows[0].result; }
  async function reviewCounts(id) { return (await observer.query(`SELECT (SELECT count(*)::integer FROM supplier_request_reviews WHERE request_id=$1) AS reviews,
    (SELECT count(*)::integer FROM supplier_request_review_events WHERE request_id=$1) AS events,(SELECT count(*)::integer FROM audit_logs WHERE resource_type='supplier_request_review' AND resource_id=$1::text) AS audits`, [id])).rows[0]; }
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
    await observer.query(`CREATE TYPE membership_role AS ENUM ('super_admin','tenant_admin','reseller','viewer','tenant_owner','security_analyst','operations_manager','packaging_operator','marketing_manager','reseller_admin','api_integration','security_operator');
      CREATE TABLE tenants(id uuid PRIMARY KEY,slug text UNIQUE NOT NULL);
      CREATE TABLE users(id uuid PRIMARY KEY,admin_status text NOT NULL DEFAULT 'active',full_name text);
      CREATE TABLE memberships(user_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),role membership_role NOT NULL);
      CREATE TABLE auth_sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),role membership_role NOT NULL,revoked_at timestamptz,expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day');
      CREATE TABLE enterprise_role_profiles(code text PRIMARY KEY,active boolean NOT NULL,human_session_allowed boolean NOT NULL,tenant_bound boolean NOT NULL,default_permissions jsonb NOT NULL,display_name text NOT NULL DEFAULT 'Synthetic role',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE resource_permissions(user_id uuid,tenant_id uuid,resource text,action text,effect text);
      CREATE TABLE supplier_orders(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),pack_purpose text NOT NULL);
      CREATE TABLE batches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES supplier_orders(id),status text NOT NULL DEFAULT 'draft');
      CREATE TABLE batch_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES supplier_orders(id));
      CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),action text NOT NULL,resource_type text NOT NULL,resource_id text,before_hash text,after_hash text,request_id text,created_at timestamptz NOT NULL DEFAULT now());`);
    await observer.query("INSERT INTO tenants VALUES($1,'qa-a'),($2,'qa-b')", [tenantA, tenantB]);
    await observer.query('INSERT INTO users(id) VALUES($1),($2),($3)', [actorA, actorB, globalActor]);
    await observer.query("INSERT INTO memberships VALUES($1,$2,'operations_manager'),($3,$2,'operations_manager'),($4,NULL,'super_admin')", [actorA, tenantA, actorB, globalActor]);
    await observer.query("INSERT INTO auth_sessions(id,user_id,tenant_id,role) VALUES($1,$2,$3,'operations_manager'),($4,$5,$3,'operations_manager'),($6,$7,NULL,'super_admin')", [sessionA, actorA, tenantA, sessionB, actorB, globalSession, globalActor]);
    await observer.query(`INSERT INTO enterprise_role_profiles(code,active,human_session_allowed,tenant_bound,default_permissions) VALUES('operations_manager',true,true,true,'["supplier_order.create"]'),('super_admin',true,true,false,'["supplier_order.create","batch.keys.generate"]')`);
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
    await observer.query(scoped(await readFile(new URL('../db/migrations/20260923150000_0114_supplier_request_reviews.sql', import.meta.url), 'utf8')));
    await t.test('0114 functions are invokers, PUBLIC cannot use them, and commercial defaults remain unchanged', async () => {
      const functions = (await observer.query(`SELECT p.proname,p.prosecdef,p.proconfig,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.proname LIKE 'nexid_%supplier_request%review%'`, [schema])).rows;
      assert.equal(functions.length, 7);
      for (const fn of functions) { assert.equal(fn.prosecdef, false); assert.ok(fn.proconfig.some(value => value === `search_path=pg_catalog, ${schema}`)); assert.doesNotMatch(JSON.stringify(fn.proacl), /"=/); }
      assert.equal((await observer.query("SELECT count(*)::int AS count FROM enterprise_role_profiles")).rows[0].count, 2);
    });
    await t.test('clarification is a separate immutable public history and never changes submitted commercial input', async () => {
      const request = await prepared(), graph = await graphCounts(), initial = await read(request.id);
      const empty = await reviewRead(request.id); assert.deepEqual(empty.review, { state: 'pending', revision: 0, updated_at: null }); assert.deepEqual(empty.history, []);
      const ask = reviewCommand(request), question = await reviewWrite(ask);
      assert.equal(question.ok, true); assert.equal(question.review.state, 'needs_information'); assert.equal(question.request_revision, 2);
      assert.equal(question.history[0].actor_id, globalActor); assert.doesNotMatch(JSON.stringify(question), /auth_session_id|fingerprint|audit_id/);
      await assert.rejects(convert(request), /supplier_request_information_required/);
      const reply = await reviewWrite(reviewCommand(request, 'respond', 1)); assert.equal(reply.review.state, 'answered'); assert.equal(reply.review.revision, 2);
      const saved = await read(request.id); assert.deepEqual({ ...saved, review_summary: initial.review_summary }, initial);
      assert.deepEqual(saved.review_summary, reply.review); assert.deepEqual(await graphCounts(), graph);
      assert.deepEqual(await reviewCounts(request.id), { reviews: 1, events: 2, audits: 2 });
      const replay = await reviewWrite(ask); assert.equal(replay.idempotent_replay, true); assert.equal(replay.review.revision, 2); assert.equal(replay.receipt.revision, 1);
      await convert(request); const after = await reviewWrite(ask); assert.equal(after.idempotent_replay, true); assert.equal(after.request_revision, 3);
      assert.equal((await reviewWrite(reviewCommand(request, 'request_information', 2))).reason, 'supplier_request_not_submitted');
      const createReceipt = (await observer.query("SELECT idempotency_key FROM supplier_request_operations WHERE request_id=$1 AND action='create'", [request.id])).rows[0];
      const oldReplay = await mutate(command('create', { content: complete, idempotency_key: createReceipt.idempotency_key }));
      assert.equal(oldReplay.idempotent_replay, true); assert.equal(oldReplay.request.review_summary.state, 'answered');
    });
    await t.test('review action, scope, live membership, deny and revocable session gates apply before replay', async () => {
      const request = await prepared(), ask = reviewCommand(request); assert.equal((await reviewWrite(ask)).ok, true);
      for (const input of [reviewCommand(request, 'request_information', 1, { actor_id: actorA, auth_session_id: sessionA }), reviewCommand(request, 'respond', 1, { actor_id: globalActor, auth_session_id: globalSession }), reviewCommand(request, 'respond', 1, { tenant_id: tenantB }), reviewCommand(request, 'respond', 1, { actor_id: actorA, auth_session_id: sessionB })]) assert.equal((await reviewWrite(input)).reason, 'supplier_request_review_scope_forbidden');
      await observer.query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1', [globalSession]);
      try { assert.equal((await reviewWrite(ask)).reason, 'supplier_request_review_scope_forbidden'); } finally { await observer.query('UPDATE auth_sessions SET revoked_at=NULL WHERE id=$1', [globalSession]); }
      await observer.query("INSERT INTO resource_permissions(user_id,tenant_id,resource,action,effect) VALUES($1,NULL,'supplier_orders','write','deny')", [globalActor]);
      try { assert.equal((await reviewWrite(ask)).reason, 'supplier_request_review_scope_forbidden'); } finally { await observer.query('DELETE FROM resource_permissions WHERE user_id=$1', [globalActor]); }
      await observer.query('DELETE FROM memberships WHERE user_id=$1', [actorA]);
      try { assert.equal((await reviewWrite(reviewCommand(request, 'respond', 1))).reason, 'supplier_request_review_scope_forbidden'); }
      finally { await observer.query("INSERT INTO memberships(user_id,tenant_id,role) VALUES($1,$2,'operations_manager')", [actorA,tenantA]); }
      assert.deepEqual(await reviewCounts(request.id), { reviews: 1, events: 1, audits: 1 });
    });
    await t.test('drafts have no reviews, dual CAS is strict, and receipt actor or body collisions do not mutate history', async () => {
      const draft = (await mutate(command())).request; assert.equal(await reviewRead(draft.id), null);
      assert.equal((await reviewWrite(reviewCommand(draft))).reason, 'supplier_request_not_submitted');
      const request = await prepared();
      assert.equal((await reviewWrite(reviewCommand(request, 'respond', 0))).reason, 'supplier_request_review_transition_invalid');
      assert.equal((await reviewWrite(reviewCommand(request, 'request_information', 0, { expected_request_revision: 1 }))).reason, 'supplier_request_revision_conflict');
      assert.equal((await reviewWrite(reviewCommand(request, 'request_information', 1))).reason, 'supplier_request_review_revision_conflict');
      const ask = reviewCommand(request); await reviewWrite(ask);
      assert.equal((await reviewWrite({ ...ask, message: 'Una pregunta diferente.' })).reason, 'supplier_request_review_idempotency_conflict');
      assert.equal((await reviewWrite(reviewCommand(request, 'request_information', 1))).reason, 'supplier_request_review_transition_invalid');
      const response = reviewCommand(request, 'respond', 1); await reviewWrite(response);
      assert.equal((await reviewWrite({ ...response, actor_id: actorB, auth_session_id: sessionB })).reason, 'supplier_request_review_idempotency_conflict');
      assert.deepEqual(await reviewCounts(request.id), { reviews: 1, events: 2, audits: 2 });
    });
    await t.test('secrets, controls, invalid transitions and direct writes cannot bypass review or history integrity', async () => {
      const request = await prepared();
      for (const message of ['', ' ', 'x'.repeat(2001), 'bad\u0001text', 'api_key=synthetic-confidential-value', 'PACK_PASSWORD', 'https://user:password@example.invalid', 'abcdef1234567890abcdef1234567890abcd', 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890']) await assert.rejects(reviewWrite(reviewCommand(request, 'request_information', 0, { message })), /supplier_request_review_input_invalid/);
      await assert.rejects(observer.query("INSERT INTO supplier_request_reviews(tenant_id,request_id,state,revision,updated_at) VALUES($1,$2,'needs_information',1,now())", [tenantA,request.id]), /supplier_request_review_event_required/);
      await reviewWrite(reviewCommand(request));
      for (const statement of ["DELETE FROM supplier_request_reviews WHERE request_id=$1", "UPDATE supplier_request_reviews SET state='answered',revision=revision+1 WHERE request_id=$1", "DELETE FROM supplier_request_review_events WHERE request_id=$1", "UPDATE supplier_request_review_events SET message='forged' WHERE request_id=$1"]) await assert.rejects(observer.query(statement, [request.id]), /immutable|event_required|append_only/);
      assert.deepEqual(await reviewCounts(request.id), { reviews: 1, events: 1, audits: 1 });
    });
    await t.test('audit and event insertion failures roll back the aggregate and preserve the reusable command', async () => {
      const request = await prepared(), input = reviewCommand(request);
      for (const [table, predicate] of [['audit_logs', `resource_id<>'${request.id}'`], ['supplier_request_review_events', `request_id<>'${request.id}'::uuid`]]) {
        await observer.query(`ALTER TABLE ${table} ADD CONSTRAINT injected_review_failure CHECK(${predicate}) NOT VALID`);
        try { await assert.rejects(reviewWrite(input), error => error.code === '23514'); }
        finally { await observer.query(`ALTER TABLE ${table} DROP CONSTRAINT injected_review_failure`); }
        assert.deepEqual(await reviewCounts(request.id), { reviews: 0, events: 0, audits: 0 });
      }
      assert.equal((await reviewWrite(input)).ok, true);
    });
    await t.test('concurrent same-key review retries replay once and different keys have one CAS winner', async () => {
      const request = await prepared(), input = reviewCommand(request);
      await first.query('BEGIN'); await reviewWrite(input, first);
      const pending = settle(reviewWrite(input, second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const replay = await pending; assert.ifError(replay.error); assert.equal(replay.value.idempotent_replay, true);
      const reply = reviewCommand(request, 'respond', 1); await first.query('BEGIN'); await reviewWrite(reply, first);
      const losing = settle(reviewWrite({ ...reply, idempotency_key: randomUUID() }, second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const loser = await losing; assert.ifError(loser.error); assert.equal(loser.value.reason, 'supplier_request_review_revision_conflict');
      assert.deepEqual(await reviewCounts(request.id), { reviews: 1, events: 2, audits: 2 });
    });
    await t.test('question and conversion serialize in both orders, with no stale eligibility or late review', async () => {
      const request = await prepared(), before = await graphCounts();
      await first.query('BEGIN'); await reviewWrite(reviewCommand(request), first);
      const converting = settle(convert(request, technical(request), second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      assert.match((await converting).error?.message || '', /supplier_request_information_required/); assert.deepEqual(await graphCounts(), before);
      const next = await prepared(); await first.query('BEGIN'); const order = await convert(next, technical(next), first);
      const questioning = settle(reviewWrite(reviewCommand(next), second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const refused = await questioning; assert.ifError(refused.error); assert.equal(refused.value.reason, 'supplier_request_not_submitted');
      assert.equal((await read(next.id)).order_id, order.supplier_order.id); assert.deepEqual(await reviewCounts(next.id), { reviews: 0, events: 0, audits: 0 });
    });
    await t.test('reply and conversion serialize, and blocked conversion cannot consume a pending company response', async () => {
      const request = await prepared(); await reviewWrite(reviewCommand(request));
      await first.query('BEGIN'); await reviewWrite(reviewCommand(request, 'respond', 1), first);
      const converting = settle(convert(request, technical(request), second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const success = await converting; assert.ifError(success.error); assert.equal((await read(request.id)).order_id, success.value.supplier_order.id);
      const next = await prepared(); await reviewWrite(reviewCommand(next));
      await first.query('BEGIN'); await first.query('SELECT id FROM supplier_requests WHERE id=$1 FOR UPDATE', [next.id]);
      const responding = settle(reviewWrite(reviewCommand(next, 'respond', 1), second)); await waitForLock(second);
      try { await assert.rejects(convert(next, technical(next), first), /supplier_request_information_required/); } finally { await first.query('ROLLBACK'); }
      const reply = await responding; assert.ifError(reply.error); assert.equal(reply.value.review.state, 'answered'); assert.equal((await read(next.id)).order_id, null);
    });
    await t.test('review history pages are bounded, chronological and explicitly truncated while current state remains current', async () => {
      const request = await prepared();
      for (let revision=0;revision<103;revision++) assert.equal((await reviewWrite(reviewCommand(request, revision%2===0 ? 'request_information' : 'respond', revision))).ok, true);
      const current = await reviewRead(request.id); assert.equal(current.count, 100); assert.equal(current.history[0].revision, 4); assert.equal(current.truncated, true); assert.equal(current.next_before_revision, 4);
      const earlier = await reviewRead(request.id, current.next_before_revision); assert.deepEqual(earlier.history.map(event => event.revision), [1,2,3]); assert.equal(earlier.truncated, false); assert.equal(earlier.next_before_revision, null); assert.deepEqual(earlier.review, current.review);
      const { supplierRequestReviewFromRow } = await import('../src/lib/supplier-request-review-contract.ts'); assert.equal(supplierRequestReviewFromRow(current).history[0].action, 'respond'); assert.equal(supplierRequestReviewFromRow(earlier,4).review.revision, 103);
    });
    await t.test('the actual list store excludes internal drafts, scopes tenants, and orders by the latest clarification activity', async () => {
      const { listSupplierRequests } = await import('../src/lib/supplier-request-store.ts');
      const query = async (strings, ...values) => { let text = ''; for (let i = 0; i < strings.length; i++) text += strings[i] + (i < values.length ? `$${i+1}` : ''); return (await observer.query(scoped(text), values)).rows; };
      const global = await listSupplierRequests({ mode: 'global', tenant_id: null, tenant_slug: null }, { limit: 100, status: 'all' }, query);
      assert.ok(global.items.length > 0); assert.ok(global.items.every(item => item.status !== 'draft')); assert.equal(global.count, global.items.length);
      const company = await listSupplierRequests({ mode: 'tenant', tenant_id: tenantA, tenant_slug: 'qa-a' }, { limit: 2, status: 'all' }, query);
      assert.equal(company.count, 2); assert.equal(company.truncated, true); assert.ok(company.items.every(item => item.tenant_id === tenantA));
      const absent = await listSupplierRequests({ mode: 'tenant', tenant_id: tenantB, tenant_slug: 'qa-b' }, { limit: 100, status: 'all' }, query); assert.deepEqual(absent.items, []);
      const old = (await observer.query("SELECT id,revision FROM supplier_requests WHERE status='submitted' AND id NOT IN (SELECT request_id FROM supplier_request_reviews) ORDER BY updated_at ASC LIMIT 1")).rows[0];
      await reviewWrite(reviewCommand(old));
      const latest = await listSupplierRequests({ mode: 'global', tenant_id: null, tenant_slug: null }, { limit: 1, status: 'all' }, query);
      assert.equal(latest.items[0].id, old.id); assert.equal(latest.items[0].review_summary.state, 'needs_information');
    });
    await t.test('0115 adds the real enum value only after a separate committed migration', async () => {
      const migration = scoped(await readFile(new URL('../db/migrations/20260923180000_0115_supplier_operator_role_enum.sql', import.meta.url), 'utf8'));
      await observer.query('BEGIN');
      try {
        await observer.query(migration);
        await assert.rejects(observer.query(`SELECT 'supplier_operator'::${schema}.membership_role`), error => error.code === '55P04');
      } finally { await observer.query('ROLLBACK'); }
      await observer.query('BEGIN');
      try { await observer.query(migration); await observer.query('COMMIT'); }
      catch (error) { await observer.query('ROLLBACK'); throw error; }
      assert.equal((await observer.query(`SELECT 'supplier_operator'::${schema}.membership_role AS role`)).rows[0].role, 'supplier_operator');
    });
    const beforeRoleRows = (await observer.query('SELECT (SELECT count(*)::integer FROM users) AS users,(SELECT count(*)::integer FROM memberships) AS memberships,(SELECT count(*)::integer FROM auth_sessions) AS sessions,(SELECT count(*)::integer FROM resource_permissions) AS grants')).rows[0];
    await observer.query(scoped(await readFile(new URL('../db/migrations/20260923180100_0116_supplier_request_assignments.sql', import.meta.url), 'utf8')));
    const authorityStart = rbac.indexOf('CREATE TABLE IF NOT EXISTS public.enterprise_authority_scope_locks');
    const authorityEnd = rbac.indexOf('CREATE OR REPLACE FUNCTION public.nexid_validate_resource_permission_scope_v1');
    assert.ok(authorityStart >= 0 && authorityEnd > authorityStart, 'Load the real 0096 authority serialization functions and triggers');
    await observer.query(scoped(rbac.slice(authorityStart,authorityEnd)));
    const afterRoleRows = (await observer.query('SELECT (SELECT count(*)::integer FROM users) AS users,(SELECT count(*)::integer FROM memberships) AS memberships,(SELECT count(*)::integer FROM auth_sessions) AS sessions,(SELECT count(*)::integer FROM resource_permissions) AS grants')).rows[0];
    const operatorA = randomUUID(), operatorB = randomUUID(), operatorSessionA = randomUUID(), operatorSessionB = randomUUID(), otherGlobal = randomUUID(), otherGlobalSession = randomUUID();
    const foreignActor = randomUUID(), foreignSession = randomUUID();
    await observer.query("INSERT INTO users(id,full_name) VALUES($1,'Operador sintético A'),($2,'Operador sintético B'),($3,'Administrador sintético'),($4,'Empresa sintética B')", [operatorA,operatorB,otherGlobal,foreignActor]);
    await observer.query("INSERT INTO memberships(user_id,tenant_id,role) VALUES($1,NULL,'supplier_operator'),($2,NULL,'supplier_operator'),($3,NULL,'super_admin'),($4,$5,'operations_manager')", [operatorA,operatorB,otherGlobal,foreignActor,tenantB]);
    await observer.query("INSERT INTO auth_sessions(id,user_id,tenant_id,role) VALUES($1,$2,NULL,'supplier_operator'),($3,$4,NULL,'supplier_operator'),($5,$6,NULL,'super_admin'),($7,$8,$9,'operations_manager')", [operatorSessionA,operatorA,operatorSessionB,operatorB,otherGlobalSession,otherGlobal,foreignSession,foreignActor,tenantB]);
    const assignCommand = (request, revision = 0, changes = {}) => ({ tenant_id: request.tenant_id || tenantA, request_id: request.id, actor_id: globalActor, auth_session_id: globalSession,
      idempotency_key: randomUUID(), operator_id: operatorA, expected_revision: revision, expected_request_revision: request.revision, ...changes });
    const assign = async (input, client = observer) => (await client.query(`SELECT ${schema}.nexid_mutate_supplier_request_assignment_v1($1::jsonb) AS result`, [JSON.stringify(input)])).rows[0].result;
    const assignmentRead = async (request, before = null) => (await observer.query(`SELECT ${schema}.nexid_supplier_request_assignment_current_v1($1::uuid,$2::uuid,$3::integer) AS result`, [request.id,request.tenant_id || tenantA,before])).rows[0].result;
    const assignedRead = async (id, actor = operatorA, session = operatorSessionA, client = observer) => (await client.query(`SELECT ${schema}.nexid_supplier_request_assigned_current_v1($1::uuid,$2::uuid,$3::uuid) AS result`, [id,actor,session])).rows[0].result;
    const assignedReview = async (id, actor = operatorA, session = operatorSessionA, client = observer) => (await client.query(`SELECT ${schema}.nexid_supplier_request_assigned_review_v1($1::uuid,$2::uuid,$3::uuid,NULL) AS result`, [id,actor,session])).rows[0].result;
    const assignedList = async (actor = operatorA, session = operatorSessionA, limit = 100, client = observer) => (await client.query(`SELECT ${schema}.nexid_supplier_requests_assigned_v1($1::uuid,$2::uuid,$3::integer) AS result`, [actor,session,limit])).rows[0].result;
    const operatorQuestion = (request, revision = 0, changes = {}) => reviewCommand(request, 'request_information', revision, { actor_id: operatorA, auth_session_id: operatorSessionA, ...changes });
    const assignmentCounts = async id => (await observer.query(`SELECT (SELECT count(*)::integer FROM supplier_request_assignments WHERE request_id=$1) AS assignments,
      (SELECT count(*)::integer FROM supplier_request_assignment_events WHERE request_id=$1) AS events,(SELECT count(*)::integer FROM audit_logs WHERE resource_type='supplier_request_assignment' AND resource_id=$1::text) AS audits`, [id])).rows[0];
    await t.test('0116 adds no identity or grant, keeps fixed invoker ACLs, and supplier role has only terminal assigned capabilities', async () => {
      assert.deepEqual(afterRoleRows, beforeRoleRows, 'Schema migration does not create users, sessions, memberships or permission grants');
      const profile = (await observer.query("SELECT tenant_bound,human_session_allowed,default_permissions FROM enterprise_role_profiles WHERE code='supplier_operator'")).rows[0];
      assert.deepEqual(profile, { tenant_bound: false, human_session_allowed: true, default_permissions: ['supplier_request.assigned.read','supplier_request.assigned.review'] });
      for (const capability of ['supplier_request.assigned.read','supplier_request.assigned.review','supplier_request.assign','supplier_order.create','batch.keys.generate','supplier_pack.export','manifest.import','leads.manage','consumers.read_pii','users:manage','audit.read','unknown.future']) {
        const result = (await observer.query(`SELECT ${schema}.nexid_actor_has_enterprise_capability_v1($1,NULL,'supplier_operator',$2) AS allowed`, [operatorA,capability])).rows[0].allowed;
        assert.equal(result, ['supplier_request.assigned.read','supplier_request.assigned.review'].includes(capability), capability);
      }
      await observer.query("INSERT INTO resource_permissions VALUES($1,NULL,'*','*','allow')", [operatorA]);
      try { assert.equal((await observer.query(`SELECT ${schema}.nexid_actor_has_enterprise_capability_v1($1,NULL,'supplier_operator','supplier_order.create') AS allowed`, [operatorA])).rows[0].allowed, false); }
      finally { await observer.query("DELETE FROM resource_permissions WHERE user_id=$1", [operatorA]); }
      for (const table of ['memberships','auth_sessions']) {
        const statement = table === 'memberships' ? "INSERT INTO memberships(user_id,tenant_id,role) VALUES($1,$2,'supplier_operator')" : "INSERT INTO auth_sessions(id,user_id,tenant_id,role) VALUES(gen_random_uuid(),$1,$2,'supplier_operator')";
        await assert.rejects(observer.query(statement,[operatorA,tenantA]), error => error.code === '23514');
      }
      const functions = (await observer.query(`SELECT p.proname,p.prosecdef,p.proconfig,EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND (p.proname LIKE '%assignment%' OR p.proname LIKE '%assigned%' OR p.proname LIKE 'nexid_supplier_operator_%')`,[schema])).rows;
      assert.ok(functions.length >= 11); for (const fn of functions) { assert.equal(fn.prosecdef,false,fn.proname); assert.equal(fn.public_execute,false,fn.proname); assert.ok(fn.proconfig.some(setting => setting.startsWith('search_path=')),fn.proname); }
    });
    await t.test('assignment preserves submitted commercial data, exposes only assigned cross-tenant rows, and creates no order or keys', async () => {
      const request = await prepared(), original = await read(request.id), graph = await graphCounts();
      assert.equal((await assignmentRead(request)).assignment.revision,0);
      assert.equal(await assignedRead(request.id),null); assert.equal(await assignedReview(request.id),null);
      const result = await assign(assignCommand(request)); assert.equal(result.ok,true); assert.equal(result.assignment.operator_id,operatorA); assert.equal(result.assignment.revision,1);
      assert.equal((await assignedRead(request.id)).id,request.id); assert.equal((await assignedRead(request.id)).assignment.operator_id,operatorA);
      assert.equal(await assignedRead(request.id,operatorB,operatorSessionB),null); assert.equal(await assignedRead(randomUUID()),null);
      const foreignCreate = await mutate(command('create',{tenant_id:tenantB,actor_id:foreignActor,auth_session_id:foreignSession,content:complete}));
      const foreign = (await mutate(command('submit',{tenant_id:tenantB,actor_id:foreignActor,auth_session_id:foreignSession,request_id:foreignCreate.request.id,expected_revision:1,content:null}))).request;
      await assign(assignCommand(foreign));
      const list = await assignedList(); assert.ok(list.items.some(item => item.id === request.id)); assert.ok(list.items.some(item => item.id === foreign.id && item.tenant_id === tenantB)); assert.ok(list.items.every(item => item.assignment.operator_id === operatorA && item.status !== 'draft'));
      assert.deepEqual((await assignedList(operatorB,operatorSessionB)).items,[]);
      assert.deepEqual(await read(request.id),original); assert.deepEqual(await graphCounts(),graph);
      const limited = await assignedList(operatorA,operatorSessionA,1); assert.equal(limited.count,1); assert.equal(limited.truncated,true);
      for (const limit of [null,0,101]) await assert.rejects(assignedList(operatorA,operatorSessionA,limit),/supplier_request_limit_invalid/);
    });
    await t.test('only live superadmin may assign; tenant, operator, draft, wrong tenant and invalid target fail closed', async () => {
      const request = await prepared(), input = assignCommand(request);
      for (const actor of [{actor_id:actorA,auth_session_id:sessionA},{actor_id:operatorA,auth_session_id:operatorSessionA},{actor_id:globalActor,auth_session_id:operatorSessionA}]) assert.equal((await assign({...input,...actor})).reason,'supplier_request_assignment_scope_forbidden');
      assert.equal((await assign({...input,tenant_id:tenantB})).reason,'supplier_request_not_found');
      assert.equal((await assign({...input,operator_id:actorA})).reason,'supplier_request_assignment_operator_invalid');
      assert.equal((await assign({...input,operator_id:null})).reason,'supplier_request_assignment_transition_invalid');
      const draft = (await mutate(command())).request; assert.equal((await assign(assignCommand(draft))).reason,'supplier_request_not_submitted');
      assert.deepEqual(await assignmentCounts(request.id),{assignments:0,events:0,audits:0});
      await assign(input);
      await observer.query("INSERT INTO resource_permissions VALUES($1,NULL,'supplier_requests','assign','deny')",[globalActor]);
      try { assert.equal((await assign(input)).reason,'supplier_request_assignment_scope_forbidden'); }
      finally { await observer.query('DELETE FROM resource_permissions WHERE user_id=$1',[globalActor]); }
      await observer.query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1',[globalSession]);
      try { assert.equal((await assign(input)).reason,'supplier_request_assignment_scope_forbidden'); }
      finally { await observer.query('UPDATE auth_sessions SET revoked_at=NULL WHERE id=$1',[globalSession]); }
      assert.deepEqual(await assignmentCounts(request.id),{assignments:1,events:1,audits:1});
    });
    await t.test('assignment retry preserves its receipt while current assignment advances; changed actor, target or revision conflicts', async () => {
      const request = await prepared(), input = assignCommand(request); await assign(input);
      for (const changed of [{operator_id:operatorB},{actor_id:otherGlobal,auth_session_id:otherGlobalSession},{expected_revision:1},{expected_request_revision:request.revision+1}]) assert.equal((await assign({...input,...changed})).reason,'supplier_request_assignment_idempotency_conflict');
      const next = await assign(assignCommand(request,1,{operator_id:operatorB})); assert.equal(next.assignment.revision,2);
      const replay = await assign(input); assert.equal(replay.idempotent_replay,true); assert.equal(replay.receipt.revision,1); assert.equal(replay.assignment.operator_id,operatorB); assert.equal(replay.assignment.revision,2);
      assert.equal(await assignedRead(request.id),null); assert.equal((await assignedRead(request.id,operatorB,operatorSessionB)).id,request.id);
      assert.deepEqual(await assignmentCounts(request.id),{assignments:1,events:2,audits:2});
    });
    await t.test('assignment audit or receipt failure rolls back aggregate and the exact request remains reusable', async () => {
      const request = await prepared(), input = assignCommand(request);
      for (const [table,predicate] of [['audit_logs',`resource_id<>'${request.id}'`],['supplier_request_assignment_events',`request_id<>'${request.id}'::uuid`]]) {
        await observer.query(`ALTER TABLE ${table} ADD CONSTRAINT injected_assignment_failure CHECK(${predicate}) NOT VALID`);
        try { await assert.rejects(assign(input),error => error.code === '23514'); }
        finally { await observer.query(`ALTER TABLE ${table} DROP CONSTRAINT injected_assignment_failure`); }
        assert.deepEqual(await assignmentCounts(request.id),{assignments:0,events:0,audits:0});
      }
      assert.equal((await assign(input)).ok,true);
      for (const sql of ["DELETE FROM supplier_request_assignment_events WHERE request_id=$1","UPDATE supplier_request_assignment_events SET operator_id=NULL WHERE request_id=$1","DELETE FROM supplier_request_assignments WHERE request_id=$1"]) await assert.rejects(observer.query(sql,[request.id]),/append_only|immutable/);
      await assert.rejects(observer.query('UPDATE supplier_request_assignments SET operator_id=$2,revision=revision+1 WHERE request_id=$1',[request.id,operatorB]),/event_required/);
      assert.equal((await assignmentRead(request)).assignment.operator_id,operatorA);
    });
    await t.test('simultaneous assignment retries commit once and competing CAS targets cannot overwrite the winner', async () => {
      const request = await prepared(), input = assignCommand(request);
      await first.query('BEGIN'); await assign(input,first); const pending = settle(assign(input,second));
      try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const replay = await pending; assert.ifError(replay.error); assert.equal(replay.value.idempotent_replay,true);
      const target = assignCommand(request,1,{operator_id:operatorB}); await first.query('BEGIN'); await assign(target,first);
      const conflict = settle(assign(assignCommand(request,1,{operator_id:null}),second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const lost = await conflict; assert.ifError(lost.error); assert.equal(lost.value.reason,'supplier_request_assignment_revision_conflict');
      assert.equal((await assignmentRead(request)).assignment.operator_id,operatorB); assert.deepEqual(await assignmentCounts(request.id),{assignments:1,events:2,audits:2});
    });
    await t.test('assignment revocation blocks every operator read and an already committed clarification replay', async () => {
      const request = await prepared(); await assign(assignCommand(request)); const question = operatorQuestion(request);
      assert.equal((await reviewWrite(question)).ok,true); assert.equal((await reviewWrite(question)).idempotent_replay,true);
      await assign(assignCommand(request,1,{operator_id:null})); const before = await reviewCounts(request.id);
      assert.equal(await assignedRead(request.id),null); assert.equal(await assignedReview(request.id),null); assert.ok(!(await assignedList()).items.some(row => row.id === request.id));
      assert.equal((await reviewWrite(question)).reason,'supplier_request_review_scope_forbidden'); assert.deepEqual(await reviewCounts(request.id),before);
      assert.equal((await reviewWrite(operatorQuestion(request,1,{action:'respond'}))).reason,'supplier_request_review_scope_forbidden');
      assert.equal((await mutate(command('create',{actor_id:operatorA,auth_session_id:operatorSessionA}))).reason,'supplier_request_scope_forbidden');
      await assert.rejects(convert(request,technical(request,{actor_id:operatorA,auth_session_id:operatorSessionA})),/supplier_request_operator_required/);
    });
    await t.test('operator session, membership, profile and explicit denies apply to reads and review replay', async () => {
      const request = await prepared(); await assign(assignCommand(request)); const question = operatorQuestion(request); await reviewWrite(question);
      const changes = [
        ["UPDATE auth_sessions SET revoked_at=now() WHERE id=$1","UPDATE auth_sessions SET revoked_at=NULL WHERE id=$1",[operatorSessionA]],
        ["UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE id=$1","UPDATE auth_sessions SET expires_at=now()+interval '1 day' WHERE id=$1",[operatorSessionA]],
        ["UPDATE users SET admin_status='disabled' WHERE id=$1","UPDATE users SET admin_status='active' WHERE id=$1",[operatorA]],
        ["UPDATE enterprise_role_profiles SET active=false WHERE code='supplier_operator'","UPDATE enterprise_role_profiles SET active=true WHERE code='supplier_operator'",[]],
        ["INSERT INTO resource_permissions VALUES($1,NULL,'*','*','deny')","DELETE FROM resource_permissions WHERE user_id=$1",[operatorA]],
        ["INSERT INTO memberships(user_id,tenant_id,role) VALUES($1,NULL,'super_admin')","DELETE FROM memberships WHERE user_id=$1 AND role='super_admin'",[operatorA]],
      ];
      for (const [apply,restore,values] of changes) {
        await observer.query(apply,values);
        try { assert.equal(await assignedRead(request.id),null); assert.equal(await assignedReview(request.id),null); assert.equal(await assignedList(),null); assert.equal((await reviewWrite(question)).reason,'supplier_request_review_scope_forbidden'); }
        finally { await observer.query(restore,values); }
      }
      assert.equal((await reviewWrite(question)).idempotent_replay,true);
    });
    await t.test('revoke-first makes a waiting operator clarification fail; clarification-first commits before revocation', async () => {
      const request = await prepared(); await assign(assignCommand(request));
      await first.query('BEGIN'); await assign(assignCommand(request,1,{operator_id:null}),first);
      const waiting = settle(reviewWrite(operatorQuestion(request),second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const denied = await waiting; assert.ifError(denied.error); assert.equal(denied.value.reason,'supplier_request_review_scope_forbidden'); assert.deepEqual(await reviewCounts(request.id),{reviews:0,events:0,audits:0});
      const next = await prepared(); await assign(assignCommand(next)); const question = operatorQuestion(next);
      await first.query('BEGIN'); await reviewWrite(question,first);
      const revoking = settle(assign(assignCommand(next,1,{operator_id:null}),second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const revoked = await revoking; assert.ifError(revoked.error); assert.equal(revoked.value.ok,true);
      assert.equal((await reviewWrite(question)).reason,'supplier_request_review_scope_forbidden'); assert.deepEqual(await reviewCounts(next.id),{reviews:1,events:1,audits:1});
    });
    await t.test('assigned detail and history serialize against revocation and never return a revoked row after waiting', async () => {
      for (const reader of [assignedRead,assignedReview]) {
        const request = await prepared(); await assign(assignCommand(request));
        await first.query('BEGIN'); await assign(assignCommand(request,1,{operator_id:null}),first);
        const reading = settle(reader(request.id,operatorA,operatorSessionA,second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
        const result = await reading; assert.ifError(result.error); assert.equal(result.value,null);
      }
    });
    await t.test('revoked session lock is rechecked before a waiting operator can publish a question', async () => {
      const request = await prepared(); await assign(assignCommand(request));
      await first.query('BEGIN'); await first.query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1',[operatorSessionA]);
      const waiting = settle(reviewWrite(operatorQuestion(request),second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      try { const result = await waiting; assert.ifError(result.error); assert.equal(result.value.reason,'supplier_request_review_scope_forbidden'); assert.deepEqual(await reviewCounts(request.id),{reviews:0,events:0,audits:0}); }
      finally { await observer.query('UPDATE auth_sessions SET revoked_at=NULL WHERE id=$1',[operatorSessionA]); }
    });
    await t.test('actual0096 permission-trigger locks serialize a new deny before reads and before committed review replay', async () => {
      const request = await prepared(); await assign(assignCommand(request)); const question = operatorQuestion(request); await reviewWrite(question);
      for (const operation of [() => assignedRead(request.id,operatorA,operatorSessionA,second),() => reviewWrite(question,second)]) {
        await first.query('BEGIN'); await first.query("INSERT INTO resource_permissions VALUES($1,NULL,'*','*','deny')",[operatorA]);
        const waiting = settle(operation()); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
        try { const result = await waiting; assert.ifError(result.error); assert.ok(result.value === null || result.value.reason === 'supplier_request_review_scope_forbidden'); }
        finally { await observer.query('DELETE FROM resource_permissions WHERE user_id=$1',[operatorA]); }
      }
      assert.deepEqual(await reviewCounts(request.id),{reviews:1,events:1,audits:1});
    });
    await t.test('conversion shares the assignment lock: no late assignment, but a provisioned assignment can be revoked', async () => {
      const request = await prepared(); await first.query('BEGIN'); const order = await convert(request,technical(request),first);
      const waiting = settle(assign(assignCommand(request),second)); try { await waitForLock(second); } finally { await first.query('COMMIT'); }
      const refused = await waiting; assert.ifError(refused.error); assert.equal(refused.value.reason,'supplier_request_not_submitted'); assert.equal((await read(request.id)).order_id,order.supplier_order.id);
      const next = await prepared(); await assign(assignCommand(next)); await convert(next);
      const current = await read(next.id); assert.equal((await assignedRead(next.id)).status,'provisioned');
      assert.equal((await assign(assignCommand(current,1,{operator_id:null}))).ok,true); assert.equal(await assignedRead(next.id),null);
    });
    await t.test('assignment history over100 has exact exclusive cursors without leaking receipt hashes or session IDs', async () => {
      const request = await prepared();
      for (let revision=0;revision<103;revision++) assert.equal((await assign(assignCommand(request,revision,{operator_id:revision%2 ? operatorB : operatorA}))).ok,true);
      const current = await assignmentRead(request); assert.equal(current.history.length,100); assert.equal(current.history[0].revision,4); assert.equal(current.next_before_revision,4); assert.equal(current.truncated,true);
      const older = await assignmentRead(request,4); assert.deepEqual(older.history.map(row=>row.revision),[1,2,3]); assert.equal(older.next_before_revision,null); assert.equal(older.truncated,false); assert.deepEqual(older.assignment,current.assignment);
      assert.doesNotMatch(JSON.stringify(current),/fingerprint|auth_session|idempotency_key|audit_id|email/);
    });
    await observer.query(scoped(await readFile(new URL('../db/migrations/20260924010000_0117_supplier_request_cancellation.sql', import.meta.url), 'utf8')));
    const { runCancellationTests } = await import('./supplier-request-cancellation.postgres.mjs');
    await runCancellationTests(t, {schema,observer,first,second,tenantA,tenantB,actorA,actorB,sessionA,sessionB,globalActor,globalSession,operatorA,operatorB,operatorSessionA,prepared,command,mutate,read,counts,graphCounts,assignCommand,assign,assignedRead,assignedList,assignmentRead,technical,convert,reviewCommand,reviewWrite,reviewRead,waitForLock,settle});
    await observer.query(scoped(await readFile(new URL('../db/migrations/20260924050000_0118_supplier_request_quotes.sql', import.meta.url), 'utf8')));
    const { runQuotePostgresTests } = await import('./supplier-request-quotes.postgres.mjs');
    await runQuotePostgresTests(t,{schema,observer,first,second,tenantA,tenantB,actorA,actorB,sessionA,sessionB,globalActor,globalSession,operatorA,operatorSessionA,prepared,command,mutate,read,graphCounts,technical,convert,reviewCommand,reviewWrite,reviewRead,waitForLock,settle});
  } finally {
    for (const client of clients) await client.query('ROLLBACK').catch(() => {});
    if (createdSchema) { assert.match(schema, /^qa_supplier_requests_[a-f0-9]{32}$/); await observer.query(`DROP SCHEMA "${schema}" CASCADE`); }
    await Promise.all(clients.map(client => client.end()));
  }
});
