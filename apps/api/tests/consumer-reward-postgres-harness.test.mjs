import assert from "node:assert/strict";
import test from "node:test";
import { runConsumerRewardPostgresQa } from "./helpers/consumer-reward-postgres-harness.mjs";

function fakeClient(database, backendPid, execute) {
  return {
    queries: [], closed: false,
    async query(text, values) {
      this.queries.push({ text, values });
      if (text.startsWith("SELECT current_database()")) return { rows: [{ database, backend_pid: backendPid }] };
      if (execute) return execute(text, values);
      throw new Error("Unexpected query beyond the safety boundary");
    },
    async end() { this.closed = true; },
  };
}

test("requires an explicit connection factory without reading configuration", async () => {
  await assert.rejects(runConsumerRewardPostgresQa(), /explicit QA connection factory/);
});

for (const database of ["postgres", "production", "neondb", "codex_qa_", 'nexid_e2e_qa"; DROP SCHEMA public CASCADE; --']) {
  test(`rejects an unauthorized database before DDL (${JSON.stringify(database)})`, async () => {
    const client = fakeClient(database, 101);
    let connections = 0;
    await assert.rejects(runConsumerRewardPostgresQa({ connect: async () => { connections += 1; return client; } }), /Refusing a database/);
    assert.equal(connections, 1);
    assert.equal(client.closed, true);
    assert.equal(client.queries.length, 1);
    assert.match(client.queries[0].text, /^SELECT current_database\(\)/);
  });
}

test("requires all QA clients to use the same database before DDL", async () => {
  const clients = [fakeClient("codex_qa_rewards", 101), fakeClient("nexid_e2e_rewards", 102)];
  let index = 0;
  await assert.rejects(runConsumerRewardPostgresQa({ connect: async () => clients[index++] }), /same database/);
  assert.ok(clients.every((client) => client.closed && client.queries.length === 1));
});

test("refuses the same client object for concurrency and closes it once", async () => {
  const client = fakeClient("codex_qa_rewards", 101);
  let closes = 0;
  client.end = async () => { closes += 1; };
  await assert.rejects(runConsumerRewardPostgresQa({ connect: async () => client }), /independent clients/);
  assert.equal(closes, 1);
  assert.equal(client.queries.length, 1);
});

test("refuses distinct clients backed by the same PostgreSQL session", async () => {
  const clients = [fakeClient("codex_qa_rewards", 101), fakeClient("codex_qa_rewards", 101)];
  let index = 0;
  await assert.rejects(runConsumerRewardPostgresQa({ connect: async () => clients[index++] }), /separate PostgreSQL backends/);
  assert.ok(clients.every((client) => client.closed && client.queries.length === 1));
});

test("closes already-opened clients if the next connection fails", async () => {
  const client = fakeClient("nexid_e2e", 101);
  let connections = 0;
  await assert.rejects(runConsumerRewardPostgresQa({ connect: async () => {
    if (connections++ === 0) return client;
    throw new Error("synthetic connection failure");
  } }), /synthetic connection failure/);
  assert.equal(client.closed, true);
  assert.equal(client.queries.length, 1);
});

test("setup failure drops exactly the generated schema and destroys pooled sessions", async () => {
  let schema;
  const queries = [];
  const clients = Array.from({ length: 3 }, (_, index) => {
    const client = fakeClient("codex_qa_rewards", 101 + index, async (text) => {
      queries.push(text);
      if (text.startsWith("CREATE SCHEMA")) schema = text.match(/^CREATE SCHEMA "(consumer_rewards_qa_[0-9a-f]{32})"$/)?.[1];
      if (text.startsWith("SELECT current_schema()")) return { rows: [{ schema }] };
      if (text.includes("CREATE TYPE")) throw new Error("synthetic fixture failure");
      return { rows: [] };
    });
    delete client.end;
    client.release = async (destroy) => { assert.equal(destroy, true); client.closed = true; };
    return client;
  });
  let index = 0;
  await assert.rejects(runConsumerRewardPostgresQa({ connect: async () => clients[index++] }), /synthetic fixture failure/);
  assert.match(schema, /^consumer_rewards_qa_[0-9a-f]{32}$/);
  assert.deepEqual(queries.filter((query) => query.startsWith("DROP ")), [`DROP SCHEMA "${schema}" CASCADE`]);
  assert.ok(queries.filter((query) => query.startsWith("SET search_path")).every((query) => query === `SET search_path TO "${schema}", pg_catalog`));
  assert.ok(clients.every((client) => client.closed));
  assert.ok(queries.every((query) => !/\bpublic\s*\./i.test(query)));
});
