import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSupplierRequestReviewEnvelope, supplierRequestReviewCall } from '../src/lib/supplier-request-review-client.ts';
import { parseSupplierRequestEnvelope, filterSupplierRequestInbox, supplierRequestManagementState } from '../src/lib/supplier-request-client.ts';

const id='40000000-0000-4000-8000-000000000001',tenantId='10000000-0000-4000-8000-000000000001',actor='20000000-0000-4000-8000-000000000001',key='50000000-0000-4000-8000-000000000001';
const binding={id,tenant:'qa-only',tenantId};
const date='2026-09-23T12:00:00.000Z';
const event=(revision=1,patch={})=>({id:`60000000-0000-4000-8000-${String(revision).padStart(12,'0')}`,revision,request_revision:3,action:revision%2?'request_information':'respond',message:revision%2?'¿Sobre qué superficie se aplicará?':'Sobre vidrio, antes del llenado.',actor_id:actor,created_at:date,...patch});
const envelope=(patch={})=>({ok:true,protocol:'nexid.supplier-request-review.v1',scope:{mode:'tenant',tenant_id:tenantId,tenant_slug:'qa-only'},request_id:id,request_revision:3,review:{state:'pending',revision:0,updated_at:null},history:[],count:0,truncated:false,next_before_revision:null,...patch});
const reviewed=(revision=1,first=1)=>envelope({review:{state:revision%2?'needs_information':'answered',revision,updated_at:date},history:Array.from({length:revision-first+1},(_,n)=>event(n+first)),count:revision-first+1,truncated:first>1,next_before_revision:first>1?first:null});
const command=(patch={})=>({tenant:'qa-only',id,key,body:{action:'request_information',message:event().message,expected_revision:0,expected_request_revision:3},...patch});
const result=(patch={})=>({...reviewed(),receipt:{idempotency_key:key,action:'request_information',revision:1},idempotent_replay:false,...patch});
const response=(body,status=200,mode='production')=>Response.json(body,{status,headers:{'x-nexid-data-mode':mode}});

test('review scope, event identity, sidecar state and current request revision are authoritative',()=>{
  assert.equal(parseSupplierRequestReviewEnvelope(envelope(),binding).review.state,'pending');
  const parsed=parseSupplierRequestReviewEnvelope(reviewed(),binding);assert.equal(parsed.history[0].message,event().message);
  for(const mutate of [d=>d.protocol='unknown',d=>d.demo=true,d=>d.scope.tenant_id=key,d=>d.scope.tenant_slug='other',d=>d.scope.mode='global',d=>d.request_id=key,d=>d.request_revision=0,d=>d.review.state='pending',d=>d.review.updated_at=null,d=>d.history[0].actor_id='unknown',d=>d.history[0].request_revision=4,d=>d.history[0].message='',d=>d.history[0].message='x'.repeat(2001),d=>d.history[0].action='approve',d=>d.history[0].created_at='bad']){
    const value=reviewed();mutate(value);assert.throws(()=>parseSupplierRequestReviewEnvelope(value,binding));
  }
  const raw=reviewed();raw.history[0].actor_email='PRIVATE';raw.history[0].fingerprint='PRIVATE';assert.doesNotMatch(JSON.stringify(parseSupplierRequestReviewEnvelope(raw,binding)),/PRIVATE/);
});

test('history is continuous, exclusive, bounded and cannot claim omitted events are complete',()=>{
  assert.equal(parseSupplierRequestReviewEnvelope(reviewed(112,13),binding).next_before_revision,13);
  const prior={...reviewed(12),review:{state:'answered',revision:112,updated_at:date}};
  assert.equal(parseSupplierRequestReviewEnvelope(prior,{...binding,beforeRevision:13}).history.length,12);
  const beforeFirst={...reviewed(0),review:{state:'answered',revision:112,updated_at:date}};
  assert.equal(parseSupplierRequestReviewEnvelope(beforeFirst,{...binding,beforeRevision:1}).history.length,0);
  for(const value of [reviewed(101),{...reviewed(100,50),history:[event(50),event(100)],count:2},{...reviewed(100,50),truncated:false,next_before_revision:null},{...reviewed(2),truncated:true,next_before_revision:1},{...reviewed(2),next_before_revision:1},{...reviewed(2),count:3},{...reviewed(2),history:[event(1),event(2,{id:event(1).id})]}])assert.throws(()=>parseSupplierRequestReviewEnvelope(value,binding));
  for(const value of [{...prior,history:prior.history.slice(0,-1),count:11},{...prior,history:[...prior.history,event(13)],count:13},{...prior,history:[],count:0}])assert.throws(()=>parseSupplierRequestReviewEnvelope(value,{...binding,beforeRevision:13}));
});

