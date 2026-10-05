import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

const OWN_SCHEMA = /^consumer_collection_qa_[0-9a-f]{32}$/;
const QA_DATABASE = /^nexid_e2e(?:_[a-z0-9][a-z0-9_-]{0,48})?$/;

// No connections, configuration or application imports occur at import time.
// The caller supplies already-connected clients to an empty local QA database.
export async function runConsumerCollectionPostgresQa({ connect } = {}) {
  assert.equal(typeof connect, "function", "An explicit disposable QA connection factory is required");
  const schema = `consumer_collection_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, OWN_SCHEMA);
  const s = `"${schema}"`, clients = [], pids = [];
  const currentClient = new AsyncLocalStorage();
  const lockKey = randomBytes(6).readUIntBE(0, 6);
  const report = {
    kind: "synthetic-postgresql-consumer-collection", ok: false, schema,
    checks: [], lockObservations: [], serializationConflicts: 0,
    productStatements: [], compatibilitySeedsSkipped: 0, projectionReturnsSuppressed: 0,
    cleanup: { schemaDropped: false, connectionsClosed: false },
    limits: [
      "Synthetic minimal schema, not production migrations or customer data",
      "Fixture migration-watermark rows do not certify real migrations applied",
      "Uses actual saveTapForConsumer and its SQL; no route/auth/fresh-token/PIN/POS or ownership claim is exercised",
      "sqlSerializable test adapter explicitly runs the actual product statement in a SERIALIZABLE transaction",
      "History SQL executes; its returned projection row is suppressed to prevent external realtime/provider activity",
      "No unit uniqueness constraint is added; protection covers cooperating service writers, not arbitrary database writers",
      "Existing duplicate rows are retained; missing UID and tag identity is not inferred from separate historical events",
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
      const { rows: [identity] } = await client.query("SELECT current_database() AS database, current_user AS role, pg_backend_pid() AS pid, host(inet_server_addr()) AS address");
      assert.match(identity.database, QA_DATABASE);
      assert.equal(identity.role, "nexid_e2e", "A dedicated nexid_e2e QA role is required");
      assert.ok(["127.0.0.1", "::1"].includes(identity.address), "Refusing a non-loopback PostgreSQL server");
      database ??= identity.database;
      assert.equal(identity.database, database, "All clients must use the same QA database");
      assert.ok(Number.isInteger(identity.pid) && !pids.includes(identity.pid), "Separate PostgreSQL backends required");
      pids.push(identity.pid);
    }
    const [admin, first, second] = clients;
    const db = await import("../../src/lib/db.ts");
    const { saveTapForConsumer, ensureTenantMembership } = await import("../../src/lib/consumer-portal-service.ts");
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
      CREATE TABLE ${s}.loyalty_programs(id uuid PRIMARY KEY, tenant_id uuid, status text, created_at timestamptz DEFAULT now());
      CREATE TABLE ${s}.tenant_consumer_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, consumer_id uuid, loyalty_program_id uuid, source text, first_tap_event_id bigint, last_tap_event_id bigint, status text, points_balance integer DEFAULT 0, lifetime_points integer DEFAULT 0, last_activity_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(tenant_id,consumer_id));
      CREATE TABLE ${s}.consumer_tap_history(id bigserial PRIMARY KEY, consumer_id uuid, tenant_id uuid, tap_event_id bigint, verdict text, risk_level text, city text, country text, UNIQUE(consumer_id,tap_event_id));
      CREATE TABLE ${s}.consumer_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), consumer_id uuid, tenant_id uuid, product_passport_id text, tag_id uuid, first_tap_event_id bigint, latest_tap_event_id bigint, ownership_status text DEFAULT 'viewed', collection_type text, product_name text, brand_name text, image_url text, acquired_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE FUNCTION ${s}.hold_product_insert() RETURNS trigger LANGUAGE plpgsql AS $fixture$
      BEGIN PERFORM pg_advisory_xact_lock(${lockKey}); RETURN NEW; END; $fixture$;
      CREATE TRIGGER collection_overlap BEFORE INSERT ON ${s}.consumer_products FOR EACH ROW EXECUTE FUNCTION ${s}.hold_product_insert();
    `);
    await admin.query(`INSERT INTO ${s}.schema_migrations(id) SELECT unnest($1::text[])`, [[...db.DEFAULT_REQUIRED_SCHEMA_MIGRATIONS]]);
    removeExecutor = db.installEphemeralE2eSqlExecutor(async (strings, ...values) => {
      const text = strings.reduce((result, part, i) => result + (i ? `$${i}` : "") + part, "");
      assert.doesNotMatch(text, /\bpublic\s*\./i);
      // The initial compatibility seed can trigger the runtime watermark read.
      // That lookup must execute against the fixture ledger before seeds skip.
      if (!/FROM schema_migrations/.test(text) && /commercial-runtime-schema\.[cm]?[jt]s/.test(new Error().stack || "")) { report.compatibilitySeedsSkipped += 1; return []; }
      const client = currentClient.getStore() || first;
      if (/WITH existing AS MATERIALIZED/.test(text) && /INSERT INTO consumer_products/.test(text)) {
        report.productStatements.push({ sha256: createHash("sha256").update(text).digest("hex"), parameters: values.length, pid: pids[clients.indexOf(client)], isolation: "SERIALIZABLE" });
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        try {
          const result = await client.query(text, values);
          await client.query("COMMIT");
          return result.rows;
        } catch (error) {
          await client.query("ROLLBACK");
          if (error.code === "40001") report.serializationConflicts += 1;
          throw error;
        }
      }
      const { rows } = await client.query(text, values);
      if (/INSERT INTO consumer_tap_history/.test(text)) { report.projectionReturnsSuppressed += rows.length; return []; }
      return rows;
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
    async function check(name, operation) { await operation(); report.checks.push({ name, passed: true }); }
    async function overlap(f, sameEvent = false, joinSecond = false) {
      // The fixture-only INSERT trigger waits after the real absent-row CTE
      // read. Both independent writers must be observed waiting before release.
      let pending, barrierError;
      await admin.query("BEGIN");
      try {
        await admin.query("SELECT pg_advisory_xact_lock($1::bigint)", [lockKey]);
        pending = Promise.allSettled([
          save(f, first),
          currentClient.run(second, async () => {
            const eventId = sameEvent ? f.eventIds[0] : f.eventIds[1];
            const event = await saveTapForConsumer({ consumerId: f.consumerId, eventId });
            if (joinSecond) await ensureTenantMembership({ consumerId: f.consumerId, tenantId: f.tenantId, tapEventId: eventId, source: "tap" });
            return event;
          }),
        ]);
        const deadline = Date.now() + 6000;
        let waiting = [];
        while (Date.now() < deadline) {
          await admin.query("SELECT pg_stat_clear_snapshot()");
          waiting = (await admin.query("SELECT pid FROM pg_stat_activity WHERE pid = ANY($1::integer[]) AND wait_event_type='Lock' AND query LIKE '%INSERT INTO consumer_products%'", [pids.slice(1)])).rows;
          if (waiting.length === 2) break;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(waiting.length, 2, "Both actual product statements must overlap after their absent-row reads");
        report.lockObservations.push({ case: sameEvent ? "same-event" : joinSecond ? "save-and-membership-path" : "two-events", writerPids: waiting.map(row => row.pid), waitType: "Lock", barrier: "fixture-only-before-insert-advisory-lock" });
      } catch (error) { barrierError = error; }
      finally { await admin.query("ROLLBACK"); }
      const results = pending ? await pending : [];
      if (barrierError) throw barrierError;
      for (const result of results) { if (result.status === "rejected") throw result.reason; assert.ok(result.value?.id); }
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
      const f = await fixture(), before = report.serializationConflicts; await overlap(f);
      const current = await state(f);
      assert.equal(current.products.length, 1); assert.equal(current.history.length, 2); assert.equal(current.memberships.length, 1);
      assert.equal(current.products[0].ownership_status, "viewed"); assert.equal(current.memberships[0].points_balance, 0);
      assert.ok(report.serializationConflicts > before, "The forced absent-row conflict must actually serialize and retry");
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
