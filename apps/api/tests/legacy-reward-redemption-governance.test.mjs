import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {json} from '../src/lib/http.ts';
import {rewardRedemptionUnavailableReason,readTapPointsPolicy} from '../src/lib/loyalty-service.ts';

const id='00000000-0000-0000-0000-000000000101',rewardId='00000000-0000-0000-0000-000000000102';
const now=Date.parse('2026-10-05T12:00:00.500Z');
const period={status:'active',start_at:new Date(now-1000),end_at:null,age_gate_required:false};
const reward={status:'active',starts_at:new Date(now-1000),ends_at:null,requires_age_gate:false,eligibility_json:{},points_cost:40,stock_remaining:2};
const member={id,status:'enrolled',points_balance:100,lifetime_points:100,membership_status:'active'};
const consumer={id,status:'registered',session_revoked_at:null};
const valid={tapEligible:true,program:period,reward,member,membershipStatus:'active',consumer};

test('legacy reward read policy requires current supported configuration and current eligibility',()=>{
 assert.equal(rewardRedemptionUnavailableReason(valid,now),null);
 for(const input of [
  {...valid,program:{...period,status:'paused'}},
  {...valid,program:{...period,start_at:new Date(now+1)}},
  {...valid,reward:{...reward,ends_at:new Date(now)}},
  {...valid,program:{...period,age_gate_required:true}},
  {...valid,reward:{...reward,requires_age_gate:true}},
  {...valid,reward:{...reward,requires_age_gate:null}},
  {...valid,membershipStatus:'blocked'},
  {...valid,membershipStatus:null},
  {...valid,consumer:{...consumer,session_revoked_at:new Date(now)}},
  {...valid,member:{...member,status:'deleted'}},
  {...valid,reward:{...reward,points_cost:-1}},
 ])assert.notEqual(rewardRedemptionUnavailableReason(input,now),null);
 assert.equal(rewardRedemptionUnavailableReason({...valid,reward:{...reward,stock_remaining:0}},now),'out_of_stock');
 assert.equal(rewardRedemptionUnavailableReason({...valid,member:{...member,points_balance:0}},now),'insufficient_points');
 assert.equal(rewardRedemptionUnavailableReason({...valid,reward:{...reward,points_cost:0},member:{...member,points_balance:0}},now),null);
});

test('legacy reward eligibility admits only the supported empty object, including for free rewards',()=>{
 for(const eligibility_json of [{requiresVerifiedTap:true},{requiresOwnership:true},{unknown:false},null,[],['rule'],'rule',false,0,undefined])for(const points_cost of [0,40])assert.equal(rewardRedemptionUnavailableReason({...valid,reward:{...reward,points_cost,eligibility_json}},now),'reward_eligibility_not_supported');
});

