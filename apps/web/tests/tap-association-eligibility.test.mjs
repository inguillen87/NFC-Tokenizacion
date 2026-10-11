import test from 'node:test';
import assert from 'node:assert/strict';
import { tapAssociationContext } from '../src/app/me/_components/tap-association-model.ts';
import { createTapEligibilityReader, ELIGIBILITY_ACTIONS, TAP_ELIGIBILITY_SCHEMA, tapEligibilityAllows, tapEligibilityReceipt, tapEligibilityRequest } from '../src/app/me/_components/tap-association-eligibility.ts';
const context = id => tapAssociationContext(new URLSearchParams({fromTap:'1',eventId:id,tenant:'qa-brand',bid:'QA-BATCH',action:'save'}));
const decision = (allowed=true, reason=allowed?'allowed':'event_security_blocked', freshTapRequired=false) => ({allowed,reason,freshTapRequired});
const reply = (id='715', actions=Object.fromEntries(ELIGIBILITY_ACTIONS.map(action=>[action,{...decision(),...(action==='claim'?{nextStep:'confirm'}:{})}]))) => ({ok:true,schema:TAP_ELIGIBILITY_SCHEMA,eventId:id,actions});
test('server decisions stay action-specific; claim allows an attempt without certifying ownership',()=>{
 const current=tapEligibilityReceipt(context('715'),200,reply());
 for(const action of ELIGIBILITY_ACTIONS)assert.equal(tapEligibilityAllows(current,action),true);
 assert.equal(current.actions.claim.nextStep,'confirm');assert.equal('ownership' in current,false);
 const partial=reply();partial.actions.save=decision(false,'fresh_tap_required',true);
 const specific=tapEligibilityReceipt(context('715'),200,partial);
 assert.equal(specific.state,'ready');assert.equal(tapEligibilityAllows(specific,'save'),false);assert.equal(tapEligibilityAllows(specific,'join'),true);
 const denied=tapEligibilityReceipt(context('715'),200,reply('715',Object.fromEntries(ELIGIBILITY_ACTIONS.map(action=>[action,{...decision(false),...(action==='claim'?{nextStep:'blocked'}:{})}]))));
 for(const action of ELIGIBILITY_ACTIONS)assert.equal(tapEligibilityAllows(denied,action),false);
});
test('wrong event, version, malformed decision and contradictory fresh flags fail closed',()=>{
 const cases=[null,[],{},reply('716'),{...reply(),eventId:715},{...reply(),schema:'v0'},{...reply(),ok:'true'}, {...reply(),actions:null}];
 for(const field of ['allowed','reason','freshTapRequired'])for(const value of [undefined,null,1,'true',{},[]]){
  const valueReply=reply();valueReply.actions.save[field]=value;cases.push(valueReply);
 }
 for(const bad of [decision(true,'event_security_blocked'),decision(true,'allowed',true),decision(true,'contains private text'),decision(true,''),decision(false,'allowed'),decision(false,'fresh_tap_required',false),decision(false,'unknown_private_reason')]){const row=reply();row.actions.save=bad;cases.push(row);}
 for(const raw of cases){const parsed=tapEligibilityReceipt(context('715'),200,raw);assert.equal(parsed.state,'unavailable');for(const action of ELIGIBILITY_ACTIONS)assert.equal(tapEligibilityAllows(parsed,action),false);}
});

