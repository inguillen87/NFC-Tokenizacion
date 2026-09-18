// LOCAL QA ONLY: synthetic sessions + actual editorial service and disposable PostgreSQL.
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';
import {readStudio,studioReadView,mutateStudio,studioFailure} from '../src/lib/passport-editorial-service.ts';
const tools=process.env.LOCAL_PG_TOOLS;assert.ok(tools);
const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href);
const {default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
const dir=await mkdtemp(join(tmpdir(),'nexid-studio-browser-pg-')),password=randomBytes(24).toString('hex'),port=15441;
const cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_studio_ui');
const pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_studio_ui',max:12});
await pool.query('CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text); CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),bid text,sdm_config jsonb);');
const tenantId='10000000-0000-4000-8000-000000000001',batchId='20000000-0000-4000-8000-000000000001';
const config={product_name:'Semilla de prueba local',public_lot_label:'LOTE-QA',sku:'SKU-QA',winery:'Marca QA',region:'Origen declarado',agro_product_profile:{schemaVersion:'agro-dpp-v1',crop:'Cultivo QA'},meta_key_identifier:'SENTINEL_PRIVATE_FIELD',read_counter:321};
await pool.query('INSERT INTO tenants VALUES($1,$2,$3)',[tenantId,'qa-company','Empresa QA · datos sintéticos']);
await pool.query('INSERT INTO batches VALUES($1,$2,$3,$4)',[batchId,tenantId,'QA-STUDIO',JSON.stringify(config)]);
await pool.query(await readFile(new URL('../db/migrations/20260918120000_0104_passport_editorial.sql',import.meta.url),'utf8'));
const undo=installEphemeralE2eSqlExecutor(async(strings,...values)=>{const text=strings.reduce((s,part,i)=>s+part+(i<values.length?'$'+(i+1):''),'');return (await pool.query(text,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:local@127.0.0.1/nexid_e2e_studio_ui'});
const actors={editor:{actorId:'user_qa_editor',label:'Editor QA',canEdit:true,canReview:true,canPublish:true},reviewer:{actorId:'user_qa_reviewer',label:'Revisor QA',canEdit:false,canReview:true,canPublish:false},publisher:{actorId:'user_qa_publisher',label:'Publicador QA',canEdit:true,canReview:false,canPublish:true},viewer:{actorId:'user_qa_viewer',label:'Consulta QA',canEdit:false,canReview:false,canPublish:false}};
const calls=[];
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4194');
 const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(url.pathname==='/qa-reset'&&req.method==='POST'){
   const db=(await pool.query('SELECT current_database() name')).rows[0].name;
   if(db!=='nexid_e2e_studio_ui')return reply(403,{ok:false});
   await pool.query('DELETE FROM passport_editorial_receipts WHERE batch_id=$1',[batchId]);
   await pool.query('DELETE FROM passport_editorial_history WHERE batch_id=$1',[batchId]);
   await pool.query('DELETE FROM passport_editorial_heads WHERE batch_id=$1',[batchId]);
   await pool.query('DELETE FROM batches WHERE id=$1',[batchId]);
   await pool.query('INSERT INTO batches(id,tenant_id,bid,sdm_config) VALUES($1,$2,$3,$4)',[batchId,tenantId,'QA-STUDIO',JSON.stringify(config)]);
   calls.length=0;return reply(200,{localOnly:true,reset:true});
 }
 if(url.pathname==='/qa-state'){const r=(await pool.query("SELECT (SELECT count(*)::int FROM passport_editorial_history) history,(SELECT count(*)::int FROM passport_editorial_receipts) receipts,(SELECT sdm_config->>'product_name' FROM batches LIMIT 1) product")).rows[0];return reply(200,{...r,calls,localOnly:true});}
 const role=String(req.headers.authorization||'').replace('Bearer local-studio-','');const actor=actors[role];if(!actor)return reply(401,{ok:false});
 if(url.pathname==='/auth/session'){const permissions=['batches:read',...(actor.canEdit?['batch.product.configure']:[]),...(actor.canReview?['batch.product.review']:[]),...(actor.canPublish?['batch.product.publish']:[])];return reply(200,{ok:true,session:{id:'local-session-'+role,userId:actor.actorId,email:'qa@example.invalid',role:'tenant-admin',tenantId,tenantSlug:'qa-company',label:actor.label,permissions,deniedPermissions:[],mfaVerified:true,setupCompleted:true,isDemo:false}});}
 try{const match=/^\/admin\/batches\/QA-STUDIO\/passport-editorial(?:\/([^/]+))?$/.exec(url.pathname);
  if(match){if(req.method==='GET')return reply(200,studioReadView(await readStudio('qa-company','QA-STUDIO'),actor));
   if(req.method==='POST'&&match[1]){let text='';for await(const chunk of req){text+=chunk;if(text.length>98304)throw new Error('oversize');}const body=JSON.parse(text);calls.push({action:match[1],actor:role,id:body.operationId});return reply(200,await mutateStudio('qa-company','QA-STUDIO',actor,body,match[1]));}}
  return reply(503,{ok:false,reason:'local_fixture_not_implemented'});
 }catch(e){const failure=studioFailure(e);return reply(failure.status,{ok:false,...failure});}
});
server.listen(4194,'127.0.0.1',()=>console.log('LOCAL_STUDIO_REAL_POSTGRES_READY_4194'));
let stopping=false;async function stop(){if(stopping)return;stopping=true;server.close();undo();await pool.end();await cluster.stop();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
