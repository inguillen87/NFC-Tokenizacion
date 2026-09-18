// Explicit local full-stack fixture: production is never a valid target.
import http from 'node:http';import {mkdtemp,readFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {randomBytes} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';
import {readStudio,studioReadView,mutateStudio,studioFailure} from '../src/lib/passport-editorial-service.ts';
const tools=process.env.LOCAL_PG_TOOLS;if(!tools)throw new Error('Local tools path required');
const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href),{default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
const dir=await mkdtemp(join(tmpdir(),'nexid-passport-browser-')),password=randomBytes(24).toString('hex'),port=15444;
const cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_browser');
const pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_browser',max:6});
const tenant='10000000-0000-4000-8000-000000000001',batch='20000000-0000-4000-8000-000000000001',bid='QA-PASSPORT';
await pool.query('CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text); CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),bid text,sdm_config jsonb)');
await pool.query('INSERT INTO tenants VALUES($1,$2,$3)',[tenant,'qa-company','Empresa QA · datos sintéticos']);
const seed={product_name:'Semilla Horizonte · QA',public_lot_label:'LOTE-QA-01',sku:'SEM-QA-01',winery:'Semillas de prueba',region:'Región declarada',meta_setting:'LOCAL_TEST_ONLY',sun:{product:{name:'Semilla Horizonte · QA'},security:{sentinel:true}},agro_product_profile:{schemaVersion:'agro-dpp-v1',crop:'Maíz',seedVariety:'Variedad de prueba',productName:'Semilla Horizonte · QA',brand:'Semillas de prueba',sku:'SEM-QA-01',batchLot:'LOTE-QA-01'}};
await pool.query('INSERT INTO batches VALUES($1,$2,$3,$4)',[batch,tenant,bid,seed]);
await pool.query(await readFile(new URL('../db/migrations/20260918120000_0104_passport_editorial.sql',import.meta.url),'utf8'));
await pool.query(await readFile(new URL('../db/migrations/20260918123000_0105_passport_editorial_guards.sql',import.meta.url),'utf8'));
const undo=installEphemeralE2eSqlExecutor(async(parts,...values)=>{let text='';for(let i=0;i<parts.length;i++){text+=parts[i];if(i<values.length)text+='$'+(i+1);}return (await pool.query(text,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:qa@127.0.0.1/nexid_e2e_browser'});
let reads=0,writes=0,loseNext=false;const calls=[];
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost:4193'),path=url.pathname;
 const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(path==='/qa-state')return reply(200,{reads,writes,calls,head:(await pool.query('SELECT draft,published_version FROM passport_editorial_heads')).rows[0],product:(await pool.query('SELECT sdm_config FROM batches WHERE id=$1',[batch])).rows[0].sdm_config,historyCount:Number((await pool.query('SELECT count(*) n FROM passport_editorial_history')).rows[0].n)});
 if(path==='/qa-lose-next'&&req.method==='POST'){loseNext=true;return reply(200,{ok:true});}
 if(path==='/qa-shutdown'&&req.method==='POST'){reply(200,{ok:true});server.close();undo();await pool.end();await cluster.stop();return;}
 const token=req.headers.authorization||'',who=token==='Bearer local-studio-editor'?'editor':token==='Bearer local-studio-reviewer'?'reviewer':token==='Bearer local-studio-viewer'?'viewer':null;
 if(!who)return reply(401,{ok:false});
 const actor={actorId:'qa_'+who,label:who==='editor'?'Editor de producto QA':who==='reviewer'?'Revisor independiente QA':'Consulta QA',canEdit:who!=='viewer',canReview:who!=='viewer',canPublish:who!=='viewer'};
 if(path==='/auth/session')return reply(200,{ok:true,session:{id:actor.actorId,email:who+'@example.invalid',label:actor.label,role:'tenant-admin',tenantId:tenant,tenantSlug:'qa-company',permissions:who==='viewer'?['batches:read']:['*'],deniedPermissions:[],mfaVerified:true,setupCompleted:true,isDemo:false}});
 if(path.startsWith('/admin/batches/'+bid+'/passport-editorial')){
  try{if(req.method==='GET'){reads++;return reply(200,studioReadView(await readStudio('qa-company',bid),actor));}
  if(req.method==='POST'){let body='';for await(const c of req)body+=c;if(body.length>98304)return reply(413,{ok:false});const command=JSON.parse(body),action=path.split('/').at(-1);calls.push({who,action,operationId:command.operationId});const result=await mutateStudio('qa-company',bid,actor,command,action);writes++;if(loseNext){loseNext=false;return reply(503,{ok:false,reason:'simulated_lost_response_after_commit'});}return reply(200,result);}
  }catch(error){const f=studioFailure(error);return reply(f.status,{ok:false,...f});}
 }
 return reply(503,{ok:false,reason:'fixture_route_not_implemented'});
});
server.listen(4193,'127.0.0.1',()=>console.log('LOCAL_STUDIO_FULLSTACK_READY_4193_POSTGRES_15444'));
