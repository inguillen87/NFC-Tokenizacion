// GitHub-runner adapter for the existing S6 acceptance flow. No production connection.
import http from 'node:http';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const root=process.env.NEXID_QA_API_ROOT;
if(!root||process.argv[2]!=='--local-qa'||process.env.NEXID_E2E_CONFIRMATION!=='I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE')throw Error('Explicit local QA source required');
const url=new URL(process.env.NEXID_RECONCILIATION_QA_DATABASE_URL||'');
if(url.hostname!=='127.0.0.1'||url.username!=='nexid_e2e'||url.pathname!=='/nexid_e2e_recalls')throw Error('Exclusive empty loopback database required');
const {default:pg}=await import(pathToFileURL(join(root,'node_modules/pg/lib/index.js')).href);
const {installEphemeralE2eSqlExecutor}=await import(pathToFileURL(join(root,'apps/api/src/lib/db.ts')).href);
const {handleRecall}=await import(pathToFileURL(join(root,'apps/api/src/lib/recall-http.ts')).href);
const {handleAssignedRecall}=await import(pathToFileURL(join(root,'apps/api/src/lib/recall-task-http.ts')).href);
const {publicRecallNotices}=await import(pathToFileURL(join(root,'apps/api/src/lib/recall-service.ts')).href);
const pool=new pg.Pool({connectionString:url.toString(),max:6});
const query=(text,values=[])=>pool.query(text,values);
if(Number((await query("SELECT count(*) n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n)!==0)throw Error('Refusing a nonempty test database');
const T='10000000-0000-4000-8000-000000000001',B='20000000-0000-4000-8000-000000000001';
const E='30000000-0000-4000-8000-000000000001',R='30000000-0000-4000-8000-000000000002',V='30000000-0000-4000-8000-000000000003';
await query(`CREATE TABLE users(id uuid PRIMARY KEY,full_name text,admin_status text);CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text);CREATE TABLE memberships(user_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),role text);
CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),bid text,status text,sdm_config jsonb);CREATE TABLE tags(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),batch_id uuid,status text,tt_state text,read_counter int);`);
await query('INSERT INTO tenants VALUES($1,$2,$3)',[T,'recall-qa','Empresa de pruebas local']);
for(const [id,name] of [[E,'Operaciones QA'],[R,'Responsable QA'],[V,'Consulta QA']]){await query("INSERT INTO users VALUES($1,$2,'active')",[id,name]);await query("INSERT INTO memberships VALUES($1,$2,'tenant_admin')",[id,T]);}
await query("INSERT INTO batches VALUES($1,$2,'LOT-RECALL-QA','active',$3)",[B,T,{product_name:'Producto piloto local',ttstatus_source:'enc_decrypted',technical_sentinel:'LOCAL_ONLY'}]);
await query("INSERT INTO tags(batch_id,status,tt_state,read_counter) SELECT $1,'active','CLOSED',n FROM generate_series(1,10) n",[B]);
for(const file of ['20260918180000_0106_batch_recall_workflow.sql','20260918224500_0108_recall_notice_reviews.sql','20260919000000_0109_recall_assignee_tasks.sql'])await query((await readFile(join(root,'apps/api/db/migrations',file),'utf8')).replaceAll('\r\n','\n'));
const uninstall=installEphemeralE2eSqlExecutor(async(strings,...values)=>{const text=strings.reduce((s,v,i)=>s+v+(i<values.length?'$'+(i+1):''),'');return (await query(text,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:process.env.NEXID_E2E_CONFIRMATION,NEXID_E2E_DATABASE_URL:url.toString()});
function session(token){
 const role=String(token).replace('qa-recall-','');if(!['editor','reviewer','viewer'].includes(role))return null;
 const read=['incidents:read','batches:read','reports.export'];
 return {id:'qa-'+role,userId:role==='editor'?E:role==='reviewer'?R:V,email:role+'@example.invalid',label:role==='editor'?'Operaciones QA':role==='reviewer'?'Responsable QA':'Consulta QA',role:role==='viewer'?'security-analyst':'tenant-admin',tenantId:T,tenantSlug:'recall-qa',permissions:role==='viewer'?read:[...read,'incidents:write','batch.product.publish'],deniedPermissions:[],mfaVerified:true,setupCompleted:true,isDemo:false,expiresAt:new Date(Date.now()+3600000).toISOString(),rotatedCookieValue:null};
}
async function request(path,who='editor',body=null){
 const req=new Request('http://127.0.0.1:4681'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer qa-recall-'+who,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 const parts=new URL(req.url).pathname.split('/').filter(Boolean);
 return handleRecall(req,parts[2],body?parts[4]:undefined,body?undefined:parts[4],async token=>session(token));
}
async function taskRequest(path,body=null){
 const req=new Request('http://127.0.0.1:4681'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer qa-task-agent','content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 const parts=new URL(req.url).pathname.split('/').filter(Boolean);
 const actor={...session('qa-recall-viewer'),id:'qa-task-agent',userId:V,label:'Responsable asignado QA',role:'packaging-operator',permissions:['recall_tasks:read','recall_tasks:respond'],mfaVerified:false};
 return handleAssignedRecall(req,parts[2],parts[3],parts[4],async token=>token==='qa-task-agent'?actor:null);
}
const cid='60000000-0000-4000-8000-000000000031',cancelled='60000000-0000-4000-8000-000000000032';
const north='70000000-0000-4000-8000-000000000031',center='70000000-0000-4000-8000-000000000032',south='70000000-0000-4000-8000-000000000033';
let lost=false,unavailable=false;const calls=[];
const path='/admin/batches/LOT-RECALL-QA/recalls';
async function operation(action,extra={},who='editor',id=cid){
 const row=(await query('SELECT version FROM product_recall_cases WHERE id=$1',[id])).rows[0];
 const response=await request(path+'/'+action+'?tenant=recall-qa',who,{operationId:randomUUID(),caseId:id,expectedVersion:row?.version||0,...extra});
 if(response.status!==200)throw Error(await response.text());return response.json();
}
const doc={kind:'recall',title:'Retiro QA · conciliación de destinos',reason:'Motivo interno del caso de prueba, no publicado al consumidor.',publicMessage:'No utilizar el producto del lote mientras se revisa el aviso.',instructions:'Separar e identificar las cajas y coordinar las acciones con calidad.',contact:'Calidad · empresa QA',unitLabel:'cajas',destinations:[{id:north,recipient:'Distribuidor Norte',assigneeId:E,units:10},{id:center,recipient:'Distribuidor Centro',assigneeId:V,units:8},{id:south,recipient:'Distribuidor Sur',assigneeId:R,units:12}]};
await operation('create',{document:{...doc,title:'Borrador anterior cancelado'}},'editor',cancelled);
await operation('cancel',{reason:'Cancelación sintética previa, sin publicar.'},'editor',cancelled);
await operation('create',{document:doc});await operation('submit');await operation('publish',{},'reviewer');
for(const [id,returned,held] of [[center,3,0],[south,7,5]]){await operation('acknowledge',{destinationId:id,reason:'Acuse de recepción registrado en el ensayo.',evidenceReference:'ACK-'+id.slice(-2)});await operation('account',{destinationId:id,returnedUnits:returned,heldUnits:held,reason:'Totales acumulados iniciales del ensayo.',evidenceReference:'COUNT-'+id.slice(-2)});}
const fingerprint=async()=>createHash('sha256').update(JSON.stringify((await query('SELECT id,sdm_config FROM batches ORDER BY id')).rows)+JSON.stringify((await query('SELECT * FROM tags ORDER BY id')).rows)).digest('hex');
const before=await fingerprint();
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:4681'),reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
 try{
  if(u.pathname==='/qa-state')return reply(200,{localOnly:true,calls,cid,north,center,south,unchanged:before===await fingerprint(),case:(await query('SELECT state,version,progress,document FROM product_recall_cases WHERE id=$1',[cid])).rows[0],operations:(await query('SELECT id,action,actor_label,command FROM product_recall_operations WHERE case_id=$1 ORDER BY created_at,id',[cid])).rows,notice:await publicRecallNotices('recall-qa','LOT-RECALL-QA')});
  if(u.pathname==='/qa-mode'&&req.method==='POST'){lost=u.searchParams.get('lost')==='1';unavailable=u.searchParams.get('unavailable')==='1';return reply(200,{localOnly:true});}
  if(u.pathname==='/qa-assignee-account'&&req.method==='POST'){
   const response=await taskRequest('/admin/recall-tasks/'+cid+'/'+center);const d=await response.json();
   const r=await taskRequest('/admin/recall-tasks/'+cid+'/'+center+'/account',{operationId:randomUUID(),caseId:cid,destinationId:center,expectedVersion:d.task.version,expectedNoticeVersion:d.task.notice.version,reason:'El distribuidor confirma sus cantidades acumuladas.',evidenceReference:'AGENT-CENTER-COUNT',returnedUnits:6,heldUnits:2});
   if(r.status!==200)throw Error(await r.text());return reply(200,{localOnly:true});
  }
  if(u.pathname==='/qa-concurrent-correction'&&req.method==='POST'){await operation('account',{destinationId:south,returnedUnits:6,heldUnits:5,reason:'Corrección concurrente de cantidades de prueba.',evidenceReference:'CONCURRENT-SOUTH'},'reviewer');return reply(200,{localOnly:true});}
  if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{localOnly:true});server.close();uninstall();await pool.end();return;}
  const token=String(req.headers.authorization||'').replace('Bearer ','');
  if(u.pathname==='/auth/session'){const s=session(token);return reply(s?200:401,s?{ok:true,session:s}:{ok:false});}
  if(u.pathname.startsWith(path)){
   calls.push({path:u.pathname,method:req.method});if(unavailable)return reply(503,{ok:false,reason:'local_source_unavailable'});
   let raw='';for await(const chunk of req)raw+=chunk;if(raw.length>262144)return reply(413,{ok:false});
   const r=await request(u.pathname+u.search,token.replace('qa-recall-',''),raw?JSON.parse(raw):null),result=await r.json();
   if(lost&&req.method==='POST'&&r.status===200){lost=false;return reply(503,{ok:false,reason:'local_response_lost_after_commit'});}
   return reply(r.status,result);
  }
  reply(404,{ok:false});
 }catch(e){console.error('LOCAL_RECONCILIATION_ERROR',e.message);reply(503,{ok:false,reason:'local_fixture_error'});}
});server.listen(4681,'127.0.0.1',()=>console.log('RECONCILIATION_LOCAL_PG_READY_4681'));