test('claim permission requires an exact next step and blocked decisions cannot prompt a PIN or confirmation',()=>{
 for(const nextStep of ['confirm','enter_pin']){const raw=reply();raw.actions.claim.nextStep=nextStep;const value=tapEligibilityReceipt(context('715'),200,raw);assert.equal(value.state,'ready');assert.equal(value.actions.claim.nextStep,nextStep);assert.equal(tapEligibilityAllows(value,'claim'),true);}
 for(const nextStep of [undefined,null,'blocked','purchase','ownership_confirmed',['confirm'],{}]){const raw=reply();raw.actions.claim.nextStep=nextStep;assert.equal(tapEligibilityReceipt(context('715'),200,raw).state,'unavailable');}
 for(const nextStep of ['confirm','enter_pin',null]){const raw=reply();raw.actions.claim={...decision(false,'pos_activation_pending'),nextStep};assert.equal(tapEligibilityReceipt(context('715'),200,raw).state,'unavailable');}
 const raw=reply();raw.actions.claim={...decision(false,'ownership_already_claimed'),nextStep:'blocked'};const value=tapEligibilityReceipt(context('715'),200,raw);assert.equal(value.state,'ready');assert.equal(tapEligibilityAllows(value,'claim'),false);assert.equal(tapEligibilityAllows(value,'save'),true);
});
test('private response exposes only finite decisions, distinguishes missing session/fresh read/service failure',()=>{
 const raw={...reply(),token:'must not propagate',consumer:{email:'must not propagate'}};raw.actions.save.secret='must not propagate';
 const projected=tapEligibilityReceipt(context('715'),200,raw);assert.equal(JSON.stringify(projected).includes('must not propagate'),false);
 for(const [status,payload,state] of [[401,{},'session_required'],[403,{error:'fresh_tap_required',freshTapRequired:true},'fresh_required'],[400,{error:'invalid_context'},'blocked'],[503,{},'unavailable'],[200,{ok:true},'unavailable'],[403,{error:'fresh_tap_required',freshTapRequired:'true'},'unavailable'],[403,{error:'fresh_tap_required',fresh_tap_required:true},'unavailable']]){
  const value=tapEligibilityReceipt(context('715'),status,payload);assert.equal(value.state,state);assert.equal(tapEligibilityAllows(value,'save'),false);
 }
});
test('request is a private explicit GET without a capability in URL/body and does not normalize identity',()=>{
 const value=tapEligibilityRequest(context('715'));assert.equal(value.init.method,'GET');assert.equal(value.init.cache,'no-store');assert.equal(value.init.credentials,'include');
 assert.equal(value.init.headers['x-nexid-consumer-tap-eligibility'],'1');assert.deepEqual([...new URL(value.path,'https://nexid.lat').searchParams], [['eventId','715'],['tenant','qa-brand'],['bid','QA-BATCH']]);
 assert.equal('body' in value.init,false);assert.equal(/token|capability/i.test(value.path),false);
});
test('late old-context replies and disposed readers cannot enable actions, failure does not poll or mutate',async()=>{
 const pending=[],requests=[];const reader=createTapEligibilityReader((path,init)=>{requests.push({path,init});return new Promise(resolve=>pending.push(resolve));});
 const old=reader.read(context('715')),current=reader.read(context('716'));assert.equal(requests[0].init.signal.aborted,true);
 pending[1]({status:200,payload:reply('716')});assert.equal((await current).state,'ready');pending[0]({status:200,payload:reply('715')});assert.equal(await old,null);
 const disposed=reader.read(context('717'));reader.dispose();assert.equal(requests[2].init.signal.aborted,true);pending[2]({status:200,payload:reply('717')});assert.equal(await disposed,null);assert.equal(await reader.read(context('718')),null);assert.equal(requests.length,3);
 let calls=0;const failed=createTapEligibilityReader(async(_path,init)=>{calls++;assert.equal(init.method,'GET');throw Error('offline');});assert.equal((await failed.read(context('715'))).state,'unavailable');assert.equal(calls,1);failed.dispose();
});
test('a stalled read ends without polling, even when transport ignores abort',async()=>{
 let calls=0,signal,resolveLate;const reader=createTapEligibilityReader((_path,init)=>{calls++;signal=init.signal;return new Promise(resolve=>{resolveLate=resolve;});},5);
 assert.equal((await reader.read(context('715'))).state,'unavailable');assert.equal(signal.aborted,true);assert.equal(calls,1);
 resolveLate({status:200,payload:reply()});await Promise.resolve();assert.equal(calls,1);reader.dispose();
 for(const invalid of [0,-1,NaN,30001,1.5])assert.throws(()=>createTapEligibilityReader(async()=>({status:200,payload:reply()}),invalid));
});
