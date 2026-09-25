import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {readEnterpriseEphemeralE2eConfig,assertEmptyEnterpriseE2eDatabase} from './lib/enterprise-ephemeral-e2e-safety.mjs';
import {planSupplierUpgrade,SUPPLIER_UPGRADE_DELTA} from './lib/supplier-upgrade-plan.mjs';
import {canonicalMigrationSql} from './lib/migration-source.mjs';
const apiRoot=fileURLToPath(new URL('../',import.meta.url));
const checks=[];let client,staging,stage='target_validation';
const report={harness:'nexid.supplier-upgrade-acceptance.v1',ok:false,localOnly:true,liveSchemaCopied:false,productionDatabaseUsed:false,syntheticPreexistingRecords:true,observedLedgerUsedOnlyAsFixture:true,checks};
const hash=text=>createHash('sha256').update(text).digest('hex');
function check(ok,name){assert.ok(ok,name);checks.push(name);}
function sourceCommand(config,cwd,args){
 const os=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|CI)$/i.test(key)));
 const result=spawnSync(process.execPath,[resolve(apiRoot,'../../scripts/qa/s7-loopback-only.cjs').replace(/s7-loopback-only\.cjs$/,'s7-loopback-only.cjs')],{encoding:'utf8'});
 // db-apply's target is fixed to the previously validated isolated connection.
 return spawnSync(process.execPath,['--require',resolve(apiRoot,'../../scripts/qa/s7-loopback-only.cjs'),join(apiRoot,'scripts/db-apply.mjs'),...args],{cwd,env:{...os,NODE_ENV:'test',VERCEL_ENV:'test',DATABASE_URL:config.databaseUrl,NEXID_E2E_DATABASE_URL:config.databaseUrl,NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_EXPECTED_POSTGRES_VERSION:config.expectedPostgresVersion},encoding:'utf8',timeout:180000,maxBuffer:512*1024,windowsHide:true});
}
function requireSuccess(result,label){if(result.status!==0){const code=String(result.stderr).match(/code: ['"]([A-Z0-9]{5})['"]/)?.[1]||'unknown';throw Error('upgrade_runner_failed:'+label+':'+code);}return [...String(result.stdout).matchAll(/Applying ([A-Za-z0-9_]+\.sql)\.\.\./g)].map(m=>m[1]);}
const tables=['users','memberships','auth_sessions','resource_permissions','supplier_requests','supplier_request_operations','supplier_request_reviews','supplier_request_review_events','supplier_request_assignments','supplier_request_assignment_events','audit_logs','tickets','carrier_profiles','ledger_providers'];
const originalColumns=new Map();
async function preserveSnapshot(){
 const results={};
 for(const table of tables){
  if(!originalColumns.has(table))originalColumns.set(table,(await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[table])).rows.map(r=>r.column_name));
  const row=(await client.query(`SELECT md5(COALESCE(jsonb_agg(doc ORDER BY doc::text)::text,'[]')) digest,count(*)::int count FROM public.${table} t CROSS JOIN LATERAL(SELECT jsonb_object_agg(key,value)doc FROM jsonb_each(to_jsonb(t)) WHERE key=ANY($1::text[])) projection`,[originalColumns.get(table)])).rows[0];results[table]=row;
 }
 return results;
}
async function run(){
 if(process.argv.length>2)throw Error('supplier_upgrade_no_cli_overrides');
 const config=readEnterpriseEphemeralE2eConfig(process.env);
 client=new pg.Client({connectionString:config.databaseUrl,connectionTimeoutMillis:5000,query_timeout:12000});await client.connect();
 await assertEmptyEnterpriseE2eDatabase(client,config);stage='baseline';
 const fixture=JSON.parse(await readFile(new URL('../tests/fixtures/supplier-upgrade-ledger.json',import.meta.url),'utf8'));
 const files=(await readdir(join(apiRoot,'db/migrations'))).filter(n=>n.endsWith('.sql')).sort();const plan=planSupplierUpgrade(files,fixture.ledgerIds);
 staging=await mkdtemp(join(tmpdir(),'nexid-supplier-upgrade-source-'));await mkdir(join(staging,'db/migrations'),{recursive:true});
 for(const id of plan.baselineFiles)await writeFile(join(staging,'db/migrations',id),canonicalMigrationSql(await readFile(join(apiRoot,'db/migrations',id),'utf8')));
 const applied=requireSuccess(sourceCommand(config,staging,['--allow-empty-ephemeral-e2e-bootstrap']),'baseline');
 assert.deepEqual(applied,plan.baselineFiles);check(applied.length===files.length-5,'Complete reconstructed schema stops before 0117');
 // Only this fresh, empty-at-start test database is reshaped into the observed
 // ledger pattern. This does NOT repair or certify a remote migration ledger.
 await client.query('DELETE FROM public.schema_migrations WHERE NOT(id=ANY($1::text[]))',[fixture.ledgerIds]);
 const readLedger=async()=> (await client.query('SELECT id FROM public.schema_migrations ORDER BY id')).rows.map(r=>r.id);
 assert.deepEqual(await readLedger(),[...fixture.ledgerIds].sort());check(plan.historicalGaps.length===48,'Observed 79-entry ledger pattern and 48 historic gaps reproduced only in local fixture');
 stage='seed_preexisting';
 const tenant=randomUUID(),otherTenant=randomUUID(),actor=randomUUID(),otherActor=randomUUID(),superActor=randomUUID(),operator=randomUUID(),session=randomUUID(),superSession=randomUUID(),operatorSession=randomUUID();
 await client.query("INSERT INTO tenants(id,slug,name,root_key_ct)VALUES($1,'upgrade-qa','Upgrade QA','synthetic-not-a-key'),($2,'upgrade-other','Other QA','synthetic-not-a-key')",[tenant,otherTenant]);
 await client.query("INSERT INTO users(id,email,full_name,admin_status)VALUES($1,'upgrade-a@nexid.invalid','Upgrade A','active'),($2,'upgrade-b@nexid.invalid','Upgrade B','active'),($3,'upgrade-admin@nexid.invalid','Upgrade Admin','active'),($4,'upgrade-tech@nexid.invalid','Upgrade Technician','active')",[actor,otherActor,superActor,operator]);
 await client.query("INSERT INTO memberships(user_id,tenant_id,role)VALUES($1,$2,'operations_manager'),($3,$4,'operations_manager'),($5,NULL,'super_admin'),($6,NULL,'supplier_operator')",[actor,tenant,otherActor,otherTenant,superActor,operator]);
 for(const [sid,uid,tid,role]of [[session,actor,tenant,'operations_manager'],[superSession,superActor,null,'super_admin'],[operatorSession,operator,null,'supplier_operator']])await client.query("INSERT INTO auth_sessions(id,user_id,tenant_id,role,session_token_hash,expires_at)VALUES($1::uuid,$2,$3,$4,encode(sha256(convert_to(($1::uuid)::text,'UTF8')),'hex'),now()+interval '1 hour')",[sid,uid,tid,role]);
 const command=(action='create',patch={})=>({action,tenant_id:tenant,actor_id:actor,auth_session_id:session,request_id:null,idempotency_key:randomUUID(),expected_revision:null,content:{title:'Existing request before upgrade',construction_id:'pet_wet',quantity:12,pack_purpose:'trial_integration',notes:'Original description must survive the upgrade.'},...patch});
 const mutate=async input=>(await client.query('SELECT public.nexid_mutate_supplier_request_v1($1::jsonb) r',[JSON.stringify(input)])).rows[0].r;
 const draftInput=command(),draft=await mutate(draftInput),created=await mutate(command());assert.equal(created.ok,true);assert.equal(draft.ok,true);
 const submitInput=command('submit',{request_id:created.request.id,expected_revision:1,content:null}),submitted=await mutate(submitInput);assert.equal(submitted.ok,true);
 const review={tenant_id:tenant,request_id:submitted.request.id,actor_id:superActor,auth_session_id:superSession,idempotency_key:randomUUID(),action:'request_information',expected_revision:0,expected_request_revision:2,message:'Please confirm this synthetic legacy request.'};
 const reviewed=(await client.query('SELECT public.nexid_mutate_supplier_request_review_v1($1::jsonb) r',[JSON.stringify(review)])).rows[0].r;assert.equal(reviewed.ok,true);
 const assignment={tenant_id:tenant,request_id:submitted.request.id,actor_id:superActor,auth_session_id:superSession,idempotency_key:randomUUID(),operator_id:operator,expected_revision:0,expected_request_revision:2};
 const assigned=(await client.query('SELECT public.nexid_mutate_supplier_request_assignment_v1($1::jsonb) r',[JSON.stringify(assignment)])).rows[0].r;assert.equal(assigned.ok,true);
 await client.query("INSERT INTO tickets(id,tenant_id,contact,title,detail,status)VALUES($1,$2,'synthetic@nexid.invalid','Existing ticket','Pre-upgrade text','open')",[randomUUID(),tenant]);
 const before=await preserveSnapshot();check(before.supplier_requests.count===2&&before.supplier_request_review_events.count===1&&before.supplier_request_assignment_events.count===1,'Legacy draft, submitted request, clarification, assignment and ticket exist before migration');
 stage='unscoped_refusal';
 const refused=sourceCommand(config,apiRoot,[]);check(refused.status!==0&&/historical gap/.test(refused.stderr),'Unscoped canonical runner refuses the historic gaps instead of replaying them');
 assert.deepEqual(await preserveSnapshot(),before);assert.deepEqual(await readLedger(),[...fixture.ledgerIds].sort());check(true,'Rejected blanket migration leaves both data and ledger unchanged');
 for(const id of ['20260923180000_0115_supplier_operator_role_enum.sql','20260923180100_0116_supplier_request_assignments.sql'])assert.deepEqual(requireSuccess(sourceCommand(config,apiRoot,['--only',id]),'already_recorded'),[]);
 check(true,'Already-recorded 0115/0116 produce no migration execution');
 stage='atomic_failure';
 const beforeFn=(await client.query("SELECT md5(pg_get_functiondef('public.nexid_supplier_request_guard_v1()'::regprocedure)) h")).rows[0].h;
 await client.query("ALTER TABLE schema_migrations ADD CONSTRAINT upgrade_test_ledger_failure CHECK(id<>'20260924010000_0117_supplier_request_cancellation.sql') NOT VALID");
 try{const failed=sourceCommand(config,apiRoot,['--only',SUPPLIER_UPGRADE_DELTA[0]]);check(failed.status!==0&&/23514/.test(failed.stderr),'Injected ledger failure rejects 0117 after its DDL, testing the actual runner transaction');}
 finally{await client.query('ALTER TABLE schema_migrations DROP CONSTRAINT upgrade_test_ledger_failure');}
 const rolled=(await client.query("SELECT NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_requests' AND column_name='cancelled_at') columns_rolled_back,md5(pg_get_functiondef('public.nexid_supplier_request_guard_v1()'::regprocedure)) h")).rows[0];
 check(rolled.columns_rolled_back&&rolled.h===beforeFn,'Failed ledger write rolls back added columns and function changes');assert.deepEqual(await preserveSnapshot(),before);assert.deepEqual(await readLedger(),[...fixture.ledgerIds].sort());
 stage='exact_delta';const executed=[],sources=[];
 for(const id of plan.pending){const source=canonicalMigrationSql(await readFile(join(apiRoot,'db/migrations',id),'utf8'));sources.push({id,sha256:hash(source)});executed.push(...requireSuccess(sourceCommand(config,apiRoot,['--only',id]),id));const afterStep=await preserveSnapshot();for(const table of tables)assert.equal(JSON.stringify(afterStep[table]),JSON.stringify(before[table]),'upgrade_changed_existing_'+table);}
 assert.deepEqual(executed,SUPPLIER_UPGRADE_DELTA);check(true,'Only the five nominated migrations ran, preserving all baseline business and identity records after each step');
 const after=await readLedger();assert.deepEqual(after,[...fixture.ledgerIds,...SUPPLIER_UPGRADE_DELTA].sort());check(after.length===84,'The local observed-ledger fixture advances from 79 to 84, not to 132');
 const remaining=planSupplierUpgrade(files,after);check(remaining.pending.length===0&&remaining.historicalGaps.length===48,'Historic gaps remain documented rather than falsely ledgered as repaired');
 for(const id of SUPPLIER_UPGRADE_DELTA)assert.deepEqual(requireSuccess(sourceCommand(config,apiRoot,['--only',id]),'repeat_'+id),[]);
 assert.deepEqual(await preserveSnapshot(),before);check(true,'Repeating the approved delta is a ledger no-op with unchanged existing records');
 const defaults=(await client.query("SELECT bool_and(quotation_revision=0 AND quotation_state IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL) unchanged FROM supplier_requests")).rows[0].unchanged;
 check(defaults===true,'New fields on legacy requests start with no quotation or cancellation claims');
 check((await client.query('SELECT (SELECT count(*) FROM supplier_request_quote_events)+(SELECT count(*) FROM supplier_request_binding_events)+(SELECT count(*) FROM supplier_delivery_ack_events) n')).rows[0].n==='0','Applying migrations does not invent commercial events');
 stage='existing_record_compatibility';
 const replay=await mutate(submitInput);check(replay.ok&&replay.idempotent_replay&&replay.request.id===submitted.request.id,'Old submission receipt remains recoverable after schema upgrade');
 const draftReplay=await mutate(draftInput);check(draftReplay.ok&&draftReplay.idempotent_replay&&draftReplay.request.id===draft.request.id,'Old draft creation receipt is preserved');
 const assignedRead=(await client.query('SELECT public.nexid_supplier_request_assigned_current_v1($1,$2,$3) r',[submitted.request.id,operator,operatorSession])).rows[0].r;check(assignedRead?.id===submitted.request.id,'Existing limited technician assignment stays readable after upgrade');
 const cancelled=(await client.query('SELECT public.nexid_cancel_supplier_request_v1($1::jsonb) r',[JSON.stringify({tenant_id:tenant,request_id:submitted.request.id,actor_id:actor,auth_session_id:session,idempotency_key:randomUUID(),expected_revision:2,expected_review_revision:1,reason:'Synthetic acceptance cancellation after upgrade.'})])).rows[0].r;
 check(cancelled.ok&&cancelled.request.status==='cancelled','New cancellation works against the pre-existing submitted request, not only newly created records');
 check((await client.query('SELECT public.nexid_supplier_request_assigned_current_v1($1,$2,$3) r',[submitted.request.id,operator,operatorSession])).rows[0].r===null,'Cancellation removes technician access without deleting earlier assignment history');
 check((await client.query('SELECT count(*)::int n FROM supplier_request_review_events WHERE request_id=$1',[submitted.request.id])).rows[0].n===1,'Original clarification event remains after cancellation');
 report.ok=true;Object.assign(report,{sourceMigrations:files.length,reconstructedBaseline:plan.baselineFiles.length,fixtureLedgerBefore:fixture.ledgerIds.length,fixtureLedgerAfter:after.length,historicalGapsLeft:remaining.historicalGaps.length,executed,sources,baselineTablesCompared:tables.length,liveProductionSchemaVerified:false,productionExecutionAllowed:false});
}
try{await run();}catch(error){report.stage=stage;report.reason=/^[A-Za-z0-9_ .:\/-]{1,240}$/.test(error.message||'')?error.message:'supplier_upgrade_acceptance_failed';report.sqlstate=/^[A-Z0-9]{5}$/.test(error.code||'')?error.code:null;process.exitCode=1;}
finally{await client?.end().catch(()=>{});if(staging){assert.ok(staging.startsWith(join(tmpdir(),'nexid-supplier-upgrade-source-')));await rm(staging,{recursive:true,force:true});report.temporarySourceRemoved=true;}report.connectionsClosed=true;console.log(JSON.stringify(report));}
