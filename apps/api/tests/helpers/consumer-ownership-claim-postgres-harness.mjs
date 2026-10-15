import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { assertQaPostgresClientIdentity } from "./ownership-current-state-postgres-harness.mjs";

export const OWNERSHIP_CLAIM_POSTGRES_CASE_NAMES = Object.freeze([
  "positive_valid_closed_commits_four_collections",
  "positive_valid_opened_commits_four_collections",
  "legacy_null_lifecycle_preserves_authenticated_hardware_opened",
  "preflight_new_inactive_keeps_legacy_revoked_audit_separate",
  "preflight_new_suspended_keeps_legacy_revoked_audit_separate",
  "preflight_new_quarantined_keeps_legacy_revoked_audit_separate",
  "preflight_new_lost_keeps_legacy_revoked_audit_separate",
  "preflight_new_expired_keeps_legacy_revoked_audit_separate",
  "preflight_new_broken_keeps_legacy_revoked_audit_separate",
  "preflight_new_tampered_keeps_legacy_revoked_audit_separate",
  "preflight_new_revoked_keeps_legacy_revoked_audit_separate",
  "preflight_new_unknown_keeps_legacy_revoked_audit_separate",
  "preflight_new_empty_keeps_legacy_revoked_audit_separate",
  "preflight_existing_inactive_keeps_legacy_revoked_audit_separate",
  "preflight_existing_suspended_keeps_legacy_revoked_audit_separate",
  "preflight_existing_quarantined_keeps_legacy_revoked_audit_separate",
  "preflight_existing_lost_keeps_legacy_revoked_audit_separate",
  "preflight_existing_expired_keeps_legacy_revoked_audit_separate",
  "preflight_existing_broken_keeps_legacy_revoked_audit_separate",
  "preflight_existing_tampered_keeps_legacy_revoked_audit_separate",
  "preflight_existing_revoked_keeps_legacy_revoked_audit_separate",
  "preflight_existing_unknown_keeps_legacy_revoked_audit_separate",
  "preflight_existing_empty_keeps_legacy_revoked_audit_separate",
  "preflight_inactive_status_active_lifecycle_audits_revoked_without_associations",
  "preflight_ambiguous_uid_audits_revoked_without_associations",
  "preflight_replay_audits_revoked_without_associations",
  "preflight_unknown_result_audits_revoked_without_associations",
  "preflight_manual_event_audits_revoked_without_associations",
  "preflight_manual_override_audits_revoked_without_associations",
  "missing_tag_does_not_claim_an_unrelated_batch",
  "changed_event_tenant_preflight_does_not_grant_title",
  "changed_event_batch_preflight_does_not_grant_title",
  "changed_batch_tenant_preflight_does_not_grant_title",
  "absent_tenant_policy_keeps_nullable_server_revision_contract",
  "server_snapshot_tenantId_mismatch_denies_without_writes",
  "server_snapshot_batchId_mismatch_denies_without_writes",
  "server_snapshot_bid_mismatch_denies_without_writes",
  "server_snapshot_uidHex_mismatch_denies_without_writes",
  "server_snapshot_readCounter_mismatch_denies_without_writes",
  "server_snapshot_tagId_mismatch_denies_without_writes",
  "server_snapshot_tagRevision_mismatch_denies_without_writes",
  "other_title_owner_fresh_denies_without_writes",
  "other_title_owner_existing_associations_denies_without_writes",
  "membership_inactive_is_not_reactivated_or_partially_claimed",
  "membership_blocked_is_not_reactivated_or_partially_claimed",
  "membership_left_is_not_reactivated_or_partially_claimed",
  "own_revoked_event_wrong_tenant_is_not_silently_repaired",
  "own_revoked_event_wrong_batch_is_not_silently_repaired",
  "own_revoked_event_wrong_uid_is_not_silently_repaired",
  "own_claimed_uid_wrong_tag_is_not_silently_repaired",
  "own_claimed_uid_wrong_batch_is_not_silently_repaired",
  "own_claimed_founder_wrong_uid_is_not_silently_repaired",
  "same_owner_same_event_has_one_stable_title_and_history",
  "same_owner_later_event_preserves_founder_title_and_acquisition",
  "existing_membership_program_balances_and_first_fields_are_preserved",
  "new_claim_membership_current_program_window_is_respected",
  "new_claim_membership_future_program_window_is_respected",
  "new_claim_membership_expired_program_window_is_respected",
  "new_claim_membership_evergreen_program_window_is_respected",
  "consumer_product_ownerships_raise_rolls_back_four_collections",
  "consumer_product_ownerships_suppress_rolls_back_four_collections",
  "consumer_tap_history_raise_rolls_back_four_collections",
  "consumer_tap_history_suppress_rolls_back_four_collections",
  "consumer_products_raise_rolls_back_four_collections",
  "consumer_products_suppress_rolls_back_four_collections",
  "existing_title_product_update_failure_preserves_all_prior_rows",
  "existing_exact_history_allows_idempotency_when_insert_is_suppressed",
  "tag_revision_changed_during_tag_wait",
  "counter_changed_during_event_wait",
  "batch_policy_changed_during_batch_wait",
  "tenant_policy_changed_during_policy_wait",
  "membership_inactivated_during_wait_is_revalidated",
  "manual_override_committed_during_tag_wait_denies_associations",
  "pos_expiring_during_tag_wait_is_rechecked_after_wait",
  "concurrent_two_claimants_have_one_winner_without_loser_associations",
  "concurrent_same_owner_keeps_one_title",
  "claim_holding_tag_lock_serializes_later_lifecycle_transition",
  "canonical_failure_after_commit_retains_positive_committed_signal"
]);
export const OWNERSHIP_CLAIM_POSTGRES_EXPECTED = Object.freeze({ checks: OWNERSHIP_CLAIM_POSTGRES_CASE_NAMES.length, lockObservations: 10 });

const OWN_SCHEMA = /^consumer_claim_atomic_qa_[0-9a-f]{32}$/;

