import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { isCurrentLoyaltyTapEligible, LOYALTY_TAP_RESULTS } from "../src/lib/loyalty-tap-policy.ts";
import { evaluateLoyaltyForTap, getTapEvent, claimTapPoints } from "../src/lib/loyalty-service.ts";
import { getTriviaForTap } from "../src/lib/trivia-service.ts";
import { installEphemeralE2eSqlExecutor } from "../src/lib/db.ts";

const tenant="00000000-0000-0000-0000-000000000101",batch="00000000-0000-0000-0000-000000000102",tag="00000000-0000-0000-0000-000000000103";
const eligible=(overrides={})=>({id:"900001",tenant_id:tenant,batch_id:batch,uid_hex:"04AABBCCDDEE11",result:"VALID_CLOSED",current_tag_id:tag,current_tag_tenant_id:tenant,current_tag_batch_id:batch,current_tag_uid_hex:"04AABBCCDDEE11",current_tag_status:"active",current_tag_lifecycle_state:"active",current_tag_identity_count:1,...overrides});
const testEnv={NODE_ENV:"test",VERCEL_ENV:"test",NEXID_E2E_CONFIRMATION:"I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",NEXID_E2E_DATABASE_URL:"postgresql://nexid_e2e:test-only@localhost/nexid_e2e_loyalty_current_state"};

for(const result of LOYALTY_TAP_RESULTS)test(`configured benefits preserve authenticated ${result}`,()=>assert.equal(isCurrentLoyaltyTapEligible(eligible({result})),true));
for(const state of ["inactive","suspended","quarantined","lost","expired","broken","tampered","revoked","unknown",""]){
  test(`current administrative lifecycle ${state || "empty"} blocks an old valid tap`,()=>assert.equal(isCurrentLoyaltyTapEligible(eligible({current_tag_lifecycle_state:state})),false));
}
for(const result of ["OPENED","REPLAY_SUSPECT","DUPLICATE","INVALID","NOT_ACTIVE","NOT_REGISTERED","TAMPER","TAMPER_RISK","TAMPER_UNVERIFIED","REVOKED","BROKEN","SUN_PROFILE_MISMATCH","VALID_FUTURE_UNKNOWN",""]){
  test(`unapproved event result ${result || "empty"} grants no new benefit`,()=>assert.equal(isCurrentLoyaltyTapEligible(eligible({result})),false));
}
test("legacy null lifecycle uses an active operational status",()=>assert.equal(isCurrentLoyaltyTapEligible(eligible({current_tag_lifecycle_state:null})),true));
for(const field of ["tenant_id","batch_id","uid_hex","current_tag_id","current_tag_tenant_id","current_tag_batch_id","current_tag_uid_hex","current_tag_status","current_tag_identity_count"]){
  test(`missing ${field} fails closed`,()=>assert.equal(isCurrentLoyaltyTapEligible(eligible({[field]:null})),false));
}
for(const overrides of [{current_tag_tenant_id:batch},{current_tag_batch_id:tenant},{current_tag_uid_hex:"04AABBCCDDEE22"},{current_tag_status:"revoked"},{current_tag_status:"inactive"},{current_tag_identity_count:2}]){
  test(`identity/status mismatch ${JSON.stringify(overrides)} fails closed`,()=>assert.equal(isCurrentLoyaltyTapEligible(eligible(overrides)),false));
}
test("manual opening denies benefits while electronic opening remains a separate supported state",()=>{
  assert.equal(isCurrentLoyaltyTapEligible(eligible({result:"VALID_OPENED",reason:"tagtamper_opened:4F4F"})),true);
  assert.equal(isCurrentLoyaltyTapEligible(eligible({manual_tamper_status:"MANUAL_OPENED"})),false);
  assert.equal(isCurrentLoyaltyTapEligible(eligible({reason:"operator_declared_open:physical_observation"})),false);
});
test("blocked eligibility returns without reading the ledger or attempting a write",async()=>{
  let calls=0;const remove=installEphemeralE2eSqlExecutor(async()=>{calls+=1;return[];},testEnv);
  try{assert.deepEqual(await evaluateLoyaltyForTap({eventId:"900001",memberId:tag,program:{},event:eligible({current_tag_status:"revoked"})}),{award:false,reason:"blocked_validation"});assert.equal(calls,0);}finally{remove();}
});
test("current-state enrichment preserves the historical event, including a now revoked tag",async()=>{
  const row=eligible({current_tag_status:"revoked",current_tag_lifecycle_state:"revoked"});const remove=installEphemeralE2eSqlExecutor(async strings=>{const statement=strings.join("?");assert.match(statement,/LEFT JOIN LATERAL/);assert.match(statement,/current_tag ON b\.tenant_id = e\.tenant_id/);assert.doesNotMatch(statement,/WHERE e\.id[^]*AND current_tag\.status/);return[row];},testEnv);
  try{assert.equal((await getTapEvent("900001")).result,"VALID_CLOSED");assert.equal(isCurrentLoyaltyTapEligible(await getTapEvent("900001")),false);}finally{remove();}
});
test("trivia refuses a revoked current tag before loading a quiz or creating membership",async()=>{
  let calls=0;const remove=installEphemeralE2eSqlExecutor(async strings=>{calls+=1;assert.match(strings.join("?"),/FROM events e/);return[eligible({current_tag_status:"revoked"})];},testEnv);
  try{assert.deepEqual(await getTriviaForTap({eventId:"900001",memberKey:`consumer:${tag}`,consumerId:tag}),{ok:false,status:403,error:"tap_commercial_rights_blocked"});assert.equal(calls,1);}finally{remove();}
});
test("consumer points claims refuse revoked evidence before member upsert",async()=>{
  let calls=0;const remove=installEphemeralE2eSqlExecutor(async strings=>{calls+=1;assert.match(strings.join("?"),/FROM events e/);return[eligible({current_tag_status:"revoked"})];},testEnv);
  try{assert.deepEqual(await claimTapPoints({eventId:"900001",consumerId:tag}),{ok:false,status:403,error:"event_security_blocked"});assert.equal(calls,1);}finally{remove();}
});
test("every TAP-dependent SQL writer locks its exact current tag and preserves blocked/deleted members",async()=>{
  const service=await readFile(new URL("../src/lib/loyalty-service.ts",import.meta.url),"utf8"),trivia=await readFile(new URL("../src/lib/trivia-service.ts",import.meta.url),"utf8");
  for(const fn of ["getOrCreateMember","awardPoints","redeemReward"]){const fragment=service.slice(service.indexOf(`export async function ${fn}`)).split("\nexport async function ")[0];assert.match(fragment,/WITH current_tag AS MATERIALIZED/);assert.match(fragment,/bound_batch\.tenant_id = source_event\.tenant_id/);assert.match(fragment,/tag\.batch_id = source_event\.batch_id AND UPPER\(tag\.uid_hex\) = UPPER\(source_event\.uid_hex\)/);assert.match(fragment,/FOR SHARE OF tag/);assert.match(fragment,/ANY\(\$\{\[\.\.\.LOYALTY_TAP_RESULTS\]\}::text\[\]\)/);}
  assert.match(service,/WHERE loyalty_members\.status IN \('anonymous', 'enrolled', 'verified'\)/);
  assert.match(trivia,/WITH current_tag AS MATERIALIZED/);assert.match(trivia,/FOR SHARE OF tag/);assert.match(trivia,/INSERT INTO tenant_consumer_memberships/);assert.doesNotMatch(trivia,/await ensureTenantMembership/);
});
