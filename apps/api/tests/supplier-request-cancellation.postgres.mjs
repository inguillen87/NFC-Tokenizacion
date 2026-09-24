import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function runCancellationTests(t,c){
 const {schema,observer,first,second,tenantA,tenantB,actorA,actorB,sessionA,sessionB,globalActor,globalSession,operatorA,operatorB,operatorSessionA,prepared,command,mutate,read,counts,graphCounts,assignCommand,assign,assignedRead,assignedList,assignmentRead,technical,convert,reviewCommand,reviewWrite,reviewRead,waitForLock,settle}=c;
 const payload=(request,patch={})=>({tenant_id:tenantA,actor_id:actorA,auth_session_id:sessionA,request_id:request.id,idempotency_key:randomUUID(),expected_revision:request.revision,expected_review_revision:request.review_summary?.revision||0,reason:'El proyecto cambió de alcance.',...patch});
 const cancel=async(input,client=observer)=>(await client.query(`SELECT ${schema}.nexid_cancel_supplier_request_v1($1::jsonb) AS result`,[JSON.stringify(input)])).rows[0].result;
 await t.test('cancellation is terminal, audited, replayable, and never creates a technical graph',async()=>{
  const request=await prepared(),graph=await graphCounts();await assign(assignCommand(request));
  const input=payload(request),result=await cancel(input);assert.equal(result.ok,true);assert.equal(result.request.status,'cancelled');assert.equal(result.request.revision,request.revision+1);
  assert.equal(result.request.cancellation_reason,input.reason);assert.equal(result.request.cancelled_by,actorA);assert.equal(result.request.cancelled_at,result.request.updated_at);
  assert.deepEqual(await counts(request.id),{operations:3,audits:4});assert.deepEqual(await graphCounts(),graph);
  const again=await cancel(input);assert.equal(again.idempotent_replay,true);assert.deepEqual(again.receipt,result.receipt);assert.deepEqual(await counts(request.id),{operations:3,audits:4});
  assert.equal(await assignedRead(request.id),null);assert.ok(!(await assignedList()).items.some(r=>r.id===request.id));assert.equal((await assignmentRead(request)).assignment.operator_id,operatorA);
  await assert.rejects(convert(result.request),/supplier_request_not_submitted/);assert.equal((await reviewWrite(reviewCommand(result.request))).reason,'supplier_request_not_submitted');
  assert.equal((await assign(assignCommand(result.request,1,{operator_id:operatorB}))).reason,'supplier_request_not_submitted');
  for(const sql of ["UPDATE supplier_requests SET status='submitted',revision=revision+1 WHERE id=$1","UPDATE supplier_requests SET cancellation_reason='overwrite',revision=revision+1 WHERE id=$1"])await assert.rejects(observer.query(sql,[request.id]),/supplier_request_immutable/);
 });
 await t.test('cancellation rejects drafts and prepared technical orders without reversing their state',async()=>{
  const draft=(await mutate(command())).request;assert.equal((await cancel(payload(draft))).reason,'supplier_request_cancellation_not_submitted');
  const request=await prepared();await convert(request);const current=await read(request.id),graph=await graphCounts();
  assert.equal((await cancel(payload(current))).reason,'supplier_request_cancellation_not_submitted');assert.deepEqual(await graphCounts(),graph);assert.deepEqual(await read(request.id),current);
 });
 await t.test('request and clarification revisions are checked and cancelled history remains readable',async()=>{
  const request=await prepared();await reviewWrite(reviewCommand(request));assert.equal((await cancel(payload(request))).reason,'supplier_request_review_revision_conflict');
  assert.equal((await cancel(payload(request,{expected_revision:1,expected_review_revision:1}))).reason,'supplier_request_revision_conflict');
  const result=await cancel(payload(request,{expected_review_revision:1}));assert.equal(result.ok,true);const history=await reviewRead(request.id);assert.equal(history.history.length,1);assert.equal(history.request_revision,result.request.revision);
  const {supplierRequestFromRow}=await import('../src/lib/supplier-request-contract.ts');assert.equal(supplierRequestFromRow(await read(request.id)).status,'cancelled');
 });
 await t.test('cancellation identity cannot collide with creation or change reason, revision, actor or request',async()=>{
  const request=await prepared(),input=payload(request);const old=(await observer.query("SELECT idempotency_key FROM supplier_request_operations WHERE request_id=$1 AND action='create'",[request.id])).rows[0].idempotency_key;
  assert.equal((await cancel({...input,idempotency_key:old})).reason,'supplier_request_idempotency_conflict');await cancel(input);
  for(const patch of [{reason:'Otro motivo.'},{expected_revision:1},{expected_review_revision:1},{actor_id:actorB,auth_session_id:sessionB}])assert.equal((await cancel({...input,...patch})).reason,'supplier_request_idempotency_conflict');
  assert.equal((await cancel({...input,request_id:(await prepared()).id})).reason,'supplier_request_idempotency_conflict');
 });
 await t.test('live tenant authority, session revocation and explicit denies are checked before replay',async()=>{
  const request=await prepared(),input=payload(request);
  assert.equal((await cancel({...input,tenant_id:tenantB})).reason,'supplier_request_scope_forbidden');assert.equal((await cancel({...input,actor_id:operatorA,auth_session_id:operatorSessionA})).reason,'supplier_request_scope_forbidden');
  assert.equal((await cancel({...input,auth_session_id:sessionB})).reason,'supplier_request_scope_forbidden');await cancel(input);
  await observer.query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1',[sessionA]);try{assert.equal((await cancel(input)).reason,'supplier_request_scope_forbidden');}finally{await observer.query('UPDATE auth_sessions SET revoked_at=NULL WHERE id=$1',[sessionA]);}
  await observer.query("INSERT INTO resource_permissions VALUES($1,$2,'supplier_orders','write','deny')",[actorA,tenantA]);try{assert.equal((await cancel(input)).reason,'supplier_request_scope_forbidden');}finally{await observer.query('DELETE FROM resource_permissions WHERE user_id=$1',[actorA]);}
  const other=await prepared();assert.equal((await cancel(payload(other,{actor_id:globalActor,auth_session_id:globalSession}))).ok,true);
 });
 await t.test('PostgreSQL rejects secret-like reasons, controls, wrong types and extra mutation fields',async()=>{
  const request=await prepared();for(const reason of ['', ' ', 'x'.repeat(2001),'bad\u0001text','api_key=synthetic-confidential-value','PACK_PASSWORD','https://user:password@example.invalid'])await assert.rejects(cancel(payload(request,{reason})),/supplier_request_cancellation_input_invalid/);
  for(const patch of [{expected_revision:'2'},{expected_review_revision:-1},{expected_review_revision:2147483647},{reason:null},{extra:'not allowed'}])await assert.rejects(cancel(payload(request,patch)),/supplier_request_cancellation_input_invalid/);assert.equal((await read(request.id)).status,'submitted');
 });
 await t.test('receipt or audit failure atomically rolls back cancellation and allows the original command after recovery',async()=>{
  const request=await prepared(),input=payload(request),before=await counts(request.id);
  for(const [table,predicate]of[['audit_logs',"action<>'supplier_request_cancelled'"],['supplier_request_operations',"action<>'cancel'"]]){
   await observer.query(`ALTER TABLE ${table} ADD CONSTRAINT injected_cancel_failure CHECK(${predicate}) NOT VALID`);try{await assert.rejects(cancel(input),error=>error.code==='23514');}finally{await observer.query(`ALTER TABLE ${table} DROP CONSTRAINT injected_cancel_failure`);}
   assert.equal((await read(request.id)).status,'submitted');assert.deepEqual(await counts(request.id),before);
  }assert.equal((await cancel(input)).ok,true);
 });
 await t.test('direct cancellation without a matching audit and receipt is rejected at commit',async()=>{
  const request=await prepared();await assert.rejects(observer.query("UPDATE supplier_requests SET status='cancelled',revision=revision+1,updated_by=$2,cancelled_by=$2,cancellation_reason='forged',updated_at=now(),cancelled_at=now() WHERE id=$1",[request.id,actorA]),/supplier_request_cancellation_receipt_required/);assert.equal((await read(request.id)).status,'submitted');
 });
 await t.test('concurrent retries commit one cancellation and another operation cannot replace its reason',async()=>{
  const request=await prepared(),input=payload(request);await first.query('BEGIN');await cancel(input,first);const pending=settle(cancel(input,second));try{await waitForLock(second);}finally{await first.query('COMMIT');}
  const replay=await pending;assert.ifError(replay.error);assert.equal(replay.value.idempotent_replay,true);assert.equal((await cancel({...input,idempotency_key:randomUUID(),reason:'different'})).reason,'supplier_request_cancellation_not_submitted');assert.deepEqual(await counts(request.id),{operations:3,audits:3});
 });
 await t.test('cancellation and conversion serialize in both orders and never reverse a prepared order',async()=>{
  const request=await prepared(),before=await graphCounts();await first.query('BEGIN');await cancel(payload(request),first);const converting=settle(convert(request,technical(request),second));try{await waitForLock(second);}finally{await first.query('COMMIT');}
  assert.match((await converting).error?.message||'',/supplier_request_not_submitted/);assert.deepEqual(await graphCounts(),before);
  const next=await prepared();await first.query('BEGIN');const order=await convert(next,technical(next),first);const cancelling=settle(cancel(payload(next),second));try{await waitForLock(second);}finally{await first.query('COMMIT');}
  const refused=await cancelling;assert.ifError(refused.error);assert.equal(refused.value.reason,'supplier_request_cancellation_not_submitted');assert.equal((await read(next.id)).order_id,order.supplier_order.id);
 });
 await t.test('a winning clarification requires cancellation to reread; a winning cancellation rejects late clarification',async()=>{
  const request=await prepared();await first.query('BEGIN');await reviewWrite(reviewCommand(request),first);const pending=settle(cancel(payload(request),second));try{await waitForLock(second);}finally{await first.query('COMMIT');}
  const refusal=await pending;assert.ifError(refusal.error);assert.equal(refusal.value.reason,'supplier_request_review_revision_conflict');assert.equal((await read(request.id)).status,'submitted');
  const next=await prepared();await first.query('BEGIN');await cancel(payload(next),first);const question=settle(reviewWrite(reviewCommand(next),second));try{await waitForLock(second);}finally{await first.query('COMMIT');}
  const rejected=await question;assert.ifError(rejected.error);assert.equal(rejected.value.reason,'supplier_request_not_submitted');
 });
 await t.test('same-superadmin assignment and cancellation preserve authority-before-request lock order',async()=>{
  const request=await prepared();await first.query('BEGIN');await first.query(`SELECT ${schema}.nexid_supplier_request_assignment_actor_v1($1,$2)`,[globalActor,globalSession]);
  const pending=settle(cancel(payload(request,{actor_id:globalActor,auth_session_id:globalSession}),second));await waitForLock(second);
  try{assert.equal((await assign(assignCommand(request),first)).ok,true);}finally{await first.query('COMMIT');}
  const result=await pending;assert.ifError(result.error);assert.equal(result.value.ok,true);
 });
 await t.test('actual permission triggers serialize revocation before cancellation; new functions grant no PUBLIC execution',async()=>{
  const request=await prepared();await first.query('BEGIN');await first.query("INSERT INTO resource_permissions VALUES($1,$2,'supplier_orders','write','deny')",[actorA,tenantA]);const pending=settle(cancel(payload(request),second));try{await waitForLock(second);}finally{await first.query('COMMIT');}
  try{const denied=await pending;assert.ifError(denied.error);assert.equal(denied.value.reason,'supplier_request_scope_forbidden');}finally{await observer.query('DELETE FROM resource_permissions WHERE user_id=$1',[actorA]);}
  const fn=(await observer.query(`SELECT prosecdef,proacl FROM pg_proc WHERE oid='${schema}.nexid_cancel_supplier_request_v1(jsonb)'::regprocedure`)).rows[0];assert.equal(fn.prosecdef,false);assert.doesNotMatch(JSON.stringify(fn.proacl),/"=/);
 });
}