// No connections, configuration or application imports occur at import time.
// The caller supplies already-connected clients to an empty local QA database.
export async function runConsumerOwnershipClaimPostgresQa({ connect, dockerAttestation } = {}) {
  assert.equal(typeof connect, "function", "An explicit disposable QA connection factory is required");
  const schema = `consumer_claim_atomic_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, OWN_SCHEMA);
  const s = `"${schema}"`, clients = [], pids = [];
  const currentClient = new AsyncLocalStorage();
  const lockKey = randomBytes(6).readUIntBE(0, 6);
  const report = {
    kind: "synthetic-postgresql-transactional-ownership-claim", ok: false, schema,
    checks: [], lockObservations: [], connectionEvidence: [], serializationConflicts: 0,
    coreStatements: [], legacyAuditStatements: [], compatibilitySeedsSkipped: 0, coreCommits: 0, coreRollbacks: 0, postCommitBeforeCommitViolations: 0, postCommit: { canonical: 0, realtime: 0 }, sources: [],
    cleanup: { schemaDropped: false, connectionsClosed: false },
    limits: [
      "Actual service source and SQL execute in a synthetic minimal schema, not production migrations or customer rows",
      "SERIALIZABLE adapter covers only the actual compound statement, never an artificial transaction around the JavaScript caller",
      "Route authentication, fresh capability, PIN and server approval are not certified by these service fixtures",
      "Only canonical and realtime dependencies are synthetic post-commit stubs; they require an observed core COMMIT",
      "FOR SHARE behavior is exercised with the dedicated CI fixture owner; production role ACLs for tenant policy/POS tables are not certified",
      "Preflight-blocked legacy audit writes revoked title separately; strict denials after a valid snapshot do not touch the four collections",
      "Lock graphs identify owned backends, not an inferred CTE stage; conflict counts are observations",
      "No external effect, NFC, OTP, customer request, copied business SQL or synthetic successful SQL receipt is used",
      "Duplicate UID fixtures omit production global tag uniqueness; active title uniqueness and its exact constraint name are reproduced",
    ],
  };
  let schemaCreated = false, removeExecutor, nextEvent = 900001;
  try {
    let database;
    for (let i = 0; i < 3; i += 1) {
      const client = await connect();
      clients.push(client);
      assert.ok(typeof client?.query === "function" && typeof client?.end === "function");
      assert.equal(clients.filter(row => row === client).length, 1, "Distinct QA clients required");
      const { rows: [identity] } = await client.query("SELECT current_database() AS database, current_user AS role, pg_backend_pid() AS pid, host(inet_server_addr()) AS address, current_setting('server_version_num')::integer AS server_version_number, current_setting('neon.endpoint_id', true) AS neon_endpoint_id, current_setting('transaction_read_only') AS transaction_read_only");
      report.connectionEvidence.push(assertQaPostgresClientIdentity(client, identity, { dockerAttestation }));
      database ??= identity.database;
      assert.equal(identity.database, database, "All clients must use the same QA database");
      assert.ok(Number.isInteger(identity.pid) && !pids.includes(identity.pid), "Separate PostgreSQL backends required");
      pids.push(identity.pid);
    }
    const [admin, first, second] = clients;
    const db = await import("../../src/lib/db.ts");

    const { getTapEvent } = await import("../../src/lib/loyalty-service.ts");
    await admin.query(`CREATE SCHEMA ${s}`);
    schemaCreated = true;
    for (const client of clients) {
      await client.query(`SET search_path TO ${s}, pg_catalog`);
      await client.query("SELECT set_config('statement_timeout','12000',false), set_config('lock_timeout','10000',false)");
      assert.equal((await client.query("SELECT current_schema() AS schema")).rows[0].schema, schema);
    }
    await admin.query(`
      CREATE TABLE ${s}.schema_migrations(id text PRIMARY KEY);
      CREATE TABLE ${s}.tenants(id uuid PRIMARY KEY, slug text);
      CREATE TABLE ${s}.batches(id uuid PRIMARY KEY, tenant_id uuid, bid text);
      CREATE TABLE ${s}.tags(id uuid PRIMARY KEY, batch_id uuid, uid_hex text, status text DEFAULT 'active', lifecycle_state text DEFAULT 'active', created_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.tag_profiles(tag_id uuid, product_name text, sku text, winery text, region text, grape_varietal text, image_url text);
      CREATE TABLE ${s}.tag_manual_tamper_overrides(batch_id uuid, uid_hex text, tamper_status text, reason text, source text, updated_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.events(id bigint PRIMARY KEY, tenant_id uuid, batch_id uuid, uid_hex text, sdm_read_ctr integer DEFAULT 1, result text, reason text, created_at timestamptz DEFAULT now(), city text, country_code text, geo_lat float, geo_lng float);
      CREATE TABLE ${s}.loyalty_programs(id uuid PRIMARY KEY, tenant_id uuid, status text, start_at timestamptz DEFAULT now(), end_at timestamptz, created_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.tenant_consumer_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, consumer_id uuid, loyalty_program_id uuid, source text, first_tap_event_id bigint, last_tap_event_id bigint, status text, points_balance integer DEFAULT 0, lifetime_points integer DEFAULT 0, last_activity_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(tenant_id,consumer_id));
      CREATE TABLE ${s}.consumer_tap_history(id bigserial PRIMARY KEY, consumer_id uuid, tenant_id uuid, tap_event_id bigint, verdict text, risk_level text, city text, country text, UNIQUE(consumer_id,tap_event_id));
      CREATE TABLE ${s}.consumer_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), consumer_id uuid, tenant_id uuid, product_passport_id text, tag_id uuid, first_tap_event_id bigint, latest_tap_event_id bigint, ownership_status text DEFAULT 'viewed', collection_type text, product_name text, brand_name text, image_url text, acquired_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.tenant_sun_profiles(tenant_id uuid PRIMARY KEY, claim_policy text);
      CREATE TABLE ${s}.sdk_pos_activations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, batch_id uuid, tag_id uuid, uid_hex text, activation_status text, expires_at timestamptz);
      CREATE TABLE ${s}.consumer_product_ownerships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, consumer_id uuid NOT NULL, batch_id uuid NOT NULL, tag_id uuid, uid_hex text NOT NULL, event_id bigint NOT NULL, status text NOT NULL CHECK(status IN ('claimed','blocked_replay','revoked','disputed')), source text NOT NULL, trust_snapshot jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(consumer_id,event_id));
      CREATE UNIQUE INDEX uq_consumer_product_ownerships_active_uid ON ${s}.consumer_product_ownerships(tenant_id,uid_hex) WHERE status='claimed';
      CREATE TABLE ${s}.collection_fixture_faults(consumer_id uuid PRIMARY KEY, mode text NOT NULL);
      CREATE FUNCTION ${s}.hold_product_insert() RETURNS trigger LANGUAGE plpgsql AS $fixture$
      BEGIN
        IF EXISTS (SELECT 1 FROM ${s}.collection_fixture_faults WHERE consumer_id=NEW.consumer_id AND mode=TG_TABLE_NAME||':raise') THEN
          RAISE EXCEPTION 'synthetic product write failure' USING ERRCODE='P0001';
        END IF;
        IF EXISTS (SELECT 1 FROM ${s}.collection_fixture_faults WHERE consumer_id=NEW.consumer_id AND mode=TG_TABLE_NAME||':suppress') THEN RETURN NULL; END IF;
        IF TG_TABLE_NAME='consumer_products' AND TG_OP='INSERT' THEN PERFORM pg_advisory_xact_lock(${lockKey}); END IF;
        RETURN NEW;
      END; $fixture$;
      CREATE TRIGGER collection_overlap BEFORE INSERT OR UPDATE ON ${s}.consumer_products FOR EACH ROW EXECUTE FUNCTION ${s}.hold_product_insert();
      CREATE TRIGGER claim_title_fault BEFORE INSERT OR UPDATE ON ${s}.consumer_product_ownerships FOR EACH ROW EXECUTE FUNCTION ${s}.hold_product_insert();
      CREATE TRIGGER claim_history_raise BEFORE INSERT ON ${s}.consumer_tap_history FOR EACH ROW EXECUTE FUNCTION ${s}.hold_product_insert();
      CREATE FUNCTION ${s}.suppress_history_insert() RETURNS trigger LANGUAGE plpgsql AS $fixture$
      BEGIN
        IF EXISTS (SELECT 1 FROM ${s}.collection_fixture_faults WHERE consumer_id=NEW.consumer_id AND mode='consumer_tap_history:suppress') THEN RETURN NULL; END IF;
        RETURN NEW;
      END; $fixture$;
      CREATE TRIGGER collection_history_fault BEFORE INSERT ON ${s}.consumer_tap_history FOR EACH ROW EXECUTE FUNCTION ${s}.suppress_history_insert();
    `);
    await admin.query(`INSERT INTO ${s}.schema_migrations(id) SELECT unnest($1::text[])`, [[...db.DEFAULT_REQUIRED_SCHEMA_MIGRATIONS]]);

    removeExecutor = db.installEphemeralE2eSqlExecutor(async (strings, ...values) => {
      const text = strings.reduce((result, part, i) => result + (i ? `$${i}` : "") + part, "");
      assert.doesNotMatch(text, /\bpublic\s*\./i);
      if (!/FROM schema_migrations/.test(text) && /commercial-runtime-schema\.[cm]?[jt]s/.test(new Error().stack || "")) { report.compatibilitySeedsSkipped += 1; return []; }
      const context = currentClient.getStore(), client = context?.client || first;
      if (/WITH locked_event AS MATERIALIZED/.test(text) && /written_membership AS/.test(text) && /INSERT INTO consumer_product_ownerships/.test(text)) {
        assert.ok(context, "Core needs an explicit owned call context"); context.coreAttempts += 1;
        for (const table of ["consumer_tap_history", "consumer_products"]) assert.ok(text.includes(`INSERT INTO ${table}`));
        report.coreStatements.push({ sha256: createHash("sha256").update(text).digest("hex"), parameters: values.length, pid: pids[clients.indexOf(client)], isolation: "serializable", scope: "ownership-membership-history-product" });
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE"); context.inTransaction = true;
        try {
          assert.equal((await client.query("SHOW transaction_isolation")).rows[0].transaction_isolation, "serializable");
          const result = await client.query(text, values);
          await client.query("COMMIT"); context.inTransaction = false; context.commits += 1; report.coreCommits += 1;
          return result.rows;
        } catch (error) {
          await client.query("ROLLBACK"); context.inTransaction = false; report.coreRollbacks += 1;
          if (error.code === "40001") report.serializationConflicts += 1;
          throw error;
        }
      }
      if (/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+(?:consumer_product_ownerships|tenant_consumer_memberships|consumer_tap_history|consumer_products)\b/.test(text)) {
        assert.equal(context?.legacyAudit, true, "All positive claim writes must be compound");
        assert.ok(/WITH current_tag AS MATERIALIZED/.test(text) && /INSERT INTO consumer_product_ownerships/.test(text) || /^\s*UPDATE consumer_products/.test(text), "Only existing blocked-audit writes may be separate");
        report.legacyAuditStatements.push({ sha256: createHash("sha256").update(text).digest("hex"), scope: "preflight-blocked-legacy-revoked-audit" });
      }
      return (await client.query(text, values)).rows;
    }, { NODE_ENV: "test", VERCEL_ENV: "test", NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE", NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e_claim_atomic" }, { migrationManaged: true });
    const service = readFileSync(new URL("../../src/lib/consumer-portal-service.ts", import.meta.url));
    report.sources.push({ path: "apps/api/src/lib/consumer-portal-service.ts", sha256: createHash("sha256").update(service).digest("hex") });
    const ts = createRequire(import.meta.url)("typescript");
    const code = ts.transpileModule(service.toString("utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const dependencies = {
      "./db": db, "./loyalty-service": await import("../../src/lib/loyalty-service.ts"),
      "./ownership-policy": await import("../../src/lib/ownership-policy.ts"),
      "./commercial-runtime-schema": await import("../../src/lib/commercial-runtime-schema.ts"),
      "./tap-commercial-rights": await import("../../src/lib/tap-commercial-rights.ts"),
      "./canonical-event-writer": { CanonicalEventWriteError: class extends Error {}, async writeCanonicalEvent(input) {
        const context = publication("canonical"); context.canonicalInputs.push(structuredClone(input));
        if (context.canonicalFailure) throw new Error("synthetic post-commit canonical failure");
        return { webhookOutbox: { status: "queued", synthetic: true } };
      } },
      "./realtime-tap-projection": { async publishTenantTapRealtimeProjection() { publication("realtime"); return { projected: true, distributed: true, synthetic: true }; } },
    };
    function publication(kind) {
      const context = currentClient.getStore();
      if (!(context && !context.inTransaction && context.commits > 0)) report.postCommitBeforeCommitViolations += 1;
      assert.ok(context && !context.inTransaction && context.commits > 0, "Publication must follow actual core COMMIT");
      report.postCommit[kind] += 1; context.publications[kind] += 1;
      return context;
    }
    const module = { exports: {} };
    new Function("require", "module", "exports", code)(name => { assert.ok(Object.hasOwn(dependencies, name), `Unexpected service dependency ${name}`); return dependencies[name]; }, module, module.exports);
    const { claimOwnershipForConsumer } = module.exports;

    async function fixture({ result = "VALID_CLOSED", policy = true } = {}) {
      const f = { tenantId: randomUUID(), consumerId: randomUUID(), otherConsumerId: randomUUID(), batchId: randomUUID(), tagId: randomUUID(), uid: "04AABB" + randomBytes(4).toString("hex").toUpperCase(), eventIds: [String(nextEvent++), String(nextEvent++)] };
      await admin.query(`INSERT INTO ${s}.tenants VALUES($1,'synthetic-claim-brand')`, [f.tenantId]);
      await admin.query(`INSERT INTO ${s}.batches VALUES($1,$2,$3)`, [f.batchId,f.tenantId,"SYNTHETIC-"+f.batchId]);
      await admin.query(`INSERT INTO ${s}.tags(id,batch_id,uid_hex) VALUES($1,$2,$3)`, [f.tagId,f.batchId,f.uid]);
      await admin.query(`INSERT INTO ${s}.tag_profiles(tag_id,product_name,winery) VALUES($1,'Synthetic claimed product','Synthetic brand')`, [f.tagId]);
      if (policy) await admin.query(`INSERT INTO ${s}.tenant_sun_profiles VALUES($1,'inside_pack_secret')`, [f.tenantId]);
      for (const id of f.eventIds) await admin.query(`INSERT INTO ${s}.events(id,tenant_id,batch_id,uid_hex,result) VALUES($1,$2,$3,$4,$5)`, [id,f.tenantId,f.batchId,f.uid,result]);
      return f;
    }
    async function captured(f,eventId=f.eventIds[0]) {
      const event=await getTapEvent(eventId);assert.ok(event);
      const row=(await admin.query(`SELECT tag.xmin::text AS tag_revision,batch.xmin::text AS batch_revision,policy.xmin::text AS policy_revision FROM ${s}.tags tag JOIN ${s}.batches batch ON batch.id=tag.batch_id LEFT JOIN ${s}.tenant_sun_profiles policy ON policy.tenant_id=batch.tenant_id WHERE tag.id=$1`,[f.tagId])).rows[0];assert.ok(row);
      return {expected:{tenantId:event.tenant_id,batchId:event.batch_id,bid:event.bid,uidHex:event.uid_hex,readCounter:event.sdm_read_ctr,tagId:event.current_tag_id,tagRevision:event.current_tag_revision},authorization:{tagRevision:row.tag_revision,batchRevision:row.batch_revision,tenantPolicyRevision:row.policy_revision,posRequired:false}};
    }
    async function invoke(f,{client=first,eventId=f.eventIds[0],consumerId=f.consumerId,snapshot,canonicalFailure=false,legacyAudit=false}={}) {
      const input=snapshot||await captured(f,eventId),context={client,commits:0,coreAttempts:0,inTransaction:false,canonicalFailure,legacyAudit,canonicalInputs:[],publications:{canonical:0,realtime:0}};
      try { const result=await currentClient.run(context,()=>claimOwnershipForConsumer({consumerId,eventId,source:"sun_passport",...input}));return {result,context}; } finally { assert.ok(context.coreAttempts<=3,"Only the rolled-back core may retry at most three times"); assert.ok(context.publications.canonical<=1,"Canonical is outside core retries"); }
    }
    async function state(f) {
      const result={};for(const table of ["consumer_product_ownerships","tenant_consumer_memberships","consumer_tap_history","consumer_products"])result[table]=(await admin.query(`SELECT * FROM ${s}.${table} WHERE tenant_id=$1 OR consumer_id=ANY($2::uuid[]) ORDER BY id`,[f.tenantId,[f.consumerId,f.otherConsumerId]])).rows;return result;
    }
    async function membership(f,{consumerId=f.consumerId,status="active",programId=null}={}) {
      const id=randomUUID();await admin.query(`INSERT INTO ${s}.tenant_consumer_memberships(id,tenant_id,consumer_id,loyalty_program_id,source,first_tap_event_id,last_tap_event_id,status,points_balance,lifetime_points,last_activity_at,updated_at) VALUES($1,$2,$3,$4,'fixture-founder',$5,$5,$6,13,29,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`,[id,f.tenantId,consumerId,programId,f.eventIds[0],status]);return id;
    }
    async function title(f,{consumerId=f.consumerId}={}) {
      const id=randomUUID();await admin.query(`INSERT INTO ${s}.consumer_product_ownerships(id,tenant_id,consumer_id,batch_id,tag_id,uid_hex,event_id,status,source,trust_snapshot,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,'claimed','fixture-founder','{"founder":true}','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`,[id,f.tenantId,consumerId,f.batchId,f.tagId,f.uid,f.eventIds[0]]);return id;
    }
    async function associated(f) {
      await membership(f);await admin.query(`INSERT INTO ${s}.consumer_tap_history(consumer_id,tenant_id,tap_event_id) VALUES($1,$2,$3)`,[f.consumerId,f.tenantId,f.eventIds[0]]);
      await admin.query(`INSERT INTO ${s}.consumer_products(consumer_id,tenant_id,product_passport_id,tag_id,first_tap_event_id,latest_tap_event_id,ownership_status,acquired_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5,'claimed','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`,[f.consumerId,f.tenantId,f.uid,f.tagId,f.eventIds[0]]);
    }
    async function denied(f,options={},error) {
      const before=await state(f),effects={...report.postCommit},out=await invoke(f,options);
      assert.equal(out.result.ok,false);assert.equal(out.result.status,409);if(error)assert.equal(out.result.error,error);assert.equal(out.result.ownership??null,null);
      assert.deepEqual(await state(f),before,"Strict denial preserves complete four-table snapshots, including timestamps");assert.deepEqual(report.postCommit,effects);return out.result;
    }
    async function check(name,operation) {
      assert.ok(OWNERSHIP_CLAIM_POSTGRES_CASE_NAMES.includes(name), "Unregistered claim case");
      try{await operation();}catch(error){const safeName=name.replace(/[^a-z0-9_]/gi,"_").slice(0,200),assertion=error instanceof assert.AssertionError,code=assertion?"ERR_ASSERTION":typeof error?.code==="string"&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:"unclassified";throw new Error(`consumer_claim_atomic_case_failed:${safeName};completed_checks=${report.checks.length};code=${code}`,{cause:error});}report.checks.push({name,passed:true});
    }
    async function waitForOwnedBlock(writerPid,blockerPid,queryPattern=/WITH locked_event AS MATERIALIZED/) {
      const until=Date.now()+6000;while(Date.now()<until){await admin.query("SELECT pg_stat_clear_snapshot()");const row=(await admin.query("SELECT pid,wait_event_type,pg_blocking_pids(pid) AS blockers,query,query_start FROM pg_stat_activity WHERE pid=$1",[writerPid])).rows[0];if(row?.wait_event_type==="Lock"&&row.blockers.includes(blockerPid)){assert.match(row.query,queryPattern);return {writerPid,blockerPid,observed:true,waitEventType:"Lock",observedQuerySha256:createHash("sha256").update(row.query).digest("hex"),queryTextMayBeTruncated:true,queryStartedAt:row.query_start};}await new Promise(resolve=>setTimeout(resolve,20));}assert.fail("Expected owned claim core lock was not observed");
    }
    async function locked(f,name,prepare,{snapshot,beforeRelease}={}) {
      const input=snapshot||await captured(f);let pending,error,observation;await admin.query("BEGIN");
      try{await prepare();pending=Promise.allSettled([invoke(f,{snapshot:input})]);observation=await waitForOwnedBlock(pids[1],pids[0]);await beforeRelease?.(observation);report.lockObservations.push({case:name,observed:true,waitEventType:"Lock",graph:[observation],barrier:"fixture-only-owned-row-lock"});}catch(e){error=e;}finally{await admin.query(error?"ROLLBACK":"COMMIT");}
      const results=pending?await pending:[];if(error)throw error;assert.equal(results.length,1);if(results[0].status==="rejected")throw results[0].reason;return results[0].value;
    }

    for(const result of ["VALID_CLOSED","VALID_OPENED"])await check(`positive_${result.toLowerCase()}_commits_four_collections`,async()=>{
      const f=await fixture({result}),out=await invoke(f),rows=await state(f);assert.equal(out.result.ok,true);assert.equal(out.result.ownership.status,"claimed");
      for(const table of Object.keys(rows))assert.equal(rows[table].length,1);assert.equal(rows.consumer_products[0].ownership_status,"claimed");assert.equal(rows.tenant_consumer_memberships[0].points_balance,0);
      assert.equal(out.context.commits,1);assert.equal(out.context.publications.canonical,1);assert.equal(out.context.publications.realtime,1);assert.equal(out.result.ownership.nft_transfer_executed,false);assert.equal(out.result.ownership.on_chain_owner_verified,false);
    });
    await check("legacy_null_lifecycle_preserves_authenticated_hardware_opened",async()=>{const f=await fixture({result:"VALID_OPENED"});await admin.query(`UPDATE ${s}.tags SET lifecycle_state=NULL WHERE id=$1`,[f.tagId]);assert.equal((await invoke(f)).result.ok,true);});
    for(const existing of [false,true])for(const lifecycle of ["inactive","suspended","quarantined","lost","expired","broken","tampered","revoked","unknown",""])await check(`preflight_${existing?"existing":"new"}_${lifecycle||"empty"}_keeps_legacy_revoked_audit_separate`,async()=>{
      const f=await fixture();if(existing)await title(f);await admin.query(`UPDATE ${s}.tags SET status=$1,lifecycle_state=$2 WHERE id=$3`,[lifecycle==="revoked"?"revoked":"inactive",lifecycle,f.tagId]);
      const coreBefore=report.coreStatements.length,effects={...report.postCommit},out=await invoke(f,{legacyAudit:true}),rows=await state(f);
      assert.equal(out.result.ok,false);assert.equal(out.result.status,409);assert.equal(rows.consumer_product_ownerships.length,1);assert.equal(rows.consumer_product_ownerships[0].status,"revoked");
      for(const table of ["tenant_consumer_memberships","consumer_tap_history","consumer_products"])assert.deepEqual(rows[table],[]);
      assert.equal(report.coreStatements.length,coreBefore);assert.deepEqual(report.postCommit,effects);
    });
    for(const [name,text,values]of [
      ["inactive_status_active_lifecycle","UPDATE tags SET status='inactive' WHERE id=$1",f=>[f.tagId]],
      ["ambiguous_uid","INSERT INTO tags(id,batch_id,uid_hex) VALUES($1,$2,$3)",f=>[randomUUID(),f.batchId,f.uid.toLowerCase()]],
      ["replay","UPDATE events SET result='REPLAY_SUSPECT' WHERE id=$1",f=>[f.eventIds[0]]],
      ["unknown_result","UPDATE events SET result='VALID_FUTURE_UNKNOWN' WHERE id=$1",f=>[f.eventIds[0]]],
      ["manual_event","UPDATE events SET reason='operator declared open' WHERE id=$1",f=>[f.eventIds[0]]],
      ["manual_override","INSERT INTO tag_manual_tamper_overrides(batch_id,uid_hex,tamper_status,reason) VALUES($1,$2,'OPENED','operator declared open')",f=>[f.batchId,f.uid]],
    ])await check(`preflight_${name}_audits_revoked_without_associations`,async()=>{const f=await fixture();await admin.query(text,values(f));const out=await invoke(f,{legacyAudit:true}),rows=await state(f);assert.equal(out.result.ok,false);assert.equal(out.result.status,409);assert.equal(rows.consumer_product_ownerships[0].status,"revoked");for(const table of ["tenant_consumer_memberships","consumer_tap_history","consumer_products"])assert.deepEqual(rows[table],[]);});
    await check("missing_tag_does_not_claim_an_unrelated_batch",async()=>{
      for(const variant of ["missing","replaced","uid_changed"]){
        const f=await fixture(),snapshot=await captured(f),before=await state(f);
        if(variant==="missing")await admin.query(`DELETE FROM ${s}.tags WHERE id=$1`,[f.tagId]);
        else if(variant==="replaced")await admin.query(`UPDATE ${s}.tags SET id=$1 WHERE id=$2`,[randomUUID(),f.tagId]);
        else await admin.query(`UPDATE ${s}.tags SET uid_hex='04FFFFFFFFFFFF' WHERE id=$1`,[f.tagId]);
        const out=await invoke(f,{snapshot});assert.equal(out.result.ok,false);assert.equal(out.result.error,variant==="replaced"?"tap_context_changed":"tag_not_found");assert.deepEqual(await state(f),before);
      }
    });
    for(const [name,prepare]of [
      ["changed_event_tenant",async f=>{const id=randomUUID();await admin.query(`INSERT INTO ${s}.tenants VALUES($1,'other-fixture-tenant')`,[id]);await admin.query(`UPDATE ${s}.events SET tenant_id=$1 WHERE id=$2`,[id,f.eventIds[0]]);}],
      ["changed_event_batch",f=>admin.query(`UPDATE ${s}.events SET batch_id=$1 WHERE id=$2`,[randomUUID(),f.eventIds[0]])],
      ["changed_batch_tenant",f=>admin.query(`UPDATE ${s}.batches SET tenant_id=$1 WHERE id=$2`,[randomUUID(),f.batchId])],
    ])await check(`${name}_preflight_does_not_grant_title`,async()=>{const f=await fixture(),snapshot=await captured(f);await prepare(f);const before=await state(f),out=await invoke(f,{snapshot});assert.equal(out.result.ok,false);assert.equal(out.result.error,"tag_not_found");assert.deepEqual(await state(f),before);});
    await check("absent_tenant_policy_keeps_nullable_server_revision_contract",async()=>{const f=await fixture({policy:false}),snapshot=await captured(f);assert.equal(snapshot.authorization.tenantPolicyRevision,null);assert.equal((await invoke(f,{snapshot})).result.ok,true);});
    for(const [field,value]of [["tenantId",randomUUID()],["batchId",randomUUID()],["bid","OTHER-BATCH"],["uidHex","04FFFFFFFFFFFF"],["readCounter",99],["tagId",randomUUID()],["tagRevision","0"]])await check(`server_snapshot_${field}_mismatch_denies_without_writes`,async()=>{const f=await fixture(),snapshot=await captured(f);snapshot.expected[field]=value;await denied(f,{snapshot},"tap_context_changed");});
    for(const existing of [false,true])await check(`other_title_owner_${existing?"existing_associations":"fresh"}_denies_without_writes`,async()=>{const f=await fixture();await title(f,{consumerId:f.otherConsumerId});if(existing)await associated(f);const result=await denied(f,{},"ownership_already_claimed");assert.equal(JSON.stringify(result).includes(f.otherConsumerId),false);});
    for(const status of ["inactive","blocked","left"])await check(`membership_${status}_is_not_reactivated_or_partially_claimed`,async()=>{const f=await fixture();await membership(f,{status});await denied(f,{},"consumer_membership_inactive");});
    for(const [name,prepare]of [
      ["own_revoked_event_wrong_tenant",f=>admin.query(`UPDATE ${s}.consumer_product_ownerships SET status='revoked',tenant_id=$1 WHERE consumer_id=$2`,[randomUUID(),f.consumerId])],
      ["own_revoked_event_wrong_batch",f=>admin.query(`UPDATE ${s}.consumer_product_ownerships SET status='revoked',batch_id=$1 WHERE consumer_id=$2`,[randomUUID(),f.consumerId])],
      ["own_revoked_event_wrong_uid",f=>admin.query(`UPDATE ${s}.consumer_product_ownerships SET status='revoked',uid_hex='04FFFFFFFFFFFF' WHERE consumer_id=$1`,[f.consumerId])],
      ["own_claimed_uid_wrong_tag",f=>admin.query(`UPDATE ${s}.consumer_product_ownerships SET tag_id=$1 WHERE consumer_id=$2`,[randomUUID(),f.consumerId])],
      ["own_claimed_uid_wrong_batch",f=>admin.query(`UPDATE ${s}.consumer_product_ownerships SET batch_id=$1 WHERE consumer_id=$2`,[randomUUID(),f.consumerId])],
      ["own_claimed_founder_wrong_uid",async f=>{const id=String(nextEvent++);await admin.query(`INSERT INTO ${s}.events(id,tenant_id,batch_id,uid_hex,result) VALUES($1,$2,$3,'04FFFFFFFFFFFF','VALID_CLOSED')`,[id,f.tenantId,f.batchId]);await admin.query(`UPDATE ${s}.consumer_product_ownerships SET event_id=$1 WHERE consumer_id=$2`,[id,f.consumerId]);}],
    ])await check(`${name}_is_not_silently_repaired`,async()=>{const f=await fixture();await title(f);await prepare(f);await denied(f,{},"tap_context_changed");});
    await check("same_owner_same_event_has_one_stable_title_and_history",async()=>{
      const f=await fixture(),a=await invoke(f),before=await state(f),b=await invoke(f),after=await state(f);assert.equal(a.result.ok,true);assert.equal(b.result.ok,true);assert.equal(a.result.ownership.id,b.result.ownership.id);
      for(const table of Object.keys(after))assert.equal(after[table].length,1);assert.deepEqual(after.consumer_product_ownerships,before.consumer_product_ownerships);
      for(const field of ["id","first_tap_event_id","acquired_at"])assert.deepEqual(after.consumer_products[0][field],before.consumer_products[0][field]);assert.equal(after.consumer_tap_history[0].id,before.consumer_tap_history[0].id);
    });
    await check("same_owner_later_event_preserves_founder_title_and_acquisition",async()=>{
      const f=await fixture(),id=await title(f);await associated(f);
      const founderCall=await invoke(f);assert.equal(founderCall.result.ok,true);const before=await state(f),out=await invoke(f,{eventId:f.eventIds[1]}),after=await state(f);assert.equal(out.result.ok,true);assert.equal(out.result.ownership.id,id);assert.deepEqual(after.consumer_product_ownerships,before.consumer_product_ownerships);
      for(const call of [founderCall,out]){
        assert.equal(call.context.canonicalInputs.length,1);const canonical=call.context.canonicalInputs[0];
        assert.equal(canonical.operationKey,`ownership:${id}:activated`);assert.equal(String(canonical.referenceEventId),f.eventIds[0]);assert.equal(String(canonical.meta.source_event_id),f.eventIds[0]);assert.equal(canonical.meta.source,"fixture-founder");assert.equal(canonical.batchId,f.batchId);assert.equal(canonical.uidHex,f.uid);assert.equal(canonical.webhookData.ownershipId,id);
      }
      assert.deepEqual(out.context.canonicalInputs[0],founderCall.context.canonicalInputs[0],"The second TAP must send the founder's original canonical identity/fingerprint inputs");
      for(const field of ["id","first_tap_event_id","acquired_at"])assert.deepEqual(after.consumer_products[0][field],before.consumer_products[0][field]);assert.equal(String(after.consumer_products[0].latest_tap_event_id),f.eventIds[1]);assert.equal(after.consumer_tap_history.length,2);
    });
    await check("existing_membership_program_balances_and_first_fields_are_preserved",async()=>{
      const f=await fixture(),programId=randomUUID();await admin.query(`INSERT INTO ${s}.loyalty_programs(id,tenant_id,status) VALUES($1,$2,'active')`,[programId,f.tenantId]);await membership(f,{programId});
      const before=(await state(f)).tenant_consumer_memberships[0];assert.equal((await invoke(f,{eventId:f.eventIds[1]})).result.ok,true);const after=(await state(f)).tenant_consumer_memberships[0];for(const field of ["id","source","loyalty_program_id","first_tap_event_id","status","points_balance","lifetime_points"])assert.deepEqual(after[field],before[field]);
    });
    for(const [mode,start,end,expected]of [["current",-60,60,true],["future",60,120,false],["expired",-120,-60,false],["evergreen",-60,null,true]])await check(`new_claim_membership_${mode}_program_window_is_respected`,async()=>{
      const f=await fixture(),id=randomUUID();await admin.query(`INSERT INTO ${s}.loyalty_programs(id,tenant_id,status,start_at,end_at) VALUES($1,$2,'active',clock_timestamp()+$3::double precision*interval '1 second',CASE WHEN $4::double precision IS NULL THEN NULL ELSE clock_timestamp()+$4::double precision*interval '1 second' END)`,[id,f.tenantId,start,end]);assert.equal((await invoke(f)).result.ok,true);assert.equal((await state(f)).tenant_consumer_memberships[0].loyalty_program_id,expected?id:null);
    });
    for(const table of ["consumer_product_ownerships","consumer_tap_history","consumer_products"])for(const mode of ["raise","suppress"])await check(`${table}_${mode}_rolls_back_four_collections`,async()=>{
      const f=await fixture(),before=await state(f),effects={...report.postCommit};await admin.query(`INSERT INTO ${s}.collection_fixture_faults VALUES($1,$2)`,[f.consumerId,table+":"+mode]);
      await assert.rejects(invoke(f),error=>error.code===(mode==="raise"?"P0001":"22012"));assert.deepEqual(await state(f),before);assert.deepEqual(report.postCommit,effects);
    });
    await check("existing_title_product_update_failure_preserves_all_prior_rows",async()=>{
      const f=await fixture();await title(f);await associated(f);const before=await state(f),effects={...report.postCommit};await admin.query(`INSERT INTO ${s}.collection_fixture_faults VALUES($1,'consumer_products:raise')`,[f.consumerId]);await assert.rejects(invoke(f,{eventId:f.eventIds[1]}),error=>error.code==="P0001");assert.deepEqual(await state(f),before);assert.deepEqual(report.postCommit,effects);
    });
    await check("existing_exact_history_allows_idempotency_when_insert_is_suppressed",async()=>{const f=await fixture();await associated(f);const before=await state(f);await admin.query(`INSERT INTO ${s}.collection_fixture_faults VALUES($1,'consumer_tap_history:suppress')`,[f.consumerId]);assert.equal((await invoke(f)).result.ok,true);const after=await state(f);assert.deepEqual(after.consumer_tap_history,before.consumer_tap_history);assert.equal(after.consumer_product_ownerships.length,1);});
    for(const [name,prepare]of [
      ["tag_revision_changed_during_tag_wait",f=>admin.query(`UPDATE ${s}.tags SET lifecycle_state='active' WHERE id=$1`,[f.tagId])],
      ["counter_changed_during_event_wait",f=>admin.query(`UPDATE ${s}.events SET sdm_read_ctr=sdm_read_ctr+1 WHERE id=$1`,[f.eventIds[0]])],
      ["batch_policy_changed_during_batch_wait",f=>admin.query(`UPDATE ${s}.batches SET bid=bid||'-CHANGED' WHERE id=$1`,[f.batchId])],
      ["tenant_policy_changed_during_policy_wait",f=>admin.query(`UPDATE ${s}.tenant_sun_profiles SET claim_policy='admin_approved' WHERE tenant_id=$1`,[f.tenantId])],
    ])await check(name,async()=>{const f=await fixture(),before=await state(f),effects={...report.postCommit},out=await locked(f,name,()=>prepare(f));assert.equal(out.result.ok,false);assert.equal(out.result.status,409);assert.deepEqual(await state(f),before);assert.deepEqual(report.postCommit,effects);});
    await check("membership_inactivated_during_wait_is_revalidated",async()=>{const f=await fixture();await membership(f);let before;const out=await locked(f,"membership_inactivated_during_wait",async()=>{await admin.query(`UPDATE ${s}.tenant_consumer_memberships SET status='inactive' WHERE tenant_id=$1 AND consumer_id=$2`,[f.tenantId,f.consumerId]);before=await state(f);});assert.equal(out.result.ok,false);assert.equal(out.result.error,"consumer_membership_inactive");assert.deepEqual(await state(f),before);});
    await check("manual_override_committed_during_tag_wait_denies_associations",async()=>{
      const f=await fixture(),before=await state(f),effects={...report.postCommit};
      const out=await locked(f,"manual_override_during_tag_wait",async()=>{await admin.query(`UPDATE ${s}.tags SET lifecycle_state='active' WHERE id=$1`,[f.tagId]);await admin.query(`INSERT INTO ${s}.tag_manual_tamper_overrides(batch_id,uid_hex,tamper_status,reason) VALUES($1,$2,'OPENED','operator declared open')`,[f.batchId,f.uid]);});
      assert.equal(out.result.ok,false);assert.equal(out.result.error,"manual_opening_declared");assert.deepEqual(await state(f),before);assert.deepEqual(report.postCommit,effects);
    });
    await check("pos_expiring_during_tag_wait_is_rechecked_after_wait",async()=>{
      const f=await fixture();const pos=(await admin.query(`INSERT INTO ${s}.sdk_pos_activations(tenant_id,batch_id,tag_id,uid_hex,activation_status,expires_at) VALUES($1,$2,$3,$4,'active',clock_timestamp()+interval '2 seconds') RETURNING id`,[f.tenantId,f.batchId,f.tagId,f.uid])).rows[0];const snapshot=await captured(f);snapshot.authorization.posRequired=true;const before=await state(f);
      const out=await locked(f,"pos_expiry_during_tag_wait",()=>admin.query(`SELECT id FROM ${s}.tags WHERE id=$1 FOR UPDATE`,[f.tagId]),{snapshot,beforeRelease:async observation=>{
        assert.equal((await admin.query(`SELECT $1::timestamptz<expires_at AS before FROM ${s}.sdk_pos_activations WHERE id=$2`,[observation.queryStartedAt,pos.id])).rows[0].before,true);
        await admin.query(`SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM(expires_at-clock_timestamp())))) FROM ${s}.sdk_pos_activations WHERE id=$1`,[pos.id]);assert.equal((await admin.query(`SELECT clock_timestamp()>=expires_at AS expired FROM ${s}.sdk_pos_activations WHERE id=$1`,[pos.id])).rows[0].expired,true);observation.startedBeforeExpiry=true;observation.expiredBeforeRelease=true;
      }});assert.equal(out.result.ok,false);assert.equal(out.result.error,"tap_context_changed");assert.deepEqual(await state(f),before);
    });
    async function overlap(f,sameOwner){
      const snapshot=await captured(f);let left,right,error;await admin.query("BEGIN");
      try{await admin.query("SELECT pg_advisory_xact_lock($1::bigint)",[lockKey]);left=Promise.allSettled([invoke(f,{snapshot})]);const a=await waitForOwnedBlock(pids[1],pids[0]);right=Promise.allSettled([invoke(f,{client:second,snapshot,consumerId:sameOwner?f.consumerId:f.otherConsumerId})]);const b=await waitForOwnedBlock(pids[2],pids[1]);report.lockObservations.push({case:sameOwner?"same_owner_overlap":"two_claimants_overlap",observed:true,waitEventType:"Lock",graph:[a,b],barrier:"fixture-only-product-and-cooperating-writer-locks"});}catch(e){error=e;}finally{await admin.query("ROLLBACK");}
      const results=[...(left?await left:[]),...(right?await right:[])];if(error)throw error;assert.equal(results.length,2);for(const row of results)if(row.status==="rejected")throw row.reason;return results.map(row=>row.value.result);
    }
    for(const sameOwner of [false,true])await check(sameOwner?"concurrent_same_owner_keeps_one_title":"concurrent_two_claimants_have_one_winner_without_loser_associations",async()=>{
      const f=await fixture(),results=await overlap(f,sameOwner),rows=await state(f);for(const table of Object.keys(rows))assert.equal(rows[table].length,1);
      if(sameOwner){assert.ok(results.every(row=>row.ok));assert.equal(results[0].ownership.id,results[1].ownership.id);}else{assert.equal(results.filter(row=>row.ok).length,1);assert.equal(results.filter(row=>!row.ok&&row.status===409&&row.error==="ownership_already_claimed").length,1);const owner=rows.consumer_product_ownerships[0].consumer_id;for(const table of Object.keys(rows))assert.equal(rows[table][0].consumer_id,owner);}
    });
    await check("claim_holding_tag_lock_serializes_later_lifecycle_transition",async()=>{
      const f=await fixture(),snapshot=await captured(f);let claim,transition,error;await admin.query("BEGIN");
      try{await admin.query("SELECT pg_advisory_xact_lock($1::bigint)",[lockKey]);claim=Promise.allSettled([invoke(f,{snapshot})]);const a=await waitForOwnedBlock(pids[1],pids[0]);transition=Promise.allSettled([second.query(`UPDATE ${s}.tags SET status='inactive',lifecycle_state='suspended' WHERE id=$1`,[f.tagId])]);const b=await waitForOwnedBlock(pids[2],pids[1],/^UPDATE [\s\S]*tags SET/);report.lockObservations.push({case:"claim_before_later_lifecycle_transition",observed:true,waitEventType:"Lock",graph:[a,b],barrier:"fixture-only-core-and-later-lifecycle-writer"});}catch(e){error=e;}finally{await admin.query("ROLLBACK");}
      const results=[...(claim?await claim:[]),...(transition?await transition:[])];if(error)throw error;assert.equal(results.length,2);for(const row of results)if(row.status==="rejected")throw row.reason;assert.equal(results[0].value.result.ok,true);assert.equal((await state(f)).consumer_product_ownerships[0].status,"claimed");assert.equal((await admin.query(`SELECT lifecycle_state FROM ${s}.tags WHERE id=$1`,[f.tagId])).rows[0].lifecycle_state,"suspended");
    });
    await check("canonical_failure_after_commit_retains_positive_committed_signal",async()=>{const f=await fixture(),before=report.coreStatements.length,out=await invoke(f,{canonicalFailure:true}),rows=await state(f);assert.equal(out.result.ok,false);assert.equal(out.result.status,503);assert.equal(out.result.operationCommitted,true);assert.equal(out.result.ownership.status,"claimed");assert.equal(report.coreStatements.length-before,1);assert.equal(out.context.commits,1);assert.equal(out.context.publications.canonical,1);for(const table of Object.keys(rows))assert.equal(rows[table].length,1);});
    report.ok=true;
  } finally {
    removeExecutor?.();let cleanupError;for(const client of [...new Set(clients)])try{await client.query("ROLLBACK");}catch{}
    if(schemaCreated){assert.match(schema,OWN_SCHEMA);try{await clients[0].query(`DROP SCHEMA ${s} CASCADE`);report.cleanup.schemaDropped=true;}catch(error){cleanupError=error;}}
    const results=await Promise.allSettled([...new Set(clients)].map(client=>client.end()));report.cleanup.connectionsClosed=results.every(row=>row.status==="fulfilled");if(cleanupError)throw cleanupError;const closeFailure=results.find(row=>row.status==="rejected");if(closeFailure)throw closeFailure.reason;
  }
  assert.ok(report.cleanup.schemaDropped&&report.cleanup.connectionsClosed);assert.equal(new Set(report.checks.map(row=>row.name)).size,report.checks.length);assert.ok(report.coreStatements.length>0);assert.equal(report.postCommitBeforeCommitViolations,0);assert.deepEqual(report.checks.map(row=>row.name),OWNERSHIP_CLAIM_POSTGRES_CASE_NAMES);assert.equal(report.lockObservations.length,OWNERSHIP_CLAIM_POSTGRES_EXPECTED.lockObservations);return report;
}
