import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { normalizeTenantTapRealtimeEvent } from "../../../packages/core/src/index.ts";
import { withConsumerNetworkEventProvenance } from "../src/lib/consumer-network-provenance.ts";
import { projectConsentedPostTapLocation } from "../src/lib/post-tap-location-projection.ts";

function checkedTarget(value) {
  let target;
  try { target = new URL(value); } catch { throw new Error("s7_qa_database_target_invalid"); }
  if (!["postgres:", "postgresql:"].includes(target.protocol)
    || !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
    || target.pathname !== "/nexid_e2e_s7" || target.username !== "nexid_e2e"
    || target.search || target.hash) throw new Error("s7_qa_database_target_refused");
  return target;
}

async function actualModule(relativePath, names, bindings) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const parsed = ts.createSourceFile("runtime.ts", source, ts.ScriptTarget.ES2022, true);
  const withoutImports = parsed.statements.filter(node => !ts.isImportDeclaration(node))
    .map(node => node.getText(parsed).replace(/^export\s+/, "")).join("\n");
  const code = ts.transpileModule(withoutImports, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(bindings), `${code}\nreturn { ${names.join(",")} };`)(...Object.values(bindings));
}

test("realtime PostgreSQL harness refuses remote and non-QA database targets", () => {
  assert.equal(checkedTarget("postgres://nexid_e2e@127.0.0.1/nexid_e2e_s7").hostname, "127.0.0.1");
  for (const value of [undefined, "postgres://nexid_e2e@remote.example/nexid_e2e_s7",
    "postgres://postgres@localhost/nexid_e2e_s7", "postgres://nexid_e2e@localhost/production",
    "postgres://nexid_e2e@localhost/nexid_e2e_s7?options=anything"]) {
    assert.throws(() => checkedTarget(value), /s7_qa_database_target_/);
  }
});

