import test from "node:test";
import assert from "node:assert/strict";
import { runLoyaltyCurrentStatePostgresQa } from "./helpers/loyalty-current-state-postgres-harness.mjs";

test("local PostgreSQL loyalty harness requires an explicit QA factory", async () => {
  await assert.rejects(runLoyaltyCurrentStatePostgresQa(), /explicit disposable QA/);
});

test("local PostgreSQL loyalty harness refuses production database before mutations and closes client", async () => {
  const statements = [];
  let closed = false;
  await assert.rejects(runLoyaltyCurrentStatePostgresQa({ connect: async () => ({
    query: async text => { statements.push(text); return { rows: [{ database: "production", pid: 1, address: "127.0.0.1" }] }; },
    end: async () => { closed = true; },
  }) }), /nexid_e2e/);
  assert.equal(closed, true);
  assert.equal(statements.length, 1);
  assert.doesNotMatch(statements.join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP/);
});

test("local PostgreSQL loyalty harness refuses remote server before mutations and closes client", async () => {
  const statements = [];
  let closed = false;
  await assert.rejects(runLoyaltyCurrentStatePostgresQa({ connect: async () => ({
    query: async text => { statements.push(text); return { rows: [{ database: "nexid_e2e", pid: 1, address: "192.0.2.1" }] }; },
    end: async () => { closed = true; },
  }) }), /non-loopback/);
  assert.equal(closed, true);
  assert.equal(statements.length, 1);
});
