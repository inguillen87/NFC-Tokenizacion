import assert from 'node:assert/strict';
import test from 'node:test';
import {verifySupplierRuntimeEffectiveAcl} from '../scripts/lib/supplier-runtime-acl.mjs';
import {SUPPLIER_RUNTIME_TABLES,SUPPLIER_RUNTIME_LOCK_COLUMNS,SUPPLIER_RUNTIME_FUNCTION_NAMES} from '../scripts/lib/supplier-runtime-profile.mjs';
function fixture(change=()=>{}){
  const data={
    tables:Object.entries(SUPPLIER_RUNTIME_TABLES).map(([name,p])=>({name,can_select:p.includes('SELECT'),can_insert:p.includes('INSERT'),can_update:p.includes('UPDATE'),can_delete:false,can_truncate:false,can_reference:false,can_trigger:false})),
    columns:Object.entries(SUPPLIER_RUNTIME_TABLES).flatMap(([name,p])=>[...new Set(['id','unprivileged_column',...(SUPPLIER_RUNTIME_LOCK_COLUMNS[name]||[])])].map(column_name=>({name,column_name,can_update:p.includes('UPDATE')||(SUPPLIER_RUNTIME_LOCK_COLUMNS[name]||[]).includes(column_name)}))),
    functions:SUPPLIER_RUNTIME_FUNCTION_NAMES.map(name=>({name,can_execute:true})),
  };
  change(data);
  return {query:async(sql)=>{assert.match(sql,/^SELECT/);assert.doesNotMatch(sql,/GRANT|REVOKE|ALTER|CREATE/);return {rows:sql.includes('pg_attribute')?data.columns:sql.includes('pg_proc')?data.functions:data.tables};}};
}
test('effective privileges agree with the explicit profile including row-lock columns',async()=>{const r=await verifySupplierRuntimeEffectiveAcl(fixture());assert.equal(r.unexpected_privileges,0);assert.equal(r.tables_checked,Object.keys(SUPPLIER_RUNTIME_TABLES).length);assert.equal(r.functions_checked,SUPPLIER_RUNTIME_FUNCTION_NAMES.length);});
for(const key of ['can_delete','can_truncate','can_reference','can_trigger'])test('an extra table privilege is rejected: '+key,async()=>{await assert.rejects(verifySupplierRuntimeEffectiveAcl(fixture(d=>{d.tables.find(t=>t.name==='supplier_delivery_ack_events')[key]=true;})),/Unexpected/);});
test('missing expected function/table permissions fail rather than dynamically adding grants',async()=>{
  for(const change of [d=>{d.tables.find(t=>t.name==='supplier_requests').can_insert=false;},d=>{d.functions[0].can_execute=false;},d=>d.tables.pop(),d=>d.functions.pop()])await assert.rejects(verifySupplierRuntimeEffectiveAcl(fixture(change)));
});
test('column-only locking never implies metadata or catalog editing permission',async()=>{
  for(const name of ['vault_artifacts','ledger_providers','tenant_sun_profiles','schema_migrations'])await assert.rejects(verifySupplierRuntimeEffectiveAcl(fixture(d=>{d.columns.find(t=>t.name===name&&t.column_name==='unprivileged_column').can_update=true;})),/Unexpected effective column UPDATE/);
});
test('table-wide UPDATE is not substituted for a narrow row-lock grant',async()=>{await assert.rejects(verifySupplierRuntimeEffectiveAcl(fixture(d=>{d.tables.find(t=>t.name==='vault_artifacts').can_update=true;})),/Unexpected effective UPDATE/);});
