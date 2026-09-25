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
const output=resolve(process.env.QA_OUTPUT||'artifacts/supplier-draft-comparison-browser');await mkdir(output,{recursive:true});
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
const report={localOnly:true,syntheticData:true,actualComponents:['SupplierRequestWorkspace','SupplierDraftComparison'],actualClientContract:true,httpBoundaryMocked:true,navigationStubbed:true,realNextServer:false,realDatabase:false,productionTested:false,checks:[],views:[],clientErrors:[],blockedRequests:[]};
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
  await page.addInitScript(value=>{window.__qaInitial=value;const real=window.fetch.bind(window);window.fetch=(url,init={})=>real(url,window.__qaIgnoreAbort?{...init,signal:undefined}:init);},props);
  page.on('pageerror',error=>report.clientErrors.push(error.message));
  const state={listMode:options.listMode||"success",detailMode:options.detailMode||"success",readPending:[],omitFromList:[],reads:[],writes:[],orderWrites:[],rows:options.store?.rows||new Map((options.rows||[]).map(row=>[row.id,row])),receipts:new Map(),mode:'success',pending:[],truncated:false,reviewReads:[],reviewWrites:[],reviewEvents:options.store?.reviewEvents||new Map(),reviewReceipts:options.store?.reviewReceipts||new Map(),reviewMode:'success',reviewReadMode:options.reviewReadMode||'success',reviewPending:[]};
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
    if(previous&&previous.revision!==body.expected_revision)return{ok:false,reason:'supplier_request_revision_conflict'};
    if(previous&&previous.status!=='draft')return{ok:false,reason:'supplier_request_not_draft'};
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
        const id=url.pathname.split('/')[4],readMode=id?state.detailMode:state.listMode;
        if(['401','403','404','503'].includes(readMode))return send(route,Number(readMode),{ok:false,reason:'supplier_request_scope_forbidden'});
        if(readMode==='delayed'||readMode==='hang'){const value=id?envelope(tenant,{request:structuredClone(state.rows.get(id))}):envelope(tenant,{items:[...state.rows.values()].filter(x=>!state.omitFromList.includes(x.id)).map(x=>structuredClone(x)),count:[...state.rows.values()].filter(x=>!state.omitFromList.includes(x.id)).length,truncated:state.truncated});state.readPending.push({route,value});return;}
        if(id){const row=state.rows.get(id);return send(route,row?200:404,row?envelope(tenant,{request:row}):{ok:false,reason:'supplier_request_not_found'});}
        const items=[...state.rows.values()].filter(row=>(tenant?row.tenant_slug===tenant:row.status!=='draft')&&!state.omitFromList.includes(row.id));return send(route,200,envelope(tenant,{items,count:items.length,truncated:state.truncated}));
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
      return send(route,result.ok?200:409,result);
    }
    if(request.method()==='GET'&&['/','/fixture.js','/favicon.ico'].includes(url.pathname))return route.continue();
    report.blockedRequests.push(request.method()+' '+url.pathname);return route.abort();
  });
  state.releaseReads=async()=>{for(const p of state.readPending.splice(0))await send(p.route,200,p.value);};
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

async function finishedRead(page){await page.waitForFunction(()=>!document.querySelector('[data-testid="supplier-request-read-cancel"]'));await tick(page);}

