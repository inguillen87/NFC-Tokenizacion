import assert from 'node:assert/strict';import test from 'node:test';import {readFile}from'node:fs/promises';
import {parseSupplierRuntimeWorkerInput}from'../scripts/lib/supplier-runtime-safety.mjs';
import {assertSupplierRuntimeProfile,SUPPLIER_RUNTIME_TABLES,SUPPLIER_RUNTIME_LOCK_COLUMNS,SUPPLIER_RUNTIME_FUNCTION_NAMES,SUPPLIER_RUNTIME_DENY_FUNCTIONS}from'../scripts/lib/supplier-runtime-profile.mjs';
const role='nexid_e2e_supplier_'+'a'.repeat(16),password='b'.repeat(64),url='postgresql://'+role+':'+password+'@127.0.0.1:5432/nexid_e2e_profile';
const input=()=>({runtimeUrl:url,expectedDatabase:'nexid_e2e_profile',expectedServerVersion:170010,roleName:role,ledger:['0001_initial.sql','20260924163000_0121_support_ticket_status_type_compatibility.sql']});
const env={NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_EXPECTED_POSTGRES_VERSION:'17.10'};
test('restricted worker uses explicit generated login, pinned engine and dedicated loopback database',()=>{assert.equal(parseSupplierRuntimeWorkerInput(input(),env).roleName,role);});
for(const candidate of [url.replace('127.0.0.1','remote.invalid'),url+'?host=remote.invalid',url+'#fragment',url.replace(role,'nexid_e2e'),url.replace(role,'production_runtime'),url.replace('nexid_e2e_profile','customers'),url.replace(password,'')])test('reject runtime URL outside the isolated contract '+candidate.replace(password,'redacted'),()=>assert.throws(()=>parseSupplierRuntimeWorkerInput({...input(),runtimeUrl:candidate},env)));
for(const patch of [{NODE_ENV:'production'},{VERCEL_ENV:'preview'},{NEXID_E2E_CONFIRMATION:'wrong'},{DATABASE_URL:'not-consumed'},{PGHOST:'remote.invalid'},{PGUSER:'nexid_e2e'},{PGSERVICE:'remote'},{PGOPTIONS:'-c role=superuser'},{NEXID_E2E_EXPECTED_POSTGRES_VERSION:'latest'}])test('reject unsafe inherited setting '+Object.keys(patch)[0],()=>assert.throws(()=>parseSupplierRuntimeWorkerInput(input(),{...env,...patch})));
test('mismatched role/database/version and missing migration proof are rejected',()=>{for(const patch of [{roleName:'other'},{expectedDatabase:'another'},{expectedServerVersion:180004},{ledger:[]},{ledger:['../bad.sql']}])assert.throws(()=>parseSupplierRuntimeWorkerInput({...input(),...patch},env));});
test('candidate grants are explicit; catalogs, profiles and migration ledger are read-only',()=>{
 assert.equal(assertSupplierRuntimeProfile(),true);for(const name of ['schema_migrations','carrier_profiles','ledger_providers','tenant_sun_profiles'])assert.deepEqual(SUPPLIER_RUNTIME_TABLES[name],['SELECT']);
 for(const permissions of Object.values(SUPPLIER_RUNTIME_TABLES))assert.ok(permissions.every(p=>!['ALL','DELETE','TRUNCATE','REFERENCES','TRIGGER'].includes(p)));
 assert.ok(SUPPLIER_RUNTIME_DENY_FUNCTIONS.every(f=>!SUPPLIER_RUNTIME_FUNCTION_NAMES.includes(f)));assert.equal(SUPPLIER_RUNTIME_LOCK_COLUMNS.schema_migrations,undefined);
});
test('worker and coordinator never bootstrap a runtime owner or silently add grants based on failed queries',async()=>{
 const source=await readFile(new URL('../scripts/lib/supplier-runtime-acceptance.mjs',import.meta.url),'utf8'),worker=await readFile(new URL('../scripts/supplier-runtime-worker.mjs',import.meta.url),'utf8');
 assert.match(source,/NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS/);assert.doesNotMatch(source,/GRANT ALL|ALTER DEFAULT PRIVILEGES|GRANT .* TO CURRENT_USER/);assert.match(source,/DROP ROLE/);assert.match(source,/runtime_connections_closed:true/);
 assert.match(worker,/session_user::text login/);assert.match(worker,/SET ROLE nexid_e2e/);assert.match(worker,/migrationManaged:true/);assert.match(worker,/supplier_runtime_ddl_reached_database/);assert.doesNotMatch(worker,/SET LOCAL ROLE|RESET ROLE/);
});

test('worker cleanup waits for close and rejects duplicate completion receipts',async()=>{
 const source=await readFile(new URL('../scripts/lib/supplier-runtime-acceptance.mjs',import.meta.url),'utf8');
 assert.match(source,/child\.on\('close'/);assert.doesNotMatch(source,/child\.on\('exit'/);
 assert.match(source,/lines\.length!==1/);assert.match(source,/stderr is counted but never printed/);assert.match(source,/child\.kill\('SIGKILL'\)/);
});
