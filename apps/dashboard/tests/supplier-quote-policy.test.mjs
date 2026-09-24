import assert from 'node:assert/strict';import test from 'node:test';
import{parseQuoteCommand,parseQuoteEvent,parseQuoteState,quoteTotal,quoteMinorFromText,quoteMoney}from'../src/lib/supplier-quote-policy.ts';
const id='40000000-0000-4000-8000-000000000001',actor='20000000-0000-4000-8000-000000000001';
const offer=()=>({currency:'USD',net_minor:10001,tax_minor:2100,shipping_minor:499,conditions:'Condiciones comerciales declaradas.',valid_until:'2026-10-01T12:00:00.000Z'});
const command=(patch={})=>({action:'issue',expected_revision:0,expected_request_revision:2,expected_review_revision:0,offer:offer(),reason:'Propuesta inicial.',...patch});
const event=(patch={})=>({...offer(),id,revision:1,request_revision:3,quote_version:1,source_request_revision:2,review_revision:0,action:'issue',state:'offered',total_minor:12600,reason:'Propuesta inicial.',actor_id:actor,created_at:'2026-09-24T12:00:00.000Z',...patch});
test('decimal amounts are exact minor units and do not accept grouping or exponent',()=>{
 for(const [value,expected]of [['0,01',1],['100.01',10001],['100,01',10001],['10.1',1010],['9999999999.99',999999999999],[' 001.02 ',102]])assert.equal(quoteMinorFromText(value),expected);
 assert.equal(quoteMinorFromText('0',true),0);for(const value of ['',' ','0','-1','+1','1,001','1.000,50','1,000.50','1e3','NaN','Infinity','10000000000','1.','0x10'])assert.throws(()=>quoteMinorFromText(value));
 assert.equal(quoteTotal(offer()),12600);assert.equal(quoteMoney(12600,'USD'),'USD 126,00');assert.equal(quoteMoney(1234567,'ARS'),'ARS 12.345,67');assert.throws(()=>quoteTotal({...offer(),net_minor:999999999999}));
});
test('quote command is closed, binds three revisions, separates roles/actions and canonical UTC validity',()=>{
 assert.deepEqual(parseQuoteCommand(command()),command());assert.equal(parseQuoteCommand(command({action:'accept',offer:null,reason:''})).action,'accept');
 for(const patch of [{actor_id:actor},{action:'buy'},{action:'accept'},{expected_revision:-1},{expected_revision:'0'},{expected_request_revision:0},{expected_review_revision:1.5},{reason:''},{reason:'x'.repeat(2001)},{offer:{...offer(),currency:'BTC'}},{offer:{...offer(),total_minor:1}},{offer:{...offer(),net_minor:1.1}},{offer:{...offer(),valid_until:'2026-10-01'}},{offer:{...offer(),valid_until:'2026-02-30T00:00:00.000Z'}},{offer:{...offer(),conditions:'bad\u0001text'}}])assert.throws(()=>parseQuoteCommand(command(patch)));
 for(const action of ['reject','withdraw']){assert.equal(parseQuoteCommand(command({action,offer:null})).action,action);assert.throws(()=>parseQuoteCommand(command({action,offer:null,reason:''})));}
});
test('wire event strips private fields and validates total, identities, version and state consistency',()=>{
 assert.deepEqual(parseQuoteEvent({...event(),auth_session_id:'private',fingerprint:'private'}),event());
 for(const patch of [{id:'bad'},{actor_id:'bad'},{total_minor:1},{revision:0},{quote_version:2},{source_request_revision:3},{request_revision:2},{state:'paid'},{action:'accept',state:'accepted',created_at:'2026-10-02T00:00:00.000Z'},{valid_until:'2026-09-24T11:00:00.000Z'}])assert.throws(()=>parseQuoteEvent(event(patch)));
});
test('empty and historical windows remain source-bound and never replace the current state',()=>{
 const empty={revision:0,current:null,history:[],count:0,truncated:false,next_before_revision:null,as_of:'2026-09-24T12:00:00.000Z'};assert.equal(parseQuoteState(empty,2,0).current,null);
 const e=event(),state={...empty,revision:1,current:e,history:[e],count:1};assert.equal(parseQuoteState(state,3,1).current.id,id);
 for(const patch of [{revision:2},{current:null},{history:[]},{history:[e,e],count:2},{count:2},{truncated:true},{next_before_revision:1},{history:[{...e,total_minor:1}]}])assert.throws(()=>parseQuoteState({...state,...patch},3,1));
 const later=event({id:actor,revision:2,request_revision:4,quote_version:2,source_request_revision:3});
 const older={...state,revision:2,current:later,history:[e]};assert.equal(parseQuoteState(older,4,2,2).current.quote_version,2);assert.throws(()=>parseQuoteState(older,4,2));assert.throws(()=>parseQuoteState(older,4,2,1));
});