test('legacy consumer SQL uses actual account columns; session revocation remains an authenticated DTO field',async()=>{
 const runtime=await readFile(new URL('../src/lib/commercial-runtime-schema.ts',import.meta.url),'utf8');
 const loyaltySchema=await readFile(new URL('../src/lib/loyalty-schema.ts',import.meta.url),'utf8');
 const auth=await readFile(new URL('../src/lib/consumer-auth.ts',import.meta.url),'utf8');
 const service=await readFile(new URL('../src/lib/loyalty-service.ts',import.meta.url),'utf8');
 const harness=await readFile(new URL('./helpers/loyalty-current-state-postgres-harness.mjs',import.meta.url),'utf8');
 const actualConsumerTable=runtime.match(/CREATE TABLE IF NOT EXISTS consumers \(([\s\S]*?)\n\s*\)/)?.[1];
 assert.ok(actualConsumerTable);assert.match(actualConsumerTable,/status consumer_status NOT NULL DEFAULT 'anonymous'/);assert.doesNotMatch(actualConsumerTable,/session_revoked_at/);
 assert.match(auth,/s\.revoked_at AS session_revoked_at/);assert.doesNotMatch(service.slice(service.indexOf('export async function redeemReward')).split('\nexport async function ')[0],/consumer\.session_revoked_at/);
 assert.match(harness,/CREATE TABLE \$\{s\}\.consumers\(id uuid PRIMARY KEY, status \$\{s\}\.consumer_status NOT NULL DEFAULT 'anonymous'\)/);
 for(const [ddl,table,fields] of [[loyaltySchema,'loyalty_programs',['status','start_at','end_at','age_gate_required']],[loyaltySchema,'rewards',['status','starts_at','ends_at','requires_age_gate','eligibility_json']],[loyaltySchema,'loyalty_members',['status','consumer_id']],[runtime,'consumers',['status']],[runtime,'tenant_consumer_memberships',['status']]]){
  const tableBody=ddl.match(new RegExp('CREATE TABLE IF NOT EXISTS '+table+' \\(([\\s\\S]*?)\\n\\s*\\)'))?.[1];assert.ok(tableBody,table);
  const columns=new Set([...tableBody.matchAll(/^\s*(\w+)\s+/gm)].map(match=>match[1]));for(const field of fields)assert.ok(columns.has(field),`${table}.${field} must be an actual stored field`);
 }
 assert.equal(rewardRedemptionUnavailableReason({...valid,consumer:{...consumer,session_revoked_at:new Date(now)}},now),'consumer_unavailable');
});

async function loadHandler(kind,options={}){
 const file=kind==='GET'?'../src/app/mobile/passport/[eventId]/loyalty/route.ts':'../src/app/mobile/passport/[eventId]/loyalty/rewards/[rewardId]/redeem/route.ts';
 const code=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const calls={auth:0,body:0,fresh:[],queries:[],redeem:[]};
 const event={id:'900001',tenant_id:id,bid:'synthetic-batch',uid_hex:'04AABB',sdm_read_ctr:1};
 const modules={
  http:{json},
  'consumer-auth':{getConsumerFromRequest:async()=>{calls.auth++;return options.consumer===null?null:consumer;}},
  'critical-rate-limit':{enforceCriticalRateLimit:async()=>options.limited||null},
  'bounded-request-body':{RequestBodyTooLargeError:class extends Error{},readBoundedJsonBody:async(req,limit)=>{calls.body++;assert.equal(limit,16*1024);return req.json();}},
  db:{sql:async(strings,...values)=>{const statement=strings.join('?');calls.queries.push({statement,values});if(kind==='POST')return options.noMember?[]:[{id}];return /FROM rewards/.test(statement)?[{id:rewardId,...reward,...options.reward}]:[{...member,...options.member}];}},
  'sun-fresh-handoff':{consumeSunFreshHandoff:async(_req,_body,context,action)=>{calls.fresh.push({context,action});return options.freshDenied?{ok:false,reason:'already_used'}:{ok:true};}},
  'loyalty-tap-policy':{isCurrentLoyaltyTapEligible:()=>true},
  'loyalty-service':{getTapEvent:async()=>event,getActiveProgram:async()=>({...period,rules_json:{pointsPerValidTap:10,cooldownSeconds:0},...options.program}),readTapPointsPolicy,rewardRedemptionUnavailableReason,redeemReward:async input=>{calls.redeem.push(input);return options.result||{ok:false,status:409,error:'reward_configuration_changed'};}},
 };
 const module={exports:{}};
 new Function('require','module','exports','process','fetch',code)(name=>{const key=name.split('/').at(-1);assert.ok(Object.hasOwn(modules,key),`Unexpected ${key}`);return modules[key];},module,module.exports,{env:{}},()=>{throw Error('External requests forbidden');});
 return {handler:module.exports[kind],calls};
}
const request=body=>new Request('https://fixture.invalid/mobile/passport/900001/loyalty/rewards/'+rewardId+'/redeem',{method:'POST',body:JSON.stringify(body)});
const params=(overrides={})=>({params:Promise.resolve({eventId:'900001',rewardId,...overrides})});

