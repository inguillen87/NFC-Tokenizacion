// Only local disposable PostgreSQL and synthetic sessions. Actual handlers, source tables and SQL functions.
import {mkdtemp,readFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {randomBytes} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';import {handleCampaignLaunch} from '../src/lib/campaign-launch-http.ts';
export const T='10000000-0000-4000-8000-000000000001',DRAFT='20000000-0000-4000-8000-000000000001',E='30000000-0000-4000-8000-000000000001',R='30000000-0000-4000-8000-000000000002',V='30000000-0000-4000-8000-000000000003';
export async function createLaunchFixture(port=15461){
 const tools=process.env.LOCAL_PG_TOOLS;if(!tools)throw Error('LOCAL_PG_TOOLS_required');
 const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href),{default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
 const dir=await mkdtemp(join(tmpdir(),'nexid-s7-local-')),password=randomBytes(24).toString('hex');
 const cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
 await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_campaign_launch');const pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_campaign_launch',max:8});
 const query=async(text,values=[])=>{try{return await pool.query(text,values);}catch(e){console.log('LOCAL_LAUNCH_SQL',e.code,e.message);throw e;}};
 await query(`CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text);
 CREATE TABLE consumers(id uuid PRIMARY KEY,email text,phone text);
 CREATE TABLE tenant_consumer_memberships(tenant_id uuid,consumer_id uuid,status text,last_activity_at timestamptz,UNIQUE(tenant_id,consumer_id));
 CREATE TABLE consumer_tenant_consents(tenant_id uuid,consumer_id uuid,scope text,granted boolean,granted_at timestamptz,revoked_at timestamptz,UNIQUE(tenant_id,consumer_id,scope));
 CREATE TABLE batches(id uuid PRIMARY KEY,status text,sdm_config jsonb);CREATE TABLE tags(id uuid PRIMARY KEY,batch_id uuid,status text,read_counter int);`);
 await query('INSERT INTO tenants VALUES($1,$2,$3)',[T,'campaign-qa','Empresa local QA']);
 await query("INSERT INTO tenants VALUES('10000000-0000-4000-8000-000000000002','other-company','Otra empresa QA')");
 for(const u of [E,R,V])await query('INSERT INTO users VALUES($1)',[u]);
 await query(await readFile(new URL('../db/migrations/20260906120000_0102_campaign_drafts.sql',import.meta.url),'utf8'));
 await query("INSERT INTO campaign_drafts(id,tenant_id,title,message,channel,created_by,updated_by,created_by_label,updated_by_label,create_idempotency_key,create_fingerprint) VALUES($1,$2,'Campaña local de fidelización','Novedad de producto y beneficios para clientes que autorizaron comunicaciones.','email',$3,$3,'Editor QA','Editor QA','local-seed-key',repeat('a',64))",[DRAFT,T,E]);
 const names=['alpha@example.invalid','beta@example.invalid','ALPHA@example.invalid','gamma@example.invalid','delta@example.invalid','inactive@example.invalid','not-an-email','revoked@example.invalid','future@example.invalid'];
 for(let i=1;i<=9;i++){
  const id='40000000-0000-4000-8000-'+String(i).padStart(12,'0');
  await query('INSERT INTO consumers VALUES($1,$2,$3)',[id,names[i-1],'+5492610000'+String(i).padStart(3,'0')]);
  await query('INSERT INTO tenant_consumer_memberships VALUES($1,$2,$3,now())',[T,id,i===6?'inactive':'active']);
  if(i!==5)await query("INSERT INTO consumer_tenant_consents VALUES($1,$2,'email_marketing',true,CASE WHEN $3::int=9 THEN now()+interval '1 day' ELSE now()-interval '1 day' END,CASE WHEN $3::int=8 THEN now() ELSE NULL END)",[T,id,i]);
 }
 await query("INSERT INTO batches VALUES('50000000-0000-4000-8000-000000000001','active','{\"ttstatus_source\":\"enc_decrypted\",\"sentinel\":\"local_only\"}')");
 await query("INSERT INTO tags VALUES('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','active',42)");
 await query(await readFile(new URL('../db/migrations/20260918210000_0107_campaign_launch_review.sql',import.meta.url),'utf8'));
 const uninstall=installEphemeralE2eSqlExecutor(async(strings,...values)=>{const text=strings.reduce((s,p,i)=>s+p+(i<values.length?'$'+(i+1):''),'');return (await query(text,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:local@127.0.0.1/nexid_e2e_campaign_launch'});
 function session(token){const who=String(token).replace('qa-launch-','');if(!['editor','reviewer','viewer','nomfa','denied'].includes(who))return null;return {id:'local-'+who,userId:who==='editor'?E:who==='viewer'?V:R,email:who+'@example.invalid',label:who==='editor'?'Editor QA':who==='viewer'?'Consulta QA':'Revisor QA',role:who==='editor'||who==='viewer'?'marketing-manager':'tenant-admin',tenantId:T,tenantSlug:'campaign-qa',permissions:['campaigns:read','reports.export',...(who==='viewer'?[]:['campaigns:write'])],deniedPermissions:who==='denied'?['campaigns:approve']:[],mfaVerified:who!=='nomfa',setupCompleted:true,isDemo:false,expiresAt:new Date(Date.now()+3600000).toISOString(),rotatedCookieValue:null};}
 async function request(path,who='editor',body){const req=new Request('http://127.0.0.1:4295'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer qa-launch-'+who,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const m=/^\/admin\/campaigns\/launch(?:\/([^/?]+))?(?:\/([^/?]+))?/.exec(path);if(!m)throw Error('unknown_route');return handleCampaignLaunch(req,m[1],body?m[2]:undefined,async token=>session(token));}
 return {query,pool,request,session,close:async()=>{uninstall();await pool.end();await cluster.stop();}};
}
