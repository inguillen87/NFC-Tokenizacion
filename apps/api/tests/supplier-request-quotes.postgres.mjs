import assert from 'node:assert/strict';
import {randomUUID}from'node:crypto';
import {parseQuoteState}from'../src/lib/supplier-quote-policy.ts';
export async function runQuotePostgresTests(t,c){
 const {schema,observer,first,second,tenantA,tenantB,actorA,actorB,sessionA,sessionB,globalActor,globalSession,operatorA,operatorSessionA,prepared,command,mutate,read,graphCounts,technical,convert,reviewCommand,reviewWrite,reviewRead,waitForLock,settle}=c;
 const offer=(patch={})=>({currency:'USD',net_minor:10001,tax_minor:2100,shipping_minor:499,conditions:'Entrega cotizada para el alcance indicado. Importes ingresados manualmente.',valid_until:new Date(Date.now()+86400000).toISOString(),...patch});
 const cmd=(request,action='issue',patch={})=>({tenant_id:tenantA,actor_id:['issue','withdraw'].includes(action)?globalActor:actorA,auth_session_id:['issue','withdraw'].includes(action)?globalSession:sessionA,request_id:request.id,idempotency_key:randomUUID(),action,expected_revision:request.quotation_revision||0,expected_request_revision:request.revision,expected_review_revision:request.review_summary?.revision||0,offer:action==='issue'?offer():null,reason:action==='accept'?'':'Motivo comercial informado.',...patch});
 const writeQuote=async(input,client=observer)=>(await client.query(`SELECT ${schema}.nexid_mutate_supplier_quote_v1($1::jsonb) AS result`,[JSON.stringify(input)])).rows[0].result;
 const readQuote=async(id,before=null,actor=actorA,session=sessionA,tenant=tenantA,client=observer)=>(await client.query(`SELECT ${schema}.nexid_supplier_quote_read_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::integer) AS result`,[id,tenant,actor,session,before])).rows[0].result;
 const counts=async id=>(await observer.query("SELECT (SELECT count(*)::int FROM supplier_request_quote_events WHERE request_id=$1) events,(SELECT count(*)::int FROM audit_logs WHERE resource_type='supplier_request_quote' AND resource_id=$1::text) audits",[id])).rows[0];
 await t.test('quote publishes exact integer amounts, bumps request revision, retains business data and creates no order',async()=>{
  const request=await prepared(),input=cmd(request),graph=await graphCounts();const result=await writeQuote(input);assert.equal(result.ok,true);assert.equal(result.current.total_minor,12600);assert.equal(result.current.net_minor,10001);assert.equal(result.current.quote_version,1);assert.equal(result.revision,1);assert.equal(result.request.revision,request.revision+1);assert.equal(result.request.quotation_revision,1);
  for(const field of ['title','construction_id','quantity','pack_purpose','notes','submitted_at','submitted_by'])assert.deepEqual(result.request[field],request[field]);assert.deepEqual(await graphCounts(),graph);assert.deepEqual(await counts(request.id),{events:1,audits:1});
  const wire=parseQuoteState(result,result.request.revision,1);assert.equal(wire.current.state,'offered');assert.doesNotMatch(JSON.stringify(await readQuote(request.id)),/fingerprint|auth_session|idempotency_key|audit_id/);
 });
 await t.test('company explicitly accepts exact offer; accepted quote cannot be overwritten, and preparation is still separate',async()=>{
  const initial=await writeQuote(cmd(await prepared())),graph=await graphCounts();await assert.rejects(convert(initial.request),/supplier_request_quote_acceptance_required/);assert.deepEqual(await graphCounts(),graph);
  const input=cmd(initial.request,'accept'),accepted=await writeQuote(input);assert.equal(accepted.current.state,'accepted');assert.equal(accepted.current.quote_version,1);assert.equal(accepted.current.total_minor,initial.current.total_minor);assert.equal(accepted.request.order_id,null);assert.deepEqual(await graphCounts(),graph);
  assert.equal((await writeQuote(cmd(accepted.request))).reason,'supplier_quote_transition_invalid');assert.equal((await writeQuote(cmd(accepted.request,'reject'))).reason,'supplier_quote_transition_invalid');
  const order=await convert(accepted.request);assert.ok(order.supplier_order.id);const replay=await writeQuote(input);assert.equal(replay.idempotent_replay,true);assert.equal(replay.request.status,'provisioned');assert.equal(replay.receipt.revision,2);assert.equal(replay.request.revision,accepted.request.revision+1);
 });
 await t.test('rejection and withdrawal retain history; new issuer offer increments version and changes no former terms',async()=>{
  const first=await writeQuote(cmd(await prepared())),old=structuredClone(first.current);const rejected=await writeQuote(cmd(first.request,'reject'));assert.equal(rejected.current.state,'rejected');
  const second=await writeQuote(cmd(rejected.request,'issue',{offer:offer({currency:'ARS',net_minor:12345,tax_minor:0,shipping_minor:0})}));assert.equal(second.current.quote_version,2);assert.equal(second.current.total_minor,12345);assert.equal(second.history[0].currency,old.currency);assert.equal(second.history[0].total_minor,old.total_minor);
  const withdrawn=await writeQuote(cmd(second.request,'withdraw'));assert.equal(withdrawn.current.state,'withdrawn');assert.equal((await writeQuote(cmd(withdrawn.request,'accept'))).reason,'supplier_quote_transition_invalid');
 });
 await t.test('only NexID issues/withdraws; only the current company accepts/rejects; technician and cross-tenant stay denied',async()=>{
  const request=await prepared();for(const [action,actor_id,auth_session_id]of [['issue',actorA,sessionA],['withdraw',actorA,sessionA],['accept',globalActor,globalSession],['reject',globalActor,globalSession],['issue',operatorA,operatorSessionA],['accept',operatorA,operatorSessionA]])assert.equal((await writeQuote(cmd(request,action,{actor_id,auth_session_id}))).reason,'supplier_quote_scope_forbidden');
  assert.equal((await writeQuote(cmd(request,'accept',{tenant_id:tenantB}))).reason,'supplier_quote_scope_forbidden');assert.equal((await writeQuote(cmd(request,'issue',{tenant_id:tenantB}))).reason,'supplier_request_not_found');
  assert.equal((await readQuote(request.id,null,operatorA,operatorSessionA)).reason,'supplier_quote_scope_forbidden');assert.equal((await readQuote(request.id,null,actorA,sessionA,tenantB)).reason,'supplier_quote_scope_forbidden');assert.equal(await readQuote(randomUUID()),null);assert.deepEqual(await counts(request.id),{events:0,audits:0});
 });
 await t.test('auth revocation, explicit deny, membership and issuer identity are checked before saved-operation replay',async()=>{
  const input=cmd(await prepared());await writeQuote(input);await observer.query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1',[globalSession]);try{assert.equal((await writeQuote(input)).reason,'supplier_quote_scope_forbidden');}finally{await observer.query('UPDATE auth_sessions SET revoked_at=NULL WHERE id=$1',[globalSession]);}
  await observer.query("INSERT INTO resource_permissions VALUES($1,NULL,'supplier_orders','write','deny')",[globalActor]);try{assert.equal((await writeQuote(input)).reason,'supplier_quote_scope_forbidden');}finally{await observer.query('DELETE FROM resource_permissions WHERE user_id=$1',[globalActor]);}
  assert.equal((await writeQuote({...input,actor_id:actorA,auth_session_id:sessionA})).reason,'supplier_quote_scope_forbidden');assert.deepEqual(await counts(input.request_id),{events:1,audits:1});
 });
 await t.test('changed command or offer under the same operation key conflicts; an old issue receipt returns the newer quote safely',async()=>{
  const input=cmd(await prepared()),first=await writeQuote(input);
  for(const patch of [{reason:'Otro motivo'},{offer:offer({net_minor:1})},{expected_revision:1},{expected_request_revision:1},{expected_review_revision:1},{request_id:(await prepared()).id}])assert.equal((await writeQuote({...input,...patch})).reason,'supplier_quote_idempotency_conflict');
  const second=await writeQuote(cmd(first.request));const replay=await writeQuote(input);assert.equal(replay.idempotent_replay,true);assert.equal(replay.receipt.revision,1);assert.equal(replay.receipt.quote_version,1);assert.equal(replay.current.quote_version,2);assert.equal(replay.request.revision,second.request.revision);
 });
 await t.test('direct request bump without a quote/audit receipt and changes to immutable quote events are rejected',async()=>{
  const request=await prepared();await assert.rejects(observer.query(`UPDATE supplier_requests SET quotation_revision=quotation_revision+1,quotation_state='offered',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1`,[request.id]),/supplier_quote_receipt_required/);
  const issued=await writeQuote(cmd(request));for(const sql of ["UPDATE supplier_request_quote_events SET net_minor=1 WHERE request_id=$1","DELETE FROM supplier_request_quote_events WHERE request_id=$1"])await assert.rejects(observer.query(sql,[request.id]),/supplier_quote_append_only/);
  await assert.rejects(observer.query("UPDATE supplier_requests SET notes='forged',quotation_revision=quotation_revision+1,revision=revision+1 WHERE id=$1",[request.id]),/supplier_request_immutable/);assert.equal((await read(request.id)).notes,request.notes);assert.equal((await read(request.id)).revision,issued.request.revision);
 });
 await t.test('audit and event failure roll back request revision and no quote exists until the same command recovers',async()=>{
  const request=await prepared(),input=cmd(request);for(const [table,predicate]of [['audit_logs',"resource_type<>'supplier_request_quote'"],['supplier_request_quote_events',`request_id<>'${request.id}'::uuid`]]){
   await observer.query(`ALTER TABLE ${table} ADD CONSTRAINT injected_quote_failure CHECK(${predicate}) NOT VALID`);try{await assert.rejects(writeQuote(input),e=>e.code==='23514');}finally{await observer.query(`ALTER TABLE ${table} DROP CONSTRAINT injected_quote_failure`);}assert.equal((await read(request.id)).revision,request.revision);assert.deepEqual(await counts(request.id),{events:0,audits:0});
  }assert.equal((await writeQuote(input)).ok,true);
 });
 await t.test('empty, secret-like, floating-point, unknown currency, invalid sum and backdated terms are refused',async()=>{
  const request=await prepared();for(const o of [offer({currency:'XYZ'}),offer({net_minor:0}),offer({net_minor:1.5}),offer({tax_minor:'10'}),offer({net_minor:999999999999,tax_minor:1}),offer({conditions:'api_key=synthetic-private-value'}),offer({conditions:''}),offer({valid_until:'tomorrow'}),{...offer(),total_minor:1}])await assert.rejects(writeQuote(cmd(request,'issue',{offer:o})),/supplier_quote_input_invalid/);
  for(const patch of [{expected_revision:'0'},{expected_request_revision:0},{expected_review_revision:1.5},{reason:''},{extra:true}])await assert.rejects(writeQuote(cmd(request,'issue',patch)),/supplier_quote_input_invalid/);
  for(const valid_until of [new Date(Date.now()-1000).toISOString(),new Date(Date.now()+91*86400000).toISOString()])assert.equal((await writeQuote(cmd(request,'issue',{offer:offer({valid_until})}))).reason,'supplier_quote_validity_invalid');assert.deepEqual(await counts(request.id),{events:0,audits:0});
 });
 await t.test('unanswered clarification blocks issuance and acceptance but does not prevent explicit rejection',async()=>{
  const request=await prepared();await reviewWrite(reviewCommand(request));assert.equal((await writeQuote(cmd(await read(request.id)))).reason,'supplier_request_information_required');
  const first=await writeQuote(cmd(await prepared()));await reviewWrite(reviewCommand(first.request));const current=await read(first.request.id);assert.equal((await writeQuote(cmd(current,'accept'))).reason,'supplier_request_information_required');assert.equal((await writeQuote(cmd(current,'reject'))).ok,true);
 });
 await t.test('new clarifications after an offer require reissuance before company acceptance',async()=>{
  const issued=await writeQuote(cmd(await prepared()));await reviewWrite(reviewCommand(issued.request));await reviewWrite(reviewCommand(issued.request,'respond',1));const request=await read(issued.request.id);
  assert.equal((await writeQuote(cmd(request,'accept'))).reason,'supplier_quote_review_changed');
  const revised=await writeQuote(cmd(request));assert.equal(revised.current.review_revision,2);const accepted=await writeQuote(cmd(revised.request,'accept'));assert.equal(accepted.current.review_revision,2);assert.equal(accepted.current.quote_version,2);assert.equal(accepted.current.state,'accepted');
 });
 await t.test('concurrent retries commit one event; simultaneous issue/accept with stale revisions cannot overwrite the winner',async()=>{
  const input=cmd(await prepared());await first.query('BEGIN');const issued=await writeQuote(input,first);const pending=settle(writeQuote(input,second));try{await waitForLock(second);}finally{await first.query('COMMIT');}const replay=await pending;assert.ifError(replay.error);assert.equal(replay.value.idempotent_replay,true);assert.deepEqual(await counts(input.request_id),{events:1,audits:1});
  await first.query('BEGIN');const revised=await writeQuote(cmd(issued.request),first);const accept=settle(writeQuote(cmd(issued.request,'accept'),second));try{await waitForLock(second);}finally{await first.query('COMMIT');}const loser=await accept;assert.ifError(loser.error);assert.equal(loser.value.reason,'supplier_quote_revision_conflict');assert.equal((await readQuote(input.request_id)).current.quote_version,revised.current.quote_version);
 });
 await t.test('a contender waiting across offer expiry cannot accept it',async()=>{
  const issued=await writeQuote(cmd(await prepared(),'issue',{offer:offer({valid_until:new Date(Date.now()+900).toISOString()})}));await first.query('BEGIN');await first.query('SELECT id FROM supplier_requests WHERE id=$1 FOR UPDATE',[issued.request.id]);
  const accepting=settle(writeQuote(cmd(issued.request,'accept'),second));await waitForLock(second);await new Promise(resolve=>setTimeout(resolve,1100));await first.query('COMMIT');const expired=await accepting;assert.ifError(expired.error);assert.equal(expired.value.reason,'supplier_quote_expired');assert.equal((await readQuote(issued.request.id)).current.state,'offered');
 });
 await t.test('quotation/cancellation share the request revision, so stale cancel cannot ignore a new quote decision',async()=>{
  const request=await prepared();const cancel={tenant_id:tenantA,actor_id:actorA,auth_session_id:sessionA,request_id:request.id,idempotency_key:randomUUID(),expected_revision:request.revision,expected_review_revision:0,reason:'Proyecto detenido.'};
  const issued=await writeQuote(cmd(request));const result=(await observer.query(`SELECT ${schema}.nexid_cancel_supplier_request_v1($1::jsonb) r`,[JSON.stringify(cancel)])).rows[0].r;assert.equal(result.reason,'supplier_request_revision_conflict');
  const final=(await observer.query(`SELECT ${schema}.nexid_cancel_supplier_request_v1($1::jsonb) r`,[JSON.stringify({...cancel,expected_revision:issued.request.revision})])).rows[0].r;assert.equal(final.ok,true);assert.equal((await readQuote(request.id)).request.status,'cancelled');assert.equal((await writeQuote(cmd(final.request,'accept'))).reason,'supplier_request_not_submitted');
 });
 await t.test('historical quotation pages are bounded and current state is not replaced by an older page',async()=>{
  let request=await prepared();for(let i=0;i<54;i++){const result=await writeQuote(cmd(request,'issue',{offer:offer({net_minor:10000+i})}));assert.equal(result.ok,true);request=result.request;}
  const latest=await readQuote(request.id);assert.equal(latest.history.length,50);assert.equal(latest.next_before_revision,5);assert.equal(latest.current.quote_version,54);
  const old=await readQuote(request.id,5);assert.deepEqual(old.history.map(e=>e.revision),[1,2,3,4]);assert.equal(old.truncated,false);assert.deepEqual(old.current,latest.current);assert.equal(parseQuoteState(old,request.revision,request.quotation_revision,5).history.length,4);
 });
 await t.test('read current is scoped, PUBLIC has no functions/tables, and no-quote legacy requests keep preparation behavior',async()=>{
  const empty=await prepared(),view=await readQuote(empty.id);assert.equal(view.revision,0);assert.equal(view.current,null);assert.deepEqual(view.history,[]);assert.ok((await convert(empty)).supplier_order.id);
  const functions=(await observer.query(`SELECT proname,prosecdef,proconfig,proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.proname LIKE 'nexid_%supplier_quote%'`,[schema])).rows;
  assert.equal(functions.length,8);for(const fn of functions){assert.equal(fn.prosecdef,false);assert.ok(fn.proconfig.some(v=>v.startsWith('search_path=')));assert.doesNotMatch(JSON.stringify(fn.proacl),/"=/);}
 });
}
