import assert from 'node:assert/strict';
import test from 'node:test';
import {join} from 'node:path';
import {parseReceiptCsv,receiptOperation,API_ORIGIN} from '../src/receipts.mjs';
import {Ledger} from '../src/ledger.mjs';
import {createClient,drain,doctor} from '../src/connector.mjs';
import {TENANT,BID,CSV,apiFixture,temporary} from './helpers.mjs';
const operations=()=>parseReceiptCsv(CSV).map(r=>receiptOperation(TENANT,'erp-main',r));
const binding=origin=>({tenant:TENANT,connector:'erp-main',origin});
const transport=origin=>createClient({tenant:TENANT,apiKey:'local-test-credential-not-live',origin,localTest:true});
test('CSV header, identifiers, calendar dates and duplicates fail before queue or network',()=>{
  assert.equal(parseReceiptCsv(CSV)[0].occurredAt,'2026-09-18T12:00:00.000Z');
  assert.equal(parseReceiptCsv('\uFEFF'+CSV.replaceAll('\n','\r\n')).length,1);
  assert.equal(parseReceiptCsv(CSV.replace('LOCAL-RECEIPT-1','"LOCAL-RECEIPT-1"')).length,1);
  for(const text of [CSV.replace('external_id','secret'),CSV.replace('2026-09-18','2026-02-30'),CSV.replace('WAREHOUSE-1','https://example.invalid/key'),CSV+CSV.split('\n')[1]+'\n'])assert.throws(()=>parseReceiptCsv(text));
});
test('the same business ID is stable across restarts but modified data is not silently accepted',()=>{
  const path=join(temporary(),'queue.sqlite');let ledger=new Ledger(path,binding(API_ORIGIN));assert.equal(ledger.plan(operations()).added,1);ledger.close();
  ledger=new Ledger(path,binding(API_ORIGIN));assert.equal(ledger.plan(operations()).alreadyPresent,1);
  const other=operations();other[0]=receiptOperation(TENANT,'erp-main',{...parseReceiptCsv(CSV)[0],facility:'OTHER'});assert.equal(other[0].key,operations()[0].key);assert.throws(()=>ledger.plan(other),/business_id_payload_conflict/);ledger.close();
});
test('plan transaction is all-or-nothing and state cannot switch tenant or origin',()=>{
  const path=join(temporary(),'queue.sqlite'),ledger=new Ledger(path,binding(API_ORIGIN));ledger.plan(operations());
  const fresh=receiptOperation(TENANT,'erp-main',{...parseReceiptCsv(CSV)[0],externalId:'NEW'}),bad={...operations()[0],digest:'changed'};assert.throws(()=>ledger.plan([fresh,bad]));assert.equal(ledger.summary().jobs.length,1);ledger.close();
  assert.throws(()=>new Ledger(path,{...binding(API_ORIGIN),tenant:'another-company'}),/another_scope/);
});
test('send requires exact tenant confirmation and bounded batch size',async()=>{
  const ledger=new Ledger(':memory:',binding(API_ORIGIN));ledger.plan(operations());
  await assert.rejects(()=>drain(ledger,{},{}),/confirmation/);await assert.rejects(()=>drain(ledger,{},{confirmTenant:TENANT,limit:101}),/limit/);assert.equal(ledger.summary().jobs[0].attempts,0);ledger.close();
});
test('lost HTTP response, restart and replay reconcile one server event without sending twice',async t=>{
  const api=await apiFixture(t),tr=transport(api.origin),path=join(api.dir,'queue.sqlite');let ledger=new Ledger(path,binding(api.origin));ledger.plan(operations());api.mode.lost=true;
  const first=await drain(ledger,tr.client,{confirmTenant:TENANT});assert.equal(first.jobs[0].state,'uncertain');assert.equal(api.mode.posts,1);ledger.close();
  ledger=new Ledger(path,binding(api.origin));const second=await drain(ledger,tr.client,{confirmTenant:TENANT});assert.equal(second.jobs[0].state,'committed');assert.equal(api.mode.posts,1);assert.equal(api.db.prepare('SELECT count(*) n FROM receipts').get().n,1);
  const before=tr.requestCount;await drain(ledger,tr.client,{confirmTenant:TENANT});assert.equal(tr.requestCount,before);ledger.close();
});
test('two workers cannot claim the same local queue lease',async t=>{
  const api=await apiFixture(t),path=join(api.dir,'queue.sqlite'),one=new Ledger(path,binding(api.origin)),two=new Ledger(path,binding(api.origin));one.plan(operations());const token=one.acquire();await assert.rejects(()=>drain(two,transport(api.origin).client,{confirmTenant:TENANT}),/worker_already_running/);assert.equal(api.mode.posts,0);one.release(token);one.close();two.close();
});
test('expired absent server key blocks resending instead of risking duplicates',async t=>{
  const api=await apiFixture(t);let now=Date.now();const ledger=new Ledger(':memory:',binding(api.origin),()=>now);ledger.plan(operations());const token=ledger.acquire();ledger.attempt(operations()[0].key,token);ledger.release(token);now+=7*86400000;
  const result=await drain(ledger,transport(api.origin).client,{confirmTenant:TENANT});assert.equal(result.jobs[0].state,'manual_review');assert.equal(api.mode.posts,0);ledger.close();
});
test('a processing server operation is not replayed as a new mutation',async t=>{
  const api=await apiFixture(t),ledger=new Ledger(':memory:',binding(api.origin));ledger.plan(operations());api.mode.lost=true;const tr=transport(api.origin);await drain(ledger,tr.client,{confirmTenant:TENANT});api.mode.processing=true;await drain(ledger,tr.client,{confirmTenant:TENANT});assert.equal(api.mode.posts,1);assert.equal(ledger.summary().jobs[0].state,'uncertain');ledger.close();
});
test('invalid or wrong-tenant receipt never marks work committed',async t=>{
  const api=await apiFixture(t),ledger=new Ledger(':memory:',binding(api.origin));ledger.plan(operations());api.mode.wrongTenant=true;await drain(ledger,transport(api.origin).client,{confirmTenant:TENANT});assert.equal(ledger.summary().jobs[0].state,'uncertain');ledger.close();
});
test('doctor is a single scoped product read and cannot prove write permission',async t=>{
  const api=await apiFixture(t),tr=transport(api.origin);const result=await doctor(tr.client,TENANT,BID);assert.equal(result.otherScopes,'not_tested');assert.equal(result.writesPerformed,0);assert.equal(api.mode.posts,0);assert.equal(tr.requestCount,1);api.mode.wrongTenant=true;await assert.rejects(()=>doctor(tr.client,TENANT,BID),/scope_mismatch/);
});
test('key transport rejects unapproved destinations and redirects',async t=>{
  assert.throws(()=>createClient({tenant:TENANT,apiKey:'private-api-credential',origin:'https://wrong.invalid'}),/unapproved_api_origin/);
  const api=await apiFixture(t);api.mode.redirect=true;await assert.rejects(()=>doctor(transport(api.origin).client,TENANT,BID));
});
