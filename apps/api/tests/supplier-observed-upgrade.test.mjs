import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {verifyObservedSchema,verifyObservedDelta,assertObservedRehearsalTarget,parseObservedRehearsalArgs,observedChildEnvironment,OBSERVED_DELTA_HASHES,OBSERVED_SCHEMA_MAX_BYTES} from '../scripts/lib/supplier-observed-upgrade.mjs';
import {readEnterpriseEphemeralE2eConfig,assertEmptyEnterpriseE2eDatabase} from '../scripts/lib/enterprise-ephemeral-e2e-safety.mjs';
const api=new URL('../',import.meta.url),files=(await readdir(new URL('db/migrations/',api))).filter(n=>n.endsWith('.sql')).sort();
const ledger=JSON.parse(await readFile(new URL('tests/fixtures/supplier-upgrade-ledger.json',api),'utf8')).ledgerIds,sources={};
for(const id of Object.keys(OBSERVED_DELTA_HASHES))sources[id]=await readFile(new URL('db/migrations/'+id,api),'utf8');
const environment={NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgresql://nexid_e2e:synthetic@127.0.0.1:15483/nexid_e2e_observed',NEXID_E2E_EXPECTED_POSTGRES_VERSION:'17.11'};
const config=readEnterpriseEphemeralE2eConfig(environment);
const target={database_name:config.databaseName,database_role:'nexid_e2e',host:'127.0.0.1',neon_endpoint_id:null,server_version_number:170011};
const roles=['neondb_owner','cloud_admin','neon_superuser'].map(rolname=>({rolname,rolcanlogin:false,rolsuper:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,rolbypassrls:false}));
test('exact observed ledger and migration bytes pass without changing historical gaps or authorizing production',()=>{
 const result=verifyObservedDelta(files,ledger,sources);assert.equal(result.pending.length,5);assert.equal(result.historicalGaps.length,48);assert.equal(result.productionExecutionAllowed,false);assert.equal(result.liveRuntimeRoleVerified,false);assert.ok(Object.isFrozen(result.migrations)&&Object.isFrozen(result.pending));
 assert.deepEqual(verifyObservedDelta(files,ledger,Object.fromEntries(Object.entries(sources).map(([id,s])=>[id,s.replaceAll('\r\n','\n').replaceAll('\n','\r\n')]))),result);
});
for(const id of Object.keys(sources))test('modified migration bytes rejected '+id,()=>assert.throws(()=>verifyObservedDelta(files,ledger,{...sources,[id]:sources[id]+'\n-- changed'}),/fingerprint_mismatch/));
test('changed ledger, unknown files, added delta and omitted source never pass',()=>{
 for(const [f,l,s] of [[files,ledger.slice(1),sources],[files,[...ledger,'0000_invented.sql'],sources],[[...files,'20260930000000_0122_not_reviewed.sql'],ledger,sources],[files,ledger,{}],[files,ledger,{...sources,extra:'x'}]])assert.throws(()=>verifyObservedDelta(f,l,s));
});
for(const value of [null,'sql',new Uint8Array(),new Uint8Array(OBSERVED_SCHEMA_MAX_BYTES+1),Buffer.from('CREATE TABLE unsafe();'),Buffer.from([255,254])])test('unverified schema cannot reach SQL '+String(value?.byteLength??typeof value),()=>assert.throws(()=>verifyObservedSchema(value),/observed_schema_/));
test('no network URL, positional SQL, override or missing path accepted by the CLI',()=>{
 assert.equal(parseObservedRehearsalArgs(['--schema-file','/private/observed.sql']),'/private/observed.sql');
 for(const args of [[],['--schema-file'],['--schema-file','https://foreign.invalid'],['--schema-file','x','--project','prod'],['--sql','SELECT 1'],['--schema-file','x\0y']])assert.throws(()=>parseObservedRehearsalArgs(args));
});
test('local target allows only the exact empty isolated 17.11 test arrangement',()=>assert.doesNotThrow(()=>assertObservedRehearsalTarget(config,target,roles,[])));
for(const patch of [{host:'remote.invalid'},{neon_endpoint_id:'ep-remote'},{database_name:'neondb'},{database_role:'neondb_owner'},{server_version_number:170012}])test('observed rehearsal rejects identity drift '+JSON.stringify(patch),()=>assert.throws(()=>assertObservedRehearsalTarget(config,{...target,...patch},roles,[])));
for(const key of ['rolcanlogin','rolsuper','rolcreaterole','rolcreatedb','rolreplication','rolbypassrls'])test('ownership placeholder cannot gain '+key,()=>assert.throws(()=>assertObservedRehearsalTarget(config,target,roles.map((r,i)=>i? r:{...r,[key]:true}),[])));
test('missing, duplicated placeholders and a shared cluster are rejected',()=>{
 for(const r of [[],roles.slice(1),[roles[0],roles[0],roles[2]]])assert.throws(()=>assertObservedRehearsalTarget(config,target,r,[]));
 assert.throws(()=>assertObservedRehearsalTarget(config,target,roles,[{datname:'other_work'}]));
});
for(const patch of [{NODE_ENV:'production'},{VERCEL_ENV:'production'},{NEXID_E2E_EXPECTED_POSTGRES_VERSION:'17.12'},{NEXID_E2E_DATABASE_URL:'postgresql://nexid_e2e:synthetic@neon.invalid/nexid_e2e'},{NEXID_E2E_DATABASE_URL:environment.NEXID_E2E_DATABASE_URL+'?host=neon.invalid'},{NEXID_E2E_DATABASE_URL:environment.NEXID_E2E_DATABASE_URL+'#fragment'}])test('17.11 adds no escape from existing target safety '+JSON.stringify(patch),()=>assert.throws(()=>readEnterpriseEphemeralE2eConfig({...environment,...patch})));
test('connection attestation still rejects nonempty databases and Neon endpoints on the local version',async()=>{
 const base={database_name:config.databaseName,database_role:'nexid_e2e',neon_endpoint_id:null,transaction_read_only:'off',server_version_number:170011};
 for(const [patch,count] of [[{neon_endpoint_id:'ep-remote'},0],[{},1],[{server_version_number:170010},0]]){
  let n=0;await assert.rejects(assertEmptyEnterpriseE2eDatabase({query:async()=>({rows:[n++?{count}:{...base,...patch}]})},config));
 }
});
test('subprocess gets only its synthetic local database, not cloud, browser or production credentials',()=>{
 const child=observedChildEnvironment(config,{PATH:'tools',DATABASE_URL:'NEVER_COPY',NEON_API_KEY:'NEVER_COPY',VERCEL_TOKEN:'NEVER_COPY',NODE_OPTIONS:'--require unsafe',HTTPS_PROXY:'NEVER_COPY',LOCALAPPDATA:'local'});
 assert.equal(child.DATABASE_URL,config.databaseUrl);assert.equal(child.NODE_ENV,'test');assert.equal(child.PATH,'tools');assert.doesNotMatch(JSON.stringify(child),/NEVER_COPY|unsafe/);assert.equal(child.NODE_OPTIONS,undefined);
});
test('rehearsal verifies inputs and empty target before restoring; no unrestricted migration loop',async()=>{
 const source=await readFile(new URL('scripts/supplier-observed-upgrade-rehearsal.mjs',api),'utf8');
 assert.ok(source.indexOf('verifyObservedDelta(files,ledger,sources)')<source.indexOf('await client.connect()'));
 assert.ok(source.indexOf('await assertEmptyEnterpriseE2eDatabase')<source.indexOf('await client.query(sql)'));
 assert.match(source,/'--only',id/);assert.match(source,/s7-loopback-only/);assert.doesNotMatch(source,/get_connection_string|neonctl|SUPPLIER_REQUEST_CANCELLATION_ENABLED|CREATE ROLE/);
});
