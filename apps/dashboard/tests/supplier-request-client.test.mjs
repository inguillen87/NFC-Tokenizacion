import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSupplierRequestEnvelope, parseSupplierRequestList, supplierRequestCall, SupplierRequestError } from '../src/lib/supplier-request-client.ts';

const id='40000000-0000-4000-8000-000000000001', tenantId='10000000-0000-4000-8000-000000000001', key='50000000-0000-4000-8000-000000000001';
const content={title:'Solicitud sintética',construction_id:'',quantity:null,pack_purpose:null,notes:'Texto literal <script>\nSin cantidad todavía'};
const item=(patch={})=>({...content,id,tenant_id:tenantId,tenant_slug:'qa-only',status:'draft',revision:1,created_at:'2026-09-23T12:00:00.000Z',updated_at:'2026-09-23T12:00:00.000Z',submitted_at:null,order_id:null,...patch});
const complete={construction_id:'tt_bridge',quantity:125,pack_purpose:'trial_integration'};
const envelope=(patch={})=>({ok:true,protocol:'nexid.supplier-request.v1',scope:{mode:'tenant',tenant_id:tenantId,tenant_slug:'qa-only'},request:item(),...patch});
const list=(patch={})=>envelope({items:[item()],count:1,truncated:false,...patch});
const command=(patch={})=>({tenant:'qa-only',action:'create',key,body:content,...patch});
const result=(patch={})=>envelope({receipt:{idempotency_key:key,action:'create',revision:1},idempotent_replay:false,...patch});
const response=(body,status=200,mode='production')=>Response.json(body,{status,headers:{'x-nexid-data-mode':mode}});
const call=(body,options={},cmd=command())=>supplierRequestCall({tenant:'qa-only',...(cmd.id?{id:cmd.id}:{}),command:cmd},async()=>response(body,options.status,options.mode));

test('partial request remains partial and literal; server scope, IDs and states are mandatory',()=>{
  assert.deepEqual(parseSupplierRequestEnvelope(envelope(),'qa-only').request,item());
  for(const modify of [v=>v.protocol='unknown',v=>v.demo=true,v=>v.scope.tenant_slug='foreign',v=>v.scope.tenant_id=key,v=>v.request.id='bad',v=>v.request.tenant_slug='foreign',v=>v.request.status='approved',v=>v.request.revision=0,v=>v.request.quantity='125',v=>v.request.pack_purpose='trial',v=>v.request.submitted_at='bad',v=>v.request.order_id=key,v=>v.request.status='submitted',v=>v.request.status='provisioned']){
    const value=envelope();modify(value);assert.throws(()=>parseSupplierRequestEnvelope(value,'qa-only'),SupplierRequestError);
  }
  assert.throws(()=>parseSupplierRequestEnvelope(envelope(),'qa-only',key));
  const parsed=parseSupplierRequestEnvelope(envelope({request:{...item(),internalFingerprint:'private'}}),'qa-only');
  assert.equal(parsed.request.internalFingerprint,undefined);
});

test('bounded lists distinguish unavailable, tenant mismatch and duplicate rows from a confirmed empty inbox',()=>{
  assert.deepEqual(parseSupplierRequestList(list({items:[],count:0}),'qa-only'),{items:[],truncated:false});
  for(const patch of [{items:null},{count:2},{truncated:null},{items:[item(),item()],count:2},{items:[item({tenant_id:key})],count:1},{items:Array(101).fill(item()),count:101}])assert.throws(()=>parseSupplierRequestList(list(patch),'qa-only'));
  const scope={mode:'global',tenant_id:null,tenant_slug:null};
  assert.throws(()=>parseSupplierRequestList(list({scope}),''));
  const submitted=item({...complete,status:'submitted',submitted_at:'2026-09-23T12:01:00.000Z'});
  assert.equal(parseSupplierRequestList(list({scope,items:[submitted],truncated:true}),'').truncated,true);
});

test('existing dotted and long tenant slugs remain supported consistently with dashboard tenant policy',async()=>{
  for(const tenant of ['marca.ar','a'.repeat(81),'a'.repeat(128)]){
    let calls=0;
    await supplierRequestCall({tenant},async url=>{calls++;assert.equal(url,`/api/admin/supplier-requests?tenant=${tenant}`);return response(list({scope:{mode:'tenant',tenant_id:tenantId,tenant_slug:tenant},items:[item({tenant_slug:tenant})]}));});
    assert.equal(calls,1);
  }
});

