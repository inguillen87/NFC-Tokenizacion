import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Socket } from "node:net";
import { assertQaPostgresClientIdentity } from "./ownership-current-state-postgres-harness.mjs";

// Import-safe: no environment, connection or application import at module load.
// Both catalogues use the current issuer and CTE, never an old captured UPDATE.
export const CONSUMER_OWNERSHIP_CLAIM_SOURCE_PATHS = Object.freeze([
  "package.json", "src/lib/consumer-auth.ts", "src/lib/consumer-vertical-writer-policy.ts",
  "src/lib/sun-fresh-handoff.ts", "src/lib/sun-rate-limit-store.ts", "src/lib/consumer-tap-eligibility.ts",
  "src/app/consumer/tap-eligibility/route.ts", "tests/consumer-tap-eligibility.test.mjs",
  "tests/consumer-vertical-writer-policy.test.mjs", "src/lib/ownership-claim-pin.ts",
  "src/lib/consumer-portal-service.ts", "src/app/mobile/passport/[eventId]/consumer/claim/route.ts",
  "src/app/public/cta/claim-ownership/route.ts",
]);
const TEST_ENV = Object.freeze({ NODE_ENV: "test", VERCEL_ENV: "test",
  NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
  // Synthetic validator input only. The actual connection is the explicit,
  // independently attested connect factory; this string is never connected.
  NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e_claim" });
const CORE_TABLES = Object.freeze(["consumer_product_ownerships", "tenant_consumer_memberships", "consumer_tap_history", "consumer_products"]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

// This records the actual checkout used by CI; it does not approve a release or
// substitute for Root's candidate/head/tree review. The runner checks it again
// before any connection and after its cases, catching changes during execution.
export async function readConsumerOwnershipClaimSourcePins(apiRoot) {
  assert.equal(typeof apiRoot, "string"); assert.ok(path.isAbsolute(apiRoot));
  return Promise.all(CONSUMER_OWNERSHIP_CLAIM_SOURCE_PATHS.map(async file => ({
    file: `apps/api/${file}`, sha256: hash(await readFile(path.join(apiRoot, file))),
  })));
}

export async function runConsumerOwnershipClaimPostgresQa({ connect, dockerAttestation, apiRoot, sourcePins, catalogue = "core" } = {}) {
  assert.equal(typeof connect, "function", "Explicit disposable connection factory required");
  assert.ok(["core", "legacy-equivalence"].includes(catalogue), "Unknown PostgreSQL claim catalogue");
  assert.equal(typeof apiRoot, "string"); assert.ok(path.isAbsolute(apiRoot));
  assert.equal(process.env.NODE_ENV, "test"); assert.equal(process.env.VERCEL_ENV, "test");
  assert.ok(Array.isArray(sourcePins) && sourcePins.length === CONSUMER_OWNERSHIP_CLAIM_SOURCE_PATHS.length, "Fresh reviewed candidate source pins required");
  for (const file of CONSUMER_OWNERSHIP_CLAIM_SOURCE_PATHS) {
    const pin = sourcePins.filter(row => row.file === `apps/api/${file}`);
    assert.equal(pin.length, 1); assert.match(pin[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal(hash(await readFile(path.join(apiRoot, file))), pin[0].sha256, "Candidate source changed before PostgreSQL");
  }
  const load = file => import(pathToFileURL(path.join(apiRoot, file)).href);
  const schema = `consumer_claim_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^consumer_claim_qa_[a-f0-9]{32}$/);
  const s = `"${schema}"`, clients = [], pids = [], current = new AsyncLocalStorage();
  const barrier = randomBytes(6).readUIntBE(0, 6), secretKeys = ["SUN_HANDOFF_SECRET", "RATE_LIMIT_KEY_PEPPER"];
  const priorEnv = new Map(secretKeys.map(key => [key, { present: Object.hasOwn(process.env, key), value: process.env[key] }]));
  const pin = `Synthetic-${randomBytes(18).toString("hex")}`, pinHash = hash(pin);
  let removeExecutor, created = false, eventSequence = 980000, coreExecutions = 0, executorMutations = 0;
  let commitGate = null, transformNextCoreParameters = null;
  const relationObservations = []; // Actual SQL result booleans only, private RAM.
  const report = { schema: "nexid.consumer-ownership-claim-postgres/v1", kind: "synthetic-isolated-postgresql", ok: false,
    semanticsVersion: catalogue === "core" ? "ownership-claim-four-effect-core/v1" : "ownership-current-state-no-reclaim-equivalence/v2",
    catalogue, sourcePinsVerified: false,
    checks: [], lockObservations: [], serializationConflicts: 0, connectionEvidence: [],
    cleanup: { schemaDropped: false, connectionsClosed: false, syntheticEnvironmentRestored: false },
    limits: ["New core tests; no inherited PG26/CI458 acceptance", "Synthetic PIN, capabilities and customer data only",
      "Canonical/outbox/realtime and HTTP authentication are outside this direct core harness",
      "R7 uses the actual private GET/auth SELECT with synthetic sessions; no HTTP/customer authentication acceptance",
      "Cross-tenant historical row cases prove advisory predicate isolation, not later global-UNIQUE commit eligibility",
      "Serializable ordering is not an instantaneous commit-time publication guarantee",
      "Missing-profile first publication race is not implemented by this draft", "Scope buckets remain independent between public and consumer routes"] };
  try {
    for (const key of secretKeys) process.env[key] = randomBytes(32).toString("hex");
    let database, version;
    for (let i = 0; i < 3; i++) {
      const client = await connect(); clients.push(client);
      assert.ok(typeof client?.query === "function" && typeof client?.end === "function");
      assert.equal(clients.filter(row=>row===client).length,1,"Distinct QA clients required");
      const { rows: [identity] } = await client.query("SELECT current_database() AS database,current_user AS role,pg_backend_pid() AS pid,host(inet_server_addr()) AS address,current_setting('server_version_num')::integer AS server_version_number,current_setting('neon.endpoint_id',true) AS neon_endpoint_id,current_setting('transaction_read_only') AS transaction_read_only");
      const evidence = assertQaPostgresClientIdentity(client, identity, { dockerAttestation });
      assert.ok([160004, 180004].includes(identity.server_version_number));
      assert.equal(String(identity.neon_endpoint_id || "").trim(), ""); assert.equal(identity.transaction_read_only, "off");
      if(!dockerAttestation){
        const parameters=client.connectionParameters,socket=client.connection?.stream;
        assert.ok(parameters&&["127.0.0.1","::1"].includes(parameters.host));assert.equal(parameters.user,identity.role);assert.equal(parameters.database,identity.database);
        assert.ok(socket instanceof Socket&&!socket.destroyed&&!socket.connecting&&socket.readyState==="open"&&client._connected===true&&!client._ending&&!client._ended);
        assert.ok(["127.0.0.1","::1","::ffff:127.0.0.1"].includes(socket.remoteAddress));assert.equal(socket.remotePort,Number(parameters.port));
      }
      database ??= identity.database; version ??= identity.server_version_number;
      assert.equal(identity.database, database); assert.equal(identity.server_version_number, version);
      assert.ok(Number.isInteger(identity.pid) && !pids.includes(identity.pid)); pids.push(identity.pid);
      report.connectionEvidence.push({ mode: evidence.mode, serverVersionNumber: version });
    }
    const [admin, first, second] = clients;
    const db = await load("src/lib/db.ts"), policy = await load("src/lib/consumer-vertical-writer-policy.ts");
    const fresh = await load("src/lib/sun-fresh-handoff.ts"), { verticalWriterFixture } = await load("tests/helpers/consumer-vertical-writer-fixture.mjs");
    const { markTagManuallyOpened } = await load("src/lib/mark-tag-manually-opened.ts");
    // Deferred until all connection/peer/version/source attestations have passed.
    const getEligibility = catalogue === "core" ? (await load("src/app/consumer/tap-eligibility/route.ts")).GET : null;
    await admin.query(`CREATE SCHEMA ${s}`); created = true;
    for (const client of clients) {
      await client.query(`SET search_path TO ${s},pg_catalog`);
      await client.query("SELECT set_config('statement_timeout','14000',false),set_config('lock_timeout','12000',false)");
      assert.equal((await client.query("SELECT current_schema() AS schema")).rows[0].schema, schema);
    }
    await admin.query(`
      CREATE TABLE ${s}.schema_migrations(id text PRIMARY KEY);
      CREATE TABLE ${s}.tenants(id uuid PRIMARY KEY,slug text,name text,status text);
      CREATE TABLE ${s}.consumers(id uuid PRIMARY KEY,status text NOT NULL DEFAULT 'registered',wallet_address text);
      CREATE TABLE ${s}.consumer_sessions(session_token_hash text PRIMARY KEY,consumer_id uuid REFERENCES ${s}.consumers(id),expires_at timestamptz NOT NULL,revoked_at timestamptz);
      CREATE TABLE ${s}.consumer_identities(consumer_id uuid,provider text,verified_at timestamptz,provider_subject text);
      CREATE TABLE ${s}.batches(id uuid PRIMARY KEY,tenant_id uuid REFERENCES ${s}.tenants(id),bid text,status text,sdm_config jsonb,carrier_profile_code text,active_for_claim boolean,claim_pin_required boolean,hash_pin text);
      CREATE TABLE ${s}.tags(id uuid PRIMARY KEY,batch_id uuid REFERENCES ${s}.batches(id),uid_hex text,status text,lifecycle_state text,active_for_claim boolean,claim_pin_required boolean,hash_pin text);
      CREATE TABLE ${s}.tenant_sun_profiles(tenant_id uuid PRIMARY KEY,vertical text,club_name text,product_label text,origin_label text,origin_address text,origin_lat float,origin_lng float,tokenization_mode text,claim_policy text,ownership_policy jsonb,manifest_policy jsonb);
      CREATE TABLE ${s}.tag_profiles(tag_id uuid UNIQUE,product_name text,winery text,image_url text);
      CREATE TABLE ${s}.tag_manual_tamper_overrides(batch_id uuid,uid_hex text,tamper_status text,reason text,evidence_note text,source text,updated_at timestamptz,UNIQUE(batch_id,uid_hex));
      CREATE TABLE ${s}.events(id bigint PRIMARY KEY,tenant_id uuid,batch_id uuid,uid_hex text,sdm_read_ctr integer,result text,reason text,source text,event_type text,verdict text,cmac_ok boolean,allowlisted boolean,city text,country_code text,meta jsonb);
      CREATE TABLE ${s}.loyalty_programs(id uuid PRIMARY KEY,tenant_id uuid,status text,start_at timestamptz DEFAULT now()-interval '1 day',end_at timestamptz,created_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.loyalty_members(program_id uuid,tenant_id uuid,member_key text,status text);
      CREATE TABLE ${s}.tenant_consumer_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,consumer_id uuid REFERENCES ${s}.consumers(id),loyalty_program_id uuid,source text,first_tap_event_id bigint,last_tap_event_id bigint,status text,points_balance integer DEFAULT 0,lifetime_points integer DEFAULT 0,last_activity_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(tenant_id,consumer_id));
      CREATE TABLE ${s}.consumer_tap_history(consumer_id uuid,tenant_id uuid,tap_event_id bigint,verdict text,risk_level text,city text,country text,UNIQUE(consumer_id,tap_event_id));
      CREATE TABLE ${s}.consumer_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),consumer_id uuid,tenant_id uuid,product_passport_id text,tag_id uuid,first_tap_event_id bigint,latest_tap_event_id bigint,ownership_status text,collection_type text,product_name text,brand_name text,image_url text,acquired_at timestamptz,updated_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.consumer_product_ownerships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES ${s}.tenants(id),consumer_id uuid REFERENCES ${s}.consumers(id),batch_id uuid REFERENCES ${s}.batches(id),tag_id uuid REFERENCES ${s}.tags(id),uid_hex text NOT NULL,event_id bigint REFERENCES ${s}.events(id),status text NOT NULL CHECK(status IN('claimed','blocked_replay','revoked','disputed')),source text NOT NULL CHECK(source IN('sun_passport','marketplace','admin')),trust_snapshot jsonb NOT NULL DEFAULT '{}',claimed_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(consumer_id,event_id));
      CREATE UNIQUE INDEX ownership_active_uid ON ${s}.consumer_product_ownerships(tenant_id,uid_hex) WHERE status='claimed';
      CREATE TABLE ${s}.sdk_pos_activations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,batch_id uuid,tag_id uuid,bid text,uid_hex text,pos_token_prefix text,pos_token_hash text UNIQUE,activation_status text,expires_at timestamptz,used_at timestamptz,meta jsonb DEFAULT '{}',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.sun_rate_limit_buckets(scope text NOT NULL,scope_key_hash text NOT NULL,window_started_at timestamptz NOT NULL DEFAULT now(),hit_count bigint NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(scope,scope_key_hash),CHECK(scope~'^[a-z0-9:_-]{1,80}$'),CHECK(scope_key_hash~'^[0-9a-f]{64}$'),CHECK(hit_count>=0));
      CREATE FUNCTION ${s}.claim_fixture_trigger() RETURNS trigger LANGUAGE plpgsql AS $fixture$
      BEGIN
        IF current_setting('nexid.claim_fail_table',true)=TG_TABLE_NAME THEN RAISE EXCEPTION 'synthetic_core_failure' USING ERRCODE='23514'; END IF;
        IF current_setting('nexid.claim_skip_table',true)=TG_TABLE_NAME THEN RETURN NULL; END IF;
        IF TG_TABLE_NAME='consumer_products' AND current_setting('nexid.claim_barrier',true)='yes' THEN PERFORM pg_advisory_xact_lock(${barrier}); END IF;
        RETURN NEW;
      END; $fixture$;
    `);
    for (const table of CORE_TABLES) await admin.query(`CREATE TRIGGER claim_fixture BEFORE INSERT OR UPDATE ON ${s}.${table} FOR EACH ROW EXECUTE FUNCTION ${s}.claim_fixture_trigger()`);
    await admin.query(`INSERT INTO ${s}.schema_migrations SELECT unnest($1::text[])`, [[...db.DEFAULT_REQUIRED_SCHEMA_MIGRATIONS]]);
    removeExecutor = db.installEphemeralE2eSqlExecutor(async (strings, ...values) => {
      const text = strings.reduce((q, part, i) => q + (i ? `$${i}` : "") + part, "");
      assert.doesNotMatch(text, /\bpublic\s*\./i);
      const client = current.getStore() || first;
      if (/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(text)) executorMutations++;
      if (!/WITH locked_identity/.test(text)) {
        const result = await client.query(text, values);
        if (/\bAS claim_record_exists\b/i.test(text)) {
          assert.equal(result.rows.length,1);
          relationObservations.push({recordExists:result.rows[0].claim_record_exists,ownershipClaimed:result.rows[0].ownership_claimed});
        }
        return result.rows;
      }
      assert.match(text, /ownership_write AS/); assert.match(text, /core_commit_fence/); coreExecutions++;
      // Actual query and bound values remain in RAM. The installed executor is
      // the existing isolated test seam; production runtime is not patched.
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      try {
        const transform = transformNextCoreParameters; transformNextCoreParameters = null;
        const parameters = transform ? transform(text, [...values]) : values;
        const result = await client.query(text, parameters);
        const gate = commitGate;
        if (gate && client === first) { commitGate = null; gate.arrived(); await gate.wait; }
        await client.query("COMMIT"); return result.rows;
      }
      catch (error) { await client.query("ROLLBACK"); if (error.code === "40001") report.serializationConflicts++; throw error; }
    }, TEST_ENV, { migrationManaged: true });

    async function fixture(result = "VALID_CLOSED", { posRequired = false } = {}) {
      const snap = verticalWriterFixture("wine", result).snapshot;
      const tenantId = randomUUID(), batchId = randomUUID(), tagId = randomUUID(), consumerId = randomUUID(), programId = randomUUID();
      Object.assign(snap.tenant, { id: tenantId, slug: `qa-${tenantId}` });
      Object.assign(snap.batch, { id: batchId, tenant_id: tenantId, bid: `QA-${batchId}`, active_for_claim: true, claim_pin_required: true, hash_pin: pinHash, sdm_config: { claim_requires_pos: posRequired } });
      Object.assign(snap.tag, { id: tagId, batch_id: batchId }); Object.assign(snap.profile, { tenant_id: tenantId, claim_policy: "inside_pack_secret" });
      Object.assign(snap.product, { tag_id: tagId }); Object.assign(snap.event, { id: String(++eventSequence), tenant_id: tenantId, batch_id: batchId });
      for (const [table, value] of [["tenants", snap.tenant], ["batches", snap.batch], ["tags", snap.tag], ["tenant_sun_profiles", snap.profile], ["tag_profiles", snap.product], ["events", snap.event]])
        await admin.query(`INSERT INTO ${s}.${table} SELECT * FROM jsonb_populate_record(NULL::${s}.${table},$1::jsonb)`, [JSON.stringify(value)]);
      await admin.query(`INSERT INTO ${s}.consumers(id) VALUES($1)`, [consumerId]);
      await admin.query(`INSERT INTO ${s}.loyalty_programs(id,tenant_id,status) VALUES($1,$2,'active')`, [programId, tenantId]);
      if (posRequired) await admin.query(`INSERT INTO ${s}.sdk_pos_activations(tenant_id,batch_id,tag_id,bid,uid_hex,pos_token_prefix,pos_token_hash,activation_status) VALUES($1,$2,$3,$4,$5,'synthetic',$6,'active')`, [tenantId,batchId,tagId,snap.batch.bid,snap.tag.uid_hex,hash(randomUUID())]);
      return { tenantId,batchId,tagId,consumerId,eventId:snap.event.id,bid:snap.batch.bid,uid:snap.tag.uid_hex, event:snap.event };
    }
    async function state(f, client = admin) {
      const rows = {};
      for (const table of CORE_TABLES) rows[table] = (await client.query(`SELECT to_jsonb(row) AS row FROM ${s}.${table} row WHERE tenant_id=$1 ORDER BY to_jsonb(row)::text`, [f.tenantId])).rows;
      return rows;
    }
    const empty = rows => assert.ok(CORE_TABLES.every(table => rows[table].length === 0));
    const precheck = (f, client = first) => current.run(client, () => policy.readConsumerOwnershipClaimContext(f.eventId, f.consumerId));
    async function authorize(f, { client = first, ttl = 299, suppliedPin = pin, presentPin = true, scope = "consumer_claim_ownership" } = {}) {
      const decision = await precheck(f, client); assert.equal(decision.ok, true);
      const now = Math.floor(Date.now()/1000), exp = now+ttl;
      const capability = fresh.createSunFreshHandoffToken({ bid:f.bid,eventId:f.eventId,uidHex:f.uid,readCounter:Number(f.event.sdm_read_ctr),diagnosticId:980999,traceId:randomUUID(),iat:now-1,exp });
      const req = new Request("https://synthetic.invalid/claim", { method:"POST" });
      const result = await current.run(client, () => policy.consumeAndAuthorizeConsumerOwnershipClaim(req, { fresh_token:capability,...(presentPin?{pin:suppliedPin}:{}) }, decision.context, scope));
      return { result, exp, req, capability, context:decision.context, client };
    }
    const commit = (f, authorized, client = authorized.client) => current.run(client, () => policy.commitConsumerOwnershipClaim({ consumerId:f.consumerId,eventId:f.eventId,bid:f.bid,uidHex:f.uid,source:"sun_passport",authorization:authorized.result.authorization }));
    async function replayDenied(f, authorized) { const before=coreExecutions; assert.equal((await commit(f,authorized)).error,"claim_context_required"); assert.equal(coreExecutions,before); }
    async function check(name, run) { try { await run(); report.checks.push({ name,passed:true,ok:true }); } catch(error) { report.checks.push({ name,passed:false,ok:false,sqlState:/^[0-9A-Z]{5}$/.test(error.code||"")?error.code:null }); throw new Error(`consumer_claim_pg_case_failed:${name}`); } }
    async function waitLocked(name, pid, expectedBlocker = pids[0], { observer = admin, requireCore = true } = {}) {
      const until=Date.now()+7000;
      while(Date.now()<until) { await observer.query("SELECT pg_stat_clear_snapshot()"); const rows=(await observer.query("SELECT pid,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock' AND (NOT $2::boolean OR query LIKE '%WITH locked_identity%')",[pid,requireCore])).rows;
        if(rows.length===1&&rows[0].blockers.includes(expectedBlocker)){report.lockObservations.push({name,lockObserved:true,expectedBlockerObserved:true});return;} await new Promise(resolve=>setTimeout(resolve,20)); }
      throw new Error("controlled_claim_lock_not_observed");
    }
    async function waitPast(exp) { const until=Date.now()+7000; while(Date.now()<until) { if((await admin.query("SELECT extract(epoch FROM clock_timestamp())>$1 AS expired",[exp])).rows[0].expired)return; await new Promise(resolve=>setTimeout(resolve,20)); } throw new Error("expiry_wait_exceeded"); }
    async function deniedCore(pending) { try { const result=await pending; assert.equal(result.ok,false); assert.ok(["claim_policy_changed","ownership_already_claimed"].includes(result.error)); }
      catch(error){ assert.ok(["22012","40001"].includes(error.code)); } }
    async function race(f, name, mutate, { ttl = 299, waitExpiry = false } = {}) {
      const authorized=await authorize(f,{ttl}); assert.equal(authorized.result.ok,true);
      await admin.query("BEGIN"); let pending, expected, failure;
      try { await mutate(); expected=await state(f,admin); pending=commit(f,authorized); pending.catch(()=>{}); await waitLocked(name,pids[1]); if(waitExpiry)await waitPast(authorized.exp); }
      catch(error){failure=error;} finally{await admin.query(failure?"ROLLBACK":"COMMIT");}
      if(pending)await deniedCore(pending); if(failure)throw failure;
      assert.deepEqual(await state(f),expected); await replayDenied(f,authorized);
    }

    async function completeCore(f) {
      const a = await authorize(f); assert.equal(a.result.ok,true);
      assert.equal((await commit(f,a)).ok,true);
      const rows = await state(f); assert.deepEqual(CORE_TABLES.map(table=>rows[table].length),[1,1,1,1]);
      return rows;
    }
    async function denyNewClaimWithoutChanges(f, before) {
      const executions=coreExecutions;
      const buckets=(await admin.query(`SELECT to_jsonb(bucket) AS row FROM ${s}.sun_rate_limit_buckets bucket ORDER BY scope,scope_key_hash`)).rows;
      assert.equal((await precheck(f)).ok,false);
      assert.equal(coreExecutions,executions);
      assert.deepEqual(await state(f),before);
      assert.deepEqual((await admin.query(`SELECT to_jsonb(bucket) AS row FROM ${s}.sun_rate_limit_buckets bucket ORDER BY scope,scope_key_hash`)).rows,buckets);
    }
    function pauseNextCoreCommit() {
      assert.equal(commitGate,null);
      let arrived,release;
      const reached=new Promise(resolve=>{arrived=resolve;});
      const wait=new Promise(resolve=>{release=resolve;});
      commitGate={arrived,wait};
      return { reached, release };
    }
    async function boundedArrival(promise) {
      let timeout;
      try { await Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error("controlled_claim_commit_not_reached")),7000);})]); }
      finally { clearTimeout(timeout); }
    }
    async function claimBeforeTransition(f, name) {
      const a=await authorize(f);assert.equal(a.result.ok,true);
      const gate=pauseNextCoreCommit();let writer,transition;
      try {
        writer=commit(f,a);writer.catch(()=>{});await boundedArrival(gate.reached);
        transition=admin.query(`UPDATE ${s}.tags SET status='inactive',lifecycle_state='suspended' WHERE id=$1`,[f.tagId]);transition.catch(()=>{});
        await waitLocked(name,pids[0],pids[1],{observer:second,requireCore:false});
        gate.release();assert.equal((await writer).ok,true);await transition;
        const historical=await state(f);assert.deepEqual(CORE_TABLES.map(table=>historical[table].length),[1,1,1,1]);
        assert.equal((await admin.query(`SELECT lifecycle_state FROM ${s}.tags WHERE id=$1`,[f.tagId])).rows[0].lifecycle_state,"suspended");
        await denyNewClaimWithoutChanges(f,historical);await replayDenied(f,a);
      } finally {
        gate.release();commitGate=null;
        if(writer)await writer.catch(()=>{});if(transition)await transition.catch(()=>{});
      }
    }
    async function runLegacyEquivalence() {
      // The second catalogue preserves the historical invariant matrix, not
      // its obsolete ability to UPDATE/reactivate an already claimed title.
      const lifecycleStates=["inactive","suspended","quarantined","lost","expired","broken","tampered","revoked","unknown",""];
      const alterations=[
        ["inactive_status",async f=>admin.query(`UPDATE ${s}.tags SET status='inactive' WHERE id=$1`,[f.tagId])],
        ["missing_exact_tag",async(f,owned)=>owned
          ? admin.query(`UPDATE ${s}.tags SET uid_hex='04AABBCCDDEE99' WHERE id=$1`,[f.tagId])
          : admin.query(`DELETE FROM ${s}.tags WHERE id=$1`,[f.tagId])],
        ["replacement_tag_id",async(f,owned)=>{
          if(!owned){await admin.query(`UPDATE ${s}.tags SET id=$1 WHERE id=$2`,[randomUUID(),f.tagId]);return;}
          // Preserve the historical FK. Move the old identity away and insert
          // a replacement instead of deleting/rebinding the existing title.
          const original=(await admin.query(`SELECT to_jsonb(tag) AS row FROM ${s}.tags tag WHERE id=$1`,[f.tagId])).rows[0].row;
          await admin.query(`UPDATE ${s}.tags SET uid_hex='04AABBCCDDEE99' WHERE id=$1`,[f.tagId]);
          await admin.query(`INSERT INTO ${s}.tags SELECT * FROM jsonb_populate_record(NULL::${s}.tags,$1::jsonb)`,[JSON.stringify({...original,id:randomUUID()})]);
        }],
        ["changed_event_batch",async f=>admin.query(`UPDATE ${s}.events SET batch_id=$1 WHERE id=$2`,[randomUUID(),f.eventId])],
        ["changed_event_tenant",async f=>admin.query(`UPDATE ${s}.events SET tenant_id=$1 WHERE id=$2`,[randomUUID(),f.eventId])],
        ["changed_batch_tenant",async f=>{
          const alternate=randomUUID();await admin.query(`INSERT INTO ${s}.tenants VALUES($1,'synthetic-alternate','Synthetic alternate','active')`,[alternate]);
          await admin.query(`UPDATE ${s}.batches SET tenant_id=$1 WHERE id=$2`,[alternate,f.batchId]);
        }],
        ["changed_event_uid",async f=>admin.query(`UPDATE ${s}.events SET uid_hex='04AABBCCDDEE99' WHERE id=$1`,[f.eventId])],
        ["ambiguous_current_identity",async f=>{
          const original=(await admin.query(`SELECT to_jsonb(tag) AS row FROM ${s}.tags tag WHERE id=$1`,[f.tagId])).rows[0].row;
          await admin.query(`INSERT INTO ${s}.tags SELECT * FROM jsonb_populate_record(NULL::${s}.tags,$1::jsonb)`,[JSON.stringify({...original,id:randomUUID(),uid_hex:original.uid_hex.toLowerCase()})]);
        }],
        ["replay_event",async f=>admin.query(`UPDATE ${s}.events SET result='REPLAY_SUSPECT' WHERE id=$1`,[f.eventId])],
        ["unknown_result",async f=>admin.query(`UPDATE ${s}.events SET result='VALID_FUTURE_UNKNOWN' WHERE id=$1`,[f.eventId])],
        ["real_manual_declaration",async f=>assert.equal(await current.run(admin,()=>markTagManuallyOpened({batchId:f.batchId,tenantId:f.tenantId,uidHex:f.uid,reason:"synthetic_open",evidenceNote:"synthetic fixture",source:"admin"})),true)],
      ];
      for(const owned of [false,true]) {
        const group=owned?"OWN_DENIAL_EQUIVALENCE":"INSERT";
        for(const [result,nullLifecycle]of[["VALID_CLOSED",false],["VALID_OPENED",true]]) await check(`${group}:${result}${nullLifecycle?"_legacy_null_lifecycle":""}`,async()=>{
          const f=await fixture(result);if(nullLifecycle)await admin.query(`UPDATE ${s}.tags SET lifecycle_state=NULL WHERE id=$1`,[f.tagId]);
          const rows=await completeCore(f);
          if(owned)await denyNewClaimWithoutChanges(f,rows);
        });
        for(const lifecycle of lifecycleStates)await check(`${group}:lifecycle_${lifecycle||"empty"}`,async()=>{
          const f=await fixture();const before=owned?await completeCore(f):await state(f);
          const a=owned?null:await authorize(f);if(a)assert.equal(a.result.ok,true);
          await admin.query(`UPDATE ${s}.tags SET status=$1,lifecycle_state=$2 WHERE id=$3`,[lifecycle==="revoked"?"revoked":"inactive",lifecycle,f.tagId]);
          if(owned)await denyNewClaimWithoutChanges(f,before);
          else{await deniedCore(commit(f,a));assert.deepEqual(await state(f),before);await replayDenied(f,a);}
        });
        for(const [name,alter]of alterations)await check(`${group}:${name}`,async()=>{
          const f=await fixture();const before=owned?await completeCore(f):await state(f);
          const a=owned?null:await authorize(f);if(a)assert.equal(a.result.ok,true);
          await alter(f,owned);
          if(owned)await denyNewClaimWithoutChanges(f,before);
          else{await deniedCore(commit(f,a));assert.deepEqual(await state(f),before);await replayDenied(f,a);}
        });
        await check(`${group}:earlier_transition${owned?"_title_appears_after_precheck":"_tag_lifecycle"}`,async()=>{
          const f=await fixture();
          if(!owned){await race(f,"legacy-insert-transition",()=>admin.query(`UPDATE ${s}.tags SET status='inactive',lifecycle_state='suspended' WHERE id=$1`,[f.tagId]));return;}
          // An existing title would be denied before SQL. To preserve the old
          // UPDATE race objective, a title appears after a legitimate INSERT
          // issuer. It must win; the new writer must not reassociate any row.
          await race(f,"legacy-title-appears",()=>admin.query(`INSERT INTO ${s}.consumer_product_ownerships(tenant_id,consumer_id,batch_id,tag_id,uid_hex,event_id,status,source) VALUES($1,$2,$3,$4,$5,$6,'claimed','sun_passport')`,[f.tenantId,f.consumerId,f.batchId,f.tagId,f.uid,f.eventId]));
          const rows=await state(f);assert.deepEqual(CORE_TABLES.map(table=>rows[table].length),[1,0,0,0]);await denyNewClaimWithoutChanges(f,rows);
        });
        await check(`${group}:claim_first_later_transition_historical_title`,async()=>{
          await claimBeforeTransition(await fixture(),owned?"legacy-owned-order-equivalence":"legacy-insert-order");
        });
      }
      await check("actual_core_invalid_uuid_parameter_rolls_back_four_effects",async()=>{
        const f=await fixture(),a=await authorize(f);assert.equal(a.result.ok,true);
        transformNextCoreParameters=(text,values)=>{
          const index=values.indexOf(f.tagId);assert.ok(index>=0);
          assert.ok(text.includes(`$${index+1}::uuid`));
          values[index]="invalid-synthetic-uuid";return values;
        };
        try{await assert.rejects(commit(f,a),error=>error.code==="22P02");}
        finally{transformNextCoreParameters=null;}
        empty(await state(f));await replayDenied(f,a);
      });
    }

    // R7: execute the actual GET/auth/relation SELECTs against isolated rows.
    // Session/PIN/capability values and all SQL/rows stay in RAM, not the report.
    async function allCoreState() {
      const rows = {};
      for (const table of CORE_TABLES) rows[table] = (await admin.query(`SELECT to_jsonb(row) AS row FROM ${s}.${table} row ORDER BY to_jsonb(row)::text`)).rows;
      return rows;
    }
    async function seedRecordedAttempt(f, status, coordinates = {}) {
      const record = { tenantId: f.tenantId, consumerId: f.consumerId, eventId: f.eventId,
        batchId: f.batchId, tagId: f.tagId, ...coordinates };
      const inserted = (await admin.query(`INSERT INTO ${s}.consumer_product_ownerships(tenant_id,consumer_id,batch_id,tag_id,uid_hex,event_id,status,source)
        VALUES($1,$2,$3,$4,$5,$6,$7,'sun_passport') RETURNING id`,
      [record.tenantId,record.consumerId,record.batchId,record.tagId,f.uid,record.eventId,status])).rows;
      assert.equal(inserted.length,1);
      const stored = (await admin.query(`SELECT tenant_id,consumer_id,event_id::text AS event_id,status FROM ${s}.consumer_product_ownerships WHERE id=$1`,[inserted[0].id])).rows;
      assert.deepEqual(stored,[{tenant_id:record.tenantId,consumer_id:record.consumerId,event_id:record.eventId,status}]);
    }
    async function inspectRecordedAttempt(f, { exists, reason = null, claimed = false }) {
      const session = randomBytes(24).toString("hex");
      await admin.query(`INSERT INTO ${s}.consumer_sessions(session_token_hash,consumer_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour')`,[hash(session),f.consumerId]);
      const now = Math.floor(Date.now()/1000);
      const capability = fresh.createSunFreshHandoffToken({bid:f.bid,eventId:f.eventId,uidHex:f.uid,readCounter:Number(f.event.sdm_read_ctr),
        diagnosticId:980999,traceId:randomUUID(),iat:now-1,exp:now+299});
      const req = new Request(`https://synthetic.invalid/consumer/tap-eligibility?eventId=${f.eventId}`,{headers:{
        cookie:`nexid_consumer_session=${session}`,"x-nexid-consumer-tap-capability":capability}});
      const before = await allCoreState(), executions = coreExecutions, mutations = executorMutations;
      const relationStart = relationObservations.length;
      const buckets = (await admin.query(`SELECT to_jsonb(bucket) AS row FROM ${s}.sun_rate_limit_buckets bucket ORDER BY scope,scope_key_hash`)).rows;
      const response = await current.run(first,()=>getEligibility(req)), body = await response.json();
      assert.equal(response.status,200); assert.equal(body.schema,"nexid.consumer-tap-eligibility/v1"); assert.equal(body.eventId,f.eventId);
      assert.match(response.headers.get("cache-control"),/private, no-store/); assert.equal(response.headers.get("set-cookie"),null);
      for (const action of ["save","join","rewards"]) assert.deepEqual(body.actions[action],{allowed:true,reason:"allowed",freshTapRequired:false});
      const decision = await precheck(f);
      if (reason) {
        assert.deepEqual(body.actions.claim,{allowed:false,reason,freshTapRequired:false,nextStep:"blocked"});
        assert.deepEqual(decision,{ok:false,error:reason}); assert.equal(decision.context,undefined);
        // A blocked precheck supplies no context to either caller. Presenting a
        // correct synthetic PIN plus an unissued object cannot create a proof.
        for (const scope of ["consumer_claim_ownership","public_claim_ownership"]) {
          const denied = await current.run(first,()=>policy.consumeAndAuthorizeConsumerOwnershipClaim(req,
            {fresh_token:capability,pin},Object.freeze({}),scope));
          assert.deepEqual(denied,{ok:false,status:403,error:"claim_context_required",freshTapRequired:false});
          assert.equal(denied.authorization,undefined);
        }
      } else {
        assert.deepEqual(body.actions.claim,{allowed:true,reason:"allowed",freshTapRequired:false,nextStep:"enter_pin"});
        assert.equal(decision.ok,true); assert.equal(decision.context.nextStep,"enter_pin");
        // Advisory allow is not a title. Do not consume, authorize or commit.
      }
      const observations = relationObservations.slice(relationStart);
      assert.equal(observations.length,2,"Both actual GET and context SELECTs must execute");
      for (const row of observations) { assert.equal(row.recordExists,exists); assert.equal(row.ownershipClaimed,claimed); }
      assert.equal(executorMutations,mutations,"No consume, PIN budget or business mutation may execute");
      assert.equal(coreExecutions,executions,"No title CTE may execute on a precheck");
      assert.deepEqual(await allCoreState(),before,"All four tables, including other scopes, must remain unchanged");
      assert.deepEqual((await admin.query(`SELECT to_jsonb(bucket) AS row FROM ${s}.sun_rate_limit_buckets bucket ORDER BY scope,scope_key_hash`)).rows,buckets);
      assert.doesNotMatch(JSON.stringify(body),/claim_record_exists|ownership_status|ownership_confirmed|session_token_hash|consumer_id|tenant_id/);
    }

    if (catalogue === "core") {
    // Thirteen new real-PG cases. These are not the boolean mocks in the focal suite.
    for (const status of ["revoked","disputed","blocked_replay"]) await check(`record_exact_${status}_GET_context_denied_before_issuer`,async()=>{
      const f = await fixture(); await seedRecordedAttempt(f,status);
      await inspectRecordedAttempt(f,{exists:true,reason:"tap_action_not_allowed"});
    });
    for (const status of ["revoked","disputed","blocked_replay"]) for (const dimension of ["tenant","consumer","event"]) await check(`record_other_${dimension}_${status}_GET_context_unchanged_allow`,async()=>{
      const f = await fixture(); let coordinates;
      if (dimension === "tenant") {
        const alternate = await fixture();
        // A deliberately inconsistent historical record passes the schema's
        // individual FKs. The exact tenant predicate must not read its title
        // into this tenant. The global consumer/event UNIQUE could still reject
        // a later commit, so this case stops at advisory GET/context allow.
        coordinates = {tenantId:alternate.tenantId,batchId:alternate.batchId,tagId:alternate.tagId};
      } else if (dimension === "consumer") {
        const consumerId = randomUUID(); await admin.query(`INSERT INTO ${s}.consumers(id) VALUES($1)`,[consumerId]);
        coordinates = {consumerId};
      } else {
        const eventId = String(++eventSequence);
        await admin.query(`INSERT INTO ${s}.events SELECT * FROM jsonb_populate_record(NULL::${s}.events,$1::jsonb)`,[JSON.stringify({...f.event,id:eventId})]);
        coordinates = {eventId};
      }
      await seedRecordedAttempt(f,status,coordinates);
      await inspectRecordedAttempt(f,{exists:false});
    });
    await check("record_claimed_reason_priority_GET_context_before_issuer",async()=>{
      const f = await fixture(); await seedRecordedAttempt(f,"claimed");
      await inspectRecordedAttempt(f,{exists:true,claimed:true,reason:"ownership_already_claimed"});
    });

    for(const result of ["VALID_CLOSED","VALID_OPENED","VALID_OPENED_PREVIOUSLY"]) await check(`${result}_inside_pack_core_four_effects`,async()=>{
      const f=await fixture(result),a=await authorize(f); assert.equal(a.result.ok,true); assert.equal((await commit(f,a)).ok,true);
      const rows=await state(f); assert.deepEqual(CORE_TABLES.map(t=>rows[t].length),[1,1,1,1]); await replayDenied(f,a);
    });
    await check("existing_product_update_branch",async()=>{
      const f=await fixture(); await admin.query(`INSERT INTO ${s}.consumer_products(consumer_id,tenant_id,product_passport_id,tag_id,ownership_status) VALUES($1,$2,$3,$4,'viewed')`,[f.consumerId,f.tenantId,f.uid,f.tagId]);
      const a=await authorize(f); assert.equal((await commit(f,a)).ok,true); const rows=await state(f);
      assert.deepEqual(CORE_TABLES.map(t=>rows[t].length),[1,1,1,1]); assert.equal(rows.consumer_products[0].row.ownership_status,"claimed");
    });
    for(const table of CORE_TABLES) await check(`${table}_error_rolls_back_all_core_rows`,async()=>{
      const f=await fixture(),a=await authorize(f),before=await state(f); await first.query("SELECT set_config('nexid.claim_fail_table',$1,false)",[table]);
      try{await assert.rejects(commit(f,a),error=>error.code==="23514");}finally{await first.query("SELECT set_config('nexid.claim_fail_table','',false)");}
      assert.deepEqual(await state(f),before); await replayDenied(f,a);
    });
    await check("product_update_error_preserves_existing_row_and_no_other_effects",async()=>{
      const f=await fixture(); await admin.query(`INSERT INTO ${s}.consumer_products(consumer_id,tenant_id,product_passport_id,tag_id,ownership_status) VALUES($1,$2,$3,$4,'viewed')`,[f.consumerId,f.tenantId,f.uid,f.tagId]);
      const a=await authorize(f),before=await state(f); await first.query("SELECT set_config('nexid.claim_fail_table','consumer_products',false)");
      try{await assert.rejects(commit(f,a),error=>error.code==="23514");}finally{await first.query("SELECT set_config('nexid.claim_fail_table','',false)");} assert.deepEqual(await state(f),before);
    });
    for(const table of ["tenant_consumer_memberships","consumer_products"]) await check(`${table}_suppressed_row_hits_core_fence_and_rolls_back`,async()=>{
      const f=await fixture(),a=await authorize(f); await first.query("SELECT set_config('nexid.claim_skip_table',$1,false)",[table]);
      try{await assert.rejects(commit(f,a),error=>error.code==="22012");}finally{await first.query("SELECT set_config('nexid.claim_skip_table','',false)");} empty(await state(f));
    });
    await check("profile_withdrawal_race",async()=>{const f=await fixture();await race(f,"profile",()=>admin.query(`UPDATE ${s}.tenant_sun_profiles SET vertical='pharma' WHERE tenant_id=$1`,[f.tenantId]));});
    await check("tag_revocation_race",async()=>{const f=await fixture();await race(f,"tag",()=>admin.query(`UPDATE ${s}.tags SET lifecycle_state='revoked' WHERE id=$1`,[f.tagId]));});
    await check("real_manual_noop_tag_fence_race",async()=>{const f=await fixture();await race(f,"manual",async()=>assert.equal(await current.run(admin,()=>markTagManuallyOpened({batchId:f.batchId,tenantId:f.tenantId,uidHex:f.uid,reason:"synthetic_open",evidenceNote:"synthetic fixture",source:"admin"})),true));});
    await check("membership_block_race_has_no_partial_title",async()=>{
      const f=await fixture(); await admin.query(`INSERT INTO ${s}.tenant_consumer_memberships(tenant_id,consumer_id,status) VALUES($1,$2,'active')`,[f.tenantId,f.consumerId]);
      await race(f,"membership",()=>admin.query(`UPDATE ${s}.tenant_consumer_memberships SET status='blocked' WHERE tenant_id=$1 AND consumer_id=$2`,[f.tenantId,f.consumerId]));
    });
    await check("required_pos_revocation_race",async()=>{const f=await fixture("VALID_CLOSED",{posRequired:true});await race(f,"pos",()=>admin.query(`UPDATE ${s}.sdk_pos_activations SET activation_status='revoked' WHERE tenant_id=$1`,[f.tenantId]));});
    await check("persisted_counter_changed_between_issuer_and_core",async()=>{const f=await fixture(),a=await authorize(f);await admin.query(`UPDATE ${s}.events SET sdm_read_ctr=sdm_read_ctr+1 WHERE id=$1`,[f.eventId]);await deniedCore(commit(f,a));empty(await state(f));});
    await check("capability_expires_while_core_waits_on_tag_lock",async()=>{const f=await fixture();await race(f,"expiry",()=>admin.query(`SELECT id FROM ${s}.tags WHERE id=$1 FOR UPDATE`,[f.tagId]),{ttl:3,waitExpiry:true});});
    await check("required_pos_expires_after_precheck",async()=>{
      const f=await fixture("VALID_CLOSED",{posRequired:true}); await admin.query(`UPDATE ${s}.sdk_pos_activations SET expires_at=clock_timestamp()+interval '3 seconds' WHERE tenant_id=$1`,[f.tenantId]);
      const a=await authorize(f);assert.equal(a.result.ok,true);const exp=Number((await admin.query(`SELECT extract(epoch FROM expires_at) AS exp FROM ${s}.sdk_pos_activations WHERE tenant_id=$1`,[f.tenantId])).rows[0].exp);
      await waitPast(exp); await deniedCore(commit(f,a)); empty(await state(f));
    });
    for(const claimedBySameConsumer of [true,false])await check(`${claimedBySameConsumer?"own":"foreign"}_existing_title_denies_before_consume`,async()=>{
      const f=await fixture(),owner=claimedBySameConsumer?f.consumerId:randomUUID();if(!claimedBySameConsumer)await admin.query(`INSERT INTO ${s}.consumers(id) VALUES($1)`,[owner]);
      await admin.query(`INSERT INTO ${s}.consumer_product_ownerships(tenant_id,consumer_id,batch_id,tag_id,uid_hex,event_id,status,source) VALUES($1,$2,$3,$4,$5,$6,'claimed','sun_passport')`,[f.tenantId,owner,f.batchId,f.tagId,f.uid,f.eventId]);
      const before=await state(f),buckets=(await admin.query(`SELECT count(*)::integer AS n FROM ${s}.sun_rate_limit_buckets`)).rows[0].n;
      assert.equal((await precheck(f)).error,"ownership_already_claimed");assert.deepEqual(await state(f),before);assert.equal((await admin.query(`SELECT count(*)::integer AS n FROM ${s}.sun_rate_limit_buckets`)).rows[0].n,buckets);
    });
    await check("missing_pin_then_same_capability_with_real_pin",async()=>{
      const f=await fixture(),beforeBuckets=(await admin.query(`SELECT count(*)::integer AS n FROM ${s}.sun_rate_limit_buckets`)).rows[0].n;
      const a=await authorize(f,{presentPin:false});assert.equal(a.result.error,"pin_required");assert.equal(a.result.freshTapRequired,false);
      assert.equal((await admin.query(`SELECT count(*)::integer AS n FROM ${s}.sun_rate_limit_buckets`)).rows[0].n,beforeBuckets);
      empty(await state(f));
      a.result=await current.run(first,()=>policy.consumeAndAuthorizeConsumerOwnershipClaim(a.req,{fresh_token:a.capability,pin},a.context,"consumer_claim_ownership"));
      assert.equal(a.result.ok,true);assert.equal((await commit(f,a)).ok,true);const rows=await state(f);assert.deepEqual(CORE_TABLES.map(t=>rows[t].length),[1,1,1,1]);
    });
    await check("wrong_pin_spends_capability_without_core",async()=>{
      const f=await fixture(),a=await authorize(f,{suppliedPin:"incorrect-synthetic"});assert.equal(a.result.error,"invalid_pin");assert.equal(a.result.freshTapRequired,true);
      const repeated=await current.run(first,()=>policy.consumeAndAuthorizeConsumerOwnershipClaim(a.req,{fresh_token:a.capability,pin},a.context,"consumer_claim_ownership"));assert.equal(repeated.ok,false);assert.equal(repeated.freshTapRequired,true);empty(await state(f));
    });
    await check("real_durable_pin_lock_900_keeps_capability_spent",async()=>{
      const f=await fixture();for(let i=0;i<5;i++){const wrong=await authorize(f,{suppliedPin:"incorrect-synthetic"});assert.equal(wrong.result.error,"invalid_pin");}
      const a=await authorize(f);assert.equal(a.result.status,429);assert.equal(a.result.error,"claim_pin_locked");assert.equal(a.result.retryAfterSeconds,900);assert.equal(a.result.freshTapRequired,true);assert.equal(a.result.authorization,undefined);
      const before=(await admin.query(`SELECT to_jsonb(bucket) AS row FROM ${s}.sun_rate_limit_buckets bucket WHERE scope IN('claim_pin_device','claim_pin_product') ORDER BY scope,scope_key_hash`)).rows;
      const repeated=await current.run(first,()=>policy.consumeAndAuthorizeConsumerOwnershipClaim(a.req,{fresh_token:a.capability,pin},a.context,"consumer_claim_ownership"));assert.equal(repeated.ok,false);assert.equal(repeated.freshTapRequired,true);
      assert.deepEqual((await admin.query(`SELECT to_jsonb(bucket) AS row FROM ${s}.sun_rate_limit_buckets bucket WHERE scope IN('claim_pin_device','claim_pin_product') ORDER BY scope,scope_key_hash`)).rows,before);empty(await state(f));
    });
    await check("persisted_null_counter_denies_before_consumption",async()=>{
      const f=await fixture(),buckets=(await admin.query(`SELECT count(*)::integer AS n FROM ${s}.sun_rate_limit_buckets`)).rows[0].n;
      await admin.query(`UPDATE ${s}.events SET sdm_read_ctr=NULL WHERE id=$1`,[f.eventId]);assert.equal((await precheck(f)).error,"tap_policy_indeterminate");empty(await state(f));
      assert.equal((await admin.query(`SELECT count(*)::integer AS n FROM ${s}.sun_rate_limit_buckets`)).rows[0].n,buckets);
    });
    await check("unissued_authorization_cannot_enter_core",async()=>{
      const f=await fixture(),before=coreExecutions;const result=await current.run(first,()=>policy.commitConsumerOwnershipClaim({consumerId:f.consumerId,eventId:f.eventId,authorization:{kind:"consumer-ownership-claim"},trustSnapshot:{pinValidated:true,posValidated:true}}));assert.equal(result.error,"claim_context_required");assert.equal(coreExecutions,before);empty(await state(f));
    });
    await check("concurrent_same_uid_claims_keep_one_complete_owner",async()=>{
      const f=await fixture(),other={...f,consumerId:randomUUID(),eventId:String(++eventSequence),event:{...f.event,id:String(eventSequence),sdm_read_ctr:2}};
      await admin.query(`INSERT INTO ${s}.consumers(id) VALUES($1)`,[other.consumerId]);await admin.query(`INSERT INTO ${s}.events SELECT * FROM jsonb_populate_record(NULL::${s}.events,$1::jsonb)`,[JSON.stringify(other.event)]);
      const a=await authorize(f),b=await authorize(other,{client:second});assert.equal(a.result.ok,true);assert.equal(b.result.ok,true);
      await first.query("SELECT set_config('nexid.claim_barrier','yes',false)");await admin.query("BEGIN");await admin.query("SELECT pg_advisory_xact_lock($1::bigint)",[barrier]);let one,two,failure;
      try{one=commit(f,a);one.catch(()=>{});await waitLocked("concurrent-product",pids[1]);two=commit(other,b);two.catch(()=>{});await waitLocked("concurrent-unique",pids[2],pids[1]);}catch(error){failure=error;}finally{await admin.query("ROLLBACK");}
      const outcomes=await Promise.allSettled([one,two].filter(Boolean));await first.query("SELECT set_config('nexid.claim_barrier','',false)");if(failure)throw failure;
      assert.equal(outcomes.length,2);assert.equal(outcomes.filter(row=>row.status==="fulfilled"&&row.value.ok).length,1);
      const loser=outcomes.find(row=>row.status==="rejected"||!row.value.ok);
      if(loser.status==="rejected")assert.equal(loser.reason.code,"40001");else assert.ok(["ownership_already_claimed","claim_policy_changed"].includes(loser.value.error));
      const rows=await state(f);assert.deepEqual(CORE_TABLES.map(t=>rows[t].length),[1,1,1,1]);
      const owner=rows.consumer_product_ownerships[0].row.consumer_id;for(const table of CORE_TABLES)assert.equal(rows[table][0].row.consumer_id,owner);
    });
    assert.equal(report.checks.length,40);assert.equal(report.lockObservations.length,8);
    } else {
      await runLegacyEquivalence();
      assert.equal(report.checks.length,51);assert.equal(report.lockObservations.length,4);
    }
    assert.ok(report.checks.every(check=>check.passed));
    for(const file of CONSUMER_OWNERSHIP_CLAIM_SOURCE_PATHS)assert.equal(hash(await readFile(path.join(apiRoot,file))),sourcePins.find(row=>row.file===`apps/api/${file}`).sha256,"Candidate source changed during PostgreSQL");
    report.sourcePinsVerified=true;
    report.ok=true;
  } finally {
    removeExecutor?.();
    try{if(created){for(const client of clients)await client.query("ROLLBACK").catch(()=>{});await clients[0].query(`DROP SCHEMA ${s} CASCADE`);report.cleanup.schemaDropped=true;}}
    finally{try{await Promise.all([...new Set(clients)].map(client=>client.end()));report.cleanup.connectionsClosed=true;}finally{for(const [key,prior]of priorEnv){if(prior.present)process.env[key]=prior.value;else delete process.env[key];}report.cleanup.syntheticEnvironmentRestored=true;}}
  }
  return report;
}
