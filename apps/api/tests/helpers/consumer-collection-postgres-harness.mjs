import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { assertQaPostgresClientIdentity } from "./ownership-current-state-postgres-harness.mjs";

const OWN_SCHEMA = /^consumer_collection_qa_[0-9a-f]{32}$/;

// No connections, configuration or application imports occur at import time.
// The caller supplies already-connected clients to an empty local QA database.
export async function runConsumerCollectionPostgresQa({ connect, dockerAttestation } = {}) {
  assert.equal(typeof connect, "function", "An explicit disposable QA connection factory is required");
  const schema = `consumer_collection_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, OWN_SCHEMA);
  const s = `"${schema}"`, clients = [], pids = [];
  const currentClient = new AsyncLocalStorage();
  const lockKey = randomBytes(6).readUIntBE(0, 6);
  const report = {
    kind: "synthetic-postgresql-consumer-collection", ok: false, schema,
    checks: [], lockObservations: [], connectionEvidence: [], serializationConflicts: 0,
    productStatements: [], compatibilitySeedsSkipped: 0, projectionReturnsSuppressed: 0,
    cleanup: { schemaDropped: false, connectionsClosed: false },
    limits: [
      "Synthetic minimal schema, not production migrations or customer data",
      "Fixture migration-watermark rows do not certify real migrations applied",
      "Uses actual saveTapForConsumer historical adapter and saveConsumerTapActionForConsumer mobile core; no route/auth/fresh-token/PIN/POS or ownership claim is exercised",
      "sqlSerializable test adapter runs the whole actual membership/history/product statement in one SERIALIZABLE transaction per attempt",
      "Core SQL executes in its real transaction, including rollback cases; only association_event_id in a committed return projection is suppressed to prevent external realtime/provider activity",
      "Lock graphs identify owned waiting backends, not an inferred CTE stage; serialization conflict counts are observations, not a required historical minimum",
      "Controlled SQL fixture rows, advisory barriers and product trigger failures do not demonstrate a live exploit or production concurrency latency",
      "No unit uniqueness constraint is added; protection covers cooperating service writers, not arbitrary database writers",
      "The minimal fixture deliberately permits duplicate UID tags across batches to test metadata isolation; it does not certify the production global UID index or its migrations",
      "Existing duplicate rows are retained; missing UID and tag identity is not inferred from separate historical events",
      "Historical no-tag/suspended adapters remain supported; an inactive membership now intentionally returns no saved event and no partial associations",
      "No provider, live NFC, OTP or customer request is exercised",
    ],
  };
  let schemaCreated = false, removeExecutor, nextEvent = 900001;
  try {
    let database;
    for (let i = 0; i < 3; i += 1) {
      const client = await connect();
      clients.push(client);
      assert.ok(typeof client?.query === "function" && typeof client?.end === "function");
      assert.equal(clients.filter(row => row === client).length, 1, "Independent QA clients required");
      const { rows: [identity] } = await client.query("SELECT current_database() AS database, current_user AS role, pg_backend_pid() AS pid, host(inet_server_addr()) AS address, current_setting('server_version_num')::integer AS server_version_number, current_setting('neon.endpoint_id', true) AS neon_endpoint_id, current_setting('transaction_read_only') AS transaction_read_only");
      report.connectionEvidence.push(assertQaPostgresClientIdentity(client, identity, { dockerAttestation }));
      database ??= identity.database;
      assert.equal(identity.database, database, "All clients must use the same QA database");
      assert.ok(Number.isInteger(identity.pid) && !pids.includes(identity.pid), "Separate PostgreSQL backends required");
      pids.push(identity.pid);
    }
    const [admin, first, second] = clients;
    const db = await import("../../src/lib/db.ts");
    const { saveTapForConsumer, saveConsumerTapActionForConsumer, ensureTenantMembership } = await import("../../src/lib/consumer-portal-service.ts");
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
      CREATE TABLE ${s}.collection_fixture_faults(consumer_id uuid PRIMARY KEY, mode text NOT NULL);
      CREATE FUNCTION ${s}.hold_product_insert() RETURNS trigger LANGUAGE plpgsql AS $fixture$
      BEGIN
        IF EXISTS (SELECT 1 FROM ${s}.collection_fixture_faults WHERE consumer_id=NEW.consumer_id AND mode='raise') THEN
          RAISE EXCEPTION 'synthetic product write failure' USING ERRCODE='P0001';
        END IF;
        IF EXISTS (SELECT 1 FROM ${s}.collection_fixture_faults WHERE consumer_id=NEW.consumer_id AND mode='suppress') THEN RETURN NULL; END IF;
        IF TG_OP='INSERT' THEN PERFORM pg_advisory_xact_lock(${lockKey}); END IF;
        RETURN NEW;
      END; $fixture$;
      CREATE TRIGGER collection_overlap BEFORE INSERT OR UPDATE ON ${s}.consumer_products FOR EACH ROW EXECUTE FUNCTION ${s}.hold_product_insert();
      CREATE FUNCTION ${s}.suppress_history_insert() RETURNS trigger LANGUAGE plpgsql AS $fixture$
      BEGIN
        IF EXISTS (SELECT 1 FROM ${s}.collection_fixture_faults WHERE consumer_id=NEW.consumer_id AND mode='suppress-history') THEN RETURN NULL; END IF;
        RETURN NEW;
      END; $fixture$;
      CREATE TRIGGER collection_history_fault BEFORE INSERT ON ${s}.consumer_tap_history FOR EACH ROW EXECUTE FUNCTION ${s}.suppress_history_insert();
    `);
    await admin.query(`INSERT INTO ${s}.schema_migrations(id) SELECT unnest($1::text[])`, [[...db.DEFAULT_REQUIRED_SCHEMA_MIGRATIONS]]);
    removeExecutor = db.installEphemeralE2eSqlExecutor(async (strings, ...values) => {
      const text = strings.reduce((result, part, i) => result + (i ? `$${i}` : "") + part, "");
      assert.doesNotMatch(text, /\bpublic\s*\./i);
      // The initial compatibility seed can trigger the runtime watermark read.
      // That lookup must execute against the fixture ledger before seeds skip.
      if (!/FROM schema_migrations/.test(text) && /commercial-runtime-schema\.[cm]?[jt]s/.test(new Error().stack || "")) { report.compatibilitySeedsSkipped += 1; return []; }
      const client = currentClient.getStore() || first;
      if (/WITH locked_event AS MATERIALIZED/.test(text) && /written_membership AS/.test(text) && /INSERT INTO consumer_products/.test(text)) {
        report.productStatements.push({ sha256: createHash("sha256").update(text).digest("hex"), parameters: values.length, pid: pids[clients.indexOf(client)], isolation: "SERIALIZABLE", scope: "composed-membership-history-product" });
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        try {
          const result = await client.query(text, values);
          await client.query("COMMIT");
          return result.rows.map(row => {
            if (row.association_event_id != null) report.projectionReturnsSuppressed += 1;
            return { ...row, association_event_id: null };
          });
        } catch (error) {
          await client.query("ROLLBACK");
          if (error.code === "40001") report.serializationConflicts += 1;
          throw error;
        }
      }
      assert.doesNotMatch(text, /INSERT INTO consumer_tap_history|INSERT INTO consumer_products/, "Collection writes must stay inside the composed SERIALIZABLE adapter");
      return (await client.query(text, values)).rows;
    }, { NODE_ENV: "test", VERCEL_ENV: "test", NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE", NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e" }, { migrationManaged: true });

    async function fixture() {
      const f = { tenantId: randomUUID(), consumerId: randomUUID(), batchId: randomUUID(), tagId: randomUUID(), uid: "04AABB" + randomBytes(4).toString("hex").toUpperCase(), eventIds: [String(nextEvent++), String(nextEvent++)] };
      await admin.query(`INSERT INTO ${s}.tenants VALUES($1,'synthetic-brand')`, [f.tenantId]);
      await admin.query(`INSERT INTO ${s}.batches VALUES($1,$2,$3)`, [f.batchId, f.tenantId, "SYNTHETIC-" + f.batchId]);
      await admin.query(`INSERT INTO ${s}.tags(id,batch_id,uid_hex) VALUES($1,$2,$3)`, [f.tagId, f.batchId, f.uid]);
      await admin.query(`INSERT INTO ${s}.tag_profiles(tag_id,product_name,winery) VALUES($1,'Synthetic product','Synthetic brand')`, [f.tagId]);
      for (const id of f.eventIds) await admin.query(`INSERT INTO ${s}.events(id,tenant_id,batch_id,uid_hex,result) VALUES($1,$2,$3,$4,'VALID_CLOSED')`, [id, f.tenantId, f.batchId, f.uid]);
      return f;
    }
    async function state(f) {
      const params = [f.consumerId, f.tenantId];
      const products = (await admin.query(`SELECT * FROM ${s}.consumer_products WHERE consumer_id=$1 AND tenant_id=$2 ORDER BY id`, params)).rows;
      const history = (await admin.query(`SELECT * FROM ${s}.consumer_tap_history WHERE consumer_id=$1 AND tenant_id=$2 ORDER BY tap_event_id`, params)).rows;
      const memberships = (await admin.query(`SELECT * FROM ${s}.tenant_consumer_memberships WHERE consumer_id=$1 AND tenant_id=$2`, params)).rows;
      return { products, history, memberships };
    }
    const save = (f, client = first, eventId = f.eventIds[0]) => currentClient.run(client, () => saveTapForConsumer({ consumerId: f.consumerId, eventId }));
    async function snapshot(f, client = first, eventId = f.eventIds[0]) {
      const event = await currentClient.run(client, () => getTapEvent(eventId));
      assert.ok(event);
      return { tenantId: event.tenant_id, batchId: event.batch_id, bid: event.bid, uidHex: event.uid_hex,
        readCounter: event.sdm_read_ctr, tagId: event.current_tag_id, tagRevision: event.current_tag_revision };
    }
    async function mobile(f, client = first, eventId = f.eventIds[0], expected) {
      const captured = expected ?? await snapshot(f, client, eventId);
      return currentClient.run(client, () => saveConsumerTapActionForConsumer({ consumerId: f.consumerId, eventId, mode: { kind: "mobile", expected: captured } }));
    }
    async function waitForOwnedBlock(writerPid, blockerPid) {
      const deadline = Date.now() + 6000;
      while (Date.now() < deadline) {
        await admin.query("SELECT pg_stat_clear_snapshot()");
        const row = (await admin.query("SELECT pid,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers,query FROM pg_stat_activity WHERE pid=$1", [writerPid])).rows[0];
        if (row?.wait_event_type === "Lock" && row.blockers.includes(blockerPid)) {
          assert.match(row.query, /WITH locked_event AS MATERIALIZED/);
          return { writerPid, blockerPid, waitEventType: row.wait_event_type, waitEvent: row.wait_event,
            observedQuerySha256: createHash("sha256").update(row.query).digest("hex"), observedQueryBytes: Buffer.byteLength(row.query), queryTextMayBeTruncated: true, observed: true };
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.fail("The actual composed statement did not wait on the expected owned backend");
    }
    async function lockedCore(f, name, { prepare, beforeRelease } = {}) {
      const expected = await snapshot(f);
      let pending, observation, expectedState, barrierError;
      await admin.query("BEGIN");
      try {
        await prepare();
        expectedState = await state(f);
        pending = Promise.allSettled([mobile(f, first, f.eventIds[0], expected)]);
        observation = await waitForOwnedBlock(pids[1], pids[0]);
        await beforeRelease?.(observation);
        report.lockObservations.push({ case: name, observed: true, waitEventType: "Lock", graph: [observation], barrier: "fixture-only-owned-row-lock" });
      } catch (error) { barrierError = error; }
      finally { await admin.query(barrierError ? "ROLLBACK" : "COMMIT"); }
      const results = pending ? await pending : [];
      if (barrierError) throw barrierError;
      assert.equal(results.length, 1);
      if (results[0].status === "rejected") throw results[0].reason;
      return { result: results[0].value, expectedState, observation };
    }
    async function program(f, { startSeconds = -3600, endSeconds = 3600, status = "active", createdSeconds = -60 } = {}) {
      const id = randomUUID();
      await admin.query(`INSERT INTO ${s}.loyalty_programs(id,tenant_id,status,start_at,end_at,created_at)
        VALUES($1,$2,$3,clock_timestamp()+$4::double precision*interval '1 second',
          CASE WHEN $5::double precision IS NULL THEN NULL ELSE clock_timestamp()+$5::double precision*interval '1 second' END,
          clock_timestamp()+$6::double precision*interval '1 second')`, [id, f.tenantId, status, startSeconds, endSeconds, createdSeconds]);
      return id;
    }
    async function membership(f, { status = "active", programId = null, points = 0, lifetime = 0 } = {}) {
      const id = randomUUID();
      await admin.query(`INSERT INTO ${s}.tenant_consumer_memberships(id,tenant_id,consumer_id,loyalty_program_id,source,first_tap_event_id,last_tap_event_id,status,points_balance,lifetime_points,last_activity_at,updated_at)
        VALUES($1,$2,$3,$4,'synthetic-existing',$5,$5,$6,$7,$8,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`, [id, f.tenantId, f.consumerId, programId, f.eventIds[0], status, points, lifetime]);
      return id;
    }
    async function denied(f, expected, error = "tap_context_changed") {
      const before = await state(f), projections = report.projectionReturnsSuppressed;
      const result = await mobile(f, first, f.eventIds[0], expected);
      assert.deepEqual(result, { ok: false, status: 409, error });
      assert.deepEqual(await state(f), before, "A denial must preserve complete membership/history/product rows, including timestamps and points");
      assert.equal(report.projectionReturnsSuppressed, projections);
    }
    async function check(name, operation) {
      try { await operation(); }
      catch (error) {
        // Only fixture identifiers and bounded assertion shapes reach CI; the original error stays in cause.
        const failedCase = String(name).replace(/[^a-z0-9_]/gi, "_").slice(0, 200);
        const assertion = error instanceof assert.AssertionError;
        const headings = ["Expected values to be strictly equal:", "Expected values to be strictly deep-equal:", "The expression evaluated to a falsy value:"];
        const firstLine = assertion ? error.message.split(/\r?\n/, 1)[0] : "";
        const reason = headings.includes(firstLine) ? firstLine : assertion ? "assertion_failed" : "operation_failed";
        const shape = value => value === null ? "null" : typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? "uuid" : Array.isArray(value) ? "array" : typeof value;
        const code = assertion ? "ERR_ASSERTION" : typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : "unclassified";
        const comparison = assertion ? `;actual_shape=${shape(error.actual)};expected_shape=${shape(error.expected)}` : "";
        throw new Error(`consumer_collection_case_failed:${failedCase};completed_checks=${report.checks.length};reason=${reason};code=${code}${comparison}`, { cause: error });
      }
      report.checks.push({ name, passed: true });
    }
    async function overlap(f, sameEvent = false, joinSecond = false, strict = false) {
      // One writer reaches the fixture product trigger; the other waits on the
      // first writer's core locks. The graph does not infer a particular CTE.
      let firstPending, secondPending, barrierError;
      await admin.query("BEGIN");
      try {
        await admin.query("SELECT pg_advisory_xact_lock($1::bigint)", [lockKey]);
        firstPending = Promise.allSettled([strict ? mobile(f, first) : save(f, first)]);
        const firstWait = await waitForOwnedBlock(pids[1], pids[0]);
        secondPending = Promise.allSettled([currentClient.run(second, async () => {
            const eventId = sameEvent ? f.eventIds[0] : f.eventIds[1];
            const event = strict ? await mobile(f, second, eventId) : await saveTapForConsumer({ consumerId: f.consumerId, eventId });
            if (joinSecond) await ensureTenantMembership({ consumerId: f.consumerId, tenantId: f.tenantId, tapEventId: eventId, source: "tap" });
            return event;
          })]);
        const secondWait = await waitForOwnedBlock(pids[2], pids[1]);
        report.lockObservations.push({ case: strict ? (sameEvent ? "mobile-same-event" : "mobile-two-events") : sameEvent ? "same-event" : joinSecond ? "save-and-membership-path" : "two-events",
          observed: true, waitEventType: "Lock", graph: [firstWait, secondWait], barrier: "fixture-only-product-insert-and-core-writer-graph" });
      } catch (error) { barrierError = error; }
      finally { await admin.query("ROLLBACK"); }
      const results = [...(firstPending ? await firstPending : []), ...(secondPending ? await secondPending : [])];
      if (barrierError) throw barrierError;
      assert.equal(results.length, 2);
      for (const result of results) { if (result.status === "rejected") throw result.reason; assert.ok(strict ? result.value?.ok === true : result.value?.id); }
    }

    await check("sequential_save_keeps_one_viewed_product_and_one_history_for_same_event", async () => {
      const f = await fixture(); await save(f); await save(f);
      const current = await state(f);
      assert.equal(current.products.length, 1); assert.equal(current.history.length, 1); assert.equal(current.memberships.length, 1);
      assert.equal(current.products[0].ownership_status, "viewed"); assert.equal(current.products[0].acquired_at, null);
      assert.equal(current.memberships[0].points_balance, 0);
    });
    await check("later_save_updates_same_product_preserving_first_event_and_existing_title", async () => {
      const f = await fixture(); await save(f);
      const original = (await state(f)).products[0];
      await admin.query(`UPDATE ${s}.consumer_products SET ownership_status='claimed',acquired_at='2026-01-01T00:00:00Z' WHERE id=$1`, [original.id]);
      await save(f, first, f.eventIds[1]);
      const current = await state(f);
      assert.equal(current.products.length, 1); assert.equal(current.products[0].id, original.id);
      assert.equal(String(current.products[0].first_tap_event_id), f.eventIds[0]); assert.equal(String(current.products[0].latest_tap_event_id), f.eventIds[1]);
      assert.equal(current.products[0].ownership_status, "claimed"); assert.equal(current.products[0].acquired_at.toISOString(), "2026-01-01T00:00:00.000Z");
      assert.equal(current.history.length, 2); assert.equal(current.memberships[0].points_balance, 0);
    });
    await check("overlapping_saves_same_unit_two_events_persist_one_product_two_histories", async () => {
      const f = await fixture(); await overlap(f);
      const current = await state(f);
      assert.equal(current.products.length, 1); assert.equal(current.history.length, 2); assert.equal(current.memberships.length, 1);
      assert.equal(current.products[0].ownership_status, "viewed"); assert.equal(current.memberships[0].points_balance, 0);
    });
    await check("overlapping_saves_same_event_persist_one_history_and_product", async () => {
      const f = await fixture(); await overlap(f, true);
      const current = await state(f); assert.equal(current.products.length, 1); assert.equal(current.history.length, 1); assert.equal(current.memberships.length, 1);
    });
    await check("save_and_additional_membership_path_share_the_collection_invariant", async () => {
      const f = await fixture(); await overlap(f, false, true);
      const current = await state(f); assert.equal(current.products.length, 1); assert.equal(current.history.length, 2); assert.equal(current.memberships.length, 1);
    });
    await check("same_unit_for_different_consumers_remains_distinct", async () => {
      const f = await fixture(), otherConsumer = { ...f, consumerId: randomUUID() };
      await save(f); await save(otherConsumer);
      assert.equal((await state(f)).products.length, 1); assert.equal((await state(otherConsumer)).products.length, 1);
      assert.notEqual((await state(f)).products[0].id, (await state(otherConsumer)).products[0].id);
    });
    await check("different_units_for_same_consumer_and_tenant_remain_distinct", async () => {
      const f = await fixture(), otherUnit = { ...f, tagId: randomUUID(), uid: "04CCDD" + randomBytes(4).toString("hex").toUpperCase(), eventIds: [String(nextEvent++), String(nextEvent++)] };
      await admin.query(`INSERT INTO ${s}.tags(id,batch_id,uid_hex) VALUES($1,$2,$3)`, [otherUnit.tagId, otherUnit.batchId, otherUnit.uid]);
      for (const id of otherUnit.eventIds) await admin.query(`INSERT INTO ${s}.events(id,tenant_id,batch_id,uid_hex,result) VALUES($1,$2,$3,$4,'VALID_CLOSED')`, [id, otherUnit.tenantId, otherUnit.batchId, otherUnit.uid]);
      await save(f); await save(otherUnit);
      const current = await state(f); assert.equal(current.products.length, 2); assert.equal(current.history.length, 2); assert.equal(current.memberships.length, 1);
      assert.deepEqual(current.products.map(row => row.product_passport_id).sort(), [f.uid, otherUnit.uid].sort());
    });
    await check("same_uid_for_same_consumer_in_other_tenant_remains_distinct", async () => {
      const f = await fixture(), otherTenant = { ...await fixture(), consumerId: f.consumerId, uid: f.uid };
      await admin.query(`UPDATE ${s}.tags SET uid_hex=$1 WHERE id=$2`, [f.uid, otherTenant.tagId]);
      await admin.query(`UPDATE ${s}.events SET uid_hex=$1 WHERE tenant_id=$2`, [f.uid, otherTenant.tenantId]);
      await save(f); await save(otherTenant);
      assert.equal((await state(f)).products.length, 1); assert.equal((await state(otherTenant)).products.length, 1);
      assert.notEqual((await state(f)).products[0].id, (await state(otherTenant)).products[0].id);
    });
    await check("historical_uid_without_current_tag_still_deduplicates_the_known_passport", async () => {
      const f = await fixture();
      await admin.query(`DELETE FROM ${s}.tag_profiles WHERE tag_id=$1`, [f.tagId]);
      await admin.query(`DELETE FROM ${s}.tags WHERE id=$1`, [f.tagId]);
      await save(f); await save(f, first, f.eventIds[1]);
      const current = await state(f); assert.equal(current.products.length, 1); assert.equal(current.products[0].tag_id, null); assert.equal(current.products[0].product_passport_id, f.uid); assert.equal(current.history.length, 2);
    });
    await check("existing_duplicate_rows_are_not_deleted_by_a_save", async () => {
      const f = await fixture(); await save(f);
      await admin.query(`INSERT INTO ${s}.consumer_products(consumer_id,tenant_id,product_passport_id,tag_id,first_tap_event_id,latest_tap_event_id,ownership_status,collection_type,product_name,brand_name) SELECT consumer_id,tenant_id,product_passport_id,tag_id,first_tap_event_id,latest_tap_event_id,ownership_status,collection_type,product_name,brand_name FROM ${s}.consumer_products WHERE consumer_id=$1 AND tenant_id=$2`, [f.consumerId, f.tenantId]);
      await save(f, first, f.eventIds[1]); assert.equal((await state(f)).products.length, 2);
    });
    await check("historical_save_remains_available_for_currently_suspended_unit", async () => {
      const f = await fixture(); await admin.query(`UPDATE ${s}.tags SET status='inactive',lifecycle_state='suspended' WHERE id=$1`, [f.tagId]);
      await save(f); const current = await state(f); assert.equal(current.products.length, 1); assert.equal(current.products[0].ownership_status, "viewed"); assert.equal(current.memberships[0].points_balance, 0);
    });
    await check("mobile_closed_core_commits_membership_history_product_without_points_or_title", async () => {
      const f = await fixture(), result = await mobile(f), current = await state(f);
      assert.equal(result.ok, true); assert.equal(result.status, 200);
      assert.equal(current.memberships.length, 1); assert.equal(current.history.length, 1); assert.equal(current.products.length, 1);
      assert.equal(result.membership.id, current.memberships[0].id); assert.equal(result.productId, current.products[0].id);
      assert.equal(current.products[0].ownership_status, "viewed"); assert.equal(current.products[0].acquired_at, null);
      assert.equal(current.memberships[0].points_balance, 0); assert.equal(current.memberships[0].lifetime_points, 0);
    });
    await check("mobile_valid_opened_result_remains_a_legitimate_save_without_manual_override", async () => {
      const f = await fixture(); await admin.query(`UPDATE ${s}.events SET result='VALID_OPENED' WHERE id=$1`, [f.eventIds[0]]);
      assert.equal((await mobile(f)).ok, true);
      const current = await state(f); assert.equal(current.history[0].verdict, "VALID_OPENED"); assert.equal(current.memberships[0].points_balance, 0);
    });
    await check("nonactive_existing_membership_denies_without_reactivation_or_partial_associations", async () => {
      for (const status of ["inactive", "paused", "blocked", "left"]) {
        const f = await fixture(); await membership(f, { status, points: 17, lifetime: 29 });
        await denied(f, await snapshot(f), "consumer_membership_inactive");
      }
    });
    await check("historical_adapter_returns_null_for_inactive_membership_without_partial_associations", async () => {
      const f = await fixture(); await membership(f, { status: "inactive", points: 17, lifetime: 29 });
      const before = await state(f), projections = report.projectionReturnsSuppressed;
      assert.equal(await save(f), null); assert.deepEqual(await state(f), before);
      assert.equal(report.projectionReturnsSuppressed, projections);
    });
    await check("membership_changed_to_inactive_while_core_waits_denies_and_preserves_committed_state", async () => {
      const f = await fixture(); await membership(f, { points: 17, lifetime: 29 });
      const observed = await lockedCore(f, "membership-revoked-during-owned-lock", { prepare: () => admin.query(`UPDATE ${s}.tenant_consumer_memberships SET status='inactive' WHERE consumer_id=$1 AND tenant_id=$2`, [f.consumerId, f.tenantId]) });
      assert.deepEqual(observed.result, { ok: false, status: 409, error: "consumer_membership_inactive" });
      assert.deepEqual(await state(f), observed.expectedState);
    });
    await check("new_membership_selects_the_current_active_program", async () => {
      const f = await fixture(), id = await program(f); assert.equal((await mobile(f)).ok, true);
      assert.equal((await state(f)).memberships[0].loyalty_program_id, id);
    });
    await check("future_active_program_does_not_enroll_a_new_membership_early", async () => {
      const f = await fixture(); await program(f, { startSeconds: 3600, endSeconds: 7200 });
      assert.equal((await mobile(f)).ok, true); assert.equal((await state(f)).memberships[0].loyalty_program_id, null);
    });
    await check("expired_active_program_does_not_attach_to_a_new_membership", async () => {
      const f = await fixture(); await program(f, { startSeconds: -7200, endSeconds: -3600 });
      assert.equal((await mobile(f)).ok, true); assert.equal((await state(f)).memberships[0].loyalty_program_id, null);
    });
    await check("paused_current_program_does_not_attach_to_a_new_membership", async () => {
      const f = await fixture(); await program(f, { status: "paused" });
      assert.equal((await mobile(f)).ok, true); assert.equal((await state(f)).memberships[0].loyalty_program_id, null);
    });
    await check("current_evergreen_program_preserves_the_nullable_end_contract", async () => {
      const f = await fixture(), id = await program(f, { endSeconds: null });
      assert.equal((await mobile(f)).ok, true); assert.equal((await state(f)).memberships[0].loyalty_program_id, id);
    });
    await check("newer_future_or_expired_active_periods_do_not_displace_the_current_program", async () => {
      const f = await fixture(), id = await program(f, { createdSeconds: -120 });
      await program(f, { startSeconds: 3600, endSeconds: 7200, createdSeconds: -30 });
      await program(f, { startSeconds: -7200, endSeconds: -3600, createdSeconds: -10 });
      assert.equal((await mobile(f)).ok, true); assert.equal((await state(f)).memberships[0].loyalty_program_id, id);
    });
    await check("program_expiring_during_a_real_tag_lock_is_rechecked_after_the_wait", async () => {
      const f = await fixture(), id = await program(f, { endSeconds: 2 });
      const observed = await lockedCore(f, "program-expiry-during-tag-lock", {
        prepare: () => admin.query(`SELECT id FROM ${s}.tags WHERE id=$1 FOR UPDATE`, [f.tagId]),
        beforeRelease: async observation => {
          const before = (await admin.query(`SELECT clock_timestamp()<end_at AS before_expiry FROM ${s}.loyalty_programs WHERE id=$1`, [id])).rows[0];
          assert.equal(before.before_expiry, true, "The actual wait must begin while the fixture program is current");
          const deadline = Date.now() + 4000; let expired = false;
          while (Date.now() < deadline) {
            expired = (await admin.query(`SELECT clock_timestamp()>end_at AS expired FROM ${s}.loyalty_programs WHERE id=$1`, [id])).rows[0].expired;
            if (expired) break;
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          assert.equal(expired, true); observation.startedBeforeExpiry = true; observation.expiredBeforeRelease = true;
        },
      });
      assert.equal(observed.result.ok, true); assert.equal((await state(f)).memberships[0].loyalty_program_id, null);
    });
    await check("existing_active_membership_keeps_its_program_and_balances_without_reassignment", async () => {
      const f = await fixture(), existingProgram = await program(f, { endSeconds: -3600 });
      const id = await membership(f, { programId: existingProgram, points: 37, lifetime: 88 });
      await program(f); assert.equal((await mobile(f)).ok, true);
      const row = (await state(f)).memberships[0];
      assert.equal(row.id, id); assert.equal(row.loyalty_program_id, existingProgram); assert.equal(row.points_balance, 37); assert.equal(row.lifetime_points, 88);
      assert.equal(row.source, "synthetic-existing"); assert.equal(String(row.first_tap_event_id), f.eventIds[0]);
    });
    await check("mobile_expected_identity_mismatches_leave_all_three_collections_unchanged", async () => {
      for (const field of ["tenantId", "batchId", "bid", "uidHex", "readCounter", "tagId", "tagRevision"]) {
        const f = await fixture(), expected = await snapshot(f);
        const changed = field === "tenantId" || field === "batchId" || field === "tagId" ? randomUUID()
          : field === "readCounter" ? Number(expected[field]) + 1 : field === "tagRevision" ? String(Number(expected[field]) + 1) : expected[field] + "-different";
        await denied(f, { ...expected, [field]: changed });
      }
    });
    await check("persisted_null_counter_cannot_match_a_previously_captured_mobile_identity", async () => {
      const f = await fixture(), expected = await snapshot(f);
      await admin.query(`UPDATE ${s}.events SET sdm_read_ctr=NULL WHERE id=$1`, [f.eventIds[0]]);
      await denied(f, expected);
    });
    await check("mobile_missing_suspended_inactive_or_ambiguous_tag_denies_without_writes", async () => {
      for (const mode of ["missing", "suspended", "inactive", "ambiguous"]) {
        const f = await fixture(), expected = await snapshot(f);
        if (mode === "missing") { await admin.query(`DELETE FROM ${s}.tag_profiles WHERE tag_id=$1`, [f.tagId]); await admin.query(`DELETE FROM ${s}.tags WHERE id=$1`, [f.tagId]); }
        if (mode === "suspended") await admin.query(`UPDATE ${s}.tags SET lifecycle_state='suspended' WHERE id=$1`, [f.tagId]);
        if (mode === "inactive") await admin.query(`UPDATE ${s}.tags SET status='inactive' WHERE id=$1`, [f.tagId]);
        if (mode === "ambiguous") await admin.query(`INSERT INTO ${s}.tags(id,batch_id,uid_hex) VALUES($1,$2,$3)`, [randomUUID(), f.batchId, f.uid]);
        await denied(f, expected);
      }
    });
    await check("mobile_tag_revision_change_after_snapshot_denies_even_when_tag_remains_active", async () => {
      const f = await fixture(), expected = await snapshot(f);
      await admin.query(`UPDATE ${s}.tags SET status=status WHERE id=$1`, [f.tagId]);
      await denied(f, expected);
    });
    await check("manual_opening_from_current_override_or_event_reason_denies_without_associations", async () => {
      for (const mode of ["status", "override-reason", "event-reason"]) {
        const f = await fixture(), expected = await snapshot(f);
        if (mode === "event-reason") await admin.query(`UPDATE ${s}.events SET reason='operator-declared-open' WHERE id=$1`, [f.eventIds[0]]);
        else await admin.query(`INSERT INTO ${s}.tag_manual_tamper_overrides(batch_id,uid_hex,tamper_status,reason,source) VALUES($1,$2,$3,$4,'synthetic-fixture')`, [f.batchId, f.uid, mode === "status" ? "OPENED" : "UNKNOWN", mode === "override-reason" ? "manual tamper opened" : null]);
        await denied(f, expected, "manual_opening_declared");
      }
    });
    await check("manual_override_added_by_a_tag_touching_writer_during_wait_is_not_bypassed", async () => {
      const f = await fixture();
      const observed = await lockedCore(f, "manual-override-during-tag-lock", { prepare: async () => {
        // The participating manual writer touches the tag before its override.
        // This fixture reproduces that lock/version protocol, not a live call.
        await admin.query(`UPDATE ${s}.tags SET status=status WHERE id=$1`, [f.tagId]);
        await admin.query(`INSERT INTO ${s}.tag_manual_tamper_overrides(batch_id,uid_hex,tamper_status,reason,source) VALUES($1,$2,'OPENED','manual_opened','synthetic-fixture')`, [f.batchId, f.uid]);
      } });
      assert.deepEqual(observed.result, { ok: false, status: 409, error: "manual_opening_declared" });
      assert.deepEqual(await state(f), observed.expectedState);
    });
    async function productFailure(f, mode, code, eventId = f.eventIds[0]) {
      const before = await state(f), projections = report.projectionReturnsSuppressed;
      await admin.query(`INSERT INTO ${s}.collection_fixture_faults(consumer_id,mode) VALUES($1,$2)`, [f.consumerId, mode]);
      await assert.rejects(() => mobile(f, first, eventId), error => error.code === code);
      assert.deepEqual(await state(f), before); assert.equal(report.projectionReturnsSuppressed, projections);
    }
    await check("product_insert_sql_failure_rolls_back_new_membership_and_history", async () => {
      await productFailure(await fixture(), "raise", "P0001");
    });
    await check("product_update_sql_failure_preserves_existing_membership_history_product_and_timestamps", async () => {
      const f = await fixture(); assert.equal((await mobile(f)).ok, true);
      await productFailure(f, "raise", "P0001", f.eventIds[1]);
    });
    await check("product_trigger_suppressing_a_required_insert_forces_complete_rollback", async () => {
      await productFailure(await fixture(), "suppress", "22012");
    });
    await check("history_trigger_suppressing_a_new_required_row_forces_complete_rollback", async () => {
      await productFailure(await fixture(), "suppress-history", "22012");
    });
    await check("existing_exact_history_allows_idempotent_core_when_history_trigger_returns_null", async () => {
      const f = await fixture();
      await admin.query(`INSERT INTO ${s}.consumer_tap_history(consumer_id,tenant_id,tap_event_id,verdict,risk_level) VALUES($1,$2,$3,'VALID_CLOSED','low')`, [f.consumerId, f.tenantId, f.eventIds[0]]);
      const history = (await state(f)).history, projections = report.projectionReturnsSuppressed;
      await admin.query(`INSERT INTO ${s}.collection_fixture_faults(consumer_id,mode) VALUES($1,'suppress-history')`, [f.consumerId]);
      assert.equal((await mobile(f)).ok, true);
      const current = await state(f); assert.deepEqual(current.history, history); assert.equal(current.memberships.length, 1); assert.equal(current.products.length, 1);
      assert.equal(report.projectionReturnsSuppressed, projections, "An existing receipt must not publish a new association");
    });
    await check("history_for_another_tenant_cannot_satisfy_the_exact_history_integrity_gate", async () => {
      const f = await fixture(), other = await fixture();
      await admin.query(`INSERT INTO ${s}.consumer_tap_history(consumer_id,tenant_id,tap_event_id,verdict,risk_level) VALUES($1,$2,$3,'VALID_CLOSED','low')`, [f.consumerId, other.tenantId, f.eventIds[0]]);
      const before = (await admin.query(`SELECT * FROM ${s}.consumer_tap_history WHERE consumer_id=$1`, [f.consumerId])).rows;
      await denied(f, await snapshot(f));
      assert.deepEqual((await admin.query(`SELECT * FROM ${s}.consumer_tap_history WHERE consumer_id=$1`, [f.consumerId])).rows, before);
    });
    await check("mobile_overlapping_two_events_commit_one_product_and_two_histories", async () => {
      const f = await fixture(); await overlap(f, false, false, true);
      const current = await state(f); assert.equal(current.products.length, 1); assert.equal(current.history.length, 2); assert.equal(current.memberships.length, 1);
    });
    await check("mobile_overlapping_same_event_keeps_one_product_and_one_history", async () => {
      const f = await fixture(); await overlap(f, true, false, true);
      const current = await state(f); assert.equal(current.products.length, 1); assert.equal(current.history.length, 1); assert.equal(current.memberships.length, 1);
    });
    await check("historical_canonical_uid_metadata_is_projected_by_real_sql_for_case_and_space_variants", async () => {
      for (const variant of ["upper-event-lower-tag", "lower-event-upper-tag", "spaced-event-and-tag", "spaced-tag"]) {
        const f = await fixture(), image = `https://example.invalid/collection-${variant}.png`, name = `Synthetic ${variant}`, brand = `Synthetic brand ${variant}`;
        const eventUid = variant === "lower-event-upper-tag" ? f.uid.toLowerCase() : variant === "spaced-event-and-tag" ? ` ${f.uid.toLowerCase()} ` : f.uid;
        const tagUid = variant === "upper-event-lower-tag" ? f.uid.toLowerCase() : variant === "spaced-event-and-tag" || variant === "spaced-tag" ? `  ${f.uid}  ` : f.uid;
        await admin.query(`UPDATE ${s}.events SET uid_hex=$1 WHERE tenant_id=$2`, [eventUid, f.tenantId]);
        await admin.query(`UPDATE ${s}.tags SET uid_hex=$1 WHERE id=$2`, [tagUid, f.tagId]);
        await admin.query(`UPDATE ${s}.tag_profiles SET product_name=$1,winery=$2,image_url=$3 WHERE tag_id=$4`, [name, brand, image, f.tagId]);
        assert.ok((await save(f))?.id); assert.ok((await save(f, first, f.eventIds[1]))?.id);
        const current = await state(f); assert.equal(current.products.length, 1); assert.equal(current.history.length, 2); assert.equal(current.memberships.length, 1);
        const row = current.products[0];
        assert.equal(row.tag_id, f.tagId); assert.equal(row.product_passport_id, eventUid); assert.equal(row.product_name, name); assert.equal(row.brand_name, brand); assert.equal(row.image_url, image);
        assert.equal(String(row.first_tap_event_id), f.eventIds[0]); assert.equal(String(row.latest_tap_event_id), f.eventIds[1]);
      }
    });
    await check("historical_same_tenant_uid_in_another_batch_never_supplies_the_saved_product_metadata", async () => {
      const f = await fixture(), otherBatch = randomUUID(), otherTag = randomUUID(), image = "https://example.invalid/another-batch.png";
      await admin.query(`DELETE FROM ${s}.tag_profiles WHERE tag_id=$1`, [f.tagId]);
      await admin.query(`INSERT INTO ${s}.batches(id,tenant_id,bid) VALUES($1,$2,'SYNTHETIC-OTHER-BATCH')`, [otherBatch, f.tenantId]);
      await admin.query(`INSERT INTO ${s}.tags(id,batch_id,uid_hex) VALUES($1,$2,$3)`, [otherTag, otherBatch, f.uid]);
      await admin.query(`INSERT INTO ${s}.tag_profiles(tag_id,product_name,winery,image_url) VALUES($1,'Synthetic other-batch product','Synthetic other-batch brand',$2)`, [otherTag, image]);
      assert.ok((await save(f))?.id); assert.ok((await save(f, first, f.eventIds[1]))?.id);
      const current = await state(f); assert.equal(current.products.length, 1); assert.equal(current.history.length, 2); assert.equal(current.memberships.length, 1);
      const row = current.products[0];
      assert.equal(row.tag_id, f.tagId); assert.notEqual(row.tag_id, otherTag); assert.equal(row.product_passport_id, f.uid);
      assert.equal(row.product_name, `Producto ${f.uid}`); assert.equal(row.brand_name, "synthetic-brand"); assert.equal(row.image_url, null);
    });
    await check("existing_product_history_without_membership_does_not_enroll_in_a_program_expiring_during_tag_lock", async () => {
      const f = await fixture(), productId = randomUUID();
      // Legacy partial state is seeded directly, without bypassing the actual mobile save under test.
      await admin.query(`INSERT INTO ${s}.consumer_products(id,consumer_id,tenant_id,product_passport_id,tag_id,first_tap_event_id,latest_tap_event_id,ownership_status,collection_type,product_name,brand_name,acquired_at)
        VALUES($1,$2,$3,$4,$5,$6,$6,'claimed','wine','Synthetic product','Synthetic brand','2026-01-01T00:00:00Z')`, [productId,f.consumerId,f.tenantId,f.uid,f.tagId,f.eventIds[0]]);
      await admin.query(`INSERT INTO ${s}.consumer_tap_history(consumer_id,tenant_id,tap_event_id,verdict,risk_level)
        VALUES($1,$2,$3,'VALID_CLOSED','low')`, [f.consumerId,f.tenantId,f.eventIds[0]]);
      const before = await state(f);
      assert.equal(before.products.length, 1); assert.equal(before.history.length, 1); assert.equal(before.memberships.length, 0);
      const id = await program(f, { endSeconds: 2 });
      const observed = await lockedCore(f, "existing-product-history-program-expiry-during-tag-lock", {
        prepare: () => admin.query(`SELECT id FROM ${s}.tags WHERE id=$1 FOR UPDATE`, [f.tagId]),
        beforeRelease: async observation => {
          const current = (await admin.query(`SELECT clock_timestamp()<end_at AS before_expiry FROM ${s}.loyalty_programs WHERE id=$1`, [id])).rows[0];
          assert.equal(current.before_expiry, true, "The actual wait must begin while the fixture program is current");
          const deadline = Date.now() + 4000; let expired = false;
          while (Date.now() < deadline) {
            expired = (await admin.query(`SELECT clock_timestamp()>end_at AS expired FROM ${s}.loyalty_programs WHERE id=$1`, [id])).rows[0].expired;
            if (expired) break;
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          assert.equal(expired, true); observation.startedBeforeExpiry = true; observation.expiredBeforeRelease = true;
        },
      });
      assert.deepEqual(observed.expectedState, before);
      assert.equal(observed.result.ok, true); assert.equal(observed.result.productId, productId);
      assert.equal(observed.observation.startedBeforeExpiry, true); assert.equal(observed.observation.expiredBeforeRelease, true);
      const current = await state(f);
      assert.equal(current.memberships.length, 1); assert.equal(current.memberships[0].status, "active");
      assert.equal(current.memberships[0].loyalty_program_id, null); assert.equal(current.memberships[0].points_balance, 0); assert.equal(current.memberships[0].lifetime_points, 0);
      assert.equal(current.products.length, 1); assert.equal(current.products[0].id, productId);
      assert.equal(String(current.products[0].first_tap_event_id), f.eventIds[0]); assert.equal(String(current.products[0].latest_tap_event_id), f.eventIds[0]);
      assert.equal(current.products[0].ownership_status, "claimed"); assert.equal(current.products[0].collection_type, before.products[0].collection_type);
      assert.equal(current.products[0].acquired_at.toISOString(), before.products[0].acquired_at.toISOString());
      assert.equal(current.history.length, 1); assert.equal(current.history[0].id, before.history[0].id); assert.deepEqual(current.history, before.history);
    });
    assert.equal(report.checks.length, 41); assert.equal(new Set(report.checks.map(row => row.name)).size, 41);
    assert.equal(report.lockObservations.length, 9);
    assert.ok(report.lockObservations.every(row => row.observed && row.waitEventType === "Lock" && row.graph.every(edge => edge.observed && edge.waitEventType === "Lock")));
    assert.ok(report.productStatements.length > 0 && report.productStatements.every(row => row.scope === "composed-membership-history-product" && row.isolation === "SERIALIZABLE"));
    report.ok = true;
  } finally {
    removeExecutor?.();
    let cleanupError;
    if (schemaCreated) {
      assert.match(schema, OWN_SCHEMA);
      try { await clients[0].query(`DROP SCHEMA ${s} CASCADE`); report.cleanup.schemaDropped = true; }
      catch (error) { cleanupError = error; }
    }
    const results = await Promise.allSettled([...new Set(clients)].map(client => client.end()));
    report.cleanup.connectionsClosed = results.every(row => row.status === "fulfilled");
    if (cleanupError) throw cleanupError;
    const closeFailure = results.find(row => row.status === "rejected");
    if (closeFailure) throw closeFailure.reason;
  }
  assert.ok(report.cleanup.schemaDropped && report.cleanup.connectionsClosed);
  return report;
}