test('writes send only selected command with stable key, original payload and bound tenant',async()=>{
  for(const action of ['create','patch','submit']){
    const cmd=command({action,...(action==='create'?{}:{id}),body:action==='submit'?{expected_revision:1}:action==='patch'?{...content,expected_revision:1}:content});
    const calls=[];
    const body=result({request:action==='submit'?item({...complete,status:'submitted',revision:2,submitted_at:'2026-09-23T12:01:00.000Z'}):item({revision:action==='create'?1:2}),receipt:{idempotency_key:key,action,revision:action==='create'?1:2}});
    const parsed=await supplierRequestCall({tenant:'qa-only',...(cmd.id?{id}:{}),command:cmd},async(url,init)=>{calls.push({url,init});return response(body);});
    assert.equal(calls.length,1);assert.equal(calls[0].init.method,action==='patch'?'PATCH':'POST');assert.equal(calls[0].init.headers['Idempotency-Key'],key);
    assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.cache,'no-store');assert.deepEqual(JSON.parse(calls[0].init.body),cmd.body);
    assert.equal(calls[0].url,`/api/admin/supplier-requests${cmd.id?'/'+id:''}${action==='submit'?'/submit':''}?tenant=qa-only`);assert.equal(parsed.receipt.action,action);
  }
  let count=0;for(const change of [{tenant:'foreign'},{id},{key:'bad'}])await assert.rejects(supplierRequestCall({tenant:'qa-only',command:command(change)},async()=>{count++;return response(result());}));assert.equal(count,0);
});

test('receipt revision belongs to the submitted command, while replay current may already be later',async()=>{
  const latest=item({...complete,title:'Título posterior',status:'submitted',revision:4,submitted_at:'2026-09-23T12:01:00.000Z'});
  const replay=await call(result({request:latest,idempotent_replay:true}));assert.equal(replay.request.revision,4);assert.equal(replay.receipt.revision,1);assert.equal(replay.request.title,'Título posterior');
  for(const patch of [{receipt:{idempotency_key:key,action:'create',revision:2},request:item({revision:2})},{receipt:{idempotency_key:id,action:'create',revision:1}},{receipt:{idempotency_key:key,action:'submit',revision:1}},{request:item({title:'Unreviewed different text'})},{receipt:null},{idempotent_replay:null}])await assert.rejects(call(result(patch)),error=>error.uncertain===true&&error.code==='contract_invalid');
  const cmd=command({action:'patch',id,body:{...content,expected_revision:4}});
  await assert.rejects(call(result({request:item({revision:6}),receipt:{idempotency_key:key,action:'patch',revision:6}}),{},cmd),error=>error.uncertain);
});

test('transport uncertainty never becomes rejection or success, and repeat calls preserve operation identity',async()=>{
  for(const [status,body] of [[503,{ok:false,reason:'unavailable'}],[408,{ok:false,reason:'timeout'}],[400,{ok:true}],[200,{ok:true}]])await assert.rejects(call(body,{status}),error=>error.uncertain);
  for(const mode of ['demo','fallback',''])await assert.rejects(call(result(),{mode}),error=>error.uncertain);
  for(const status of [400,401,403,409])await assert.rejects(call({ok:false,reason:'synthetic_rejection'},{status}),error=>error.status===status&&!error.uncertain);
  const sent=[];const cmd=command();let attempt=0;
  const fetcher=async(url,init)=>{sent.push([url,init.headers['Idempotency-Key'],init.body]);if(++attempt===1)throw Error('PRIVATE_PROVIDER_DETAIL');return response(result({idempotent_replay:true}));};
  await assert.rejects(supplierRequestCall({tenant:'qa-only',command:cmd},fetcher),error=>error.uncertain&&!error.message.includes('PRIVATE'));
  assert.equal((await supplierRequestCall({tenant:'qa-only',command:cmd},fetcher)).idempotent_replay,true);assert.deepEqual(sent[0],sent[1]);
});

test('aborted reads are unavailable and aborted writes remain uncertain',async()=>{
  for(const write of [false,true]){
    const controller=new AbortController();controller.abort();
    await assert.rejects(supplierRequestCall({tenant:'qa-only',signal:controller.signal,...(write?{command:command()}:{})},async(url,init)=>{assert.equal(init.signal.aborted,true);throw new DOMException('aborted','AbortError');}),error=>error.uncertain===write);
  }
});

test('a bounded fifty-row inbox accepts valid Unicode notes without becoming a false unavailable result',async()=>{
  const items=Array.from({length:50},(_,index)=>item({id:`40000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,notes:'ñ'.repeat(4000)}));
  const body=list({items,count:items.length,truncated:true});assert.ok(new TextEncoder().encode(JSON.stringify(body)).byteLength>256*1024);
  const parsed=await supplierRequestCall({tenant:'qa-only'},async()=>response(body));assert.equal(parsed.items.length,50);assert.equal(parsed.truncated,true);
});
