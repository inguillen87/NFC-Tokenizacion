import assert from "node:assert/strict";
import test from "node:test";
import { runAdminRewardPostgresQa, validateAdminRewardQaIdentity } from "./helpers/admin-reward-postgres-harness.mjs";

test("admin reward QA accepts the validated CI database name and owned suffixed fixtures", () => {
  for (const db of ["nexid_e2e", "nexid_e2e_tenantsync_123", "nexid_e2e_isolated-qa"]) {
    assert.doesNotThrow(() => validateAdminRewardQaIdentity({ db, role: "nexid_e2e", address: "127.0.0.1" }));
  }
  for (const patch of [{ db: "production" }, { db: "nexid_e2e_" }, { db: "nexid_e2e_other/production" }, { role: "postgres" }, { address: "10.0.0.1" }]) {
    assert.throws(() => validateAdminRewardQaIdentity({ db: "nexid_e2e", role: "nexid_e2e", address: "127.0.0.1", ...patch }));
  }
});
test("native admin reward QA refuses Docker bridge addresses without an issued attestation", () => {
  for (const address of ["172.18.0.2", "192.168.1.2", "10.0.0.1"]) {
    assert.throws(() => validateAdminRewardQaIdentity({ db: "nexid_e2e", role: "nexid_e2e", address }), /non-loopback/);
  }
});
test("a forged descriptor cannot authorize an admin reward Docker target", async () => {
  const descriptor = Object.freeze({ kind: "github-actions-local-docker-postgresql-v1", expectedServerAddress: "172.18.0.2", expectedHost: "127.0.0.1", expectedPort: 5432, databaseName: "nexid_e2e", databaseRole: "nexid_e2e" });
  assert.throws(() => validateAdminRewardQaIdentity({ database: "nexid_e2e", role: "nexid_e2e", address: "172.18.0.2" }, {}, { dockerAttestation: descriptor, env: { GITHUB_ACTIONS: "true", NODE_ENV: "test", VERCEL_ENV: "test" }, platform: "linux" }), /Unissued/);
  const statements = []; let ended = false;
  await assert.rejects(runAdminRewardPostgresQa({ dockerAttestation: descriptor, connect: async () => ({
    query: async query => { statements.push(query); return { rows: [{ database: "nexid_e2e", role: "nexid_e2e", address: "172.18.0.2" }] }; }, end: async () => { ended = true; },
  }) }), /Unissued/);
  assert.equal(ended, true); assert.ok(statements.every(query => !/CREATE|DROP/.test(query)));
});

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
