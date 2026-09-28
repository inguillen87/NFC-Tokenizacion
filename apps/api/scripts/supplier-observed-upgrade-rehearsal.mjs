import assert from 'node:assert/strict';
import {open,readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {readEnterpriseEphemeralE2eConfig,assertEmptyEnterpriseE2eDatabase} from './lib/enterprise-ephemeral-e2e-safety.mjs';
import {verifyObservedSchema,verifyObservedDelta,assertObservedRehearsalTarget,parseObservedRehearsalArgs,observedChildEnvironment,OBSERVED_SCHEMA_MAX_BYTES,OBSERVED_SCHEMA_SHA256,OBSERVED_DELTA_HASHES} from './lib/supplier-observed-upgrade.mjs';
const apiRoot=fileURLToPath(new URL('../',import.meta.url));
export async function main(args=process.argv.slice(2)){
 const checks=[],report={protocol:'nexid.observed-schema-upgrade.v1',ok:false,sourceSchemaSha256:OBSERVED_SCHEMA_SHA256,customerRowsCopied:false,syntheticBusinessRecords:false,productionExecutionAllowed:false,liveRuntimeRoleVerified:false,checks};
 let client,stage='input';
 const check=(condition,name)=>{assert.ok(condition,name);checks.push(name);};
 try{
  const path=parseObservedRehearsalArgs(args),config=readEnterpriseEphemeralE2eConfig(process.env);
  const file=await open(resolve(path),'r');let sql;
  try{const stat=await file.stat();if(!stat.isFile()||stat.size>OBSERVED_SCHEMA_MAX_BYTES)throw Error('observed_schema_size_invalid');const buffer=Buffer.alloc(OBSERVED_SCHEMA_MAX_BYTES+1);const result=await file.read(buffer,0,buffer.length,0);sql=verifyObservedSchema(buffer.subarray(0,result.bytesRead));}finally{await file.close();}
  const ledger=JSON.parse(await readFile(new URL('../tests/fixtures/supplier-upgrade-ledger.json',import.meta.url),'utf8')).ledgerIds;
  const files=(await readdir(join(apiRoot,'db/migrations'))).filter(n=>n.endsWith('.sql')).sort(),sources={};
  for(const id of Object.keys(OBSERVED_DELTA_HASHES))sources[id]=await readFile(join(apiRoot,'db/migrations',id),'utf8');
  const plan=verifyObservedDelta(files,ledger,sources);check(true,'Pinned schema, 79 ledger IDs and five migration hashes validated before SQL');
  stage='local_target';client=new pg.Client({connectionString:config.databaseUrl,connectionTimeoutMillis:5000,query_timeout:60000});await client.connect();
  await assertEmptyEnterpriseE2eDatabase(client,config);
  const target=(await client.query("SELECT current_database() database_name,current_user database_role,host(inet_server_addr()) host,current_setting('neon.endpoint_id',true) neon_endpoint_id,current_setting('server_version_num')::int server_version_number")).rows[0];
  const roles=(await client.query("SELECT rolname,rolcanlogin,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname IN ('neondb_owner','cloud_admin','neon_superuser')")).rows;
  const siblings=(await client.query("SELECT datname FROM pg_database WHERE NOT datistemplate AND datname NOT IN ('postgres',current_database())")).rows;
  assertObservedRehearsalTarget(config,target,roles,siblings);check(true,'Empty isolated loopback 17.11 database and NOLOGIN ownership placeholders verified');
  stage='restore_schema';await client.query(sql);check(true,'Observed schema restored verbatim without customer rows');
  const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
  check(tables.length===162,'Observed baseline contains 162 public base tables');
  for(const table of tables){assert.match(table,/^[a-z_][a-z0-9_]*$/);check((await client.query(`SELECT NOT EXISTS(SELECT 1 FROM public."${table}" LIMIT 1) empty`)).rows[0].empty,'No baseline data in '+table);}
  for(const id of ledger)await client.query('INSERT INTO public.schema_migrations(id) VALUES($1)',[id]);
  const run=id=>spawnSync(process.execPath,['--require',resolve(apiRoot,'../../scripts/qa/s7-loopback-only.cjs'),join(apiRoot,'scripts/db-apply.mjs'),'--only',id],{cwd:apiRoot,env:observedChildEnvironment(config),encoding:'utf8',timeout:90000,maxBuffer:512*1024,windowsHide:true});
  const executed=[];stage='nominated_delta';
  for(const id of plan.pending){const result=run(id);if(result.status!==0)throw Error('observed_rehearsal_runner_failed');const applied=[...result.stdout.matchAll(/Applying ([A-Za-z0-9_]+\.sql)\.\.\./g)].map(m=>m[1]);assert.deepEqual(applied,[id]);executed.push(id);check(true,'Canonical runner applied only '+id);}
  const after=(await client.query('SELECT id FROM public.schema_migrations ORDER BY id')).rows.map(r=>r.id);assert.deepEqual(after,[...ledger,...plan.pending].sort());check(true,'Only five nominated ledger entries added, 48 historical gaps retained');
  stage='idempotent_repetition';
  for(const id of plan.pending){const result=run(id);assert.equal(result.status,0);assert.ok(!result.stdout.includes('Applying '));}check(true,'Second delta run executes no migration SQL');
  for(const table of ['supplier_request_quote_events','supplier_request_binding_events','supplier_delivery_ack_events'])check((await client.query(`SELECT NOT EXISTS(SELECT 1 FROM public.${table}) empty`)).rows[0].empty,'New event table remains empty: '+table);
  const columns=(await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_requests'")).rows.map(r=>r.column_name);check(['cancelled_at','cancelled_by','cancellation_reason'].every(c=>columns.includes(c)),'Cancellation columns installed on the observed baseline');
  report.migrations=plan.migrations;report.baselineTables=tables.length;report.ledgerBefore=ledger.length;report.ledgerAfter=after.length;report.historicalGapsRetained=plan.historicalGaps.length;report.ok=true;stage='complete';
 }catch(error){report.reason=/^observed_[a-z_]+$/.test(error.message)?error.message:'observed_rehearsal_failed';report.sqlState=/^[A-Z0-9]{5}$/.test(error.code||'')?error.code:null;}
 finally{await client?.end().catch(()=>{});}
 report.stage=stage;console.log(JSON.stringify(report,null,2));return report.ok?0:1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().then(code=>{process.exitCode=code;});
