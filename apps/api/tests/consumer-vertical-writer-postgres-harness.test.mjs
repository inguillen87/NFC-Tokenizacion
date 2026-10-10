import test from "node:test";
import assert from "node:assert/strict";
import { runConsumerVerticalWriterPostgresQa } from "./helpers/consumer-vertical-writer-postgres-harness.mjs";
test("vertical writer PostgreSQL harness is inert without explicit connection factory",async()=>{
  await assert.rejects(runConsumerVerticalWriterPostgresQa(),/explicit disposable QA/);
});
for (const [label,overrides] of [["production database",{database:"production"}],["remote server",{address:"192.0.2.4"}],["wrong role",{role:"application"}]]) test(`vertical SQL harness refuses ${label} before any DDL`,async()=>{
  const queries=[];let ended=false;
  await assert.rejects(runConsumerVerticalWriterPostgresQa({connect:async()=>({query:async text=>{queries.push(text);return{rows:[{database:"nexid_e2e",role:"nexid_e2e",pid:123,address:"127.0.0.1",...overrides}]};},end:async()=>{ended=true;}})}));
  assert.equal(queries.length,1);assert.equal(ended,true);assert.doesNotMatch(queries.join("\n"),/CREATE|INSERT|UPDATE|DELETE|DROP/);
});