// SQL, snapshot projection, push loader and payload construction are the actual
// API implementation. Transport is captured locally; dashboard admission has
// its own real-mapper tests in the dashboard release, not a reconstructed mapper.
test("mixed realtime snapshot and push preserve durable provenance without hiding security history", {
  skip: !process.env.NEXID_S7_QA_DATABASE_URL && "Explicit loopback QA database not configured; no database contacted",
  timeout: 90000,
}, async () => {
  checkedTarget(process.env.NEXID_S7_QA_DATABASE_URL);
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.NEXID_S7_QA_DATABASE_URL, connectionTimeoutMillis: 3000, statement_timeout: 10000 });
  const schema = `realtime_provenance_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^realtime_provenance_qa_[a-f0-9]{32}$/);
  const tenantA = "10000000-0000-4000-8000-000000000001";
  const tenantB = "10000000-0000-4000-8000-000000000002";
  const batchA = "20000000-0000-4000-8000-000000000001";
  const batchB = "20000000-0000-4000-8000-000000000002";
  const tagA = "30000000-0000-4000-8000-000000000001";
  const tagB = "30000000-0000-4000-8000-000000000002";
  const writer = { replay_execution_class: "operational" };
  const canonical = { canonical_event: true, event_family: "tap", event_mode: "live", metric_scope: "scan", simulated: false };
  const fixtures = [];
  let reads = 0;
  let queue = Promise.resolve();
  try {
    await client.connect();
    const identity = (await client.query("SELECT current_database() AS db, current_user AS role")).rows[0];
    assert.equal(identity.db, "nexid_e2e_s7");
    assert.equal(identity.role, "nexid_e2e");
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
    await client.query(`
      CREATE TABLE tenants(id uuid PRIMARY KEY, slug text);
      CREATE TABLE batches(id uuid PRIMARY KEY, tenant_id uuid, bid text, sdm_config jsonb DEFAULT '{}'::jsonb);
      CREATE TABLE tags(id uuid PRIMARY KEY, batch_id uuid, uid_hex text);
      CREATE TABLE events(id bigint, created_at timestamptz, tenant_id uuid, batch_id uuid, tag_id text, uid_hex text,
        event_type text, source text, product_name text, result text, verdict text, risk_level text, reason text,
        cmac_ok boolean, allowlisted boolean, city text, country_code text, lat float8, lng float8,
        location_source text, location_accuracy_m float8, post_tap_location_observation jsonb,
        device_label text, user_agent text, meta jsonb, bid text, PRIMARY KEY(id,created_at));
      CREATE TABLE canonical_event_operations(tenant_id uuid,event_id bigint,event_created_at timestamptz,event_mode text);
      CREATE TABLE consumer_tap_history(tenant_id uuid,tap_event_id bigint,consumer_id uuid);
      CREATE TABLE consumer_tenant_consents(tenant_id uuid,consumer_id uuid,scope text,granted boolean,revoked_at timestamptz);
    `);
    await client.query("INSERT INTO tenants VALUES($1,'qa-a'),($2,'qa-b')", [tenantA, tenantB]);
    await client.query("INSERT INTO batches(id,tenant_id,bid) VALUES($1,$2,'QA-A'),($3,$4,'QA-B')", [batchA, tenantA, batchB, tenantB]);
    await client.query("INSERT INTO tags VALUES($1,$2,'04AABBCCDDEE01'),($3,$4,'04AABBCCDDEE02')", [tagA, batchA, tagB, batchB]);
    const now = (await client.query("SELECT now() AS now")).rows[0].now;
    async function fixture(id, expected, changes = {}) {
      const row = { id, created_at: new Date(now.getTime() - (50 - id) * 60000), tenant_id: tenantA,
        batch_id: batchA, tag_id: tagA, uid_hex: "04AABBCCDDEE01", event_type: "TAP_VALID", source: "real",
        product_name: "Synthetic QA bottle", result: "VALID_OPENED", verdict: "valid", risk_level: "none",
        reason: "VALID_OPENED", cmac_ok: true, allowlisted: true, meta: writer, ...changes };
      const columns = Object.keys(row);
      await client.query(`INSERT INTO events(${columns.join(",")}) VALUES(${columns.map((_, index) => `$${index + 1}`).join(",")})`, Object.values(row));
      fixtures.push({ row, expected });
      return row;
    }
    await fixture(1, "operational_tap");
    await fixture(2, "operational_tap", { event_type: "TAP_INVALID", result: "INVALID", verdict: "invalid", reason: "CMAC_FAIL", cmac_ok: false });
    await fixture(3, "operational_tap", { event_type: "REPLAY_SUSPECT", result: "REPLAY_SUSPECT", verdict: "replay_suspect", reason: "COUNTER_REPLAY" });
    await fixture(4, "legacy_unclassified", { tag_id: null });
    await fixture(5, "declared_demo", { meta: { ...writer, simulated: true } });
    await fixture(6, "imported", { source: "imported" });
    await fixture(7, "declared_demo", { source: "demo" });
    await fixture(8, "legacy_unclassified", { meta: {} });
    const reserved = await fixture(9, "operational_tap", { meta: canonical });
    await client.query("INSERT INTO canonical_event_operations VALUES($1,$2,$3,'live')", [tenantA, reserved.id, reserved.created_at]);
    const forged = await fixture(10, "legacy_unclassified", { meta: canonical });
    await client.query("INSERT INTO canonical_event_operations VALUES($1,$2,$3,'live')", [tenantA, forged.id, new Date(forged.created_at.getTime() + 1000)]);
    await fixture(11, "legacy_unclassified", { tag_id: tagB });
    await fixture(12, "operational_tap", { tenant_id: tenantB, batch_id: batchB, tag_id: tagB, uid_hex: "04AABBCCDDEE02" });
    await fixture(13, "operational_tap", { created_at: new Date(now.getTime() - 48 * 3600000) });
    const ambiguous = await fixture(14, "legacy_unclassified");
    await fixture(14, "legacy_unclassified", { created_at: new Date(ambiguous.created_at.getTime() + 1) });
    await fixture(15, "declared_demo", { meta: { ...writer, simulated: "\ttrue\n" } });
    await fixture(16, "legacy_unclassified", { event_type: "PROVENANCE_VIEWED" });
    const before = (await client.query("SELECT md5(string_agg(to_jsonb(e)::text,'' ORDER BY id,created_at)) AS digest FROM events e")).rows[0].digest;
    const execute = (strings, ...values) => {
      const statement = strings.reduce((out, part, index) => out + (index ? `$${index}` : "") + part, "");
      assert.match(statement.trim(), /^(SELECT|WITH)\b/i);
      assert.doesNotMatch(statement, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b|\bpublic\s*\./i);
      reads++;
      const result = queue.then(() => client.query(statement, values)).then(result => result.rows);
      queue = result.then(() => undefined, () => undefined);
      return result;
    };
    const published = [];
    const bindings = { sql: execute, withConsumerNetworkEventProvenance, projectConsentedPostTapLocation,
      normalizeTenantTapRealtimeEvent, publishRealtimeEvent: async payload => { published.push(payload); return { distributed: false }; } };
    const { fetchRows } = await actualModule("../src/app/admin/events/stream/route.ts", ["fetchRows"], bindings);
    const projection = await actualModule("../src/lib/realtime-tap-projection.ts", ["loadTenantTapRealtimeProjection", "publishTenantTapRealtimeProjection"], bindings);
    const window = { id: "24h", interval: "24 hours", maxAgeMs: 86400000 };
    const snapshot = (tenant = "qa-a", source = "all", extra = {}) => fetchRows(new URLSearchParams({ tenant, limit: "200", ...extra }), window, "", source);
    const rows = await snapshot();
    const expected = fixtures.filter(({ row }) => row.tenant_id === tenantA && row.id !== 13);
    assert.equal(rows.length, expected.length, "mixed security/history records remain in the snapshot");
    for (const row of rows) {
      const fixtureRow = expected.find(candidate => String(candidate.row.id) === String(row.id));
      assert.ok(fixtureRow);
      assert.equal(row.data_provenance, fixtureRow.expected, `snapshot ${row.id} durable origin`);
      const event = normalizeTenantTapRealtimeEvent(row);
      assert.equal(event.dataProvenance, fixtureRow.expected, `snapshot ${row.id} wire projection`);
      assert.equal(event.eventSource, fixtureRow.row.source, "classification never rewrites source");
    }
    const operations = rows.map(normalizeTenantTapRealtimeEvent).filter(row => row.dataProvenance === "operational_tap");
    assert.deepEqual(operations.map(row => row.eventType).sort(), ["REPLAY_SUSPECT", "TAP_INVALID", "TAP_VALID", "TAP_VALID"].sort());
    assert.equal(rows.find(row => String(row.id) === "2").cmac_ok, false);
    assert.equal(operations.find(row => row.eventId === "2").authenticationVerified, false, "failed cryptography remains visible");
    assert.equal(operations.find(row => row.eventId === "2").reason, "CMAC_FAIL");
    const limited = await snapshot("qa-a", "all", { limit: "3" });
    assert.equal(limited.length, 3);
    assert.deepEqual(limited.map(row => Number(row.id)), [16, 15, 14], "existing mixed snapshot ordering/limit is preserved");
    assert.ok(limited.every(row => row.data_provenance !== "operational_tap"), "a snapshot slot never promotes legacy/demo into an operational TAP");
    const imported = await snapshot("qa-a", "imported");
    assert.equal(imported.length, 1);
    assert.equal(imported[0].data_provenance, "imported");
    const production = await snapshot("qa-a", "production");
    assert.ok(production.some(row => row.source === "imported"));
    assert.ok(production.some(row => row.data_provenance === "legacy_unclassified"));
    assert.ok(production.some(row => row.data_provenance === "declared_demo"));
    assert.ok(production.every(row => row.source !== "demo"));
    const forced = await fetchRows(new URLSearchParams({ tenant: "qa-b", limit: "200" }), window, "qa-a", "all");
    assert.ok(forced.every(row => row.tenant_slug === "qa-a"));
    assert.ok((await snapshot("", "all")).some(row => row.tenant_slug === "qa-b"));
    for (const id of [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 15, 16]) {
      const expectedOrigin = fixtures.find(({ row }) => row.id === id).expected;
      const event = await projection.loadTenantTapRealtimeProjection(id, execute);
      assert.ok(event, `push ${id} remains available to its general/security feed`);
      assert.equal(event.dataProvenance, expectedOrigin, `push ${id} durable origin`);
      await projection.publishTenantTapRealtimeProjection(id);
      assert.equal(published.at(-1).tap_projection.dataProvenance, expectedOrigin, `embedded frame ${id}`);
    }
    const duplicate = await projection.loadTenantTapRealtimeProjection(14, execute);
    assert.ok(!duplicate || duplicate.dataProvenance === "legacy_unclassified", "an ambiguous event ID cannot become an operational push");
    assert.equal(await projection.loadTenantTapRealtimeProjection(999, execute), null);
    assert.equal((await client.query("SELECT md5(string_agg(to_jsonb(e)::text,'' ORDER BY id,created_at)) AS digest FROM events e")).rows[0].digest, before);
    assert.ok(reads >= 30, "actual snapshot and push SQL queries ran against PostgreSQL");
  } finally {
    await queue;
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
});
