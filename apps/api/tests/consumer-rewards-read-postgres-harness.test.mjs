import assert from "node:assert/strict";
import test from "node:test";
import { runConsumerRewardsReadPostgresQa } from "./helpers/consumer-rewards-read-postgres-harness.mjs";

const OWN_SCHEMA = /^consumer_rewards_read_qa_[0-9a-f]{32}$/;

function fakeClient(database, execute) {
  return {
    queries: [],
    closes: 0,
    async query(text, values) {
      this.queries.push({ text, values });
      if (text.startsWith("SELECT current_database()")) return { rows: [{ database }] };
      if (execute) return execute(text, values);
      throw new Error("Unexpected query beyond the safety boundary");
    },
    async end() { this.closes += 1; },
  };
}

function setupClient({ database = "codex_qa_rewards_read", execute, pooled = false } = {}) {
  let schema;
  const events = [];
  const fixtureError = new Error("synthetic read fixture failure");
  const client = fakeClient(database, async (text, values) => {
    events.push(text);
    if (text.startsWith("CREATE SCHEMA")) {
      schema = text.match(/^CREATE SCHEMA "(consumer_rewards_read_qa_[0-9a-f]{32})"$/)?.[1];
      assert.match(schema ?? "", OWN_SCHEMA);
    }
    const result = execute ? await execute(text, values, schema) : undefined;
    if (result !== undefined) return result;
    if (text.startsWith("SELECT current_schema()")) return { rows: [{ schema }] };
    if (text.includes("CREATE TYPE")) throw fixtureError;
    return { rows: [] };
  });
  client.end = async () => { events.push("END"); client.closes += 1; };
  if (pooled) {
    // A PoolClient may expose both methods; release(true) must take precedence.
    client.release = async (destroy) => {
      assert.equal(destroy, true, "Changed session settings must not return to the pool");
      events.push("RELEASE DESTROY");
      client.closes += 1;
    };
  }
  return { client, events, fixtureError, schema: () => schema };
}

function assertOnlyOwnedSchemaDropped(fixture) {
  const schema = fixture.schema();
  assert.match(schema, OWN_SCHEMA);
  assert.deepEqual(
    fixture.client.queries.filter(({ text }) => /^\s*DROP\b/i.test(text)).map(({ text }) => text),
    [`DROP SCHEMA "${schema}" CASCADE`],
  );
  const rollbackIndex = fixture.events.indexOf("ROLLBACK");
  const dropIndex = fixture.events.indexOf(`DROP SCHEMA "${schema}" CASCADE`);
  assert.ok(rollbackIndex >= 0 && rollbackIndex < dropIndex, "Roll back before dropping the owned schema");
  assert.equal(fixture.client.closes, 1);
  assert.ok(fixture.client.queries.every(({ text }) => !/\bpublic\s*\./i.test(text)));
}

test("requires an explicit connection factory without loading database configuration", async () => {
  for (const options of [undefined, {}, { connect: null }, { connect: "configured-elsewhere" }]) {
    await assert.rejects(runConsumerRewardsReadPostgresQa(options), /explicit QA connection factory/);
  }
});

for (const database of [
  "postgres", "production", "neondb", "codex_qa_", "NEXID_E2E", "prod_nexid_e2e",
  'nexid_e2e_qa"; DROP SCHEMA public CASCADE; --', "", null, undefined,
]) {
  test(`rejects an unauthorized database before any DDL (${JSON.stringify(database)})`, async () => {
    const client = fakeClient(database);
    let connections = 0;
    await assert.rejects(runConsumerRewardsReadPostgresQa({
      connect: async () => { connections += 1; return client; },
    }), /Refusing a database/);
    assert.equal(connections, 1);
    assert.equal(client.closes, 1);
    assert.equal(client.queries.length, 1);
    assert.match(client.queries[0].text, /^SELECT current_database\(\)/);
  });
}

test("destroys an unauthorized pooled session before any DDL", async () => {
  const client = fakeClient("production");
  const releases = [];
  client.release = async (destroy) => { releases.push(destroy); };
  await assert.rejects(runConsumerRewardsReadPostgresQa({ connect: async () => client }), /Refusing a database/);
  assert.deepEqual(releases, [true]);
  assert.equal(client.closes, 0, "Pool sessions must use release instead of end");
  assert.equal(client.queries.length, 1);
});

