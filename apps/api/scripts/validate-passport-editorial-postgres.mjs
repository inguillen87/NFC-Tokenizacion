// LOCAL disposable PostgreSQL + actual service. Never uses production DB, keys or customers.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';
import {readStudio,studioReadView,mutateStudio} from '../src/lib/passport-editorial-service.ts';
const tools=process.env.LOCAL_PG_TOOLS;assert.ok(tools);
const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href);
const {default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
const dir=await mkdtemp(join(tmpdir(),'nexid-editorial-qa-')),password=randomBytes(24).toString('hex'),port=15440;
const cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
let pool,undo;const checks=[];
const T='10000000-0000-4000-8000-000000000001',B='20000000-0000-4000-8000-000000000001';
const editor={actorId:'user_qa_editor',label:'Editor QA',canEdit:true,canReview:true,canPublish:true};
const reviewer={actorId:'user_qa_reviewer',label:'Revisor QA',canEdit:false,canReview:true,canPublish:false};
const publisher={actorId:'user_qa_publisher',label:'Publicador QA',canEdit:false,canReview:false,canPublish:true};
const config={product_name:'Producto inicial',public_lot_label:'LOTE-QA',sku:'SKU-QA',winery:'Marca QA',region:'Origen declarado',agro_product_profile:{schemaVersion:'agro-dpp-v1',productName:'Producto inicial',brand:'Marca QA',sku:'SKU-QA',batchLot:'LOTE-QA',crop:'Cultivo QA'},meta_key_identifier:'SENTINEL_DO_NOT_COPY',read_counter:712,sun:{sdm:{offset:77},product:{name:'Producto inicial',oakType:'Existing wine-specific field'},origin:{region:'Origen declarado'},telemetry:{preserve:true}}};
const original=structuredClone(config);
async function check(name,fn){await fn();checks.push({name,pass:true});console.log('PASS',name);}
async function row(){return readStudio('qa-company','QA-BATCH');}
async function view(){return studioReadView(await row(),editor);}
async function count(table){return Number((await pool.query(`SELECT count(*) n FROM ${table}`)).rows[0].n);}
function command(snapshot,action,extra={}){return {action,operationId:randomUUID(),scope:{tenantId:T,batchId:B},draftId:snapshot.draft.id,expectedRevision:snapshot.draft.revision,expectedContentDigest:snapshot.draft.contentDigest,...extra};}
async function act(snapshot,action,actor=editor,extra={}){return mutateStudio('qa-company','QA-BATCH',actor,command(snapshot,action,extra),action);}
try{
 await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_editorial');
 pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_editorial',max:12});
 await pool.query('CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text); CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),bid text,sdm_config jsonb);');
 await pool.query('INSERT INTO tenants VALUES($1,$2,$3);',[T,'qa-company','Empresa QA']);
 await pool.query('INSERT INTO batches VALUES($1,$2,$3,$4)',[B,T,'QA-BATCH',JSON.stringify(config)]);
 const migration=await readFile(new URL('../db/migrations/20260918120000_0104_passport_editorial.sql',import.meta.url),'utf8');await pool.query(migration);
 undo=installEphemeralE2eSqlExecutor(async(strings,...values)=>{const text=strings.reduce((s,part,i)=>s+part+(i<values.length?'$'+(i+1):''),'');return (await pool.query(text,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:local@127.0.0.1/nexid_e2e_editorial'});
 let initial,start,started,pending,approved,published;
 await check('migration is additive and repeatable on the empty fixture',async()=>{await pool.query(migration);assert.deepEqual((await pool.query('SELECT sdm_config FROM batches WHERE id=$1',[B])).rows[0].sdm_config,original);});
 await check('reading the enrollment never changes data or imports private fields',async()=>{initial=(await view()).enrollment;assert.equal(initial.template,'agro');assert.equal(await count('passport_editorial_heads'),0);assert.ok(!JSON.stringify(initial).includes('SENTINEL_DO_NOT_COPY'));});
 start={action:'start',operationId:randomUUID(),scope:{tenantId:T,batchId:B},template:'agro',locale:'es-AR',expectedPublicDigest:initial.currentPublicDigest};
 await check('explicit enrollment starts an unpublished draft and preserves the product',async()=>{started=await mutateStudio('qa-company','QA-BATCH',editor,start,'start');assert.equal(started.snapshot.draft.revision,1);assert.equal(started.snapshot.published.version,0);assert.equal(await count('passport_editorial_heads'),1);assert.deepEqual((await pool.query('SELECT sdm_config FROM batches WHERE id=$1',[B])).rows[0].sdm_config,original);});
 await check('same start identity returns the original receipt',async()=>{const r=await mutateStudio('qa-company','QA-BATCH',editor,start,'start');assert.equal(r.receipt.replayed,true);assert.equal(r.receipt.id,started.receipt.id);assert.equal(await count('passport_editorial_history'),1);});
 await check('managed public data cannot bypass editorial review via a legacy update',async()=>{await assert.rejects(()=>pool.query("UPDATE batches SET sdm_config=sdm_config||'{\"product_name\":\"unauthorized\"}'::jsonb WHERE id=$1",[B]),/editorial_managed_use_studio/);});
 await check('unrelated technical settings are writable and never enter the editorial history',async()=>{await pool.query("UPDATE batches SET sdm_config=sdm_config||'{\"read_counter\":713}'::jsonb WHERE id=$1",[B]);assert.ok(!JSON.stringify((await view()).snapshot.history).includes('meta_key_identifier'));});
 await check('cross-tenant and cross-batch commands are rejected before writes',async()=>{await assert.rejects(()=>act(started.snapshot,'submit',editor,{scope:{tenantId:T,batchId:'20000000-0000-4000-8000-000000000099'}}),/editorial_scope_forbidden/);await assert.rejects(()=>readStudio('other-company','QA-BATCH'),/editorial_batch_not_found/);});
 let edited;
 await check('eight identical saves yield one revision and one receipt',async()=>{const doc=structuredClone(started.snapshot.draft.document);doc.identity.product_name='Producto nuevo';doc.agro_product_profile.productName='Producto nuevo';const cmd=command(started.snapshot,'save',{document:doc});const results=await Promise.all(Array.from({length:8},()=>mutateStudio('qa-company','QA-BATCH',editor,structuredClone(cmd),'save')));assert.equal(new Set(results.map(r=>r.receipt.id)).size,1);assert.equal(results.filter(r=>r.receipt.replayed).length,7);edited=results[0];assert.equal(edited.snapshot.draft.revision,2);assert.equal(await count('passport_editorial_history'),2);});
 await check('simultaneous distinct edits admit exactly one winner',async()=>{const results=await Promise.allSettled(Array.from({length:6},(_,i)=>{const doc=structuredClone(edited.snapshot.draft.document);doc.identity.region='Origen '+i;return act(edited.snapshot,'save',editor,{document:doc});}));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await count('passport_editorial_history'),3);edited=results.find(r=>r.status==='fulfilled').value;});
 await check('submitting creates a distinct review revision',async()=>{pending=await act(edited.snapshot,'submit');assert.equal(pending.snapshot.draft.state,'in_review');});
 await check('creator cannot self-approve despite broad privileges',async()=>{await assert.rejects(()=>act(pending.snapshot,'approve'),/editorial_independent_review_required/);});
 await check('reviewer returns changes with a stored reason',async()=>{const r=await act(pending.snapshot,'request_changes',reviewer,{note:'Revisar la denominación comercial'});assert.equal(r.snapshot.draft.state,'changes_requested');assert.equal(r.snapshot.history[0].note,'Revisar la denominación comercial');pending=await act(r.snapshot,'submit');});
 await check('independent reviewer approval binds the exact public content',async()=>{approved=await act(pending.snapshot,'approve',reviewer);assert.equal(approved.snapshot.draft.state,'approved');assert.equal(approved.snapshot.draft.contentDigest,pending.snapshot.draft.contentDigest);});
 await check('an unauthorized publisher cannot execute the publication',async()=>{await assert.rejects(()=>act(approved.snapshot,'publish',reviewer),/editorial_action_forbidden/);});
 await pool.query("CREATE FUNCTION qa_history_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='publish' THEN RAISE EXCEPTION 'qa_publication_rollback'; END IF; RETURN NEW; END $$;CREATE TRIGGER qa_history_failure BEFORE INSERT ON passport_editorial_history FOR EACH ROW EXECUTE FUNCTION qa_history_failure();");
 await check('failure after live product update rolls back content, head, history and receipt',async()=>{const countBefore=await count('passport_editorial_receipts');await assert.rejects(()=>act(approved.snapshot,'publish',publisher),/qa_publication_rollback/);assert.equal((await row()).draft.state,'approved');assert.equal((await pool.query('SELECT sdm_config->>\'product_name\' AS name FROM batches WHERE id=$1',[B])).rows[0].name,'Producto inicial');assert.equal(await count('passport_editorial_receipts'),countBefore);});
 await pool.query('DROP TRIGGER qa_history_failure ON passport_editorial_history;DROP FUNCTION qa_history_failure();');
 let publicationCommand;
 await check('parallel publication requests commit once and preserve technical data',async()=>{publicationCommand=command(approved.snapshot,'publish');const responses=await Promise.all(Array.from({length:6},()=>mutateStudio('qa-company','QA-BATCH',publisher,structuredClone(publicationCommand),'publish')));assert.equal(new Set(responses.map(r=>r.receipt.id)).size,1);published=responses[0];assert.equal(published.snapshot.draft.state,'published');assert.equal(published.snapshot.published.version,1);const cfg=(await pool.query('SELECT sdm_config FROM batches WHERE id=$1',[B])).rows[0].sdm_config;assert.equal(cfg.product_name,'Producto nuevo');assert.equal(cfg.read_counter,713);assert.equal(cfg.meta_key_identifier,'SENTINEL_DO_NOT_COPY');assert.deepEqual(cfg.sun.sdm,original.sun.sdm);assert.equal(cfg.sun.product.oakType,original.sun.product.oakType);});
 await check('receipt replay does not trust a new head or duplicate publication',async()=>{const r=await mutateStudio('qa-company','QA-BATCH',publisher,publicationCommand,'publish');assert.equal(r.receipt.replayed,true);assert.equal(r.snapshot.published.version,1);});
 let reopened;
 await check('published content can enter a new reviewed editing cycle',async()=>{reopened=await act(published.snapshot,'reopen');assert.equal(reopened.snapshot.draft.state,'draft');assert.equal(reopened.snapshot.published.version,1);assert.equal(reopened.snapshot.draft.submittedBy,null);});
 await check('restoring historical public data is a new draft, not immediate publication',async()=>{const doc=structuredClone(started.snapshot.draft.document);const restored=await act(reopened.snapshot,'save',editor,{document:doc});assert.equal(restored.snapshot.draft.state,'draft');assert.equal(restored.snapshot.published.document.identity.product_name,'Producto nuevo');assert.equal(restored.snapshot.draft.document.identity.product_name,'Producto inicial');const submitted=await act(restored.snapshot,'submit');const a=await act(submitted.snapshot,'approve',reviewer);const r=await act(a.snapshot,'publish',publisher);assert.equal(r.snapshot.published.version,2);assert.equal(r.snapshot.published.document.identity.product_name,'Producto inicial');});
 await check('a different payload cannot reuse an earlier request ID',async()=>{await assert.rejects(()=>mutateStudio('qa-company','QA-BATCH',editor,{...start,locale:'en'},'start'),/editorial_idempotency_conflict/);});
 await check('stored history and receipts contain public projections, never SDM or keys',async()=>{const rows=(await pool.query('SELECT row_to_json(h) AS h FROM passport_editorial_history h')).rows;const history=JSON.stringify(rows);assert.ok(!history.includes('SENTINEL_DO_NOT_COPY'));assert.ok(!history.includes('meta_key_identifier'));const receipts=(await pool.query('SELECT result FROM passport_editorial_receipts')).rows;assert.ok(!JSON.stringify(receipts).includes('SENTINEL_DO_NOT_COPY'));});
 await check('unprivileged database users cannot execute the write entry point',async()=>{await pool.query('CREATE ROLE qa_no_editorial_access');assert.equal((await pool.query("SELECT has_function_privilege('qa_no_editorial_access','public.nexid_editorial_commit_v1(uuid,uuid,text,uuid,jsonb,jsonb)','EXECUTE') ok")).rows[0].ok,false);});
 await check('enrollment cannot be disabled by a legacy writer',async()=>{await assert.rejects(()=>pool.query('UPDATE batches SET editorial_managed=false WHERE id=$1',[B]),/editorial_managed_cannot_disable/);});
 const report={localOnly:true,engine:(await pool.query('SELECT version() v')).rows[0].v,checks,failed:0,productionUsed:false,migrationHash:createHash('sha256').update(migration).digest('hex')};
 if(process.env.QA_OUTPUT)await writeFile(process.env.QA_OUTPUT,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{undo?.();if(pool)await pool.end();await cluster.stop().catch(()=>{});}
