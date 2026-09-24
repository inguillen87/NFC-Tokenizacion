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
const output=resolve(process.env.QA_OUTPUT||'artifacts/supplier-delivery-ack-browser');await mkdir(output,{recursive:true});
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
const report={localOnly:true,syntheticData:true,actualComponents:['SupplierRequestWorkspace','SupplierRequestDeliveryAck'],actualClientContract:true,httpBoundaryMocked:true,navigationStubbed:true,realNextServer:false,realDatabase:false,productionTested:false,checks:[],views:[],clientErrors:[],blockedRequests:[]};
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
  const state={ackEvents:new Map(),ackSources:new Map(),ackArtifacts:new Map(),ackReceipts:new Map(),ackReads:[],ackWrites:[],ackPending:[],ackMode:'success',ackReadMode:'success',ackEnabled:true,ackCommits:0,bindingEvents:new Map(),bindingSpecs:new Map(),bindingReceipts:new Map(),bindingDispatch:new Map(),bindingReads:[],bindingWrites:[],bindingPending:[],bindingMode:'success',bindingReadMode:'success',bindingEnabled:true,bindingCommits:0,reads:[],writes:[],orderWrites:[],rows:options.store?.rows||new Map((options.rows||[]).map(row=>[row.id,row])),receipts:new Map(),mode:'success',pending:[],truncated:false,reviewReads:[],reviewWrites:[],reviewEvents:options.store?.reviewEvents||new Map(),reviewReceipts:options.store?.reviewReceipts||new Map(),reviewMode:'success',reviewReadMode:options.reviewReadMode||'success',reviewPending:[]};
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
      if(url.pathname.endsWith('/delivery-ack')){
        const id=url.pathname.split('/')[4],row=state.rows.get(id),hash='sha256:'+'a'.repeat(64);
        if(!state.ackSources.has(id))state.ackSources.set(id,{dispatch_id:randomUUID(),binding_id:randomUUID(),supplier_ref:'FACTORY-QA',supplier_name:'Proveedor de prueba',spec_revision:1,spec_hash:hash,sent_at:'2026-09-24T12:01:00.000Z'});
        if(!state.ackArtifacts.has(id))state.ackArtifacts.set(id,[{id:randomUUID(),hash,created_at:'2026-09-24T12:00:00.000Z'}]);
        const current=(before=null)=>{const events=state.ackEvents.get(id)||[],last=events.at(-1)||null,eligible=before===null?events:events.filter(e=>e.revision<before),history=eligible.slice(-50),next=history[0]?.revision>1?history[0].revision:null,artifacts=state.ackArtifacts.get(id);
          return{...envelope(tenant,{}),protocol:'nexid.supplier-delivery-ack.v1',writes_enabled:state.ackEnabled,request_id:id,request_revision:row.revision,order_id:row.order_id,source:state.ackSources.get(id),artifacts:structuredClone(artifacts),artifacts_count:artifacts.length,artifacts_truncated:false,revision:last?.revision||0,current:last?structuredClone(last):null,history:structuredClone(history),count:history.length,truncated:next!==null,next_before_revision:next,as_of:'2026-09-24T13:00:00.000Z'};};
        if(request.method()==='GET'){
          state.ackReads.push({id,tenant,before:url.searchParams.get('before_revision')});
          if(['401','403','404','503'].includes(state.ackReadMode))return send(route,Number(state.ackReadMode),{ok:false,reason:'supplier_delivery_ack_scope_forbidden'});
          const result=current(url.searchParams.has('before_revision')?Number(url.searchParams.get('before_revision')):null);
          if(state.ackReadMode==='foreign')result.scope.tenant_id=randomUUID();if(state.ackReadMode==='demo')result.demo=true;
          if(state.ackReadMode==='delayed'){state.ackPending.push({route,result,read:true});return;}
          return send(route,200,result);
        }
        const operation={id,tenant,key:request.headers()['idempotency-key'],body:request.postDataJSON()};state.ackWrites.push(operation);
        const commit=()=>{const prior=state.ackReceipts.get(operation.key);if(prior)return{...current(),receipt:prior,idempotent_replay:true};const events=state.ackEvents.get(id)||[],body=operation.body;
          if(body.expected_revision!==events.length)return{ok:false,reason:'supplier_delivery_ack_revision_conflict'};
          if(body.action!=='withdraw'&&!state.ackArtifacts.get(id).some(a=>a.id===body.artifact_id&&a.hash===body.artifact_hash))return{ok:false,reason:'supplier_delivery_ack_artifact_changed'};
          const{expected_revision,expected_request_revision,...fields}=body;const event={...fields,id:randomUUID(),revision:events.length+1,request_revision:row.revision,actor_id:actor,created_at:'2026-09-24T12:03:00.000Z',source:'nexid_manual_record',supplier_authenticated:false,download_verified:false,decryption_verified:false,physical_received:false};state.ackEvents.set(id,[...events,event]);state.ackCommits++;
          const receipt={idempotency_key:operation.key,event_id:event.id,action:event.action,revision:event.revision};state.ackReceipts.set(operation.key,receipt);return{...current(),receipt,idempotent_replay:false};};
        if(state.ackMode==='delayed'||state.ackMode==='hang'){state.ackPending.push({route,commit});return;}
        if(['401','403','404'].includes(state.ackMode))return send(route,Number(state.ackMode),{ok:false,reason:'supplier_delivery_ack_scope_forbidden'});
        if(state.ackMode==='conflict')return send(route,409,{ok:false,reason:'supplier_delivery_ack_revision_conflict'});
        const result=commit();if(state.ackMode==='commit-lost')return send(route,503,{ok:false,reason:'supplier_delivery_ack_response_lost'});
        if(state.ackMode==='malformed'&&result.receipt)result.receipt={...result.receipt,event_id:randomUUID()};
        return send(route,result.ok?200:409,result);
      }
      if(url.pathname.endsWith('/supplier-binding')){
        const id=url.pathname.split('/')[4],row=state.rows.get(id);
        if(!state.bindingSpecs.has(id))state.bindingSpecs.set(id,{status:'approved',revision:1,hash:'sha256:'+'a'.repeat(64),decision_id:randomUUID(),ready:true});
        const current=(before=null)=>{const events=state.bindingEvents.get(id)||[],latest=events.at(-1)||null,eligible=before===null?events:events.filter(e=>e.revision<before),history=eligible.slice(-50);const next=history[0]?.revision>1?history[0].revision:null;
          return{...envelope(tenant,{}),protocol:'nexid.supplier-binding.v1',writes_enabled:state.bindingEnabled,request_id:id,request_revision:row.revision,
           order:{id:row.order_id,status:state.bindingDispatch.has(id)?'sent_to_supplier':'pack_ready',pack_purpose:row.pack_purpose},specification:structuredClone(state.bindingSpecs.get(id)),revision:latest?.revision||0,current:latest?structuredClone(latest):null,
           history:structuredClone(history),count:history.length,truncated:next!==null,next_before_revision:next,dispatch_receipt:state.bindingDispatch.get(id)||null,as_of:'2026-09-24T13:01:00.000Z'};};
        if(request.method()==='GET'){
          state.bindingReads.push({id,tenant,before:url.searchParams.get('before_revision')});
          if(['401','403','404','503'].includes(state.bindingReadMode))return send(route,Number(state.bindingReadMode),{ok:false,reason:'supplier_binding_scope_forbidden'});
          const result=current(url.searchParams.has('before_revision')?Number(url.searchParams.get('before_revision')):null);
          if(state.bindingReadMode==='foreign')result.scope.tenant_slug='foreign';if(state.bindingReadMode==='demo')result.demo=true;
          if(state.bindingReadMode==='delayed'){state.bindingPending.push({route,result,read:true});return;}
          return send(route,200,result);
        }
        const operation={id,tenant,key:request.headers()['idempotency-key'],body:request.postDataJSON()};state.bindingWrites.push(operation);
        const commit=()=>{const prior=state.bindingReceipts.get(operation.key);if(prior)return{...current(),receipt:prior,idempotent_replay:true};const events=state.bindingEvents.get(id)||[],last=events.at(-1),body=operation.body,spec=state.bindingSpecs.get(id);
          if(state.bindingDispatch.has(id))return{ok:false,reason:'supplier_binding_dispatch_locked'};
          if(body.expected_revision!==(last?.revision||0))return{ok:false,reason:'supplier_binding_revision_conflict'};
          if(body.action==='assign'&&(!spec.ready||body.spec.revision!==spec.revision||body.spec.hash!==spec.hash||body.spec.decision_id!==spec.decision_id))return{ok:false,reason:'supplier_binding_spec_changed'};
          const event={id:randomUUID(),revision:events.length+1,request_revision:row.revision,order_id:row.order_id,action:body.action,supplier:body.supplier||last.supplier,spec:body.spec||last.spec,reason:body.reason,actor_id:actor,created_at:'2026-09-24T13:00:00.000Z'};
          state.bindingEvents.set(id,[...events,event]);state.bindingCommits++;const receipt={idempotency_key:operation.key,event_id:event.id,action:event.action,revision:event.revision};state.bindingReceipts.set(operation.key,receipt);return{...current(),receipt,idempotent_replay:false};};
        if(state.bindingMode==='delayed'||state.bindingMode==='hang'){state.bindingPending.push({route,commit});return;}
        if(['401','403','404'].includes(state.bindingMode))return send(route,Number(state.bindingMode),{ok:false,reason:'supplier_binding_scope_forbidden'});
        if(state.bindingMode==='conflict')return send(route,409,{ok:false,reason:'supplier_binding_revision_conflict'});
        const result=commit();if(state.bindingMode==='commit-lost')return send(route,503,{ok:false,reason:'supplier_binding_response_lost'});
        if(state.bindingMode==='malformed'&&result.receipt)result.receipt={...result.receipt,event_id:randomUUID()};
        return send(route,result.ok?200:409,result);
      }
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
  state.releaseAck=async()=>{for(const p of state.ackPending.splice(0)){const result=p.read?p.result:p.commit();await send(p.route,result.ok?200:409,result);}};
  state.releaseBinding=async()=>{for(const item of state.bindingPending.splice(0)){const result=item.read?item.result:item.commit();await send(item.route,result.ok?200:409,result);}};
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

