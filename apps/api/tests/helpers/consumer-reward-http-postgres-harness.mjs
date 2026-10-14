import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

const QA_DATABASE = /^(?:nexid_e2e[a-z0-9_]*|codex_qa_[a-z0-9_]+)$/;
const OWN_SCHEMA = /^consumer_reward_http_qa_[0-9a-f]{32}$/;
export const REWARD_HTTP_POSTGRES_EXPECTED = Object.freeze({ claimChecks: 29, adminChecks: 16, lockObservations: 9, wallClockExpiryObservations: 1, portalLockObservations: 6 });
function identifier(value) { assert.match(value, OWN_SCHEMA, "Only this harness generated schema may be mutated"); return '"' + value + '"'; }
function queryAdapter(client, mode = "Date", observe) {
  return async (strings, ...values) => {
    const text = strings.reduce((value, part, index) => value + (index ? "$" + index : "") + part, "");
    assert.doesNotMatch(text, /\bpublic\s*\./i, "Reward HTTP QA must never query public tables");
    observe?.(text, values);
    const { rows } = await client.query(text, values);
    return mode === "string" ? rows.map(row => ({ ...row, ...(row.created_at instanceof Date ? { created_at: row.created_at.toISOString() } : {}) })) : rows;
  };
}

async function createFixtureSchema(client, schema) {
  const s = identifier(schema);
  await client.query(`
    CREATE TYPE ${s}.points_source AS ENUM (
      'TAP_VALID', 'PROVENANCE_VIEWED', 'OWNERSHIP_ACTIVATED', 'WARRANTY_REGISTERED',
      'QUIZ_COMPLETED', 'EXPERIENCE_ATTENDED', 'REFERRAL_SIGNUP', 'REWARD_REDEEMED',
      'ADMIN_ADJUSTMENT', 'FRAUD_REVERSAL', 'EXPIRATION'
    );
    CREATE TYPE ${s}.loyalty_member_status AS ENUM ('anonymous', 'enrolled', 'verified', 'blocked', 'deleted');
    CREATE TYPE ${s}.loyalty_program_status AS ENUM ('draft', 'active', 'paused', 'archived');
    CREATE TYPE ${s}.tenant_membership_status AS ENUM ('invited', 'active', 'paused', 'blocked', 'left');
    CREATE TYPE ${s}.consumer_reward_claim_status AS ENUM ('claimed', 'redeemed', 'cancelled', 'expired');
    CREATE TYPE ${s}.consumer_status AS ENUM ('anonymous', 'registered', 'verified', 'blocked', 'deleted');
    CREATE TABLE ${s}.tenants (id uuid PRIMARY KEY, slug text NOT NULL UNIQUE, name text NOT NULL DEFAULT 'Synthetic QA Brand');
    CREATE TABLE ${s}.consumers (id uuid PRIMARY KEY, status ${s}.consumer_status NOT NULL DEFAULT 'anonymous', display_name text, email text, phone text);
    CREATE TABLE ${s}.loyalty_programs (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      status ${s}.loyalty_program_status NOT NULL DEFAULT 'draft',
      name text NOT NULL DEFAULT 'Synthetic QA Program', age_gate_required boolean NOT NULL DEFAULT false,
      start_at timestamptz NOT NULL DEFAULT now(), end_at timestamptz
    );
    CREATE TABLE ${s}.tenant_consumer_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      consumer_id uuid NOT NULL REFERENCES ${s}.consumers(id) ON DELETE CASCADE,
      loyalty_program_id uuid REFERENCES ${s}.loyalty_programs(id) ON DELETE SET NULL,
      status ${s}.tenant_membership_status NOT NULL DEFAULT 'active',
      UNIQUE(tenant_id, consumer_id)
    );
    CREATE TABLE ${s}.loyalty_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      program_id uuid NOT NULL REFERENCES ${s}.loyalty_programs(id) ON DELETE CASCADE,
      consumer_id uuid, member_key text, email text,
      status ${s}.loyalty_member_status NOT NULL DEFAULT 'anonymous',
      points_balance integer NOT NULL DEFAULT 0,
      lifetime_points integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX uq_loyalty_members_program_email ON ${s}.loyalty_members(program_id, email);
    CREATE UNIQUE INDEX uq_loyalty_members_program_member_key ON ${s}.loyalty_members(program_id, member_key);
    CREATE UNIQUE INDEX uq_loyalty_members_program_consumer ON ${s}.loyalty_members(program_id, consumer_id) WHERE consumer_id IS NOT NULL;
    CREATE INDEX idx_loyalty_members_consumer_program ON ${s}.loyalty_members(consumer_id, program_id);
    CREATE TABLE ${s}.rewards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      program_id uuid NOT NULL REFERENCES ${s}.loyalty_programs(id) ON DELETE CASCADE,
      code text NOT NULL, title text NOT NULL, description text,
      status text NOT NULL DEFAULT 'draft', points_cost integer NOT NULL DEFAULT 0,
      requires_age_gate boolean NOT NULL DEFAULT false,
      eligibility_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      redemption_limit_per_member integer, fulfillment_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      stock_total integer, stock_remaining integer,
      starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(program_id, code)
    );
    CREATE TABLE ${s}.points_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      program_id uuid NOT NULL REFERENCES ${s}.loyalty_programs(id) ON DELETE CASCADE,
      member_id uuid NOT NULL REFERENCES ${s}.loyalty_members(id) ON DELETE CASCADE,
      tap_event_id bigint, source ${s}.points_source NOT NULL,
      delta integer NOT NULL, balance_after integer NOT NULL,
      idempotency_key text UNIQUE, reason text,
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE ${s}.consumer_reward_claims (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      consumer_id uuid NOT NULL REFERENCES ${s}.consumers(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      reward_id uuid NOT NULL REFERENCES ${s}.rewards(id) ON DELETE CASCADE,
      tap_event_id bigint,
      status ${s}.consumer_reward_claim_status NOT NULL DEFAULT 'claimed',
      points_spent integer NOT NULL,
      redemption_code text NOT NULL UNIQUE, idempotency_key text NOT NULL UNIQUE,
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_consumer_reward_claims_consumer ON ${s}.consumer_reward_claims(consumer_id, created_at DESC);
  `);
}

