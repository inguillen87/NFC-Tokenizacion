import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Socket, isIPv4 } from "node:net";
import { captureOwnershipMutation, ownershipFixture } from "./ownership-current-state-fixture.mjs";

const OWN_SCHEMA = /^ownership_current_qa_[0-9a-f]{32}$/;
const QA_DATABASE = /^nexid_e2e(?:_[a-z0-9][a-z0-9_-]{0,48})?$/;
const LOCAL_DOCKER = "unix:///var/run/docker.sock";
const GITHUB_POSTGRES_IMAGES = Object.freeze({
  "16.4": "postgres:16.4-alpine@sha256:5660c2cbfea50c7a9127d17dc4e48543eedd3d7a41a595a2dfa572471e37e64c",
  "18.4": "postgres:18.4-alpine@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15",
});
const issuedDockerAttestations = new WeakSet();
const loopbackPeer = value => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(value);
function privateIpv4(value) {
  if (!isIPv4(value)) return false;
  const [a,b] = value.split(".").map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// Only the enterprise entrypoint issues this descriptor after its existing
// test-env/URL/empty-database/version checks. Docker output stays in memory:
// no container Env, credentials or raw inspect payload enters the receipt.
export function attestGithubPostgresDocker({ config, env, platform, workflowText, runDocker }) {
  if (env?.GITHUB_ACTIONS !== "true") return null;
  assert.equal(platform, "linux", "Docker PostgreSQL attestation requires the Linux GitHub runner");
  assert.equal(env.NODE_ENV, "test"); assert.equal(env.VERCEL_ENV, "test");
  const url = new URL(config.databaseUrl);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const port = Number(url.port || 5432);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol) && !url.search && !url.hash, "Unaltered QA PostgreSQL URL required");
  assert.ok(["127.0.0.1", "::1"].includes(host) && port === 5432, "Literal loopback CI PostgreSQL endpoint required");
  assert.equal(url.username, "nexid_e2e"); assert.equal(config.databaseRole, "nexid_e2e");
  assert.match(config.databaseName, QA_DATABASE);
  assert.equal(decodeURIComponent(url.pathname.slice(1)), config.databaseName);
  const image = GITHUB_POSTGRES_IMAGES[config.expectedPostgresVersion];
  assert.ok(image, "Only the exact PostgreSQL 16.4/18.4 CI images may use Docker attestation");
  assert.equal(config.expectedServerVersionNumber, config.expectedPostgresVersion === "16.4" ? 160004 : 180004);
  const matrix = [...String(workflowText).matchAll(/- version: "([^"]+)"\s+image: "([^"]+)"/g)];
  assert.equal(matrix.length, 2, "Expected immutable two-version PostgreSQL CI matrix");
  for (const [version,pinned] of Object.entries(GITHUB_POSTGRES_IMAGES)) {
    assert.equal(matrix.filter(row => row[1] === version && row[2] === pinned).length, 1, "CI image pin must equal the checked-in workflow");
  }
  assert.equal(typeof runDocker, "function", "Explicit local Docker reader required");
  const ids = String(runDocker(["--host", LOCAL_DOCKER, "ps", "--filter", `publish=${port}`, "--filter", "status=running", "--format", "{{.ID}}"])).trim().split(/\s+/).filter(Boolean);
  assert.equal(ids.length, 1, "Exactly one local running container must publish the QA PostgreSQL port");
  assert.match(ids[0], /^[a-f0-9]{12,64}$/);
  let inspected;
  try { inspected = JSON.parse(runDocker(["--host", LOCAL_DOCKER, "inspect", ids[0]])); }
  catch { throw new Error("Local Docker PostgreSQL inspection JSON rejected"); }
  assert.ok(Array.isArray(inspected) && inspected.length === 1, "One local container inspection required");
  const container = inspected[0];
  assert.match(container?.Id || "", /^[a-f0-9]{64}$/);
  assert.ok(container.Id.startsWith(ids[0]));
  assert.equal(container.State?.Running, true, "QA PostgreSQL container must be running");
  assert.equal(container.Config?.Image, image, "QA container must use the exact immutable CI image");
  const bindings = container.NetworkSettings?.Ports?.["5432/tcp"];
  assert.ok(Array.isArray(bindings) && bindings.length > 0 && bindings.some(row => ["0.0.0.0", "127.0.0.1"].includes(row.HostIp)), "An IPv4 local published PostgreSQL binding is required");
  assert.ok(bindings.every(row => ["0.0.0.0", "127.0.0.1", "::", "::1"].includes(row.HostIp) && row.HostPort === String(port)), "QA container port binding mismatch");
  const networks = Object.entries(container.NetworkSettings?.Networks || {});
  assert.equal(networks.length, 1, "Exactly one local GitHub service network is required");
  const [networkName,network] = networks[0];
  assert.match(networkName, /^github_network_[a-f0-9]{32}$/);
  assert.equal(container.HostConfig?.NetworkMode, networkName);
  assert.match(network.NetworkID || "", /^[a-f0-9]{64}$/);
  assert.ok(privateIpv4(network.IPAddress), "A private IPv4 from the attested local container is required");
  const descriptor = Object.freeze({
    kind: "github-actions-local-docker-postgresql-v1", daemon: LOCAL_DOCKER,
    containerId: container.Id, image, networkName, networkId: network.NetworkID,
    expectedServerAddress: network.IPAddress, expectedHost: host, expectedPort: port,
    databaseName: config.databaseName, databaseRole: config.databaseRole,
    postgresVersion: config.expectedPostgresVersion, serverVersionNumber: config.expectedServerVersionNumber,
    workflowSha256: createHash("sha256").update(workflowText).digest("hex"),
  });
  issuedDockerAttestations.add(descriptor);
  return descriptor;
}

