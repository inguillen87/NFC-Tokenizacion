import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseBindingState} from '../src/lib/supplier-binding-policy.ts';
export async function runBindingPostgresTests(t,c){
 const {schema,scoped,observer,first,second,tenantA,tenantB,actorA,actorB,sessionA,sessionB,globalActor,globalSession,operatorA,operatorSessionA,prepared,command,mutate,read,graphCounts,technical,convert,waitForLock,settle}=c;
 // Fixture boundary: approved packaging snapshots and the lifecycle receipt
 // substrate represent existing 0063/0086 contracts. The new migration/guards
 // and existing request/quote/IAM functions are real; this is NOT factory QA,
 // a key export, or end-to-end execution of the original lifecycle exporter.
 await observer.query(`ALTER TABLE supplier_orders ADD COLUMN status text NOT NULL DEFAULT 'pack_ready',ADD COLUMN carrier_profile_code text NOT NULL DEFAULT 'ntag424_dna',
 ADD COLUMN packaging_governance_status text NOT NULL DEFAULT 'legacy_unverified',ADD COLUMN packaging_spec_revision int NOT NULL DEFAULT 0,
 ADD COLUMN packaging_spec_hash text,ADD COLUMN packaging_spec_snapshot jsonb,ADD COLUMN packaging_evidence_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN packaging_validation_snapshot jsonb,ADD COLUMN packaging_approved_by text,ADD COLUMN packaging_approved_at timestamptz;
 CREATE TABLE supplier_packaging_governance_decisions(id uuid PRIMARY KEY,supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id),tenant_id uuid NOT NULL REFERENCES tenants(id),
 spec_revision int NOT NULL,decision_status text NOT NULL,spec_hash text NOT NULL,spec_snapshot jsonb NOT NULL,evidence_refs jsonb NOT NULL,validation_snapshot jsonb NOT NULL,
 carrier_profile_code text NOT NULL,decided_by text NOT NULL,decided_at timestamptz NOT NULL,UNIQUE(supplier_order_id,spec_revision));
 CREATE TABLE supplier_order_lifecycle_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id),tenant_id uuid NOT NULL REFERENCES tenants(id),
 transition text NOT NULL,recipient_ref text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(supplier_order_id,transition));`);
 await observer.query(scoped(await readFile(new URL('../db/migrations/20260924110000_0119_supplier_request_binding.sql',import.meta.url),'utf8')));
 const approve=async(order,revision=1,client=observer)=>{
  const id=randomUUID(),hash='sha256:'+String(revision).padStart(64,'0');const at=new Date().toISOString();const snapshot={schema:'synthetic-approved-packaging',revision};const evidence={rf_sample:['QA-RF'],line_trial:['QA-LINE'],adhesive:['QA-ADH'],artwork_dieline:['QA-ART'],encoding_readback:['QA-ENC']},validation={validator:'validateSupplierPackagingSpec',validatorVersion:1,ok:true,productionReady:true};
  await client.query("INSERT INTO supplier_packaging_governance_decisions VALUES($1,$2,$3,$4,'approved',$5,$6,$7,$8,'ntag424_dna','QA-approver',$9)",[id,order,tenantA,revision,hash,JSON.stringify(snapshot),JSON.stringify(evidence),JSON.stringify(validation),at]);
  await client.query("UPDATE supplier_orders SET packaging_governance_status='approved',packaging_spec_revision=$2,packaging_spec_hash=$3,packaging_spec_snapshot=$4,packaging_evidence_refs=$5,packaging_validation_snapshot=$6,packaging_approved_by='QA-approver',packaging_approved_at=$7 WHERE id=$1",[order,revision,hash,JSON.stringify(snapshot),JSON.stringify(evidence),JSON.stringify(validation),at]);return{revision,hash,decision_id:id};
 };
 const ready=async()=>{const submitted=await prepared();await convert(submitted);const request=await read(submitted.id),spec=await approve(request.order_id);return{request,spec};};
 const cmd=(v,patch={})=>({action:'assign',expected_revision:0,expected_request_revision:v.request.revision,order_id:v.request.order_id,supplier:{reference:'FACTORY-QA',name:'Proveedor de prueba',confirmation_ref:'CONF-QA-001'},spec:v.spec,reason:'Asignación documentada.',tenant_id:tenantA,request_id:v.request.id,actor_id:globalActor,auth_session_id:globalSession,idempotency_key:randomUUID(),...patch});
 const save=async(input,client=observer)=>(await client.query(`SELECT ${schema}.nexid_mutate_supplier_binding_v1($1::jsonb)result`,[JSON.stringify(input)])).rows[0].result;
 const state=async(v,before=null,actor=actorA,session=sessionA,tenant=tenantA,client=observer)=>(await client.query(`SELECT ${schema}.nexid_supplier_binding_read_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::int)result`,[v.request.id,tenant,actor,session,before])).rows[0].result;
 const counts=async(v)=>(await observer.query("SELECT(SELECT count(*)::int FROM supplier_request_binding_events WHERE request_id=$1)events,(SELECT count(*)::int FROM audit_logs WHERE resource_type='supplier_request_binding' AND resource_id=$1::text)audits",[v.request.id])).rows[0];
 const dispatch=async(v,recipient='FACTORY-QA',client=observer)=>(await client.query("INSERT INTO supplier_order_lifecycle_receipts(supplier_order_id,tenant_id,transition,recipient_ref)VALUES($1,$2,'mark_sent',$3)RETURNING *",[v.request.order_id,tenantA,recipient])).rows[0];
 await t.test('supplier binding records one matching approved spec and no business request/order/key mutation',async()=>{
  const v=await ready(),original=await read(v.request.id),graph=await graphCounts();const initial=await state(v);assert.equal(initial.revision,0);assert.equal(initial.specification.ready,true);assert.equal(initial.current,null);
  const input=cmd(v),result=await save(input);assert.equal(result.ok,true);assert.equal(result.current.supplier.reference,'FACTORY-QA');assert.equal(result.current.spec.decision_id,v.spec.decision_id);
  assert.equal(parseBindingState(result,{id:v.request.id,orderId:v.request.order_id}).binding_status,'current');assert.deepEqual(await read(v.request.id),original);assert.deepEqual(await graphCounts(),graph);assert.deepEqual(await counts(v),{events:1,audits:1});
  assert.doesNotMatch(JSON.stringify(await state(v)),/auth_session_id|idempotency_key|fingerprint|audit_id|spec_snapshot/);
 });
 await t.test('supplier binding requires prepared request, correct company/order and live superadmin; tenants are read-only',async()=>{
  const v=await ready();for(const patch of [{actor_id:actorA,auth_session_id:sessionA},{actor_id:operatorA,auth_session_id:operatorSessionA},{actor_id:globalActor,auth_session_id:sessionA}])assert.equal((await save(cmd(v,patch))).reason,'supplier_binding_scope_forbidden');
  assert.equal((await save(cmd(v,{tenant_id:tenantB}))).reason,'supplier_request_not_found');assert.equal((await save(cmd(v,{order_id:randomUUID()}))).reason,'supplier_binding_request_changed');
  const other=await prepared();assert.equal((await save({...cmd(v),request_id:other.id})).reason,'supplier_binding_request_changed');
  assert.equal(await state(v,null,operatorA,operatorSessionA),null);assert.equal(await state(v,null,actorA,sessionA,tenantB),null);assert.deepEqual(await counts(v),{events:0,audits:0});
 });
 await t.test('stale, unapproved, foreign or absent packaging decisions cannot be linked as ready',async()=>{
  const v=await ready();for(const patch of [{spec:{...v.spec,revision:2}},{spec:{...v.spec,hash:'sha256:'+'a'.repeat(64)}},{spec:{...v.spec,decision_id:randomUUID()}}])assert.equal((await save(cmd(v,patch))).reason,'supplier_binding_spec_changed');
  await observer.query("UPDATE supplier_orders SET packaging_governance_status='draft' WHERE id=$1",[v.request.order_id]);assert.equal((await state(v)).specification.ready,false);assert.equal((await save(cmd(v))).reason,'supplier_binding_spec_changed');
  await observer.query("UPDATE supplier_orders SET packaging_governance_status='approved',packaging_spec_snapshot='{}'::jsonb WHERE id=$1",[v.request.order_id]);assert.equal((await save(cmd(v))).reason,'supplier_binding_spec_changed');
  const b=await ready();await observer.query('UPDATE supplier_packaging_governance_decisions SET tenant_id=$2 WHERE id=$1',[b.spec.decision_id,tenantB]);assert.equal((await state(b)).specification.ready,false);assert.equal((await save(cmd(b))).reason,'supplier_binding_spec_changed');
 });
 await t.test('matching approved labels with failed validation do not become a ready specification',async()=>{
  const v=await ready();await observer.query("UPDATE supplier_orders SET packaging_validation_snapshot=jsonb_set(packaging_validation_snapshot,'{ok}','false') WHERE id=$1",[v.request.order_id]);
  await observer.query("UPDATE supplier_packaging_governance_decisions SET validation_snapshot=jsonb_set(validation_snapshot,'{ok}','false') WHERE id=$1",[v.spec.decision_id]);
  assert.equal((await state(v)).specification.ready,false);assert.equal((await save(cmd(v))).reason,'supplier_binding_spec_changed');
 });
 await t.test('withdrawal keeps the former assignment; new binding supersedes without rewriting history',async()=>{
  const v=await ready(),one=cmd(v);await save(one);const out=await save(cmd(v,{action:'withdraw',expected_revision:1,supplier:null,spec:null,reason:'Cambió el proveedor.'}));assert.equal(out.current.action,'withdraw');assert.equal(out.current.supplier.name,one.supplier.name);assert.equal(out.history.length,2);
  assert.equal((await save(cmd(v,{action:'withdraw',expected_revision:2,supplier:null,spec:null}))).reason,'supplier_binding_transition_invalid');
  const next=await save(cmd(v,{expected_revision:2,supplier:{...one.supplier,reference:'FACTORY-QA-B'}}));assert.equal(next.current.revision,3);assert.equal(next.history[0].supplier.reference,'FACTORY-QA');assert.equal(next.current.supplier.reference,'FACTORY-QA-B');assert.deepEqual(await counts(v),{events:3,audits:3});
  const replay=await save(one);assert.equal(replay.idempotent_replay,true);assert.equal(replay.receipt.revision,1);assert.equal(replay.current.revision,3);
 });
 await t.test('idempotency binds tenant/request/actor and the exact supplier/specification decision',async()=>{
  const v=await ready(),input=cmd(v);await save(input);
  for(const patch of [{reason:'Otro motivo'},{expected_revision:1},{supplier:{...input.supplier,name:'Otro nombre'}},{spec:{...v.spec,revision:2}}])assert.equal((await save({...input,...patch})).reason,'supplier_binding_idempotency_conflict');
  const b=await ready();assert.equal((await save({...cmd(b),idempotency_key:input.idempotency_key})).reason,'supplier_binding_idempotency_conflict');assert.deepEqual(await counts(v),{events:1,audits:1});
 });
 await t.test('revoked session and explicit denial apply before receipt recovery and reads',async()=>{
  const v=await ready(),input=cmd(v);await save(input);await observer.query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1',[globalSession]);
  try{assert.equal((await save(input)).reason,'supplier_binding_scope_forbidden');assert.equal(await state(v,null,globalActor,globalSession),null);}finally{await observer.query('UPDATE auth_sessions SET revoked_at=NULL WHERE id=$1',[globalSession]);}
  await observer.query("INSERT INTO resource_permissions VALUES($1,NULL,'supplier_orders','write','deny')",[globalActor]);try{assert.equal((await save(input)).reason,'supplier_binding_scope_forbidden');}finally{await observer.query('DELETE FROM resource_permissions WHERE user_id=$1',[globalActor]);}
 });
 await t.test('unsafe and malformed input is rejected in SQL, not merely in the browser',async()=>{
  const v=await ready(),base=cmd(v);for(const patch of [{extra:'unexpected'},{expected_revision:'0'},{expected_revision:-1},{expected_request_revision:0},{reason:''},{reason:'api_key=synthetic-value'},{supplier:{...base.supplier,reference:'https://remote.invalid'}},{supplier:{...base.supplier,name:'PACK_PASSWORD'}},{spec:{...v.spec,hash:'bad'}},{spec:null},{action:'withdraw',supplier:base.supplier,spec:null}])await assert.rejects(save({...base,...patch}),/supplier_binding_input_invalid/);assert.deepEqual(await counts(v),{events:0,audits:0});
 });
 await t.test('audit or event failure rolls back all binding writes; the exact operation can be retried',async()=>{
  const v=await ready(),input=cmd(v);for(const[table,check]of [['audit_logs',"resource_type<>'supplier_request_binding'"],['supplier_request_binding_events',`request_id<>'${v.request.id}'::uuid`]]){
   await observer.query(`ALTER TABLE ${table} ADD CONSTRAINT injected_binding_failure CHECK(${check}) NOT VALID`);try{await assert.rejects(save(input),e=>e.code==='23514');}finally{await observer.query(`ALTER TABLE ${table} DROP CONSTRAINT injected_binding_failure`);}assert.deepEqual(await counts(v),{events:0,audits:0});}
  assert.equal((await save(input)).ok,true);
  for(const sql of ["UPDATE supplier_request_binding_events SET reason='changed' WHERE request_id=$1",'DELETE FROM supplier_request_binding_events WHERE request_id=$1'])await assert.rejects(observer.query(sql,[v.request.id]),/supplier_binding_append_only/);
 });
 await t.test('concurrent same-key retries produce one event; stale independent writers cannot overwrite the winner',async()=>{
  const v=await ready(),input=cmd(v);await first.query('BEGIN');await save(input,first);const pending=settle(save(input,second));try{await waitForLock(second);}finally{await first.query('COMMIT');}
  const replay=await pending;assert.ifError(replay.error);assert.equal(replay.value.idempotent_replay,true);assert.deepEqual(await counts(v),{events:1,audits:1});
  assert.equal((await save(cmd(v,{supplier:{...input.supplier,reference:'LOSER-QA'}}))).reason,'supplier_binding_revision_conflict');
 });
 await t.test('current specification changes mark the old assignment stale and force explicit rebinding',async()=>{
  const v=await ready();await save(cmd(v));const next=await approve(v.request.order_id,2);const current=await state(v);assert.equal(parseBindingState(current,{id:v.request.id,orderId:v.request.order_id}).binding_status,'stale');
  await assert.rejects(dispatch(v),/supplier_binding_spec_changed/);assert.equal((await save(cmd(v,{expected_revision:1}))).reason,'supplier_binding_spec_changed');
  const rebound=await save(cmd(v,{expected_revision:1,spec:next}));assert.equal(rebound.current.spec.revision,2);assert.equal(rebound.history[0].spec.revision,1);
 });
 await t.test('existing dispatch receipt binds exact supplier/spec event; later edits remain blocked',async()=>{
  const v=await ready(),input=cmd(v),saved=await save(input);await assert.rejects(dispatch(v,'OTHER-QA'),/supplier_binding_recipient_mismatch/);
  const receipt=await dispatch(v);assert.equal(receipt.supplier_binding_event_id,saved.current.id);assert.equal((await state(v)).dispatch_receipt.id,receipt.id);
  assert.equal((await save(cmd(v,{expected_revision:1}))).reason,'supplier_binding_dispatch_locked');assert.equal((await save(input)).idempotent_replay,true);
  const b=await ready();await save(cmd(b));await save(cmd(b,{action:'withdraw',expected_revision:1,supplier:null,spec:null}));await assert.rejects(dispatch(b),/supplier_binding_required/);
  const legacy=await ready();assert.equal((await dispatch(legacy,'LEGACY-REFERENCE')).supplier_binding_event_id,null);assert.equal((await save(cmd(legacy))).reason,'supplier_binding_dispatch_locked');
 });
 await t.test('withdraw-first rejects waiting dispatch; dispatch-first freezes waiting reassignment',async()=>{
  const v=await ready();await save(cmd(v));await first.query('BEGIN');await save(cmd(v,{action:'withdraw',expected_revision:1,supplier:null,spec:null}),first);
  const send=settle(dispatch(v,'FACTORY-QA',second));try{await waitForLock(second);}finally{await first.query('COMMIT');}assert.match((await send).error?.message||'',/supplier_binding_required/);
  const next=await ready();await save(cmd(next));await first.query('BEGIN');await dispatch(next,'FACTORY-QA',first);const reassign=settle(save(cmd(next,{expected_revision:1}),second));try{await waitForLock(second);}finally{await first.query('COMMIT');}
  const denied=await reassign;assert.ifError(denied.error);assert.equal(denied.value.reason,'supplier_binding_dispatch_locked');
 });
 await t.test('packaging update-first makes a waiting supplier confirmation stale instead of binding obsolete spec',async()=>{
  const v=await ready();await first.query('BEGIN');await approve(v.request.order_id,2,first);const pending=settle(save(cmd(v),second));try{await waitForLock(second);}finally{await first.query('COMMIT');}
  const denied=await pending;assert.ifError(denied.error);assert.equal(denied.value.reason,'supplier_binding_spec_changed');assert.deepEqual(await counts(v),{events:0,audits:0});
 });
 await t.test('history uses exact exclusive cursors and carries no credentials or unbounded payloads',async()=>{
  const v=await ready();for(let revision=0;revision<53;revision++)assert.equal((await save(cmd(v,{expected_revision:revision,reason:'Revisión '+revision}))).ok,true);
  const one=await state(v),two=await state(v,one.next_before_revision);assert.equal(one.history.length,50);assert.equal(one.next_before_revision,4);assert.deepEqual(two.history.map(e=>e.revision),[1,2,3]);assert.equal(two.next_before_revision,null);
  assert.equal(parseBindingState(two,{id:v.request.id,orderId:v.request.order_id},4).current.revision,53);assert.doesNotMatch(JSON.stringify(one),/auth_session|idempotency|fingerprint|audit_id|spec_snapshot/);
 });
 await t.test('forged direct events and cross-company receipt links are rejected without corrupting history',async()=>{
  const v=await ready();await save(cmd(v));
  await assert.rejects(observer.query("INSERT INTO supplier_request_binding_events(id,tenant_id,request_id,order_id,revision,request_revision,action,supplier_ref,supplier_name,confirmation_ref,spec_revision,spec_hash,spec_decision_id,reason,actor_id,auth_session_id,idempotency_key,fingerprint,audit_id,created_at)SELECT gen_random_uuid(),tenant_id,request_id,order_id,revision+1,request_revision,action,supplier_ref,supplier_name,confirmation_ref,spec_revision,spec_hash,spec_decision_id,reason,actor_id,auth_session_id,gen_random_uuid(),fingerprint,audit_id,clock_timestamp() FROM supplier_request_binding_events WHERE request_id=$1",[v.request.id]),/supplier_binding_audit_required/);
  await assert.rejects(observer.query("INSERT INTO supplier_order_lifecycle_receipts(supplier_order_id,tenant_id,transition,recipient_ref)VALUES($1,$2,'mark_sent','FACTORY-QA')",[v.request.order_id,tenantB]),/supplier_binding_receipt_invalid/);
  assert.deepEqual(await counts(v),{events:1,audits:1});assert.equal((await state(v)).dispatch_receipt,null);
 });
 await t.test('permission revoke-first blocks a waiting supplier write and read before revealing state',async()=>{
  const v=await ready();for(const operation of [()=>save(cmd(v),second),()=>state(v,null,globalActor,globalSession,tenantA,second)]){
   await first.query('BEGIN');await first.query("INSERT INTO resource_permissions VALUES($1,NULL,'supplier_orders','write','deny')",[globalActor]);
   const pending=settle(operation());try{await waitForLock(second);}finally{await first.query('COMMIT');}
   try{const result=await pending;assert.ifError(result.error);assert.ok(result.value===null||result.value.reason==='supplier_binding_scope_forbidden');}finally{await observer.query('DELETE FROM resource_permissions WHERE user_id=$1',[globalActor]);}
  }assert.deepEqual(await counts(v),{events:0,audits:0});
 });
 await t.test('supplier binding functions remain invokers with fixed search paths and no PUBLIC access',async()=>{
  const functions=(await observer.query("SELECT p.proname,p.prosecdef,p.proconfig,EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner)))a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')public_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.proname LIKE '%supplier_binding%'",[schema])).rows;
  assert.equal(functions.length,7);for(const f of functions){assert.equal(f.prosecdef,false);assert.equal(f.public_execute,false);assert.ok(f.proconfig.some(x=>x.startsWith('search_path=')));}
 });
 const {runDeliveryAckPostgresTests}=await import('./supplier-delivery-ack.postgres.mjs');
 await runDeliveryAckPostgresTests(t,{...c,ready,approve,bindingSave:save,bindingCommand:cmd,dispatch});

}