test('legacy redemption auth and rate refusal occur before parsing, fresh consumption and persistence',async()=>{
 for(const options of [{consumer:null},{limited:json({ok:false},429)}]){const h=await loadHandler('POST',options);const response=await h.handler(request({}),params());assert.ok([401,429].includes(response.status));assert.equal(h.calls.body,0);assert.equal(h.calls.fresh.length,0);assert.equal(h.calls.queries.length,0);assert.equal(h.calls.redeem.length,0);}
});
test('legacy malformed body and reward identifiers cannot consume a fresh capability',async()=>{
 for(const body of [null,[]]){const h=await loadHandler('POST');assert.equal((await h.handler(request(body),params())).status,400);assert.equal(h.calls.fresh.length,0);assert.equal(h.calls.queries.length,0);}
 const h=await loadHandler('POST');assert.equal((await h.handler(request({}),params({rewardId:'not-a-reward'}))).status,400);assert.equal(h.calls.fresh.length,0);
});
test('legacy missing fresh capability stops before enrollment lookup or canje writer',async()=>{
 const h=await loadHandler('POST',{freshDenied:true});const response=await h.handler(request({}),params());assert.equal(response.status,403);assert.equal(h.calls.queries.length,0);assert.equal(h.calls.redeem.length,0);
});
test('legacy POST carries authenticated reward/member scope and retains safe configuration failures and receipts',async()=>{
 for(const result of [{ok:false,status:409,error:'age_verification_not_supported'},{ok:false,status:409,error:'already_redeemed',redemption:{id:'persisted-receipt'}}]){const h=await loadHandler('POST',{result});const response=await h.handler(request({consumerId:'forged',memberId:'forged',locale:'es-AR'}),params());assert.equal(response.status,409);assert.deepEqual(await response.json(),result);assert.equal(h.calls.redeem.length,1);assert.equal(h.calls.redeem[0].consumerId,id);assert.equal(h.calls.redeem[0].memberId,id);assert.equal(h.calls.redeem[0].rewardId,rewardId);assert.equal(h.calls.fresh[0].context.eventId,'900001');assert.equal(h.calls.fresh[0].action,'loyalty_redeem:'+rewardId);assert.match(h.calls.queries[0].statement,/reward\.program_id=member\.program_id AND reward\.tenant_id=member\.tenant_id/);assert.match(h.calls.queries[0].statement,/member\.consumer_id/);}
});
test('legacy mobile GET cannot advertise rewards denied by age, membership or unsupported eligibility',async()=>{
 for(const options of [{reward:{requires_age_gate:true}},{member:{membership_status:'blocked'}},{program:{age_gate_required:true}},{reward:{eligibility_json:{requiresOwnership:true}}},{reward:{eligibility_json:null}},{reward:{eligibility_json:[]}}]){const h=await loadHandler('GET',options);const response=await h.handler(new Request('https://fixture.invalid/mobile/passport/900001/loyalty'),params());const payload=await response.json();assert.equal(payload.loyalty.rewards[0].state,'locked');assert.equal(payload.loyalty.rewards[0].canRedeem,false);assert.ok(payload.loyalty.rewards[0].redeemUnavailableReason);assert.equal(Object.hasOwn(payload.loyalty.rewards[0],'eligibility_json'),false);if(options.reward&&Object.hasOwn(options.reward,'eligibility_json'))assert.equal(payload.loyalty.rewards[0].redeemUnavailableReason,'reward_eligibility_not_supported');if(options.member)assert.match(payload.loyalty.claimTap,/no suma puntos/);assert.equal(h.calls.redeem.length,0);}
});
test('legacy mobile zero TAP points copy does not promise points, missing membership retains explicit TAP bootstrap',async()=>{
 const h=await loadHandler('GET',{program:{rules_json:{pointsPerValidTap:0,cooldownSeconds:0}},member:{membership_status:null}});const response=await h.handler(new Request('https://fixture.invalid/mobile/passport/900001/loyalty'),params());const payload=await response.json();assert.match(payload.loyalty.claimTap,/sin puntos/);assert.equal(payload.loyalty.rewards[0].canRedeem,false);
});
