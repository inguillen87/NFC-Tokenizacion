import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

const OWN_SCHEMA = /^loyalty_current_qa_[0-9a-f]{32}$/;
const QA_DATABASE = /^nexid_e2e(?:_[a-z0-9][a-z0-9_-]{0,48})?$/;

// Importing this helper performs no I/O. Only an explicit, already-connected
// loopback QA factory can execute it; every table belongs to one random schema.
export async function runLoyaltyCurrentStatePostgresQa({ connect } = {}) {
  assert.equal(typeof connect, "function", "An explicit disposable QA connection factory is required");
  const schema = `loyalty_current_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, OWN_SCHEMA);
  const s = `"${schema}"`;
  const clients = [];
  const report = { kind: "synthetic-postgresql-loyalty-current-state", ok: false, schema, checks: [], lockObservations: [], statements: [], compatibilitySeedsSkipped: 0, cleanup: { schemaDropped: false, connectionsClosed: false }, limits: ["Synthetic minimal fixture schema, not production migrations or customer data", "Fixture schema_migrations rows satisfy the runtime compatibility guard only; they do not certify migrations applied", "Existing Balmec marketplace compatibility seeds are skipped by their caller stack; no business sink query is skipped", "No provider, external database, NFC, OTP or customer request is exercised"] };
  let schemaCreated = false;
  let removeExecutor;
  const executionClient = new AsyncLocalStorage();
  let nextEvent = 900001;
  try {
    let database;
    const pids = [];
    for (let i = 0; i < 3; i += 1) {
      const client = await connect();
      clients.push(client);
      assert.ok(typeof client?.query === "function" && typeof client?.end === "function");
      assert.equal(clients.filter(c => c === client).length, 1);
      const { rows: [identity] } = await client.query("SELECT current_database() AS database, pg_backend_pid() AS pid, host(inet_server_addr()) AS address");
      assert.match(identity.database, QA_DATABASE);
      assert.ok(["127.0.0.1", "::1"].includes(identity.address), "Refusing a non-loopback PostgreSQL server");
      database ??= identity.database;
      assert.equal(identity.database, database);
      assert.ok(!pids.includes(identity.pid));
      pids.push(identity.pid);
    }
    const [admin, writer, observer] = clients;
    const db = await import("../../src/lib/db.ts");
    const loyalty = await import("../../src/lib/loyalty-service.ts");
    const trivia = await import("../../src/lib/trivia-service.ts");
    await admin.query(`CREATE SCHEMA ${s}`);
    schemaCreated = true;
    for (const client of clients) {
      await client.query(`SET search_path TO ${s}, pg_catalog`);
      await client.query("SELECT set_config('statement_timeout','12000',false), set_config('lock_timeout','10000',false)");
      assert.equal((await client.query("SELECT current_schema() AS schema")).rows[0].schema, schema);
    }
    await admin.query(`
      CREATE TYPE ${s}.tag_status AS ENUM ('inactive','active','revoked');
      CREATE TYPE ${s}.loyalty_member_status AS ENUM ('anonymous','enrolled','verified','blocked','deleted');
      CREATE TYPE ${s}.points_source AS ENUM ('TAP_VALID','PROVENANCE_VIEWED','OWNERSHIP_ACTIVATED','WARRANTY_REGISTERED','QUIZ_COMPLETED','EXPERIENCE_ATTENDED','REFERRAL_SIGNUP','REWARD_REDEEMED','ADMIN_ADJUSTMENT','FRAUD_REVERSAL','EXPIRATION');
      CREATE TABLE ${s}.schema_migrations(id text PRIMARY KEY);
      CREATE TABLE ${s}.tenants(id uuid PRIMARY KEY, slug text, name text);
      CREATE TABLE ${s}.consumers(id uuid PRIMARY KEY);
      CREATE TABLE ${s}.batches(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id), bid text);
      CREATE TABLE ${s}.tags(id uuid PRIMARY KEY, batch_id uuid NOT NULL REFERENCES ${s}.batches(id), uid_hex text NOT NULL, status ${s}.tag_status, lifecycle_state text, created_at timestamptz DEFAULT now(), UNIQUE(batch_id,uid_hex));
      CREATE TABLE ${s}.events(id bigint PRIMARY KEY, tenant_id uuid REFERENCES ${s}.tenants(id), batch_id uuid REFERENCES ${s}.batches(id), uid_hex text, sdm_read_ctr integer DEFAULT 1, result text, reason text, created_at timestamptz DEFAULT now(), city text, country_code text, geo_lat double precision, geo_lng double precision);
      CREATE TABLE ${s}.tag_manual_tamper_overrides(batch_id uuid, uid_hex text, tamper_status text, reason text, source text, updated_at timestamptz DEFAULT now(), PRIMARY KEY(batch_id,uid_hex));
      CREATE TABLE ${s}.loyalty_programs(id uuid PRIMARY KEY, tenant_id uuid REFERENCES ${s}.tenants(id), name text, points_name text, status text DEFAULT 'active', start_at timestamptz DEFAULT now()-interval '1 day', end_at timestamptz, rules_json jsonb DEFAULT '{"pointsPerValidTap":10,"cooldownSeconds":0}', created_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.loyalty_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES ${s}.tenants(id), program_id uuid REFERENCES ${s}.loyalty_programs(id), event_id bigint, member_key text, consumer_id uuid, preferred_locale text, email text, phone text, display_name text, country text, status ${s}.loyalty_member_status DEFAULT 'anonymous', points_balance integer DEFAULT 0, lifetime_points integer DEFAULT 0, first_tap_at timestamptz DEFAULT now(), last_tap_at timestamptz DEFAULT now(), consent_json jsonb DEFAULT '{}', profile_json jsonb DEFAULT '{}', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(program_id,member_key));
      CREATE UNIQUE INDEX ON ${s}.loyalty_members(program_id,consumer_id) WHERE consumer_id IS NOT NULL;
      CREATE TABLE ${s}.points_ledger(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, program_id uuid, member_id uuid, tap_event_id bigint, source ${s}.points_source, delta integer, balance_after integer, idempotency_key text UNIQUE, reason text, metadata_json jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.rewards(id uuid PRIMARY KEY, tenant_id uuid, program_id uuid, code text, title text, status text DEFAULT 'active', points_cost integer DEFAULT 40, stock_remaining integer DEFAULT 2, starts_at timestamptz DEFAULT now()-interval '1 day', ends_at timestamptz, updated_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.reward_redemptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, program_id uuid, reward_id uuid, member_id uuid, status text, points_spent integer, redemption_code text UNIQUE, metadata_json jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.tag_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tag_id uuid, product_name text, winery text, region text, grape_varietal text, vintage text);
      CREATE TABLE ${s}.tenant_sun_profiles(tenant_id uuid PRIMARY KEY, vertical text);
      CREATE TABLE ${s}.loyalty_quizzes(id uuid PRIMARY KEY, tenant_id uuid, program_id uuid, code text, title text, description text, status text DEFAULT 'active', starts_at timestamptz DEFAULT now()-interval '1 day', ends_at timestamptz, questions_json jsonb, points_per_correct integer DEFAULT 10, completion_bonus integer DEFAULT 5, pass_threshold integer DEFAULT 1);
      CREATE TABLE ${s}.loyalty_quiz_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, program_id uuid, quiz_id uuid, member_id uuid, tap_event_id bigint, consumer_id uuid, score integer, total_questions integer, points_awarded integer, answers_json jsonb, status text, idempotency_key text UNIQUE, metadata_json jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.tenant_consumer_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, consumer_id uuid, loyalty_program_id uuid, source text, first_tap_event_id bigint, last_tap_event_id bigint, status text, points_balance integer DEFAULT 0, lifetime_points integer DEFAULT 0, metadata_json jsonb DEFAULT '{}', last_activity_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(tenant_id,consumer_id));
    `);
    await admin.query(`INSERT INTO ${s}.schema_migrations(id) SELECT unnest($1::text[])`, [[...db.DEFAULT_REQUIRED_SCHEMA_MIGRATIONS]]);
    removeExecutor = db.installEphemeralE2eSqlExecutor(async (strings, ...values) => {
      const text = strings.reduce((result, part, i) => result + (i ? `$${i}` : "") + part, "");
      assert.doesNotMatch(text, /\bpublic\s*\./i);
      const activeClient = executionClient.getStore() || writer;
      const descriptor = { text, parameters: values, backendPid: pids[clients.indexOf(activeClient)] };
      report.statements.push(descriptor);
      if (/commercial-runtime-schema\.[cm]?[jt]s/.test(new Error().stack || "")) {
        descriptor.compatibilitySeedSkipped = true;
        report.compatibilitySeedsSkipped += 1;
        return [];
      }
      try { const rows = (await activeClient.query(text, values)).rows; descriptor.returnedRows = rows.length; return rows; }
      catch(error) { descriptor.error = { code: error.code, message: error.message }; throw error; }
    }, { NODE_ENV:"test", VERCEL_ENV:"test", NEXID_E2E_CONFIRMATION:"I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE", NEXID_E2E_DATABASE_URL:"postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e" }, { migrationManaged: true });

    async function fixture(options={}) {
      const f = Object.fromEntries(["tenantId","otherTenantId","programId","consumerId","memberId","batchId","tagId","rewardId","quizId"].map(k=>[k,randomUUID()]));
      Object.assign(f,{eventId:String(nextEvent++),uid:"04AABBCCDD"+String(nextEvent),memberKey:`consumer:${f.consumerId}:tenant:${f.tenantId}:program:${f.programId}`});
      await admin.query(`INSERT INTO ${s}.tenants VALUES ($1,'qa-brand','QA Bodega'),($2,'qa-other','Other synthetic tenant')`,[f.tenantId,f.otherTenantId]);
      await admin.query(`INSERT INTO ${s}.consumers VALUES ($1)`,[f.consumerId]);
      await admin.query(`INSERT INTO ${s}.batches VALUES ($1,$2,'qa-batch')`,[f.batchId,options.wrongTenant?f.otherTenantId:f.tenantId]);
      await admin.query(`INSERT INTO ${s}.tags(id,batch_id,uid_hex,status,lifecycle_state) VALUES ($1,$2,$3,$4,$5)`,[f.tagId,f.batchId,f.uid,options.tagStatus??"active",options.lifecycle===undefined?"active":options.lifecycle]);
      await admin.query(`INSERT INTO ${s}.events(id,tenant_id,batch_id,uid_hex,result,reason,city,country_code) VALUES ($1,$2,$3,$4,$5,$6,'QA City','AR')`,[f.eventId,f.tenantId,f.batchId,f.uid,options.result??"VALID_CLOSED",options.reason??null]);
      await admin.query(`INSERT INTO ${s}.loyalty_programs(id,tenant_id,name,points_name) VALUES ($1,$2,'Synthetic configured club','Points')`,[f.programId,f.tenantId]);
      if(!options.noMember) await admin.query(`INSERT INTO ${s}.loyalty_members(id,tenant_id,program_id,member_key,consumer_id,status,points_balance,lifetime_points) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,[f.memberId,f.tenantId,f.programId,f.memberKey,f.consumerId,options.memberStatus??"enrolled",options.points??100]);
      await admin.query(`INSERT INTO ${s}.rewards(id,tenant_id,program_id,code,title) VALUES ($1,$2,$3,'qa-reward','Synthetic reward')`,[f.rewardId,f.tenantId,f.programId]);
      await admin.query(`INSERT INTO ${s}.tag_profiles(tag_id,product_name,winery,region) VALUES ($1,'Synthetic product','QA Bodega','QA Region')`,[f.tagId]);
      await admin.query(`INSERT INTO ${s}.tenant_sun_profiles VALUES ($1,'wine')`,[f.tenantId]);
      const code=`posttap-wine-${createHash("sha256").update(`${f.programId}:Synthetic product:QA Bodega:QA Region`).digest("base64url").slice(0,10).toLowerCase()}`;
      await admin.query(`INSERT INTO ${s}.loyalty_quizzes(id,tenant_id,program_id,code,title,description,questions_json) VALUES ($1,$2,$3,$4,'Synthetic quiz','Configured fixture',$5::jsonb)`,[f.quizId,f.tenantId,f.programId,code,JSON.stringify([{id:"q1",prompt:"Synthetic choice",options:["Correct","Other"],correctIndex:0,explanation:"Synthetic explanation",insightTag:"fixture"}])]);
      return f;
    }
    function award(f, overrides={}) { return loyalty.awardPoints({tenantId:f.tenantId,programId:f.programId,memberId:f.memberId,tapEventId:f.eventId,delta:10,source:"TAP_VALID",idempotencyKey:`tap:${f.eventId}:member:${f.memberId}`,...overrides}); }
    function enroll(f) { return loyalty.getOrCreateMember({tenantId:f.tenantId,programId:f.programId,eventId:f.eventId,memberKey:f.memberKey,consumerId:f.consumerId}); }
    function redeem(f) { return loyalty.redeemReward({eventId:f.eventId,memberId:f.memberId,rewardId:f.rewardId}); }
    function submit(f) { return trivia.submitTriviaForTap({eventId:f.eventId,memberKey:f.memberKey,consumerId:f.consumerId,answers:[0]}); }
    async function state(f) {
      const tables=["loyalty_members","points_ledger","rewards","reward_redemptions","loyalty_quiz_attempts","tenant_consumer_memberships"];
      const current={};
      for(const table of tables) current[table]=(await observer.query(`SELECT * FROM ${s}."${table}" WHERE tenant_id=$1 ORDER BY id`,[f.tenantId])).rows;
      return current;
    }
    async function check(name, execute) { try { const evidence=await execute(); report.checks.push({name,ok:true,...(evidence?{evidence}:{})}); } catch(error) { report.checks.push({name,ok:false,error:error.message,...(error.code?{code:error.code}:{})}); } }
    async function unchanged(f, operation) { const before=await state(f); const result=await operation(); assert.deepEqual(await state(f),before,"Rejected operation must leave all balances, ledger, stock, attempts and projections unchanged"); return result; }
    async function revokeWhileWaiting(f, operation) {
      await admin.query("BEGIN");
      let pending;
      try {
        await admin.query(`UPDATE ${s}.tags SET status='revoked',lifecycle_state='revoked' WHERE id=$1`,[f.tagId]);
        pending=Promise.resolve().then(operation).then(value=>({value}),error=>({error}));
        let observation;
        const deadline=Date.now()+6000;
        while(Date.now()<deadline) {
          const {rows}=await observer.query("SELECT pid,wait_event_type,wait_event,query FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'",[pids[1]]);
          if(rows[0]) { observation=rows[0]; break; }
          await new Promise(resolve=>setTimeout(resolve,20));
        }
        assert.ok(observation,"The production writer must actually overlap and wait for the current tag revocation lock");
        assert.match(observation.query,/WITH current_tag AS MATERIALIZED/);
        report.lockObservations.push({eventId:f.eventId,...observation});
        await admin.query("COMMIT");
      } catch(error) { await admin.query("ROLLBACK"); if(pending) await pending; throw error; }
      const result=await pending;
      if(result.error) throw result.error;
      return result.value;
    }
    async function concurrentOnMember(f, operation) {
      await admin.query("BEGIN");
      let pending;
      try {
        await admin.query(`SELECT id FROM ${s}.loyalty_members WHERE id=$1 FOR UPDATE`,[f.memberId]);
        pending=Promise.allSettled([writer,observer].map(client=>executionClient.run(client,()=>operation(f))));
        let observations;
        const deadline=Date.now()+6000;
        while(Date.now()<deadline) {
          await admin.query("SELECT pg_stat_clear_snapshot()");
          const {rows}=await admin.query("SELECT pid,wait_event_type,wait_event,query FROM pg_stat_activity WHERE pid=ANY($1::integer[]) AND wait_event_type='Lock'",[pids.slice(1)]);
          if(rows.length===2) { observations=rows; break; }
          await new Promise(resolve=>setTimeout(resolve,20));
        }
        assert.equal(observations?.length,2,"Both real PostgreSQL backends must overlap while waiting for the member lock");
        report.lockObservations.push({eventId:f.eventId,kind:"two-independent-writers",backends:observations});
      } finally { await admin.query("ROLLBACK"); }
      const results=await pending;
      for(const row of results) if(row.status==="rejected") throw row.reason;
      return results.map(row=>row.value);
    }

    for(const status of ["revoked","inactive"]) await check(`${status}: historical event remains readable, all TAP writes deny`,async()=>{
      const f=await fixture({tagStatus:status,lifecycle:status});
      assert.ok(await loyalty.getTapEvent(f.eventId));
      await unchanged(f,()=>enroll(f)); await unchanged(f,()=>award(f)); await unchanged(f,()=>redeem(f)); await unchanged(f,()=>submit(f));
    });
    for(const memberStatus of ["blocked","deleted"]) await check(`${memberStatus}: explicit claim cannot restore status or award, repeated denial is idempotent`,async()=>{
      const f=await fixture({memberStatus});
      for(let i=0;i<2;i++) { const result=await unchanged(f,()=>loyalty.claimTapPoints({eventId:f.eventId,memberKey:f.memberKey,consumerId:f.consumerId})); assert.equal(result.status,403); assert.equal(result.error,"event_security_blocked"); }
      await unchanged(f,()=>award(f)); await unchanged(f,()=>redeem(f)); await unchanged(f,()=>submit(f));
    });
    for(const options of [{wrongTenant:true},{result:"UNKNOWN_NEW_RESULT"},{result:"OPENED"},{reason:"OPERATOR_DECLARED_OPEN"},{lifecycle:"quarantined"},{lifecycle:"unknown"}]) await check(`invalid binding/state ${JSON.stringify(options)}: no business writes`,async()=>{
      const f=await fixture(options); await unchanged(f,()=>enroll(f)); await unchanged(f,()=>award(f)); await unchanged(f,()=>redeem(f)); await unchanged(f,()=>submit(f));
    });
    await check("manual override after verified hardware tap: zero business effects",async()=>{
      const f=await fixture({result:"VALID_OPENED"});
      await admin.query(`INSERT INTO ${s}.tag_manual_tamper_overrides(batch_id,uid_hex,tamper_status,reason) VALUES ($1,$2,'MANUAL_OPENED','MANUAL_TAMPER_OPENED')`,[f.batchId,f.uid]);
      await unchanged(f,()=>enroll(f)); await unchanged(f,()=>award(f)); await unchanged(f,()=>redeem(f)); await unchanged(f,()=>submit(f));
    });
    await check("missing current tag: historical evidence visible, zero business effects",async()=>{ const f=await fixture(); await admin.query(`DELETE FROM ${s}.tags WHERE id=$1`,[f.tagId]); assert.ok(await loyalty.getTapEvent(f.eventId)); await unchanged(f,()=>enroll(f)); await unchanged(f,()=>award(f)); });
    await check("ambiguous case-insensitive tag identity: zero business effects",async()=>{ const f=await fixture(); await admin.query(`INSERT INTO ${s}.tags(id,batch_id,uid_hex,status,lifecycle_state) VALUES ($1,$2,lower($3),'active','active')`,[randomUUID(),f.batchId,f.uid]); await unchanged(f,()=>enroll(f)); await unchanged(f,()=>award(f)); });
    for(const uid of ["","   "]) await check(`empty UID ${JSON.stringify(uid)}: current writer identity gate fails closed`,async()=>{const f=await fixture(); await admin.query(`UPDATE ${s}.tags SET uid_hex=$1 WHERE id=$2`,[uid,f.tagId]);await admin.query(`UPDATE ${s}.events SET uid_hex=$1 WHERE id=$2`,[uid,f.eventId]);await unchanged(f,()=>enroll(f));await unchanged(f,()=>award(f));});
    for(const reason of ["operator-declared-open","manual tamper opened"]) await check(`normalized manual reason ${reason}: direct SQL award gate preserves manual denial`,async()=>{const f=await fixture({reason});await unchanged(f,()=>enroll(f));await unchanged(f,()=>award(f));});
    for(const [name,operation] of [["enroll",enroll],["award",award],["redeem",redeem],["trivia",submit]]) await check(`concurrent committed tag revocation before ${name}: PostgreSQL lock observed, zero business effects`,async()=>{
      const f=await fixture(); const before=await state(f); const result=await revokeWhileWaiting(f,()=>operation(f)); assert.deepEqual(await state(f),before); return {result,lockObserved:true};
    });
    for(const result of ["VALID_CLOSED","VALID_AUTHENTIC","VALID_OPENED","VALID_OPENED_PREVIOUSLY"]) await check(`${result}: configured genuine TAP earns once and records correct balance`,async()=>{
      const f=await fixture({result,points:0});
      const first=await award(f); assert.equal(first.awarded,true,"A legitimate configured TAP must return a successful award receipt");
      const second=await award(f); assert.equal(second.duplicate,true);
      const current=await state(f); assert.equal(current.loyalty_members[0].points_balance,10); assert.equal(current.points_ledger.length,1); assert.equal(current.points_ledger[0].balance_after,10);
      return {first,second};
    });
    await check("active legacy tag with NULL lifecycle preserves eligibility",async()=>{const f=await fixture({lifecycle:null,points:0}); assert.equal((await award(f)).awarded,true);});
    await check("genuine hardware opening: TAP redemption records receipt and spends once",async()=>{const f=await fixture({result:"VALID_OPENED"}); const first=await redeem(f); assert.equal(first.ok,true); const duplicate=await redeem(f); assert.equal(duplicate.status,409); const current=await state(f); assert.equal(current.loyalty_members[0].points_balance,60); assert.equal(current.rewards[0].stock_remaining,1); assert.equal(current.reward_redemptions.length,1); assert.equal(current.points_ledger.length,1); assert.equal(current.points_ledger[0].balance_after,60);});
    await check("genuine hardware opening: configured trivia completes once with ledger and projection",async()=>{const f=await fixture({result:"VALID_OPENED",points:0}); const first=await submit(f); assert.equal(first.ok,true,"Legitimate configured trivia must complete"); assert.equal(first.pointsAwarded,15); const second=await submit(f); assert.equal(second.duplicateAttempt,true); const current=await state(f); assert.equal(current.loyalty_members[0].points_balance,15); assert.equal(current.points_ledger.length,1); assert.equal(current.points_ledger[0].balance_after,15); assert.equal(current.loyalty_quiz_attempts[0].status,"completed"); assert.equal(current.tenant_consumer_memberships[0].points_balance,15);});
    await check("two concurrent TAP awards: one successful receipt, one duplicate, one credit",async()=>{const f=await fixture({points:0}); const results=await concurrentOnMember(f,award); assert.equal(results.filter(r=>r.awarded).length,1); assert.equal(results.filter(r=>r.duplicate).length,1); const current=await state(f); assert.equal(current.loyalty_members[0].points_balance,10); assert.equal(current.points_ledger.length,1); assert.equal(current.points_ledger[0].balance_after,10); return {results};});
    await check("two concurrent TAP redemptions: one receipt, one duplicate, one spend and stock decrement",async()=>{const f=await fixture(); const results=await concurrentOnMember(f,redeem); assert.equal(results.filter(r=>r.ok).length,1); assert.equal(results.filter(r=>r.error==="already_redeemed").length,1); const current=await state(f); assert.equal(current.loyalty_members[0].points_balance,60); assert.equal(current.points_ledger.length,1); assert.equal(current.points_ledger[0].balance_after,60); assert.equal(current.reward_redemptions.length,1); assert.equal(current.rewards[0].stock_remaining,1); return {results};});
    await check("two concurrent configured trivia submits: one completed attempt and credit",async()=>{const f=await fixture({points:0}); const results=await concurrentOnMember(f,submit); assert.ok(results.every(r=>r.ok)); assert.equal(results.filter(r=>r.duplicateAttempt).length,1); const current=await state(f); assert.equal(current.loyalty_members[0].points_balance,15); assert.equal(current.points_ledger.length,1); assert.equal(current.points_ledger[0].balance_after,15); assert.equal(current.loyalty_quiz_attempts.length,1); assert.equal(current.loyalty_quiz_attempts[0].status,"completed"); assert.equal(current.tenant_consumer_memberships.length,1); return {results};});
    await check("insufficient balance and exhausted stock: zero redemption business effects",async()=>{const poor=await fixture({points:0}); assert.equal((await unchanged(poor,()=>redeem(poor))).error,"insufficient_points"); const empty=await fixture(); await admin.query(`UPDATE ${s}.rewards SET stock_remaining=0 WHERE id=$1`,[empty.rewardId]); assert.equal((await unchanged(empty,()=>redeem(empty))).error,"out_of_stock");});
    await check("preexisting trivia ledger without attempt: fail closed with zero new effects",async()=>{const f=await fixture({points:0}); await admin.query(`INSERT INTO ${s}.points_ledger(tenant_id,program_id,member_id,tap_event_id,source,delta,balance_after,idempotency_key) VALUES ($1,$2,$3,$4,'QUIZ_COMPLETED',15,15,$5)`,[f.tenantId,f.programId,f.memberId,f.eventId,`quiz:${f.quizId}:event:${f.eventId}:member:${f.memberId}:points`]); assert.equal((await unchanged(f,()=>submit(f))).status,503);});
    await check("wrong quiz answer completes legitimate zero-point attempt without a ledger",async()=>{const f=await fixture({points:0}); const result=await trivia.submitTriviaForTap({eventId:f.eventId,memberKey:f.memberKey,consumerId:f.consumerId,answers:[1]}); assert.equal(result.ok,true); assert.equal(result.pointsAwarded,0); const current=await state(f); assert.equal(current.loyalty_members[0].points_balance,0); assert.equal(current.points_ledger.length,0); assert.equal(current.loyalty_quiz_attempts[0].status,"completed"); assert.equal(current.loyalty_quiz_attempts[0].points_awarded,0);});
    await check("revoked reading does not block existing non-TAP accounting contract",async()=>{const f=await fixture({tagStatus:"revoked",lifecycle:"revoked"}); const result=await award(f,{tapEventId:undefined,delta:-10,source:"ADMIN_ADJUSTMENT",idempotencyKey:`qa-nontap:${f.memberId}`}); assert.equal(result.awarded,true); const current=await state(f); assert.equal(current.loyalty_members[0].points_balance,90); assert.equal(current.points_ledger[0].balance_after,90);});
    await check("concurrent trivia ledger collision rolls back new attempt, credit and projection",async()=>{
      const f=await fixture({points:0}); const before=await state(f);
      let pending; let ledger;
      await admin.query("BEGIN");
      try {
        ledger=(await admin.query(`INSERT INTO ${s}.points_ledger(tenant_id,program_id,member_id,tap_event_id,source,delta,balance_after,idempotency_key) VALUES ($1,$2,$3,$4,'QUIZ_COMPLETED',15,15,$5) RETURNING *`,[f.tenantId,f.programId,f.memberId,f.eventId,`quiz:${f.quizId}:event:${f.eventId}:member:${f.memberId}:points`])).rows[0];
        pending=submit(f).then(value=>({value}),error=>({error}));
        let observation; const deadline=Date.now()+6000;
        while(Date.now()<deadline) { const {rows}=await observer.query("SELECT pid,wait_event_type,wait_event,query FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'",[pids[1]]); if(rows[0]) {observation=rows[0];break;} await new Promise(resolve=>setTimeout(resolve,20)); }
        assert.ok(observation,"The writer must wait for the uncommitted unique ledger reservation");
        // pg_stat_activity truncates query text at track_activity_query_size;
        // the captured executor statement retains the complete ledger CTE.
        assert.match(observation.query,/WITH current_tag AS MATERIALIZED/);
        assert.ok(report.statements.some(row=>row.text.includes("reserved_ledger AS MATERIALIZED") && row.parameters.includes(`quiz:${f.quizId}:event:${f.eventId}:member:${f.memberId}:points`)));
        report.lockObservations.push({eventId:f.eventId,kind:"trivia-ledger-unique-collision",...observation});
        await admin.query("COMMIT");
      } catch(error) {await admin.query("ROLLBACK");if(pending)await pending;throw error;}
      const result=await pending; if(result.error)throw result.error;
      assert.equal(result.value.status,503); assert.equal(result.value.error,"quiz_completion_unavailable");
      before.points_ledger=[ledger];
      assert.deepEqual(await state(f),before,"Only the independent synthetic colliding ledger may remain; all submission effects must roll back");
      return {response:result.value,externalFixtureLedgerRetained:true};
    });
    await check("trivia final projection SQL failure rolls back attempt, ledger and member together",async()=>{
      const f=await fixture({points:0});
      await admin.query(`CREATE FUNCTION ${s}.reject_projection() RETURNS trigger LANGUAGE plpgsql AS $fixture$ BEGIN RAISE EXCEPTION 'synthetic_projection_failure' USING ERRCODE='P0001'; END $fixture$`);
      await admin.query(`CREATE TRIGGER reject_projection BEFORE INSERT ON ${s}.tenant_consumer_memberships FOR EACH ROW EXECUTE FUNCTION ${s}.reject_projection()`);
      try {const before=await state(f); await assert.rejects(submit(f),/synthetic_projection_failure/); assert.deepEqual(await state(f),before);} finally {await admin.query(`DROP TRIGGER reject_projection ON ${s}.tenant_consumer_memberships`);await admin.query(`DROP FUNCTION ${s}.reject_projection()`);}
    });
    report.ok=report.checks.every(row=>row.ok);
  } finally {
    removeExecutor?.();
    if(schemaCreated && clients[0]) { await clients[0].query(`DROP SCHEMA ${s} CASCADE`); report.cleanup.schemaDropped=true; }
    await Promise.all(clients.map(client=>client.end()));
    report.cleanup.connectionsClosed=true;
  }
  return report;
}
