import assert from "node:assert/strict";
import test from "node:test";
import { runAdminRewardPostgresQa } from "./helpers/admin-reward-postgres-harness.mjs";

test("admin reward PostgreSQL verification requires an explicit owned QA connection factory", async () => {
  await assert.rejects(runAdminRewardPostgresQa(), /explicit_owned_qa_connection_factory_required/);
});
test("admin reward PostgreSQL verification refuses a production target before creating a schema", async () => {
  const statements = []; let ended = false;
  await assert.rejects(runAdminRewardPostgresQa({ connect: async () => ({
    query: async query => { statements.push(query); return { rows: [{ db: "production", role: "nexid_e2e", address: "127.0.0.1" }] }; },
    end: async () => { ended = true; },
  }) }), /nexid_e2e/);
  assert.equal(ended, true); assert.ok(statements.every(query => !/CREATE|DROP/.test(query)));
});
