import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {logisticsItems,logisticsRequestIdentity,logisticsOperationKey,logisticsFailure,logisticsUuid} from '../src/lib/logistics-operation-policy.ts';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';
import {createShipment,processSealScan} from '../src/lib/secure-delivery.ts';
const source=p=>readFile(new URL(p,import.meta.url),'utf8');
const tenant='10000000-0000-4000-8000-000000000001';
test('items reject silently coerced, fractional, missing and excessive quantities',()=>{
  for(const quantity of [undefined,0,-1,NaN,Infinity,1.2,'2',1000001])assert.throws(()=>logisticsItems([{productName:'Item',quantity}]));
  assert.deepEqual(logisticsItems([{productName:' Item ',quantity:2}]),[{productName:'Item',quantity:2}]);
  assert.throws(()=>logisticsItems(Array(201).fill({productName:'Item',quantity:1})));
});
test('idempotency keys are hashed, stable when provided, and explicitly optional for legacy clients',()=>{
  const a=logisticsRequestIdentity('test-operation-1'),b=logisticsRequestIdentity('test-operation-1');assert.equal(a.keyHash,b.keyHash);assert.equal(a.provided,true);assert.match(a.keyHash,/^[a-f0-9]{64}$/);assert.equal(logisticsRequestIdentity().provided,false);assert.throws(()=>logisticsRequestIdentity('bad key'));
});
test('conflicting body and header operation identity cannot be silently ignored',()=>{
  const req=new Request('http://localhost/',{headers:{'Idempotency-Key':'test-operation-1'}});
  assert.equal(logisticsOperationKey(req,{operation_key:'test-operation-1'}),'test-operation-1');assert.throws(()=>logisticsOperationKey(req,{operation_key:'other-operation'}));
});
test('safe errors never publish raw SQL or credentials',()=>{
  assert.equal(logisticsFailure(new Error('password=private SELECT * FROM secret')).status,503);
  assert.equal(logisticsFailure(new SyntaxError('unexpected token')).status,400);
  assert.deepEqual(logisticsFailure(Object.assign(new Error('unknown function details'),{code:'42883'})),{reason:'logistics_migration_required',status:503});
  assert.throws(()=>logisticsUuid('not-a-uuid'));
});
test('service wrappers use exactly one parameterized business statement per operation',async()=>{
  const calls=[];
  const undo=installEphemeralE2eSqlExecutor(async(strings,...values)=>{calls.push({sql:strings.join('?'),values});return [{result:{ok:true,replayed:false,receiptId:'20000000-0000-4000-8000-000000000001',data:{id:'30000000-0000-4000-8000-000000000001',tenantId:tenant,status:'draft'}}}];},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:local-fixture@127.0.0.1/nexid_e2e_logistics'});
  try{
    const r=await createShipment({tenantId:tenant,actorScope:'test:actor',operationKey:'test-operation',items:[{productName:'item',quantity:1}]});
    assert.equal(calls.length,1);assert.match(calls[0].sql,/nexid_logistics_commit_v1/);assert.equal(r.protocol,'nexid.logistics.v1');assert.equal(r.idempotencyProvided,true);
    await processSealScan({uidHex:'04000000000001',tenantId:tenant,ttRaw:null,shipmentId:'30000000-0000-4000-8000-000000000001',context:'APPLY',operationKey:'test-operation-two'});
    assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1].values[3]).ttRaw,'');
    assert.equal(JSON.parse(calls[1].values[3]).verificationMethod,'OPERATOR_DECLARATION');
  }finally{undo();}
});
test('all logistics callers route writes through the atomic service, without independent recipient inserts',async()=>{
  const admin=await source('../src/app/admin/logistics/scan/route.ts'),shared=await source('../src/app/api/v1/logistics/_atomic.ts');
  assert.match(admin,/checkAdminPermission\(req,"logistics:write"\)/);
  for(const code of [admin,shared]){assert.match(code,/processSealScan/);assert.match(code,/readBoundedJsonBody/);assert.doesNotMatch(code,/INSERT INTO recipient_verifications|INSERT INTO delivery_claims/);}
  for(const [route,context] of [['seal-apply','APPLY'],['handoff','HANDOFF'],['recipient-verify','VERIFY']])assert.match(await source(`../src/app/api/v1/logistics/${route}/route.ts`),new RegExp(`executeLogisticsScan\\(req,"${context}"`));
});
test('shipment quantities aggregate independent of seals or handling-event multiplicity',async()=>{
  const route=await source('../src/app/admin/logistics/shipments/route.ts');
  assert.match(route,/SELECT coalesce\(sum\(i.quantity\),0\)::int FROM shipment_items i WHERE i.shipment_id=s.id/);
  assert.doesNotMatch(route,/LEFT JOIN shipment_items|SUM\(si_item.quantity\)/);
});
test('transaction receipt is inserted after domain mutations; anonymous execution is not granted',async()=>{
  const sql=await source('../db/migrations/20260918050000_0103_logistics_atomic_operations.sql');
  assert.match(sql,/SECURITY INVOKER/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/FOR UPDATE/);
  assert.ok(sql.lastIndexOf('INSERT INTO public.logistics_operation_receipts')>sql.lastIndexOf('INSERT INTO public.recipient_verifications'));
  assert.match(sql,/REVOKE ALL ON FUNCTION public.nexid_logistics_commit_v1/);
});
