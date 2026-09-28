import assert from 'node:assert/strict';
import test from 'node:test';
import { supplierRequestReviewCall } from '../src/lib/supplier-request-review-client.ts';

const binding = { tenant:'qa-only', tenantId:'10000000-0000-4000-8000-000000000001', id:'40000000-0000-4000-8000-000000000001' };
const command = { tenant:binding.tenant, id:binding.id, key:'50000000-0000-4000-8000-000000000001', body:{action:'respond',message:'Synthetic answer',expected_revision:1,expected_request_revision:3} };
for (const status of [401,403,404]) {
  test(`denied review GET ${status} does not wait for a stalled error body`,async()=>{
    let cancelled=false,calls=0;
    const body=new ReadableStream({cancel(){cancelled=true;}});
    await assert.rejects(supplierRequestReviewCall(binding,async(url,init)=>{
      calls++;assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');
      assert.equal(init.credentials,'same-origin');assert.ok(url.endsWith('?tenant=qa-only'));
      return new Response(body,{status});
    }),e=>e.status===status && e.code==='supplier_request_read_denied' && !e.uncertain);
    assert.equal(cancelled,true);assert.equal(calls,1);
  });
  test(`denied review GET ${status} does not depend on JSON or production headers`,async()=>{
    for(const body of ['<html>Private provider detail</html>','not-json','']) {
      await assert.rejects(supplierRequestReviewCall(binding,async()=>new Response(body,{status})),e=>e.status===status && !e.uncertain && !e.message.includes('Private'));
    }
  });
  test(`denied history GET ${status} preserves record-level status without writing`,async()=>{
    await assert.rejects(supplierRequestReviewCall({...binding,beforeRevision:3},async(url,init)=>{
      assert.ok(url.endsWith('&before_revision=3'));assert.equal(init.method,'GET');assert.equal(init.body,undefined);
      return new Response(null,{status});
    }),e=>e.status===status && !e.uncertain);
  });
  test(`review POST ${status} is never reclassified as a denied read`,async()=>{
    const calls=[];
    await assert.rejects(supplierRequestReviewCall({...binding,command},async(url,init)=>{
      calls.push(init);return new Response('unconfirmed write',{status});
    }),e=>e.status===status && e.uncertain && e.code!=='supplier_request_read_denied');
    assert.equal(calls.length,1);assert.equal(calls[0].headers['Idempotency-Key'],command.key);
    assert.deepEqual(JSON.parse(calls[0].body),command.body);
    await assert.rejects(supplierRequestReviewCall({...binding,command},async()=>Response.json({ok:false,reason:'synthetic_rejected'},{status})),e=>e.status===status && !e.uncertain && e.code==='synthetic_rejected');
  });
}
test('review transport still rejects a successful foreign-scope envelope',async()=>{
  const data={ok:true,protocol:'nexid.supplier-request-review.v1',scope:{mode:'tenant',tenant_id:binding.tenantId,tenant_slug:'other'},request_id:binding.id,request_revision:3,review:{state:'pending',revision:0,updated_at:null},history:[],count:0,truncated:false,next_before_revision:null};
  await assert.rejects(supplierRequestReviewCall(binding,async()=>Response.json(data,{headers:{'x-nexid-data-mode':'production'}})),e=>e.code==='contract_invalid' && !e.uncertain);
});