for (const database of ["nexid_e2e", "nexid_e2e_rewards_read", "codex_qa_rewards_read"]) {
  test(`uses one connection and isolates accepted QA database ${database}`, async () => {
    const fixture = setupClient({ database });
    let connections = 0;
    await assert.rejects(runConsumerRewardsReadPostgresQa({
      connect: async () => { connections += 1; return fixture.client; },
    }), (error) => error === fixture.fixtureError);
    assert.equal(connections, 1);
    const pathStatements = fixture.client.queries.filter(({ text }) => text.startsWith("SET search_path"));
    assert.deepEqual(pathStatements.map(({ text }) => text), [`SET search_path TO "${fixture.schema()}", pg_catalog`]);
    const schemaCheckIndex = fixture.client.queries.findIndex(({ text }) => text.startsWith("SELECT current_schema()"));
    const fixtureIndex = fixture.client.queries.findIndex(({ text }) => text.includes("CREATE TYPE"));
    assert.ok(schemaCheckIndex > 0 && schemaCheckIndex < fixtureIndex);
    assertOnlyOwnedSchemaDropped(fixture);
    assert.equal(fixture.events.at(-1), "END");
  });
}

test("fixture setup failure drops only its generated schema and destroys the pooled session", async () => {
  const fixture = setupClient({ pooled: true });
  await assert.rejects(runConsumerRewardsReadPostgresQa({ connect: async () => fixture.client }),
    (error) => error === fixture.fixtureError);
  assertOnlyOwnedSchemaDropped(fixture);
  assert.equal(fixture.events.at(-1), "RELEASE DESTROY");
  assert.ok(!fixture.events.includes("END"));
});

test("rejects an unexpected active schema before fixture DDL and cleans up only its own schema", async () => {
  const fixture = setupClient({ execute: async (text) => {
    if (text.startsWith("SELECT current_schema()")) return { rows: [{ schema: "public" }] };
  } });
  await assert.rejects(runConsumerRewardsReadPostgresQa({ connect: async () => fixture.client }));
  assert.ok(!fixture.client.queries.some(({ text }) => text.includes("CREATE TYPE")));
  assertOnlyOwnedSchemaDropped(fixture);
});

test("failed search path configuration still cleans up the schema that was created", async () => {
  const setupError = new Error("synthetic search path failure");
  const fixture = setupClient({ execute: async (text) => {
    if (text.startsWith("SET search_path")) throw setupError;
  } });
  await assert.rejects(runConsumerRewardsReadPostgresQa({ connect: async () => fixture.client }),
    (error) => error === setupError);
  assert.ok(!fixture.client.queries.some(({ text }) => text.includes("CREATE TYPE")));
  assertOnlyOwnedSchemaDropped(fixture);
});

test("failed CREATE SCHEMA never attempts DROP on an unowned schema", async () => {
  const createError = new Error("synthetic schema creation failure");
  const fixture = setupClient({ execute: async (text) => {
    if (text.startsWith("CREATE SCHEMA")) throw createError;
  } });
  await assert.rejects(runConsumerRewardsReadPostgresQa({ connect: async () => fixture.client }),
    (error) => error === createError);
  assert.equal(fixture.client.closes, 1);
  assert.ok(fixture.client.queries.some(({ text }) => text.startsWith("CREATE SCHEMA")));
  assert.ok(!fixture.client.queries.some(({ text }) => /^\s*DROP\b/i.test(text)));
  assert.ok(!fixture.client.queries.some(({ text }) => text.includes("CREATE TYPE")));
});

for (const cleanupStatement of ["ROLLBACK", "DROP SCHEMA"]) {
  test(`${cleanupStatement} failure rejects and still destroys the pooled session`, async () => {
    const cleanupError = new Error(`synthetic ${cleanupStatement} cleanup failure`);
    const fixture = setupClient({ pooled: true, execute: async (text) => {
      if (text.startsWith(cleanupStatement)) throw cleanupError;
    } });
    await assert.rejects(runConsumerRewardsReadPostgresQa({ connect: async () => fixture.client }),
      (error) => error === fixture.fixtureError || error === cleanupError);
    assert.equal(fixture.client.closes, 1);
    assert.equal(fixture.events.at(-1), "RELEASE DESTROY");
    assert.ok(fixture.client.queries.some(({ text }) => text.startsWith(cleanupStatement)));
    const drops = fixture.client.queries.filter(({ text }) => /^\s*DROP\b/i.test(text));
    assert.ok(drops.length <= 1);
    for (const { text } of drops) assert.equal(text, `DROP SCHEMA "${fixture.schema()}" CASCADE`);
  });
}
