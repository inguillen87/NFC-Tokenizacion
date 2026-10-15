import test from "node:test";
import assert from "node:assert/strict";
import { runConsumerOwnershipClaimPostgresQa } from "./helpers/consumer-ownership-claim-postgres-harness.mjs";

test("transactional claim PostgreSQL harness requires an explicit QA connection factory", async () => {
  await assert.rejects(runConsumerOwnershipClaimPostgresQa(), /explicit disposable QA/);
});

for (const [label, identity, reason] of [
  ["production database", { database: "production", role: "nexid_e2e", pid: 1, address: "127.0.0.1" }, /nexid_e2e/],
  ["remote server", { database: "nexid_e2e", role: "nexid_e2e", pid: 1, address: "192.0.2.1" }, /non-loopback/],
  ["non-QA role", { database: "nexid_e2e", role: "application", pid: 1, address: "127.0.0.1" }, /dedicated nexid_e2e/],
  ["invalid PID", { database: "nexid_e2e", role: "nexid_e2e", pid: null, address: "127.0.0.1" }, /Separate PostgreSQL backends/],
]) {
  test(`transactional claim PostgreSQL harness refuses ${label} before writes and closes the client`, async () => {
    const statements = []; let closed = false;
    await assert.rejects(runConsumerOwnershipClaimPostgresQa({ connect: async () => ({
      query: async text => { statements.push(text); return { rows: [identity] }; },
      end: async () => { closed = true; },
    }) }), reason);
    assert.equal(closed, true); assert.equal(statements.filter(text => text !== "ROLLBACK").length, 1);
    assert.doesNotMatch(statements.join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP/);
  });
}

test("transactional claim PostgreSQL harness refuses shared backends before DDL", async () => {
  const clients = [0, 1].map(() => ({ queries: [], closed: false,
    async query(text) { this.queries.push(text); return { rows: [{ database: "nexid_e2e", role: "nexid_e2e", pid: 123, address: "127.0.0.1" }] }; },
    async end() { this.closed = true; },
  }));
  let index = 0;
  await assert.rejects(runConsumerOwnershipClaimPostgresQa({ connect: async () => clients[index++] }), /Separate PostgreSQL backends/);
  assert.ok(clients.every(client => client.closed && client.queries.filter(text => text !== "ROLLBACK").length === 1));
});

test("transactional claim PostgreSQL harness closes opened clients if the next connection fails", async () => {
  let connections = 0, closed = false;
  const client = {
    query: async () => ({ rows: [{ database: "nexid_e2e", role: "nexid_e2e", pid: 123, address: "127.0.0.1" }] }),
    end: async () => { closed = true; },
  };
  await assert.rejects(runConsumerOwnershipClaimPostgresQa({ connect: async () => {
    if (connections++ === 0) return client;
    throw new Error("Synthetic connection failure");
  } }), /Synthetic connection failure/);
  assert.equal(closed, true);
});

test("transactional claim closes both validated clients when the third backend cannot connect", async () => {
  const clients = [0, 1].map(index => ({ closed: false, statements: [],
    async query(text) { this.statements.push(text); return { rows: [{ database: "nexid_e2e", role: "nexid_e2e", pid: 124 + index, address: "127.0.0.1" }] }; },
    async end() { this.closed = true; },
  }));
  let count = 0;
  await assert.rejects(runConsumerOwnershipClaimPostgresQa({ connect: async () => {
    if (count < clients.length) return clients[count++];
    throw new Error("Synthetic third backend failure");
  } }), /Synthetic third backend failure/);
  assert.ok(clients.every(client => client.closed && client.statements.filter(text => text !== "ROLLBACK").length === 1));
  assert.doesNotMatch(clients.flatMap(client => client.statements).join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP/);
});

test("transactional claim refuses a third backend in another database and closes all three before DDL", async () => {
  const clients = [0, 1, 2].map(index => ({ closed: false, statements: [],
    async query(text) { this.statements.push(text); return { rows: [{ database: index === 2 ? "nexid_e2e_other" : "nexid_e2e", role: "nexid_e2e", pid: 127 + index, address: "127.0.0.1" }] }; },
    async end() { this.closed = true; },
  }));
  let count = 0;
  await assert.rejects(runConsumerOwnershipClaimPostgresQa({ connect: async () => clients[count++] }), /same QA database/);
  assert.ok(clients.every(client => client.closed && client.statements.filter(text => text !== "ROLLBACK").length === 1));
  assert.doesNotMatch(clients.flatMap(client => client.statements).join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP/);
});

for (const address of ["172.18.0.2", "10.0.0.2", "192.168.1.2"]) test(`transactional claim does not allow private server ${address} without local Docker attestation`, async () => {
  let closed = false; const statements = [];
  await assert.rejects(runConsumerOwnershipClaimPostgresQa({ connect: async () => ({ query: async text => { statements.push(text); return { rows: [{ database: "nexid_e2e", role: "nexid_e2e", pid: 1, address }] }; }, end: async () => { closed = true; } }) }), /non-loopback/);
  assert.equal(closed, true); assert.equal(statements.filter(text => text !== "ROLLBACK").length, 1);
  assert.doesNotMatch(statements.join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP/);
});

test("transactional claim refuses a fabricated Docker descriptor before writes and closes the client", async () => {
  let closed = false; const statements = [];
  await assert.rejects(runConsumerOwnershipClaimPostgresQa({ dockerAttestation: { expectedServerAddress: "172.18.0.2" }, connect: async () => ({ query: async text => { statements.push(text); return { rows: [{ database: "nexid_e2e", role: "nexid_e2e", pid: 1, address: "172.18.0.2" }] }; }, end: async () => { closed = true; } }) }), /Unissued/);
  assert.equal(closed, true); assert.equal(statements.filter(text => text !== "ROLLBACK").length, 1);
  assert.doesNotMatch(statements.join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP/);
});