test('review writes retain command identity, exact tenant and separate request/review revisions',async()=>{
  const calls=[];const cmd=command();
  const parsed=await supplierRequestReviewCall({...binding,command:cmd},async(url,init)=>{calls.push({url,init});return response(result());});
  assert.equal(calls.length,1);assert.equal(calls[0].url,`/api/admin/supplier-requests/${id}/review?tenant=qa-only`);assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.headers['Idempotency-Key'],key);assert.deepEqual(JSON.parse(calls[0].init.body),cmd.body);assert.equal(parsed.receipt.revision,1);
  let sent=0;for(const change of [{tenant:'foreign'},{id:key},{key:'bad'},{body:{...cmd.body,expected_revision:-1}}])await assert.rejects(supplierRequestReviewCall({...binding,command:command(change)},async()=>{sent++;return response(result());}));assert.equal(sent,0);
});

test('receipt can confirm the original operation after later activity, but never a different command or revision',async()=>{
  const replay=await supplierRequestReviewCall({...binding,command:command()},async()=>response(result({...reviewed(2),idempotent_replay:true})));assert.equal(replay.receipt.revision,1);assert.equal(replay.review.revision,2);
  for(const patch of [{receipt:null},{receipt:{idempotency_key:id,action:'request_information',revision:1}},{receipt:{idempotency_key:key,action:'respond',revision:1}},{...reviewed(2),receipt:{idempotency_key:key,action:'request_information',revision:2}},{history:[event(1,{message:'Otro texto'})]},{request_revision:2},{history:[event(1,{request_revision:2})]}])await assert.rejects(supplierRequestReviewCall({...binding,command:command()},async()=>response(result(patch))),error=>error.uncertain===true);
  const old=reviewed(112,13);const parsed=await supplierRequestReviewCall({...binding,command:command()},async()=>response(result({...old,idempotent_replay:true})));assert.equal(parsed.receipt.revision,1);assert.equal(parsed.review.revision,112);
});

test('timeouts, contradictory acknowledgements and nonproduction markers never confirm a write',async()=>{
  for(const [status,body] of [[503,{ok:false,reason:'unavailable'}],[408,{ok:false,reason:'timeout'}],[400,{ok:true}],[200,{ok:true}]])await assert.rejects(supplierRequestReviewCall({...binding,command:command()},async()=>response(body,status)),error=>error.uncertain);
  for(const mode of ['demo','fallback',''])await assert.rejects(supplierRequestReviewCall({...binding,command:command()},async()=>response(result(),200,mode)),error=>error.uncertain);
  for(const status of [400,401,403,409])await assert.rejects(supplierRequestReviewCall({...binding,command:command()},async()=>response({ok:false,reason:'rejected'},status)),error=>error.status===status&&!error.uncertain);
  const sent=[];let attempt=0;const fetcher=async(url,init)=>{sent.push([url,init.headers['Idempotency-Key'],init.body]);if(!attempt++)throw Error('PRIVATE');return response(result({idempotent_replay:true}));};
  await assert.rejects(supplierRequestReviewCall({...binding,command:command()},fetcher),error=>error.uncertain&&!error.message.includes('PRIVATE'));await supplierRequestReviewCall({...binding,command:command()},fetcher);assert.deepEqual(sent[0],sent[1]);
});

test('history pagination is read-only and invalid cursor or scopes never reach transport',async()=>{
  const older={...reviewed(12),review:{state:'answered',revision:112,updated_at:date}};
  await supplierRequestReviewCall({...binding,beforeRevision:13},async(url,init)=>{assert.ok(url.endsWith('&before_revision=13'));assert.equal(init.method,'GET');assert.equal(init.body,undefined);return response(older);});
  let calls=0;for(const patch of [{beforeRevision:0},{beforeRevision:2.5},{beforeRevision:2147483647},{beforeRevision:1,command:command()},{tenant:'../x'},{tenantId:'bad'}])await assert.rejects(supplierRequestReviewCall({...binding,...patch},async()=>{calls++;return response(envelope());}));assert.equal(calls,0);
});

test('inbox search filters only loaded records and unknown review never becomes pending',()=>{
  const item={id,tenant_id:tenantId,tenant_slug:'qa-only',status:'submitted',revision:3,title:'Botella Ámbar',notes:'',construction_id:'tt_bridge',quantity:125,pack_purpose:'production',created_at:date,updated_at:date,submitted_at:date,order_id:null};
  const items=[item,{...item,id:key,title:'Frasco',review_summary:{state:'needs_information',revision:1,updated_at:date}}];
  assert.equal(supplierRequestManagementState(item),'unknown');assert.equal(filterSupplierRequestInbox(items,'Ámbar','all').length,1);assert.equal(filterSupplierRequestInbox(items,'qa-only','needs_information').length,1);assert.equal(filterSupplierRequestInbox(items,'','pending').length,0);assert.equal(filterSupplierRequestInbox(items,'missing','all').length,0);assert.equal(items.length,2);
  const payload={ok:true,protocol:'nexid.supplier-request.v1',scope:{mode:'tenant',tenant_id:tenantId,tenant_slug:'qa-only'},request:items[1]};assert.equal(parseSupplierRequestEnvelope(payload,'qa-only').request.review_summary.state,'needs_information');assert.throws(()=>parseSupplierRequestEnvelope({...payload,request:{...item,review_summary:{state:'pending',revision:1,updated_at:date}}},'qa-only'));
});