const completeRow=(patch={})=>item({title:'Proyecto original',notes:'Notas originales',construction_id:'pet_wet',quantity:125,pack_purpose:'trial_integration',...patch});
async function makeConflict(t,row,server={}){t.state.rows.set(row.id,{...row,revision:row.revision+1,...server});await t.page.getByTestId('supplier-request-save').click();await t.page.getByTestId('supplier-request-conflict').waitFor();}
async function compare(t){await t.page.getByRole('button',{name:'Consultar versión actual',exact:true}).click();await t.page.getByTestId('draft-comparison').waitFor();}
try{
 for(const theme of ['light','dark'])for(const width of [320,390,1440]){
  const row=completeRow(),t=await scenario(width,theme,openedOptions(row));await t.page.getByTestId('supplier-request-title').fill('Nombre de mi edición');
  await t.page.getByTestId('supplier-request-quantity').fill('250');
  await makeConflict(t,row,{title:'Nombre en el servidor',notes:'Nota de la otra sesión <b>literal</b>',quantity:500});await compare(t);
  check(t.state.writes.length===1&&t.state.rows.get(row.id).revision===2,'Rejected stale save does not modify fixture state');
  check(await t.page.getByTestId('draft-comparison').locator('h3').evaluate(n=>document.activeElement===n),'Comparison heading receives keyboard focus');
  check(!await t.page.getByTestId('choice-local-title').isChecked()&&!await t.page.getByTestId('choice-server-title').isChecked(),'Both-side title conflict is not silently preselected');
  check(await t.page.getByTestId('choice-server-notes').isChecked(),'Remote-only notes remain selected by default');
  check(await t.page.getByTestId('draft-comparison-apply').isDisabled()&&await t.page.getByTestId('supplier-request-save').isDisabled(),'Missing conflict choices prevent both local application and stale save');
  await t.page.getByTestId('draft-comparison-apply').evaluate(b=>{b.disabled=false;b.click();b.disabled=true;});check(t.state.writes.length===1,'Forced disabled action does not write');
  await inspect(t.page,'draft-compare-pending',width,theme);
  await t.page.getByTestId('choice-local-title').check();await t.page.getByTestId('choice-server-quantity').check();
  check(await t.page.getByTestId('supplier-request-title').inputValue()==='Nombre de mi edición'&&await t.page.getByTestId('supplier-request-quantity').inputValue()==='250','Choosing values alone does not modify the parent draft');
  const writes=t.state.writes.length;await t.page.getByTestId('draft-comparison-apply').click();await t.page.getByTestId('draft-comparison').waitFor({state:'detached'});
  check(await t.page.getByTestId('supplier-request-title').inputValue()==='Nombre de mi edición'&&await t.page.getByTestId('supplier-request-quantity').inputValue()==='500'&&await t.page.getByTestId('supplier-request-notes').inputValue()==='Nota de la otra sesión <b>literal</b>','Applied selection preserves chosen local data AND remote-only content');
  check(t.state.writes.length===writes&&!await t.page.getByTestId('supplier-request-status').textContent().then(s=>s.includes('Guardado confirmado')),'Applying selection is local, not a save receipt');
  await inspect(t.page,'draft-compare-local-ready',width,theme);
  await t.page.getByTestId('supplier-request-save').click();await saved(t.page);
  const last=t.state.writes.at(-1);check(last.method==='PATCH'&&last.body.expected_revision===2&&last.body.notes.includes('otra sesión')&&last.body.quantity===500,'Only explicit save uses the compared revision and reviewed fields');
  check(last.key!==t.state.writes[0].key&&t.state.rows.get(row.id).revision===3,'Certain conflict resolves with new operation, not reuse of rejected intent');
  check(!t.state.orderWrites.length&&!t.state.reviewWrites.length,'Conflict resolution never creates technical orders or clarification messages');await t.context.close();
 }
 const independent=completeRow(),auto=await scenario(390,'light',openedOptions(independent));await auto.page.getByTestId('supplier-request-title').fill('Nombre local');await makeConflict(auto,independent,{notes:'Sólo servidor'});await compare(auto);check(!await auto.page.getByTestId('draft-comparison-apply').isDisabled(),'Disjoint field changes can be proposed together');
 await auto.page.keyboard.press('Escape');await auto.page.getByTestId('draft-comparison').waitFor({state:'detached'});check(await auto.page.getByRole('button',{name:'Consultar versión actual',exact:true}).evaluate(b=>document.activeElement===b),'Escape keeps editing and returns focus to the compare trigger');check(await auto.page.getByTestId('supplier-request-notes').inputValue()===independent.notes&&auto.state.writes.length===1,'Discarded comparison never alters local fields');
 await compare(auto);auto.page.once('dialog',d=>d.dismiss());await auto.page.getByTestId('draft-comparison-load').click();check(await auto.page.getByTestId('draft-comparison').count()===1,'Cancelling full replacement preserves comparison and local data');
 auto.page.once('dialog',d=>d.accept());await auto.page.getByTestId('draft-comparison-load').click();await auto.page.getByTestId('draft-comparison').waitFor({state:'detached'});check(await auto.page.getByTestId('supplier-request-title').inputValue()===independent.title&&await auto.page.getByTestId('supplier-request-notes').inputValue()==='Sólo servidor'&&auto.state.writes.length===1,'Explicit full replacement loads current fields without writing');await auto.context.close();
 const changing=completeRow(),again=await scenario(390,'dark',openedOptions(changing));await again.page.getByTestId('supplier-request-title').fill('Edición mantenida');await makeConflict(again,changing,{notes:'Servidor v2'});await compare(again);await again.page.getByTestId('draft-comparison-apply').click();await again.page.getByTestId('draft-comparison').waitFor({state:'detached'});
 again.state.rows.set(changing.id,{...again.state.rows.get(changing.id),revision:3,notes:'Servidor v3'});await again.page.getByTestId('supplier-request-save').click();await again.page.getByTestId('supplier-request-conflict').waitFor();check(again.state.rows.get(changing.id).notes==='Servidor v3','Server changing again cannot be overwritten by applied local revision');await compare(again);await again.page.getByTestId('draft-comparison-apply').click();await again.page.getByTestId('draft-comparison').waitFor({state:'detached'});again.state.mode='commit-lost';await again.page.getByTestId('supplier-request-save').click();await again.page.getByTestId('supplier-request-retry').waitFor();
 const command=again.state.writes.at(-1);check(command.body.expected_revision===3&&again.state.rows.get(changing.id).revision===4,'Reviewed subsequent save commits once even if response is lost');again.state.mode='success';await again.page.getByTestId('supplier-request-retry').click();await saved(again.page);check(again.state.writes.at(-1).key===command.key&&JSON.stringify(again.state.writes.at(-1).body)===JSON.stringify(command.body)&&again.state.rows.get(changing.id).revision===4,'Uncertain save reuses identical receipt identity after reconciliation');await again.context.close();
 const editRow=completeRow(),edit=await scenario(390,'light',openedOptions(editRow));await edit.page.getByTestId('supplier-request-title').fill('Local uno');await makeConflict(edit,editRow,{title:'Nombre del servidor'});await compare(edit);await edit.page.getByTestId('choice-local-title').check();await edit.page.getByTestId('supplier-request-title').fill('Local dos');check(!await edit.page.getByTestId('choice-local-title').isChecked()&&await edit.page.getByTestId('draft-comparison-apply').isDisabled(),'Changing local input invalidates previous field decisions');await edit.page.getByTestId('supplier-request-title').focus();await edit.page.getByTestId('supplier-request-title').press('End');await edit.page.getByTestId('supplier-request-title').pressSequentially(' más texto');check(await edit.page.getByTestId('supplier-request-title').inputValue()==='Local dos más texto'&&await edit.page.getByTestId('supplier-request-title').evaluate(n=>document.activeElement===n),'Editing after comparison never steals keyboard focus on each keystroke');await edit.context.close();
 const terminal=completeRow(),closed=await scenario(390,'dark',openedOptions(terminal));await closed.page.getByTestId('supplier-request-title').fill('Edición que no debe reabrir');await makeConflict(closed,terminal,{status:'submitted',submitted_at:'2026-09-25T12:00:00Z'});await compare(closed);check(await closed.page.getByTestId('draft-comparison-terminal').count()===1&&!await closed.page.getByTestId('draft-comparison-apply').count(),'Submitted source cannot be reopened through reconciliation');check(await closed.page.getByTestId('supplier-request-title').inputValue()==='Edición que no debe reabrir','Terminal comparison preserves local text until explicit decision');closed.page.once('dialog',d=>d.accept());await closed.page.getByTestId('draft-comparison-load').click();await reviewReady(closed.page);check(await closed.page.getByTestId('supplier-request-title').isDisabled()&&closed.state.writes.length===1,'Loading submitted source becomes read-only without another write');await closed.context.close();
 for(const status of ['401','403','404']){const row=completeRow(),t=await scenario(390,'light',openedOptions(row));await t.page.getByTestId('supplier-request-title').fill('Local sensitive');await makeConflict(t,row,{notes:'Remote sensitive'});await compare(t);t.state.detailMode=status;await t.page.getByRole('button',{name:'Consultar versión actual',exact:true}).click();await t.page.getByTestId('supplier-request-read-denied').waitFor();check(!await t.page.getByTestId('draft-comparison').count()&&!await t.page.getByTestId('supplier-request-title').count(),'Read '+status+' withdraws both comparison and draft');check(t.state.writes.length===1,'No retries or writes on read denial');await t.context.close();}
 const delayedRow=completeRow(),late=await scenario(390,'light',openedOptions(delayedRow));await late.page.getByTestId('supplier-request-title').fill('Local');await makeConflict(late,delayedRow,{notes:'Remote v2'});await compare(late);late.state.detailMode='delayed';await late.page.evaluate(()=>window.__qaIgnoreAbort=true);await late.page.getByRole('button',{name:'Consultar versión actual',exact:true}).click();await waitFor(()=>late.state.readPending.length===1);check(!await late.page.getByTestId('draft-comparison').count(),'Refreshing comparison immediately removes old comparison controls');await late.page.getByTestId('supplier-request-read-cancel').click();await late.state.releaseReads();await tick(late.page);check(!await late.page.getByTestId('draft-comparison').count()&&late.state.writes.length===1,'Cancelled late comparison cannot be applied even if transport ignores abort');await late.context.close();
 const longRow=completeRow({notes:'Base'}),long=await scenario(320,'dark',openedOptions(longRow));await long.page.getByTestId('supplier-request-notes').fill('Texto local largo '.repeat(180));await makeConflict(long,longRow,{notes:'Texto remoto largo '.repeat(180)});await compare(long);await long.page.getByTestId('comparison-local-notes').focus();await long.page.getByTestId('comparison-local-notes').press('End');check(await long.page.getByTestId('comparison-local-notes').evaluate(n=>document.activeElement===n&&n.scrollHeight>n.clientHeight),'Long note comparison is keyboard focusable and bounded without truncating text');await inspect(long.page,'draft-compare-long-notes',320,'dark');await long.context.close();
 assert.deepEqual(report.clientErrors,[]);assert.deepEqual(report.blockedRequests,[]);assert.ok(report.checks.every(c=>c.passed),JSON.stringify(report.checks.filter(c=>!c.passed)));report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);throw error;}
finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,output},null,2));}
