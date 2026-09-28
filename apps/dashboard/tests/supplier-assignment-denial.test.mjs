import assert from 'node:assert/strict';
import test from 'node:test';
import { supplierAssignmentCall } from '../src/lib/supplier-request-assignment-client.ts';

const binding = { tenant:'qa-only', tenantId:'10000000-0000-4000-8000-000000000001', id:'40000000-0000-4000-8000-000000000001' };
const command = { tenant:binding.tenant, id:binding.id, key:'50000000-0000-4000-8000-000000000001', body:{operator_id:'20000000-0000-4000-8000-000000000001',expected_revision:1,expected_request_revision:3} };
for (const status of [401,403,404]) {
  test(`denied assignment GET ${status} does not wait for a stalled error body`,async()=>{
    let cancelled=false,calls=0;
    const body=new ReadableStream({cancel(){cancelled=true;}});
    await assert.rejects(supplierAssignmentCall(binding,async(url,init)=>{
      calls++;assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');
      assert.equal(init.credentials,'same-origin');assert.ok(url.endsWith('?tenant=qa-only'));
      return new Response(body,{status});
    }),e=>e.status===status && e.code==='supplier_assignment_read_denied' && !e.uncertain);
    assert.equal(cancelled,true);assert.equal(calls,1);
  });
  test(`denied assignment GET ${status} does not depend on JSON or production headers`,async()=>{
    for(const body of ['<html>Private provider detail</html>','not-json','']) {
      await assert.rejects(supplierAssignmentCall(binding,async()=>new Response(body,{status})),e=>e.status===status && !e.uncertain && !e.message.includes('Private'));
    }
  });
  test(`denied assignment history GET ${status} preserves record-level status without writing`,async()=>{
    await assert.rejects(supplierAssignmentCall({...binding,beforeRevision:3},async(url,init)=>{
      assert.ok(url.endsWith('&before_revision=3'));assert.equal(init.method,'GET');assert.equal(init.body,undefined);
      return new Response(null,{status});
    }),e=>e.status===status && !e.uncertain);
  });
  test(`assignment POST ${status} is never reclassified as a denied read`,async()=>{
    const calls=[];
    await assert.rejects(supplierAssignmentCall({...binding,command},async(url,init)=>{
      calls.push(init);return new Response('unconfirmed write',{status});
    }),e=>e.status===status && e.uncertain && e.code!=='supplier_assignment_read_denied');
    assert.equal(calls.length,1);assert.equal(calls[0].headers['Idempotency-Key'],command.key);
    assert.deepEqual(JSON.parse(calls[0].body),command.body);
    await assert.rejects(supplierAssignmentCall({...binding,command},async()=>Response.json({ok:false,reason:'synthetic_rejected'},{status})),e=>e.status===status && !e.uncertain && e.code==='synthetic_rejected');
  });
}
