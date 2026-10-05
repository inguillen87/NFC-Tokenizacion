import test from "node:test";
import assert from "node:assert/strict";
import { runConsumerCollectionPostgresQa } from "./helpers/consumer-collection-postgres-harness.mjs";

test("collection PostgreSQL harness requires an explicit QA connection factory", async () => {
  await assert.rejects(runConsumerCollectionPostgresQa(), /explicit disposable QA/);
});

for (const [label, identity, reason] of [
  ["production database", { database: "production", role: "nexid_e2e", pid: 1, address: "127.0.0.1" }, /nexid_e2e/],
  ["remote server", { database: "nexid_e2e", role: "nexid_e2e", pid: 1, address: "192.0.2.1" }, /non-loopback/],
  ["non-QA role", { database: "nexid_e2e", role: "application", pid: 1, address: "127.0.0.1" }, /dedicated nexid_e2e/],
  ["invalid PID", { database: "nexid_e2e", role: "nexid_e2e", pid: null, address: "127.0.0.1" }, /Separate PostgreSQL backends/],
]) {
  test(`collection PostgreSQL harness refuses ${label} before writes and closes the client`, async () => {
    const statements = []; let closed = false;
    await assert.rejects(runConsumerCollectionPostgresQa({ connect: async () => ({
      query: async text => { statements.push(text); return { rows: [identity] }; },
      end: async () => { closed = true; },
    }) }), reason);
    assert.equal(closed, true); assert.equal(statements.length, 1);
    assert.doesNotMatch(statements.join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP/);
  });
}

test("collection PostgreSQL harness refuses shared backends before DDL", async () => {
  const clients = [0, 1].map(() => ({ queries: [], closed: false,
    async query(text) { this.queries.push(text); return { rows: [{ database: "nexid_e2e", role: "nexid_e2e", pid: 123, address: "127.0.0.1" }] }; },
    async end() { this.closed = true; },
  }));
  let index = 0;
  await assert.rejects(runConsumerCollectionPostgresQa({ connect: async () => clients[index++] }), /Separate PostgreSQL backends/);
  assert.ok(clients.every(client => client.closed && client.queries.length === 1));
});

test("collection PostgreSQL harness closes opened clients if the next connection fails", async () => {
  let connections = 0, closed = false;
  const client = {
    query: async () => ({ rows: [{ database: "nexid_e2e", role: "nexid_e2e", pid: 123, address: "127.0.0.1" }] }),
    end: async () => { closed = true; },
  };
  await assert.rejects(runConsumerCollectionPostgresQa({ connect: async () => {
    if (connections++ === 0) return client;
    throw new Error("Synthetic connection failure");
  } }), /Synthetic connection failure/);
  assert.equal(closed, true);
});
