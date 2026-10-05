import assert from "node:assert/strict";
import test from "node:test";
import { runOwnershipCurrentStatePostgresQa } from "./helpers/ownership-current-state-postgres-harness.mjs";

test("ownership PostgreSQL harness requires an explicit disposable QA factory", async () => {
  await assert.rejects(runOwnershipCurrentStatePostgresQa(), /explicit disposable QA/);
});

for (const [name,identity,reason] of [
  ["production database",{database:"production",role:"nexid_e2e",address:"127.0.0.1",pid:1},/nexid_e2e/],
  ["remote server",{database:"nexid_e2e",role:"nexid_e2e",address:"192.0.2.1",pid:1},/non-loopback/],
  ["non-QA role",{database:"nexid_e2e",role:"application",address:"127.0.0.1",pid:1},/dedicated nexid_e2e/],
]) {
  test(`ownership PostgreSQL harness refuses ${name} before mutations and closes its client`, async () => {
    const statements=[]; let closed=false;
    await assert.rejects(runOwnershipCurrentStatePostgresQa({ connect: async () => ({
      query: async query => { statements.push(query); return {rows:[identity]}; },
      end: async () => {closed=true;},
    }) }),reason);
    assert.equal(closed,true);
    assert.doesNotMatch(statements.join("\n"),/CREATE|INSERT|UPDATE|DELETE|DROP|TRUNCATE/);
  });
}

test("ownership PostgreSQL harness rejects a reused client and closes it once before schema creation", async () => {
  const statements=[]; let closes=0;
  const client={
    query: async query => {statements.push(query); return {rows:[{database:"nexid_e2e",role:"nexid_e2e",address:"127.0.0.1",pid:1}]};},
    end: async () => {closes+=1;},
  };
  await assert.rejects(runOwnershipCurrentStatePostgresQa({connect:async()=>client}), /Distinct QA clients/);
  assert.equal(closes,1);
  assert.doesNotMatch(statements.join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP|TRUNCATE/);
});
