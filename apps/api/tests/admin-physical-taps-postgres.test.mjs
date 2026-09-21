import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { listAdminPhysicalTaps } from "../src/lib/admin-physical-taps.ts";
import { classifyConsumerNetworkEvent, withConsumerNetworkEventProvenance } from "../src/lib/consumer-network-provenance.ts";

// This harness never reads dotenv or DATABASE_URL. It can create objects only in
// the explicitly named disposable local database, inside a rolled-back schema.
function checkedTarget(value) {
  let target;
  try { target = new URL(value); } catch { throw new Error("s7_qa_database_target_invalid"); }
  if (!new Set(["postgres:", "postgresql:"]).has(target.protocol)
    || !new Set(["localhost", "127.0.0.1", "[::1]"]).has(target.hostname)
    || target.pathname !== "/nexid_e2e_s7"
    || target.username !== "nexid_e2e"
    || target.search || target.hash) throw new Error("s7_qa_database_target_refused");
  return target;
}

test("physical PostgreSQL harness refuses non-disposable targets before connecting", () => {
  assert.equal(checkedTarget("postgresql://nexid_e2e@127.0.0.1:5432/nexid_e2e_s7").hostname, "127.0.0.1");
  for (const value of [
    "postgresql://nexid_e2e@example.test/nexid_e2e_s7",
    "postgresql://nexid_e2e@127.0.0.1/production",
    "postgresql://postgres@127.0.0.1/nexid_e2e_s7",
    "postgresql://nexid_e2e@127.0.0.1/nexid_e2e_s7?host=example.test",
    "https://nexid_e2e@127.0.0.1/nexid_e2e_s7", "",
  ]) assert.throws(() => checkedTarget(value), /s7_qa_database_target_/);
});

