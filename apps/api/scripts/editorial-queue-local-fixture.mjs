import {mkdtemp,readFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {randomBytes,randomUUID} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';
import {readStudio,mutateStudio} from '../src/lib/passport-editorial-service.ts';
import {editorialQueueRequest} from '../src/lib/editorial-queue-http.ts';
export async function createEditorialQueueFixture(port=16031){
 const tools=process.env.LOCAL_PG_TOOLS;if(!tools)throw Error('Local PostgreSQL tooling required');
 const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href),{default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
 const dir=await mkdtemp(join(tmpdir(),'nexid-editorial-queue-')),password=randomBytes(24).toString('hex');
 const cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
 let pool,undo;const tenant='10000000-0000-4000-8000-000000000001',foreign='10000000-0000-4000-8000-000000000002';
 try{
  await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_queue');pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_queue',max:6});
  const query=(s,p=[])=>pool.query(s,p);await query('CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text);CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),bid text,sdm_config jsonb)');
  await query('INSERT INTO tenants VALUES($1,$2,$3),($4,$5,$6)',[tenant,'queue-qa','Empresa QA',foreign,'other-queue','Empresa ajena']);
  for(const name of ['20260918120000_0104_passport_editorial.sql','20260918123000_0105_passport_editorial_guards.sql'])await query((await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8')).replaceAll('\r\n','\n'));
  let readCount=0;undo=installEphemeralE2eSqlExecutor(async(parts,...values)=>{readCount++;let s='';for(let i=0;i<parts.length;i++){s+=parts[i];if(i<values.length)s+='$'+(i+1);}return(await query(s,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:qa@127.0.0.1/nexid_e2e_queue'});
  const actors={editor:{actorId:'qa_editor',label:'Equipo de contenido',canEdit:true,canReview:false,canPublish:false},reviewer:{actorId:'qa_reviewer',label:'Revisión QA',canEdit:false,canReview:true,canPublish:false},publisher:{actorId:'qa_publisher',label:'Publicación QA',canEdit:false,canReview:false,canPublish:true},other:{actorId:'qa_other',label:'Otra editora QA',canEdit:true,canReview:false,canPublish:false}};
  async function create(bid,company='queue-qa',editor=actors.editor){const t=company==='queue-qa'?tenant:foreign;await query('INSERT INTO batches VALUES($1,$2,$3,$4,false)',[randomUUID(),t,bid,{product_name:'Producto '+bid,public_lot_label:bid,winery:'Marca QA',sku:'QA',meta_setting:'TECHNICAL_SENTINEL',sun:{security:{sentinel:true}}}]);await apply(bid,'start',editor,{},company);}
  async function apply(bid,action,actor=actors.editor,extra={},company='queue-qa'){const row=await readStudio(company,bid);const command={action,operationId:randomUUID(),scope:{tenantId:row.tenant_id,batchId:row.id},...(row.draft?{draftId:row.draft.id,expectedRevision:row.draft.revision,expectedContentDigest:row.draft.contentDigest}:{template:'general',locale:'es-AR',expectedPublicDigest:row.live_digest}),...extra};return mutateStudio(company,bid,actor,command,action);}
  for(let i=0;i<30;i++)await create('DRAFT-'+String(i).padStart(2,'0'));
  await create('REVIEW-SELF');await apply('REVIEW-SELF','submit');
  await create('REVIEW-OTHER','queue-qa',actors.other);await apply('REVIEW-OTHER','submit',actors.other);
  await create('CORRECTION');await apply('CORRECTION','submit');await apply('CORRECTION','request_changes',actors.reviewer,{note:'Confirmar la ficha técnica antes de publicar. <script>NO_EXECUTE</script>'});
  await create('APPROVED');await apply('APPROVED','submit');await apply('APPROVED','approve',actors.reviewer);
  await create('PUBLISHED');await apply('PUBLISHED','submit');await apply('PUBLISHED','approve',actors.reviewer);await apply('PUBLISHED','publish',actors.publisher);
  await create('REVIEW-OTHER','other-queue');
  await query('INSERT INTO batches VALUES($1,$2,$3,$4,false)',[randomUUID(),tenant,'NOT-IN-STUDIO',{product_name:'Unmanaged'}]);
  function session(token){const role=token.replace('queue-','');if(!['editor','reviewer','publisher','reader','self','global','foreign','denied'].includes(role))return null;const a=actors[role]||actors.editor;return {id:'session-'+role,userId:role==='self'?'qa_editor':a.actorId,role:role==='global'?'super-admin':'tenant-admin',label:'QA '+role,email:'qa@example.invalid',tenantId:role==='global'?null:role==='foreign'?foreign:tenant,tenantSlug:role==='global'?null:role==='foreign'?'other-queue':'queue-qa',permissions:role==='global'||role==='self'?['*']:['batches:read',...(role==='editor'?['batch.product.configure']:role==='reviewer'?['batch.product.review']:role==='publisher'?['batch.product.publish']:[])],deniedPermissions:role==='denied'?['batches:read']:[],mfaVerified:true,isDemo:false,setupCompleted:true,expiresAt:new Date(Date.now()+3600000).toISOString()};}
  const request=(params={},role='editor',method='GET')=>editorialQueueRequest(new Request('http://127.0.0.1:4531/admin/passport-editorial/queue?'+new URLSearchParams(params),{method,headers:{authorization:'Bearer queue-'+role}}),async token=>session(token));
  return {query,request,session,actors,apply,create,readCount:()=>readCount,tenant,foreign,close:async()=>{undo?.();await pool?.end();await cluster.stop();}};
 }catch(e){undo?.();await pool?.end();await cluster.stop().catch(()=>{});throw e;}
}