export function assertQaPostgresClientIdentity(client, identity, { dockerAttestation, env = process.env, platform = process.platform } = {}) {
  assert.match(identity?.database || "", QA_DATABASE);
  assert.equal(identity.role, "nexid_e2e", "A dedicated nexid_e2e QA role is required");
  if (!dockerAttestation) {
    assert.ok(["127.0.0.1", "::1"].includes(identity.address), "Refusing a non-loopback PostgreSQL server");
    return { mode: "native-server-loopback", serverAddress: identity.address };
  }
  assert.ok(issuedDockerAttestations.has(dockerAttestation), "Unissued Docker PostgreSQL attestation refused");
  assert.ok(env.GITHUB_ACTIONS === "true" && env.NODE_ENV === "test" && env.VERCEL_ENV === "test" && platform === "linux", "Docker PostgreSQL attestation requires the test Linux GitHub runner");
  const d = dockerAttestation, parameters = client?.connectionParameters, socket = client?.connection?.stream;
  assert.ok(parameters && parameters.host === d.expectedHost && Number(parameters.port) === d.expectedPort && parameters.user === d.databaseRole && parameters.database === d.databaseName, "Actual PostgreSQL client endpoint or identity mismatch");
  assert.ok(socket instanceof Socket && !socket.destroyed && !socket.connecting && socket.readyState === "open" && socket.readable && socket.writable && client._connected === true && !client._ending && !client._ended, "A live actual PostgreSQL TCP socket is required");
  assert.ok(loopbackPeer(socket.remoteAddress) && socket.remoteAddress.replace(/^::ffff:/, "") === d.expectedHost && socket.remotePort === d.expectedPort, "Actual PostgreSQL TCP peer must match the attested loopback endpoint");
  assert.equal(identity.database, d.databaseName, "Attested QA database mismatch");
  assert.equal(identity.role, d.databaseRole, "Attested QA role mismatch");
  assert.equal(identity.address, d.expectedServerAddress, "PostgreSQL server address must equal the exact attested local Docker IPv4");
  assert.equal(Number(identity.server_version_number), d.serverVersionNumber, "Attested PostgreSQL version mismatch");
  assert.equal(String(identity.neon_endpoint_id || "").trim(), "", "Remote Neon PostgreSQL refused");
  assert.equal(identity.transaction_read_only, "off", "Writable disposable QA PostgreSQL required");
  assert.ok(Number.isInteger(identity.pid) && identity.pid > 0, "A numeric PostgreSQL backend PID is required");
  return { mode: d.kind, serverAddress: identity.address, tcpPeer: socket.remoteAddress, tcpPort: socket.remotePort, serverVersionNumber: Number(identity.server_version_number) };
}

// Importing this file does not connect or read environment credentials. Only
// an explicit, already-connected loopback QA factory can run these statements.
export async function runOwnershipCurrentStatePostgresQa({ connect, dockerAttestation } = {}) {
  assert.equal(typeof connect, "function", "An explicit disposable QA connection factory is required");
  const schema = `ownership_current_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, OWN_SCHEMA);
  const s = `"${schema}"`;
  const clients = [];
  const report = {
    kind: "synthetic-postgresql-ownership-current-state", ok: false, schema,
    checks: [], lockObservations: [], connectionEvidence: [], cleanup: { schemaDropped: false, connectionsClosed: false },
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
      const { rows: [identity] } = await client.query("SELECT current_database() AS database, current_user AS role, pg_backend_pid() AS pid, host(inet_server_addr()) AS address, current_setting('server_version_num')::integer AS server_version_number, current_setting('neon.endpoint_id', true) AS neon_endpoint_id, current_setting('transaction_read_only') AS transaction_read_only");
      report.connectionEvidence.push(assertQaPostgresClientIdentity(client, identity, { dockerAttestation }));
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
