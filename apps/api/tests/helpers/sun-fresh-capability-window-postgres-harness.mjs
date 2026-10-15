import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { assertQaPostgresClientIdentity } from "./ownership-current-state-postgres-harness.mjs";

const OWN_SCHEMA = /^sun_fresh_window_qa_[0-9a-f]{32}$/;
const ACTIONS = ["consumer_save_product", "consumer_join_tenant", "loyalty_enroll", "consumer_claim_ownership"];
const TEST_ENV = {
  NODE_ENV: "test", VERCEL_ENV: "test",
  NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
  NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e",
};

// No import-time I/O. Only the existing enterprise entrypoint supplies guarded,
// already-connected disposable PostgreSQL clients. No SQL predicate is copied:
// consumeSunFreshHandoff -> hitSunRateLimit -> reserveSunRateLimit execute their
// actual statements through the existing test-only SQL executor.
export async function runSunFreshCapabilityWindowPostgresQa({ connect, dockerAttestation } = {}) {
  assert.equal(typeof connect, "function", "An explicit disposable QA connection factory is required");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.VERCEL_ENV, "test");
  const schema = `sun_fresh_window_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, OWN_SCHEMA);
  const s = `"${schema}"`, clients = [], executionClient = new AsyncLocalStorage();
  const report = {
    kind: "synthetic-postgresql-sun-fresh-capability-window", ok: false,
    checks: [], connectionEvidence: [], realReservationExecutions: 0,
    sqlCopiedIntoHarness: false, sources: [],
    cleanup: { schemaDropped: false, connectionsClosed: false },
    limits: [
      "Synthetic schema and signed tokens; no customer, NFC, OTP, provider or external database request",
      "Application clock and bucket timestamp are explicit fixtures; no real-time waiting or production time change",
      "Actual limiter SQL executes; timestamp seeding is confined to the owned fixture row",
      "This checks replay consumption, not PIN, tenant commercial policy, ownership, outbox or an incident in production",
    ],
  };
  const savedEnv = Object.fromEntries(["SUN_HANDOFF_SECRET", "SUN_HANDOFF_SECRET_PREVIOUS", "SUN_HANDOFF_ALLOW_LEGACY_SECRET_FALLBACK", "RATE_LIMIT_KEY_PEPPER"].map(key => [key, process.env[key]]));
  let schemaCreated = false, removeExecutor;
  const rawTokens = new Set();
  try {
    let database;
    const pids = new Set();
    for (let index = 0; index < 3; index += 1) {
      const client = await connect();
      clients.push(client);
      assert.equal(new Set(clients).size, clients.length, "Distinct PostgreSQL clients required");
      const { rows: [identity] } = await client.query("SELECT current_database() AS database,current_user AS role,pg_backend_pid() AS pid,host(inet_server_addr()) AS address,current_setting('server_version_num')::integer AS server_version_number,current_setting('neon.endpoint_id',true) AS neon_endpoint_id,current_setting('transaction_read_only') AS transaction_read_only");
      report.connectionEvidence.push(assertQaPostgresClientIdentity(client, identity, { dockerAttestation }));
      database ??= identity.database;
      assert.equal(identity.database, database);
      assert.ok(!pids.has(identity.pid), "Distinct PostgreSQL backends required");
      pids.add(identity.pid);
    }
    const [admin, writer, secondWriter] = clients;
    await admin.query(`CREATE SCHEMA ${s}`);
    schemaCreated = true;
    for (const client of clients) {
      await client.query(`SET search_path TO ${s}, pg_catalog`);
      await client.query("SELECT set_config('statement_timeout','12000',false),set_config('lock_timeout','10000',false)");
      assert.equal((await client.query("SELECT current_schema() AS schema")).rows[0].schema, schema);
    }
    await admin.query(`CREATE TABLE ${s}.sun_rate_limit_buckets (
      scope text NOT NULL, scope_key_hash text NOT NULL,
      window_started_at timestamptz NOT NULL DEFAULT now(),
      hit_count bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(scope,scope_key_hash),
      CHECK(scope ~ '^[a-z0-9:_-]{1,80}$'), CHECK(scope_key_hash ~ '^[0-9a-f]{64}$'), CHECK(hit_count >= 0)
    )`);
    process.env.SUN_HANDOFF_SECRET = "sun-fresh-window-explicit-synthetic-secret-v1";
    process.env.SUN_HANDOFF_SECRET_PREVIOUS = "";
    process.env.SUN_HANDOFF_ALLOW_LEGACY_SECRET_FALLBACK = "false";
    process.env.RATE_LIMIT_KEY_PEPPER = "sun-fresh-window-explicit-synthetic-pepper-v1";
    const db = await import("../../src/lib/db.ts");
    const fresh = await import("../../src/lib/sun-fresh-handoff.ts");
    const store = await import("../../src/lib/sun-rate-limit-store.ts");
    for (const relative of ["db.ts", "sun-fresh-handoff.ts", "sun-rate-limit-store.ts"]) {
      const bytes = await readFile(new URL(`../../src/lib/${relative}`, import.meta.url));
      report.sources.push({ path: `apps/api/src/lib/${relative}`, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
    removeExecutor = db.installEphemeralE2eSqlExecutor(async (strings, ...values) => {
      const text = strings.reduce((statement, part, index) => statement + (index ? `$${index}` : "") + part, "");
      assert.match(text, /^\s*WITH stale AS \(/, "Only the real atomic limiter reservation may reach this executor");
      assert.doesNotMatch(text, /\bpublic\s*\.|\b(?:CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
      assert.ok(values.every(value => typeof value !== "string" || !rawTokens.has(value)), "Raw token must never become an SQL parameter");
      report.realReservationExecutions += 1;
      return (await (executionClient.getStore() || writer).query(text, values)).rows;
    }, TEST_ENV);

    async function at(seconds, callback) {
      const previousNow = Date.now;
      Date.now = () => seconds * 1000;
      try { return await callback(); } finally { Date.now = previousNow; }
    }
    async function now(client = writer) {
      return Number((await client.query("SELECT floor(extract(epoch FROM now()))::bigint AS seconds")).rows[0].seconds);
    }
    function token(issuedAt, { lifetime = 300, futureIssued = 0 } = {}) {
      const expected = { bid: "SYNTHETIC-FRESH-WINDOW", eventId: randomUUID(), uidHex: "04AABBCCDDEE11", readCounter: 17 };
      const raw = fresh.createSunFreshHandoffToken({ ...expected, diagnosticId: 88001, traceId: `synthetic-${randomUUID()}`, iat: issuedAt + futureIssued, exp: issuedAt + futureIssued + lifetime });
      rawTokens.add(raw);
      return { raw, expected };
    }
    function consume(fixture, action = ACTIONS[0]) {
      return fresh.consumeSunFreshHandoff(new Request("http://127.0.0.1/mobile/passport/synthetic/consumer/save-product", { method: "POST" }), { fresh_token: fixture.raw }, fixture.expected, action);
    }
    function key(fixture, action = ACTIONS[0]) {
      return store.rateLimitBucketKey("sun_fresh_capability_once", `${action}:${createHash("sha256").update(fixture.raw, "utf8").digest("hex")}`);
    }
    async function row(fixture, action = ACTIONS[0]) {
      const k = key(fixture, action);
      return (await writer.query(`SELECT hit_count::text AS hits,window_started_at::text AS started FROM ${s}.sun_rate_limit_buckets WHERE scope=$1 AND scope_key_hash=$2`, [k.scope, k.scopeKeyHash])).rows[0];
    }
    async function age(fixture, seconds) {
      const k = key(fixture);
      const result = await writer.query(`UPDATE ${s}.sun_rate_limit_buckets SET window_started_at=now()-($3::integer * interval '1 second') WHERE scope=$1 AND scope_key_hash=$2 RETURNING window_started_at::text AS started`, [k.scope, k.scopeKeyHash, seconds]);
      assert.equal(result.rowCount, 1, "Only the previously consumed fixture bucket is aged");
      return result.rows[0].started;
    }
    async function check(name, callback) {
      await callback();
      report.checks.push({ name, ok: true });
    }
    async function sameActionCase(name, { elapsed, lifetime = 300, futureIssued = 0, initialAge = 0 }) {
      await check(name, async () => {
        await writer.query("BEGIN");
        try {
          const current = await now();
          const fixture = await at(current - initialAge, () => token(current - initialAge, { lifetime, futureIssued }));
          assert.equal((await at(current, () => consume(fixture))).ok, true, "The first real reservation succeeds");
          assert.equal((await row(fixture)).hits, "1");
          const seededStart = await age(fixture, elapsed);
          assert.deepEqual(await at(current + elapsed, () => consume(fixture)), { ok: false, reason: "fresh_token_already_used" });
          assert.deepEqual(await row(fixture), { hits: "2", started: seededStart }, "The real predicate must increment the same bucket without resetting its start");
        } finally { await writer.query("ROLLBACK"); }
      });
    }
    for (const elapsed of [1, 149, 200, 299]) await sameActionCase(`same action remains consumed at +${elapsed}s`, { elapsed });
    await sameActionCase("maximum future iat skew remains consumed at +359s", { elapsed: 359, futureIssued: 60 });
    await sameActionCase("short-lived token remains consumed until +29s", { elapsed: 29, lifetime: 30 });
    await sameActionCase("first use late in a token's lifetime cannot rearm", { elapsed: 99, initialAge: 200 });
    await check("expiry boundary and after expiry perform no reservation", async () => {
      const current = await now();
      const fixture = await at(current, () => token(current));
      const before = report.realReservationExecutions;
      for (const elapsed of [300, 301]) assert.deepEqual(await at(current + elapsed, () => consume(fixture)), { ok: false, reason: "fresh_token_expired" });
      assert.equal(report.realReservationExecutions, before);
      assert.equal(await row(fixture), undefined);
    });
    await check("four action scopes remain independent and each stays consumed", async () => {
      const current = await now();
      const fixture = await at(current, () => token(current));
      for (const action of ACTIONS) assert.equal((await at(current, () => consume(fixture, action))).ok, true);
      assert.equal(new Set(ACTIONS.map(action => key(fixture, action).scopeKeyHash)).size, 4);
      for (const action of ACTIONS) {
        // Explicitly age only this synthetic scope while the application clock advances.
        const k = key(fixture, action);
        await writer.query(`UPDATE ${s}.sun_rate_limit_buckets SET window_started_at=now()-interval '200 seconds' WHERE scope=$1 AND scope_key_hash=$2`, [k.scope, k.scopeKeyHash]);
        assert.deepEqual(await at(current + 200, () => consume(fixture, action)), { ok: false, reason: "fresh_token_already_used" });
        assert.equal((await row(fixture, action)).hits, "2");
      }
    });
    await check("concurrent independent backends permit exactly one same-action consume", async () => {
      const current = await now();
      const fixture = await at(current, () => token(current));
      const results = await at(current, () => Promise.all([writer, secondWriter].map(client => executionClient.run(client, () => consume(fixture)))));
      assert.equal(results.filter(result => result.ok === true).length, 1);
      assert.equal(results.filter(result => result.ok === false && result.reason === "fresh_token_already_used").length, 1);
      assert.equal((await row(fixture)).hits, "2");
    });
    report.ok = report.checks.length === 10 && report.checks.every(check => check.ok);
  } finally {
    removeExecutor?.();
    rawTokens.clear();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    try {
      if (schemaCreated) { await clients[0].query(`DROP SCHEMA ${s} CASCADE`); report.cleanup.schemaDropped = true; }
    } finally {
      await Promise.all(clients.map(client => client.end()));
      report.cleanup.connectionsClosed = true;
    }
  }
  return report;
}