/** Importing this module performs no I/O. Only an explicit disposable QA connect factory may open clients. */
export async function runConsumerRewardHttpPostgresQa({ connect } = {}) {
  assert.equal(typeof connect, "function", "An explicit QA connection factory is required");
  const clients = [], pids = [], schema = "consumer_reward_http_qa_" + randomUUID().replaceAll("-", ""), s = identifier(schema);
  const report = { kind: "synthetic-postgresql-handler-integration", ok: false, claimChecks: [], adminChecks: [], lockObservations: [],
    sqlExecutions: { claim: 0, admin: 0 }, sources: [], sqlCopiedIntoHarness: false,
    portalLockObservations: [], serializableIsolationObservations: [], serializationConflicts: 0,
    boundaries: { consumerAuthentication: "synthetic-owner-or-deny", adminAuthentication: "synthetic-forced-tenant-or-deny", rateLimit: "synthetic-allow-or-deny", schemaInitializer: "synthetic-noop", originConfiguration: "production-default-allowlist", sql: "real-pg", serializableTransport: "synthetic-pg-adapter-BEGIN-SERIALIZABLE; production-db-wrapper-unchanged", createdAtModes: ["Date", "string"], physicalDelivery: "not-exercised", phoneAndSealConcurrentAuthority: "outside-this-increment" },
    cleanup: { schemaDropped: false, connectionsClosed: false } };
  let schemaCreated = false, executionError;
  try {
    let database, version;
    for (let index = 0; index < 3; index++) {
      const client = await connect();
      assert.ok(!clients.includes(client), "Concurrency QA requires independent clients"); clients.push(client);
      assert.ok(typeof client?.query === "function" && (typeof client?.end === "function" || typeof client?.release === "function"), "A connected closeable pg client is required");
      const { rows: [identity] } = await client.query("SELECT current_database() AS database, pg_backend_pid() AS backend_pid, current_setting('server_version_num')::integer AS version");
      assert.match(identity?.database ?? "", QA_DATABASE, "Refusing a database without an explicit QA name");
      assert.ok([160004, 180004].includes(identity.version), "Only PostgreSQL16.4/18.4 is allowed by this candidate");
      database ??= identity.database; version ??= identity.version;
      assert.equal(identity.database, database, "All QA clients must use the same database"); assert.equal(identity.version, version);
      assert.ok(Number.isInteger(identity.backend_pid) && !pids.includes(identity.backend_pid), "Separate PostgreSQL backends are required"); pids.push(identity.backend_pid);
    }
    report.postgresVersion = version === 160004 ? "16.4" : "18.4";
    const [admin, first, second] = clients;
    const sourceRoot = new URL("../../src/", import.meta.url);
    const modules = Object.fromEntries([
      ["claim-route", "app/consumer/rewards/[rewardId]/claim/route.ts"],
      ["admin-route", "app/admin/rewards/redemptions/validate/route.ts"],
      ["queries", "lib/consumer-reward-queries.ts"], ["model", "lib/consumer-rewards-read-model.ts"],
      ["origin", "lib/consumer-mutation-origin.ts"], ["bounded", "lib/bounded-request-body.ts"], ["http", "lib/http.ts"],
    ].map(([name, relativePath]) => {
      const bytes = readFileSync(new URL(relativePath, sourceRoot));
      const sha256 = createHash("sha256").update(bytes).digest("hex"); report.sources.push({ relativePath: "apps/api/src/" + relativePath, sha256 });
      return [name, ts.transpileModule(bytes.toString("utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText];
    }));
    function instantiate(name, deps = {}) {
      const module = { exports: {} };
      new Function("require", "module", "exports", "process", modules[name])(specifier => {
        const key = specifier.split("/").at(-1); assert.ok(Object.hasOwn(deps, key), "Only explicit synthetic boundaries may replace imports"); return deps[key];
      }, module, module.exports, { env: { NODE_ENV: "production", VERCEL_ENV: "production" } });
      return module.exports;
    }
    const http = instantiate("http"), bounded = instantiate("bounded"), origin = instantiate("origin", { http });
    const writer = instantiate("queries");
    await admin.query("CREATE SCHEMA " + s); schemaCreated = true;
    for (const client of clients) {
      await client.query("SET search_path TO " + s + ", pg_catalog");
      await client.query("SELECT set_config('statement_timeout', '12000', false), set_config('lock_timeout', '10000', false)");
      const { rows: [own] } = await client.query("SELECT current_schema() AS schema"); assert.equal(own.schema, schema);
    }
    await createFixtureSchema(admin, schema);
    async function fixture() {
      const f = Object.fromEntries(["tenantId", "otherTenantId", "programId", "consumerId", "otherConsumerId", "memberId", "membershipId", "rewardId", "otherRewardId"].map(key => [key, randomUUID()]));
      f.slug = "qa-" + f.tenantId; f.otherSlug = "qa-" + f.otherTenantId;
      await admin.query("INSERT INTO " + s + ".tenants(id,slug) VALUES($1,$2),($3,$4)", [f.tenantId,f.slug,f.otherTenantId,f.otherSlug]);
      await admin.query("INSERT INTO " + s + ".consumers(id,status,display_name,email,phone) VALUES($1,'registered','Fixture consumer','fixture@example.invalid','+0000000000000'),($2,'registered','Other fixture',NULL,NULL)", [f.consumerId,f.otherConsumerId]);
      await admin.query("INSERT INTO " + s + ".loyalty_programs(id,tenant_id,status,start_at) VALUES($1,$2,'active',clock_timestamp()-interval '1 day')", [f.programId,f.tenantId]);
      await admin.query("INSERT INTO " + s + ".tenant_consumer_memberships(id,tenant_id,consumer_id,loyalty_program_id,status) VALUES($1,$2,$3,$4,'active')", [f.membershipId,f.tenantId,f.consumerId,f.programId]);
      await admin.query("INSERT INTO " + s + ".loyalty_members(id,tenant_id,program_id,consumer_id,status,points_balance,lifetime_points) VALUES($1,$2,$3,$4,'enrolled',100,100)", [f.memberId,f.tenantId,f.programId,f.consumerId]);
      for (const id of [f.rewardId,f.otherRewardId]) await admin.query("INSERT INTO " + s + ".rewards(id,tenant_id,program_id,code,title,status,points_cost,stock_total,stock_remaining,starts_at) VALUES($1::uuid,$2::uuid,$3::uuid,($1::uuid)::text,'Synthetic QA reward','active',40,2,2,clock_timestamp()-interval '1 day')", [id,f.tenantId,f.programId]);
      return f;
    }
    async function snapshot(f) {
      const result = {};
      for (const table of ["loyalty_members","rewards","points_ledger","consumer_reward_claims"]) result[table] = (await admin.query("SELECT * FROM " + s + '."' + table + '" WHERE tenant_id=ANY($1::uuid[]) ORDER BY id', [[f.tenantId,f.otherTenantId]])).rows;
      return result;
    }
    const economics = state => ({ members: state.loyalty_members, rewards: state.rewards, ledger: state.points_ledger });
    async function check(family, name, operation) {
      try { await operation(); report[family].push({name,ok:true}); }
      catch (error) { report[family].push({name,ok:false,reason: error?.name === "AssertionError" ? String(error.message).slice(0,1200) : "postgres_statement_failed", ...(typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? {code:error.code} : {})}); }
    }
    function serializableAdapter(client, observe) {
      return async (strings, ...values) => {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        try {
          const isolation = (await client.query("SHOW transaction_isolation")).rows[0].transaction_isolation;
          assert.equal(isolation, "serializable"); report.serializableIsolationObservations.push(isolation);
          const rows = await queryAdapter(client, "Date", observe)(strings, ...values);
          await client.query("COMMIT"); return rows;
        } catch (error) {
          if (error.code === "40001") report.serializationConflicts++;
          await client.query("ROLLBACK"); throw error;
        }
      };
    }
    function claimHttp(f, client = first, options = {}) {
      const calls = { auth:0, rate:0, body:0, schema:0, sql:0 };
      const sql = queryAdapter(client,"Date",() => {calls.sql++;report.sqlExecutions.claim++;});
      const ownSerializable = serializableAdapter(client, () => { calls.sql++; report.sqlExecutions.claim++; });
      const sqlSerializable = async (strings, ...values) => {
        const rows = await ownSerializable(strings, ...values);
        // A synthetic timing boundary after the real readback transaction commits.
        // The handler and both SQL statements are the imported production source.
        if (strings[0].trimStart().startsWith("WITH locked_reward AS MATERIALIZED")) await options.afterOwnReadback?.();
        return rows;
      };
      const deps = { "node:crypto": {randomUUID}, http, db:{sql,sqlSerializable}, "consumer-reward-queries":writer,
        "consumer-auth": {getConsumerFromRequest:async()=>{calls.auth++;return options.unauthorized?null:{id:f.consumerId};}},
        "consumer-mutation-origin":origin,
        "critical-rate-limit":{enforceCriticalRateLimit:async()=>{calls.rate++;return options.limited?http.json({ok:false},429):null;}},
        "commercial-runtime-schema":{ensureConsumerPortalSchema:async()=>{calls.schema++;}},
        "bounded-request-body":{...bounded,readBoundedJsonBody:async(req,limit)=>{calls.body++;assert.equal(limit,8192);return bounded.readBoundedJsonBody(req,limit);}} };
      const {POST}=instantiate("claim-route",deps);
      return {calls,post:async(body={claimIntent:"portal-first-reservation.v1",expectedPointsCost:40},request={},rewardId=f.rewardId)=>POST(new Request("https://nexid.lat/api/consumer/rewards/"+rewardId+"/claim",{method:"POST",body:request.raw?body:JSON.stringify(body),headers:{origin:"https://nexid.lat","sec-fetch-site":"same-origin","content-type":"application/json",...request.headers}}),{params:Promise.resolve({rewardId})})};
    }
    function adminHttp(f, client = first, options = {}) {
      const calls = {auth:0,schema:0,sql:0,createdSnapshots:[]};
      const sql=queryAdapter(client,options.createdAtMode??"Date",(text,values)=>{calls.sql++;report.sqlExecutions.admin++;if(text.trimStart().startsWith("WITH locked AS MATERIALIZED"))calls.createdSnapshots.push(values[8]);});
      const model=instantiate("model",{db:{sql}});
      const {POST}=instantiate("admin-route",{http,db:{sql},"consumer-rewards-read-model":model,
        auth:{checkAdmin:async()=>{calls.auth++;return options.unauthorized?http.json({ok:false},401):null;},getAdminTenantAccess:()=>({forcedTenantSlug:options.forcedTenant??f.slug})},
        "commercial-runtime-schema":{ensureConsumerPortalSchema:async()=>{calls.schema++;}}});
      return {calls,post:async(body={})=>POST(new Request("https://nexid.lat/admin/rewards/redemptions/validate",{method:"POST",body:JSON.stringify({code:f.code,...body})}))};
    }
    async function issued() {
      const f=await fixture(), rewardText=f.rewardId.toUpperCase();
      const [row]=await writer.insertConsumerRewardClaim(queryAdapter(first),{consumerId:f.consumerId,rewardId:rewardText,idempotencyKey:"consumer-reward-claim:"+f.consumerId+":"+rewardText,redemptionCode:"QA-"+randomUUID().toUpperCase(),locale:"es-AR"});
      assert.ok(row?.id);f.claimId=row.id;f.code=row.redemption_code;
      await admin.query("UPDATE "+s+".consumer_reward_claims SET metadata_json=jsonb_build_object('expires_at',$2::text) WHERE id=$1",[f.claimId,new Date(Date.now()+7200000).toISOString()]);
      return f;
    }
    const deniedBoundary = async (h, response, status) => {assert.equal(response.status,status);assert.equal(h.calls.schema,0);assert.equal(h.calls.sql,0);};
    await check("claimChecks","claim_exact_origin_refuses_before_auth_body_or_sql",async()=>{const f=await fixture(),before=await snapshot(f);for(const headers of [{origin:""},{origin:"https://evil.nexid.lat"},{"sec-fetch-site":"cross-site"}]){const h=claimHttp(f);await deniedBoundary(h,await h.post({}, {headers}),403);assert.equal(h.calls.auth,0);assert.equal(h.calls.body,0);}assert.deepEqual(await snapshot(f),before);});
    await check("claimChecks","claim_auth_or_rate_refuses_before_body_or_sql",async()=>{const f=await fixture(),before=await snapshot(f);for(const options of [{unauthorized:true},{limited:true}]){const h=claimHttp(f,first,options);await deniedBoundary(h,await h.post(),options.unauthorized?401:429);assert.equal(h.calls.body,0);}assert.deepEqual(await snapshot(f),before);});
    await check("claimChecks","claim_invalid_uuid_refuses_before_body_or_sql",async()=>{const f=await fixture(),before=await snapshot(f);for(const id of ["invalid",f.rewardId+" "]){const h=claimHttp(f);await deniedBoundary(h,await h.post({}, {},id),400);assert.equal(h.calls.body,0);}assert.deepEqual(await snapshot(f),before);});
    await check("claimChecks","claim_invalid_object_or_json_refuses_without_writes",async()=>{const f=await fixture(),before=await snapshot(f);for(const value of [null,[],false,0,"not-an-object"]){const h=claimHttp(f);await deniedBoundary(h,await h.post(value),400);}const h=claimHttp(f);await deniedBoundary(h,await h.post("{broken",{raw:true}),400);assert.deepEqual(await snapshot(f),before);});
    await check("claimChecks","claim_streamed_or_declared_oversize_refuses_without_writes",async()=>{const f=await fixture(),before=await snapshot(f);for(const request of [{},{headers:{"content-length":"8193"}}]){const h=claimHttp(f);await deniedBoundary(h,await h.post({payload:"x".repeat(8193)},request),413);}assert.deepEqual(await snapshot(f),before);});
    await check("claimChecks","claim_actual_handler_uses_own_program_and_unchanged_uuid_text",async()=>{const f=await fixture(),h=claimHttp(f),response=await h.post({claimIntent:"portal-first-reservation.v1",expectedPointsCost:40,consumerId:f.otherConsumerId,tenantId:f.otherTenantId,memberId:randomUUID(),eventId:"forged"},{},f.rewardId.toUpperCase());assert.equal(response.status,200);const result=await response.json();assert.equal(result.duplicate,false);assert.equal(result.claim.consumer_id,f.consumerId);assert.equal(result.claim.tenant_id,f.tenantId);assert.equal(result.claim.reward_id,f.rewardId);assert.equal(result.claim.idempotency_key,"consumer-reward-claim:"+f.consumerId+":"+f.rewardId.toUpperCase());const state=await snapshot(f);assert.equal(state.loyalty_members[0].points_balance,60);assert.equal(state.consumer_reward_claims.length,1);assert.equal(state.points_ledger.length,1);assert.equal(state.points_ledger[0].delta,-40);assert.equal(state.rewards.find(r=>r.id===f.rewardId).stock_remaining,1);});
    await check("claimChecks","claim_preexisting_uppercase_key_replays_same_text_without_another_debit",async()=>{const f=await issued();for(const status of ["claimed","redeemed","cancelled","expired"]){await admin.query("UPDATE "+s+".consumer_reward_claims SET status=$2 WHERE id=$1",[f.claimId,status]);const before=await snapshot(f);const responses=await Promise.all([claimHttp(f,first).post({claimIntent:"portal-first-reservation.v1",expectedPointsCost:40}, {},f.rewardId.toUpperCase()),claimHttp(f,second).post({claimIntent:"portal-first-reservation.v1",expectedPointsCost:40}, {},f.rewardId.toUpperCase())]);for(const response of responses){assert.equal(response.status,200);const body=await response.json();assert.equal(body.duplicate,true);assert.equal(body.claim.id,f.claimId);assert.equal(body.claim.status,status);}assert.deepEqual(await snapshot(f),before);}});

    await check("adminChecks","admin_auth_refuses_before_initializer_and_sql",async()=>{const f=await issued(),h=adminHttp(f,first,{unauthorized:true});await deniedBoundary(h,await h.post({action:"redeem"}),401);});
    await check("adminChecks","admin_lookup_native_date_or_string_created_at_with_raw_precision",async()=>{const f=await issued();await admin.query("UPDATE "+s+".consumer_reward_claims SET created_at=date_trunc('second',clock_timestamp())-interval '1 hour'+interval '123456 microseconds' WHERE id=$1",[f.claimId]);const before=await snapshot(f);for(const createdAtMode of ["Date","string"]){const h=adminHttp(f,first,{createdAtMode}),response=await h.post();assert.equal(response.status,200);const body=await response.json();assert.equal(body.redemption.status,"claimed");assert.ok(body.redemption.expires_at);assert.equal(h.calls.createdSnapshots.length,0);}assert.deepEqual(await snapshot(f),before);});
    await check("adminChecks","admin_reached_or_malformed_explicit_expiry_refuses_without_update",async()=>{const f=await issued();for(const expiry of [new Date(Date.now()-1).toISOString(),"", "infinity","2026-02-30T12:00:00Z",[],{},false,0]){await admin.query("UPDATE "+s+".consumer_reward_claims SET metadata_json=jsonb_build_object('expires_at',$2::jsonb) WHERE id=$1",[f.claimId,JSON.stringify(expiry)]);const before=await snapshot(f),h=adminHttp(f);assert.equal((await h.post({action:"redeem",expires_at:"2099-01-01T00:00:00Z"})).status,409);assert.equal(h.calls.createdSnapshots.length,0);assert.deepEqual(await snapshot(f),before);}});
    await check("adminChecks","admin_48h_default_date_or_string_never_renews_expired_claim",async()=>{const f=await issued();for(const mode of ["Date","string"])for(const expired of [false,true]){await admin.query("UPDATE "+s+".consumer_reward_claims SET metadata_json='{}'::jsonb,created_at=clock_timestamp()-$2::interval WHERE id=$1",[f.claimId,expired?"48 hours 1 second":"1 hour"]);const before=await snapshot(f),h=adminHttp(f,first,{createdAtMode:mode});assert.equal((await h.post({action:"lookup"})).status,expired?409:200);assert.equal(h.calls.createdSnapshots.length,0);assert.deepEqual(await snapshot(f),before);}});
    await check("adminChecks","admin_forced_other_tenant_cannot_lookup_or_confirm",async()=>{const f=await issued(),before=await snapshot(f),h=adminHttp(f,first,{forcedTenant:f.otherSlug});assert.equal((await h.post({action:"redeem"})).status,404);assert.equal(h.calls.createdSnapshots.length,0);assert.deepEqual(await snapshot(f),before);});
    await check("adminChecks","admin_terminal_claim_cannot_confirm_again",async()=>{const f=await issued();for(const status of ["redeemed","cancelled","expired"]){await admin.query("UPDATE "+s+".consumer_reward_claims SET status=$2 WHERE id=$1",[f.claimId,status]);const before=await snapshot(f);assert.equal((await adminHttp(f).post({action:"redeem"})).status,409);assert.deepEqual(await snapshot(f),before);}});
    await check("adminChecks","admin_actual_confirmation_changes_no_points_stock_or_ledger",async()=>{for(const createdAtMode of ["Date","string"]){const f=await issued();await admin.query("UPDATE "+s+".consumer_reward_claims SET metadata_json='{}'::jsonb,created_at=date_trunc('second',clock_timestamp())-interval '1 hour'+interval '123456 microseconds' WHERE id=$1",[f.claimId]);const before=await snapshot(f),raw=(await admin.query("SELECT created_at::text AS value FROM "+s+".consumer_reward_claims WHERE id=$1",[f.claimId])).rows[0].value,h=adminHttp(f,first,{createdAtMode});assert.equal((await h.post({action:"fulfill"})).status,200);assert.equal(h.calls.createdSnapshots[0],raw);assert.match(raw,/\.123456[+-]/);const after=await snapshot(f);assert.deepEqual(economics(after),economics(before));assert.equal(after.consumer_reward_claims[0].status,"redeemed");}});

    async function waitRows(expiry = null) {
      return (await admin.query("SELECT pid,pg_blocking_pids(pid) AS blockers,query_start < $2::timestamptz AS started_before_expiry,clock_timestamp() < $2::timestamptz AS before_expiry FROM pg_stat_activity WHERE pid=ANY($1::integer[]) AND wait_event_type='Lock'",[pids.slice(1),expiry])).rows;
    }
    function assertBlockers(rows) {
      assert.equal(rows.length,2,"Both handler backends must wait for the owned claim lock");const byPid=new Map(rows.map(r=>[r.pid,r]));assert.deepEqual([...byPid.keys()].sort(),pids.slice(1).sort());
      for(const row of rows){assert.ok(row.blockers.length>0);assert.ok(row.blockers.every(pid=>pids.includes(pid)&&pid!==row.pid));const other=pids.slice(1).find(pid=>pid!==row.pid);assert.ok(row.blockers.includes(pids[0])||(row.blockers.includes(other)&&byPid.get(other).blockers.includes(pids[0])));}
    }
    async function lockedCase(name, {prepare, mutate, expiryWait=false, expectedSuccess=0, mode="Date"} = {}) {
      const f=await issued();const prepared=await prepare?.(f);const before=await snapshot(f);let pending,adminTransaction=false,responses;
      try {
        await admin.query("BEGIN");adminTransaction=true;await admin.query("SELECT id FROM "+s+".consumer_reward_claims WHERE id=$1 FOR UPDATE",[f.claimId]);
        pending=Promise.allSettled([adminHttp(f,first,{createdAtMode:mode}).post({action:"redeem"}),adminHttp(f,second,{createdAtMode:mode}).post({action:"redeem"})]);
        let rows;const deadline=Date.now()+8000;while(Date.now()<deadline){rows=await waitRows(expiryWait?prepared.expiry:null);if(rows.length===2)break;await new Promise(resolve=>setTimeout(resolve,15));}assertBlockers(rows);
        if(expiryWait){assert.ok(rows.every(r=>r.started_before_expiry&&r.before_expiry));let reached=false;while(Date.now()<deadline){const clock=(await admin.query("SELECT clock_timestamp() >= $1::timestamptz AS reached",[prepared.expiry])).rows[0];if(clock.reached){reached=true;break;}await new Promise(resolve=>setTimeout(resolve,15));}assert.ok(reached,"Actual PostgreSQL wall clock must reach the unchanged deadline");assertBlockers(await waitRows(prepared.expiry));}
        const deliberatelyChanged=await mutate?.(f,before,prepared);const expectedClaims=deliberatelyChanged?(await snapshot(f)).consumer_reward_claims:before.consumer_reward_claims;
        report.lockObservations.push({name,waitingBackends:2,waitEventType:"Lock",blockedByOwnedClaimLock:true,wallClockExpiryReached:expiryWait,startedBeforeExpiry:expiryWait?true:null});
        await admin.query("COMMIT");adminTransaction=false;const settled=await pending;for(const item of settled)assert.equal(item.status,"fulfilled");responses=settled.map(item=>item.value);assert.equal(responses.filter(r=>r.status===200).length,expectedSuccess);assert.ok(responses.every(r=>[200,409,404].includes(r.status)));
        const after=await snapshot(f);assert.deepEqual(economics(after),economics(before));if(expectedSuccess===0)assert.deepEqual(after.consumer_reward_claims,expectedClaims);else{assert.equal(after.consumer_reward_claims[0].status,"redeemed");assert.equal(after.consumer_reward_claims.length,1);}
        if(prepared?.oldRaw){const raw=(await admin.query("SELECT created_at::text AS raw,created_at FROM "+s+".consumer_reward_claims WHERE id=$1",[f.claimId])).rows[0];assert.notEqual(raw.raw,prepared.oldRaw);assert.equal(raw.created_at.getTime(),prepared.oldMillis,"Microsecond change must keep the parsed millisecond equal");report.rawPrecisionObservation={rawTextChanged:true,parsedMillisecondUnchanged:true,changedMicroseconds:1};}
      } finally {if(adminTransaction)await admin.query("ROLLBACK");if(pending)await pending;}
    }
    await check("adminChecks","admin_two_real_waiting_confirmations_commit_once",()=>lockedCase("duplicate",{expectedSuccess:1}));
    await check("adminChecks","admin_wall_clock_expiry_reached_while_both_handlers_wait",()=>lockedCase("wall-clock-expiry",{expiryWait:true,prepare:async f=>{const expiry=(await admin.query("SELECT to_char((clock_timestamp()+interval '4 seconds') AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS value")).rows[0].value;await admin.query("UPDATE "+s+".consumer_reward_claims SET metadata_json=jsonb_build_object('expires_at',$2::text) WHERE id=$1",[f.claimId,expiry]);return{expiry};}}));
    await check("adminChecks","admin_expiry_metadata_changed_during_lock_invalidates_snapshot",()=>lockedCase("changed-expiry",{mutate:async f=>{await admin.query("UPDATE "+s+".consumer_reward_claims SET metadata_json=jsonb_build_object('expires_at',$2::text) WHERE id=$1",[f.claimId,new Date(Date.now()+10800000).toISOString()]);return true;}}));
    await check("adminChecks","admin_creation_microsecond_change_invalidates_raw_snapshot",()=>lockedCase("created-at-microsecond",{mode:"string",prepare:async f=>{await admin.query("UPDATE "+s+".consumer_reward_claims SET created_at=date_trunc('second',clock_timestamp())-interval '1 hour'+interval '123456 microseconds' WHERE id=$1",[f.claimId]);const row=(await admin.query("SELECT created_at::text AS raw,created_at FROM "+s+".consumer_reward_claims WHERE id=$1",[f.claimId])).rows[0];return{oldRaw:row.raw,oldMillis:row.created_at.getTime()};},mutate:async f=>{await admin.query("UPDATE "+s+".consumer_reward_claims SET created_at=created_at+interval '1 microsecond' WHERE id=$1",[f.claimId]);return true;}}));
    for(const [name,column,valueKey] of [["status","status",null],["tenant","tenant_id","otherTenantId"],["consumer","consumer_id","otherConsumerId"],["reward","reward_id","otherRewardId"],["code","redemption_code",null]])await check("adminChecks","admin_"+name+"_change_during_lock_prevents_stale_confirmation",()=>lockedCase("changed-"+name,{mutate:async f=>{assert.ok(["status","tenant_id","consumer_id","reward_id","redemption_code"].includes(column));const value=name==="status"?"cancelled":name==="code"?"QA-"+randomUUID().toUpperCase():f[valueKey];await admin.query("UPDATE "+s+".consumer_reward_claims SET "+column+"=$2 WHERE id=$1",[f.claimId,value]);return true;}}));
async function portalRead(f) {
      const read = instantiate("model", { db: { sql: queryAdapter(first) } });
      await first.query("BEGIN READ ONLY");
      try { return await read.getPrivateConsumerRewards(f.consumerId, queryAdapter(first)); }
      finally { await first.query("ROLLBACK"); }
    }
    await check("claimChecks", "portal_expected_cost_is_mandatory_and_early_validated", async () => {
      const f = await fixture(), before = await snapshot(f);
      for (const expectedPointsCost of [undefined, null, "40", -1, 0.5, 2147483648, {}, []]) {
        const h = claimHttp(f), response = await h.post({ claimIntent: "portal-first-reservation.v1", expectedPointsCost });
        await deniedBoundary(h, response, 400); assert.equal((await response.json()).error, "invalid_expected_points_cost");
      }
      assert.deepEqual(await snapshot(f), before);
    });
    await check("claimChecks", "portal_confirmed_price_mismatch_never_debits", async () => {
      const f = await fixture(), before = await snapshot(f), response = await claimHttp(f).post({ claimIntent: "portal-first-reservation.v1", expectedPointsCost: 39 });
      assert.equal(response.status, 409); assert.deepEqual(await response.json(), { ok: false, error: "reward_claim_conflict", refresh_required: true });
      assert.deepEqual(await snapshot(f), before);
    });
    await check("claimChecks", "portal_denial_does_not_disclose_private_price_stock_or_existence", async () => {
      const f = await fixture();
      await admin.query("UPDATE " + s + ".rewards SET status='draft',points_cost=70,stock_remaining=0 WHERE id=$1", [f.otherRewardId]);
      const before = await snapshot(f), expected = { ok: false, error: "reward_claim_conflict", refresh_required: true };
      for (const [actor, rewardId] of [[{ ...f, consumerId: f.otherConsumerId }, f.rewardId], [f, f.otherRewardId], [f, randomUUID()]]) {
        for (const expectedPointsCost of [0, 40, 70]) {
          for(const claimIntent of [undefined,"portal-first-reservation.v1"]) {
          const h = claimHttp(actor), response = await h.post(claimIntent ? {claimIntent,expectedPointsCost} : {expectedPointsCost}, {}, rewardId);
          assert.equal(response.status, 409); assert.deepEqual(await response.json(), expected);
          assert.equal(h.calls.sql, 3, "Only scoped own preread, authoritative writer and scoped own readback execute");
          assert.deepEqual(await snapshot(f), before);
          }
        }
      }
    });
    await check("claimChecks", "portal_requires_existing_active_crm_without_implicit_join", async () => {
      for (const status of [null, "paused", "blocked", "left"]) {
        const f = await fixture();
        if (status === null) await admin.query("DELETE FROM " + s + ".tenant_consumer_memberships WHERE id=$1", [f.membershipId]);
        else await admin.query("UPDATE " + s + ".tenant_consumer_memberships SET status=$2 WHERE id=$1", [f.membershipId, status]);
        const before = await snapshot(f); assert.equal((await claimHttp(f).post()).status, 409);
        assert.deepEqual(await snapshot(f), before);
        assert.equal((await portalRead(f)).find(row => row.id === f.rewardId)?.can_claim ?? false, false);
      }
    });
    await check("claimChecks", "portal_unsupported_configured_rules_are_fail_closed", async () => {
      for (const [table, clause] of [["rewards", "redemption_limit_per_member=1"], ["rewards", "fulfillment_json='{" + '"pickup":"appointment"' + "}'::jsonb"], ["rewards", "eligibility_json='[]'::jsonb"], ["rewards", "eligibility_json='{" + '"segment":"vip"' + "}'::jsonb"], ["rewards", "requires_age_gate=true"], ["loyalty_programs", "age_gate_required=true"]]) {
        const f = await fixture(); await admin.query("UPDATE " + s + "." + table + " SET " + clause + " WHERE id=$1", [table === "rewards" ? f.rewardId : f.programId]);
        const before = await snapshot(f); assert.equal((await claimHttp(f).post()).status, 409);
        assert.deepEqual(await snapshot(f), before); assert.equal((await portalRead(f)).find(row => row.id === f.rewardId)?.can_claim ?? false, false);
      }
    });
    await check("claimChecks", "portal_requires_published_current_program_and_reward", async () => {
      for (const [table, clause] of [["rewards", "status='draft'"], ["loyalty_programs", "status='paused'"], ["rewards", "starts_at=clock_timestamp()+interval '1 day'"], ["rewards", "ends_at=clock_timestamp()-interval '1 second'"], ["loyalty_programs", "start_at=clock_timestamp()+interval '1 day'"], ["loyalty_programs", "end_at=clock_timestamp()-interval '1 second'"]]) {
        const f = await fixture(); await admin.query("UPDATE " + s + "." + table + " SET " + clause + " WHERE id=$1", [table === "rewards" ? f.rewardId : f.programId]);
        const before = await snapshot(f); assert.equal((await claimHttp(f).post()).status, 409);
        assert.deepEqual(await snapshot(f), before); assert.equal((await portalRead(f)).find(row => row.id === f.rewardId)?.can_claim ?? false, false);
      }
    });
    await check("claimChecks", "portal_scope_uses_only_own_consumer_tenant_program", async () => {
      for (const dimension of ["consumer", "reward_tenant", "member_program"]) {
        const f = await fixture();
        if (dimension === "reward_tenant") await admin.query("UPDATE " + s + ".rewards SET tenant_id=$2 WHERE id=$1", [f.rewardId, f.otherTenantId]);
        // A different persisted programme is inserted before moving the member.
        if (dimension === "member_program") { const id = randomUUID(); await admin.query("INSERT INTO " + s + ".loyalty_programs(id,tenant_id,status) VALUES($1,$2,'active')", [id,f.tenantId]); await admin.query("UPDATE " + s + ".loyalty_members SET program_id=$2 WHERE id=$1", [f.memberId,id]); }
        const before = await snapshot(f), actor = dimension === "consumer" ? { ...f, consumerId:f.otherConsumerId } : f;
        assert.equal((await claimHttp(actor).post()).status, 409); assert.deepEqual(await snapshot(f), before);
      }
    });
    await check("claimChecks", "portal_semantic_uuid_shares_original_historical_receipt", async () => {
      const f = await issued(), original = (await snapshot(f)).consumer_reward_claims[0];
      for (const status of ["claimed", "redeemed", "cancelled", "expired"]) {
        await admin.query("UPDATE " + s + ".consumer_reward_claims SET status=$2 WHERE id=$1", [f.claimId,status]);
        const before = await snapshot(f), response = await claimHttp(f).post({claimIntent:"portal-first-reservation.v1",expectedPointsCost:73}, {}, f.rewardId.toLowerCase()), body = await response.json();
        assert.equal(response.status,200); assert.equal(body.duplicate,true); assert.equal(body.claim.id,f.claimId);
        assert.equal(body.claim.idempotency_key,original.idempotency_key); assert.equal(body.claim.status,status); assert.deepEqual(await snapshot(f),before);
      }
    });
    await check("claimChecks", "portal_ambiguous_history_denies_without_economic_writes", async () => {
      const f = await issued(); await admin.query("INSERT INTO " + s + ".consumer_reward_claims(consumer_id,tenant_id,reward_id,status,points_spent,redemption_code,idempotency_key) VALUES($1,$2,$3,'expired',40,$4,$5)", [f.consumerId,f.tenantId,f.rewardId,"QA-"+randomUUID(),"legacy-"+randomUUID()]);
      const before = await snapshot(f), response = await claimHttp(f).post(); assert.equal(response.status,409);
      assert.equal((await response.json()).error,"reward_claim_history_ambiguous"); assert.deepEqual(await snapshot(f),before);
    });
    await check("claimChecks", "portal_mismatched_historical_tenant_is_not_shared_or_replaced", async () => {
      const f = await issued(); await admin.query("UPDATE " + s + ".consumer_reward_claims SET tenant_id=$2 WHERE id=$1", [f.claimId,f.otherTenantId]);
      const before=await snapshot(f), response=await claimHttp(f).post(); assert.equal(response.status,409);
      assert.equal((await response.json()).error,"reward_claim_history_ambiguous"); assert.deepEqual(await snapshot(f),before);
    });
    await check("claimChecks", "portal_advisory_true_tracks_same_persisted_first_reservation", async () => {
      const f = await fixture(), before=await snapshot(f), row=(await portalRead(f)).find(row=>row.id===f.rewardId);
      assert.equal(row.can_claim,true); assert.equal(row.claimIntent,"portal-first-reservation.v1"); assert.equal(row.claim_unavailable_reason,null); assert.equal(row.program_points_balance,100); assert.deepEqual(await snapshot(f),before);
      assert.equal((await claimHttp(f).post()).status,200); const after=(await portalRead(f)).find(row=>row.id===f.rewardId);
      assert.equal(after.can_claim,false); assert.equal(Object.hasOwn(after,"claimIntent"),false); assert.equal(after.state,"claimed"); assert.equal(after.program_points_balance,60); assert.equal(after.points_spent,40);
    });
    await check("claimChecks","legacy_object_locale_preserves_own_business_contract_without_price_manufacture",async()=>{
      for(const body of [{},{locale:"es-AR"},{locale:"en-US",expectedPointsCost:"ignored-legacy-extra",consumerHttpClaim:false},{portalFirstClaim:{expectedPointsCost:0},tenantId:randomUUID(),consumerHttpClaim:false}]) {
        const f=await fixture();
        await admin.query("UPDATE "+s+".rewards SET redemption_limit_per_member=1,fulfillment_json='{\"pickup\":\"appointment\"}'::jsonb WHERE id=$1",[f.rewardId]);
        const response=await claimHttp(f).post(body);assert.equal(response.status,200);const result=await response.json();
        assert.equal(result.duplicate,false);assert.equal(result.claim.points_spent,40);
        assert.equal(result.claim.metadata_json.locale,typeof body.locale==="string"?body.locale.slice(0,12):"es-AR");
        const state=await snapshot(f);assert.equal(state.loyalty_members[0].points_balance,60);assert.equal(state.points_ledger.length,1);
      }
      for(const denied of ["expired","crm-paused","crm-missing"]) {
        const f=await fixture();
        if(denied==="expired")await admin.query("UPDATE "+s+".rewards SET ends_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.rewardId]);
        else if(denied==="crm-paused")await admin.query("UPDATE "+s+".tenant_consumer_memberships SET status='paused' WHERE id=$1",[f.membershipId]);
        else await admin.query("DELETE FROM "+s+".tenant_consumer_memberships WHERE id=$1",[f.membershipId]);
        const before=await snapshot(f),response=await claimHttp(f).post({locale:"es-AR"});
        assert.equal(response.status,409);assert.deepEqual(await snapshot(f),before);
      }
    });
    await check("claimChecks","legacy_historical_uuid_terminal_and_expiry_replay_preserves_receipt_and_economics",async()=>{
      const f=await issued();
      await admin.query("UPDATE "+s+".rewards SET ends_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.rewardId]);
      await admin.query("UPDATE "+s+".consumer_reward_claims SET metadata_json=jsonb_build_object('expires_at','2020-01-01T00:00:00Z','locale','original') WHERE id=$1",[f.claimId]);
      for(const status of ["claimed","redeemed","cancelled","expired"]) {
        await admin.query("UPDATE "+s+".consumer_reward_claims SET status=$2 WHERE id=$1",[f.claimId,status]);
        const before=await snapshot(f),original=before.consumer_reward_claims[0];
        for(const rewardId of [f.rewardId.toLowerCase(),f.rewardId.toUpperCase()]) {
          const h=claimHttp(f),response=await h.post({locale:"new"}, {},rewardId),body=await response.json();
          assert.equal(response.status,200);assert.equal(body.duplicate,true);assert.equal(body.claim.id,original.id);
          assert.equal(body.claim.idempotency_key,original.idempotency_key);assert.equal(body.claim.redemption_code,original.redemption_code);
          assert.equal(body.claim.status,status);assert.deepEqual(body.claim.metadata_json,original.metadata_json);
          assert.equal(h.calls.sql,1,"Historical legacy recovery ends before the writer");
        }
        assert.deepEqual(await snapshot(f),before);
      }
    });
    await check("claimChecks","legacy_ambiguous_or_mismatched_historical_identity_never_replaced",async()=>{
      for(const kind of ["multiple","tenant-mismatch"]) {
        const f=await issued();
        if(kind==="multiple")await admin.query("INSERT INTO "+s+".consumer_reward_claims(consumer_id,tenant_id,reward_id,status,points_spent,redemption_code,idempotency_key) VALUES($1,$2,$3,'expired',40,$4,$5)",[f.consumerId,f.tenantId,f.rewardId,"QA-"+randomUUID(),"legacy-"+randomUUID()]);
        else await admin.query("UPDATE "+s+".consumer_reward_claims SET tenant_id=$2 WHERE id=$1",[f.claimId,f.otherTenantId]);
        const before=await snapshot(f),h=claimHttp(f),response=await h.post({});
        assert.equal(response.status,409);assert.equal((await response.json()).error,"reward_claim_history_ambiguous");assert.equal(h.calls.sql,1);
        assert.deepEqual(await snapshot(f),before);
      }
    });
    await check("claimChecks","selected_unknown_intent_never_downgrades_to_legacy",async()=>{
      const f=await fixture(),before=await snapshot(f);
      for(const claimIntent of [null,false,0,{},[],"","portal-first-reservation.v2"]) {
        const h=claimHttp(f),response=await h.post({claimIntent,expectedPointsCost:40});
        await deniedBoundary(h,response,400);assert.equal((await response.json()).error,"unsupported_claim_intent");
      }
      assert.deepEqual(await snapshot(f),before);
    });
    await check("claimChecks","campaign_maximum_zero_default_identity_false_and_legacy_refund_remain_real_sql",async()=>{
      const f=await fixture(),before=await snapshot(f),query=serializableAdapter(first),paidKey="qa-campaign-paid:"+randomUUID();
      const paid=await writer.insertConsumerRewardClaim(query,{consumerId:f.consumerId,rewardId:f.rewardId,idempotencyKey:paidKey,redemptionCode:"QA-"+randomUUID(),locale:"es-AR",maximumPointsCost:0});
      assert.deepEqual(paid,[]);assert.deepEqual(await snapshot(f),before);
      await admin.query("UPDATE "+s+".rewards SET points_cost=0 WHERE id=$1",[f.rewardId]);
      const freeKey="qa-campaign-free:"+randomUUID(),input={consumerId:f.consumerId,rewardId:f.rewardId,idempotencyKey:freeKey,redemptionCode:"QA-"+randomUUID(),locale:"es-AR",maximumPointsCost:0,metadata:{campaign:"synthetic-only"}};
      const free=await writer.insertConsumerRewardClaim(query,input);assert.equal(free.length,1);assert.equal(free[0].points_spent,0);
      const once=await snapshot(f);assert.deepEqual(await writer.insertConsumerRewardClaim(query,input),[]);assert.deepEqual(await snapshot(f),once);
      // A different campaign key keeps its historic default-false identity behaviour.
      const other=await writer.insertConsumerRewardClaim(query,{...input,idempotencyKey:"qa-campaign-free:"+randomUUID(),redemptionCode:"QA-"+randomUUID()});
      assert.equal(other.length,1);const freeState=await snapshot(f);assert.equal(freeState.loyalty_members[0].points_balance,100);assert.equal(freeState.points_ledger.length,2);assert.equal(freeState.consumer_reward_claims.length,2);
      const r=await fixture(),claimedResponse=await claimHttp(r).post({}),claimed=(await claimedResponse.json()).claim;
      assert.equal(claimedResponse.status,200);const refundInput={consumerId:r.consumerId,claimId:claimed.id,rewardId:r.rewardId,idempotencyKey:"qa-refund:"+claimed.id};
      const refund=await writer.refundConsumerRewardClaim(query,refundInput);assert.equal(refund.length,1);assert.equal(refund[0].status,"cancelled");
      const restored=await snapshot(r);assert.equal(restored.loyalty_members[0].points_balance,100);assert.equal(restored.rewards.find(row=>row.id===r.rewardId).stock_remaining,2);
      assert.equal(restored.points_ledger.length,2);assert.equal(restored.points_ledger.reduce((sum,row)=>sum+row.delta,0),0);
      assert.deepEqual(await writer.refundConsumerRewardClaim(query,refundInput),[]);assert.deepEqual(await snapshot(r),restored);
      const replay=await claimHttp(r).post({locale:"new"},{},r.rewardId.toUpperCase()),replayBody=await replay.json();
      assert.equal(replay.status,200);assert.equal(replayBody.duplicate,true);assert.equal(replayBody.claim.id,claimed.id);assert.equal(replayBody.claim.status,"cancelled");assert.deepEqual(await snapshot(r),restored);
    });
    async function portalLockedCase(name, { mutate, expiryWait=false, otherConsumer=false, protocols=["portal","portal"] } = {}) {
      const f=await fixture(); if(otherConsumer) {
        await admin.query("INSERT INTO "+s+".tenant_consumer_memberships(tenant_id,consumer_id,loyalty_program_id,status) VALUES($1,$2,$3,'active')",[f.tenantId,f.otherConsumerId,f.programId]);
        await admin.query("INSERT INTO "+s+".loyalty_members(tenant_id,program_id,consumer_id,status,points_balance,lifetime_points) VALUES($1,$2,$3,'enrolled',100,100)",[f.tenantId,f.programId,f.otherConsumerId]);
        await admin.query("UPDATE "+s+".rewards SET stock_total=1,stock_remaining=1 WHERE id=$1",[f.rewardId]);
      }
      let expiry=null; if(expiryWait) { expiry=(await admin.query("SELECT clock_timestamp()+interval '4 seconds' AS value")).rows[0].value; await admin.query("UPDATE "+s+".rewards SET ends_at=$2 WHERE id=$1",[f.rewardId,expiry]); }
      const before=await snapshot(f); let pending, inTransaction=false, releasePrereads;
      const ready = new Set(), gate = new Promise(resolve => { releasePrereads=resolve; });
      const firstReadHook = index => async () => {
        if (ready.has(index)) return;
        ready.add(index);
        await gate;
      };
      const payload = protocol => protocol === "portal"
        ? {claimIntent:"portal-first-reservation.v1",expectedPointsCost:40} : {};
      assert.ok(protocols.length===2 && protocols.every(value=>["legacy","portal"].includes(value)));
      const deadline=Date.now()+8000;
      try {
        const secondActor=otherConsumer?{...f,consumerId:f.otherConsumerId}:f;
        pending=Promise.allSettled([
          claimHttp(f,first,{afterOwnReadback:firstReadHook(0)}).post(payload(protocols[0]),{},f.rewardId.toUpperCase()),
          claimHttp(secondActor,second,{afterOwnReadback:firstReadHook(1)}).post(payload(protocols[1]),{},f.rewardId.toLowerCase())
        ]);
        while(Date.now()<deadline && ready.size!==2) await new Promise(resolve=>setTimeout(resolve,15));
        assert.equal(ready.size,2,"Both real absent-read transactions must commit before the writer race");
        await admin.query("BEGIN");inTransaction=true;await admin.query("SELECT id FROM "+s+".rewards WHERE id=$1 FOR UPDATE",[f.rewardId]);
        releasePrereads();
        let rows;while(Date.now()<deadline){rows=await waitRows(expiry);if(rows.length===2)break;await new Promise(resolve=>setTimeout(resolve,15));}assertBlockers(rows);
        if(expiryWait){assert.ok(rows.every(row=>row.started_before_expiry&&row.before_expiry));while(Date.now()<deadline&&(await admin.query("SELECT clock_timestamp() < $1::timestamptz AS before",[expiry])).rows[0].before)await new Promise(resolve=>setTimeout(resolve,15));assert.equal((await admin.query("SELECT clock_timestamp() >= $1::timestamptz AS reached",[expiry])).rows[0].reached,true);}
        await mutate?.(f); await admin.query("COMMIT");inTransaction=false;
        const responses=(await pending).map(result=>{assert.equal(result.status,"fulfilled");return result.value;});const bodies=await Promise.all(responses.map(response=>response.json()));
        const after=await snapshot(f); if(mutate||expiryWait) { assert.ok(responses.every(response=>response.status===409));assert.equal(after.points_ledger.length,0);assert.equal(after.consumer_reward_claims.length,0);assert.deepEqual(after.loyalty_members,before.loyalty_members);assert.equal(after.rewards.find(row=>row.id===f.rewardId).stock_remaining,before.rewards.find(row=>row.id===f.rewardId).stock_remaining); }
        else { assert.equal(after.consumer_reward_claims.length,1);assert.equal(after.points_ledger.length,1);assert.equal(after.points_ledger[0].delta,-40);assert.equal(after.rewards.find(row=>row.id===f.rewardId).stock_remaining,otherConsumer?0:1);assert.equal(after.loyalty_members.reduce((sum,row)=>sum+row.points_balance,0),otherConsumer?160:60);
          if(otherConsumer)assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);else {assert.ok(responses.every(response=>response.status===200));assert.equal(bodies.filter(body=>body.duplicate===false).length,1);assert.equal(bodies.filter(body=>body.duplicate===true).length,1);assert.equal(bodies[0].claim.id,bodies[1].claim.id);assert.equal(bodies[0].claim.idempotency_key,bodies[1].claim.idempotency_key);} }
        report.portalLockObservations.push({name,waitingBackends:2,waitEventType:"Lock",blockedByOwnedRewardLock:true,wallClockExpiryReached:expiryWait,protocols:[...protocols],absentPrereadsCommitted:2,mutationRequests:2,automaticMutationRetries:0});
      } finally {releasePrereads?.();if(inTransaction)await admin.query("ROLLBACK");if(pending)await pending;}
    }
    await check("claimChecks","portal_uuid_case_race_reserves_once_under_serializable",()=>portalLockedCase("uuid-case"));
    await check("claimChecks","portal_price_changed_while_both_requests_wait_refuses_debit",()=>portalLockedCase("price-change",{mutate:async f=>admin.query("UPDATE "+s+".rewards SET points_cost=70 WHERE id=$1",[f.rewardId])}));
    await check("claimChecks","portal_expiry_reached_while_both_requests_wait_refuses_debit",()=>portalLockedCase("expiry",{expiryWait:true}));
    await check("claimChecks","portal_last_unit_two_owned_consumers_reserves_once",()=>portalLockedCase("last-unit",{otherConsumer:true}));

    await check("claimChecks","legacy_uuid_case_race_reserves_once_under_same_serializable_writer",()=>portalLockedCase("legacy-uuid-case",{protocols:["legacy","legacy"]}));
    await check("claimChecks","legacy_and_portal_race_share_one_historical_receipt_under_same_lock",()=>portalLockedCase("mixed-uuid-case",{protocols:["legacy","portal"]}));

    assert.equal(report.claimChecks.length,REWARD_HTTP_POSTGRES_EXPECTED.claimChecks);assert.equal(report.adminChecks.length,REWARD_HTTP_POSTGRES_EXPECTED.adminChecks);
    assert.equal(report.lockObservations.length,REWARD_HTTP_POSTGRES_EXPECTED.lockObservations);assert.equal(report.lockObservations.filter(r=>r.wallClockExpiryReached).length,1);
    assert.equal(report.portalLockObservations.length, REWARD_HTTP_POSTGRES_EXPECTED.portalLockObservations);
    assert.ok(report.portalLockObservations.every(row => row.waitingBackends === 2 && row.blockedByOwnedRewardLock && row.automaticMutationRetries === 0));
    assert.ok(report.serializableIsolationObservations.length > 0 && report.serializableIsolationObservations.every(mode => mode === "serializable"));
    assert.ok(report.serializationConflicts > 0);
    assert.ok(report.sqlExecutions.claim>0&&report.sqlExecutions.admin>0);report.ok=[...report.claimChecks,...report.adminChecks].every(check=>check.ok);
  } catch(error) {executionError=error;}
  finally {
    if(schemaCreated){try{await clients[0].query("ROLLBACK");await clients[0].query("DROP SCHEMA "+identifier(schema)+" CASCADE");report.cleanup.schemaDropped=true;}catch{report.cleanup.error="Could not drop the harness generated schema";report.ok=false;}}
    const closed=await Promise.allSettled(clients.map(async client=>{if(typeof client.release==="function")await client.release(true);else if(typeof client.end==="function")await client.end();else throw Error("Client cannot close");}));report.cleanup.connectionsClosed=closed.every(row=>row.status==="fulfilled");if(!report.cleanup.connectionsClosed)report.ok=false;
  }
  if(executionError)throw executionError;
  return report;
}