const provisioned=(patch={})=>submitted({title:'Pedido preparado QA',status:'provisioned',revision:5,order_id:randomUUID(),...patch});
const issuer={role:'super-admin',tenantSlug:null,permissions:['supplier_order.create']};
async function openBinding(page){await page.getByTestId('binding-open').click();await page.getByTestId('binding-refresh').waitFor();}
async function inspectBinding(page,withdraw=false){await page.getByTestId(withdraw?'binding-withdraw':'binding-assign').click();if(!withdraw){await page.getByTestId('binding-reference').fill('FACTORY-QA');await page.getByTestId('binding-name').fill('Proveedor sintético <b>literal</b>');await page.getByTestId('binding-confirmation-ref').fill('CONF-QA-001');}await page.getByTestId('binding-reason').fill('Referencia de confirmación revisada.');await page.getByTestId('binding-inspect').click();await page.getByTestId('binding-confirmation').waitFor();}
async function bindingSaved(page,revision){await page.getByTestId('binding-receipt').filter({hasText:'revisión '+revision}).waitFor();}

const readyRow=(patch={})=>submitted({status:'provisioned',revision:5,order_id:randomUUID(),title:'Pedido preparado para acuse',...patch});
const opts=(row,extra={})=>({...openedOptions(row),access:nexid,...extra});
async function openAck(page){await page.getByTestId('ack-open').click();await page.getByTestId('ack-refresh').waitFor();}
async function fillAck(page,state,row,action='received'){
 await page.getByTestId('ack-'+action).click();if(action!=='withdraw'){await page.getByTestId('ack-artifact').selectOption(state.ackArtifacts.get(row.id)[0].id);if(action==='received')await page.getByTestId('ack-reported-hash').fill(state.ackArtifacts.get(row.id)[0].hash);}
 await page.getByTestId('ack-evidence').fill('COMUNICACION-QA-001');await page.getByTestId('ack-reason').fill('Registro literal <b>sin interpretar</b>');await page.getByTestId('ack-inspect').click();await page.getByTestId('ack-confirmation').waitFor();
}
try{
 for(const theme of ['light','dark'])for(const width of [320,390,1440]){
  const row=readyRow(),t=await scenario(width,theme,opts(row));await reviewReady(t.page);
  check(t.state.ackReads.length===0&&t.state.ackWrites.length===0,'No automatic lookup or acknowledgement on request open');await openAck(t.page);await t.page.getByTestId('ack-received').click();
  check(await t.page.getByTestId('ack-artifact').inputValue()===''&&await t.page.getByTestId('ack-reported-hash').inputValue()==='','Neither package selection nor reported supplier checksum is invented');
  await t.page.getByTestId('ack-artifact').selectOption(t.state.ackArtifacts.get(row.id)[0].id);await t.page.getByTestId('ack-evidence').fill('ACK-001');await t.page.getByTestId('ack-reason').fill('Comprobante de prueba');await t.page.getByTestId('ack-reported-hash').fill('sha256:'+'b'.repeat(64));await t.page.getByTestId('ack-inspect').click();
  check(await t.page.getByTestId('ack-panel').getByRole('alert').count()===1&&t.state.ackWrites.length===0,'Wrong envelope checksum cannot reach receipt confirmation');
  await t.page.getByTestId('ack-reported-hash').fill(t.state.ackArtifacts.get(row.id)[0].hash);await t.page.getByTestId('ack-inspect').click();await t.page.getByTestId('ack-confirmation').waitFor();
  check(await t.page.getByTestId('ack-confirmation').locator('h3').evaluate(n=>document.activeElement===n),'Keyboard focus moves to final confirmation');
  check(t.state.ackWrites.length===0&&await t.page.getByTestId('binding-open').isDisabled()&&await t.page.getByRole('button',{name:'Actualizar bandeja',exact:true}).isDisabled(),'Review is local and blocks competing edits');
  await inspect(t.page,'ack-confirmation',width,theme);await t.page.getByRole('button',{name:'Volver a editar',exact:true}).click();
  t.page.once('dialog',d=>d.dismiss());await t.page.getByTestId('ack-close').click();check(await t.page.getByTestId('ack-form').count()===1,'Cancel discard preserves documentary draft');
  t.page.once('dialog',d=>d.accept());await t.page.getByTestId('ack-close').click();await tick(t.page);check(await t.page.getByTestId('ack-open').evaluate(n=>document.activeElement===n),'Closing returns keyboard focus');
  await openAck(t.page);await fillAck(t.page,t.state,row);t.state.ackMode='delayed';await t.page.getByTestId('ack-confirm').evaluate(b=>{b.click();b.click();});await waitFor(()=>t.state.ackPending.length===1);
  check(t.state.ackWrites.length===1,'Same-loop duplicate confirmation suppressed');await t.state.releaseAck();await t.page.getByTestId('ack-receipt').waitFor();
  check(t.state.ackCommits===1&&t.state.ackEvents.get(row.id)[0].source==='nexid_manual_record'&&!t.state.ackEvents.get(row.id)[0].physical_received,'Saved record explicitly remains documentary, not physical receipt');
  check(t.state.writes.length===0&&t.state.orderWrites.length===0&&t.state.bindingWrites.length===0,'No order, supplier mutation, actual transfer or secret export');await inspect(t.page,'ack-recorded',width,theme);
  t.state.ackMode='success';await fillAck(t.page,t.state,row,'withdraw');await t.page.getByTestId('ack-confirm').click();await t.page.getByTestId('ack-receipt').filter({hasText:'revisión 2'}).waitFor();
  check(t.state.ackEvents.get(row.id)[0].action==='received'&&t.state.ackEvents.get(row.id)[1].action==='withdraw'&&!await t.page.getByTestId('ack-withdraw').count(),'Correction appends an event instead of deleting the previous receipt');await t.context.close();
 }
 const companyRow=readyRow(),company=await scenario(390,'light',opts(companyRow,{access:principal}));await reviewReady(company.page);await openAck(company.page);check(!await company.page.getByTestId('ack-received').count()&&!await company.page.getByTestId('ack-issue').count()&&company.state.ackWrites.length===0,'Company can read but cannot register a supplier acknowledgement');await company.context.close();
 const disabledRow=readyRow(),disabled=await scenario(390,'light',opts(disabledRow));await reviewReady(disabled.page);disabled.state.ackEnabled=false;await openAck(disabled.page);check(!await disabled.page.getByTestId('ack-received').count(),'Default-off rollout still permits read-only lookup');await disabled.context.close();
 const noSourceRow=readyRow(),noSource=await scenario(390,'light',opts(noSourceRow));await reviewReady(noSource.page);noSource.state.ackSources.set(noSourceRow.id,null);noSource.state.ackArtifacts.set(noSourceRow.id,[]);await openAck(noSource.page);check(!await noSource.page.getByTestId('ack-received').count()&&noSource.state.ackWrites.length===0,'Missing dispatch/source never fabricates a package');await noSource.context.close();
 for(const mode of ['503','foreign','demo']){const row=readyRow(),t=await scenario(390,'light',opts(row));await reviewReady(t.page);t.state.ackReadMode=mode;await t.page.getByTestId('ack-open').click();await t.page.getByTestId('ack-panel').getByRole('alert').waitFor();check(!await t.page.getByTestId('ack-source').count()&&t.state.ackWrites.length===0,'Unavailable/foreign/demo acknowledgement is rejected '+mode);await t.page.getByTestId('ack-close').click();await t.context.close();}
 for(const mode of ['commit-lost','malformed']){const row=readyRow(),t=await scenario(390,'dark',opts(row));await reviewReady(t.page);await openAck(t.page);await fillAck(t.page,t.state,row);t.state.ackMode=mode;await t.page.getByTestId('ack-confirm').click();await t.page.getByTestId('ack-retry').waitFor();
 t.state.ackMode='403';await t.page.getByTestId('ack-retry').click();await t.page.getByTestId('ack-panel').getByRole('alert').waitFor();await tick(t.page);const text=await t.page.locator('main').innerText();check(!text.includes(row.title)&&!text.includes(row.id)&&!text.includes(t.state.ackArtifacts.get(row.id)[0].hash),'Access denial hides parent and package context even after an uncertain commit');
 t.state.ackMode='success';await t.page.getByTestId('ack-retry').click();await t.page.getByTestId('ack-receipt').waitFor();check(t.state.ackCommits===1&&new Set(t.state.ackWrites.map(w=>w.key)).size===1&&new Set(t.state.ackWrites.map(w=>JSON.stringify(w.body))).size===1,'Uncertain receipt recovery retains the exact command and single event');await t.context.close();}
 const cRow=readyRow(),cas=await scenario(390,'light',opts(cRow));await reviewReady(cas.page);await openAck(cas.page);await fillAck(cas.page,cas.state,cRow,'issue');cas.state.ackMode='conflict';await cas.page.getByTestId('ack-confirm').click();await cas.page.getByTestId('ack-panel').getByRole('alert').waitFor();check((await cas.page.getByTestId('ack-reason').inputValue()).includes('Registro literal')&&cas.state.ackCommits===0,'Certain conflict preserves draft and does not silently retry');cas.state.ackMode='success';await cas.page.getByTestId('ack-reload').click();await cas.page.getByTestId('ack-inspect').waitFor();await cas.page.getByTestId('ack-inspect').click();await cas.page.getByTestId('ack-confirm').click();await cas.page.getByTestId('ack-receipt').waitFor();check(cas.state.ackEvents.get(cRow.id)[0].action==='issue','Explicit issue record never becomes received');await cas.context.close();
 const hRow=readyRow(),hist=await scenario(1440,'dark',opts(hRow));await reviewReady(hist.page);await openAck(hist.page);await fillAck(hist.page,hist.state,hRow,'issue');await hist.page.getByTestId('ack-confirm').click();await hist.page.getByTestId('ack-receipt').waitFor();const seed=hist.state.ackEvents.get(hRow.id)[0];hist.state.ackEvents.set(hRow.id,Array.from({length:53},(_,n)=>({...seed,id:randomUUID(),revision:n+1})));await hist.page.getByTestId('ack-refresh').click();await tick(hist.page);await hist.page.getByTestId('ack-history').locator('summary').click();await hist.page.getByTestId('ack-older').waitFor();check(await hist.page.getByTestId('ack-history').locator('li').count()===50,'History starts bounded at fifty events');await hist.page.getByTestId('ack-older').click();await hist.page.waitForFunction(()=>document.querySelectorAll('[data-testid="ack-history"] li').length===53);check(hist.state.ackReads.at(-1).before==='4'&&!await hist.page.getByTestId('ack-older').count(),'Exclusive history cursor restores remaining events without duplicates');await hist.context.close();
 const a=readyRow({title:'Expediente A'}),b=readyRow({title:'Expediente B'}),late=await scenario(390,'light',opts(a,{rows:[a,b]}));await reviewReady(late.page);late.state.ackReadMode='delayed';await late.page.getByTestId('ack-open').click();await waitFor(()=>late.state.ackPending.length===1);late.state.ackReadMode='success';await late.page.evaluate(id=>window.__qaContext({initialRequestId:id}),b.id);await late.page.getByTestId('supplier-request-detail-heading').filter({hasText:b.title}).waitFor();await reviewReady(late.page);await late.page.evaluate(id=>window.__qaContext({initialRequestId:id}),a.id);await late.page.getByTestId('supplier-request-detail-heading').filter({hasText:a.title}).waitFor();await reviewReady(late.page);await late.state.releaseAck();await tick(late.page);check(!await late.page.getByTestId('ack-panel').count(),'Late response cannot reopen old A state after A to B to A');await late.context.close();
 const timeoutRow=readyRow(),timed=await scenario(390,'light',opts(timeoutRow));await reviewReady(timed.page);await openAck(timed.page);await fillAck(timed.page,timed.state,timeoutRow);timed.state.ackMode='hang';const start=Date.now();await timed.page.getByTestId('ack-confirm').click();await timed.page.getByTestId('ack-retry').waitFor({timeout:30000});check(Date.now()-start>=18000&&timed.state.ackWrites.length===1,'Actual twenty-second timeout preserves uncertainty without automatic resend');await timed.context.close();
 assert.deepEqual(report.clientErrors,[]);assert.deepEqual(report.blockedRequests,[]);assert.ok(report.checks.every(c=>c.passed),JSON.stringify(report.checks.filter(c=>!c.passed)));report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);throw error;}
finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));console.log(JSON.stringify({status:report.status,checks:report.checks.length,views:report.views.length,output},null,2));}
