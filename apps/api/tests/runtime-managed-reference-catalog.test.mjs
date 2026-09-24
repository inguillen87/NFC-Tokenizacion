import assert from 'node:assert/strict';
import test from 'node:test';
import {sql,sqlSerializable,installEphemeralE2eSqlExecutor,runtimeSchemaIsMigrationManaged,DEFAULT_REQUIRED_SCHEMA_MIGRATIONS} from '../src/lib/db.ts';
import {assertCatalogCodes,requireRuntimeCarrierCatalog,requireRuntimeLedgerCatalog} from '../src/lib/runtime-reference-catalog.ts';
import {ensureSupplierOpsSchema} from '../src/lib/supplier-ops-schema.ts';
import {ensureCarrierProfileSchema} from '../src/lib/commercial-runtime-schema.ts';
import {ensureSunTenantProfilesSchema} from '../src/lib/sun-tenant-profile-schema.ts';
import {CARRIER_PROFILES} from '../src/lib/carrier-profiles.ts';
const env={NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgresql://nexid_e2e:synthetic@127.0.0.1:5432/nexid_e2e_policy'};
const ledger=()=>[...DEFAULT_REQUIRED_SCHEMA_MIGRATIONS].sort().map(id=>({id}));
test('managed adapter cannot be enabled in a non-test runtime or with an external target',()=>{
 for(const patch of [{NODE_ENV:'production'},{VERCEL_ENV:'production'},{NEXID_E2E_DATABASE_URL:'postgresql://nexid_e2e:synthetic@remote.invalid/nexid_e2e_policy'},{NEXID_E2E_CONFIRMATION:'wrong'}])assert.throws(()=>installEphemeralE2eSqlExecutor(async()=>[],{...env,...patch},{migrationManaged:true}));
 for(const options of [{migrationManaged:'true'},{unexpected:true}])assert.throws(()=>installEphemeralE2eSqlExecutor(async()=>[],env,options));
});
test('shared migration-managed policy filters DDL and verifies schema before business SQL, including serializable calls',async()=>{
 const calls=[];const stop=installEphemeralE2eSqlExecutor(async(strings)=>{const q=strings.join('?');calls.push(q);return /FROM schema_migrations/.test(q)?ledger():[{ok:true}];},env,{migrationManaged:true});
 try{assert.equal(runtimeSchemaIsMigrationManaged(),true);await sql`CREATE TABLE invalid_runtime_ddl(id integer)`;await sqlSerializable`DO $$ BEGIN NULL; END $$`;assert.equal(calls.length,0);await sql`SELECT 1 AS ok`;await sqlSerializable`SELECT 2 AS ok`;assert.equal(calls.length,3);assert.match(calls[0],/schema_migrations/);assert.ok(calls.slice(1).every(q=>q.startsWith('SELECT')));}finally{stop();}assert.equal(runtimeSchemaIsMigrationManaged(),false);
});
test('missing watermark fails before a business mutation and can recover only after the required migrations appear',async()=>{
 let complete=false,writes=0;const stop=installEphemeralE2eSqlExecutor(async(strings)=>{const q=strings.join('?');if(q.includes('FROM schema_migrations'))return complete?ledger():[];writes++;return[];},env,{migrationManaged:true});
 try{await assert.rejects(sql`INSERT INTO ignored_table VALUES(1)`,/required_schema_migration_not_applied/);assert.equal(writes,0);complete=true;await sql`SELECT 1`;assert.equal(writes,1);}finally{stop();}
});
test('catalog validator rejects missing or duplicate codes instead of treating unknown as configured',()=>{
 for(const rows of [[],[{code:'none'}],[{code:'none'},{code:'none'},{code:'polygon'},{code:'iota'}],[{code:null}]])assert.throws(()=>assertCatalogCodes(rows,['none','polygon','iota'],'ledger_providers'));
 assert.doesNotThrow(()=>assertCatalogCodes([{code:'none'},{code:'polygon'},{code:'iota'}],['none','polygon','iota'],'ledger_providers'));
});
test('cold supplier/carrier/SUN checks recover from incomplete installation with SELECT-only queries and preserve custom records',async()=>{
 let phase='incomplete';const calls=[];
 const custom={provider:{network:'customer-network',name:'Customer label'},carrier:{label:'Approved custom label',cost:8.123},demoProfile:{name:'Do not seed over operator data'}};const before=structuredClone(custom);
 const stop=installEphemeralE2eSqlExecutor(async(strings)=>{const q=strings.join('?');calls.push(q);if(q.includes('FROM schema_migrations'))return ledger();assert.match(q,/^\s*SELECT/);assert.doesNotMatch(q,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER)\b/);
 if(q.includes('FROM public.ledger_providers'))return phase==='incomplete'?[]:['none','polygon','iota'].map(code=>({code}));
 if(q.includes('FROM public.carrier_profiles'))return phase==='incomplete'?[]:CARRIER_PROFILES.map(p=>({code:p.code}));
 if(q.includes("to_regclass('public.tenant_sun_profiles')"))return[{ready:phase!=='incomplete'}];throw Error('Unexpected query');},env,{migrationManaged:true});
 try{for(const f of [ensureSupplierOpsSchema,ensureCarrierProfileSchema,ensureSunTenantProfilesSchema])await assert.rejects(f(),/incomplete/);phase='complete';await Promise.all([ensureSupplierOpsSchema(),ensureCarrierProfileSchema(),ensureSunTenantProfilesSchema()]);const settled=calls.length;await Promise.all([ensureSupplierOpsSchema(),ensureCarrierProfileSchema(),ensureSunTenantProfilesSchema()]);assert.equal(calls.length,settled);assert.deepEqual(custom,before);}finally{stop();}
});
test('legacy explicitly local executor retains its original policy; no hidden global runtime flag survives uninstall',async()=>{
 const calls=[];const stop=installEphemeralE2eSqlExecutor(async(strings)=>{calls.push(strings.join('?'));return[];},env);
 try{assert.equal(runtimeSchemaIsMigrationManaged(),false);await sql`CREATE TABLE qa_local_only(id int)`;assert.match(calls[0],/CREATE TABLE/);}finally{stop();}
});

test('production always keeps the managed schema policy and no legacy DDL permission can enable writes',async()=>{
 const previous=process.env.NODE_ENV;
 try{process.env.NODE_ENV='production';assert.equal(runtimeSchemaIsMigrationManaged(),true);assert.deepEqual(await sql(["CREATE TABLE must_not_execute(id integer)"]),[]);assert.deepEqual(await sqlSerializable(["ALTER TABLE must_not_execute ADD COLUMN x text"]),[]);}
 finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
