import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

assert.ok(process.env.PLAYWRIGHT_MODULE&&process.env.AXE_MODULE_PATH,'Installed browser and axe modules are required; no downloads');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axeSource=await readFile(process.env.AXE_MODULE_PATH,'utf8');
const dashboard=fileURLToPath(new URL('../',import.meta.url)), root=resolve(dashboard,'../..');
const output=resolve(process.env.QA_OUTPUT||'artifacts/supplier-requests-browser');await mkdir(output,{recursive:true});
const actor='20000000-0000-4000-8000-000000000001',tenantId='10000000-0000-4000-8000-000000000001';
const principal={id:actor,role:'operations-manager',tenantSlug:'qa-only',permissions:['supplier_order.create'],deniedPermissions:[],isDemo:false};
const fixture=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{SupplierRequestWorkspace}from'./src/components/supplier-request-workspace';import CreateSupplierOrderPage from './src/app/(app)/supplier-orders/create/page';
function Fixture(){const[props,setProps]=useState(window.__qaInitial);window.__qaContext=next=>setProps(current=>({...current,...next}));return <div className="dashboard-main mx-auto w-full max-w-7xl min-w-0 p-4 md:p-8"><aside aria-label="Alcance de la prueba" className="mb-4 text-sm">QA local: solicitudes y transporte sintéticos. No crea pedidos, llaves ni registros de producción.</aside>{location.search.includes('view=order')?<CreateSupplierOrderPage/>:<SupplierRequestWorkspace {...props}/>}</div>}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const bundle=await build({stdin:{contents:fixture,loader:'tsx',resolveDir:dashboard},bundle:true,write:false,outfile:'fixture.js',format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent',plugins:[{name:'synthetic-navigation',setup(builder){builder.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'qa'}));builder.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:`const router={push(url){(window.__qaNavigations ||= []).push(url)},replace(url){(window.__qaNavigations ||= []).push(url)},refresh(){}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(location.search);`,loader:'js'}));}}]});
const css=(await postcss([tailwindcss({content:[join(dashboard,'src/**/*.{ts,tsx}').replaceAll('\\','/'),join(root,'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\','/'),{raw:fixture,extension:'tsx'}],darkMode:['selector','[data-theme="dark"]'],theme:{extend:{colors:{brand:{dark:'#020617',card:'#0f172a',border:'#1e293b',cyan:'#06b6d4',blue:'#3b82f6'}}}},plugins:[]})]).process(await readFile(join(dashboard,'src/app/globals.css'),'utf8'),{from:undefined})).css+(bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'');
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const server=createServer((req,res)=>{const url=new URL(req.url,'http://qa.invalid');if(req.method!=='GET'){res.writeHead(405);return res.end();}if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(js);}if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}if(url.pathname!=='/'){res.writeHead(404);return res.end();}const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="es-AR" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Solicitudes · QA sintética</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={localOnly:true,syntheticData:true,actualComponents:['SupplierRequestWorkspace','CreateSupplierOrderPage'],actualClientContract:true,httpBoundaryMocked:true,navigationStubbed:true,realNextServer:false,realDatabase:false,productionTested:false,checks:[],views:[],clientErrors:[],blockedRequests:[]};
function check(value,description){report.checks.push({description,passed:Boolean(value)});}
const tick=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function waitFor(predicate){for(let n=0;n<300;n++){if(predicate())return;await new Promise(done=>setTimeout(done,20));}assert.ok(predicate(),'Expected synthetic HTTP operation');}
const item=(patch={})=>({id:randomUUID(),tenant_id:tenantId,tenant_slug:'qa-only',title:'Solicitud sintética guardada',construction_id:'',quantity:null,pack_purpose:null,notes:'Nota parcial sintética',status:'draft',revision:1,created_at:'2026-09-23T12:00:00.000Z',updated_at:'2026-09-23T12:00:00.000Z',submitted_at:null,order_id:null,review_summary:{state:'pending',revision:0,updated_at:null},...patch});
const submitted=patch=>item({construction_id:'tt_bridge',quantity:125,pack_purpose:'trial_integration',status:'submitted',revision:3,submitted_at:'2026-09-23T12:01:00.000Z',...patch});
const envelope=(tenant,body)=>({ok:true,protocol:'nexid.supplier-request.v1',scope:tenant?{mode:'tenant',tenant_id:tenantId,tenant_slug:tenant}:{mode:'global',tenant_id:null,tenant_slug:null},...body});
const reviewEvent=(request,revision,patch={})=>({id:randomUUID(),revision,request_revision:request.revision,action:revision%2?'request_information':'respond',message:`Mensaje sintético de aclaración ${revision}`,actor_id:revision%2?'20000000-0000-4000-8000-000000000002':actor,created_at:new Date(Date.UTC(2026,8,23,12,0,revision)).toISOString(),...patch});
function reviewSummary(events){const last=events.at(-1);return last?{state:last.action==='request_information'?'needs_information':'answered',revision:last.revision,updated_at:last.created_at}:{state:'pending',revision:0,updated_at:null};}
async function inspect(page,name,width,theme){
  await page.addScriptTag({content:axeSource});
  const violations=await page.evaluate(async()=>(await axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
  const clippedControls=await page.locator('main input,main textarea,main select,main button,main fieldset,main code').evaluateAll(nodes=>nodes.filter(node=>{const b=node.getBoundingClientRect();return b.width>0&&b.height>0&&(b.left< -1||b.right>document.documentElement.clientWidth+1);}).map(node=>node.getAttribute('data-testid')||node.tagName));
  const screenshot=`${name}-${width}-${theme}.png`;await page.screenshot({path:join(output,screenshot),fullPage:true});report.views.push({name,width,theme,violations,dimensions,clippedControls,screenshot});
  check(!violations.some(v=>['serious','critical'].includes(v.impact)),`${name} ${width} ${theme}: axe serious/critical zero`);check(dimensions.scrollWidth<=dimensions.width+1&&!clippedControls.length,`${name} ${width} ${theme}: no clipped controls or overflow`);
}
async function scenario(width=390,theme='light',options={}){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block',locale:'es-AR'});const page=await context.newPage();page.setDefaultTimeout(12000);
  const props={access:{...principal,...options.access},...(options.initialRequestId?{initialRequestId:options.initialRequestId}:{}),...(options.initialTenant?{initialTenant:options.initialTenant}:{})};
  await page.addInitScript(value=>window.__qaInitial=value,props);
  page.on('pageerror',error=>report.clientErrors.push(error.message));
  const state={reads:[],writes:[],orderWrites:[],rows:options.store?.rows||new Map((options.rows||[]).map(row=>[row.id,row])),receipts:new Map(),mode:'success',pending:[],truncated:false,reviewReads:[],reviewWrites:[],reviewEvents:options.store?.reviewEvents||new Map(),reviewReceipts:options.store?.reviewReceipts||new Map(),reviewMode:'success',reviewReadMode:options.reviewReadMode||'success',reviewPending:[]};
  if(options.history){for(const [id,events]of options.history){state.reviewEvents.set(id,events);state.rows.get(id).review_summary=reviewSummary(events);}}
  async function send(route,status,body){await route.fulfill({status,headers:{'content-type':'application/json','x-nexid-data-mode':'production'},body:JSON.stringify(body)}).catch(()=>{});}
  function reviewResult(id,tenant,before){const row=state.rows.get(id),all=state.reviewEvents.get(id)||[],eligible=before===undefined?all:all.filter(event=>event.revision<before),history=eligible.slice(-100),truncated=eligible.length>history.length;return {...envelope(tenant,{}),protocol:'nexid.supplier-request-review.v1',request_id:id,request_revision:row.revision,review:reviewSummary(all),history,count:history.length,truncated,next_before_revision:truncated?history[0].revision:null};}
  function commitReview(request,tenant,id){const body=request.postDataJSON(),key=request.headers()['idempotency-key'],prior=state.reviewReceipts.get(key),row=state.rows.get(id),events=state.reviewEvents.get(id)||[];
    if(prior)return {...reviewResult(id,tenant),receipt:prior,idempotent_replay:true};
    if(body.expected_revision!==events.length||body.expected_request_revision!==row.revision)return {ok:false,reason:'supplier_request_review_revision_conflict'};
    const event=reviewEvent(row,events.length+1,{action:body.action,message:body.message});state.reviewEvents.set(id,[...events,event]);row.review_summary=reviewSummary([...events,event]);const receipt={idempotency_key:key,action:body.action,revision:event.revision};state.reviewReceipts.set(key,receipt);return {...reviewResult(id,tenant),receipt,idempotent_replay:false};}
  function commit(request,tenant,path){
    const body=request.postDataJSON(),key=request.headers()['idempotency-key'],action=path.endsWith('/submit')?'submit':request.method()==='PATCH'?'patch':'create';
    const id=action==='create'?null:path.split('/')[4],prior=state.receipts.get(key);
    if(prior)return envelope(tenant,{request:state.rows.get(prior.id),receipt:prior.receipt,idempotent_replay:true});
    const previous=id?state.rows.get(id):null;
    const value=action==='create'?item({...body,tenant_slug:tenant}):action==='patch'?{...previous,...body,revision:previous.revision+1}:{...previous,status:'submitted',revision:previous.revision+1,submitted_at:'2026-09-23T12:01:00.000Z'};
    delete value.expected_revision;state.rows.set(value.id,value);const receipt={idempotency_key:key,action,revision:value.revision};state.receipts.set(key,{id:value.id,receipt});return envelope(tenant,{request:value,receipt,idempotent_replay:false});
  }
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){report.blockedRequests.push(request.method()+' '+url.origin+url.pathname);return route.abort();}
    if(request.method()==='GET'&&url.pathname==='/api/session/current')return send(route,200,{ok:true,session:{...principal,role:'super-admin',tenantSlug:null,permissions:['supplier_order.create','batch.keys.generate'],mfaVerified:true,...options.access}});
    if(request.method()==='POST'&&url.pathname==='/api/admin/supplier-orders'){
      state.orderWrites.push(request.postDataJSON());return send(route,201,{ok:true,order:{id:'60000000-0000-4000-8000-000000000001',tenant_slug:'qa-only'}});
    }
    if(url.pathname.startsWith('/api/admin/supplier-requests')){
      const tenant=url.searchParams.get('tenant')||'';
      if(url.pathname.endsWith('/review')){
        const id=url.pathname.split('/')[4];
        if(request.method()==='GET'){
          state.reviewReads.push(url.pathname+url.search);
          if(state.reviewReadMode==='delayed'){state.reviewPending.push({route,request,tenant,id,before:url.searchParams.has('before_revision')?Number(url.searchParams.get('before_revision')):undefined,read:true});return;}
          if(state.reviewReadMode==='503')return send(route,503,{ok:false,reason:'synthetic_unavailable'});
          const value=reviewResult(id,tenant,url.searchParams.has('before_revision')?Number(url.searchParams.get('before_revision')):undefined);
          if(state.reviewReadMode==='foreign')value.scope.tenant_slug='foreign';if(state.reviewReadMode==='demo')value.demo=true;
          return send(route,200,value);
        }
        if(request.method()!=='POST'){report.blockedRequests.push(request.method()+' '+url.pathname);return route.abort();}
        state.reviewWrites.push({id,tenant,key:request.headers()['idempotency-key'],body:request.postDataJSON()});
        if(state.reviewMode==='delayed'||state.reviewMode==='hang'){state.reviewPending.push({route,request,tenant,id});return;}
        if(state.reviewMode==='conflict')return send(route,409,{ok:false,reason:'supplier_request_review_revision_conflict'});
        if(state.reviewMode==='forbidden')return send(route,403,{ok:false,reason:'supplier_request_scope_forbidden'});
        if(state.reviewMode==='503')return send(route,503,{ok:false,reason:'synthetic_unavailable'});
        const value=commitReview(request,tenant,id);
        if(state.reviewMode==='commit-lost')return send(route,503,{ok:false,reason:'synthetic_response_lost'});
        if(state.reviewMode==='malformed')value.receipt.idempotency_key=randomUUID();
        return send(route,value.ok?200:409,value);
      }
      if(request.method()==='GET'){
        state.reads.push(url.pathname+url.search);
        if(state.mode==='read-error')return send(route,503,{ok:false,reason:'synthetic_unavailable'});
        const id=url.pathname.split('/')[4];
        if(id){const row=state.rows.get(id);return send(route,row?200:404,row?envelope(tenant,{request:row}):{ok:false,reason:'supplier_request_not_found'});}
        const items=[...state.rows.values()].filter(row=>tenant?row.tenant_slug===tenant:row.status!=='draft');return send(route,200,envelope(tenant,{items,count:items.length,truncated:state.truncated}));
      }
      if(!['POST','PATCH'].includes(request.method())){report.blockedRequests.push(request.method()+' '+url.pathname);return route.abort();}
      state.writes.push({path:url.pathname,tenant,method:request.method(),body:request.postDataJSON(),key:request.headers()['idempotency-key']});
      if(state.mode==='delayed'||state.mode==='hang'){state.pending.push({route,request,tenant,path:url.pathname});return;}
      if(state.mode==='reject')return send(route,400,{ok:false,reason:'supplier_request_input_invalid'});
      if(state.mode==='forbidden')return send(route,403,{ok:false,reason:'supplier_request_scope_forbidden'});
      if(state.mode==='conflict')return send(route,409,{ok:false,reason:'supplier_request_revision_conflict'});
      if(state.mode==='503')return send(route,503,{ok:false,reason:'synthetic_unavailable'});
      const result=commit(request,tenant,url.pathname);
      if(state.mode==='commit-lost')return send(route,503,{ok:false,reason:'synthetic_response_lost'});
      if(state.mode==='malformed')result.receipt.revision+=1;
      return send(route,200,result);
    }
    if(request.method()==='GET'&&['/','/fixture.js','/favicon.ico'].includes(url.pathname))return route.continue();
    report.blockedRequests.push(request.method()+' '+url.pathname);return route.abort();
  });
  state.release=async()=>{for(const pending of state.pending.splice(0))await send(pending.route,200,commit(pending.request,pending.tenant,pending.path));};
  state.releaseReview=async()=>{for(const pending of state.reviewPending.splice(0)){const body=pending.read?reviewResult(pending.id,pending.tenant,pending.before):commitReview(pending.request,pending.tenant,pending.id);await send(pending.route,body.ok?200:409,body);}};
  await page.goto(origin+'/?theme='+theme+(options.source?`&view=order&request=${options.source.id}&tenant=${options.source.tenant_slug}`:''),{waitUntil:'networkidle'});
  if(options.source)await page.getByTestId('supplier-order-submit').waitFor();else{await page.getByTestId('supplier-request-workspace').waitFor();if(!options.denied)await page.getByRole('button',{name:'Actualizar bandeja'}).waitFor();}await tick(page);
  return {context,page,state};
}
async function fill(page,complete=false){await page.getByTestId('supplier-request-title').fill('Proyecto sintético conservado');await page.getByTestId('supplier-request-notes').fill('Necesidad parcial <b>literal</b>\nSin secretos');if(complete){await page.getByTestId('supplier-request-construction').selectOption('tt_bridge');await page.getByTestId('supplier-request-quantity').fill('125');await page.getByTestId('supplier-request-purpose').selectOption('trial_integration');}}
async function saved(page){await page.getByTestId('supplier-request-status').filter({hasText:'Guardado confirmado'}).waitFor();}
async function reviewReady(page){await page.getByTestId('supplier-request-review-panel').waitFor();await page.waitForFunction(()=>{const state=document.querySelector('[data-testid="supplier-request-review-state"]');return state&&!state.textContent.includes('Consultando');});}
async function inspectReview(page,message){await page.getByTestId('supplier-request-review-message').fill(message);await page.getByTestId('supplier-request-review-inspect').click();await page.getByTestId('supplier-request-review-confirmation').waitFor();}
async function reviewSaved(page,revision){await page.getByTestId('supplier-request-review-receipt').filter({hasText:`Mensaje guardado · revisión ${revision}`}).waitFor();}
const nexid={role:'super-admin',tenantSlug:null};
const openedOptions=(row,extra={})=>({rows:[row],initialRequestId:row.id,initialTenant:row.tenant_slug,...extra});
try{
  for(const theme of ['light','dark'])for(const width of [390,1440]){
    const {page,state,context}=await scenario(width,theme),tag=`${width} ${theme}`;
    check(state.writes.length===0,`${tag}: initial reads do not create requests`);check(await page.getByTestId('supplier-request-tenant').count()===0,`${tag}: tenant operator cannot choose another company`);
    await fill(page);check(state.writes.length===0,`${tag}: editing partial draft has no server writes`);await page.getByTestId('supplier-request-save').click();await saved(page);
    check(state.writes.length===1&&state.rows.size===1,`${tag}: explicit save makes one synthetic draft`);const first=[...state.rows.values()][0];check(first.quantity===null&&first.pack_purpose===null&&first.construction_id==='',`${tag}: partial fields persist as unknown`);check(await page.getByTestId('supplier-request-review').isDisabled(),`${tag}: partial draft cannot be sent`);
    await inspect(page,'partial-saved',width,theme);
    await page.reload({waitUntil:'networkidle'});await page.getByTestId('supplier-request-open').click();await page.getByTestId('supplier-request-title').filter({visible:true}).waitFor();await tick(page);
    check(await page.getByTestId('supplier-request-detail-heading').evaluate(heading=>document.activeElement===heading),`${tag}: confirmed request opening moves keyboard focus to the detail heading`);
    check(await page.getByTestId('supplier-request-title').inputValue()===first.title&&await page.getByTestId('supplier-request-notes').inputValue()===first.notes,`${tag}: reload reads durable synthetic fixture without local storage`);
    await fill(page,true);await page.getByTestId('supplier-request-save').click();await saved(page);check(state.writes[1].method==='PATCH'&&state.writes[1].body.expected_revision===1,`${tag}: patch carries current revision`);
    await page.getByTestId('supplier-request-review').click();check(state.writes.length===2,`${tag}: review alone does not submit`);await inspect(page,'review-send',width,theme);
    await page.getByRole('button',{name:'Volver',exact:true}).click();check(state.writes.length===2&&await page.getByTestId('supplier-request-submit').count()===0,`${tag}: cancelling review makes no write`);
    await page.getByTestId('supplier-request-review').click();await page.getByTestId('supplier-request-submit').click();await saved(page);
    check(state.writes.length===3&&state.writes[2].path.endsWith('/submit'),`${tag}: one explicit final submission`);check(JSON.stringify(state.writes[2].body)==='{"expected_revision":2}',`${tag}: submission cannot alter commercial content`);check(await page.getByTestId('supplier-request-title').isDisabled()&&await page.getByTestId('supplier-request-save').count()===0,`${tag}: submitted request read-only`);check(state.writes.every(w=>w.tenant==='qa-only'&&!/supplier-orders|keys|manifests/.test(w.path)),`${tag}: save/send never invokes technical order or key endpoint`);await inspect(page,'submitted',width,theme);await context.close();
  }
  for(const access of [{role:'viewer'},{deniedPermissions:['supplier_order.create']},{isDemo:true}]){const {page,state,context}=await scenario(390,'light',{access,denied:true});check(state.reads.length===0&&state.writes.length===0,'Denied/demo context makes no backend reads or writes');check(await page.getByRole('alert').count()===1,'Denied context is explicit');await context.close();}
  const retry=await scenario();await fill(retry.page,true);retry.state.mode='commit-lost';await retry.page.getByTestId('supplier-request-save').click();await retry.page.getByTestId('supplier-request-retry').waitFor();check(retry.state.rows.size===1,'Synthetic commit with lost response remains one persisted request');check(await retry.page.getByTestId('supplier-request-title').isDisabled(),'Uncertain write locks edited command');await inspect(retry.page,'uncertain',390,'light');
  retry.state.mode='forbidden';await retry.page.getByTestId('supplier-request-retry').click();await retry.page.getByRole('alert').filter({hasText:'acceso'}).waitFor();check(await retry.page.getByTestId('supplier-request-title').isDisabled(),'403 after uncertainty does not unlock or discard command');retry.state.mode='success';await retry.page.getByTestId('supplier-request-retry').click();await saved(retry.page);check(retry.state.rows.size===1&&new Set(retry.state.writes.map(w=>w.key)).size===1&&new Set(retry.state.writes.map(w=>JSON.stringify(w.body))).size===1,'Repeated uncertainty check reuses exact key/body and gets original receipt');await retry.context.close();
  const delayed=await scenario();await fill(delayed.page);delayed.state.mode='delayed';await delayed.page.getByTestId('supplier-request-save').evaluate(button=>{button.click();button.click();});await waitFor(()=>delayed.state.pending.length===1);check(delayed.state.writes.length===1,'Synchronous double click suppressed before React render');await delayed.state.release();await saved(delayed.page);await delayed.context.close();
  const conflictRow=item(),conflict=await scenario(390,'light',{rows:[conflictRow],initialRequestId:conflictRow.id});await fill(conflict.page,true);conflict.state.mode='conflict';await conflict.page.getByTestId('supplier-request-save').click();await conflict.page.getByTestId('supplier-request-conflict').waitFor();check(await conflict.page.getByTestId('supplier-request-title').inputValue()==='Proyecto sintético conservado','CAS conflict preserves unsaved local input');conflict.state.rows.set(conflictRow.id,{...conflictRow,title:'Cambio de otra sesión',revision:2});await conflict.page.getByRole('button',{name:'Consultar versión actual'}).click();await conflict.page.getByRole('heading',{name:'Versión actual del servidor: 2'}).waitFor();check(await conflict.page.getByTestId('supplier-request-title').inputValue()==='Proyecto sintético conservado','Comparison read does not silently replace local draft');await inspect(conflict.page,'revision-conflict',390,'light');conflict.page.once('dialog',dialog=>dialog.accept());await conflict.page.getByRole('button',{name:'Cargar esta versión y descartar mis cambios'}).click();check(await conflict.page.getByTestId('supplier-request-title').inputValue()==='Cambio de otra sesión','Explicit comparison acceptance replaces local fields');await conflict.context.close();
  const stale=await scenario();await fill(stale.page);stale.state.mode='delayed';await stale.page.getByTestId('supplier-request-save').click();await waitFor(()=>stale.state.pending.length===1);await stale.page.evaluate(p=>window.__qaContext({access:{...p,tenantSlug:'qa-other',id:'20000000-0000-4000-8000-000000000002'}}),principal);await tick(stale.page);await stale.page.evaluate(p=>window.__qaContext({access:p}),principal);await tick(stale.page);await stale.state.release();await tick(stale.page);check(await stale.page.getByTestId('supplier-request-title').inputValue()===''&&!/Guardado confirmado/.test(await stale.page.getByTestId('supplier-request-status').innerText()),'Late A response cannot replace new A after A→B→A authenticated context transition');await stale.context.close();
  const inbox=await scenario(1440,'dark',{access:{role:'super-admin',tenantSlug:null},rows:[item(),submitted()]});check(await inbox.page.getByTestId('supplier-request-open').count()===1,'Global NexID inbox excludes internal drafts');await inbox.page.getByTestId('supplier-request-open').click();await inbox.page.getByTestId('supplier-request-prepare').waitFor();check((await inbox.page.getByTestId('supplier-request-prepare').getAttribute('href')).includes('tenant=qa-only'),'Preparation link binds source request and tenant');check(inbox.state.writes.length===0,'NexID inspection and preparation link render generate no order');await inspect(inbox.page,'nexid-inbox',1440,'dark');await inbox.context.close();
  const outage=await scenario();outage.state.mode='read-error';await outage.page.getByRole('button',{name:'Actualizar bandeja'}).click();await outage.page.getByRole('status').filter({hasText:'No se confirmó la bandeja'}).waitFor();check(!await outage.page.getByText('La fuente no encontró solicitudes en este alcance.').count(),'Unavailable inbox is not presented as empty');await outage.context.close();
  for(const theme of ['light','dark'])for(const width of [390,1440]){
    const source=submitted({title:'á'.repeat(200),notes:'ñ'.repeat(4000)}),test=await scenario(width,theme,{source,rows:[source]});
    await test.page.getByTestId('supplier-order-source-request').waitFor();
    check(test.state.writes.length===0&&test.state.orderWrites.length===0,`Source ${width} ${theme}: authenticated load does not convert or alter request`);
    check(await test.page.locator('#supplier-order-tenant-slug').inputValue()==='qa-only'&&await test.page.locator('#supplier-order-tenant-slug').evaluate(n=>n.readOnly),`Source ${width} ${theme}: bound tenant is fixed`);
    check(await test.page.locator('#supplier-order-total-quantity').inputValue()==='125'&&await test.page.locator('#supplier-order-total-quantity').evaluate(n=>n.readOnly),`Source ${width} ${theme}: quantity stays source-bound`);
    check(await test.page.locator('input[name="pack_purpose"][value="trial_integration"]').isChecked()&&await test.page.locator('input[name="pack_purpose"][value="production"]').isDisabled(),`Source ${width} ${theme}: purpose is source-bound`);
    await test.page.locator('#supplier-order-base-batch-id').fill('QA-SOURCE-ONLY');
    await test.page.getByTestId('supplier-order-submit').click();await test.page.getByRole('alert').waitFor();
    check(test.state.orderWrites.length===0,`Source ${width} ${theme}: commercial Unicode length exceeding technical UTF-8 limit cannot POST`);
    await test.page.locator('#supplier-order-name').fill('Resumen técnico');await test.page.getByTestId('supplier-order-submit').click();await test.page.getByRole('alert').filter({hasText:'notas'}).waitFor();check(test.state.orderWrites.length===0,`Source ${width} ${theme}: technical notes UTF-8 bound is checked independently`);
    await test.page.locator('#supplier-order-notes').fill('Resumen técnico para proveedor');await test.page.getByTestId('supplier-order-source-request').locator('summary').click();
    check((await test.page.getByTestId('supplier-order-source-request').innerText()).includes(source.title)&&(await test.page.getByTestId('supplier-order-source-request').innerText()).includes(source.notes),`Source ${width} ${theme}: original commercial text remains visible after technical summary edit`);
    check(test.state.rows.get(source.id).title===source.title&&test.state.rows.get(source.id).notes===source.notes,`Source ${width} ${theme}: original request remains unchanged`);
    await inspect(test.page,'source-technical-review',width,theme);
    await test.page.getByTestId('supplier-order-submit').click();await waitFor(()=>test.state.orderWrites.length===1);await test.page.waitForFunction(()=>window.__qaNavigations?.length===1);
    const payload=test.state.orderWrites[0];check(payload.source_request_id===source.id&&payload.source_request_revision===source.revision&&payload.tenant_slug===source.tenant_slug,`Source ${width} ${theme}: conversion binds exact request revision and tenant`);
    check(payload.total_quantity===125&&payload.pack_purpose==='trial_integration'&&payload.carrier_profile_code==='ntag424_dna_tt'&&payload.chip_model==='NTAG424_DNA_TT'&&payload.material_type==='tagtamper_tail',`Source ${width} ${theme}: conversion preserves source technical profile`);
    check(payload.order_name==='Resumen técnico'&&payload.notes==='Resumen técnico para proveedor'&&test.state.writes.length===0,`Source ${width} ${theme}: technical text has separate payload without request edits`);await test.context.close();
  }
  for(const access of [{role:'operations-manager',tenantSlug:'qa-only'},{permissions:['supplier_order.create']},{mfaVerified:false}]){
    const source=submitted(),test=await scenario(390,'light',{source,rows:[source],access});
    check(await test.page.getByTestId('supplier-order-submit').isDisabled(),`Source: operator/key/MFA restriction prevents technical create ${JSON.stringify(access)}`);check(test.state.orderWrites.length===0,'Restricted technical preparation never writes');await test.context.close();
  }
  // The same synthetic persisted store is visited by both roles. This checks
  // real components and contracts, not real authentication or PostgreSQL.
  for(const theme of ['light','dark'])for(const width of [390,1440]){
    const row=submitted(),original=JSON.stringify(row),sa=await scenario(width,theme,openedOptions(row,{access:nexid}));await reviewReady(sa.page);
    check(await sa.page.getByTestId('supplier-request-prepare').count()===1,'Confirmed pending review permits NexID preparation before requesting more information');
    const question='¿Qué diámetro de tapa y material tiene el envase? <b>Texto literal</b>';
    await inspectReview(sa.page,question);check(sa.state.reviewWrites.length===0,'Reviewing a question is not a server write');check(await sa.page.getByTestId('supplier-request-prepare').count()===0,'An unsent question blocks competing preparation');
    await sa.page.getByRole('button',{name:'Volver al mensaje'}).click();check(await sa.page.getByTestId('supplier-request-review-message').inputValue()===question&&sa.state.reviewWrites.length===0,'Cancel confirmation preserves unsent question without writes');
    await sa.page.getByTestId('supplier-request-review-inspect').click();await sa.page.getByTestId('supplier-request-review-confirm').click();await reviewSaved(sa.page,1);
    check(sa.state.reviewWrites.length===1&&sa.state.reviewWrites[0].body.action==='request_information'&&sa.state.reviewWrites[0].body.expected_revision===0&&sa.state.reviewWrites[0].body.expected_request_revision===3,'NexID sends one explicit question bound to both current revisions');
    check(sa.state.rows.get(row.id).review_summary.state==='needs_information'&&await sa.page.getByTestId('supplier-request-prepare').count()===0,'Unanswered clarification blocks preparing an order');
    const unchanged={...sa.state.rows.get(row.id),review_summary:JSON.parse(original).review_summary};check(JSON.stringify(unchanged)===original,'Question changes sidecar only, preserving submitted commercial content and original revision');
    await inspect(sa.page,'clarification-requested',width,theme);
    const store=sa.state;await sa.context.close();
    const company=await scenario(width,theme,openedOptions(row,{store}));await reviewReady(company.page);
    check(await company.page.getByTestId('supplier-request-review-history').innerText().then(value=>value.includes(question)),'Company reads exact NexID question as literal text');
    check(await company.page.getByTestId('supplier-request-title').isDisabled(),'Company response cannot rewrite submitted original');
    await inspectReview(company.page,'Tapa de 38 mm, envase de vidrio lleno. Confirmar adhesivo para humedad.');await inspect(company.page,'clarification-company-confirmation',width,theme);await company.page.getByTestId('supplier-request-review-confirm').click();await reviewSaved(company.page,2);
    check(company.state.reviewWrites.length===1&&company.state.reviewWrites[0].body.action==='respond'&&company.state.reviewWrites[0].body.expected_revision===1&&company.state.reviewWrites[0].body.expected_request_revision===3,'Tenant responds explicitly to latest question without changing request revision');
    check(company.state.rows.get(row.id).review_summary.state==='answered'&&company.state.writes.length===0&&company.state.orderWrites.length===0,'Response is recorded separately from request/order creation');await company.context.close();
    const reopened=await scenario(width,theme,openedOptions(row,{access:nexid,store}));await reviewReady(reopened.page);await reopened.page.getByTestId('supplier-request-prepare').waitFor();
    check(await reopened.page.getByTestId('supplier-request-review-history').locator('li').count()===2,'NexID sees question and response after reopening');check((await reopened.page.getByTestId('supplier-request-prepare').getAttribute('href')).includes(`request=${row.id}&tenant=qa-only`),'Answered review enables a source-bound preparation link');await inspect(reopened.page,'clarification-answered',width,theme);await reopened.context.close();
  }
  const historyRow=submitted(),history=Array.from({length:105},(_,index)=>reviewEvent(historyRow,index+1));
  const older=await scenario(390,'light',openedOptions(historyRow,{history:[[historyRow.id,history]]}));await reviewReady(older.page);
  check(await older.page.getByTestId('supplier-request-review-history').locator('li').count()===100,'First history page shows the latest100, not a fabricated complete history');
  older.state.reviewReadMode='503';await older.page.getByTestId('supplier-request-review-older').click();await older.page.getByRole('alert').waitFor();check(await older.page.getByTestId('supplier-request-review-history').locator('li').count()===100,'Failed older-page read preserves confirmed history');
  older.state.reviewReadMode='success';await older.page.getByTestId('supplier-request-review-older').click();await older.page.waitForFunction(()=>document.querySelectorAll('[data-testid="supplier-request-review-history"] li').length===105);
  check(older.state.reviewReads.filter(path=>path.includes('before_revision=6')).length===2,'Retry asks for the same exclusive history cursor');
  check(await older.page.getByTestId('supplier-request-review-older').count()===0,'Older history control disappears only after confirmed complete history');
  check(!(await older.page.getByTestId('supplier-request-review-state').innerText()).includes('No se confirmó'),'Successful history retry restores a confirmed state after validating the same current revision');
  const historyText=await older.page.getByTestId('supplier-request-review-history').innerText();check(historyText.indexOf('Mensaje sintético de aclaración 1\n')<historyText.indexOf('Mensaje sintético de aclaración 105'),'Merged history remains chronological without duplicates');await older.context.close();
  // A committed message with a lost response must reuse its exact operation even
  // after a later authorization failure. No automatic resend is allowed.
  const uncertainRow=submitted(),uncertain=await scenario(390,'light',openedOptions(uncertainRow,{access:nexid}));await reviewReady(uncertain.page);await inspectReview(uncertain.page,'Pregunta sintética cuyo recibo se pierde');uncertain.state.reviewMode='commit-lost';await uncertain.page.getByTestId('supplier-request-review-confirm').click();await uncertain.page.getByTestId('supplier-request-review-retry').waitFor();
  check(uncertain.state.reviewEvents.get(uncertainRow.id).length===1&&await uncertain.page.getByTestId('supplier-request-review-message').isDisabled(),'Lost receipt locks exact message after one synthetic commit');check(await uncertain.page.getByRole('button',{name:'Nueva solicitud',exact:true}).isDisabled(),'Uncertain message locks parent navigation to another request');await inspect(uncertain.page,'clarification-uncertain',390,'light');
  uncertain.state.reviewMode='forbidden';await uncertain.page.getByTestId('supplier-request-review-retry').click();await uncertain.page.getByRole('alert').filter({hasText:'acceso'}).waitFor();check(await uncertain.page.getByTestId('supplier-request-review-message').isDisabled(),'Later403 cannot unlock an unresolved message');
  uncertain.state.reviewMode='success';await uncertain.page.getByTestId('supplier-request-review-retry').click();await reviewSaved(uncertain.page,1);
  check(uncertain.state.reviewEvents.get(uncertainRow.id).length===1&&new Set(uncertain.state.reviewWrites.map(write=>write.key)).size===1&&new Set(uncertain.state.reviewWrites.map(write=>JSON.stringify(write.body))).size===1,'Question retry returns original receipt without duplicate message or changed command');await uncertain.context.close();
  const doubleRow=submitted(),double=await scenario(390,'light',openedOptions(doubleRow,{access:nexid}));await reviewReady(double.page);await inspectReview(double.page,'Doble clic sintético');double.state.reviewMode='delayed';await double.page.getByTestId('supplier-request-review-confirm').evaluate(button=>{button.click();button.click();});await waitFor(()=>double.state.reviewPending.length===1);check(double.state.reviewWrites.length===1,'Synchronous double confirmation creates only one review request');await double.state.releaseReview();await reviewSaved(double.page,1);await double.context.close();
  const casRow=submitted(),cas=await scenario(390,'light',openedOptions(casRow,{access:nexid}));await reviewReady(cas.page);await inspectReview(cas.page,'Mi pregunta no debe perderse');cas.state.reviewMode='conflict';await cas.page.getByTestId('supplier-request-review-confirm').click();await cas.page.getByRole('alert').filter({hasText:'cambió'}).waitFor();
  check(await cas.page.getByTestId('supplier-request-review-message').inputValue()==='Mi pregunta no debe perderse'&&await cas.page.getByTestId('supplier-request-review-inspect').isDisabled(),'CAS conflict preserves local message and requires a fresh server read');
  cas.state.reviewMode='success';await cas.page.getByTestId('supplier-request-review-refresh').click();await reviewReady(cas.page);check(await cas.page.getByTestId('supplier-request-review-message').inputValue()==='Mi pregunta no debe perderse'&&cas.state.reviewWrites.length===1,'Conflict refresh preserves message without automatically retrying');await cas.context.close();
  // A pending read is cancelled on a new keyed request. Force late delivery to
  // prove the old history cannot populate the new request or another tenant.
  const staleA=submitted({title:'Solicitud A'}),staleB=submitted({title:'Solicitud B',tenant_slug:'qa-other'}),staleHistory=Array.from({length:105},(_,index)=>reviewEvent(staleA,index+1,{message:`HISTORIA SOLO A ${index+1}`}));
  const staleReview=await scenario(390,'light',openedOptions(staleA,{rows:[staleA,staleB],history:[[staleA.id,staleHistory]]}));await reviewReady(staleReview.page);staleReview.state.reviewReadMode='delayed';await staleReview.page.getByTestId('supplier-request-review-older').click();await waitFor(()=>staleReview.state.reviewPending.length===1);staleReview.state.reviewReadMode='success';
  await staleReview.page.evaluate(({access,id})=>window.__qaContext({access,initialTenant:'qa-other',initialRequestId:id}),{access:{...principal,tenantSlug:'qa-other',id:'20000000-0000-4000-8000-000000000003'},id:staleB.id});await reviewReady(staleReview.page);await staleReview.state.releaseReview();await tick(staleReview.page);check(!(await staleReview.page.getByTestId('supplier-request-review-history').innerText()).includes('HISTORIA SOLO A'),'Late review history from A cannot populate request B in another tenant');await staleReview.context.close();
  const lateA=submitted({title:'A command'}),lateB=submitted({title:'B command'}),lateWrite=await scenario(390,'light',openedOptions(lateA,{access:nexid,rows:[lateA,lateB]}));await reviewReady(lateWrite.page);await inspectReview(lateWrite.page,'Pregunta A aún sin respuesta confirmada');lateWrite.state.reviewMode='delayed';await lateWrite.page.getByTestId('supplier-request-review-confirm').click();await waitFor(()=>lateWrite.state.reviewPending.length===1);
  await lateWrite.page.evaluate(id=>window.__qaContext({initialRequestId:id}),lateB.id);await lateWrite.page.getByTestId('supplier-request-detail-heading').filter({hasText:'B command'}).waitFor();await reviewReady(lateWrite.page);
  await lateWrite.page.evaluate(id=>window.__qaContext({initialRequestId:id}),lateA.id);await lateWrite.page.getByTestId('supplier-request-detail-heading').filter({hasText:'A command'}).waitFor();await reviewReady(lateWrite.page);await lateWrite.state.releaseReview();await tick(lateWrite.page);
  const lateOutcome={receipts:await lateWrite.page.getByTestId('supplier-request-review-receipt').count(),disabled:await lateWrite.page.getByTestId('supplier-request-review-message').isDisabled(),state:await lateWrite.page.getByTestId('supplier-request-review-state').innerText(),reads:lateWrite.state.reviewReads};report.lateWriterOutcome=lateOutcome;
  check(lateOutcome.receipts===0&&!lateOutcome.disabled,'Late writer callback cannot confirm an old command or relock a new A panel after A→B→A');await lateWrite.context.close();
  for(const reviewReadMode of ['503','foreign','demo']){const row=submitted(),test=await scenario(390,'light',openedOptions(row,{access:nexid,reviewReadMode}));await reviewReady(test.page);check(await test.page.getByTestId('supplier-request-prepare').count()===0&&await test.page.getByTestId('supplier-request-review-confirm').count()===0,`${reviewReadMode} review cannot authorize preparation or question`);check(test.state.reviewWrites.length===0,'Unconfirmed review performs no mutation');await test.context.close();}
  for(const sourcePatch of [{review_summary:{state:'needs_information',revision:1,updated_at:'2026-09-23T12:01:00.000Z'}},{review_summary:undefined}]){const row=submitted(sourcePatch),test=await scenario(390,'light',{source:row,rows:[row]});await test.page.getByRole('alert').waitFor();check(await test.page.getByTestId('supplier-order-submit').isDisabled(),'Direct preparation URL cannot bypass missing or unconfirmed review');check(test.state.orderWrites.length===0&&test.state.reads.some(path=>path.includes(row.id)),'Blocked direct preparation reads actual synthetic source and never POSTs');await test.context.close();}
  const filterRows=[submitted({title:'Pendiente QA'}),submitted({title:'Aclaración QA',review_summary:{state:'needs_information',revision:1,updated_at:'2026-09-23T12:01:00.000Z'}}),submitted({title:'Respuesta QA',review_summary:{state:'answered',revision:2,updated_at:'2026-09-23T12:02:00.000Z'}}),submitted({title:'Pedido preparado QA',status:'provisioned',order_id:randomUUID()}),submitted({title:'Estado no confirmado QA',review_summary:undefined}),item({title:'Borrador privado'})];
  const filters=await scenario(1440,'dark',{access:nexid,rows:filterRows});filters.state.truncated=true;await filters.page.getByRole('button',{name:'Actualizar bandeja'}).click();await filters.page.getByTestId('supplier-request-inbox-count').filter({hasText:'no es el total del historial'}).waitFor();
  check((await filters.page.getByTestId('supplier-request-inbox-count').innerText()).includes('5 de 5 solicitudes cargadas'),'Inbox count refers to loaded non-draft rows, not a fabricated total');
  for(const value of ['pending','needs_information','answered','provisioned','unknown']){await filters.page.getByTestId('supplier-request-inbox-filter').selectOption(value);check(await filters.page.getByTestId('supplier-request-open').count()===1,`Local inbox filter isolates ${value}`);check((await filters.page.getByTestId('supplier-request-inbox-count').innerText()).includes('1 de 5'),'Filter denominator stays loaded rows');}
  await filters.page.getByTestId('supplier-request-inbox-filter').selectOption('all');await filters.page.getByTestId('supplier-request-inbox-search').fill(filterRows[2].id);check(await filters.page.getByTestId('supplier-request-open').count()===1,'Exact UUID search matches one loaded request');check(filters.state.writes.length===0&&filters.state.reviewWrites.length===0,'Filters and searches never mutate requests or review');await inspect(filters.page,'clarification-inbox-filter',1440,'dark');await filters.context.close();
  const reviewTimedRow=submitted(),reviewTimed=await scenario(390,'light',openedOptions(reviewTimedRow,{access:nexid}));await reviewReady(reviewTimed.page);await inspectReview(reviewTimed.page,'Mensaje de prueba con transporte detenido');reviewTimed.state.reviewMode='hang';const reviewStarted=Date.now();await reviewTimed.page.getByTestId('supplier-request-review-confirm').click();await reviewTimed.page.getByTestId('supplier-request-review-retry').waitFor({timeout:35000});check(Date.now()-reviewStarted>=15000&&Date.now()-reviewStarted<35000&&reviewTimed.state.reviewWrites.length===1,'Real review client deadline becomes uncertain without automatic duplicate');await reviewTimed.context.close();
  const timed=await scenario();await fill(timed.page);timed.state.mode='hang';const started=Date.now();await timed.page.getByTestId('supplier-request-save').click();await timed.page.getByTestId('supplier-request-retry').waitFor({timeout:35000});check(Date.now()-started>=15000&&Date.now()-started<35000&&timed.state.writes.length===1,'Actual 20-second client deadline exposes uncertainty without automatic duplicate');await timed.context.close();
  assert.deepEqual(report.clientErrors,[],'No client exceptions');assert.deepEqual(report.blockedRequests,[],'No remote calls or unexpected mutations');assert.deepEqual(report.checks.filter(c=>!c.passed),[],'All behavioral and visual assertions pass');report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);throw error;}
finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));console.log(JSON.stringify({status:report.status,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),views:report.views.length,output},null,2));}