const connectionString = process.env.NEXID_S7_QA_DATABASE_URL;
test("physical operational reader executes against isolated real PostgreSQL", {
  skip: !connectionString && "NEXID_S7_QA_DATABASE_URL is not configured; no database was contacted",
}, async (t) => {
  checkedTarget(connectionString);
  const { Client } = await import("pg");
  const client = new Client({ connectionString, connectionTimeoutMillis: 3000, statement_timeout: 10000 });
  await client.connect();
  try {
    const { rows: [identity] } = await client.query("SELECT current_database() AS db, current_user AS role");
    assert.equal(identity.db, "nexid_e2e_s7");
    assert.equal(identity.role, "nexid_e2e");
    // The client URL is loopback-only. A CI service reached through a published
    // localhost port can correctly report a container bridge server address.
    await client.query("BEGIN");
    const schema = `physical_taps_qa_${randomUUID().replaceAll("-", "")}`;
    assert.match(schema, /^physical_taps_qa_[a-f0-9]{32}$/);
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
    await client.query(`
      CREATE TABLE tenants (id uuid PRIMARY KEY, slug text NOT NULL);
      CREATE TABLE batches (id uuid PRIMARY KEY, tenant_id uuid, bid text, sdm_config jsonb);
      CREATE TABLE tags (id uuid PRIMARY KEY, batch_id uuid, uid_hex text);
      CREATE TABLE tag_profiles (tag_id uuid PRIMARY KEY, product_name text, sku text);
      CREATE TABLE events (
        id bigint, created_at timestamptz, tenant_id uuid, batch_id uuid, tag_id text, uid_hex text,
        event_type text, source text, result text, reason text, verdict text, cmac_ok boolean,
        allowlisted boolean, read_counter integer, meta jsonb, product_name text,
        city text, country_code text, lat double precision, lng double precision,
        geo_city text, geo_country text, geo_lat double precision, geo_lng double precision,
        geo_precision text, location_source text, location_accuracy_m double precision,
        post_tap_location_observation jsonb, PRIMARY KEY(id, created_at)
      );
      CREATE TABLE canonical_event_operations (
        tenant_id uuid, event_id bigint, event_created_at timestamptz, event_mode text
      );
      CREATE TABLE sun_tt_truth_receipts (
        event_id bigint, event_created_at timestamptz, tenant_id uuid, batch_id uuid,
        tt_raw text, canonical_product_state text, binding_status text, binding_reason text,
        status_source text, status_offset integer, status_length integer,
        PRIMARY KEY(event_id, event_created_at)
      );
    `);
    const tenantA = "10000000-0000-4000-8000-000000000001";
    const tenantB = "10000000-0000-4000-8000-000000000002";
    const batchA = "20000000-0000-4000-8000-000000000001";
    const batchOther = "20000000-0000-4000-8000-000000000002";
    const batchB = "20000000-0000-4000-8000-000000000003";
    const tagA = "30000000-0000-4000-8000-000000000001";
    const tagOther = "30000000-0000-4000-8000-000000000002";
    const tagB = "30000000-0000-4000-8000-000000000003";
    await client.query("INSERT INTO tenants VALUES ($1,'qa-a'),($2,'qa-b')", [tenantA, tenantB]);
    await client.query("INSERT INTO batches VALUES ($1,$2,'LOT-A','{}'),($3,$2,'LOT-OTHER','{}'),($4,$5,'LOT-B','{}')", [batchA, tenantA, batchOther, batchB, tenantB]);
    await client.query("INSERT INTO tags VALUES ($1,$2,'04AABBCCDDEE01'),($3,$4,'04AABBCCDDEE02'),($5,$6,'04AABBCCDDEE03')", [tagA, batchA, tagOther, batchOther, tagB, batchB]);
    const { rows: [{ now }] } = await client.query("SELECT now() AS now");
    const writer = { replay_execution_class: "operational", internal_qa_marker: "never_return_raw_meta" };
    const canonical = { canonical_event: true, event_family: "tap", event_mode: "live", metric_scope: "scan", simulated: false };
    const fixtureRows = [];
    async function event(id, overrides = {}) {
      const row = {
        id, created_at: new Date(now.getTime() - (200 - id) * 60000), tenant_id: tenantA,
        batch_id: batchA, tag_id: tagA, uid_hex: "04AABBCCDDEE01", event_type: "TAP_VALID",
        source: "real", result: "VALID_CLOSED", reason: "VALID_CLOSED", verdict: "valid",
        cmac_ok: true, allowlisted: true, read_counter: id, meta: writer, product_name: "QA fixture",
        ...overrides,
      };
      const columns = Object.keys(row);
      await client.query(`INSERT INTO events (${columns.join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(row));
      fixtureRows.push(row);
      return row;
    }
    async function canonicalReceipt(row, overrides = {}) {
      const receipt = { tenant_id: row.tenant_id, event_id: row.id, event_created_at: row.created_at, event_mode: "live", ...overrides };
      await client.query("INSERT INTO canonical_event_operations VALUES ($1,$2,$3,$4)", Object.values(receipt));
    }
    const first = await event(1);
    const invalid = await event(2, { event_type: "TAP_INVALID", result: "INVALID", verdict: "invalid", cmac_ok: false });
    await event(3, { event_type: "REPLAY_SUSPECT", result: "REPLAY", verdict: "invalid", cmac_ok: false });
    const canonicalTap = await event(4, { meta: canonical });
    await canonicalReceipt(canonicalTap);
    await event(5, { meta: {} });
    await event(6, { meta: { ...writer, simulated: true } });
    await event(7, { source: "imported" });
    await event(8, { source: "demo" });
    await event(9, { meta: { ...writer, event_mode: "simulated" } });
    await event(10, { meta: canonical });
    await event(11, { tag_id: tagOther });
    await event(12, { batch_id: batchB, tag_id: tagB, uid_hex: "04AABBCCDDEE03" });
    await event(13, { uid_hex: "04FFFFFFFFFFFF" });
    const wrongTenantReceipt = await event(14, { meta: canonical });
    await canonicalReceipt(wrongTenantReceipt, { tenant_id: tenantB });
    const wrongTimestampReceipt = await event(15, { meta: canonical });
    await canonicalReceipt(wrongTimestampReceipt, { event_created_at: new Date(now.getTime() - 1000) });
    await event(16, { meta: { replay_execution_class: "demo" } });
    await event(17, { event_type: "CONSUMER_ACTION" });
    // Every declared-demo override must beat operational metadata even when padded.
    const paddedOverrides = [
      { simulated: " true " }, { simulated: "\ttrue\n" }, { demoEmitter: "\u00a0TRUE\ufeff" },
      { event_mode: " simulated " }, { event_mode: " DEMO " }, { replay_execution_class: " demo " },
      { seed: " true ", corpus: " demo-fixture " },
    ];
    for (const [index, meta] of paddedOverrides.entries()) await event(20 + index, { meta: { ...writer, ...meta } });
    await event(30, { batch_id: batchOther, tag_id: tagOther, uid_hex: "04AABBCCDDEE02" });
    await event(31, { tenant_id: tenantB, batch_id: batchB, tag_id: tagB, uid_hex: "04AABBCCDDEE03" });
    const duplicate = await event(50);
    await event(50, { created_at: new Date(now.getTime() - 48 * 3600000) });
    await event(61, { created_at: new Date(now.getTime() - 48 * 3600000) });
    await client.query(`INSERT INTO sun_tt_truth_receipts
      (event_id,event_created_at,tenant_id,batch_id,tt_raw,canonical_product_state,binding_status)
      VALUES ($1,$2,$3,$4,'C','VALID_CLOSED','BOUND'),($5,$6,$7,$4,'C','VALID_CLOSED','BOUND')`,
    [first.id, first.created_at, tenantA, batchA, invalid.id, invalid.created_at, tenantB]);

    const execute = async (strings, ...values) => {
      const statement = strings.reduce((query, part, index) => query + (index ? `$${index}` : "") + part, "");
      assert.match(statement.trim(), /^(WITH|SELECT)\b/i);
      assert.doesNotMatch(statement, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b|public\./i);
      return (await client.query(statement, values)).rows;
    };
    const input = { tenantSlug: "qa-a", bid: "LOT-A", rangeSql: "24 hours", limit: 100 };
    await t.test("excludes legacy/demo/imports and keeps operational invalid/replay without TT promotion", async () => {
      const result = await listAdminPhysicalTaps(input, execute);
      assert.deepEqual(result.rows.map(row => row.eventId), ["4", "3", "2", "1"]);
      assert.equal(result.summary.total, 4);
      assert.equal(result.provenance.hasMore, false);
      for (const id of ["2", "3"]) {
        const row = result.rows.find(row => row.eventId === id);
        assert.equal(row.messageValid, false);
        assert.equal(row.evidence.ttEvidenceAuthority, "not_reported");
        assert.equal(row.evidence.kind, "real_tap_event_carrier_unconfirmed");
      }
      assert.equal(result.rows.find(row => row.eventId === "1").evidence.ttEvidenceAuthority, "nexid_tt_durable_receipt");
      assert.doesNotMatch(JSON.stringify(result), /never_return_raw_meta|replay_execution_class|04AABBCCDDEE01/);
    });
    await t.test("applies provenance before LIMIT and explicitly counts only returned rows", async () => {
      const result = await listAdminPhysicalTaps({ ...input, limit: 2 }, execute);
      assert.deepEqual(result.rows.map(row => row.eventId), ["4", "3"]);
      assert.equal(result.summary.total, 2);
      assert.equal(result.provenance.returnedRows, 2);
      assert.equal(result.provenance.hasMore, true);
      assert.equal(result.provenance.countScope, "returned_rows_within_requested_range_and_limit");
      assert.equal(result.provenance.physicalPresenceClaim, "not_asserted");
    });
    await t.test("binds tenant, batch, tag, UID and canonical receipt timestamp", async () => {
      const allA = await listAdminPhysicalTaps({ ...input, bid: null }, execute);
      assert.deepEqual(allA.rows.map(row => row.eventId), ["30", "4", "3", "2", "1"]);
      const allB = await listAdminPhysicalTaps({ ...input, tenantSlug: "qa-b", bid: null }, execute);
      assert.deepEqual(allB.rows.map(row => row.eventId), ["31"]);
      const missing = await listAdminPhysicalTaps({ ...input, tenantSlug: "qa-a' OR true --" }, execute);
      assert.equal(missing.summary.total, 0);
      const duplicateResult = await listAdminPhysicalTaps({ ...input, rangeSql: "72 hours" }, execute);
      assert.ok(!duplicateResult.rows.some(row => row.eventId === String(duplicate.id)));
      assert.ok(duplicateResult.rows.some(row => row.eventId === "61"));
    });
    await t.test("SQL and JavaScript agree on every fixture including padded demo overrides", async () => {
      const read = withConsumerNetworkEventProvenance(execute, { event: "e", batch: "b", tag: "tag" });
      const rows = await read`
        SELECT e.id, e.source, e.event_type, e.meta,
          b.id IS NOT NULL AND tag.id IS NOT NULL AS bound,
          EXISTS (SELECT 1 FROM canonical_event_operations op WHERE op.tenant_id=e.tenant_id
            AND op.event_id=e.id AND op.event_created_at=e.created_at AND op.event_mode='live') AS canonical,
          /* consumer-network-event-provenance */ AS provenance
        FROM events e
        LEFT JOIN batches b ON b.id=e.batch_id AND b.tenant_id=e.tenant_id
        LEFT JOIN tags tag ON tag.id::text=e.tag_id AND tag.batch_id=e.batch_id AND UPPER(tag.uid_hex)=UPPER(e.uid_hex)
      `;
      assert.equal(rows.length, fixtureRows.length);
      for (const row of rows) assert.equal(row.provenance, classifyConsumerNetworkEvent({
        source: row.source, eventType: row.event_type, meta: row.meta,
        hasExactTenantAssetBinding: row.bound, hasCanonicalOperation: row.canonical,
      }), `fixture ${row.id}`);
      for (let id = 20; id < 20 + paddedOverrides.length; id++) assert.equal(rows.find(row => Number(row.id) === id).provenance, "declared_demo");
    });
  } finally {
    try { await client.query("ROLLBACK"); } finally { await client.end(); }
  }
});
