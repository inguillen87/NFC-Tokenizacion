import assert from "node:assert/strict";
import pg from "pg";
import { runConsumerRewardPostgresQa } from "../tests/helpers/consumer-reward-postgres-harness.mjs";
import { runConsumerRewardsReadPostgresQa } from "../tests/helpers/consumer-rewards-read-postgres-harness.mjs";

// Fixed schema-only, expiring QA branch. Never use DATABASE_URL or production rows.
const endpoint = "ep-snowy-recipe-aip9m3hz";
const database = "codex_qa_rewards_20260908";
const connection = new URL(process.env.CONSUMER_REWARDS_QA_DATABASE_URL || "");
assert.equal(connection.hostname, `${endpoint}.c-4.us-east-1.aws.neon.tech`);
assert.equal(connection.pathname, `/${database}`);
assert.ok(connection.username && connection.password);
assert.equal(connection.hash, "");
assert.ok([...connection.searchParams.keys()].every(key => key === "sslmode" || key === "channel_binding"));
connection.search = "";
connection.searchParams.set("sslmode", "verify-full");
async function connect() {
  const client = new pg.Client({ connectionString: connection.toString(), connectionTimeoutMillis: 15000, query_timeout: 20000 });
  try {
    await client.connect();
    const target = (await client.query("SELECT current_setting('neon.endpoint_id', true) AS endpoint, current_database() AS database")).rows[0];
    assert.equal(target.endpoint, endpoint);
    assert.equal(target.database, database);
    return client;
  } catch (error) { await client.end().catch(() => {}); throw error; }
}
try {
  const report = await runConsumerRewardPostgresQa({ connect });
  console.log(JSON.stringify({ ...report, endpoint, database, syntheticDataOnly: true, productionWrites: false }));
  assert.equal(report.ok, true);
  assert.equal(report.cleanup.schemaDropped, true);
  assert.equal(report.cleanup.connectionsClosed, true);
  const readReport = await runConsumerRewardsReadPostgresQa({ connect });
  console.log(JSON.stringify({ ...readReport, endpoint, database, syntheticDataOnly: true, productionWrites: false }));
  assert.equal(readReport.ok, true);
  assert.equal(readReport.cleanup.schemaDropped, true);
  assert.equal(readReport.cleanup.connectionsClosed, true);
} catch (error) {
  console.error(JSON.stringify({ ok: false, endpoint, code: error?.code || null, reason: String(error?.message || "consumer_rewards_qa_failed") }));
  process.exitCode = 1;
}
