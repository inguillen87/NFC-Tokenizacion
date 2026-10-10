import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { assertQaPostgresClientIdentity } from "./ownership-current-state-postgres-harness.mjs";
import { verticalWriterFixture, verticalTestEnv } from "./consumer-vertical-writer-fixture.mjs";

// Import-safe. Only the explicitly supplied, independently attested disposable
// clients may create a random schema. No connection/env lookup occurs here.
export async function runConsumerVerticalWriterPostgresQa({ connect, dockerAttestation } = {}) {
  assert.equal(typeof connect, "function", "An explicit disposable QA connection factory is required");
  const schema = `consumer_vertical_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^consumer_vertical_qa_[a-f0-9]{32}$/);
  const s = `"${schema}"`, clients = [], pids = [], current = new AsyncLocalStorage();
  const barrierKey = randomBytes(6).readUIntBE(0, 6);
  let removeExecutor, created = false, eventId = 960001;
  const report = { kind: "synthetic-postgresql-consumer-vertical-writer", ok: false, checks: [], connectionEvidence: [], lockObservations: [], serializationConflicts: 0,
    cleanup: { schemaDropped: false, connectionsClosed: false }, limits: [
      "Real PostgreSQL execution of the actual persisted resolver and SERIALIZABLE business writer against a disposable synthetic schema",
      "No production migrations, customer data, provider, OTP, physical NFC or HTTP authentication are exercised",
      "One-use capability is not restored or tested here; route-unit tests cover ordering, while these races exercise the business writer after precheck",
      "Realtime projection is deliberately outside this service and is never requested by this harness",
      "Atomicity covers these cooperating writers, not arbitrary unrelated database writers",
      "A first tenant profile INSERT without a shared tenant/tag revision fence may serialize after an already-running writer; this is transaction ordering, not a wall-clock publication guarantee",
    ] };
  try {
    let database;
    for (let i = 0; i < 3; i++) {
      const client = await connect(); clients.push(client);
      assert.ok(typeof client?.query === "function" && typeof client?.end === "function");
      const { rows: [identity] } = await client.query("SELECT current_database() AS database, current_user AS role, pg_backend_pid() AS pid, host(inet_server_addr()) AS address, current_setting('server_version_num')::integer AS server_version_number, current_setting('neon.endpoint_id', true) AS neon_endpoint_id, current_setting('transaction_read_only') AS transaction_read_only");
      report.connectionEvidence.push(assertQaPostgresClientIdentity(client, identity, { dockerAttestation }));
      database ??= identity.database; assert.equal(identity.database, database);
      assert.ok(Number.isInteger(identity.pid) && !pids.includes(identity.pid), "Independent PostgreSQL backends required"); pids.push(identity.pid);
    }
    const [admin, first, second] = clients;
    const db = await import("../../src/lib/db.ts");
    const service = await import("../../src/lib/consumer-vertical-writer-policy.ts");
    const { markTagManuallyOpened } = await import("../../src/lib/mark-tag-manually-opened.ts");
    await admin.query(`CREATE SCHEMA ${s}`); created = true;
    for (const client of clients) {
      await client.query(`SET search_path TO ${s}, pg_catalog`);
      await client.query("SELECT set_config('statement_timeout','14000',false), set_config('lock_timeout','12000',false)");
      assert.equal((await client.query("SELECT current_schema() AS schema")).rows[0].schema, schema);
    }
    await admin.query(`
      CREATE TABLE ${s}.schema_migrations(id text PRIMARY KEY);
      CREATE TYPE ${s}.loyalty_member_status AS ENUM ('anonymous','enrolled','verified','blocked','deleted');
      CREATE TABLE ${s}.tenants(id uuid PRIMARY KEY, slug text, name text, status text);
      CREATE TABLE ${s}.batches(id uuid PRIMARY KEY, tenant_id uuid, bid text, status text, sdm_config jsonb, carrier_profile_code text);
      CREATE TABLE ${s}.tags(id uuid PRIMARY KEY, batch_id uuid, uid_hex text, status text, lifecycle_state text);
      CREATE TABLE ${s}.tenant_sun_profiles(tenant_id uuid PRIMARY KEY, vertical text, club_name text, product_label text, origin_label text, origin_address text, origin_lat float, origin_lng float, tokenization_mode text, claim_policy text, ownership_policy jsonb, manifest_policy jsonb);
      CREATE TABLE ${s}.tag_profiles(tag_id uuid UNIQUE, product_name text, winery text, image_url text);
      CREATE TABLE ${s}.tag_manual_tamper_overrides(batch_id uuid, uid_hex text, tamper_status text, reason text, evidence_note text, source text, updated_at timestamptz, UNIQUE(batch_id,uid_hex));
      CREATE TABLE ${s}.events(id bigint PRIMARY KEY, tenant_id uuid, batch_id uuid, uid_hex text, sdm_read_ctr integer, result text, reason text, source text, event_type text, verdict text, cmac_ok boolean, allowlisted boolean, city text, country_code text, meta jsonb);
      CREATE TABLE ${s}.loyalty_programs(id uuid PRIMARY KEY, tenant_id uuid, status text, start_at timestamptz DEFAULT now()-interval '1 day', end_at timestamptz, created_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.tenant_consumer_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, consumer_id uuid, loyalty_program_id uuid, source text, first_tap_event_id bigint, last_tap_event_id bigint, status text, points_balance integer DEFAULT 0, lifetime_points integer DEFAULT 0, last_activity_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(tenant_id,consumer_id));
      CREATE TABLE ${s}.consumer_tap_history(consumer_id uuid, tenant_id uuid, tap_event_id bigint, verdict text, risk_level text, city text, country text, UNIQUE(consumer_id,tap_event_id));
      CREATE TABLE ${s}.consumer_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), consumer_id uuid, tenant_id uuid, product_passport_id text, tag_id uuid, first_tap_event_id bigint, latest_tap_event_id bigint, ownership_status text, collection_type text, product_name text, brand_name text, image_url text, acquired_at timestamptz, updated_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.loyalty_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, program_id uuid, event_id bigint, member_key text, consumer_id uuid, preferred_locale text, email text, phone text, display_name text, country text, status ${s}.loyalty_member_status, first_tap_at timestamptz, last_tap_at timestamptz, updated_at timestamptz DEFAULT now(), points_balance integer DEFAULT 0, UNIQUE(program_id,member_key));
      CREATE FUNCTION ${s}.product_fixture_barrier() RETURNS trigger LANGUAGE plpgsql AS $fixture$
      BEGIN
        IF current_setting('nexid.fixture_product_fail',true)='yes' THEN RAISE EXCEPTION 'synthetic_product_failure' USING ERRCODE='23514'; END IF;
        IF current_setting('nexid.fixture_product_barrier',true)='yes' THEN PERFORM pg_advisory_xact_lock(${barrierKey}); END IF;
        RETURN NEW;
      END; $fixture$;
      CREATE TRIGGER product_failure BEFORE INSERT ON ${s}.consumer_products FOR EACH ROW EXECUTE FUNCTION ${s}.product_fixture_barrier();
    `);
    await admin.query(`INSERT INTO ${s}.schema_migrations SELECT unnest($1::text[])`, [[...db.DEFAULT_REQUIRED_SCHEMA_MIGRATIONS]]);
    removeExecutor = db.installEphemeralE2eSqlExecutor(async (strings, ...values) => {
      const text = strings.reduce((query, part, i) => query + (i ? `$${i}` : "") + part, "");
      assert.doesNotMatch(text, /\bpublic\s*\./i);
      const client = current.getStore() || first;
      if (!/WITH locked_identity/.test(text)) return (await client.query(text, values)).rows;
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      try { const result = await client.query(text, values); await client.query("COMMIT"); return result.rows; }
      catch (error) { await client.query("ROLLBACK"); if (error.code === "40001") report.serializationConflicts++; throw error; }
    }, verticalTestEnv, { migrationManaged: true });

    async function fixture(vertical = "wine", result = "VALID_CLOSED") {
      const f = verticalWriterFixture(vertical, result), snap = f.snapshot;
      const tenantId = randomUUID(), batchId = randomUUID(), tagId = randomUUID();
      Object.assign(snap.tenant, { id: tenantId, slug: `qa-${tenantId}` });
      Object.assign(snap.batch, { id: batchId, tenant_id: tenantId, bid: `QA-${batchId}` });
      Object.assign(snap.tag, { id: tagId, batch_id: batchId }); Object.assign(snap.profile, { tenant_id: tenantId });
      Object.assign(snap.product, { tag_id: tagId }); Object.assign(snap.event, { id: String(eventId++), tenant_id: tenantId, batch_id: batchId });
      const consumerId = randomUUID(), programId = randomUUID();
      for (const [table, value] of [["tenants",snap.tenant],["batches",snap.batch],["tags",snap.tag],["tenant_sun_profiles",snap.profile],["tag_profiles",snap.product],["events",snap.event]]) {
        await admin.query(`INSERT INTO ${s}.${table} SELECT * FROM jsonb_populate_record(NULL::${s}.${table},$1::jsonb)`, [JSON.stringify(value)]);
      }
      await admin.query(`INSERT INTO ${s}.loyalty_programs(id,tenant_id,status) VALUES($1,$2,'active')`, [programId,tenantId]);
      return { consumerId, programId, tenantId, batchId, tagId, eventId: snap.event.id };
    }
    async function state(f) {
      const counts = {};
      for (const table of ["tenant_consumer_memberships","consumer_tap_history","consumer_products","loyalty_members"]) counts[table] = Number((await admin.query(`SELECT count(*) FROM ${s}.${table} WHERE consumer_id=$1 AND tenant_id=$2`, [f.consumerId,f.tenantId])).rows[0].count);
      return counts;
    }
    const zero = counts => assert.deepEqual(Object.values(counts), [0,0,0,0]);
    async function precheck(f, action = "save") { return current.run(first, () => service.readConsumerVerticalContext(f.eventId, action)); }
    const write = (f, context, client = first) => current.run(client, () => context.action === "rewards"
      ? service.enrollConsumerVerticalTap({ consumerId:f.consumerId, context, programId:f.programId, locale:"es-AR" })
      : service.associateConsumerVerticalTap({ consumerId:f.consumerId, context }));
    async function check(name, fn) { await fn(); report.checks.push({ name, passed:true }); }
    async function waitLocked(name, writerPid) {
      const deadline = Date.now()+7000;
      while (Date.now()<deadline) {
        await admin.query("SELECT pg_stat_clear_snapshot()");
        const rows = (await admin.query("SELECT pid FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock' AND query LIKE '%WITH locked_identity%'", [writerPid])).rows;
        if (rows.length) { report.lockObservations.push({ name, writerPid, lockObserved:true }); return; }
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      throw new Error("Actual vertical writer did not wait on the controlled PostgreSQL lock");
    }
    async function race(f, action, mutation) {
      const decision = await precheck(f,action); assert.equal(decision.ok,true);
      await admin.query("BEGIN"); let pending, gateError;
      try { await mutation(); pending=write(f,decision.context); pending.catch(()=>{}); await waitLocked(action,pids[1]); }
      catch(error) { gateError=error; }
      finally { await admin.query(gateError ? "ROLLBACK" : "COMMIT"); }
      const result=pending ? await pending : null; if(gateError) throw gateError;
      assert.equal(result,null); zero(await state(f));
    }

    for (const [vertical,result,action] of [["pharma","VALID_OPENED","save"],["pharma","VALID_OPENED","rewards"],["pharma","VALID_CLOSED","save"],["art","VALID_CLOSED","join"],["art","VALID_CLOSED","rewards"],["documents","VALID_CLOSED","join"],["documents","VALID_CLOSED","rewards"]]) {
      await check(`${vertical}_${result}_${action}_denied_without_writes`,async()=>{const f=await fixture(vertical,result);assert.equal((await precheck(f,action)).ok,false);zero(await state(f));});
    }
    for (const result of ["VALID_CLOSED","VALID_OPENED","VALID_OPENED_PREVIOUSLY"]) {
      await check(`wine_${result}_association_preserves_membership_history_product`,async()=>{const f=await fixture("wine",result), d=await precheck(f);assert.equal(d.ok,true);assert.ok(await write(f,d.context));assert.deepEqual(Object.values(await state(f)),[1,1,1,0]);});
      await check(`wine_${result}_enrollment_preserves_configured_consumption`,async()=>{const f=await fixture("wine",result), d=await precheck(f,"rewards");assert.equal(d.ok,true);assert.ok(await write(f,d.context));assert.deepEqual(Object.values(await state(f)),[0,0,0,1]);});
    }
    for (const result of ["MANUAL_OPENED","REPLAY_SUSPECT","BROKEN"]) await check(`${result}_denied_before_writer`,async()=>{const f=await fixture("wine",result);assert.equal((await precheck(f)).ok,false);zero(await state(f));});
    await check("cross_tenant_batch_denied",async()=>{const f=await fixture();await admin.query(`UPDATE ${s}.batches SET tenant_id=$1 WHERE id=$2`,[randomUUID(),f.batchId]);assert.equal((await precheck(f)).ok,false);zero(await state(f));});
    await check("profile_changed_between_precheck_and_write_has_zero_effects",async()=>{const f=await fixture(),d=await precheck(f);assert.equal(d.ok,true);await admin.query(`UPDATE ${s}.tenant_sun_profiles SET vertical='pharma' WHERE tenant_id=$1`,[f.tenantId]);assert.equal(await write(f,d.context),null);zero(await state(f));});
    await check("product_failure_rolls_back_membership_and_history",async()=>{const f=await fixture(),d=await precheck(f);assert.equal(d.ok,true);await first.query("SELECT set_config('nexid.fixture_product_fail','yes',false)");try{await assert.rejects(write(f,d.context),error=>error.code==='23514');}finally{await first.query("SELECT set_config('nexid.fixture_product_fail','no',false)");}zero(await state(f));});
    await check("profile_withdrawal_race_serializes_then_denies_all_business_writes",async()=>{const f=await fixture();await race(f,"save",()=>admin.query(`UPDATE ${s}.tenant_sun_profiles SET vertical='pharma' WHERE tenant_id=$1`,[f.tenantId]));});
    await check("tag_revocation_race_serializes_then_denies_all_business_writes",async()=>{const f=await fixture();await race(f,"join",()=>admin.query(`UPDATE ${s}.tags SET lifecycle_state='revoked' WHERE id=$1`,[f.tagId]));});
    await check("real_manual_declaration_noop_tag_fence_serializes_then_denies_all_business_writes",async()=>{
      const f=await fixture();
      await race(f,"save",async()=>assert.equal(await current.run(admin,()=>markTagManuallyOpened({batchId:f.batchId,tenantId:f.tenantId,uidHex:"04AABBCCDD0011",reason:"synthetic_manual_open",evidenceNote:"synthetic fixture",source:"admin"})),true));
      assert.deepEqual((await admin.query(`SELECT status,lifecycle_state FROM ${s}.tags WHERE id=$1`,[f.tagId])).rows[0],{status:"active",lifecycle_state:"active"});
      assert.equal((await admin.query(`SELECT tamper_status FROM ${s}.tag_manual_tamper_overrides WHERE batch_id=$1`,[f.batchId])).rows[0].tamper_status,"MANUAL_OPENED");
    });
    await check("programme_pause_race_serializes_then_denies_enrollment",async()=>{const f=await fixture();await race(f,"rewards",()=>admin.query(`UPDATE ${s}.loyalty_programs SET status='paused' WHERE id=$1`,[f.programId]));});
    await check("brand_membership_withdrawal_denies_product_and_enrollment",async()=>{const f=await fixture(),save=await precheck(f),enroll=await precheck(f,"rewards");await admin.query(`INSERT INTO ${s}.tenant_consumer_memberships(tenant_id,consumer_id,status) VALUES($1,$2,'blocked')`,[f.tenantId,f.consumerId]);assert.equal(await write(f,save.context),null);assert.equal(await write(f,enroll.context),null);assert.deepEqual(Object.values(await state(f)),[1,0,0,0]);});
    await check("first_profile_publication_has_serial_ordering_not_commit_time_revocation",async()=>{
      const f=await fixture(),profile=verticalWriterFixture().snapshot.profile;
      const sun={vertical:"wine",clubName:profile.club_name,product:{label:profile.product_label},origin:{label:profile.origin_label,address:profile.origin_address,lat:profile.origin_lat,lng:profile.origin_lng},passport:{tokenizationMode:profile.tokenization_mode,claimPolicy:profile.claim_policy,ownershipPolicy:profile.ownership_policy,manifestPolicy:profile.manifest_policy}};
      await admin.query(`DELETE FROM ${s}.tenant_sun_profiles WHERE tenant_id=$1`,[f.tenantId]);
      await admin.query(`UPDATE ${s}.batches SET sdm_config=$1::jsonb WHERE id=$2`,[JSON.stringify({sun}),f.batchId]);
      const d=await precheck(f);assert.equal(d.ok,true);assert.equal(d.context.vertical,"wine");
      await first.query("SELECT set_config('nexid.fixture_product_barrier','yes',false)");
      await admin.query("BEGIN");await admin.query("SELECT pg_advisory_xact_lock($1::bigint)",[barrierKey]);
      let pending,error;
      try{
        pending=write(f,d.context);pending.catch(()=>{});await waitLocked("absent-profile-publication",pids[1]);
        await admin.query(`INSERT INTO ${s}.tenant_sun_profiles SELECT * FROM jsonb_populate_record(NULL::${s}.tenant_sun_profiles,$1::jsonb)`,[JSON.stringify({...profile,tenant_id:f.tenantId,vertical:"pharma"})]);
      }catch(e){error=e;}finally{await admin.query(error?"ROLLBACK":"COMMIT");}
      try{
        const result=pending?await pending:null;if(error)throw error;
        assert.ok(result,"A single read/write dependency permits the writer-before-new-profile serial order");
        assert.deepEqual(Object.values(await state(f)),[1,1,1,0]);
        const currentDecision=await precheck(f);assert.equal(currentDecision.ok,false);assert.equal(currentDecision.error,"tap_action_not_allowed");
      }finally{await first.query("SELECT set_config('nexid.fixture_product_barrier','no',false)");}
    });
    await check("overlapping_association_writers_keep_one_product_and_history",async()=>{
      const f=await fixture(),d1=await precheck(f),d2=await precheck(f,"join");
      await first.query("SELECT set_config('nexid.fixture_product_barrier','yes',false)");
      await admin.query("BEGIN");await admin.query("SELECT pg_advisory_xact_lock($1::bigint)",[barrierKey]);
      let a,b,error;
      try{a=write(f,d1.context,first);a.catch(()=>{});await waitLocked("concurrent-first",pids[1]);b=write(f,d2.context,second);b.catch(()=>{});await waitLocked("concurrent-second",pids[2]);}catch(e){error=e;}
      finally{await admin.query("ROLLBACK");}
      const results=await Promise.allSettled([a,b].filter(Boolean));await first.query("SELECT set_config('nexid.fixture_product_barrier','no',false)");if(error)throw error;
      for(const row of results){if(row.status==='rejected')throw row.reason;assert.ok(row.value);}
      assert.deepEqual(Object.values(await state(f)),[1,1,1,0]);
    });
    assert.ok(report.serializationConflicts>=4,"Controlled races must actually encounter SERIALIZABLE conflicts");
    report.ok=true;
  } finally {
    removeExecutor?.();
    try { if(created) { for(const client of clients) await client.query("ROLLBACK").catch(()=>{}); await clients[0].query(`DROP SCHEMA ${s} CASCADE`); report.cleanup.schemaDropped=true; } }
    finally { await Promise.all(clients.map(client=>client.end()));report.cleanup.connectionsClosed=true; }
  }
  return report;
}
