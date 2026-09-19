// Entirely disposable local PostgreSQL and synthetic identities. Actual handlers and SQL run unchanged.
import {mkdtemp,readFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {randomBytes} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';
import {handleRecall} from '../src/lib/recall-http.ts';
import {publicRecallNotices} from '../src/lib/recall-service.ts';
export const T='10000000-0000-4000-8000-000000000001',B='20000000-0000-4000-8000-000000000001';
export const E='30000000-0000-4000-8000-000000000001',R='30000000-0000-4000-8000-000000000002',V='30000000-0000-4000-8000-000000000003';
export async function createRecallFixture(port=15451){
 const tools=process.env.LOCAL_PG_TOOLS;if(!tools)throw Error('LOCAL_PG_TOOLS_required');
 const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href),{default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
 const dir=await mkdtemp(join(tmpdir(),'nexid-recalls-local-')),password=randomBytes(24).toString('hex');
 const cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
 await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_recalls');
 const pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_recalls',max:8});
 const query=async(s,v=[])=>{try{return await pool.query(s,v);}catch(e){console.log('LOCAL_RECALL_SQL_ERROR',e.code,e.message);throw e;}};
 await query(`CREATE TABLE users(id uuid PRIMARY KEY,full_name text,admin_status text);CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text);CREATE TABLE memberships(user_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),role text);
 CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),bid text,status text,sdm_config jsonb);CREATE TABLE tags(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),batch_id uuid,status text,tt_state text,read_counter int);`);
 await query('INSERT INTO tenants VALUES($1,$2,$3)',[T,'recall-qa','Empresa de pruebas local']);
 for(const [id,name] of [[E,'Operaciones QA'],[R,'Responsable QA'],[V,'Consulta QA']]){await query("INSERT INTO users VALUES($1,$2,'active')",[id,name]);await query("INSERT INTO memberships VALUES($1,$2,'tenant_admin')",[id,T]);}
 await query("INSERT INTO batches VALUES($1,$2,'LOT-RECALL-QA','active',$3)",[B,T,{product_name:'Producto piloto local',ttstatus_source:'enc_decrypted',ttstatus_closed_values:['4343'],ttstatus_opened_values:['4F4F','4F43'],technical_sentinel:'LOCAL_ONLY'}]);
 await query("INSERT INTO tags(batch_id,status,tt_state,read_counter) SELECT $1,'active','CLOSED',n FROM generate_series(1,10) n",[B]);
 await query(await readFile(new URL('../db/migrations/20260918180000_0106_batch_recall_workflow.sql',import.meta.url),'utf8'));
 await query(await readFile(new URL('../db/migrations/20260918224500_0108_recall_notice_reviews.sql',import.meta.url),'utf8'));
 const uninstall=installEphemeralE2eSqlExecutor(async(strings,...values)=>{const q=strings.reduce((s,v,i)=>s+v+(i<values.length?'$'+(i+1):''),'');return (await query(q,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:local@127.0.0.1/nexid_e2e_recalls'});
 function session(token){const role=String(token).replace('qa-recall-','');if(!['editor','reviewer','viewer'].includes(role))return null;const read=['incidents:read','batches:read','reports.export'];return {id:'qa-'+role,userId:role==='editor'?E:role==='reviewer'?R:V,email:role+'@example.invalid',label:role==='editor'?'Operaciones QA':role==='reviewer'?'Responsable QA':'Consulta QA',role:role==='viewer'?'security-analyst':'tenant-admin',tenantId:T,tenantSlug:'recall-qa',permissions:role==='viewer'?read:[...read,'incidents:write','batch.product.publish'],deniedPermissions:[],mfaVerified:true,setupCompleted:true,isDemo:false,expiresAt:new Date(Date.now()+3600000).toISOString(),rotatedCookieValue:null};}
 async function request(path,who='editor',body=null){const req=new Request('http://127.0.0.1:4220'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer qa-recall-'+who,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const m=/^\/admin\/batches\/([^/]+)\/recalls(?:\/([^/?]+))?/.exec(path);if(!m)throw Error('unknown_test_route');return handleRecall(req,m[1],body?m[2]:undefined,body?undefined:m[2],async token=>session(token));}
 return {pool,query,session,request,publicNotice:()=>publicRecallNotices('recall-qa','LOT-RECALL-QA'),close:async()=>{uninstall();await pool.end();await cluster.stop();}};
}
