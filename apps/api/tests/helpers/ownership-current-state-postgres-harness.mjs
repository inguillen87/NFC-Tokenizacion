import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { captureOwnershipMutation, ownershipFixture } from "./ownership-current-state-fixture.mjs";

const OWN_SCHEMA = /^ownership_current_qa_[0-9a-f]{32}$/;
const QA_DATABASE = /^nexid_e2e(?:_[a-z0-9][a-z0-9_-]{0,48})?$/;

// Importing this file does not connect or read environment credentials. Only
// an explicit, already-connected loopback QA factory can run these statements.
export async function runOwnershipCurrentStatePostgresQa({ connect } = {}) {
  assert.equal(typeof connect, "function", "An explicit disposable QA connection factory is required");
  const schema = `ownership_current_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, OWN_SCHEMA);
  const s = `"${schema}"`;
  const clients = [];
  const report = {
    kind: "synthetic-postgresql-ownership-current-state", ok: false, schema,
    checks: [], lockObservations: [], cleanup: { schemaDropped: false, connectionsClosed: false },
    limits: [
      "Synthetic minimal schema and fixed synthetic identities; no customer, provider, NFC, OTP or external database calls",
      "Captured real ownership INSERT/UPDATE execute directly; membership/history/canonical event side effects are outside this SQL fixture",
      "Malformed duplicate-tag fixtures intentionally omit production uniqueness indexes to verify fail-closed identity handling",
      "A claim serialized before a later lifecycle transition remains a historical claim; this change does not retroactively revoke prior titles",
    ],
  };
  let schemaCreated = false;
  try {
    let database;
    const pids = [];
    for (let i = 0; i < 3; i += 1) {
      const client = await connect();
      clients.push(client);
      assert.ok(typeof client?.query === "function" && typeof client?.end === "function");
      assert.equal(clients.filter(c => c === client).length, 1, "Distinct QA clients are required");
      const { rows: [identity] } = await client.query("SELECT current_database() AS database, current_user AS role, pg_backend_pid() AS pid, host(inet_server_addr()) AS address");
      assert.match(identity.database, QA_DATABASE);
      assert.equal(identity.role, "nexid_e2e", "A dedicated nexid_e2e QA role is required");
      assert.ok(["127.0.0.1", "::1"].includes(identity.address), "Refusing a non-loopback PostgreSQL server");
      database ??= identity.database;
      assert.equal(identity.database, database);
      assert.ok(!pids.includes(identity.pid), "Distinct QA backends are required");
      pids.push(identity.pid);
    }
    const [admin, writer, observer] = clients;
    // Capturing uses only the guarded test executor; it performs no DB I/O.
    const insert = await captureOwnershipMutation();
    const update = await captureOwnershipMutation({ update: true });
    const event = ownershipFixture();
    await admin.query(`CREATE SCHEMA ${s}`);
    schemaCreated = true;
    for (const client of clients) {
      await client.query(`SET search_path TO ${s}, pg_catalog`);
      await client.query("SELECT set_config('statement_timeout','12000',false), set_config('lock_timeout','10000',false)");
      assert.equal((await client.query("SELECT current_schema() AS schema")).rows[0].schema, schema);
    }
    await admin.query(`
      CREATE TABLE ${s}.batches(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, bid text);
      CREATE TABLE ${s}.tags(id uuid PRIMARY KEY, batch_id uuid NOT NULL, uid_hex text NOT NULL, status text NOT NULL, lifecycle_state text);
      CREATE TABLE ${s}.events(id bigint PRIMARY KEY, tenant_id uuid NOT NULL, batch_id uuid NOT NULL, uid_hex text NOT NULL, result text, reason text);
      CREATE TABLE ${s}.tag_manual_tamper_overrides(batch_id uuid, uid_hex text, tamper_status text, reason text, PRIMARY KEY(batch_id,uid_hex));
      CREATE TABLE ${s}.consumer_product_ownerships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, consumer_id uuid NOT NULL, batch_id uuid NOT NULL, tag_id uuid, uid_hex text NOT NULL, event_id bigint NOT NULL, status text NOT NULL CHECK(status IN ('claimed','blocked_replay','revoked','disputed')), source text NOT NULL, trust_snapshot jsonb NOT NULL DEFAULT '{}', updated_at timestamptz DEFAULT now(), UNIQUE(consumer_id,event_id));
      CREATE UNIQUE INDEX ownership_qa_active_uid ON ${s}.consumer_product_ownerships(tenant_id,uid_hex) WHERE status='claimed';
    `);
    async function seed(isUpdate = false) {
      await admin.query(`TRUNCATE ${s}.consumer_product_ownerships, ${s}.tag_manual_tamper_overrides, ${s}.tags, ${s}.events, ${s}.batches`);
      await admin.query(`INSERT INTO ${s}.batches VALUES($1,$2,$3)`, [event.batch_id,event.tenant_id,event.bid]);
      await admin.query(`INSERT INTO ${s}.tags VALUES($1,$2,$3,'active','active')`, [event.current_tag_id,event.batch_id,event.uid_hex]);
      await admin.query(`INSERT INTO ${s}.events VALUES($1,$2,$3,$4,$5,$6)`, [event.id,event.tenant_id,event.batch_id,event.uid_hex,event.result,event.reason]);
      if (isUpdate) await admin.query(`INSERT INTO ${s}.consumer_product_ownerships(id,tenant_id,consumer_id,batch_id,tag_id,uid_hex,event_id,status,source) VALUES($1,$2,$3,$4,$5,$6,$7,'claimed','sun_passport')`, [update.ownershipId,event.tenant_id,update.consumerId,event.batch_id,event.current_tag_id,event.uid_hex,event.id]);
    }
    async function mutate(isUpdate) {
      const statement = (isUpdate ? update : insert).mutation;
      assert.doesNotMatch(statement.query, /\bpublic\s*\./i);
      return (await writer.query(statement.query, statement.parameters)).rows;
    }
    async function status() { return (await observer.query(`SELECT status FROM ${s}.consumer_product_ownerships`)).rows.map(row => row.status); }
    async function check(name, operation) {
      try { const evidence = await operation(); report.checks.push({ name, ok: true, ...(evidence ? { evidence } : {}) }); }
      catch (error) { report.checks.push({ name, ok: false, error: error.message, ...(error.code ? { code: error.code } : {}) }); }
    }
    async function waitForLock(pid, expectedBlocker) {
      const until = Date.now() + 4000;
      while (Date.now() < until) {
        const { rows: [row] } = await observer.query("SELECT wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1", [pid]);
        if (row?.wait_event_type === "Lock" && row.blockers.includes(expectedBlocker)) {
          const observation = { backendPid: pid, blockerPid: expectedBlocker, waitEventType: row.wait_event_type };
          report.lockObservations.push(observation);
          return observation;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error("Expected ownership/tag row lock was not observed");
    }
    for (const isUpdate of [false,true]) {
      const method = isUpdate ? "UPDATE" : "INSERT";
      await check(`${method}: active exact tag permits the historical VALID_CLOSED claim`, async () => {
        await seed(isUpdate); assert.equal((await mutate(isUpdate))[0].status,"claimed"); assert.deepEqual(await status(),["claimed"]);
      });
      await check(`${method}: active legacy null lifecycle and authenticated hardware opening preserve ownership semantics`, async () => {
        await seed(isUpdate); await admin.query(`UPDATE ${s}.tags SET lifecycle_state=NULL`); await admin.query(`UPDATE ${s}.events SET result='VALID_OPENED',reason='tagtamper_opened:4F4F'`);
        assert.equal((await mutate(isUpdate))[0].status,"claimed");
      });
      for (const state of ["inactive","suspended","quarantined","lost","expired","broken","tampered","revoked","unknown",""]) {
        await check(`${method}: current lifecycle ${state || "empty"} blocks the captured valid snapshot`, async () => {
          await seed(isUpdate); await admin.query(`UPDATE ${s}.tags SET status=$1,lifecycle_state=$2`, [state === "revoked" ? "revoked" : "inactive",state]);
          assert.equal((await mutate(isUpdate))[0].status,"revoked"); assert.deepEqual(await status(),["revoked"]);
        });
      }
      for (const [name,alter,parameters] of [
        ["inactive status with active lifecycle",`UPDATE ${s}.tags SET status='inactive'`,[]],
        ["missing exact tag",`DELETE FROM ${s}.tags`,[]],
        ["replacement tag ID",`UPDATE ${s}.tags SET id=$1`,[randomUUID()]],
        ["changed event batch",`UPDATE ${s}.events SET batch_id=$1`,[randomUUID()]],
        ["changed event tenant",`UPDATE ${s}.events SET tenant_id=$1`,[randomUUID()]],
        ["changed batch tenant",`UPDATE ${s}.batches SET tenant_id=$1`,[randomUUID()]],
        ["changed event UID",`UPDATE ${s}.events SET uid_hex='04AABBCCDDEE99'`,[]],
        ["ambiguous current identity",`INSERT INTO ${s}.tags SELECT $1,batch_id,lower(uid_hex),status,lifecycle_state FROM ${s}.tags`,[randomUUID()]],
        ["replay event",`UPDATE ${s}.events SET result='REPLAY_SUSPECT'`,[]],
        ["unknown result",`UPDATE ${s}.events SET result='VALID_FUTURE_UNKNOWN'`,[]],
        ["later manual operator declaration",`INSERT INTO ${s}.tag_manual_tamper_overrides VALUES($1,$2,'UNKNOWN','operator declared open')`,[event.batch_id,event.uid_hex]],
      ]) {
        await check(`${method}: ${name} grants no title`, async () => {
          await seed(isUpdate); await admin.query(alter,parameters); assert.equal((await mutate(isUpdate))[0].status,"revoked"); assert.deepEqual(await status(),["revoked"]);
        });
      }
      await check(`${method}: lifecycle transition holding the tag lock wins before the claim`, async () => {
        await seed(isUpdate); await admin.query("BEGIN"); let pending;
        try {
          await admin.query(`UPDATE ${s}.tags SET status='inactive',lifecycle_state='suspended' WHERE id=$1`,[event.current_tag_id]);
          pending = mutate(isUpdate); pending.catch(() => {});
          const observation = await waitForLock(pids[1],pids[0]);
          await admin.query("COMMIT"); assert.equal((await pending)[0].status,"revoked"); assert.deepEqual(await status(),["revoked"]);
          return observation;
        } finally { await admin.query("ROLLBACK"); if (pending) await pending.catch(() => {}); }
      });
      await check(`${method}: claim holding the tag lock serializes a subsequent lifecycle transition`, async () => {
        await seed(isUpdate); await writer.query("BEGIN"); let pending;
        try {
          assert.equal((await mutate(isUpdate))[0].status,"claimed");
          pending = admin.query(`UPDATE ${s}.tags SET status='inactive',lifecycle_state='suspended' WHERE id=$1`,[event.current_tag_id]); pending.catch(() => {});
          const observation = await waitForLock(pids[0],pids[1]);
          await writer.query("COMMIT"); await pending; assert.deepEqual(await status(),["claimed"]);
          assert.equal((await observer.query(`SELECT lifecycle_state FROM ${s}.tags`)).rows[0].lifecycle_state,"suspended");
          return observation;
        } finally { await writer.query("ROLLBACK"); if (pending) await pending.catch(() => {}); }
      });
    }
    await check("SQL parameter failure rolls back the ownership statement without a claim", async () => {
      await seed(); const parameters = [...insert.mutation.parameters]; const index = parameters.indexOf(event.current_tag_id); assert.ok(index >= 0); parameters[index]="invalid-synthetic-uuid";
      await assert.rejects(writer.query(insert.mutation.query,parameters), error => error.code === "22P02"); assert.deepEqual(await status(),[]);
    });
    report.ok = report.checks.length > 0 && report.checks.every(check => check.ok);
    return report;
  } finally {
    const uniqueClients = [...new Set(clients)];
    for (const client of uniqueClients) { try { await client.query("ROLLBACK"); } catch {} }
    try {
      if (schemaCreated) { assert.match(schema,OWN_SCHEMA); await clients[0].query(`DROP SCHEMA ${s} CASCADE`); report.cleanup.schemaDropped=true; }
    } finally {
      const closed = await Promise.allSettled(uniqueClients.map(client => client.end()));
      report.cleanup.connectionsClosed=closed.every(result => result.status === "fulfilled");
      if (!report.cleanup.connectionsClosed) report.ok=false;
    }
  }
}
