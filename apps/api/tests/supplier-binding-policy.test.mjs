import assert from 'node:assert/strict';import test from 'node:test';
import{parseBindingCommand,parseBindingState,BindingContractError}from'../src/lib/supplier-binding-policy.ts';
const id='40000000-0000-4000-8000-000000000001',orderId='60000000-0000-4000-8000-000000000001',eventId='70000000-0000-4000-8000-000000000001',decision='80000000-0000-4000-8000-000000000001',actor='20000000-0000-4000-8000-000000000001';
const supplier=()=>({reference:'FACTORY-QA',name:'Proveedor de prueba',confirmation_ref:'DOC-QA-001'}),spec=()=>({revision:1,hash:'sha256:'+'a'.repeat(64),decision_id:decision});
const command=()=>({action:'assign',expected_revision:0,expected_request_revision:5,order_id:orderId,supplier:supplier(),spec:spec(),reason:'Registro revisado.'});
const event=(patch={})=>({id:eventId,revision:1,request_revision:5,order_id:orderId,action:'assign',supplier:supplier(),spec:spec(),reason:'Registro revisado.',actor_id:actor,created_at:'2026-09-24T12:00:00.000Z',...patch});
const state=(patch={})=>({request_id:id,request_revision:5,order:{id:orderId,status:'pack_ready',pack_purpose:'production'},specification:{status:'approved',...spec(),ready:true},revision:1,current:event(),history:[event()],count:1,truncated:false,next_before_revision:null,dispatch_receipt:null,as_of:'2026-09-24T12:00:01.000Z',...patch});
test('closed binding command preserves reference identity, explicit spec and reviewed reason',()=>{
 assert.deepEqual(parseBindingCommand(command()),command());assert.equal(parseBindingCommand({...command(),reason:'  Motivo\ncon detalle  '}).reason,'Motivo\ncon detalle');
 const empty={...command(),action:'withdraw',supplier:null,spec:null};assert.deepEqual(parseBindingCommand(empty),empty);
});
for(const patch of [{action:'send'},{expected_revision:'0'},{expected_revision:-1},{expected_revision:2147483646},{expected_request_revision:0},{order_id:'bad'},{supplier:null},{spec:null},{reason:''},{reason:'x'.repeat(1001)},{reason:'bad\u0001text'},{actor_id:actor},{supplier:{...supplier(),reference:'AB'}},{supplier:{...supplier(),reference:'https://private.invalid'}},{supplier:{...supplier(),name:'text\nmore'}},{supplier:{...supplier(),confirmation_ref:'x'.repeat(241)}},{spec:{...spec(),hash:'a'.repeat(64)}},{spec:{...spec(),decision_id:'bad'}},{spec:{...spec(),extra:true}},{action:'withdraw'}])test('binding command rejects invalid or unauthorized fields '+JSON.stringify(patch),()=>assert.throws(()=>parseBindingCommand({...command(),...patch}),BindingContractError));
test('binding state derives explicit empty/current/withdrawn/stale without claiming delivery',()=>{
 const parse=x=>parseBindingState(x,{id,orderId});assert.equal(parse(state()).binding_status,'current');assert.equal(parse(state({revision:0,current:null,history:[],count:0})).binding_status,'none');
 assert.equal(parse(state({current:event({action:'withdraw'}),history:[event({action:'withdraw'})]})).binding_status,'withdrawn');
 assert.equal(parse(state({specification:{status:'approved',...spec(),revision:2,ready:true}})).binding_status,'stale');
 assert.equal(parse(state({specification:{status:'draft',...spec(),decision_id:null,ready:false}})).binding_status,'stale');
});
for(const patch of [{request_id:actor},{request_revision:6},{order:{id:actor,status:'pack_ready',pack_purpose:'production'}},{order:{id:orderId,status:'pack_ready',pack_purpose:'unknown'}},{revision:0},{count:2},{current:null},{history:[]},{history:[event(),event()],count:2},{truncated:true},{next_before_revision:1},{as_of:'not-a-date'},{history:[event({supplier:{...supplier(),name:'Changed history'}})]},{specification:{status:'draft',...spec(),ready:true}},{specification:{status:'approved',...spec(),hash:null,ready:true}},{dispatch_receipt:{id:actor,created_at:'2026-09-24T12:00:02Z',binding_event_id:decision}}])test('binding state rejects malformed scope/history '+JSON.stringify(patch),()=>assert.throws(()=>parseBindingState(state(patch),{id,orderId})));
test('exclusive history page retains the newest state and validates exact pagination',()=>{
 const current=event({id:decision,revision:3});const older=state({current,revision:3,history:[event()],count:1});const result=parseBindingState(older,{id,orderId},2);assert.equal(result.current.revision,3);assert.equal(result.history[0].revision,1);
 assert.throws(()=>parseBindingState(older,{id,orderId},1));
});
